import type { Tool } from "@anthropic-ai/sdk/resources/messages";
import { prisma } from "@/lib/prisma";
import {
  listEvents,
  listCalendars,
  createEvent,
  updateEvent,
} from "@/lib/google-calendar";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { TIMEZONE, HOURLY_WAGE, NET_PAY_RATE } from "@/lib/constants";
import { SHIFT_LOCATIONS } from "@/config/shifts";

// Tool definitions for Claude
export const tools: Tool[] = [
  {
    name: "get_tasks",
    description:
      "Get tasks from the task board. Returns titles, descriptions, statuses, priorities, due dates, categories, and photo URLs.",
    input_schema: {
      type: "object" as const,
      properties: {
        status: {
          type: "string",
          enum: ["TODO", "IN_PROGRESS", "DONE", "ARCHIVED"],
          description: "Filter by task status",
        },
        category: {
          type: "string",
          description: "Filter by category (e.g. school, work, personal)",
        },
      },
    },
  },
  {
    name: "update_task",
    description:
      "Update an existing task. Can change title, description, status, priority, category, or due date.",
    input_schema: {
      type: "object" as const,
      properties: {
        title: {
          type: "string",
          description:
            "Task title to find (searches by exact or partial match). Required.",
        },
        new_title: { type: "string", description: "New title for the task." },
        new_description: {
          type: "string",
          description: "New description for the task.",
        },
        new_status: {
          type: "string",
          enum: ["TODO", "IN_PROGRESS", "DONE", "ARCHIVED"],
          description: "New status.",
        },
        new_priority: {
          type: "string",
          enum: ["LOW", "MEDIUM", "HIGH", "URGENT"],
          description: "New priority.",
        },
        new_category: {
          type: "string",
          description: "New category.",
        },
        new_due_date: {
          type: "string",
          description: "New due date (YYYY-MM-DD).",
        },
      },
      required: ["title"],
    },
  },
  {
    name: "get_shifts",
    description:
      "Get work shifts with hours and pay. Returns shifts with dates, times, locations, hours, gross and net pay.",
    input_schema: {
      type: "object" as const,
      properties: {
        from: {
          type: "string",
          description:
            "Start date (YYYY-MM-DD). Defaults to start of current month.",
        },
        to: {
          type: "string",
          description:
            "End date (YYYY-MM-DD). Defaults to end of current month.",
        },
        location: {
          type: "string",
          enum: SHIFT_LOCATIONS.map((l) => l.key),
          description: "Filter by shift location",
        },
      },
    },
  },
  {
    name: "get_diary_entries",
    description:
      "Get diary/journal entries. Content includes both structured auto-context (events, tasks) AND personal descriptions/reflections written by the user. Always read the full content carefully. Use markdown images ![caption](url) to display photos. For videos, use markdown links [▶ caption](url) instead.",
    input_schema: {
      type: "object" as const,
      properties: {
        from: {
          type: "string",
          description: "Start date (YYYY-MM-DD)",
        },
        to: {
          type: "string",
          description: "End date (YYYY-MM-DD)",
        },
        mood: {
          type: "string",
          description: "Filter by mood key. Options: happy, good, neutral, tired, sad, stressed, angry, excited.",
        },
        tag: {
          type: "string",
          enum: ["school", "work", "social", "travel", "food", "personal"],
          description: "Filter by tag",
        },
      },
    },
  },
  {
    name: "get_calendar_events",
    description:
      "Get events from Google Calendar. Returns event titles, times, locations, and attendees.",
    input_schema: {
      type: "object" as const,
      properties: {
        from: {
          type: "string",
          description: "Start date (YYYY-MM-DD). Required.",
        },
        to: {
          type: "string",
          description: "End date (YYYY-MM-DD). Required.",
        },
      },
      required: ["from", "to"],
    },
  },
  {
    name: "create_calendar_event",
    description:
      "Create a new Google Calendar event. Use this when the user asks to schedule, add, or create an event.",
    input_schema: {
      type: "object" as const,
      properties: {
        summary: {
          type: "string",
          description: "Event title/name. Required.",
        },
        date: {
          type: "string",
          description:
            "Date of the event (YYYY-MM-DD). Required for timed events.",
        },
        start_time: {
          type: "string",
          description:
            "Start time in 24h format (HH:MM). If omitted, creates an all-day event.",
        },
        end_time: {
          type: "string",
          description:
            "End time in 24h format (HH:MM). If omitted, defaults to 1 hour after start.",
        },
        description: {
          type: "string",
          description: "Event description/notes.",
        },
        location: {
          type: "string",
          description: "Event location.",
        },
      },
      required: ["summary", "date"],
    },
  },
  {
    name: "update_calendar_event",
    description:
      "Update an existing Google Calendar event. Use get_calendar_events first to find the event ID.",
    input_schema: {
      type: "object" as const,
      properties: {
        event_id: {
          type: "string",
          description: "The Google Calendar event ID. Required.",
        },
        summary: {
          type: "string",
          description: "New event title.",
        },
        date: {
          type: "string",
          description: "New date (YYYY-MM-DD).",
        },
        start_time: {
          type: "string",
          description: "New start time (HH:MM, 24h format).",
        },
        end_time: {
          type: "string",
          description: "New end time (HH:MM, 24h format).",
        },
        description: {
          type: "string",
          description: "New description.",
        },
        location: {
          type: "string",
          description: "New location.",
        },
      },
      required: ["event_id"],
    },
  },
  {
    name: "create_task",
    description:
      "Create a new task on the task board. Use this when the user asks to add, create, or make a new task. If the user attached images, use media_ids to attach them as photos.",
    input_schema: {
      type: "object" as const,
      properties: {
        title: {
          type: "string",
          description: "Task title. Required.",
        },
        description: {
          type: "string",
          description: "Task description/details.",
        },
        status: {
          type: "string",
          enum: ["TODO", "IN_PROGRESS", "DONE"],
          description: "Initial status. Defaults to TODO.",
        },
        priority: {
          type: "string",
          enum: ["LOW", "MEDIUM", "HIGH", "URGENT"],
          description: "Task priority. Defaults to MEDIUM.",
        },
        category: {
          type: "string",
          description: "Category (e.g. school, work, personal).",
        },
        due_date: {
          type: "string",
          description: "Due date (YYYY-MM-DD).",
        },
        media_ids: {
          type: "string",
          description: "Comma-separated media file IDs to attach as task photos.",
        },
      },
      required: ["title"],
    },
  },
  {
    name: "create_diary_entry",
    description:
      "Create a NEW diary/journal entry for a given date. Use this ONLY for writing new entries. If an entry already exists for that date, use edit_diary_entry instead to avoid overwriting existing content. If the user attached images or videos, use media_ids to attach them as diary media.",
    input_schema: {
      type: "object" as const,
      properties: {
        date: {
          type: "string",
          description:
            "Date for the entry (YYYY-MM-DD). Defaults to today.",
        },
        content: {
          type: "string",
          description: "The diary entry text content.",
        },
        mood: {
          type: "string",
          description:
            "Mood key. Options: happy, good, neutral, tired, sad, stressed, angry, excited. Use exactly these lowercase keys.",
        },
        tags: {
          type: "string",
          description:
            "Comma-separated tags (e.g. 'school,work'). Options: school, work, social, travel, food, personal.",
        },
        media_ids: {
          type: "string",
          description: "Comma-separated media file IDs to attach as diary photos or videos.",
        },
      },
    },
  },
  {
    name: "delete_diary_entry",
    description:
      "Delete a diary/journal entry by date. Use get_diary_entries first to confirm the entry exists. Ask for confirmation before deleting.",
    input_schema: {
      type: "object" as const,
      properties: {
        date: {
          type: "string",
          description: "Date of the entry to delete (YYYY-MM-DD). Required.",
        },
      },
      required: ["date"],
    },
  },
  {
    name: "edit_diary_entry",
    description:
      "Edit an existing diary entry without overwriting it. Use this when the user asks to change, fix, or update part of an existing diary entry. Supports find-and-replace on content, updating mood/tags, and attaching photos via media_ids. ALWAYS use this instead of create_diary_entry when editing existing entries.",
    input_schema: {
      type: "object" as const,
      properties: {
        date: {
          type: "string",
          description: "Date of the entry to edit (YYYY-MM-DD). Required.",
        },
        find: {
          type: "string",
          description: "Text to find in the existing content. Used with 'replace' for find-and-replace.",
        },
        replace: {
          type: "string",
          description: "Text to replace the found text with. Used with 'find'.",
        },
        append: {
          type: "string",
          description: "Text to append to the end of the existing content.",
        },
        mood: {
          type: "string",
          description: "New mood key. Options: happy, good, neutral, tired, sad, stressed, angry, excited.",
        },
        tags: {
          type: "string",
          description: "Comma-separated tags to SET (replaces existing tags). Options: school, work, social, travel, food, personal.",
        },
        media_ids: {
          type: "string",
          description: "Comma-separated media file IDs to attach as photos or videos to this diary entry. Get IDs from image uploads or get_media_files.",
        },
      },
      required: ["date"],
    },
  },
  {
    name: "update_job_application",
    description:
      "Update a job application status or details. Use get_job_applications first to find the right application. Use empty string (\"\") to clear a field like url.",
    input_schema: {
      type: "object" as const,
      properties: {
        company: {
          type: "string",
          description:
            "Company name to find (searches by partial match). Required.",
        },
        title: {
          type: "string",
          description:
            "Job title to narrow the search if multiple applications at the same company.",
        },
        new_status: {
          type: "string",
          enum: [
            "APPLIED",
            "PHONE_SCREEN",
            "INTERVIEW",
            "OFFER",
            "REJECTED",
            "WITHDRAWN",
          ],
          description: "New application status.",
        },
        new_next_steps: {
          type: "string",
          description: "Updated next steps.",
        },
        new_notes: {
          type: "string",
          description: "Updated notes.",
        },
        new_url: {
          type: "string",
          description:
            "Updated job posting URL. Use empty string (\"\") to clear/delete it.",
        },
        new_assessment_type: {
          type: "string",
          enum: ["NONE", "CODING", "TAKE_HOME", "SYSTEM_DESIGN", "OTHER"],
          description:
            "Updated assessment type. NONE = no assessment, CODING = coding assessment, TAKE_HOME = take-home project, SYSTEM_DESIGN = system design, OTHER = custom.",
        },
        new_assessment_notes: {
          type: "string",
          description:
            "Updated assessment details (e.g. 'LeetCode medium, 90 min', 'Build a small CRUD app in 3 days'). Use empty string (\"\") to clear.",
        },
      },
      required: ["company"],
    },
  },
  {
    name: "create_job_application",
    description:
      "Create a new job application entry. Use this when the user says they applied to a new job.",
    input_schema: {
      type: "object" as const,
      properties: {
        company: { type: "string", description: "Company name. Required." },
        title: { type: "string", description: "Job title. Required." },
        status: {
          type: "string",
          enum: [
            "APPLIED",
            "PHONE_SCREEN",
            "INTERVIEW",
            "OFFER",
            "REJECTED",
            "WITHDRAWN",
          ],
          description: "Application status. Defaults to APPLIED.",
        },
        date_applied: {
          type: "string",
          description: "Date applied in YYYY-MM-DD format. Defaults to today.",
        },
        salary: {
          type: "string",
          description: "Salary range or hourly rate as text (e.g. '$33/hr').",
        },
        location: {
          type: "string",
          enum: ["REMOTE", "HYBRID", "ON_SITE"],
          description: "Work location type.",
        },
        url: { type: "string", description: "Job posting URL." },
        next_steps: { type: "string", description: "Next steps or follow-up plan." },
        notes: { type: "string", description: "Additional notes." },
        assessment_type: {
          type: "string",
          enum: ["NONE", "CODING", "TAKE_HOME", "SYSTEM_DESIGN", "OTHER"],
          description:
            "Assessment type. NONE = no assessment, CODING = coding assessment, TAKE_HOME = take-home project, SYSTEM_DESIGN = system design, OTHER = custom. Defaults to NONE.",
        },
        assessment_notes: {
          type: "string",
          description:
            "Assessment details (e.g. 'LeetCode medium, 90 min', 'Build a small CRUD app in 3 days').",
        },
      },
      required: ["company", "title"],
    },
  },
  {
    name: "get_job_applications",
    description:
      "Get job applications. Returns company, title, status, date applied, salary, location, URL, next steps, notes, and assessment info.",
    input_schema: {
      type: "object" as const,
      properties: {
        status: {
          type: "string",
          enum: [
            "APPLIED",
            "PHONE_SCREEN",
            "INTERVIEW",
            "OFFER",
            "REJECTED",
            "WITHDRAWN",
          ],
          description: "Filter by application status",
        },
      },
    },
  },
  {
    name: "get_site_status",
    description:
      "Get the status of monitored websites. Returns current up/down status, response times, and recent uptime percentage for each site.",
    input_schema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "get_claude_metrics",
    description:
      "Get Claude API usage and cost metrics. Returns token usage, costs, and model breakdown for a date range.",
    input_schema: {
      type: "object" as const,
      properties: {
        days: {
          type: "number",
          description: "Number of days to look back. Defaults to 7.",
        },
      },
    },
  },
  {
    name: "get_media_files",
    description:
      "Get uploaded media files from the CDN. Returns file names, sizes, types, URLs, and upload dates. For image files, includes an imageMarkdown field — copy it directly into your response to display the image.",
    input_schema: {
      type: "object" as const,
      properties: {
        source: {
          type: "string",
          enum: ["upload", "diary", "task"],
          description:
            "Filter by source: upload (manual uploads), diary (diary photos), task (task photos)",
        },
        limit: {
          type: "number",
          description: "Max files to return. Defaults to 20.",
        },
      },
    },
  },
  {
    name: "get_contacts",
    description:
      "Search or list contacts from the contacts database. Can filter by name, tag, or company. Returns profile photo URL (photoUrl) if set — display as markdown image.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description:
            "Search query to match against name, email, phone, or company.",
        },
        tag: {
          type: "string",
          description:
            "Filter by tag (e.g. friend, colleague, recruiter, classmate, mentor, family, professional).",
        },
        limit: {
          type: "number",
          description: "Max contacts to return. Defaults to 30.",
        },
      },
    },
  },
  {
    name: "update_contact",
    description:
      "Update an existing contact's details. Use get_contacts first to find the contact by name/email. Can add or change email, phone, company, title, tags, or notes.",
    input_schema: {
      type: "object" as const,
      properties: {
        contact_id: {
          type: "string",
          description:
            "The contact ID from get_contacts results. If not known, use contact_name to search.",
        },
        contact_name: {
          type: "string",
          description:
            "Contact name to search for (partial match). Used if contact_id is not provided.",
        },
        new_name: { type: "string", description: "New name for the contact." },
        new_email: {
          type: "string",
          description: "New or updated email address.",
        },
        new_phone: {
          type: "string",
          description: "New or updated phone number.",
        },
        new_company: {
          type: "string",
          description: "New or updated company name.",
        },
        new_title: {
          type: "string",
          description: "New or updated job title.",
        },
        new_tags: {
          type: "string",
          description:
            "Comma-separated tags to SET (replaces existing). e.g. 'friend,classmate'.",
        },
        new_notes: {
          type: "string",
          description: "New or updated notes. Use 'APPEND: ...' to add to existing notes.",
        },
      },
    },
  },
  {
    name: "get_important",
    description:
      "Get important topics and their items (links, notes, images, files). Each topic groups related items together. Can filter by category, query, or get a specific topic by ID.",
    input_schema: {
      type: "object" as const,
      properties: {
        topic_id: {
          type: "string",
          description: "Get a specific topic by ID with all its items.",
        },
        category: {
          type: "string",
          enum: ["work", "school", "personal", "reference", "project"],
          description: "Filter topics by category.",
        },
        query: {
          type: "string",
          description: "Search query to match against topic titles, item labels, content, or URLs.",
        },
      },
    },
  },
  {
    name: "add_important",
    description:
      "Create a new topic or add an item to an existing topic. If topic_id is provided, adds an item to that topic. Otherwise creates a new topic. Item types: link (needs label + url), note (needs content), image/file (needs media_id).",
    input_schema: {
      type: "object" as const,
      properties: {
        topic_id: {
          type: "string",
          description: "ID of existing topic to add an item to. If omitted, creates a new topic.",
        },
        topic_title: {
          type: "string",
          description: "Title for a new topic. Required when creating a topic.",
        },
        topic_category: {
          type: "string",
          enum: ["work", "school", "personal", "reference", "project"],
          description: "Category for the new topic.",
        },
        topic_icon: {
          type: "string",
          description: "Emoji icon for the new topic.",
        },
        item_type: {
          type: "string",
          enum: ["link", "note", "image", "file"],
          description: "Type of item to add to the topic.",
        },
        label: {
          type: "string",
          description: "Label for the item (used for links and files).",
        },
        url: {
          type: "string",
          description: "URL for link items.",
        },
        content: {
          type: "string",
          description: "Content for note items.",
        },
        media_id: {
          type: "string",
          description: "Media file ID for image/file items.",
        },
      },
    },
  },
  {
    name: "update_important",
    description:
      "Update an important topic's title, category, icon, or pinned status.",
    input_schema: {
      type: "object" as const,
      properties: {
        topic_id: {
          type: "string",
          description: "ID of the topic to update. Required.",
        },
        new_title: {
          type: "string",
          description: "New title for the topic.",
        },
        new_category: {
          type: "string",
          enum: ["work", "school", "personal", "reference", "project"],
          description: "New category.",
        },
        new_icon: {
          type: "string",
          description: "New emoji icon.",
        },
        pinned: {
          type: "boolean",
          description: "Pin or unpin the topic.",
        },
      },
      required: ["topic_id"],
    },
  },
  {
    name: "delete_important",
    description:
      "Delete an important topic (and all its items) or delete a single item from a topic. Always confirm with the user before deleting.",
    input_schema: {
      type: "object" as const,
      properties: {
        topic_id: {
          type: "string",
          description: "ID of the topic to delete (deletes the whole topic and all items). Required if not deleting a single item.",
        },
        item_id: {
          type: "string",
          description: "ID of a specific item to delete from a topic. If provided, only deletes this item, not the topic.",
        },
      },
    },
  },
  {
    name: "get_tennis_equipment",
    description:
      "Get tennis rackets, strings, and restring history. Returns racket specs, current string setup, days since last restring, and string inventory.",
    input_schema: {
      type: "object" as const,
      properties: {
        racket_id: {
          type: "string",
          description: "Get a specific racket by ID with full details including restring history.",
        },
      },
    },
  },
  {
    name: "get_tennis_sessions",
    description:
      "Get tennis sessions (practice, lesson, match). Returns type, date, duration, location, racket used, focus areas, notes, and cost/coach for lessons.",
    input_schema: {
      type: "object" as const,
      properties: {
        type: {
          type: "string",
          enum: ["practice", "lesson", "match"],
          description: "Filter by session type.",
        },
        from: {
          type: "string",
          description: "Start date (YYYY-MM-DD).",
        },
        to: {
          type: "string",
          description: "End date (YYYY-MM-DD).",
        },
        limit: {
          type: "number",
          description: "Max sessions to return. Defaults to 20.",
        },
      },
    },
  },
  {
    name: "get_tennis_ratings",
    description:
      "Get tennis stroke ratings with staged progression system. Returns current stage (Beginner→Competitive, mapped to UTR ranges), latest ratings per rater (self, claude, coaches), averages, and whether the user can advance to the next stage. Strokes: forehand, bhTopspin, bhSlice, serve, volley, overhead, returnOf.",
    input_schema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "get_tennis_notes",
    description:
      "Get tennis notes. Can filter by tag (technique, equipment, court, drill, other) or search text.",
    input_schema: {
      type: "object" as const,
      properties: {
        tag: {
          type: "string",
          enum: ["technique", "equipment", "court", "drill", "other"],
          description: "Filter by tag.",
        },
        query: {
          type: "string",
          description: "Search query to match against note content.",
        },
      },
    },
  },
  {
    name: "log_tennis_session",
    description:
      "Log a new tennis session. Use this when the user mentions playing tennis, having a lesson, or a match.",
    input_schema: {
      type: "object" as const,
      properties: {
        type: {
          type: "string",
          enum: ["practice", "lesson", "match"],
          description: "Session type. Required.",
        },
        date: {
          type: "string",
          description: "Date (YYYY-MM-DD). Defaults to today.",
        },
        duration: {
          type: "number",
          description: "Duration in hours (e.g. 1.5).",
        },
        location: {
          type: "string",
          description: "Where the session was played.",
        },
        racket_name: {
          type: "string",
          description: "Name of the racket used (partial match).",
        },
        tags: {
          type: "string",
          description: "Comma-separated focus areas (serve, forehand, backhand, volley, overhead, footwork, return, rally, fitness, mental).",
        },
        notes: {
          type: "string",
          description: "Session notes.",
        },
        cost: {
          type: "number",
          description: "Lesson cost in dollars.",
        },
        coach: {
          type: "string",
          description: "Coach name (for lessons).",
        },
        played_with: {
          type: "string",
          description: "Who the user played with (partners, opponents, coaches). Free text.",
        },
      },
      required: ["type"],
    },
  },
  {
    name: "rate_tennis_strokes",
    description:
      "Submit a tennis stroke rating assessment. All 7 strokes are required (1-10, 0.5 increments). When Claude rates, set rated_by to 'claude'. Be honest and constructive. Strokes: forehand, bh_topspin, bh_slice, serve, volley, overhead, return_of.",
    input_schema: {
      type: "object" as const,
      properties: {
        rated_by: { type: "string", description: "Who is rating: 'self', 'claude', 'coach', or 'coach:Name'. Default 'claude' when Claude rates." },
        forehand: { type: "number", description: "Forehand rating (1-10, 0.5 increments)." },
        bh_topspin: { type: "number", description: "Backhand topspin rating (1-10)." },
        bh_slice: { type: "number", description: "Backhand slice rating (1-10)." },
        serve: { type: "number", description: "Serve rating (1-10)." },
        volley: { type: "number", description: "Volley rating (1-10)." },
        overhead: { type: "number", description: "Overhead rating (1-10)." },
        return_of: { type: "number", description: "Return rating (1-10)." },
        notes: { type: "string", description: "Notes about the rating assessment." },
        session_id: { type: "string", description: "Optional tennis session ID to link this rating to." },
      },
      required: ["forehand", "bh_topspin", "bh_slice", "serve", "volley", "overhead", "return_of"],
    },
  },
  {
    name: "advance_tennis_stage",
    description:
      "Advance to the next tennis stage. Only works if all self-rated strokes are at 9.0+. Stages: Beginner→Intermediate→High Intermediate→Advanced→Elite→Competitive.",
    input_schema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "log_restring",
    description:
      "Log a racket restring. Supports hybrid setups with different mains/cross strings. Updates the racket's current string and auto-decrements string inventory.",
    input_schema: {
      type: "object" as const,
      properties: {
        racket_name: {
          type: "string",
          description: "Racket name (partial match). Required.",
        },
        string_name: {
          type: "string",
          description: "Mains string name (or full string name if not hybrid). Required.",
        },
        tension: {
          type: "string",
          description: "Mains tension (e.g. '55'). For non-hybrid can be '48/52'.",
        },
        cross_string_name: {
          type: "string",
          description: "Cross string name if hybrid setup (different from mains).",
        },
        cross_tension: {
          type: "string",
          description: "Cross string tension if hybrid (e.g. '52').",
        },
        date: {
          type: "string",
          description: "Restring date (YYYY-MM-DD). Defaults to today.",
        },
        notes: {
          type: "string",
          description: "Notes about the restring.",
        },
      },
      required: ["racket_name", "string_name"],
    },
  },
  {
    name: "get_dashboard_summary",
    description:
      "Get an overview of all dashboard data: task counts, shift hours/pay this month, active job applications, recent diary moods, and site uptime.",
    input_schema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "update_racket",
    description:
      "Update a tennis racket's info: name, brand, model, specs, current string, tension, notes. Find by racket name (partial match).",
    input_schema: {
      type: "object" as const,
      properties: {
        racket_name: { type: "string", description: "Racket name to find (partial match). Required." },
        new_name: { type: "string", description: "New nickname for the racket." },
        brand: { type: "string", description: "Brand name." },
        model: { type: "string", description: "Model name." },
        head_size: { type: "number", description: "Head size in sq inches." },
        weight: { type: "number", description: "Weight in grams." },
        pattern: { type: "string", description: "String pattern (e.g. '16x19')." },
        balance: { type: "number", description: "Balance in mm." },
        swing_weight: { type: "number", description: "Swing weight." },
        current_string: { type: "string", description: "Current string name." },
        tension: { type: "string", description: "Current tension (e.g. '55/55')." },
        notes: { type: "string", description: "Notes about the racket." },
      },
      required: ["racket_name"],
    },
  },
  {
    name: "add_racket",
    description:
      "Add a new tennis racket to the inventory. Requires at least name, brand, and model.",
    input_schema: {
      type: "object" as const,
      properties: {
        name: { type: "string", description: "Nickname for this racket setup (e.g. 'Match Play', 'Daily Driver'). Required." },
        brand: { type: "string", description: "Brand (e.g. Wilson, Head, Yonex). Required." },
        model: { type: "string", description: "Model (e.g. Pure Aero 2023). Required." },
        head_size: { type: "number", description: "Head size in sq inches." },
        weight: { type: "number", description: "Weight in grams." },
        pattern: { type: "string", description: "String pattern (e.g. '16x19')." },
        balance: { type: "number", description: "Balance in mm." },
        swing_weight: { type: "number", description: "Swing weight." },
        current_string: { type: "string", description: "Current string name." },
        tension: { type: "string", description: "Current tension." },
        notes: { type: "string", description: "Notes about the racket." },
      },
      required: ["name", "brand", "model"],
    },
  },
  {
    name: "add_tennis_note",
    description:
      "Add a tennis note. Use for technique observations, drill ideas, equipment thoughts, court notes, etc.",
    input_schema: {
      type: "object" as const,
      properties: {
        content: { type: "string", description: "Note content. Required." },
        tag: {
          type: "string",
          enum: ["technique", "equipment", "court", "drill", "other"],
          description: "Note tag/category. Defaults to 'other'.",
        },
      },
      required: ["content"],
    },
  },
  {
    name: "manage_string_inventory",
    description:
      "Add a new string to inventory or update existing stock. Use 'action' to add new string or update quantity.",
    input_schema: {
      type: "object" as const,
      properties: {
        action: {
          type: "string",
          enum: ["add", "update"],
          description: "Action: 'add' creates new string entry, 'update' changes existing quantity/details.",
        },
        name: { type: "string", description: "String name. Required." },
        type: {
          type: "string",
          enum: ["poly", "multi", "natural_gut", "synthetic_gut", "hybrid", "kevlar"],
          description: "String type.",
        },
        gauge: { type: "string", description: "String gauge (e.g. '1.25mm', '17')." },
        quantity: { type: "number", description: "Number of sets in stock." },
      },
      required: ["name"],
    },
  },
];

