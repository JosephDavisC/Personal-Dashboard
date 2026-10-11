import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

// Map Prisma model names to their lowercase delegate names
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

export async function GET() {
  const { unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;
  // Get table info from PostgreSQL information_schema
  const columns = await prisma.$queryRaw<
    { table_name: string; column_name: string; data_type: string; is_nullable: string; column_default: string | null }[]
  >`
    SELECT table_name, column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public'
    ORDER BY table_name, ordinal_position
  `;

  // Get row counts for each table
  const counts = await prisma.$queryRaw<{ table_name: string; count: bigint }[]>`
    SELECT schemaname || '.' || relname AS table_name, n_live_tup AS count
    FROM pg_stat_user_tables
    WHERE schemaname = 'public'
  `;

  const countMap = new Map<string, number>();
  for (const c of counts) {
    const name = c.table_name.replace("public.", "");
    countMap.set(name, Number(c.count));
  }

  // Group columns by table
  const tables: Record<string, { name: string; delegate: string; rowCount: number; columns: { name: string; type: string; nullable: boolean; hasDefault: boolean }[] }> = {};

  for (const col of columns) {
    const tableName = col.table_name;
    // Skip Prisma migration tables
    if (tableName.startsWith("_prisma")) continue;

    if (!tables[tableName]) {
      tables[tableName] = {
        name: tableName,
        delegate: MODEL_MAP[tableName] || tableName.charAt(0).toLowerCase() + tableName.slice(1),
        rowCount: countMap.get(tableName) || 0,
        columns: [],
      };
    }

    tables[tableName].columns.push({
      name: col.column_name,
      type: col.data_type,
      nullable: col.is_nullable === "YES",
      hasDefault: col.column_default !== null,
    });
  }

  return NextResponse.json({ data: Object.values(tables) });
}
