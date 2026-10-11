"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Calendar,
  CheckSquare,
  Clock,
  BookHeart,
  Users,
  Star,
  CircleDot,
  MessageCircle,
  Globe,
  Download,
  Mail,
  Menu,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useNavPreference } from "@/hooks/useNavPreference";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { SITE } from "@/config/site";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/calendar", label: "Calendar", icon: Calendar },
  { href: "/dashboard/tasks", label: "Tasks", icon: CheckSquare },
  { href: "/dashboard/shifts", label: "Shifts", icon: Clock },
  { href: "/dashboard/diary", label: "Diary", icon: BookHeart },
  { href: "/dashboard/contacts", label: "Contacts", icon: Users },
  { href: "/dashboard/important", label: "Important", icon: Star },
  { href: "/dashboard/tennis", label: "Tennis", icon: CircleDot },
  { href: "/dashboard/chat", label: "Chat", icon: MessageCircle },
  { href: "/dashboard/sites", label: "Sites", icon: Globe },
  { href: "/dashboard/emails", label: "Emails", icon: Mail },
  { href: "/dashboard/backup", label: "Backup", icon: Download },
];

export function MobileNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { navMode } = useNavPreference();

  if (navMode === "bottom") return null;

  return (
    <div className="lg:hidden">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen(true)}
        className="h-8 w-8 text-muted-foreground"
      >
        <Menu className="h-5 w-5" />
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-72 p-0">
          <SheetHeader className="border-b border-border px-4 py-4">
            <div className="flex items-center gap-2.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logo.png"
                alt="Logo"
                width={32}
                height={32}
                className="rounded-lg"
              />
              <SheetTitle className="font-heading text-lg font-bold tracking-tight">
                {SITE.appName}
              </SheetTitle>
            </div>
          </SheetHeader>

          <nav className="flex-1 space-y-1 p-3">
            {navItems.map((item) => {
              const isActive =
                item.href === "/dashboard"
                  ? pathname === "/dashboard"
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] font-medium transition-colors",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  )}
                >
                  <item.icon className="h-[18px] w-[18px] shrink-0" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </SheetContent>
      </Sheet>
    </div>
  );
}