// Tool handlers
interface ToolInput {
  status?: string;
  category?: string;
  from?: string;
  to?: string;
  location?: string;
  mood?: string;
  tag?: string;
  days?: number;
  source?: string;
  limit?: number;
  query?: string;
  // Calendar event fields
  summary?: string;
  date?: string;
  start_time?: string;
  end_time?: string;
  description?: string;
  event_id?: string;
  // Task fields
  title?: string;
  new_title?: string;
  new_description?: string;
  new_status?: string;
  new_priority?: string;
  new_category?: string;
  new_due_date?: string;
  due_date?: string;
  priority?: string;
  content?: string;
  tags?: string;
  // Diary edit fields
  find?: string;
  replace?: string;
  append?: string;
  // Job fields
  company?: string;
  date_applied?: string;
  salary?: string;
  next_steps?: string;
  new_next_steps?: string;
  new_notes?: string;
  new_url?: string;
  assessment_type?: string;
  assessment_notes?: string;
  new_assessment_type?: string;
  new_assessment_notes?: string;
  // Important fields
  type?: string;
  label?: string;
  url?: string;
  pinned?: boolean;
  media_id?: string;
  item_id?: string;
  topic_id?: string;
  topic_title?: string;
  topic_category?: string;
  topic_icon?: string;
  item_type?: string;
  new_icon?: string;
  // Contact update fields
  contact_id?: string;
  contact_name?: string;
  new_name?: string;
  new_email?: string;
  new_phone?: string;
  new_company?: string;
  // new_title already defined in Task fields above
  new_tags?: string;
  // Media attachment
  media_ids?: string;
  // Tennis fields
  racket_id?: string;
  racket_name?: string;
  string_name?: string;
  tension?: string;
  stringer?: string;
  cost?: number;
  coach?: string;
  duration?: number;
  forehand?: number;
  backhand_topspin?: number;
  backhand_slice?: number;
  serve?: number;
  volley?: number;
  overhead?: number;
  return?: number;
  notes?: string;
  // Racket fields
  weight?: number;
  head_size?: number;
  swing_weight?: number;
  current_string?: string;
  balance?: number;
  pattern?: string;
  brand?: string;
  model?: string;
  // String inventory fields
  action?: string;
  gauge?: string;
  quantity?: number;
  name?: string;
  // Hybrid restring fields
  cross_string_name?: string;
  cross_tension?: string;
  // Session fields
  played_with?: string;
  // Staged rating fields
  rated_by?: string;
  bh_topspin?: number;
  bh_slice?: number;
  return_of?: number;
  session_id?: string;
}

