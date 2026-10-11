"use client";

import { useState, useRef, useEffect, useCallback, memo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Send, Wrench, Copy, Check, Paperclip, X, Plus } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { PdfPreviewCard } from "@/components/ui/pdf-preview-card";
import { useCalendarVisibility } from "@/hooks/useCalendarVisibility";
import { ChatSidebarDesktop, ChatSidebarMobile } from "./ChatSidebar";
import { compressImageClient } from "@/lib/compress-image";
import {
  ChatImagePreviewProvider,
  useImagePreview,
} from "./ChatImageLightbox";

interface UploadedImage {
  mediaId: string;
  mimeType: string;
  previewUrl: string;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  images?: UploadedImage[];
  toolCalls?: string[];
  inputTokens?: number;
  outputTokens?: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
}

interface StreamEvent {
  type: "text_delta" | "tool_call" | "done" | "error";
  text?: string;
  name?: string;
  message?: string;
  conversationId?: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheWriteTokens: number;
  };
}

interface DbChatImage {
  mediaId: string;
  mimeType: string;
  url: string;
}

interface DbChatMessage {
  id: string;
  role: string;
  content: string;
  toolCalls: string[];
  images?: DbChatImage[];
  inputTokens: number | null;
  outputTokens: number | null;
  cacheReadTokens: number | null;
  cacheWriteTokens: number | null;
}

const TOOL_LABELS: Record<string, string> = {
  get_tasks: "Looking up tasks",
  create_task: "Creating task",
  update_task: "Updating task",
  get_shifts: "Looking up shifts",
  get_diary_entries: "Reading diary",
  create_diary_entry: "Writing diary entry",
  get_calendar_events: "Checking calendar",
  create_calendar_event: "Creating event",
  update_calendar_event: "Updating event",
  get_job_applications: "Checking applications",
  create_job_application: "Creating application",
  update_job_application: "Updating application",
  get_site_status: "Checking sites",
  get_claude_metrics: "Checking Claude usage",
  get_media_files: "Looking up media",
  get_contacts: "Searching contacts",
  get_important: "Looking up important items",
  add_important: "Adding important item",
  get_dashboard_summary: "Getting dashboard overview",
  update_contact: "Updating contact",
  update_important: "Updating important topic",
  get_tennis_equipment: "Checking tennis gear",
  get_tennis_sessions: "Looking up sessions",
  get_tennis_ratings: "Checking stage ratings",
  get_tennis_notes: "Reading tennis notes",
  log_tennis_session: "Logging tennis session",
  rate_tennis_strokes: "Rating tennis strokes",
  advance_tennis_stage: "Advancing tennis stage",
  log_restring: "Logging restring",
  update_racket: "Updating racket",
  add_racket: "Adding racket",
  add_tennis_note: "Adding tennis note",
  manage_string_inventory: "Managing strings",
};

const SUGGESTIONS = [
  "Give me a dashboard summary",
  "What's on my calendar today?",
  "How's my Claude API usage?",
  "Are all my sites up?",
];

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="mt-1 ml-1 flex items-center gap-1 rounded-md px-2 py-1.5 min-h-[36px] text-[11px] text-muted-foreground opacity-100 sm:opacity-0 transition-opacity hover:bg-accent active:bg-accent sm:group-hover/msg:opacity-100"
      title="Copy message"
    >
      {copied ? (
        <>
          <Check className="h-3 w-3" />
          <span>Copied</span>
        </>
      ) : (
        <>
          <Copy className="h-3 w-3" />
          <span>Copy</span>
        </>
      )}
    </button>
  );
}

function TokenInfo({
  inputTokens,
  outputTokens,
  cacheReadTokens,
}: {
  inputTokens?: number;
  outputTokens?: number;
  cacheReadTokens?: number;
}) {
  if (!inputTokens && !outputTokens) return null;
  const parts: string[] = [];
  if (inputTokens) parts.push(`${inputTokens.toLocaleString()} in`);
  if (outputTokens) parts.push(`${outputTokens.toLocaleString()} out`);
  if (cacheReadTokens) parts.push(`${cacheReadTokens.toLocaleString()} cached`);
  return (
    <span className="ml-2 text-[11px] text-muted-foreground/50">
      {parts.join(" / ")}
    </span>
  );
}

