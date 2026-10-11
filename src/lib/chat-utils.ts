import type Anthropic from "@anthropic-ai/sdk";

const MAX_HISTORY_MESSAGES = 40;

interface DbMessage {
  role: string;
  content: string;
  anthropicBlocks: unknown;
}

/**
 * Reconstruct Anthropic-compatible message history from DB records.
 * Each assistant message may have anthropicBlocks containing the full
 * sequence of MessageParam objects from that turn (assistant tool_use +
 * user tool_result pairs).
 */
export function reconstructAnthropicMessages(
  dbMessages: DbMessage[]
): Anthropic.MessageParam[] {
  const result: Anthropic.MessageParam[] = [];

  for (const msg of dbMessages) {
    if (msg.role === "user") {
      result.push({ role: "user", content: msg.content });
    } else if (msg.anthropicBlocks) {
      const blocks = msg.anthropicBlocks as Anthropic.MessageParam[];
      result.push(...blocks);
    } else {
      result.push({ role: "assistant", content: msg.content });
    }
  }

  return result;
}

/**
 * Trim message history to stay within context limits.
 * Keeps the first message for context and the most recent messages.
 * Ensures the first kept message has role "user" (Anthropic requirement).
 */
export function trimMessageHistory(
  messages: Anthropic.MessageParam[]
): Anthropic.MessageParam[] {
  if (messages.length <= MAX_HISTORY_MESSAGES) return messages;

  const recent = messages.slice(-(MAX_HISTORY_MESSAGES - 1));

  // Anthropic requires first message to be user role
  while (recent.length > 0 && recent[0]?.role !== "user") {
    recent.shift();
  }

  return recent;
}
