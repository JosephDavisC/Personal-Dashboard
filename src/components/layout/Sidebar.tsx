"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Calendar,
  CheckSquare,
  Clock,
  Briefcase,
  BookHeart,
  Users,
  MessageCircle,
  Globe,
  Bot,
  Download,
  HardDrive,
  Database,
  Mail,
  PanelLeftClose,
  PanelLeft,
  Settings,
  ChevronRight,
  Star,
  CircleDot,
  type LucideIcon,
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SITE } from "@/config/site";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

interface NavGroup {
  label: string;
  key: string;
  items: NavItem[];
}

const primaryItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/calendar", label: "Calendar", icon: Calendar },
  { href: "/dashboard/tasks", label: "Tasks", icon: CheckSquare },
  { href: "/dashboard/shifts", label: "Shifts", icon: Clock },
  { href: "/dashboard/jobs", label: "Applications", icon: Briefcase },
  { href: "/dashboard/diary", label: "Diary", icon: BookHeart },
  { href: "/dashboard/contacts", label: "Contacts", icon: Users },
  { href: "/dashboard/important", label: "Important", icon: Star },
  { href: "/dashboard/tennis", label: "Tennis", icon: CircleDot },
  { href: "/dashboard/chat", label: "Chat", icon: MessageCircle },
];

const groups: NavGroup[] = [
  {
    label: "Infrastructure",
    key: "infra",
    items: [
      { href: "/dashboard/sites", label: "Sites", icon: Globe },
      { href: "/dashboard/claude", label: "Claude", icon: Bot },
    ],
  },
  {
    label: "Data",
    key: "data",
    items: [
      { href: "/dashboard/media", label: "Media", icon: HardDrive },
      { href: "/dashboard/database", label: "Database", icon: Database },
      { href: "/dashboard/emails", label: "Emails", icon: Mail },
      { href: "/dashboard/backup", label: "Backup", icon: Download },
    ],
  },
];

const STORAGE_KEY = "sidebar-groups";

function getInitialGroupState(): Record<string, boolean> {
  if (typeof window === "undefined") return { infra: true, data: true };
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored) as Record<string, boolean>;
  } catch {}
  return { infra: true, data: true };
}

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [groupOpen, setGroupOpen] = useState<Record<string, boolean>>(getInitialGroupState);

  // Auto-expand group when active page is inside a collapsed group
  useEffect(() => {
    for (const group of groups) {
      const hasActive = group.items.some((item) => pathname.startsWith(item.href));
      if (hasActive && !groupOpen[group.key]) {
        setGroupOpen((prev) => {
          const next = { ...prev, [group.key]: true };
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
          return next;
        });
      }
    }
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleGroup = useCallback((key: string) => {
    setGroupOpen((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href);

  return (
    <aside
      className={cn(
        "hidden h-screen flex-col border-r border-border bg-sidebar transition-all duration-200 lg:flex",
        collapsed ? "w-16" : "w-60"
      )}
    >
      <div className="flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt="Logo"
            width={32}
            height={32}
            className="rounded-lg"
          />
          {!collapsed && (
            <span className="font-heading text-lg font-bold tracking-tight text-foreground">
              {SITE.appName}
            </span>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCollapsed(!collapsed)}
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
        >
          {collapsed ? (
            <PanelLeft className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </Button>
      </div>

      <Separator className="bg-border" />

      <nav className="flex-1 overflow-y-auto p-3">
        {/* Primary items — always visible */}
        <div className="space-y-1">
          {primaryItems.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              active={isActive(item.href)}
              collapsed={collapsed}
            />
          ))}
        </div>

        {/* Collapsible groups */}
        {groups.map((group) => (
          <div key={group.key} className="mt-4">
            {!collapsed ? (
              <button
                onClick={() => toggleGroup(group.key)}
                className="flex w-full items-center justify-between px-3 py-1.5 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
              >
                <span>{group.label}</span>
                <ChevronRight
                  className={cn(
                    "h-3.5 w-3.5 transition-transform duration-200",
                    groupOpen[group.key] && "rotate-90"
                  )}
                />
              </button>
            ) : (
              <Separator className="my-2 bg-border" />
            )}
            {(collapsed || groupOpen[group.key]) && (
              <div className={cn("space-y-1", !collapsed && "mt-1 pl-1")}>
                {group.items.map((item) => (
                  <NavLink
                    key={item.href}
                    item={item}
                    active={isActive(item.href)}
                    collapsed={collapsed}
                  />
                ))}
              </div>
            )}
          </div>
        ))}

        {/* Settings — always at bottom */}
        <div className="mt-4">
          <Separator className="mb-2 bg-border" />
          <NavLink
            item={{ href: "/dashboard/settings", label: "Settings", icon: Settings }}
            active={pathname === "/dashboard/settings"}
            collapsed={collapsed}
          />
        </div>
      </nav>
    </aside>
  );
}

function NavLink({
  item,
  active,
  collapsed,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
}) {
  return (
    <Link
      href={item.href}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-[15px] font-medium transition-colors",
        active
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-accent hover:text-foreground"
      )}
    >
      <item.icon className="h-[18px] w-[18px] shrink-0" />
      {!collapsed && <span>{item.label}</span>}
    </Link>
  );
}