function ThinkingDots() {
  return (
    <div className="flex items-center gap-1.5 px-1 py-1">
      <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:0ms]" />
      <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:150ms]" />
      <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:300ms]" />
    </div>
  );
}

// Cache natural image dimensions so re-renders during streaming don't cause layout shift.
const imgDimCache = new Map<string, { nw: number; nh: number }>();

function ChatImage({ src, alt }: { src?: string; alt?: string }) {
  const cached = src ? imgDimCache.get(src) : null;
  const openPreview = useImagePreview();
  return (
    <div
      className="rounded-lg my-2 overflow-hidden"
      style={{
        maxWidth: "100%",
        maxHeight: 256,
        contain: "layout style paint",
        overflowAnchor: "none",
        ...(cached
          ? { aspectRatio: `${cached.nw} / ${cached.nh}` }
          : { minHeight: 48 }),
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt || ""}
        loading="lazy"
        onClick={() => src && openPreview(src)}
        style={{
          maxHeight: 256,
          maxWidth: "100%",
          width: "auto",
          height: "auto",
          display: "block",
          cursor: src ? "zoom-in" : undefined,
        }}
        onLoad={(e) => {
          if (src && !imgDimCache.has(src)) {
            const img = e.currentTarget;
            imgDimCache.set(src, {
              nw: img.naturalWidth,
              nh: img.naturalHeight,
            });
          }
        }}
      />
    </div>
  );
}

function UserAttachedImage({ src }: { src: string }) {
  const openPreview = useImagePreview();
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt="attached"
      onClick={() => openPreview(src)}
      className="h-16 w-16 rounded-lg object-cover cursor-zoom-in"
    />
  );
}

function ToolChips({ tools: toolNames }: { tools: string[] }) {
  if (toolNames.length === 0) return null;
  const unique = [...new Set(toolNames)];
  return (
    <div className="flex flex-wrap gap-1.5 mb-2">
      {unique.map((name) => (
        <span
          key={name}
          className="inline-flex items-center gap-1 rounded-full bg-muted/50 px-2.5 py-0.5 text-[11px] text-muted-foreground"
        >
          <Wrench className="h-3 w-3" />
          {TOOL_LABELS[name] ?? name}
        </span>
      ))}
    </div>
  );
}

const MARKDOWN_CLASSES =
  "prose prose-sm prose-invert max-w-none break-words [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_p]:my-1.5 [&_ul]:my-1.5 [&_ol]:my-1.5 [&_li]:my-0.5 [&_code]:bg-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs [&_code]:break-all [&_pre]:bg-muted [&_pre]:p-3 [&_pre]:rounded-lg [&_pre]:overflow-x-auto [&_pre_code]:break-normal [&_h1]:text-base [&_h2]:text-sm [&_h3]:text-sm [&_table]:text-xs [&_table]:block [&_table]:overflow-x-auto [&_th]:px-2 [&_th]:py-1 [&_td]:px-2 [&_td]:py-1 [&_th]:border-b [&_th]:border-border [&_td]:border-b [&_td]:border-border [&_th]:whitespace-nowrap [&_a]:break-all";

