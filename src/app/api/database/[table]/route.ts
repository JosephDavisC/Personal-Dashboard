import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

// Map table names to Prisma delegate names
const MODEL_MAP: Record<string, string> = {
  Task: "task",
  TaskPhoto: "taskPhoto",
  Shift: "shift",
  Link: "link",
  Backup: "backup",
  LoginLog: "loginLog",
  JobApplication: "jobApplication",
  MonitoredSite: "monitoredSite",
  SitePing: "sitePing",
  SiteIncident: "siteIncident",
  MediaFile: "mediaFile",
  DiaryEntry: "diaryEntry",
  DiaryPhoto: "diaryPhoto",
  DiaryLink: "diaryLink",
  NotificationLog: "notificationLog",
  NotificationPreferences: "notificationPreferences",
  PushSubscription: "pushSubscription",
  Contact: "contact",
  EmailLog: "emailLog",
  ChatConversation: "chatConversation",
  ChatMessage: "chatMessage",
  ImportantTopic: "importantTopic",
  ImportantItem: "importantItem",
  PinnedMedia: "pinnedMedia",
  TennisRacket: "tennisRacket",
  RacketPhoto: "racketPhoto",
  Restring: "restring",
  RestringPhoto: "restringPhoto",
  StringInventory: "stringInventory",
  StringPhoto: "stringPhoto",
  TennisSession: "tennisSession",
  SessionPhoto: "sessionPhoto",
  SessionVideo: "sessionVideo",
  StrokeRating: "strokeRating",
  TennisNote: "tennisNote",
  TennisStage: "tennisStage",
  TennisRating: "tennisRating",
};

function getDelegate(table: string) {
  const delegate = MODEL_MAP[table];
  if (!delegate) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (prisma as any)[delegate];
}

interface RouteParams {
  params: Promise<{ table: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  const { unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;
  const { table } = await params;
  const delegate = getDelegate(table);
  if (!delegate) {
    return NextResponse.json({ error: "Table not found" }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50")));
  const sort = searchParams.get("sort") || "createdAt";
  const dir = searchParams.get("dir") === "asc" ? "asc" : "desc";
  const search = searchParams.get("search") || "";

  // Build where clause for search
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let where: any = {};
  if (search) {
    // Get string columns for this table from information_schema
    const stringCols = await prisma.$queryRaw<{ column_name: string }[]>`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = ${table}
      AND data_type IN ('text', 'character varying')
    `;

    if (stringCols.length > 0) {
      where = {
        OR: stringCols.map((col) => ({
          [col.column_name]: { contains: search, mode: "insensitive" },
        })),
      };
    }
  }

  try {
    // Build orderBy - handle columns that might not exist
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let orderBy: any = { [sort]: dir };

    // Fallback if the sort column doesn't exist on this table
    const validCols = await prisma.$queryRaw<{ column_name: string }[]>`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = ${table}
    `;
    const validColNames = new Set(validCols.map((c) => c.column_name));
    if (!validColNames.has(sort)) {
      // Try common fallbacks
      if (validColNames.has("createdAt")) orderBy = { createdAt: dir };
      else if (validColNames.has("id")) orderBy = { id: dir };
      else orderBy = undefined;
    }

    const [rows, total] = await Promise.all([
      delegate.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      delegate.count({ where }),
    ]);

    return NextResponse.json({
      data: rows,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Query failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: RouteParams) {
  const { unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;
  const { table } = await params;
  const delegate = getDelegate(table);
  if (!delegate) {
    return NextResponse.json({ error: "Table not found" }, { status: 404 });
  }

  try {
    const body: unknown = await request.json();
    const row = await delegate.create({ data: body });
    return NextResponse.json({ data: row }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Create failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const { unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;
  const { table } = await params;
  const delegate = getDelegate(table);
  if (!delegate) {
    return NextResponse.json({ error: "Table not found" }, { status: 404 });
  }

  try {
    const { id, ...data }: { id: string } & Record<string, unknown> = await request.json();
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }
    const row = await delegate.update({ where: { id }, data });
    return NextResponse.json({ data: row });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Update failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: Request, { params }: RouteParams) {
  const { unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;
  const { table } = await params;
  const delegate = getDelegate(table);
  if (!delegate) {
    return NextResponse.json({ error: "Table not found" }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  try {
    await delegate.delete({ where: { id } });
    return NextResponse.json({ data: { deleted: true } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Delete failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
