import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

async function createBackupSnapshot(type: "manual" | "auto") {
  const [tasks, shifts, links, jobApplications, mediaFiles, monitoredSites, loginLogs, diaryEntries, emailLogs, pushSubscriptions, notificationLogs, contacts, pinnedMedia, chatConversations, importantTopics, tennisRackets, tennisSessions, strokeRatings, tennisNotes, stringInventory, tennisStages, tennisRatings] = await Promise.all([
    prisma.task.findMany({ orderBy: { createdAt: "desc" }, include: { photos: true } }),
    prisma.shift.findMany({ orderBy: { date: "desc" } }),
    prisma.link.findMany({ orderBy: { order: "asc" } }),
    prisma.jobApplication.findMany({ orderBy: { dateApplied: "desc" } }),
    prisma.mediaFile.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.monitoredSite.findMany({ orderBy: { order: "asc" } }),
    prisma.loginLog.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.diaryEntry.findMany({ orderBy: { date: "desc" }, include: { photos: true, links: true } }),
    prisma.emailLog.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.pushSubscription.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.notificationLog.findMany({ orderBy: { sentAt: "desc" } }),
    prisma.contact.findMany({ orderBy: { name: "asc" } }),
    prisma.pinnedMedia.findMany({ orderBy: { createdAt: "desc" }, include: { media: true } }),
    prisma.chatConversation.findMany({ orderBy: { updatedAt: "desc" }, include: { messages: true } }),
    prisma.importantTopic.findMany({ orderBy: { order: "asc" }, include: { items: true } }),
    prisma.tennisRacket.findMany({ orderBy: { createdAt: "desc" }, include: { photos: true, restrings: true } }),
    prisma.tennisSession.findMany({ orderBy: { date: "desc" }, include: { photos: true, videos: true, racket: true } }),
    prisma.strokeRating.findMany({ orderBy: { date: "desc" } }),
    prisma.tennisNote.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.stringInventory.findMany({ orderBy: { createdAt: "desc" }, include: { photos: true } }),
    prisma.tennisStage.findMany({ orderBy: { stageNumber: "asc" }, include: { ratings: true } }),
    prisma.tennisRating.findMany({ orderBy: { date: "desc" }, include: { stage: { select: { stageNumber: true, stageLabel: true } } } }),
  ]);

  const data = { tasks, shifts, links, jobApplications, mediaFiles, monitoredSites, loginLogs, diaryEntries, emailLogs, pushSubscriptions, notificationLogs, contacts, pinnedMedia, chatConversations, importantTopics, tennisRackets, tennisSessions, strokeRatings, tennisNotes, stringInventory, tennisStages, tennisRatings };
  const json = JSON.stringify(data);
  const size = Buffer.byteLength(json, "utf8");

  const backup = await prisma.backup.create({
    data: { type, data, size },
  });

  return { id: backup.id, type, size, createdAt: backup.createdAt };
}

export async function GET() {
  const { unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;
  const backups = await prisma.backup.findMany({
    select: { id: true, type: true, size: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 30,
  });
  return NextResponse.json({ data: backups });
}

export async function POST() {
  const { unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;
  const result = await createBackupSnapshot("manual");
  return NextResponse.json({ data: result });
}

export { createBackupSnapshot };
