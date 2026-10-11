import {
  isSameDay,
  startOfDay,
  endOfDay,
  parseISO,
} from "date-fns";
import type { CalendarEvent } from "@/lib/google-calendar";

// Google Calendar colorId → tailwind classes
export const EVENT_COLORS: Record<string, { bg: string; text: string; hover: string }> = {
  "1":  { bg: "bg-[#7986CB]/30 dark:bg-[#7986CB]/25", text: "text-[#3949AB] dark:text-[#7986CB]", hover: "hover:bg-[#7986CB]/40 dark:hover:bg-[#7986CB]/35" },
  "2":  { bg: "bg-[#33B679]/30 dark:bg-[#33B679]/25", text: "text-[#0B8043] dark:text-[#33B679]", hover: "hover:bg-[#33B679]/40 dark:hover:bg-[#33B679]/35" },
  "3":  { bg: "bg-[#8E24AA]/30 dark:bg-[#8E24AA]/25", text: "text-[#6A1B9A] dark:text-[#8E24AA]", hover: "hover:bg-[#8E24AA]/40 dark:hover:bg-[#8E24AA]/35" },
  "4":  { bg: "bg-[#E67C73]/30 dark:bg-[#E67C73]/25", text: "text-[#C62828] dark:text-[#E67C73]", hover: "hover:bg-[#E67C73]/40 dark:hover:bg-[#E67C73]/35" },
  "5":  { bg: "bg-[#F6BF26]/30 dark:bg-[#F6BF26]/25", text: "text-[#F57F17] dark:text-[#F6BF26]", hover: "hover:bg-[#F6BF26]/40 dark:hover:bg-[#F6BF26]/35" },
  "6":  { bg: "bg-[#F4511E]/30 dark:bg-[#F4511E]/25", text: "text-[#D84315] dark:text-[#F4511E]", hover: "hover:bg-[#F4511E]/40 dark:hover:bg-[#F4511E]/35" },
  "7":  { bg: "bg-[#039BE5]/30 dark:bg-[#039BE5]/25", text: "text-[#0277BD] dark:text-[#039BE5]", hover: "hover:bg-[#039BE5]/40 dark:hover:bg-[#039BE5]/35" },
  "8":  { bg: "bg-[#616161]/30 dark:bg-[#616161]/25", text: "text-[#424242] dark:text-[#9E9E9E]", hover: "hover:bg-[#616161]/40 dark:hover:bg-[#616161]/35" },
  "9":  { bg: "bg-[#3F51B5]/30 dark:bg-[#3F51B5]/25", text: "text-[#283593] dark:text-[#7986CB]", hover: "hover:bg-[#3F51B5]/40 dark:hover:bg-[#3F51B5]/35" },
  "10": { bg: "bg-[#0B8043]/30 dark:bg-[#0B8043]/25", text: "text-[#1B5E20] dark:text-[#33B679]", hover: "hover:bg-[#0B8043]/40 dark:hover:bg-[#0B8043]/35" },
  "11": { bg: "bg-[#D50000]/30 dark:bg-[#D50000]/25", text: "text-[#B71C1C] dark:text-[#E67C73]", hover: "hover:bg-[#D50000]/40 dark:hover:bg-[#D50000]/35" },
};

export const DEFAULT_COLOR = { bg: "bg-primary/25 dark:bg-primary/20", text: "text-primary", hover: "hover:bg-primary/35 dark:hover:bg-primary/30" };

export function getEventColor(colorId?: string) {
  if (!colorId) return DEFAULT_COLOR;
  return EVENT_COLORS[colorId] ?? DEFAULT_COLOR;
}

export function getColorHex(colorId: string): string {
  const map: Record<string, string> = {
    "1": "#7986CB", "2": "#33B679", "3": "#8E24AA", "4": "#E67C73",
    "5": "#F6BF26", "6": "#F4511E", "7": "#039BE5", "8": "#616161",
    "9": "#3F51B5", "10": "#0B8043", "11": "#D50000",
  };
  return map[colorId] ?? "";
}

export function getEventTime(event: CalendarEvent): { start: Date; end: Date; allDay: boolean } {
  const allDay = !event.start.dateTime;
  const start = event.start.dateTime
    ? parseISO(event.start.dateTime)
    : parseISO(event.start.date ?? "");
  const end = event.end.dateTime
    ? parseISO(event.end.dateTime)
    : parseISO(event.end.date ?? "");
  return { start, end, allDay };
}

export function getEventsForDay(events: CalendarEvent[], day: Date): CalendarEvent[] {
  const dayStart = startOfDay(day);
  const dayEnd = endOfDay(day);

  return events.filter((event) => {
    const { start, end, allDay } = getEventTime(event);
    if (allDay) {
      return isSameDay(start, day) || (start <= dayEnd && end > dayStart);
    }
    return start < dayEnd && end > dayStart;
  });
}

export interface LayoutedEvent {
  event: CalendarEvent;
  column: number;
  totalColumns: number;
}

export function layoutOverlappingEvents(events: CalendarEvent[]): LayoutedEvent[] {
  if (events.length === 0) return [];

  const sorted = [...events]
    .map((e) => {
      const t = getEventTime(e);
      return { event: e, startMin: t.start.getHours() * 60 + t.start.getMinutes(), endMin: t.end.getHours() * 60 + t.end.getMinutes() };
    })
    .sort((a, b) => {
      const diff = a.startMin - b.startMin;
      if (diff !== 0) return diff;
      return (b.endMin - b.startMin) - (a.endMin - a.startMin);
    });

  const clusters: typeof sorted[] = [];
  let currentCluster: typeof sorted = [];
  let clusterEnd = -1;

  for (const item of sorted) {
    if (currentCluster.length === 0 || item.startMin < clusterEnd) {
      currentCluster.push(item);
      clusterEnd = Math.max(clusterEnd, item.endMin);
    } else {
      clusters.push(currentCluster);
      currentCluster = [item];
      clusterEnd = item.endMin;
    }
  }
  if (currentCluster.length > 0) clusters.push(currentCluster);

  const result: LayoutedEvent[] = [];

  for (const cluster of clusters) {
    const columns: { end: number }[] = [];
    const assignments: { item: (typeof cluster)[number]; col: number }[] = [];

    for (const item of cluster) {
      let placed = false;
      for (let col = 0; col < columns.length; col++) {
        if (item.startMin >= columns[col]!.end) {
          columns[col]!.end = item.endMin;
          assignments.push({ item, col });
          placed = true;
          break;
        }
      }
      if (!placed) {
        assignments.push({ item, col: columns.length });
        columns.push({ end: item.endMin });
      }
    }

    const totalColumns = columns.length;
    for (const { item, col } of assignments) {
      result.push({ event: item.event, column: col, totalColumns });
    }
  }

  return result;
}
