import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getAccessToken, listBackupFolders } from "@/lib/google-drive";

export async function GET() {
  const { unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;

  try {
    const token = await getAccessToken();
    const folders = await listBackupFolders(token);
    const last = folders.length > 0 ? folders[folders.length - 1] : null;
    return NextResponse.json({
      data: last ? { name: last.name, createdTime: last.createdTime } : null,
    });
  } catch {
    return NextResponse.json({ data: null });
  }
}
