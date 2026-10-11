import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { TIMEZONE, HOURLY_WAGE, NET_PAY_RATE } from "@/lib/constants";
import { fromZonedTime, formatInTimeZone } from "date-fns-tz";
import { format } from "date-fns";
import { SITE } from "@/config/site";

// Simple rate limiting: max 10 calls per day
const dailyCalls = { count: 0, date: "" };

function checkRateLimit(): boolean {
  const today = format(new Date(), "yyyy-MM-dd");
  if (dailyCalls.date !== today) {
    dailyCalls.date = today;
    dailyCalls.count = 0;
  }
  if (dailyCalls.count >= 10) return false;
  dailyCalls.count++;
  return true;
}

const SYSTEM_PROMPT = `You are writing a personal diary entry as ${SITE.ownerName}. Use a structured section format.

Output format — use these exact section headers with line breaks between sections. Personal Diary comes FIRST.

**Personal Diary**
(Write 2-4 sentences summarizing the day. First person, casual tone. Reference actual names, places, and times. No filler, no motivational language, no exclamation marks unless mood is "excited". If mood is negative, reflect it honestly. If the user already wrote something, continue from where they left off — do NOT repeat or rephrase what they wrote.)

**Events**
(List calendar events chronologically. Each on its own line. Include time and location if available. If there are work shifts, list them here too with hours and net pay. If no events or shifts, write "No events today.")

**In Progress**
(List tasks that are currently in progress. One per line, just the task title. If none, write "None.")

**Completed**
(List tasks that were completed/marked done today. One per line. If none, write "None.")

**Added**
(List new tasks created today. One per line. If none, write "None.")

Rules:
- Use the EXACT section headers above, wrapped in ** for bold: "**Personal Diary**", "**Events**", "**In Progress**", "**Completed**", "**Added**"
- Section headers must be bold using ** on both sides
- Do NOT use ## or bullets
- Each section header should be on its own line, followed by content on the next line(s)
- Keep a blank line between sections
- Personal Diary MUST be the first section
- The Personal Diary section should read like texting a close friend, not a blog post
- If there's barely any data, keep Personal Diary to 1-2 sentences. Don't pad.

Example output:

**Personal Diary**
Had a slow morning, then worked a lunch shift at the cafe. Spent the evening reorganizing my task board and planning the week.

**Events**
9:00 AM - Team standup @ Library room 2
12:00 PM - 3:30 PM - Cafe (3.5h, $63.00 net)
5:00 PM - Tennis practice

**In Progress**
Plan weekend trip
Read chapter 4

**Completed**
Submit expense report
Update resume

**Added**
Research summer internships`;

