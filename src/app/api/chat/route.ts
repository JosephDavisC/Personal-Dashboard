import { requireAuth } from "@/lib/auth";
import { tools, executeTool } from "@/lib/chat-tools";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { reconstructAnthropicMessages, trimMessageHistory } from "@/lib/chat-utils";
import Anthropic from "@anthropic-ai/sdk";
import { formatInTimeZone } from "date-fns-tz";
import { TIMEZONE, HOURLY_WAGE, NET_PAY_RATE, TAX_DEDUCTION_RATE } from "@/lib/constants";
import { readFileSync } from "fs";
import { join } from "path";
import { MEDIA_UPLOAD_DIR } from "@/lib/constants";
import { SITE } from "@/config/site";
import { SHIFT_LOCATIONS } from "@/config/shifts";

export const dynamic = "force-dynamic";

function buildSystemPrompt() {
  const now = new Date();
  const dateStr = formatInTimeZone(now, TIMEZONE, "EEEE, MMMM d, yyyy");
  const timeStr = formatInTimeZone(now, TIMEZONE, "h:mm a");

  return `You are ${SITE.ownerName}'s personal dashboard assistant. You have full access to their dashboard data and can both read and write.

What you can do:
- Look up, create, and update tasks on the task board
- Read and create/edit Google Calendar events
- Read and write diary/journal entries with mood and tags
- Look up and update job application statuses
- Check work shifts and pay information
- Check site monitoring status
- View Claude API usage and cost metrics
- Browse uploaded media files
- Search, browse, and update contacts (name, email, phone, company, title, tags, notes)
- Browse and add important bookmarks and notes (with categories: work, personal, reference, project)
- Track tennis equipment (rackets, strings, restrings), sessions, stroke ratings, and notes
- Get a full dashboard overview

Key context:
- Today is ${dateStr}
- Current time: ${timeStr}
- Timezone: ${TIMEZONE}
- Hourly wage: $${HOURLY_WAGE}, deduction rate: ${(TAX_DEDUCTION_RATE * 100).toFixed(2)}%, net rate: ${(NET_PAY_RATE * 100).toFixed(2)}%
- Shift locations: ${SHIFT_LOCATIONS.map((l) => `${l.label} (${l.key})`).join(", ")}
- Task statuses: TODO, IN_PROGRESS, DONE, ARCHIVED
- Job statuses: APPLIED, PHONE_SCREEN, INTERVIEW, OFFER, REJECTED, WITHDRAWN
- Tennis session types: PRACTICE, LESSON, MATCH, DRILL
- Stroke ratings: 1-10 scale for forehand, backhand_topspin, backhand_slice, serve, volley, overhead, return_of_serve

Rules:
- Be concise and direct. Use tools to look up real data before answering.
- Format responses with clean markdown: use headers, bullet lists, and bold for key data.
- On tables, keep them short (max 4-5 columns). Prefer bullet lists over tables on simple data.
- IMPORTANT: When returning photos or media, you MUST use the imageMarkdown field from tool results to display images. Copy it exactly as-is into your response. The syntax must be ![alt](url) with the exclamation mark — never [alt](url) which renders as a link, not an image. Always show available photos when relevant.
- Contacts may have a photoUrl field (profile picture). When a user asks for a contact's photo/picture, show it as ![name](photoUrl). If photoUrl is null, tell them no photo is set and they can add one from the contact detail page.
- When asked to create or schedule events, use create_calendar_event.
- When asked to create tasks, use create_task. When asked to update tasks, use update_task. You can read task descriptions and photos too.
- When asked to write or log a NEW diary entry, use create_diary_entry. When asked to EDIT, FIX, or CHANGE part of an existing diary entry, ALWAYS use edit_diary_entry (find/replace or append). NEVER use create_diary_entry to edit existing entries — it will overwrite all existing content.
- When asked to update job application status, use update_job_application.
- When asked about contacts, use get_contacts to search. When asked to update a contact (add email, change phone, etc.), use update_contact. Use the contact ID from get_contacts results.
- IMPORTANT for contact lookups: The search is fuzzy (matches without spaces and individual words), so "sam lee" will find "samlee@example.com". If you get 0 results, try a shorter/simpler query (first name only, or first few letters).
- CRITICAL: When a contact search returns MULTIPLE results (more than 1), you MUST list ALL of them as numbered options and ask which one the user means. NEVER guess or pick one. For example, if searching "leo" returns 5 contacts, list all 5 and ask "Which Leo?" Only give a direct answer when there is exactly 1 match. Many contacts from Google sync are stored with just an email as the name (e.g. "leo@example.com") — these are NOT the same as a contact with a real name unless the user confirms it.
- When asked about bookmarks, links, or notes on the Important page, use get_important. When asked to save/add a bookmark or note, use add_important.
- When asked about tennis, use get_tennis_equipment, get_tennis_sessions, get_tennis_ratings, or get_tennis_notes. Use log_tennis_session to log sessions, update_stroke_rating to update ratings, and log_restring to log restrings. Use update_racket/add_racket to manage rackets, add_tennis_note for notes, and manage_string_inventory for string stock.
- When the user attaches images, you can see them (vision). If they ask to create a task or diary entry with the attached images, pass the media IDs using the media_ids parameter. The media IDs are noted at the end of the user message.
- Don't use emojis unless the user does first.`;
}