const mdPlugins = [remarkGfm];
const mdComponents = {
  img: ({ src, alt }: { src?: string | Blob; alt?: string | null }) => (
    <ChatImage
      src={typeof src === "string" ? src : undefined}
      alt={alt ?? undefined}
    />
  ),
  a: ({ href, children }: { href?: string; children?: React.ReactNode }) => {
    const isPdf =
      href?.includes("#pdf") ||
      (href?.includes("/api/media/share/") &&
        typeof children === "string" &&
        /\.pdf$/i.test(children));

    if (isPdf && href) {
      const slug = href.match(/\/api\/media\/share\/([^/#?]+)/)?.[1];
      return (
        <PdfPreviewCard
          url={href}
          title={typeof children === "string" ? children : "PDF"}
          thumbnailUrl={slug ? `/api/media/share/${slug}/thumb` : null}
          className="my-2"
        />
      );
    }

    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary underline hover:text-primary/80"
      >
        {children}
      </a>
    );
  },
};

// Memoized message bubble
const MessageBubble = memo(function MessageBubble({
  message,
}: {
  message: Message;
}) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end animate-[fadeSlideIn_0.2s_ease-out]" style={{ overflowAnchor: "none" }}>
        <div className="max-w-[85%] sm:max-w-[75%] rounded-2xl bg-primary px-4 py-2.5 text-sm text-primary-foreground whitespace-pre-wrap break-words">
          {message.images && message.images.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {message.images.map((img) => (
                <UserAttachedImage
                  key={img.mediaId}
                  src={img.previewUrl}
                />
              ))}
            </div>
          )}
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start animate-[fadeSlideIn_0.2s_ease-out]" style={{ overflowAnchor: "none" }}>
      <div className="group/msg max-w-[95%] sm:max-w-[80%]">
        <Card className="rounded-2xl px-4 py-3 text-sm border-border overflow-hidden">
          {message.toolCalls && message.toolCalls.length > 0 && (
            <ToolChips tools={message.toolCalls} />
          )}
          {message.content ? (
            <div className={MARKDOWN_CLASSES}>
              <ReactMarkdown remarkPlugins={mdPlugins} components={mdComponents}>
                {message.content}
              </ReactMarkdown>
            </div>
          ) : (
            <ThinkingDots />
          )}
        </Card>
        <div className="flex items-center">
          {message.content && <CopyButton text={message.content} />}
          <TokenInfo
            inputTokens={message.inputTokens}
            outputTokens={message.outputTokens}
            cacheReadTokens={message.cacheReadTokens}
          />
        </div>
      </div>
    </div>
  );
});

// Memoized message list
const MessageList = memo(function MessageList({
  messages,
  isStreaming,
  activeTools,
}: {
  messages: Message[];
  isStreaming: boolean;
  activeTools: string[];
}) {
  return (
    <div
      className="mx-auto max-w-3xl space-y-4 px-4 py-6"
      style={{ contain: "layout style" }}
    >
      {messages.map((m) => (
        <MessageBubble key={m.id} message={m} />
      ))}
      {isStreaming && activeTools.length > 0 && (
        <div className="flex justify-start animate-[fadeSlideIn_0.2s_ease-out]" style={{ overflowAnchor: "none" }}>
          <div className="flex items-center gap-2 px-4 py-2 text-muted-foreground">
            <Wrench className="h-3.5 w-3.5 animate-pulse" />
            <span className="text-xs">
              {TOOL_LABELS[activeTools[activeTools.length - 1]!] ??
                activeTools[activeTools.length - 1]}
              ...
            </span>
          </div>
        </div>
      )}
    </div>
  );
});

