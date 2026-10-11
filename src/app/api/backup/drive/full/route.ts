import { requireAuth } from "@/lib/auth";
import { createBackupSnapshot } from "../../route";
import { prisma } from "@/lib/prisma";
import {
  getAccessToken,
  createDriveFolder,
  uploadBufferToDrive,
  listBackupFolders,
  deleteDriveFile,
  getBackupFolderId,
} from "@/lib/google-drive";
import { MEDIA_UPLOAD_DIR } from "@/lib/constants";
import { formatInTimeZone } from "date-fns-tz";
import { readFile } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";
import { sendAndLogEmail } from "@/lib/email";
import { buildBackupCompleteEmail } from "@/lib/email-templates";
import { sendPushNotification, getPreferences } from "@/lib/push";
import { TIMEZONE } from "@/lib/constants";

export const dynamic = "force-dynamic";

export async function POST() {
  const { unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function send(data: object) {
        controller.enqueue(encoder.encode(JSON.stringify(data) + "\n"));
      }

      try {
        const token = await getAccessToken();

        // Step 1: Create dated folder
        send({ type: "progress", step: "init", message: "Creating backup folder..." });
        const timestamp = formatInTimeZone(new Date(), TIMEZONE, "yyyy-MM-dd-HHmm");
        const folderId = await createDriveFolder(`backup-${timestamp}`, await getBackupFolderId(token), token);

        // Step 2: Create media subfolder
        send({ type: "progress", step: "init", message: "Creating media folder..." });
        const mediaFolderId = await createDriveFolder("media", folderId, token);

        // Step 3: Create and upload snapshot
        send({ type: "progress", step: "snapshot", message: "Creating database snapshot..." });
        const snapshot = await createBackupSnapshot("manual");
        const backup = await prisma.backup.findUnique({ where: { id: snapshot.id } });
        if (!backup) throw new Error("Snapshot creation failed");

        send({ type: "progress", step: "snapshot", message: "Uploading snapshot.json..." });
        const snapshotBuffer = Buffer.from(JSON.stringify(backup.data, null, 2), "utf-8");
        await uploadBufferToDrive(snapshotBuffer, "snapshot.json", "application/json", folderId, token);

        // Step 4: Get all media files
        const mediaFiles = await prisma.mediaFile.findMany({
          select: { id: true, storedName: true, filename: true, mimeType: true, size: true },
          orderBy: { createdAt: "asc" },
        });

        const total = mediaFiles.length;
        let uploaded = 0;
        let skipped = 0;
        let totalBytes = 0;

        // Step 5: Upload each media file
        for (const file of mediaFiles) {
          const filePath = join(MEDIA_UPLOAD_DIR, file.storedName);

          if (!existsSync(filePath)) {
            skipped++;
            send({
              type: "progress",
              step: "media",
              current: uploaded + skipped,
              total,
              uploaded,
              skipped,
              filename: file.filename,
              message: `Skipped (not on disk): ${file.filename}`,
            });
            continue;
          }

          send({
            type: "progress",
            step: "media",
            current: uploaded + skipped,
            total,
            uploaded,
            skipped,
            filename: file.filename,
            message: `Uploading: ${file.filename}`,
          });

          const buffer = await readFile(filePath);
          // Use storedName in Drive so snapshot.json references match
          await uploadBufferToDrive(buffer, file.storedName, file.mimeType, mediaFolderId, token);

          uploaded++;
          totalBytes += buffer.length;
        }

        // Step 6: Cleanup old backups (keep max 4)
        send({ type: "progress", step: "cleanup", message: "Cleaning up old backups..." });
        const MAX_BACKUPS = 4;
        try {
          const folders = await listBackupFolders(token);
          if (folders.length > MAX_BACKUPS) {
            const toDelete = folders.slice(0, folders.length - MAX_BACKUPS);
            for (const old of toDelete) {
              await deleteDriveFile(old.id, token);
            }
            send({ type: "progress", step: "cleanup", message: `Deleted ${toDelete.length} old backup(s)` });
          }
        } catch {
          // Non-fatal — backup succeeded, cleanup is best-effort
        }

        const folderLink = `https://drive.google.com/drive/folders/${folderId}`;
        send({
          type: "complete",
          folderId,
          folderLink,
          uploaded,
          skipped,
          total,
          totalBytes,
          snapshotSize: snapshotBuffer.length,
        });

        // Send push notification (best-effort)
        try {
          const prefs = await getPreferences();
          if (prefs.driveBackup) {
            const sizeMB = (totalBytes / 1024 / 1024).toFixed(1);
            await sendPushNotification({
              title: "Drive Backup Complete",
              body: `${uploaded} files uploaded (${sizeMB} MB)`,
              url: "/dashboard/backup",
              tag: "drive-backup",
            }, { type: "drive_backup", refId: `backup-${Date.now()}` });
          }
        } catch { /* push failure should not break backup */ }

        // Send email notification (best-effort, don't fail backup)
        try {
          const recipient = process.env.SUMMARY_EMAIL_TO;
          if (!recipient) throw new Error("SUMMARY_EMAIL_TO is not set");
          const emailData = buildBackupCompleteEmail({
            uploaded,
            skipped,
            totalBytes,
            snapshotSize: snapshotBuffer.length,
            folderLink,
            timestamp: formatInTimeZone(new Date(), TIMEZONE, "MMM d, yyyy h:mm a"),
          });
          await sendAndLogEmail({
            to: recipient,
            ...emailData,
            type: "backup_complete",
            preview: `${uploaded} files, ${(totalBytes / 1024 / 1024).toFixed(1)} MB`,
            metadata: { uploaded, skipped, totalBytes, folderLink },
          });
        } catch (emailErr) {
          console.error("Backup email notification failed:", emailErr);
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : "Full backup failed";
        send({ type: "error", message });
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-cache",
      "X-Accel-Buffering": "no",
    },
  });
}
