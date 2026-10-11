import { auth } from "@/lib/auth";
import { updateEvent, deleteEvent } from "@/lib/google-calendar";
import { updateCalendarEventSchema } from "@/lib/validations/calendar";
import { NextResponse } from "next/server";
import { TIMEZONE } from "@/lib/constants";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { eventId } = await params;
  const body = await req.json();
  const parsed = updateCalendarEventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const {
    summary, description, location, startDateTime, endDateTime, allDay,
    addGoogleMeet, attendees, colorId, recurrence, visibility, transparency, reminders,
  } = parsed.data;

  const timeZone = TIMEZONE;
  const eventInput: Record<string, unknown> = {};

  if (summary !== undefined) eventInput.summary = summary;
  if (description !== undefined) eventInput.description = description || undefined;
  if (location !== undefined) eventInput.location = location || undefined;

  if (startDateTime !== undefined && endDateTime !== undefined) {
    const isAllDay = allDay ?? false;
    eventInput.start = isAllDay
      ? { date: startDateTime.split("T")[0] }
      : { dateTime: startDateTime, timeZone };
    eventInput.end = isAllDay
      ? { date: endDateTime.split("T")[0] }
      : { dateTime: endDateTime, timeZone };
  }

  if (addGoogleMeet) {
    eventInput.conferenceData = {
      createRequest: {
        requestId: crypto.randomUUID(),
        conferenceSolutionKey: { type: "hangoutsMeet" },
      },
    };
  }

  if (attendees !== undefined) {
    eventInput.attendees = attendees.map((email: string) => ({ email }));
  }

  if (colorId !== undefined) eventInput.colorId = colorId;
  if (recurrence !== undefined) eventInput.recurrence = recurrence;
  if (visibility !== undefined) eventInput.visibility = visibility;
  if (transparency !== undefined) eventInput.transparency = transparency;
  if (reminders !== undefined) eventInput.reminders = reminders;

  try {
    const event = await updateEvent(eventId, eventInput);
    return NextResponse.json({ data: event });
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

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { eventId } = await params;

  try {
    await deleteEvent(eventId);
    return NextResponse.json({ data: { success: true } });
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