interface ToolContext {
  visibleCalendarIds?: string[];
}

export async function executeTool(
  name: string,
  input: ToolInput,
  context?: ToolContext
): Promise<string> {
  switch (name) {
    case "get_tasks":
      return JSON.stringify(await getTasks(input));
    case "update_task":
      return JSON.stringify(await updateTask(input));
    case "create_task":
      return JSON.stringify(await createTask(input));
    case "create_diary_entry":
      return JSON.stringify(await createDiaryEntry(input));
    case "delete_diary_entry":
      return JSON.stringify(await deleteDiaryEntry(input));
    case "edit_diary_entry":
      return JSON.stringify(await editDiaryEntry(input));
    case "create_job_application":
      return JSON.stringify(await createJobApplication(input));
    case "update_job_application":
      return JSON.stringify(await updateJobApplication(input));
    case "get_shifts":
      return JSON.stringify(await getShifts(input));
    case "get_diary_entries":
      return JSON.stringify(await getDiaryEntries(input));
    case "get_calendar_events":
      return JSON.stringify(
        await getCalendarEvents(input, context?.visibleCalendarIds)
      );
    case "create_calendar_event":
      return JSON.stringify(await createCalendarEvent(input));
    case "update_calendar_event":
      return JSON.stringify(await updateCalendarEvent(input));
    case "get_job_applications":
      return JSON.stringify(await getJobApplications(input));
    case "get_site_status":
      return JSON.stringify(await getSiteStatus());
    case "get_claude_metrics":
      return JSON.stringify(await getClaudeMetrics(input));
    case "get_media_files":
      return JSON.stringify(await getMediaFiles(input));
    case "get_contacts":
      return JSON.stringify(await getContacts(input));
    case "update_contact":
      return JSON.stringify(await updateContact(input));
    case "get_important":
      return JSON.stringify(await getImportant(input));
    case "add_important":
      return JSON.stringify(await addImportant(input));
    case "update_important":
      return JSON.stringify(await updateImportant(input));
    case "delete_important":
      return JSON.stringify(await deleteImportant(input));
    case "get_tennis_equipment":
      return JSON.stringify(await getTennisEquipment(input));
    case "get_tennis_sessions":
      return JSON.stringify(await getTennisSessions(input));
    case "get_tennis_ratings":
      return JSON.stringify(await getTennisRatings());
    case "get_tennis_notes":
      return JSON.stringify(await getTennisNotes(input));
    case "log_tennis_session":
      return JSON.stringify(await logTennisSession(input));
    case "rate_tennis_strokes":
      return JSON.stringify(await rateTennisStrokes(input));
    case "advance_tennis_stage":
      return JSON.stringify(await advanceTennisStage());
    case "log_restring":
      return JSON.stringify(await logRestring(input));
    case "get_dashboard_summary":
      return JSON.stringify(await getDashboardSummary());
    case "update_racket":
      return JSON.stringify(await updateRacket(input));
    case "add_racket":
      return JSON.stringify(await addRacket(input));
    case "add_tennis_note":
      return JSON.stringify(await addTennisNote(input));
    case "manage_string_inventory":
      return JSON.stringify(await manageStringInventory(input));
    default:
      return JSON.stringify({ error: `Unknown tool: ${name}` });
  }
}

async function getTasks(input: ToolInput) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};
  if (input.status) where.status = input.status;
  if (input.category) where.category = input.category;

  const tasks = await prisma.task.findMany({
    where,
    orderBy: [{ order: "asc" }, { createdAt: "desc" }],
    take: 50,
    include: { photos: { orderBy: { order: "asc" } } },
  });

  return {
    count: tasks.length,
    tasks: tasks.map((t) => ({
      title: t.title,
      description: t.description,
      status: t.status,
      priority: t.priority,
      category: t.category,
      dueDate: t.dueDate
        ? formatInTimeZone(t.dueDate, TIMEZONE, "yyyy-MM-dd")
        : null,
      completedAt: t.completedAt
        ? formatInTimeZone(t.completedAt, TIMEZONE, "yyyy-MM-dd")
        : null,
      photos: t.photos.map((p) => {
        const isVideo = p.url.includes("#video");
        return {
          url: p.url,
          caption: p.caption,
          imageMarkdown: isVideo
            ? `[▶ ${p.caption || "video"}](${p.url.replace("#video", "")})`
            : `![${p.caption || "photo"}](${p.url})`,
        };
      }),
    })),
  };
}

