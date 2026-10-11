import { getGoogleAccessToken } from "@/lib/google-token";

const DRIVE_API = "https://www.googleapis.com/drive/v3/files";
const DRIVE_UPLOAD_API = "https://www.googleapis.com/upload/drive/v3/files";

const BACKUP_FOLDER_NAME = "Dashboard Backups";

/**
 * Drive folder that holds backups. Uses DRIVE_BACKUP_FOLDER_ID when set,
 * otherwise finds or creates an app-owned "Dashboard Backups" folder in My Drive
 * (the drive.file scope only sees folders this app created).
 */
export async function getBackupFolderId(token: string): Promise<string> {
  if (process.env.DRIVE_BACKUP_FOLDER_ID) return process.env.DRIVE_BACKUP_FOLDER_ID;

  const query = `name='${BACKUP_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and 'root' in parents and trashed=false`;
  const res = await fetch(`${DRIVE_API}?q=${encodeURIComponent(query)}&fields=files(id)`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.ok) {
    const data = (await res.json()) as { files?: { id: string }[] };
    const existing = data.files?.[0]?.id;
    if (existing) return existing;
  }
  return createDriveFolder(BACKUP_FOLDER_NAME, "root", token);
}

export const getAccessToken = getGoogleAccessToken;

/**
 * Create a folder in Google Drive.
 * Returns the new folder ID.
 */
export async function createDriveFolder(
  name: string,
  parentId: string,
  token: string
): Promise<string> {
  const res = await fetch(`${DRIVE_API}?fields=id`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentId],
    }),
  });

  if (!res.ok) {
    const err = (await res.json()) as { error?: { message?: string } };
    throw new Error(err.error?.message ?? `Failed to create folder: ${res.status}`);
  }

  const data = (await res.json()) as { id: string };
  return data.id;
}

/**
 * Upload a file buffer to Google Drive using resumable upload.
 * Works for any file size. Returns the Drive file ID.
 */
export async function uploadBufferToDrive(
  buffer: Buffer,
  fileName: string,
  mimeType: string,
  folderId: string,
  token: string
): Promise<string> {
  // Step 1: Initiate resumable upload session
  const initRes = await fetch(
    `${DRIVE_UPLOAD_API}?uploadType=resumable&fields=id`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-Upload-Content-Type": mimeType,
        "X-Upload-Content-Length": buffer.length.toString(),
      },
      body: JSON.stringify({
        name: fileName,
        parents: [folderId],
      }),
    }
  );

  if (!initRes.ok) {
    const err = (await initRes.json()) as { error?: { message?: string } };
    throw new Error(err.error?.message ?? `Failed to initiate upload: ${initRes.status}`);
  }

  const uploadUri = initRes.headers.get("Location");
  if (!uploadUri) throw new Error("No upload URI returned from Drive");

  // Step 2: Upload the file content
  const uploadRes = await fetch(uploadUri, {
    method: "PUT",
    headers: {
      "Content-Type": mimeType,
      "Content-Length": buffer.length.toString(),
    },
    body: new Uint8Array(buffer),
  });

  if (!uploadRes.ok) {
    throw new Error(`File upload failed: ${uploadRes.status}`);
  }

  const data = (await uploadRes.json()) as { id: string };
  return data.id;
}

/**
 * List backup folders inside the root backup folder.
 * Returns sorted by createdTime ascending (oldest first).
 */
export async function listBackupFolders(
  token: string
): Promise<{ id: string; name: string; createdTime: string }[]> {
  const folderId = await getBackupFolderId(token);
  const query = `'${folderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const res = await fetch(
    `${DRIVE_API}?q=${encodeURIComponent(query)}&fields=files(id,name,createdTime)&orderBy=createdTime`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!res.ok) {
    const err = (await res.json()) as { error?: { message?: string } };
    throw new Error(err.error?.message ?? `Failed to list folders: ${res.status}`);
  }

  const data = (await res.json()) as { files: { id: string; name: string; createdTime: string }[] };
  return data.files ?? [];
}

/**
 * Delete a file or folder from Google Drive (including all contents).
 */
export async function deleteDriveFile(
  fileId: string,
  token: string
): Promise<void> {
  const res = await fetch(`${DRIVE_API}/${fileId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok && res.status !== 404) {
    throw new Error(`Failed to delete Drive file: ${res.status}`);
  }
}

/**
 * Upload a JSON backup file to Google Drive (quick snapshot).
 * Uploads to the root backup folder.
 */
export async function uploadBackupToDrive(
  jsonContent: string,
  fileName: string
): Promise<{ fileId: string; webViewLink: string }> {
  const token = await getAccessToken();

  const boundary = "backup_boundary_" + Date.now();
  const metadata = JSON.stringify({
    name: fileName,
    mimeType: "application/json",
    parents: [await getBackupFolderId(token)],
  });

  const body =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${metadata}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: application/json\r\n\r\n` +
    `${jsonContent}\r\n` +
    `--${boundary}--`;

  const uploadRes = await fetch(
    `${DRIVE_UPLOAD_API}?uploadType=multipart&fields=id,webViewLink`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    }
  );

  if (!uploadRes.ok) {
    const err = (await uploadRes.json()) as { error?: { message?: string } };
    throw new Error(err.error?.message ?? `Drive upload error: ${uploadRes.status}`);
  }

  const file = (await uploadRes.json()) as { id: string; webViewLink: string };
  return { fileId: file.id, webViewLink: file.webViewLink };
}
