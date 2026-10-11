import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createBackupSnapshot } from "../route";
import { uploadBackupToDrive } from "@/lib/google-drive";
import { formatInTimeZone } from "date-fns-tz";
import { TIMEZONE } from "@/lib/constants";

export async function POST() {
  const { unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;

  try {
    // Create a fresh snapshot
    const snapshot = await createBackupSnapshot("manual");

    // Fetch the full snapshot data
    const { prisma } = await import("@/lib/prisma");
    const backup = await prisma.backup.findUnique({
      where: { id: snapshot.id },
    });

    if (!backup) {
      return NextResponse.json({ error: "Snapshot creation failed" }, { status: 500 });
    }

    const jsonContent = JSON.stringify(backup.data, null, 2);
    const fileName = `dashboard-backup-${formatInTimeZone(new Date(), TIMEZONE, "yyyy-MM-dd-HHmm")}.json`;

    const result = await uploadBackupToDrive(jsonContent, fileName);

    return NextResponse.json({
      data: {
        fileId: result.fileId,
        webViewLink: result.webViewLink,
        snapshotId: snapshot.id,
        size: snapshot.size,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to upload to Drive";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