async function updateTask(input: ToolInput) {
  if (!input.title) {
    return { error: "title is required to find the task" };
  }

  // Find task by title (partial match)
  const task = await prisma.task.findFirst({
    where: {
      title: { contains: input.title, mode: "insensitive" },
    },
  });

  if (!task) {
    return { error: `No task found matching "${input.title}"` };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = {};
  if (input.new_title) data.title = input.new_title;
  if (input.new_description) data.description = input.new_description;
  if (input.new_status) data.status = input.new_status;
  if (input.new_priority) data.priority = input.new_priority;
  if (input.new_category) data.category = input.new_category;
  if (input.new_due_date) data.dueDate = new Date(input.new_due_date);

  // Track status changes
  if (input.new_status && input.new_status !== task.status) {
    data.statusChangedAt = new Date();
    if (input.new_status === "DONE") {
      data.completedAt = new Date();
    } else if (task.status === "DONE") {
      data.completedAt = null;
    }
  }

  const updated = await prisma.task.update({
    where: { id: task.id },
    data,
  });

  return {
    success: true,
    task: {
      title: updated.title,
      status: updated.status,
      priority: updated.priority,
      description: updated.description,
    },
  };
}

async function createTask(input: ToolInput) {
  if (!input.title) {
    return { error: "title is required" };
  }

  // Insert at top of the target status column
  const status = (input.new_status as "TODO" | "IN_PROGRESS" | "DONE") || "TODO";
  await prisma.task.updateMany({
    where: { status },
    data: { order: { increment: 1 } },
  });

  const task = await prisma.task.create({
    data: {
      title: input.title,
      description: input.description || null,
      status,
      priority: (input.priority as "LOW" | "MEDIUM" | "HIGH" | "URGENT") || "MEDIUM",
      category: input.category || null,
      dueDate: input.due_date ? new Date(input.due_date) : null,
      order: 0,
    },
  });

  // Attach photos if media_ids provided
  let photosAttached = 0;
  if (input.media_ids) {
    const ids = input.media_ids.split(",").map((id) => id.trim()).filter(Boolean);
    for (let i = 0; i < ids.length; i++) {
      const media = await prisma.mediaFile.findUnique({ where: { id: ids[i] } });
      if (media) {
        await prisma.taskPhoto.create({
          data: {
            taskId: task.id,
            mediaId: media.id,
            url: `/api/media/share/${media.shareSlug}`,
            order: i,
          },
        });
        photosAttached++;
      }
    }
  }

  return {
    success: true,
    task: {
      title: task.title,
      status: task.status,
      priority: task.priority,
      category: task.category,
      dueDate: task.dueDate
        ? formatInTimeZone(task.dueDate, TIMEZONE, "yyyy-MM-dd")
        : null,
      photosAttached,
    },
  };
}

async function createDiaryEntry(input: ToolInput) {
  const dateStr =
    input.date || formatInTimeZone(new Date(), TIMEZONE, "yyyy-MM-dd");
  // Must match diary API route: fromZonedTime midnight in the configured timezone
  const entryDate = fromZonedTime(`${dateStr}T00:00:00`, TIMEZONE);

  const tags = input.tags
    ? input.tags.split(",").map((t) => t.trim().toLowerCase())
    : [];

  // Normalize mood: accept emoji fallback, convert to key
  const EMOJI_TO_MOOD: Record<string, string> = {
    "😄": "happy", "😃": "happy", "😀": "happy",
    "🙂": "good", "😊": "good",
    "😐": "neutral", "😑": "neutral",
    "😴": "tired", "🥱": "tired",
    "😔": "sad", "😢": "sad",
    "😤": "stressed", "⚡": "stressed",
    "😡": "angry", "🔥": "angry",
    "🤩": "excited", "✨": "excited", "🎉": "excited",
  };
  const VALID_MOODS = new Set(["happy", "good", "neutral", "tired", "sad", "stressed", "angry", "excited"]);
  let mood: string | null = null;
  if (input.mood) {
    const raw = input.mood.trim().toLowerCase();
    if (VALID_MOODS.has(raw)) {
      mood = raw;
    } else {
      const emojiMood = EMOJI_TO_MOOD[input.mood.trim()];
      if (emojiMood) mood = emojiMood;
    }
  }

  const entry = await prisma.diaryEntry.upsert({
    where: { date: entryDate },
    create: {
      date: entryDate,
      content: input.content || null,
      mood,
      tags,
    },
    update: {
      ...(input.content !== undefined && { content: input.content }),
      ...(input.mood !== undefined && { mood }),
      ...(tags.length > 0 && { tags }),
    },
  });

  // Attach photos if media_ids provided
  let photosAttached = 0;
  if (input.media_ids) {
    const ids = input.media_ids.split(",").map((id) => id.trim()).filter(Boolean);
    for (let i = 0; i < ids.length; i++) {
      const media = await prisma.mediaFile.findUnique({ where: { id: ids[i] } });
      if (media) {
        await prisma.diaryPhoto.create({
          data: {
            entryId: entry.id,
            mediaId: media.id,
            url: `/api/media/share/${media.shareSlug}`,
            order: i,
          },
        });
        photosAttached++;
      }
    }
  }

  return {
    success: true,
    entry: {
      date: formatInTimeZone(entry.date, TIMEZONE, "yyyy-MM-dd (EEE)"),
      mood: entry.mood,
      tags: entry.tags,
      contentLength: entry.content?.length ?? 0,
      photosAttached,
    },
  };
}

async function deleteDiaryEntry(input: ToolInput) {
  if (!input.date) return { error: "date is required (YYYY-MM-DD)" };
  const entryDate = fromZonedTime(`${input.date}T00:00:00`, TIMEZONE);
  // Try exact match first, then fall back to date range (handles timezone mismatches)
  let entry = await prisma.diaryEntry.findUnique({ where: { date: entryDate } });
  if (!entry) {
    const dayStart = new Date(`${input.date}T00:00:00Z`);
    const dayEnd = new Date(`${input.date}T23:59:59Z`);
    entry = await prisma.diaryEntry.findFirst({
      where: { date: { gte: dayStart, lte: dayEnd } },
    });
  }
  if (!entry) {
    // Last resort: widen to +/- 1 day to catch any timezone edge case
    const prev = new Date(`${input.date}T00:00:00Z`);
    prev.setDate(prev.getDate() - 1);
    const next = new Date(`${input.date}T00:00:00Z`);
    next.setDate(next.getDate() + 2);
    entry = await prisma.diaryEntry.findFirst({
      where: { date: { gte: prev, lt: next } },
    });
  }
  if (!entry) return { error: `No diary entry found for ${input.date}` };
  await prisma.diaryEntry.delete({ where: { id: entry.id } });
  return { success: true, deleted: input.date };
}

async function editDiaryEntry(input: ToolInput) {
  if (!input.date) return { error: "date is required (YYYY-MM-DD)" };

  const entryDate = fromZonedTime(`${input.date}T00:00:00`, TIMEZONE);
  // Find existing entry (same timezone fallback as delete)
  let entry = await prisma.diaryEntry.findUnique({ where: { date: entryDate } });
  if (!entry) {
    const dayStart = new Date(`${input.date}T00:00:00Z`);
    const dayEnd = new Date(`${input.date}T23:59:59Z`);
    entry = await prisma.diaryEntry.findFirst({
      where: { date: { gte: dayStart, lte: dayEnd } },
    });
  }
  if (!entry) return { error: `No diary entry found for ${input.date}` };

  // Build update payload
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const update: any = {};

  // Find-and-replace in content
  if (input.find && input.replace !== undefined && entry.content) {
    if (!entry.content.includes(input.find)) {
      return { error: `Could not find "${input.find}" in the diary content. Content starts with: "${entry.content.slice(0, 200)}"` };
    }
    update.content = entry.content.replace(input.find, input.replace);
  }

  // Append to content
  if (input.append) {
    const base = update.content ?? entry.content ?? "";
    update.content = base + "\n" + input.append;
  }

  // Update mood
  if (input.mood) {
    const VALID_MOODS = new Set(["happy", "good", "neutral", "tired", "sad", "stressed", "angry", "excited"]);
    const EMOJI_TO_MOOD: Record<string, string> = {
      "😄": "happy", "🙂": "good", "😐": "neutral", "😴": "tired",
      "😔": "sad", "😤": "stressed", "😡": "angry", "🤩": "excited",
    };
    const raw = input.mood.trim().toLowerCase();
    if (VALID_MOODS.has(raw)) {
      update.mood = raw;
    } else {
      const emojiMood = EMOJI_TO_MOOD[input.mood.trim()];
      if (emojiMood) update.mood = emojiMood;
    }
  }

  // Update tags
  if (input.tags) {
    update.tags = input.tags.split(",").map((t: string) => t.trim().toLowerCase());
  }

  // Attach photos if media_ids provided
  let photosAttached = 0;
  if (input.media_ids) {
    const ids = input.media_ids.split(",").map((id) => id.trim()).filter(Boolean);
    // Get existing photo count for ordering
    const existingPhotos = await prisma.diaryPhoto.count({ where: { entryId: entry.id } });
    for (let i = 0; i < ids.length; i++) {
      const media = await prisma.mediaFile.findUnique({ where: { id: ids[i] } });
      if (media) {
        await prisma.diaryPhoto.create({
          data: {
            entryId: entry.id,
            mediaId: media.id,
            url: `/api/media/share/${media.shareSlug}`,
            order: existingPhotos + i,
          },
        });
        photosAttached++;
      }
    }
  }

  if (Object.keys(update).length === 0 && photosAttached === 0) {
    return { error: "No changes specified. Use find/replace, append, mood, tags, or media_ids." };
  }

  let updated = entry;
  if (Object.keys(update).length > 0) {
    updated = await prisma.diaryEntry.update({
      where: { id: entry.id },
      data: update,
    });
  }

  return {
    success: true,
    date: input.date,
    content_preview: updated.content?.slice(0, 300) ?? null,
    mood: updated.mood,
    tags: updated.tags,
    photosAttached,
  };
}

async function createJobApplication(input: ToolInput) {
  if (!input.company || !input.title) {
    return { error: "company and title are required" };
  }

  const dateApplied = input.date_applied
    ? new Date(input.date_applied)
    : new Date();

  const status =
    (input.status as
      | "APPLIED"
      | "PHONE_SCREEN"
      | "INTERVIEW"
      | "OFFER"
      | "REJECTED"
      | "WITHDRAWN") ?? "APPLIED";

  const created = await prisma.jobApplication.create({
    data: {
      company: input.company,
      title: input.title,
      status,
      dateApplied,
      salary: input.salary ?? null,
      location: (input.location as "REMOTE" | "HYBRID" | "ON_SITE") ?? null,
      jobUrl: input.url ?? null,
      nextSteps: input.next_steps ?? null,
      notes: input.notes ?? null,
      assessmentType:
        (input.assessment_type as
          | "NONE"
          | "CODING"
          | "TAKE_HOME"
          | "SYSTEM_DESIGN"
          | "OTHER") ?? "NONE",
      assessmentNotes: input.assessment_notes ?? null,
      history: {
        create: {
          toStatus: status,
          note: "Application created",
        },
      },
    },
  });

  return {
    success: true,
    application: {
      id: created.id,
      company: created.company,
      title: created.title,
      status: created.status,
      dateApplied: created.dateApplied.toISOString().split("T")[0],
      salary: created.salary,
      location: created.location,
      jobUrl: created.jobUrl,
      nextSteps: created.nextSteps,
      assessmentType: created.assessmentType,
      assessmentNotes: created.assessmentNotes,
    },
  };
}

async function updateJobApplication(input: ToolInput) {
  if (!input.company) {
    return { error: "company is required to find the application" };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {
    company: { contains: input.company, mode: "insensitive" },
  };
  if (input.title) {
    where.title = { contains: input.title, mode: "insensitive" };
  }

  const job = await prisma.jobApplication.findFirst({ where });
  if (!job) {
    return {
      error: `No application found matching company "${input.company}"${input.title ? ` and title "${input.title}"` : ""}`,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = {};
  if (input.new_status) data.status = input.new_status;
  if (input.new_next_steps) data.nextSteps = input.new_next_steps;
  if (input.new_notes) data.notes = input.new_notes;

  // URL: empty string clears, non-empty sets
  if (input.new_url !== undefined) {
    data.jobUrl = input.new_url.trim() === "" ? null : input.new_url.trim();
  }
  if (input.new_assessment_type) data.assessmentType = input.new_assessment_type;
  if (input.new_assessment_notes !== undefined) {
    data.assessmentNotes =
      input.new_assessment_notes.trim() === ""
        ? null
        : input.new_assessment_notes;
  }

  // Log history if status changed
  const statusChanging =
    input.new_status !== undefined && input.new_status !== job.status;
  if (statusChanging) {
    data.history = {
      create: {
        fromStatus: job.status,
        toStatus: input.new_status!,
      },
    };
  }

  const updated = await prisma.jobApplication.update({
    where: { id: job.id },
    data,
  });

  return {
    success: true,
    application: {
      company: updated.company,
      title: updated.title,
      status: updated.status,
      nextSteps: updated.nextSteps,
      jobUrl: updated.jobUrl,
      assessmentType: updated.assessmentType,
      assessmentNotes: updated.assessmentNotes,
    },
  };
}

async function getShifts(input: ToolInput) {
  const now = new Date();
  const monthStart =
    input.from || formatInTimeZone(now, TIMEZONE, "yyyy-MM-01");
  const monthEnd =
    input.to ||
    formatInTimeZone(
      new Date(now.getFullYear(), now.getMonth() + 1, 0),
      TIMEZONE,
      "yyyy-MM-dd"
    );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {
    date: {
      gte: new Date(monthStart),
      lte: new Date(monthEnd + "T23:59:59"),
    },
  };
  if (input.location) where.location = input.location;

  const shifts = await prisma.shift.findMany({
    where,
    orderBy: { date: "desc" },
  });

  const totalHours = shifts.reduce((s, sh) => s + sh.hours, 0);
  const totalGross = shifts.reduce((s, sh) => s + sh.grossPay, 0);
  const totalNet = shifts.reduce((s, sh) => s + sh.netPay, 0);

  return {
    count: shifts.length,
    totalHours: Math.round(totalHours * 100) / 100,
    totalGrossPay: Math.round(totalGross * 100) / 100,
    totalNetPay: Math.round(totalNet * 100) / 100,
    hourlyWage: HOURLY_WAGE,
    netPayRate: NET_PAY_RATE,
    shifts: shifts.map((s) => ({
      date: formatInTimeZone(s.date, TIMEZONE, "yyyy-MM-dd (EEE)"),
      start: formatInTimeZone(s.startTime, TIMEZONE, "h:mm a"),
      end: formatInTimeZone(s.endTime, TIMEZONE, "h:mm a"),
      location: s.location,
      label: s.label,
      hours: s.hours,
      netPay: Math.round(s.netPay * 100) / 100,
    })),
  };
}

async function getDiaryEntries(input: ToolInput) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};

  if (input.from || input.to) {
    where.date = {};
    if (input.from) where.date.gte = new Date(input.from);
    if (input.to) where.date.lte = new Date(input.to + "T23:59:59");
  }
  if (input.mood) where.mood = input.mood;
  if (input.tag) where.tags = { has: input.tag };

  const entries = await prisma.diaryEntry.findMany({
    where,
    orderBy: { date: "desc" },
    take: 20,
    include: { photos: { orderBy: { order: "asc" } } },
  });

  return {
    count: entries.length,
    entries: entries.map((e) => ({
      date: formatInTimeZone(e.date, TIMEZONE, "yyyy-MM-dd (EEE)"),
      mood: e.mood,
      tags: e.tags,
      content: e.content ? e.content.slice(0, 2000) : null,
      photos: e.photos.map((p) => {
        const isVideo = p.url.includes("#video");
        return {
          url: p.url,
          caption: p.caption,
          imageMarkdown: isVideo
            ? `[▶ ${p.caption || "video"}](${p.url.replace("#video", "")})`
            : `![${p.caption || "photo"}](${p.url})`,
        };
      }),
    })),
  };
}

async function getCalendarEvents(
  input: ToolInput,
  visibleCalendarIds?: string[]
) {
  if (!input.from || !input.to) {
    return { error: "from and to dates are required" };
  }

  try {
    // Get all calendars and filter by user's dashboard visibility settings
    const calendars = await listCalendars();
    const visibleSet = visibleCalendarIds?.length
      ? new Set(visibleCalendarIds)
      : null;
    const visibleCalendars = calendars.filter(
      (c) => c.selected !== false && (!visibleSet || visibleSet.has(c.id))
    );

    const allEvents = [];
    for (const cal of visibleCalendars) {
      try {
        const events = await listEvents(
          input.from,
          input.to + "T23:59:59",
          cal.id
        );
        for (const e of events) {
          allEvents.push({
            id: e.id,
            title: e.summary || "(No title)",
            date: e.start.dateTime
              ? formatInTimeZone(
                  new Date(e.start.dateTime),
                  TIMEZONE,
                  "yyyy-MM-dd (EEE)"
                )
              : e.start.date,
            start: e.start.dateTime
              ? formatInTimeZone(
                  new Date(e.start.dateTime),
                  TIMEZONE,
                  "h:mm a"
                )
              : "All day",
            end: e.end.dateTime
              ? formatInTimeZone(new Date(e.end.dateTime), TIMEZONE, "h:mm a")
              : null,
            location: e.location || null,
            calendar: cal.summary,
          });
        }
      } catch {
        // Skip calendars that fail
      }
    }

    // Sort by date
    allEvents.sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));

    return { count: allEvents.length, events: allEvents };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to fetch calendar",
    };
  }
}

