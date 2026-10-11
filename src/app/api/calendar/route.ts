import { auth } from "@/lib/auth";
import { listEvents, createEvent } from "@/lib/google-calendar";
import { calendarEventSchema } from "@/lib/validations/calendar";
import { NextResponse } from "next/server";
import { TIMEZONE } from "@/lib/constants";

export async function GET(req: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const start = searchParams.get("start");
  const end = searchParams.get("end");

  if (!start || !end) {
    return NextResponse.json(
      { error: "start and end query params required" },
      { status: 400 }
    );
  }

  try {
    const calendarId = searchParams.get("calendarId") ?? undefined;
    const events = await listEvents(start, end, calendarId);
    return NextResponse.json({ data: events });
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

export async function POST(req: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = calendarEventSchema.safeParse(body);
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
  const needsTz = !!recurrence?.length;
  const eventInput: Parameters<typeof createEvent>[0] = {
    summary,
    description: description || undefined,
    location: location || undefined,
    start: allDay
      ? { date: startDateTime.split("T")[0] }
      : { dateTime: startDateTime, timeZone },
    end: allDay
      ? { date: endDateTime.split("T")[0] }
      : { dateTime: endDateTime, timeZone },
  };

  // Recurring events require timezone on start/end
  if (needsTz && !allDay) {
    eventInput.start.timeZone = timeZone;
    eventInput.end.timeZone = timeZone;
  }

  if (addGoogleMeet) {
    eventInput.conferenceData = {
      createRequest: {
        requestId: crypto.randomUUID(),
        conferenceSolutionKey: { type: "hangoutsMeet" },
      },
    };
  }

  if (attendees?.length) {
    eventInput.attendees = attendees.map((email) => ({ email }));
  }

  if (colorId) eventInput.colorId = colorId;
  if (recurrence?.length) eventInput.recurrence = recurrence;
  if (visibility) eventInput.visibility = visibility;
  if (transparency) eventInput.transparency = transparency;
  if (reminders) eventInput.reminders = reminders;

  try {
    const event = await createEvent(eventInput);
    return NextResponse.json({ data: event }, { status: 201 });
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
