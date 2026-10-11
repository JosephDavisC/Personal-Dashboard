"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  Calendar,
  CheckSquare,
  Clock,
  Briefcase,
  BookHeart,
  Users,
  Star,
  CircleDot,
  MessageCircle,
  MoreHorizontal,
  Globe,
  Bot,
  Download,
  HardDrive,
  Database,
  Mail,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useNavPreference } from "@/hooks/useNavPreference";

const primaryItems = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/dashboard/calendar", label: "Calendar", icon: Calendar },
  { href: "/dashboard/tasks", label: "Tasks", icon: CheckSquare },
  { href: "/dashboard/shifts", label: "Shifts", icon: Clock },
];

const moreItems = [
  { href: "/dashboard/jobs", label: "Applications", icon: Briefcase },
  { href: "/dashboard/diary", label: "Diary", icon: BookHeart },
  { href: "/dashboard/contacts", label: "Contacts", icon: Users },
  { href: "/dashboard/important", label: "Important", icon: Star },
  { href: "/dashboard/tennis", label: "Tennis", icon: CircleDot },
  { href: "/dashboard/chat", label: "Chat", icon: MessageCircle },
  { href: "/dashboard/sites", label: "Sites", icon: Globe },
  { href: "/dashboard/claude", label: "Claude", icon: Bot },
  { href: "/dashboard/media", label: "Media", icon: HardDrive },
  { href: "/dashboard/database", label: "Database", icon: Database },
  { href: "/dashboard/emails", label: "Emails", icon: Mail },
  { href: "/dashboard/backup", label: "Backup", icon: Download },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

export function BottomNav() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const { navMode } = useNavPreference();

  if (navMode !== "bottom") return null;

  const isMoreActive = moreItems.some((item) =>
    pathname.startsWith(item.href)
  );

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-sidebar/95 backdrop-blur-sm lg:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
        <div className="flex items-center justify-around pb-1 pt-1">
          {primaryItems.map((item) => {
            const isActive =
              item.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-0.5 px-3 py-2 text-[10px] font-medium transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}
              >
                <item.icon className="h-5 w-5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
          <button
            onClick={() => setMoreOpen(true)}
            className={cn(
              "flex flex-col items-center gap-0.5 px-3 py-2 text-[10px] font-medium transition-colors",
              isMoreActive ? "text-primary" : "text-muted-foreground"
            )}
          >
            <MoreHorizontal className="h-5 w-5" />
            <span>More</span>
          </button>
        </div>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
          <SheetHeader className="pb-2">
            <SheetTitle>More</SheetTitle>
          </SheetHeader>
          <nav className="grid grid-cols-3 gap-2 py-2">
            {moreItems.map((item) => {
              const isActive = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMoreOpen(false)}
                  className={cn(
                    "flex flex-col items-center gap-1.5 rounded-xl p-4 text-xs font-medium transition-colors",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-accent"
                  )}
                >
                  <item.icon className="h-6 w-6" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </SheetContent>
      </Sheet>
    </>
  );
}
