import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { fromZonedTime } from "date-fns-tz";
import { format } from "date-fns";
import { TIMEZONE } from "@/lib/constants";

export async function GET() {
  const { unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;

  try {
    const today = format(new Date(), "yyyy-MM-dd");
    const dayStart = fromZonedTime(`${today}T00:00:00`, TIMEZONE);
    const dayEnd = fromZonedTime(`${today}T23:59:59`, TIMEZONE);

    const messages = await prisma.chatMessage.findMany({
      where: {
        createdAt: { gte: dayStart, lte: dayEnd },
        role: "assistant",
      },
      select: {
        inputTokens: true,
        outputTokens: true,
        cacheReadTokens: true,
        cacheWriteTokens: true,
      },
    });

    let inputTokens = 0;
    let outputTokens = 0;
    let cacheReadTokens = 0;
    let cacheWriteTokens = 0;
    let messageCount = 0;

    for (const m of messages) {
      inputTokens += m.inputTokens ?? 0;
      outputTokens += m.outputTokens ?? 0;
      cacheReadTokens += m.cacheReadTokens ?? 0;
      cacheWriteTokens += m.cacheWriteTokens ?? 0;
      messageCount++;
    }

    return NextResponse.json({
      data: {
        inputTokens,
        outputTokens,
        cacheReadTokens,
        cacheWriteTokens,
        messageCount,
        date: today,
      },
    });
  } catch (error) {
    console.error("GET /api/claude/live error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