async function createCalendarEvent(input: ToolInput) {
  if (!input.summary || !input.date) {
    return { error: "summary and date are required" };
  }

  try {
    // Build event input
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const eventInput: any = {
      summary: input.summary,
    };

    if (input.description) eventInput.description = input.description;
    if (input.location) eventInput.location = input.location;

    if (input.start_time) {
      // Timed event
      const startDT = `${input.date}T${input.start_time}:00`;
      let endDT: string;
      if (input.end_time) {
        endDT = `${input.date}T${input.end_time}:00`;
      } else {
        // Default 1 hour duration
        const [h, m] = input.start_time.split(":").map(Number);
        const endH = String((h ?? 0) + 1).padStart(2, "0");
        const endM = String(m ?? 0).padStart(2, "0");
        endDT = `${input.date}T${endH}:${endM}:00`;
      }

      eventInput.start = {
        dateTime: startDT,
        timeZone: TIMEZONE,
      };
      eventInput.end = {
        dateTime: endDT,
        timeZone: TIMEZONE,
      };
    } else {
      // All-day event
      eventInput.start = { date: input.date };
      // Google Calendar all-day end date is exclusive (next day)
      const endDate = new Date(input.date);
      endDate.setDate(endDate.getDate() + 1);
      const endStr = endDate.toISOString().split("T")[0];
      eventInput.end = { date: endStr };
    }

    const created = await createEvent(eventInput);

    return {
      success: true,
      event: {
        id: created.id,
        title: created.summary,
        start: created.start.dateTime
          ? formatInTimeZone(
              new Date(created.start.dateTime),
              TIMEZONE,
              "yyyy-MM-dd h:mm a"
            )
          : created.start.date,
        end: created.end.dateTime
          ? formatInTimeZone(
              new Date(created.end.dateTime),
              TIMEZONE,
              "h:mm a"
            )
          : null,
        location: created.location,
      },
    };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to create event",
    };
  }
}

async function updateCalendarEvent(input: ToolInput) {
  if (!input.event_id) {
    return { error: "event_id is required" };
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const eventUpdate: any = {};

    if (input.summary) eventUpdate.summary = input.summary;
    if (input.description) eventUpdate.description = input.description;
    if (input.location) eventUpdate.location = input.location;

    if (input.date && input.start_time) {
      const startDT = `${input.date}T${input.start_time}:00`;
      eventUpdate.start = { dateTime: startDT, timeZone: TIMEZONE };

      if (input.end_time) {
        const endDT = `${input.date}T${input.end_time}:00`;
        eventUpdate.end = { dateTime: endDT, timeZone: TIMEZONE };
      }
    } else if (input.date) {
      eventUpdate.start = { date: input.date };
      const endDate = new Date(input.date);
      endDate.setDate(endDate.getDate() + 1);
      eventUpdate.end = { date: endDate.toISOString().split("T")[0] };
    }

    const updated = await updateEvent(input.event_id, eventUpdate);

    return {
      success: true,
      event: {
        id: updated.id,
        title: updated.summary,
        start: updated.start.dateTime
          ? formatInTimeZone(
              new Date(updated.start.dateTime),
              TIMEZONE,
              "yyyy-MM-dd h:mm a"
            )
          : updated.start.date,
        end: updated.end.dateTime
          ? formatInTimeZone(
              new Date(updated.end.dateTime),
              TIMEZONE,
              "h:mm a"
            )
          : null,
      },
    };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to update event",
    };
  }
}

async function getJobApplications(input: ToolInput) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};
  if (input.status) where.status = input.status;

  const jobs = await prisma.jobApplication.findMany({
    where,
    orderBy: { dateApplied: "desc" },
    take: 50,
  });

  return {
    count: jobs.length,
    applications: jobs.map((j) => ({
      id: j.id,
      company: j.company,
      title: j.title,
      status: j.status,
      dateApplied: formatInTimeZone(j.dateApplied, TIMEZONE, "yyyy-MM-dd"),
      salary: j.salary,
      location: j.location,
      jobUrl: j.jobUrl,
      nextSteps: j.nextSteps,
      notes: j.notes,
      assessmentType: j.assessmentType,
      assessmentNotes: j.assessmentNotes,
    })),
  };
}