interface IncomingMessage {
  role: "user" | "assistant";
  content: string;
}

// Add cache_control to system prompt and last tool for prompt caching
function getCachedSystem(): Anthropic.TextBlockParam[] {
  return [
    {
      type: "text",
      text: buildSystemPrompt(),
      cache_control: { type: "ephemeral" },
    },
  ];
}

function getCachedTools(): Anthropic.Tool[] {
  return tools.map((tool, i) =>
    i === tools.length - 1
      ? { ...tool, cache_control: { type: "ephemeral" } as const }
      : tool
  ) as Anthropic.Tool[];
}

export async function POST(request: Request) {
  const { unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;

  const { messages, visibleCalendarIds, conversationId, images } =
    (await request.json()) as {
      messages: IncomingMessage[];
      visibleCalendarIds?: string[];
      conversationId?: string | null;
      images?: { mediaId: string; mimeType: string }[];
    };

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return new Response(JSON.stringify({ error: "Messages required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return new Response(
      JSON.stringify({ error: "ANTHROPIC_API_KEY not configured" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function send(data: object) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
        );
      }

      try {
        // Resolve or create conversation
        let convId = conversationId ?? null;

        let anthropicMessages: Anthropic.MessageParam[];

        // Build multi-modal content if images are attached
        let userContentWithImages: string | Anthropic.ContentBlockParam[] | undefined;
        if (images && images.length > 0) {
          const contentBlocks: Anthropic.ContentBlockParam[] = [];
          const mediaIds: string[] = [];

          for (const img of images) {
            try {
              const media = await prisma.mediaFile.findUnique({ where: { id: img.mediaId } });
              if (media) {
                const filePath = join(MEDIA_UPLOAD_DIR, media.storedName);
                const data = readFileSync(filePath);
                const mediaType = (img.mimeType || media.mimeType) as "image/jpeg" | "image/png" | "image/gif" | "image/webp";
                contentBlocks.push({
                  type: "image",
                  source: {
                    type: "base64",
                    media_type: mediaType,
                    data: data.toString("base64"),
                  },
                });
                mediaIds.push(img.mediaId);
              }
            } catch {
              // Skip unreadable files
            }
          }

          if (contentBlocks.length > 0) {
            const userText = messages[messages.length - 1]?.content ?? "";
            const mediaNote = mediaIds.length > 0
              ? `\n\n[Attached media IDs: ${mediaIds.join(", ")}. Use these with the media_ids parameter when creating tasks or diary entries to attach these images.]`
              : "";
            contentBlocks.push({ type: "text", text: (userText || "What's in this image?") + mediaNote });
            userContentWithImages = contentBlocks;
          }
        }

        if (convId) {
          // Load existing conversation from DB
          const dbMessages = await prisma.chatMessage.findMany({
            where: { conversationId: convId },
            orderBy: { createdAt: "asc" },
          });
          anthropicMessages = reconstructAnthropicMessages(dbMessages);
          // Append the new user message (with images if present)
          const latestUserMsg = messages[messages.length - 1];
          if (latestUserMsg) {
            anthropicMessages.push({
              role: "user",
              content: userContentWithImages ?? latestUserMsg.content,
            });
          }
        } else {
          // New conversation — create it
          const conversation = await prisma.chatConversation.create({
            data: { title: null },
          });
          convId = conversation.id;
          // Use client-sent messages for first turn
          anthropicMessages = messages.map((m, i) => ({
            role: m.role,
            content: i === messages.length - 1 && userContentWithImages
              ? userContentWithImages
              : m.content,
          }));
        }

        // Trim to stay within context limits
        anthropicMessages = trimMessageHistory(anthropicMessages);

        // Track where new turn messages start (for saving to DB)
        const turnStartIdx = anthropicMessages.length - 1; // the user message
        const userContent =
          messages[messages.length - 1]?.content ?? "";

        // Usage tracking across all iterations
        let totalInputTokens = 0;
        let totalOutputTokens = 0;
        let totalCacheReadTokens = 0;
        let totalCacheWriteTokens = 0;

        let iterations = 0;
        const MAX_ITERATIONS = 10;
        let finalText = "";
        const toolCallNames: string[] = [];

        while (iterations < MAX_ITERATIONS) {
          iterations++;

          const messageStream = client.messages.stream({
            model: "claude-haiku-4-5",
            max_tokens: 4096,
            system: getCachedSystem(),
            tools: getCachedTools(),
            messages: anthropicMessages,
          });

          // Stream events as they arrive
          for await (const event of messageStream) {
            if (
              event.type === "content_block_start" &&
              event.content_block.type === "tool_use"
            ) {
              send({ type: "tool_call", name: event.content_block.name });
            }
            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta"
            ) {
              send({ type: "text_delta", text: event.delta.text });
            }
          }

          const response = await messageStream.finalMessage();

          // Accumulate usage
          totalInputTokens += response.usage.input_tokens;
          totalOutputTokens += response.usage.output_tokens;
          const cacheUsage = response.usage as {
            cache_creation_input_tokens?: number;
            cache_read_input_tokens?: number;
          };
          totalCacheReadTokens += cacheUsage.cache_read_input_tokens ?? 0;
          totalCacheWriteTokens +=
            cacheUsage.cache_creation_input_tokens ?? 0;

          // Extract final text from this response
          for (const block of response.content) {
            if (block.type === "text") {
              finalText += block.text;
            }
          }

          // Check for tool use blocks
          const toolUseBlocks = response.content.filter(
            (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
          );

          if (toolUseBlocks.length === 0) break;

          // Execute tools
          const toolResults: Anthropic.ToolResultBlockParam[] = [];
          for (const block of toolUseBlocks) {
            toolCallNames.push(block.name);
            const result = await executeTool(
              block.name,
              block.input as Record<string, string>,
              { visibleCalendarIds }
            );
            toolResults.push({
              type: "tool_result",
              tool_use_id: block.id,
              content: result,
            });
          }

          anthropicMessages.push({
            role: "assistant",
            content: response.content,
          });
          anthropicMessages.push({
            role: "user",
            content: toolResults,
          });
        }

        // Save messages to DB
        const turnBlocks = anthropicMessages.slice(turnStartIdx + 1);

        // Save user message (with image IDs if present)
        const savedImageIds = images?.map((img) => img.mediaId) ?? [];
        await prisma.chatMessage.create({
          data: {
            conversationId: convId,
            role: "user",
            content: userContent,
            imageIds: savedImageIds,
          },
        });

        // Save assistant message with full turn blocks for reconstruction
        await prisma.chatMessage.create({
          data: {
            conversationId: convId,
            role: "assistant",
            content: finalText,
            anthropicBlocks:
              turnBlocks.length > 0
                ? (turnBlocks as unknown as Prisma.InputJsonValue)
                : undefined,
            toolCalls: toolCallNames,
            inputTokens: totalInputTokens,
            outputTokens: totalOutputTokens,
            cacheReadTokens: totalCacheReadTokens,
            cacheWriteTokens: totalCacheWriteTokens,
          },
        });

        // Update conversation timestamp
        await prisma.chatConversation.update({
          where: { id: convId },
          data: { updatedAt: new Date() },
        });

        send({
          type: "done",
          conversationId: convId,
          usage: {
            inputTokens: totalInputTokens,
            outputTokens: totalOutputTokens,
            cacheReadTokens: totalCacheReadTokens,
            cacheWriteTokens: totalCacheWriteTokens,
          },
        });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Chat request failed";
        send({ type: "error", message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
