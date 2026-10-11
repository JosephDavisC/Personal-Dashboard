import { auth } from "@/lib/auth";
import { listCalendars } from "@/lib/google-calendar";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const calendars = await listCalendars();
    return NextResponse.json({ data: calendars });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message.includes("re-login")) {
      return NextResponse.json(
        { error: "Calendar not connected. Please re-login." },
        { status: 401 }
      );
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