async function getSiteStatus() {
  const sites = await prisma.monitoredSite.findMany({
    orderBy: { order: "asc" },
    include: {
      pings: {
        orderBy: { checkedAt: "desc" },
        take: 1,
      },
    },
  });

  // Calculate 24h uptime per site
  const dayAgo = new Date(Date.now() - 86400000);
  const uptimeData = await Promise.all(
    sites.map(async (site) => {
      const [total, up] = await Promise.all([
        prisma.sitePing.count({
          where: { siteId: site.id, checkedAt: { gte: dayAgo } },
        }),
        prisma.sitePing.count({
          where: {
            siteId: site.id,
            checkedAt: { gte: dayAgo },
            isUp: true,
          },
        }),
      ]);
      return { siteId: site.id, uptime: total > 0 ? (up / total) * 100 : 0 };
    })
  );

  const uptimeMap = new Map(uptimeData.map((u) => [u.siteId, u.uptime]));

  return {
    count: sites.length,
    sites: sites.map((s) => ({
      label: s.label,
      url: s.url,
      isUp: s.pings[0]?.isUp ?? null,
      responseTime: s.pings[0]?.responseTime ?? null,
      status: s.pings[0]?.status ?? null,
      lastChecked: s.pings[0]
        ? formatInTimeZone(s.pings[0].checkedAt, TIMEZONE, "h:mm a")
        : null,
      uptime24h: `${(uptimeMap.get(s.id) ?? 0).toFixed(1)}%`,
    })),
  };
}


async function getClaudeMetrics(input: ToolInput) {
  try {
    const { getUsageReport, getCostReport } = await import("@/lib/anthropic");

    const days = input.days ?? 7;
    const endDate = new Date();
    const startDate = new Date(Date.now() - days * 86400000);
    const startStr = startDate.toISOString();
    const endStr = endDate.toISOString();

    const [usage, costs] = await Promise.all([
      getUsageReport(startStr, endStr, {
        bucketWidth: "1d",
        groupBy: ["model"],
      }),
      getCostReport(startStr, endStr, {
        bucketWidth: "1d",
        groupBy: ["description"],
      }),
    ]);

    // Aggregate usage
    let totalInput = 0;
    let totalOutput = 0;
    let totalCacheRead = 0;
    let totalWebSearches = 0;
    for (const bucket of usage.data) {
      for (const r of bucket.results) {
        totalInput += r.uncached_input_tokens;
        totalOutput += r.output_tokens;
        totalCacheRead += r.cache_read_input_tokens;
        totalWebSearches += r.server_tool_use?.web_search_requests ?? 0;
      }
    }

    // Aggregate costs
    let totalCostCents = 0;
    for (const bucket of costs.data) {
      for (const r of bucket.results) {
        totalCostCents += parseFloat(r.amount) || 0;
      }
    }

    return {
      period: `Last ${days} days`,
      totalCost: `$${(totalCostCents / 100).toFixed(2)}`,
      tokens: {
        input: totalInput,
        output: totalOutput,
        cacheRead: totalCacheRead,
        webSearches: totalWebSearches,
      },
      dailyBreakdown: costs.data.map((b) => ({
        date: b.starting_at.split("T")[0],
        cost: `$${(b.results.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0) / 100).toFixed(2)}`,
      })),
    };
  } catch (err) {
    return {
      error:
        err instanceof Error ? err.message : "Failed to fetch Claude metrics",
    };
  }
}

async function getMediaFiles(input: ToolInput) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};
  if (input.source === "diary") {
    where.tags = { has: "diary" };
  } else if (input.source === "task") {
    where.tags = { has: "task" };
  } else if (input.source === "upload") {
    where.NOT = [{ tags: { has: "diary" } }, { tags: { has: "task" } }];
  }

  const files = await prisma.mediaFile.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: input.limit ?? 20,
  });

  return {
    count: files.length,
    files: files.map((f) => ({
      name: f.filename,
      type: f.mimeType,
      sizeKB: Math.round(f.size / 1024),
      isPublic: f.isPublic,
      url: `/api/media/share/${f.shareSlug}`,
      ...(f.mimeType.startsWith("image/")
        ? { imageMarkdown: `![${f.filename}](/api/media/share/${f.shareSlug})` }
        : {}),
      uploadedAt: formatInTimeZone(f.createdAt, TIMEZONE, "yyyy-MM-dd h:mm a"),
      tags: f.tags,
    })),
  };
}

async function getDashboardSummary() {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    0,
    23,
    59,
    59
  );

  const [taskCounts, monthShifts, activeJobs, recentDiary, siteUptime] =
    await Promise.all([
      // Task counts by status
      Promise.all([
        prisma.task.count({ where: { status: "TODO" } }),
        prisma.task.count({ where: { status: "IN_PROGRESS" } }),
        prisma.task.count({ where: { status: "DONE" } }),
      ]),
      // Shifts this month
      prisma.shift.findMany({
        where: { date: { gte: monthStart, lte: monthEnd } },
      }),
      // Active job applications
      prisma.jobApplication.count({
        where: { status: { notIn: ["REJECTED", "WITHDRAWN"] } },
      }),
      // Recent diary entries
      prisma.diaryEntry.findMany({
        orderBy: { date: "desc" },
        take: 5,
        select: { date: true, mood: true, tags: true, content: true },
      }),
      // Site uptime (last 24h)
      Promise.all([
        prisma.sitePing.count({
          where: { checkedAt: { gte: new Date(Date.now() - 86400000) } },
        }),
        prisma.sitePing.count({
          where: {
            checkedAt: { gte: new Date(Date.now() - 86400000) },
            isUp: true,
          },
        }),
      ]),
    ]);

  const totalHours = monthShifts.reduce((s, sh) => s + sh.hours, 0);
  const totalNet = monthShifts.reduce((s, sh) => s + sh.netPay, 0);
  const [totalPings, upPings] = siteUptime;

  return {
    tasks: {
      todo: taskCounts[0],
      inProgress: taskCounts[1],
      done: taskCounts[2],
    },
    shiftsThisMonth: {
      count: monthShifts.length,
      totalHours: Math.round(totalHours * 100) / 100,
      totalNetPay: Math.round(totalNet * 100) / 100,
    },
    activeJobApplications: activeJobs,
    recentDiary: recentDiary.map((d) => ({
      date: formatInTimeZone(d.date, TIMEZONE, "yyyy-MM-dd"),
      mood: d.mood,
      tags: d.tags,
      contentPreview: d.content ? d.content.slice(0, 300) : null,
    })),
    siteUptime24h:
      totalPings > 0
        ? `${((upPings / totalPings) * 100).toFixed(1)}%`
        : "No data",
    currentMonth: formatInTimeZone(now, TIMEZONE, "MMMM yyyy"),
  };
}

async function getContacts(input: ToolInput) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};

  if (input.tag) {
    where.tags = { has: input.tag };
  }

  if (input.query) {
    const q = input.query.trim();
    const noSpaces = q.replace(/\s+/g, "");
    const words = q.split(/\s+/).filter((w) => w.length > 1);

    // Build fuzzy OR conditions: exact query, no-spaces variant, and each word
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const orConditions: any[] = [
      { name: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
      { phone: { contains: q } },
      { company: { contains: q, mode: "insensitive" } },
    ];

    // Also search without spaces (catches "sam lee" -> "samlee@example.com")
    if (noSpaces !== q) {
      orConditions.push(
        { name: { contains: noSpaces, mode: "insensitive" } },
        { email: { contains: noSpaces, mode: "insensitive" } },
      );
    }

    // Also search each word individually for broader matches
    for (const word of words) {
      if (word !== q && word !== noSpaces) {
        orConditions.push(
          { name: { contains: word, mode: "insensitive" } },
          { email: { contains: word, mode: "insensitive" } },
        );
      }
    }

    where.OR = orConditions;
  }

  const contacts = await prisma.contact.findMany({
    where,
    orderBy: { name: "asc" },
    take: input.limit ?? 30,
  });

  return {
    count: contacts.length,
    contacts: contacts.map((c) => ({
      id: c.id,
      name: c.name,
      email: c.email,
      phone: c.phone,
      company: c.company,
      title: c.title,
      tags: c.tags,
      notes: c.notes,
      photoUrl: c.photoUrl,
      googleContactId: c.googleContactId,
      lastSyncedAt: c.lastSyncedAt
        ? formatInTimeZone(c.lastSyncedAt, TIMEZONE, "yyyy-MM-dd h:mm a")
        : null,
      createdAt: formatInTimeZone(c.createdAt, TIMEZONE, "yyyy-MM-dd"),
    })),
  };
}

async function updateContact(input: ToolInput) {
  // Find by ID or name
  let contact;
  if (input.contact_id) {
    contact = await prisma.contact.findUnique({
      where: { id: input.contact_id },
    });
  } else if (input.contact_name) {
    contact = await prisma.contact.findFirst({
      where: { name: { contains: input.contact_name, mode: "insensitive" } },
    });
  } else {
    return { error: "Either contact_id or contact_name is required" };
  }

  if (!contact) {
    return {
      error: `No contact found matching ${input.contact_id ? `ID "${input.contact_id}"` : `name "${input.contact_name}"`}`,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = {};
  if (input.new_name) data.name = input.new_name;
  if (input.new_email) data.email = input.new_email;
  if (input.new_phone) data.phone = input.new_phone;
  if (input.new_company) data.company = input.new_company;
  if (input.new_title) data.title = input.new_title;
  if (input.new_tags) {
    data.tags = input.new_tags.split(",").map((t) => t.trim().toLowerCase());
  }
  if (input.new_notes) {
    if (input.new_notes.startsWith("APPEND: ")) {
      const append = input.new_notes.slice(8);
      data.notes = contact.notes ? `${contact.notes}\n${append}` : append;
    } else {
      data.notes = input.new_notes;
    }
  }

  if (Object.keys(data).length === 0) {
    return { error: "No fields to update" };
  }

  const updated = await prisma.contact.update({
    where: { id: contact.id },
    data,
  });

  return {
    success: true,
    contact: {
      id: updated.id,
      name: updated.name,
      email: updated.email,
      phone: updated.phone,
      company: updated.company,
      title: updated.title,
      tags: updated.tags,
      notes: updated.notes,
    },
  };
}

async function getImportant(input: ToolInput) {
  // Get specific topic by ID
  if (input.topic_id) {
    const topic = await prisma.importantTopic.findUnique({
      where: { id: input.topic_id },
      include: { items: { orderBy: { order: "asc" } } },
    });
    if (!topic) return { error: `Topic not found: ${input.topic_id}` };

    // Enrich items with media data
    const mediaIds = topic.items.filter((i) => i.mediaId).map((i) => i.mediaId!);
    const mediaFiles = mediaIds.length > 0
      ? await prisma.mediaFile.findMany({ where: { id: { in: mediaIds } } })
      : [];
    const mediaMap = new Map(mediaFiles.map((m) => [m.id, m]));

    return {
      topic: {
        id: topic.id,
        title: topic.title,
        icon: topic.icon,
        category: topic.category,
        pinned: topic.pinned,
        items: topic.items.map((i) => {
          const media = i.mediaId ? mediaMap.get(i.mediaId) : null;
          return {
            id: i.id,
            type: i.type,
            label: i.label,
            url: i.url,
            content: i.content ? i.content.slice(0, 1000) : null,
            pinned: i.pinned,
            ...(media ? {
              media: {
                filename: media.filename,
                mimeType: media.mimeType,
                size: media.size,
                url: `/api/media/share/${media.shareSlug}`,
                ...(media.mimeType.startsWith("image/") ? { imageMarkdown: `![${media.filename}](/api/media/share/${media.shareSlug})` } : {}),
              },
            } : {}),
          };
        }),
      },
    };
  }

  // List topics with filters
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};
  if (input.category) where.category = input.category;
  if (input.query) {
    const q = input.query;
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { items: { some: { label: { contains: q, mode: "insensitive" } } } },
      { items: { some: { content: { contains: q, mode: "insensitive" } } } },
      { items: { some: { url: { contains: q, mode: "insensitive" } } } },
    ];
  }

  const topics = await prisma.importantTopic.findMany({
    where,
    orderBy: [{ pinned: "desc" }, { order: "asc" }],
    include: { _count: { select: { items: true } }, items: { orderBy: { order: "asc" } } },
    take: 50,
  });

  return {
    count: topics.length,
    topics: topics.map((t) => ({
      id: t.id,
      title: t.title,
      icon: t.icon,
      category: t.category,
      pinned: t.pinned,
      itemCount: t._count.items,
      items: t.items.map((i) => ({
        type: i.type,
        label: i.label,
        url: i.url,
        content: i.content ? i.content.slice(0, 200) : null,
      })),
    })),
  };
}

