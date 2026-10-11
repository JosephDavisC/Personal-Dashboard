import { getGoogleAccessToken, isDemoWithoutGoogle } from "@/lib/google-token";

const CALENDAR_API = "https://www.googleapis.com/calendar/v3";

export interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  location?: string;
  start: { dateTime?: string; date?: string; timeZone?: string };
  end: { dateTime?: string; date?: string; timeZone?: string };
  htmlLink: string;
  status: string;
  colorId?: string;
  attendees?: { email: string; responseStatus?: string }[];
  hangoutLink?: string;
  conferenceData?: {
    entryPoints?: { entryPointType: string; uri: string }[];
    conferenceSolution?: { name: string; iconUri?: string };
  };
  recurrence?: string[];
  recurringEventId?: string;
  visibility?: string;
  transparency?: string;
  reminders?: {
    useDefault: boolean;
    overrides?: { method: string; minutes: number }[];
  };
}

export interface GoogleCalendar {
  id: string;
  summary: string;
  description?: string;
  backgroundColor: string;
  foregroundColor: string;
  selected: boolean;
  primary: boolean;
  accessRole: string;
}

interface CalendarListResponse {
  items: CalendarEvent[];
  nextPageToken?: string;
}

const getAccessToken = getGoogleAccessToken;

export async function listEvents(
  startDate: string,
  endDate: string,
  calendarId?: string
): Promise<CalendarEvent[]> {
  // Demo without a Google account: show nothing instead of an error
  if (await isDemoWithoutGoogle()) return [];
  const token = await getAccessToken();
  const id = encodeURIComponent(
    calendarId ?? process.env.GOOGLE_CALENDAR_ID ?? "primary"
  );

  const params = new URLSearchParams({
    timeMin: new Date(startDate).toISOString(),
    timeMax: new Date(endDate).toISOString(),
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "250",
  });

  const res = await fetch(
    `${CALENDAR_API}/calendars/${id}/events?${params.toString()}`,
    {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    }
  );

  // A calendar can linger in the client's visibility list after being
  // deleted or unshared; treat it as empty instead of failing the page
  if (res.status === 404 || res.status === 403) {
    console.warn(`Calendar ${calendarId ?? "primary"} returned ${res.status}, skipping`);
    return [];
  }

  if (!res.ok) {
    const body = (await res.json()) as { error?: { message?: string } };
    throw new Error(
      body.error?.message ?? `Calendar API error: ${res.status}`
    );
  }

  const data = (await res.json()) as CalendarListResponse;
  return data.items.filter((e) => e.status !== "cancelled");
}

export async function getEvent(
  eventId: string,
  calendarId?: string
): Promise<CalendarEvent> {
  const token = await getAccessToken();
  const id = encodeURIComponent(
    calendarId ?? process.env.GOOGLE_CALENDAR_ID ?? "primary"
  );

  const res = await fetch(
    `${CALENDAR_API}/calendars/${id}/events/${encodeURIComponent(eventId)}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (!res.ok) {
    const body = (await res.json()) as { error?: { message?: string } };
    throw new Error(
      body.error?.message ?? `Calendar API error: ${res.status}`
    );
  }

  return (await res.json()) as CalendarEvent;
}

export interface CalendarEventInput {
  summary: string;
  description?: string;
  location?: string;
  start: { dateTime?: string; date?: string; timeZone?: string };
  end: { dateTime?: string; date?: string; timeZone?: string };
  attendees?: { email: string }[];
  conferenceData?: {
    createRequest?: { requestId: string; conferenceSolutionKey: { type: string } };
  };
  colorId?: string;
  recurrence?: string[];
  visibility?: string;
  transparency?: string;
  reminders?: {
    useDefault?: boolean;
    overrides?: { method: string; minutes: number }[];
  };
}

function getCalendarId(calendarId?: string) {
  return encodeURIComponent(
    calendarId ?? process.env.GOOGLE_CALENDAR_ID ?? "primary"
  );
}

export async function createEvent(
  event: CalendarEventInput,
  calendarId?: string
): Promise<CalendarEvent> {
  const token = await getAccessToken();
  const id = getCalendarId(calendarId);

  const params = new URLSearchParams();
  if (event.conferenceData) params.set("conferenceDataVersion", "1");
  if (event.attendees?.length) params.set("sendUpdates", "all");
  const qs = params.toString() ? `?${params.toString()}` : "";

  const res = await fetch(`${CALENDAR_API}/calendars/${id}/events${qs}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(event),
  });

  if (!res.ok) {
    const body = (await res.json()) as { error?: { message?: string } };
    throw new Error(
      body.error?.message ?? `Calendar API error: ${res.status}`
    );
  }

  return (await res.json()) as CalendarEvent;
}

export async function updateEvent(
  eventId: string,
  event: Partial<CalendarEventInput>,
  calendarId?: string
): Promise<CalendarEvent> {
  const token = await getAccessToken();
  const id = getCalendarId(calendarId);

  const params = new URLSearchParams();
  if (event.conferenceData) params.set("conferenceDataVersion", "1");
  if (event.attendees?.length) params.set("sendUpdates", "all");
  const qs = params.toString() ? `?${params.toString()}` : "";

  const res = await fetch(
    `${CALENDAR_API}/calendars/${id}/events/${encodeURIComponent(eventId)}${qs}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(event),
    }
  );

  if (!res.ok) {
    const body = (await res.json()) as { error?: { message?: string } };
    throw new Error(
      body.error?.message ?? `Calendar API error: ${res.status}`
    );
  }

  return (await res.json()) as CalendarEvent;
}

export async function deleteEvent(
  eventId: string,
  calendarId?: string
): Promise<void> {
  const token = await getAccessToken();
  const id = getCalendarId(calendarId);

  const res = await fetch(
    `${CALENDAR_API}/calendars/${id}/events/${encodeURIComponent(eventId)}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  // 410 Gone means already deleted
  if (!res.ok && res.status !== 410) {
    const body = (await res.json()) as { error?: { message?: string } };
    throw new Error(
      body.error?.message ?? `Calendar API error: ${res.status}`
    );
  }
}

export async function listCalendars(): Promise<GoogleCalendar[]> {
  // Demo without a Google account: show nothing instead of an error
  if (await isDemoWithoutGoogle()) return [];
  const token = await getAccessToken();

  const res = await fetch(`${CALENDAR_API}/users/me/calendarList`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (!res.ok) {
    const body = (await res.json()) as { error?: { message?: string } };
    throw new Error(
      body.error?.message ?? `Calendar API error: ${res.status}`
    );
  }

  const data = (await res.json()) as { items: GoogleCalendar[] };
  return data.items;
}
