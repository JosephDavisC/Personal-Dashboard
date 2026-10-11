"use client";

import { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EquipmentTab } from "./EquipmentTab";
import { ProgressTab } from "./ProgressTab";
import { SessionsTab } from "./SessionsTab";
import { NotesTab } from "./NotesTab";
import { SessionForm } from "./SessionForm";

const TABS = [
  { key: "equipment", label: "Equipment" },
  { key: "progress", label: "Progress" },
  { key: "sessions", label: "Sessions" },
  { key: "notes", label: "Notes" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export function TennisTracker() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tabParam = searchParams.get("tab") as TabKey | null;
  const activeTab = TABS.find((t) => t.key === tabParam)?.key ?? "equipment";
  const [sessionFormOpen, setSessionFormOpen] = useState(false);

  function setTab(key: TabKey) {
    router.push(`/dashboard/tennis?tab=${key}`, { scroll: false });
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight">Tennis</h1>
          <p className="text-muted-foreground mt-1">Track your equipment, sessions, and progress</p>
        </div>
        <Button onClick={() => setSessionFormOpen(true)} className="gap-1.5 shrink-0">
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Log Session</span>
          <span className="sm:hidden">Log</span>
        </Button>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 rounded-lg border border-border bg-card p-1">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setTab(tab.key)}
            className={`flex-1 rounded-md px-2 sm:px-4 py-2 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${
              activeTab === tab.key
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "equipment" && <EquipmentTab />}
      {activeTab === "progress" && <ProgressTab />}
      {activeTab === "sessions" && <SessionsTab onLogSession={() => setSessionFormOpen(true)} />}
      {activeTab === "notes" && <NotesTab />}

      <SessionForm
        open={sessionFormOpen}
        onOpenChange={setSessionFormOpen}
      />
    </div>
  );
}