async function addImportant(input: ToolInput) {
  // Add item to existing topic
  if (input.topic_id) {
    if (!input.item_type) {
      return { error: "item_type is required when adding to a topic" };
    }
    const topic = await prisma.importantTopic.findUnique({ where: { id: input.topic_id } });
    if (!topic) return { error: `Topic not found: ${input.topic_id}` };

    const maxOrder = await prisma.importantItem.aggregate({
      where: { topicId: input.topic_id },
      _max: { order: true },
    });

    const item = await prisma.importantItem.create({
      data: {
        topicId: input.topic_id,
        type: input.item_type,
        label: input.label || null,
        url: input.url || null,
        content: input.content || null,
        mediaId: input.media_id || null,
        order: (maxOrder._max.order ?? -1) + 1,
      },
    });

    return {
      success: true,
      item: { id: item.id, type: item.type, label: item.label, topicTitle: topic.title },
    };
  }

  // Create new topic
  if (!input.topic_title) {
    return { error: "topic_title is required when creating a new topic" };
  }

  const maxOrder = await prisma.importantTopic.aggregate({ _max: { order: true } });
  const topic = await prisma.importantTopic.create({
    data: {
      title: input.topic_title,
      category: input.topic_category || null,
      icon: input.topic_icon || null,
      order: (maxOrder._max.order ?? -1) + 1,
    },
  });

  // Optionally add first item
  if (input.item_type) {
    await prisma.importantItem.create({
      data: {
        topicId: topic.id,
        type: input.item_type,
        label: input.label || null,
        url: input.url || null,
        content: input.content || null,
        mediaId: input.media_id || null,
        order: 0,
      },
    });
  }

  return {
    success: true,
    topic: { id: topic.id, title: topic.title, category: topic.category, icon: topic.icon },
  };
}

async function updateImportant(input: ToolInput) {
  if (!input.topic_id) {
    return { error: "topic_id is required" };
  }

  const topic = await prisma.importantTopic.findUnique({ where: { id: input.topic_id } });
  if (!topic) return { error: `Topic not found: ${input.topic_id}` };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = {};
  if (input.new_title) data.title = input.new_title;
  if (input.new_category) data.category = input.new_category;
  if (input.new_icon) data.icon = input.new_icon;
  if (input.pinned !== undefined) data.pinned = input.pinned;

  if (Object.keys(data).length === 0) {
    return { error: "No fields to update" };
  }

  const updated = await prisma.importantTopic.update({
    where: { id: input.topic_id },
    data,
  });

  return {
    success: true,
    topic: { id: updated.id, title: updated.title, category: updated.category, icon: updated.icon, pinned: updated.pinned },
  };
}

async function deleteImportant(input: ToolInput) {
  // Delete a single item
  if (input.item_id) {
    const item = await prisma.importantItem.findUnique({
      where: { id: input.item_id },
      include: { topic: { select: { title: true } } },
    });
    if (!item) return { error: `Item not found: ${input.item_id}` };

    await prisma.importantItem.delete({ where: { id: input.item_id } });
    return {
      success: true,
      deleted: "item",
      item: { id: item.id, type: item.type, label: item.label, topicTitle: item.topic.title },
    };
  }

  // Delete entire topic
  if (input.topic_id) {
    const topic = await prisma.importantTopic.findUnique({
      where: { id: input.topic_id },
      include: { _count: { select: { items: true } } },
    });
    if (!topic) return { error: `Topic not found: ${input.topic_id}` };

    await prisma.importantTopic.delete({ where: { id: input.topic_id } });
    return {
      success: true,
      deleted: "topic",
      topic: { id: topic.id, title: topic.title, itemsDeleted: topic._count.items },
    };
  }

  return { error: "Either topic_id or item_id is required" };
}

async function getTennisEquipment(input: ToolInput) {
  if (input.racket_id) {
    const racket = await prisma.tennisRacket.findUnique({
      where: { id: input.racket_id },
      include: {
        restrings: { orderBy: { date: "desc" }, take: 10 },
        sessions: { orderBy: { date: "desc" }, take: 5, select: { id: true, type: true, date: true } },
      },
    });
    if (!racket) return { error: `Racket not found: ${input.racket_id}` };

    const daysSinceStrung = racket.lastStrung
      ? Math.floor((Date.now() - racket.lastStrung.getTime()) / (1000 * 60 * 60 * 24))
      : null;

    return {
      racket: {
        id: racket.id,
        name: racket.name,
        brand: racket.brand,
        model: racket.model,
        headSize: racket.headSize,
        weight: racket.weight,
        pattern: racket.pattern,
        balance: racket.balance,
        swingWeight: racket.swingWeight,
        currentString: racket.currentString,
        tension: racket.tension,
        lastStrung: racket.lastStrung ? formatInTimeZone(racket.lastStrung, TIMEZONE, "yyyy-MM-dd") : null,
        daysSinceStrung,
        notes: racket.notes,
        restrings: racket.restrings.map((r) => ({
          date: formatInTimeZone(r.date, TIMEZONE, "yyyy-MM-dd"),
          stringName: r.stringName,
          tension: r.tension,
          crossStringName: r.crossStringName,
          crossTension: r.crossTension,
          isHybrid: !!r.crossStringName,
          notes: r.notes,
        })),
        recentSessions: racket.sessions.map((s) => ({
          type: s.type,
          date: formatInTimeZone(s.date, TIMEZONE, "yyyy-MM-dd"),
        })),
      },
    };
  }

  const rackets = await prisma.tennisRacket.findMany({
    orderBy: { order: "asc" },
  });

  const strings = await prisma.stringInventory.findMany({
    orderBy: { name: "asc" },
    include: { photos: true },
  });

  return {
    rackets: rackets.map((r) => {
      const daysSinceStrung = r.lastStrung
        ? Math.floor((Date.now() - r.lastStrung.getTime()) / (1000 * 60 * 60 * 24))
        : null;
      return {
        id: r.id,
        name: r.name,
        brand: r.brand,
        model: r.model,
        currentString: r.currentString,
        tension: r.tension,
        daysSinceStrung,
      };
    }),
    stringInventory: strings.map((s) => ({
      id: s.id,
      name: s.name,
      type: s.type,
      gauge: s.gauge,
      quantity: s.quantity,
      photos: s.photos.length,
    })),
  };
}

async function getTennisSessions(input: ToolInput) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};
  if (input.type) where.type = input.type;
  if (input.from || input.to) {
    where.date = {};
    if (input.from) where.date.gte = new Date(input.from);
    if (input.to) where.date.lte = new Date(input.to + "T23:59:59");
  }

  const sessions = await prisma.tennisSession.findMany({
    where,
    orderBy: { date: "desc" },
    take: input.limit ?? 20,
    include: { racket: { select: { name: true } } },
  });

  const totalHours = sessions.reduce((s, sess) => s + (sess.duration ?? 0), 0);
  const totalCost = sessions
    .filter((s) => s.type === "lesson")
    .reduce((sum, s) => sum + (s.cost ?? 0), 0);

  return {
    count: sessions.length,
    totalHours: Math.round(totalHours * 10) / 10,
    totalLessonCost: totalCost,
    sessions: sessions.map((s) => ({
      id: s.id,
      type: s.type,
      date: formatInTimeZone(s.date, TIMEZONE, "yyyy-MM-dd (EEE)"),
      duration: s.duration,
      location: s.location,
      racket: s.racket?.name ?? null,
      tags: s.tags,
      notes: s.notes,
      cost: s.cost,
      coach: s.coach,
      playedWith: s.playedWith,
      calendarEvent: s.calendarEventTitle,
    })),
  };
}

async function getTennisRatings() {
  const activeStage = await prisma.tennisStage.findFirst({
    where: { isActive: true },
    include: { ratings: { orderBy: { date: "desc" }, take: 50 } },
  });

  if (!activeStage) {
    return { stage: null, message: "No active stage. Visit the Progress tab to initialize." };
  }

  const strokeKeys = ["forehand", "bhTopspin", "bhSlice", "serve", "volley", "overhead", "returnOf"] as const;

  // Latest per rater
  const latestByRater: Record<string, Record<string, number | string>> = {};
  const seen = new Set<string>();
  for (const r of activeStage.ratings) {
    if (!seen.has(r.ratedBy)) {
      seen.add(r.ratedBy);
      const entry: Record<string, number | string> = { date: formatInTimeZone(r.date, TIMEZONE, "yyyy-MM-dd") };
      for (const k of strokeKeys) entry[k] = r[k];
      latestByRater[r.ratedBy] = entry;
    }
  }

  // Average
  const averages: Record<string, number> = {};
  for (const k of strokeKeys) {
    const vals = Object.values(latestByRater).map((r) => r[k] as number);
    averages[k] = vals.length > 0 ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 2) / 2 : 0;
  }

  // Can advance (self ratings at 9.0+)
  const selfLatest = latestByRater["self"];
  const canAdvance = selfLatest ? strokeKeys.every((k) => (selfLatest[k] as number) >= 9.0) : false;

  return {
    stage: {
      number: activeStage.stageNumber,
      label: activeStage.stageLabel,
      utrRange: activeStage.utrRange,
      startedAt: formatInTimeZone(activeStage.startedAt, TIMEZONE, "yyyy-MM-dd"),
    },
    latestByRater,
    averageRatings: averages,
    canAdvance,
    raters: Object.keys(latestByRater),
  };
}

async function getTennisNotes(input: ToolInput) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};
  if (input.tag) where.tags = { has: input.tag };
  if (input.query) where.content = { contains: input.query, mode: "insensitive" };

  const notes = await prisma.tennisNote.findMany({
    where,
    orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
    take: 30,
  });

  return {
    count: notes.length,
    notes: notes.map((n) => ({
      id: n.id,
      content: n.content,
      tags: n.tags,
      pinned: n.pinned,
      updatedAt: formatInTimeZone(n.updatedAt, TIMEZONE, "yyyy-MM-dd"),
    })),
  };
}

