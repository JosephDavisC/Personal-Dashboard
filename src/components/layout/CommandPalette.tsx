"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  LayoutDashboard,
  Calendar,
  CheckSquare,
  Clock,
  Briefcase,
  BookHeart,
  Users,
  MessageCircle,
  Bot,
  Plus,
  Download,
  HardDrive,
  Database,
  Mail,
  Settings,
  Star,
  CircleDot,
} from "lucide-react";
import type { Task } from "@/generated/prisma/client";
import type { Shift } from "@/generated/prisma/client";

interface SearchData {
  tasks: Task[];
  shifts: Shift[];
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [searchData, setSearchData] = useState<SearchData>({
    tasks: [],
    shifts: [],
  });
  const router = useRouter();
  const gPressed = useRef(false);
  const gTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);

  const fetchSearchData = useCallback(async () => {
    const [tasksRes, shiftsRes] = await Promise.allSettled([
      fetch("/api/tasks").then((r) => r.json() as Promise<{ data: Task[] }>),
      fetch("/api/shifts").then((r) => r.json() as Promise<{ data: Shift[] }>),
    ]);

    setSearchData({
      tasks: tasksRes.status === "fulfilled" ? tasksRes.value.data : [],
      shifts: shiftsRes.status === "fulfilled" ? shiftsRes.value.data : [],
    });
  }, []);

  useEffect(() => {
    if (open) {
      fetchSearchData();
    }
  }, [open, fetchSearchData]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((o) => !o);
        return;
      }
      if (isInputFocused()) return;

      if (e.key === "/") {
        e.preventDefault();
        setOpen(true);
        return;
      }

      // "g" prefix for navigation: g+h, g+t, g+c, g+s, g+m
      if (e.key === "g" && !e.metaKey && !e.ctrlKey) {
        gPressed.current = true;
        clearTimeout(gTimeout.current);
        gTimeout.current = setTimeout(() => { gPressed.current = false; }, 500);
        return;
      }

      if (gPressed.current) {
        gPressed.current = false;
        clearTimeout(gTimeout.current);
        const routes: Record<string, string> = {
          h: "/dashboard",
          t: "/dashboard/tasks",
          c: "/dashboard/calendar",
          s: "/dashboard/shifts",
          j: "/dashboard/jobs",
          l: "/dashboard/claude",
          b: "/dashboard/backup",
          f: "/dashboard/media",
          i: "/dashboard/diary",
          o: "/dashboard/contacts",
          p: "/dashboard/important",
          r: "/dashboard/tennis",
          a: "/dashboard/chat",
          x: "/dashboard/database",
          n: "/dashboard/emails",
          e: "/dashboard/settings",
        };
        const route = routes[e.key];
        if (route) {
          e.preventDefault();
          router.push(route);
          return;
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      clearTimeout(gTimeout.current);
    };
  }, [router]);

  function navigate(path: string) {
    router.push(path);
    setOpen(false);
  }

  const activeTasks = searchData.tasks.filter(
    (t) => t.status !== "DONE" && t.status !== "ARCHIVED"
  );
  const recentShifts = searchData.shifts.slice(0, 10);

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search tasks, shifts..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="Navigation">
          <CommandItem onSelect={() => navigate("/dashboard")}>
            <LayoutDashboard className="mr-2 h-4 w-4" />
            Dashboard
          </CommandItem>
          <CommandItem onSelect={() => navigate("/dashboard/calendar")}>
            <Calendar className="mr-2 h-4 w-4" />
            Calendar
          </CommandItem>
          <CommandItem onSelect={() => navigate("/dashboard/tasks")}>
            <CheckSquare className="mr-2 h-4 w-4" />
            Tasks
          </CommandItem>
          <CommandItem onSelect={() => navigate("/dashboard/shifts")}>
            <Clock className="mr-2 h-4 w-4" />
            Shifts
          </CommandItem>
          <CommandItem onSelect={() => navigate("/dashboard/jobs")}>
            <Briefcase className="mr-2 h-4 w-4" />
            Applications
          </CommandItem>
          <CommandItem onSelect={() => navigate("/dashboard/diary")}>
            <BookHeart className="mr-2 h-4 w-4" />
            Diary
          </CommandItem>
          <CommandItem onSelect={() => navigate("/dashboard/contacts")}>
            <Users className="mr-2 h-4 w-4" />
            Contacts
          </CommandItem>
          <CommandItem onSelect={() => navigate("/dashboard/important")}>
            <Star className="mr-2 h-4 w-4" />
            Important
          </CommandItem>
          <CommandItem onSelect={() => navigate("/dashboard/tennis")}>
            <CircleDot className="mr-2 h-4 w-4" />
            Tennis
          </CommandItem>
          <CommandItem onSelect={() => navigate("/dashboard/chat")}>
            <MessageCircle className="mr-2 h-4 w-4" />
            Chat
          </CommandItem>
          <CommandItem onSelect={() => navigate("/dashboard/claude")}>
            <Bot className="mr-2 h-4 w-4" />
            Claude
          </CommandItem>
          <CommandItem onSelect={() => navigate("/dashboard/media")}>
            <HardDrive className="mr-2 h-4 w-4" />
            Media
          </CommandItem>
          <CommandItem onSelect={() => navigate("/dashboard/database")}>
            <Database className="mr-2 h-4 w-4" />
            Database
          </CommandItem>
          <CommandItem onSelect={() => navigate("/dashboard/emails")}>
            <Mail className="mr-2 h-4 w-4" />
            Emails
          </CommandItem>
          <CommandItem onSelect={() => navigate("/dashboard/backup")}>
            <Download className="mr-2 h-4 w-4" />
            Backup
          </CommandItem>
          <CommandItem onSelect={() => navigate("/dashboard/settings")}>
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Quick Actions">
          <CommandItem onSelect={() => navigate("/dashboard/tasks")}>
            <Plus className="mr-2 h-4 w-4" />
            New Task
          </CommandItem>
          <CommandItem onSelect={() => navigate("/dashboard/shifts")}>
            <Plus className="mr-2 h-4 w-4" />
            New Shift
          </CommandItem>
          <CommandItem onSelect={() => navigate("/dashboard/jobs")}>
            <Plus className="mr-2 h-4 w-4" />
            New Application
          </CommandItem>
          <CommandItem onSelect={() => navigate("/dashboard/diary")}>
            <Plus className="mr-2 h-4 w-4" />
            New Diary Entry
          </CommandItem>
          <CommandItem onSelect={() => navigate("/dashboard/tennis?tab=sessions")}>
            <Plus className="mr-2 h-4 w-4" />
            Log Tennis Session
          </CommandItem>
          <CommandItem onSelect={() => navigate("/dashboard/important")}>
            <Plus className="mr-2 h-4 w-4" />
            New Bookmark
          </CommandItem>
        </CommandGroup>

        {activeTasks.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Tasks">
              {activeTasks.map((task) => (
                <CommandItem
                  key={task.id}
                  value={`task ${task.title} ${task.description ?? ""} ${task.category ?? ""}`}
                  onSelect={() => navigate("/dashboard/tasks")}
                >
                  <CheckSquare className="mr-2 h-4 w-4" />
                  <span className="flex-1 truncate">{task.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {task.status === "IN_PROGRESS" ? "In Progress" : "To Do"}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}


        {recentShifts.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Recent Shifts">
              {recentShifts.map((shift) => (
                <CommandItem
                  key={shift.id}
                  value={`shift ${shift.label ?? ""} ${shift.location} ${new Date(shift.date).toLocaleDateString()}`}
                  onSelect={() => navigate("/dashboard/shifts")}
                >
                  <Clock className="mr-2 h-4 w-4" />
                  <span className="flex-1 truncate">
                    {shift.label ?? shift.location} — {new Date(shift.date).toLocaleDateString()}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    ${shift.netPay.toFixed(2)}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}

function isInputFocused() {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  return (
    tag === "input" ||
    tag === "textarea" ||
    tag === "select" ||
    (el as HTMLElement).isContentEditable
  );
}