export async function POST(request: Request) {
  const { unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "AI summarization not configured" }, { status: 503 });
  }

  if (!checkRateLimit()) {
    return NextResponse.json({ error: "Daily summary limit reached (10/day)" }, { status: 429 });
  }

  try {
    const body = (await request.json()) as { date?: string };
    const dateStr = body.date;
    if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return NextResponse.json({ error: "Invalid date format" }, { status: 400 });
    }

    const dateObj = fromZonedTime(`${dateStr}T00:00:00`, TIMEZONE);

    // Fetch entry content
    const entry = await prisma.diaryEntry.findUnique({
      where: { date: dateObj },
      include: { photos: true, links: true },
    });

    const dayStart = fromZonedTime(`${dateStr}T00:00:00`, TIMEZONE);
    const dayEnd = fromZonedTime(`${dateStr}T23:59:59`, TIMEZONE);

    const [shifts, tasksCompleted, tasksCreated, tasksMoved, tasksInProgress] = await Promise.all([
      prisma.shift.findMany({
        where: { date: { gte: dayStart, lte: dayEnd } },
        orderBy: { startTime: "asc" },
      }),
      // Tasks marked DONE today
      prisma.task.findMany({
        where: { status: "DONE", completedAt: { gte: dayStart, lte: dayEnd } },
        select: { id: true, title: true },
      }),
      // Tasks created today
      prisma.task.findMany({
        where: { createdAt: { gte: dayStart, lte: dayEnd } },
        select: { id: true, title: true, status: true },
      }),
      // Tasks with status changes today (not completed — those are above)
      prisma.task.findMany({
        where: {
          statusChangedAt: { gte: dayStart, lte: dayEnd },
          NOT: { status: "DONE", completedAt: { gte: dayStart, lte: dayEnd } },
        },
        select: { id: true, title: true, status: true },
      }),
      // All currently in-progress tasks
      prisma.task.findMany({
        where: { status: "IN_PROGRESS" },
        select: { id: true, title: true },
      }),
    ]);

    // Also fetch calendar events from the context API for richer data
    let events: { title: string; time: string; location?: string }[] = [];
    try {
      const contextRes = await fetch(
        `${process.env.NEXTAUTH_URL ?? "http://localhost:3000"}/api/diary/${dateStr}/context`,
        { headers: { cookie: request.headers.get("cookie") ?? "" } }
      );
      if (contextRes.ok) {
        const ctx = (await contextRes.json()) as {
          data: { events: { title: string; time: string; location?: string }[] };
        };
        events = ctx.data.events ?? [];
      }
    } catch {
      // Context fetch failed, continue without events
    }

    // Fetch manually linked tasks
    const manualTaskIds = entry?.manualTaskIds ?? [];
    const manualTasks = manualTaskIds.length > 0
      ? await prisma.task.findMany({
          where: { id: { in: manualTaskIds } },
          select: { id: true, title: true, status: true },
        })
      : [];

    // Build structured context for AI
    const contextParts: string[] = [];

    // Events section data (calendar events + shifts)
    contextParts.push("EVENTS DATA:");
    if (events.length > 0) {
      for (const e of events) {
        let line = `- ${e.time}: ${e.title}`;
        if (e.location) line += ` @ ${e.location}`;
        contextParts.push(line);
      }
    }
    if (shifts.length > 0) {
      for (const s of shifts) {
        const start = formatInTimeZone(s.startTime, TIMEZONE, "h:mm a");
        const end = formatInTimeZone(s.endTime, TIMEZONE, "h:mm a");
        const netPay = (s.hours * HOURLY_WAGE * NET_PAY_RATE).toFixed(2);
        contextParts.push(
          `- ${start} - ${end}: ${s.label || s.location} (${s.hours.toFixed(1)}h, $${netPay} net)`
        );
      }
    }
    if (events.length === 0 && shifts.length === 0) {
      contextParts.push("(none)");
    }

    // In Progress section data
    contextParts.push("\nIN PROGRESS TASKS:");
    if (tasksInProgress.length > 0) {
      for (const t of tasksInProgress) contextParts.push(`- ${t.title}`);
    } else {
      contextParts.push("(none)");
    }

    // Completed section data
    contextParts.push("\nCOMPLETED TASKS TODAY:");
    if (tasksCompleted.length > 0) {
      for (const t of tasksCompleted) contextParts.push(`- ${t.title}`);
    } else {
      contextParts.push("(none)");
    }

    // Added section data — tasks created today but not completed
    const createdNotCompleted = tasksCreated.filter(
      (c) => !tasksCompleted.some((d) => d.id === c.id)
    );
    contextParts.push("\nTASKS ADDED TODAY:");
    if (createdNotCompleted.length > 0) {
      for (const t of createdNotCompleted) contextParts.push(`- ${t.title}`);
    } else {
      contextParts.push("(none)");
    }

    // Manually pinned tasks
    if (manualTasks.length > 0) {
      contextParts.push("\nMANUALLY PINNED TASKS (user explicitly wants these included):");
      for (const t of manualTasks) contextParts.push(`- ${t.title} (${t.status === "DONE" ? "Done" : t.status === "IN_PROGRESS" ? "In Progress" : t.status === "TODO" ? "To Do" : t.status})`);
    }

    if (entry?.mood) {
      contextParts.push(`\nMood: ${entry.mood}`);
    }

    if (entry?.tags && entry.tags.length > 0) {
      contextParts.push(`Tags: ${entry.tags.join(", ")}`);
    }

    // Check if there's anything to summarize
    const hasData = events.length > 0 || shifts.length > 0 || tasksCompleted.length > 0 || tasksCreated.length > 0 || tasksMoved.length > 0 || tasksInProgress.length > 0 || manualTasks.length > 0;
    if (!hasData) {
      return NextResponse.json({ error: "No events, shifts, or tasks for this day to summarize" }, { status: 400 });
    }

    // Build user message with existing content handling
    const existingText = entry?.content?.trim();
    let userMessage = `Write a diary entry for ${dateStr}.\n\n${contextParts.join("\n")}`;

    if (existingText) {
      userMessage += `\n\nThe user already wrote: "${existingText}"\nContinue from where they left off with specific details from the events. Do NOT repeat or rephrase what they wrote.`;
    }

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 600,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: userMessage,
        },
      ],
    });

    const summary =
      message.content[0]?.type === "text" ? message.content[0].text : "";

    return NextResponse.json({ data: { summary } });
  } catch (error) {
    console.error("POST /api/diary/summarize error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate summary" },
      { status: 500 }
    );
  }
}