async function logTennisSession(input: ToolInput) {
  if (!input.type) return { error: "type is required (practice, lesson, match)" };

  const dateStr = input.date || formatInTimeZone(new Date(), TIMEZONE, "yyyy-MM-dd");

  // Find racket by name if provided
  let racketId: string | null = null;
  if (input.racket_name) {
    const racket = await prisma.tennisRacket.findFirst({
      where: { name: { contains: input.racket_name, mode: "insensitive" } },
    });
    if (racket) racketId = racket.id;
  }

  const tags = input.tags
    ? input.tags.split(",").map((t) => t.trim().toLowerCase())
    : [];

  const session = await prisma.tennisSession.create({
    data: {
      type: input.type,
      date: new Date(dateStr),
      duration: input.duration ?? null,
      location: input.location ?? null,
      racketId,
      tags,
      notes: input.notes ?? null,
      cost: input.cost ?? null,
      coach: input.coach ?? null,
      playedWith: input.played_with ?? null,
    },
  });

  return {
    success: true,
    session: {
      id: session.id,
      type: session.type,
      date: dateStr,
      duration: session.duration,
      location: session.location,
      tags: session.tags,
      playedWith: session.playedWith,
    },
  };
}

async function rateTennisStrokes(input: ToolInput) {
  const ratedBy = input.rated_by || "claude";

  const strokeMap = {
    forehand: input.forehand,
    bhTopspin: input.bh_topspin,
    bhSlice: input.bh_slice,
    serve: input.serve,
    volley: input.volley,
    overhead: input.overhead,
    returnOf: input.return_of,
  };

  // Validate all strokes present
  for (const [key, val] of Object.entries(strokeMap)) {
    if (val === undefined || val === null) {
      return { error: `Missing required stroke: ${key}` };
    }
    if (typeof val !== "number" || val < 1 || val > 10) {
      return { error: `${key} must be between 1 and 10` };
    }
  }

  // Find active stage
  let activeStage = await prisma.tennisStage.findFirst({ where: { isActive: true } });
  if (!activeStage) {
    activeStage = await prisma.tennisStage.create({
      data: { stageNumber: 1, stageLabel: "Beginner", utrRange: "1.0 - 3.0", isActive: true },
    });
  }

  const rating = await prisma.tennisRating.create({
    data: {
      stageId: activeStage.id,
      ratedBy,
      forehand: strokeMap.forehand!,
      bhTopspin: strokeMap.bhTopspin!,
      bhSlice: strokeMap.bhSlice!,
      serve: strokeMap.serve!,
      volley: strokeMap.volley!,
      overhead: strokeMap.overhead!,
      returnOf: strokeMap.returnOf!,
      notes: input.notes ?? null,
      sessionId: input.session_id ?? null,
    },
  });

  return {
    success: true,
    ratingId: rating.id,
    ratedBy,
    stage: `Stage ${activeStage.stageNumber}: ${activeStage.stageLabel}`,
    ratings: strokeMap,
  };
}

async function advanceTennisStage() {
  const activeStage = await prisma.tennisStage.findFirst({
    where: { isActive: true },
    include: { ratings: true },
  });

  if (!activeStage) return { error: "No active stage found" };
  if (activeStage.stageNumber >= 6) return { error: "Already at highest stage (Competitive)" };

  // Check self ratings
  const strokeKeys = ["forehand", "bhTopspin", "bhSlice", "serve", "volley", "overhead", "returnOf"] as const;
  const selfRatings = activeStage.ratings.filter((r) => r.ratedBy === "self");
  if (selfRatings.length === 0) return { error: "No self ratings found" };

  const latest = selfRatings.sort((a, b) => b.date.getTime() - a.date.getTime())[0]!;
  const belowThreshold = strokeKeys.filter((k) => latest[k] < 9.0);
  if (belowThreshold.length > 0) {
    return { error: `These strokes are below 9.0: ${belowThreshold.join(", ")}` };
  }

  const stageLabels = ["Beginner", "Intermediate", "High Intermediate", "Advanced", "Elite", "Competitive"];
  const utrRanges = ["1.0 - 3.0", "3.0 - 5.0", "5.0 - 7.0", "7.0 - 9.0", "9.0 - 11.0", "11.0 - 13.0"];
  const nextNum = activeStage.stageNumber + 1;

  await prisma.$transaction([
    prisma.tennisStage.update({
      where: { id: activeStage.id },
      data: { isActive: false, completedAt: new Date() },
    }),
    prisma.tennisStage.create({
      data: {
        stageNumber: nextNum,
        stageLabel: stageLabels[nextNum - 1] || "Unknown",
        utrRange: utrRanges[nextNum - 1] || "?",
        isActive: true,
      },
    }),
  ]);

  return {
    success: true,
    previousStage: `Stage ${activeStage.stageNumber}: ${activeStage.stageLabel}`,
    newStage: `Stage ${nextNum}: ${stageLabels[nextNum - 1]}`,
  };
}

async function logRestring(input: ToolInput) {
  if (!input.racket_name) return { error: "racket_name is required" };
  if (!input.string_name) return { error: "string_name is required" };

  const racket = await prisma.tennisRacket.findFirst({
    where: { name: { contains: input.racket_name, mode: "insensitive" } },
  });
  if (!racket) return { error: `No racket found matching "${input.racket_name}"` };

  const dateStr = input.date || formatInTimeZone(new Date(), TIMEZONE, "yyyy-MM-dd");
  const isHybrid = !!input.cross_string_name;

  // Detect string types from inventory
  const mainsInventory = await prisma.stringInventory.findFirst({
    where: { name: { contains: input.string_name, mode: "insensitive" } },
  });

  let crossInventory = null;
  if (isHybrid) {
    crossInventory = await prisma.stringInventory.findFirst({
      where: { name: { contains: input.cross_string_name, mode: "insensitive" } },
    });
  }

  // Build display strings
  const displayString = isHybrid
    ? `${input.string_name} / ${input.cross_string_name}`
    : input.string_name;
  const displayTension = isHybrid && input.cross_tension
    ? `${input.tension ?? "?"} / ${input.cross_tension}`
    : input.tension ?? "Unknown";

  const restring = await prisma.restring.create({
    data: {
      racketId: racket.id,
      stringName: input.string_name,
      stringType: mainsInventory?.type ?? null,
      tension: input.tension ?? "Unknown",
      crossStringName: isHybrid ? input.cross_string_name : null,
      crossStringType: isHybrid ? (crossInventory?.type ?? null) : null,
      crossTension: isHybrid ? (input.cross_tension ?? null) : null,
      date: new Date(dateStr),
      notes: input.notes ?? null,
    },
  });

  // Update racket's current string info
  await prisma.tennisRacket.update({
    where: { id: racket.id },
    data: {
      currentString: displayString,
      tension: displayTension,
      lastStrung: new Date(dateStr),
    },
  });

  // Auto-decrement mains inventory
  const inventoryUpdates: string[] = [];
  if (mainsInventory && mainsInventory.quantity > 0) {
    await prisma.stringInventory.update({
      where: { id: mainsInventory.id },
      data: { quantity: { decrement: 1 } },
    });
    inventoryUpdates.push(`${mainsInventory.name}: ${mainsInventory.quantity} → ${mainsInventory.quantity - 1}`);
  }

  // Auto-decrement cross inventory if hybrid and different string
  if (isHybrid && crossInventory && crossInventory.quantity > 0 &&
      crossInventory.id !== mainsInventory?.id) {
    await prisma.stringInventory.update({
      where: { id: crossInventory.id },
      data: { quantity: { decrement: 1 } },
    });
    inventoryUpdates.push(`${crossInventory.name}: ${crossInventory.quantity} → ${crossInventory.quantity - 1}`);
  }

  return {
    success: true,
    restring: {
      id: restring.id,
      racket: racket.name,
      mainsString: input.string_name,
      mainsTension: input.tension,
      crossString: isHybrid ? input.cross_string_name : null,
      crossTension: isHybrid ? input.cross_tension : null,
      isHybrid,
      date: dateStr,
      inventoryUpdated: inventoryUpdates.length > 0 ? inventoryUpdates : null,
    },
  };
}

async function updateRacket(input: ToolInput) {
  if (!input.racket_name) return { error: "racket_name is required" };

  const racket = await prisma.tennisRacket.findFirst({
    where: { name: { contains: input.racket_name, mode: "insensitive" } },
  });
  if (!racket) return { error: `No racket found matching "${input.racket_name}"` };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = {};
  if (input.new_name) data.name = input.new_name;
  if (input.brand) data.brand = input.brand;
  if (input.model) data.model = input.model;
  if (input.head_size !== undefined) data.headSize = input.head_size;
  if (input.weight !== undefined) data.weight = input.weight;
  if (input.pattern) data.pattern = input.pattern;
  if (input.balance !== undefined) data.balance = input.balance;
  if (input.swing_weight !== undefined) data.swingWeight = input.swing_weight;
  if (input.current_string) data.currentString = input.current_string;
  if (input.tension) data.tension = input.tension;
  if (input.notes !== undefined) data.notes = input.notes;

  if (Object.keys(data).length === 0) return { error: "No fields to update" };

  const updated = await prisma.tennisRacket.update({
    where: { id: racket.id },
    data,
  });

  return {
    success: true,
    racket: updated.name,
    updated: Object.keys(data),
  };
}

async function addRacket(input: ToolInput) {
  if (!input.name) return { error: "name is required" };
  if (!input.brand) return { error: "brand is required" };
  if (!input.model) return { error: "model is required" };

  const racket = await prisma.tennisRacket.create({
    data: {
      name: input.name,
      brand: input.brand,
      model: input.model,
      headSize: input.head_size ?? null,
      weight: input.weight ?? null,
      pattern: input.pattern ?? null,
      balance: input.balance ?? null,
      swingWeight: input.swing_weight ?? null,
      currentString: input.current_string ?? null,
      tension: input.tension ?? null,
      notes: input.notes ?? null,
    },
  });

  return {
    success: true,
    racket: { id: racket.id, name: racket.name, brand: racket.brand, model: racket.model },
  };
}

async function addTennisNote(input: ToolInput) {
  if (!input.content) return { error: "content is required" };

  const note = await prisma.tennisNote.create({
    data: {
      content: input.content,
      tags: input.tag ? [input.tag] : ["other"],
    },
  });

  return {
    success: true,
    note: { id: note.id, content: note.content, tags: note.tags },
  };
}

async function manageStringInventory(input: ToolInput) {
  if (!input.name) return { error: "name is required" };
  const action = input.action ?? "add";

  if (action === "update") {
    const existing = await prisma.stringInventory.findFirst({
      where: { name: { contains: input.name, mode: "insensitive" } },
    });
    if (!existing) return { error: `No string found matching "${input.name}"` };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = {};
    if (input.quantity !== undefined) data.quantity = input.quantity;
    if (input.type) data.type = input.type;
    if (input.gauge) data.gauge = input.gauge;
    if (input.notes !== undefined) data.notes = input.notes;

    if (Object.keys(data).length === 0) return { error: "No fields to update" };

    const updated = await prisma.stringInventory.update({
      where: { id: existing.id },
      data,
    });

    return {
      success: true,
      string: { name: updated.name, quantity: updated.quantity, type: updated.type, gauge: updated.gauge },
    };
  }

  // action === "add"
  const created = await prisma.stringInventory.create({
    data: {
      name: input.name,
      type: input.type ?? "poly",
      gauge: input.gauge ?? null,
      quantity: input.quantity ?? 1,
      notes: input.notes ?? null,
    },
  });

  return {
    success: true,
    string: { id: created.id, name: created.name, type: created.type, quantity: created.quantity },
  };
}