export function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [hasInput, setHasInput] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [activeTools, setActiveTools] = useState<string[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [loadingConversation, setLoadingConversation] = useState(false);
  const [pendingImages, setPendingImages] = useState<{ id: string; file: File; preview: string }[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const shouldAutoScroll = useRef(true);
  const isTypingRef = useRef(false);
  const { visibleCalendarIds } = useCalendarVisibility();
  const queryClient = useQueryClient();

  // Batched streaming refs
  const streamBufferRef = useRef("");
  const streamIdRef = useRef<string | null>(null);
  const streamToolsRef = useRef<string[]>([]);
  const flushTimer = useRef<ReturnType<typeof setTimeout>>(null);

  const flushStreamBuffer = useCallback(() => {
    if (!streamIdRef.current) return;
    const id = streamIdRef.current;
    const content = streamBufferRef.current;
    const tools = [...streamToolsRef.current];
    setMessages((prev) =>
      prev.map((m) =>
        m.id === id ? { ...m, content, toolCalls: tools } : m
      )
    );
  }, []);

  const scheduleFlush = useCallback(() => {
    if (flushTimer.current) return;
    flushTimer.current = setTimeout(() => {
      flushTimer.current = null;
      flushStreamBuffer();
    }, 150);
  }, [flushStreamBuffer]);

  const scrollTimer = useRef<ReturnType<typeof setTimeout>>(null);
  const scrollToBottom = useCallback(() => {
    if (!shouldAutoScroll.current || !scrollRef.current || isTypingRef.current) return;
    if (scrollTimer.current) return;
    scrollTimer.current = setTimeout(() => {
      scrollTimer.current = null;
      requestAnimationFrame(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
      });
    }, 150);
  }, []);

  function handleScroll() {
    if (!scrollRef.current) return;
    const el = scrollRef.current;
    shouldAutoScroll.current =
      el.scrollHeight - el.scrollTop - el.clientHeight < 150;
  }

  useEffect(() => {
    scrollToBottom();
  }, [messages, activeTools, scrollToBottom]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Load conversation from DB when switching
  const loadConversation = useCallback(
    async (id: string | null) => {
      setConversationId(id);
      if (!id) {
        setMessages([]);
        inputRef.current?.focus();
        return;
      }

      setLoadingConversation(true);
      try {
        const res = await fetch(`/api/conversations/${id}`);
        if (!res.ok) throw new Error("Failed to load");
        const json = (await res.json()) as {
          data: { messages: DbChatMessage[] };
        };
        const loaded: Message[] = json.data.messages.map((m: DbChatMessage) => ({
          id: m.id,
          role: m.role as "user" | "assistant",
          content: m.content,
          toolCalls: m.toolCalls,
          images: m.images && m.images.length > 0
            ? m.images.map((img) => ({
                mediaId: img.mediaId,
                mimeType: img.mimeType,
                previewUrl: img.url,
              }))
            : undefined,
          inputTokens: m.inputTokens ?? undefined,
          outputTokens: m.outputTokens ?? undefined,
          cacheReadTokens: m.cacheReadTokens ?? undefined,
          cacheWriteTokens: m.cacheWriteTokens ?? undefined,
        }));
        setMessages(loaded);
        shouldAutoScroll.current = true;
      } catch {
        setMessages([]);
      } finally {
        setLoadingConversation(false);
        inputRef.current?.focus();
        // Force scroll after messages actually render (loading overlay removed)
        setTimeout(() => {
          if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
          }
        }, 50);
      }
    },
    []
  );

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (files.length === 0) return;

    const imageFiles = files.filter((f) => f.type.startsWith("image/"));
    const newImages = imageFiles.map((file) => ({
      id: crypto.randomUUID(),
      file,
      preview: URL.createObjectURL(file),
    }));
    setPendingImages((prev) => [...prev, ...newImages]);
  }

  function handlePaste(e: React.ClipboardEvent) {
    const items = Array.from(e.clipboardData.items);
    const imageFiles = items
      .filter((item) => item.type.startsWith("image/"))
      .map((item) => item.getAsFile())
      .filter((f): f is File => f !== null);
    if (imageFiles.length === 0) return;
    e.preventDefault();
    const newImages = imageFiles.map((file) => ({
      id: crypto.randomUUID(),
      file,
      preview: URL.createObjectURL(file),
    }));
    setPendingImages((prev) => [...prev, ...newImages]);
  }

  function removeImage(id: string) {
    setPendingImages((prev) => {
      const img = prev.find((p) => p.id === id);
      if (img) URL.revokeObjectURL(img.preview);
      return prev.filter((p) => p.id !== id);
    });
  }

  async function uploadImages(images: { id: string; file: File; preview: string }[]): Promise<UploadedImage[]> {
    const results: UploadedImage[] = [];
    for (const img of images) {
      try {
        const compressed = await compressImageClient(img.file);
        const form = new FormData();
        form.append("file", compressed);
        form.append("tags", JSON.stringify(["chat"]));
        const res = await fetch("/api/media", { method: "POST", body: form });
        if (res.ok) {
          const json = (await res.json()) as { data: { id: string; shareSlug: string; mimeType: string } };
          results.push({
            mediaId: json.data.id,
            mimeType: json.data.mimeType,
            previewUrl: img.preview,
          });
        }
      } catch {
        // skip failed uploads
      }
    }
    return results;
  }

  async function sendMessage(text?: string) {
    const content = (text ?? inputRef.current?.value ?? "").trim();
    const hasImages = pendingImages.length > 0;
    if ((!content && !hasImages) || isStreaming) return;

    // Upload pending images first
    let uploadedImages: UploadedImage[] = [];
    const imagesToUpload = [...pendingImages];
    if (imagesToUpload.length > 0) {
      setPendingImages([]);
      uploadedImages = await uploadImages(imagesToUpload);
    }

    const displayContent = content || `(${uploadedImages.length} image${uploadedImages.length > 1 ? "s" : ""} attached)`;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: displayContent,
      images: uploadedImages.length > 0 ? uploadedImages : undefined,
    };

    const history = [...messages, userMessage];
    setMessages(history);
    if (inputRef.current) {
      inputRef.current.value = "";
      inputRef.current.style.height = "auto";
    }
    setHasInput(false);
    setIsStreaming(true);
    setActiveTools([]);
    shouldAutoScroll.current = true;

    const assistantId = crypto.randomUUID();
    streamIdRef.current = assistantId;
    streamBufferRef.current = "";
    streamToolsRef.current = [];

    setMessages((prev) => [
      ...prev,
      { id: assistantId, role: "assistant", content: "", toolCalls: [] },
    ]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: conversationId
            ? [{ role: "user", content: content || "(attached images)" }]
            : history.map((m) => ({ role: m.role, content: m.content })),
          visibleCalendarIds: Array.from(visibleCalendarIds),
          conversationId,
          ...(uploadedImages.length > 0 && {
            images: uploadedImages.map((img) => ({
              mediaId: img.mediaId,
              mimeType: img.mimeType,
            })),
          }),
        }),
      });

      if (!res.ok) {
        const err = await res
          .json()
          .catch(() => ({ error: "Request failed" }));
        throw new Error(
          (err as { error?: string }).error || `HTTP ${res.status}`
        );
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response stream");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6);
          if (!jsonStr) continue;

          try {
            const event = JSON.parse(jsonStr) as StreamEvent;

            if (event.type === "text_delta" && event.text) {
              streamBufferRef.current += event.text;
              scheduleFlush();
            } else if (event.type === "tool_call" && event.name) {
              streamToolsRef.current.push(event.name);
              setActiveTools((prev) => [...prev, event.name!]);
              flushStreamBuffer();
            } else if (event.type === "done") {
              // Set conversation ID from server (new conversation case)
              if (event.conversationId && !conversationId) {
                setConversationId(event.conversationId);
                // Auto-title: first 50 chars of first user message
                const firstMsg = history.find((m) => m.role === "user");
                if (firstMsg) {
                  const title =
                    firstMsg.content.length > 50
                      ? firstMsg.content.slice(0, 50) + "..."
                      : firstMsg.content;
                  fetch(
                    `/api/conversations/${event.conversationId}`,
                    {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ title }),
                    }
                  ).catch(() => {});
                }
              }
              // Update token usage on the assistant message
              if (event.usage) {
                const usage = event.usage;
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? {
                          ...m,
                          inputTokens: usage.inputTokens,
                          outputTokens: usage.outputTokens,
                          cacheReadTokens: usage.cacheReadTokens,
                          cacheWriteTokens: usage.cacheWriteTokens,
                        }
                      : m
                  )
                );
              }
              // Refresh conversation list
              queryClient.invalidateQueries({
                queryKey: ["conversations"],
              });
            } else if (event.type === "error") {
              streamBufferRef.current =
                event.message ?? "Something went wrong. Please try again.";
              flushStreamBuffer();
            }
          } catch {
            // skip malformed events
          }
        }
      }

      // Final flush
      if (flushTimer.current) {
        clearTimeout(flushTimer.current);
        flushTimer.current = null;
      }
      flushStreamBuffer();
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : "Failed to send message";
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: `Error: ${errorMsg}` }
            : m
        )
      );
    } finally {
      setIsStreaming(false);
      setActiveTools([]);
      streamIdRef.current = null;
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      sendMessage();
    }
    if (e.key === "Enter" && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function autoResizeTextarea(el: HTMLTextAreaElement) {
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 240)}px`;
  }

  function handleInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    autoResizeTextarea(e.target);
    const nowHas = e.target.value.trim().length > 0 || pendingImages.length > 0;
    if (nowHas !== hasInput) setHasInput(nowHas);
  }

  const canSend = hasInput || pendingImages.length > 0;

  function handleNewChat() {
    setConversationId(null);
    setMessages([]);
    if (inputRef.current) {
      inputRef.current.value = "";
      inputRef.current.style.height = "auto";
    }
    setHasInput(false);
    inputRef.current?.focus();
  }

  const isEmpty = messages.length === 0 && !loadingConversation;

  // Derive a display title from the first user message
  const chatTitle = messages.length > 0
    ? (messages.find((m) => m.role === "user")?.content.slice(0, 40) || "Chat")
    : "New Chat";

  return (
    <ChatImagePreviewProvider>
    <div className="absolute inset-0 bottom-16 lg:bottom-0 flex">
      {/* Desktop sidebar */}
      <ChatSidebarDesktop
        activeId={conversationId}
        onSelect={loadConversation}
      />

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <div className="lg:hidden shrink-0 flex items-center gap-2 border-b border-border bg-sidebar/50 px-3 py-2">
          <ChatSidebarMobile
            activeId={conversationId}
            onSelect={loadConversation}
          />
          <span className="flex-1 min-w-0 text-sm font-medium text-foreground truncate">
            {chatTitle}
          </span>
          {messages.length > 0 && (
            <button
              onClick={handleNewChat}
              disabled={isStreaming}
              className="shrink-0 flex items-center justify-center rounded-lg p-2 text-muted-foreground hover:bg-accent disabled:opacity-50"
              title="New chat"
            >
              <Plus className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Messages area */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="overflow-y-auto min-h-0"
          style={{ overflowAnchor: "none", flex: "1 1 0" }}
        >
          {loadingConversation ? (
            <div className="flex h-full items-center justify-center">
              <ThinkingDots />
            </div>
          ) : isEmpty ? (
            <div className="flex h-full flex-col items-center justify-center px-4 py-6 overflow-y-auto">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/chat-icon-192.png"
                alt="Logo"
                width={48}
                height={48}
                className="rounded-xl mb-4"
              />
              <h2 className="font-heading text-2xl font-bold tracking-tight text-foreground mb-2">
                Dashboard Chat
              </h2>
              <p className="text-sm text-muted-foreground mb-8 text-center max-w-md">
                Ask about your data, create calendar events, check server
                status, or get a dashboard overview.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg w-full">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => sendMessage(s)}
                    className="rounded-xl border border-border bg-card px-4 py-3.5 text-left text-sm text-foreground hover:bg-accent active:bg-accent transition-colors min-h-[44px]"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <MessageList
              messages={messages}
              isStreaming={isStreaming}
              activeTools={activeTools}
            />
          )}
        </div>

        {/* Input area */}
        <div
          className="shrink-0 border-t border-border bg-sidebar/50 px-4 py-3"
          style={{
            paddingBottom:
              "max(0.75rem, env(safe-area-inset-bottom, 0.75rem))",
          }}
        >
          {/* Image previews */}
          {pendingImages.length > 0 && (
            <div className="mx-auto max-w-3xl mb-2 flex flex-wrap gap-2">
              {pendingImages.map((img) => (
                <div key={img.id} className="relative group/img">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.preview}
                    alt="pending"
                    className="h-16 w-16 sm:h-16 sm:w-16 rounded-lg object-cover border border-border"
                  />
                  <button
                    onClick={() => removeImage(img.id)}
                    className="absolute -top-2 -right-2 h-6 w-6 flex items-center justify-center rounded-full bg-destructive text-destructive-foreground opacity-100 sm:opacity-0 sm:group-hover/img:opacity-100 transition-opacity"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="mx-auto flex max-w-3xl items-end gap-2 flex-nowrap">
            <button
              onClick={() => imageInputRef.current?.click()}
              disabled={isStreaming}
              className="self-stretch shrink-0 flex items-center justify-center text-muted-foreground rounded-xl px-3 min-w-[44px] min-h-[44px] hover:bg-accent disabled:opacity-50"
              title="Attach images"
            >
              <Paperclip className="h-4 w-4" />
            </button>
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleImageSelect}
            />
            <textarea
              ref={inputRef}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              onFocus={() => { isTypingRef.current = true; }}
              onBlur={() => { isTypingRef.current = false; }}
              placeholder="Ask anything..."
              rows={1}
              disabled={isStreaming}
              className="flex-1 min-w-0 overflow-y-auto resize-none rounded-xl border border-border bg-card px-4 py-2.5 text-base sm:text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
            />
            <button
              onClick={() => sendMessage()}
              disabled={!canSend || isStreaming}
              className="self-stretch shrink-0 flex items-center justify-center rounded-xl bg-primary text-primary-foreground px-3 min-w-[44px] min-h-[44px] hover:bg-primary/90 disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
          <p className="mx-auto max-w-3xl mt-1.5 text-[11px] text-muted-foreground/60 hidden sm:block">
            Enter to send, Shift+Enter for new line
          </p>
        </div>
      </div>
    </div>
    </ChatImagePreviewProvider>
  );
}
