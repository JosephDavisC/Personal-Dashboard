"use client";

import { useState, useEffect, useRef } from "react";
import { format, formatDistanceToNow } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { VisuallyHidden } from "radix-ui";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Building2,
  CalendarIcon,
  ChevronDown,
  ClipboardCheck,
  Clock,
  ExternalLink,
  MapPin,
  StickyNote,
  X,
  DollarSign,
  ListChecks,
  BellRing,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  APPLICATION_STATUS_LABELS,
  APPLICATION_STATUS_COLORS,
  WORK_LOCATION_LABELS,
  WORK_LOCATION_COLORS,
  ASSESSMENT_TYPE_LABELS,
  ASSESSMENT_TYPE_COLORS,
} from "@/lib/constants";
import type { JobApplication } from "@/generated/prisma/client";

const STATUS_OPTIONS = Object.entries(APPLICATION_STATUS_LABELS).map(
  ([value, label]) => ({ value, label })
);

const LOCATION_OPTIONS = [
  { value: "", label: "Not specified" },
  ...Object.entries(WORK_LOCATION_LABELS).map(([value, label]) => ({
    value,
    label,
  })),
];

const ASSESSMENT_OPTIONS = Object.entries(ASSESSMENT_TYPE_LABELS).map(
  ([value, label]) => ({ value, label })
);

interface JobHistoryEntry {
  id: string;
  fromStatus: string | null;
  toStatus: string;
  note: string | null;
  createdAt: string;
}

export interface JobFormData {
  title: string;
  company: string;
  status: string;
  dateApplied: string;
  followUpDate?: string | null;
  nextSteps?: string | null;
  salary?: string | null;
  location?: string | null;
  jobUrl?: string | null;
  notes?: string | null;
  assessmentType?: string;
  assessmentNotes?: string | null;
}

interface JobFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  job: JobApplication | null;
  onSubmit: (data: JobFormData) => void;
}

export function JobForm({ open, onOpenChange, job, onSubmit }: JobFormProps) {
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [status, setStatus] = useState("APPLIED");
  const [dateApplied, setDateApplied] = useState<Date | undefined>(new Date());
  const [nextSteps, setNextSteps] = useState("");
  const [salary, setSalary] = useState("");
  const [location, setLocation] = useState("");
  const [jobUrl, setJobUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [followUpDate, setFollowUpDate] = useState<Date | undefined>(undefined);
  const [assessmentType, setAssessmentType] = useState("NONE");
  const [assessmentNotes, setAssessmentNotes] = useState("");
  const [dateOpen, setDateOpen] = useState(false);
  const [followUpDateOpen, setFollowUpDateOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [locationOpen, setLocationOpen] = useState(false);
  const [assessmentOpen, setAssessmentOpen] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  // Fetch history timeline for existing jobs
  const { data: history = [] } = useQuery<JobHistoryEntry[]>({
    queryKey: ["job-history", job?.id],
    queryFn: async () => {
      if (!job?.id) return [];
      const res = await fetch(`/api/jobs/${job.id}/history`);
      const json = (await res.json()) as { data: JobHistoryEntry[] };
      return json.data ?? [];
    },
    enabled: open && !!job?.id,
  });

  useEffect(() => {
    if (open) {
      if (job) {
        setTitle(job.title);
        setCompany(job.company);
        setStatus(job.status);
        setDateApplied(new Date(job.dateApplied));
        setNextSteps(job.nextSteps ?? "");
        setSalary(job.salary ?? "");
        setLocation(job.location ?? "");
        setJobUrl(job.jobUrl ?? "");
        setNotes(job.notes ?? "");
        setFollowUpDate(job.followUpDate ? new Date(job.followUpDate) : undefined);
        setAssessmentType(job.assessmentType ?? "NONE");
        setAssessmentNotes(job.assessmentNotes ?? "");
      } else {
        setTitle("");
        setCompany("");
        setStatus("APPLIED");
        setDateApplied(new Date());
        setNextSteps("");
        setSalary("");
        setLocation("");
        setJobUrl("");
        setNotes("");
        setFollowUpDate(undefined);
        setAssessmentType("NONE");
        setAssessmentNotes("");
      }
      setTimeout(() => titleRef.current?.focus(), 50);
    }
  }, [open, job]);

  function handleSubmit() {
    if (!title.trim() || !company.trim() || !dateApplied) return;

    onSubmit({
      title: title.trim(),
      company: company.trim(),
      status,
      dateApplied: dateApplied.toISOString(),
      followUpDate: followUpDate ? followUpDate.toISOString() : null,
      nextSteps: nextSteps.trim() || null,
      salary: salary.trim() || null,
      location: location || null,
      jobUrl: jobUrl.trim() || null,
      notes: notes.trim() || null,
      assessmentType,
      assessmentNotes: assessmentNotes.trim() || null,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[90dvh] overflow-y-auto border-border bg-background p-0 sm:max-w-2xl"
        showCloseButton={false}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
            e.preventDefault();
            handleSubmit();
          }
        }}
      >
        <VisuallyHidden.Root>
          <DialogTitle>{job ? "Edit Application" : "New Application"}</DialogTitle>
        </VisuallyHidden.Root>

        <div className="flex items-center justify-between px-4 pt-3 md:px-6 md:pt-4">
          <p className="text-sm text-muted-foreground">
            {job ? "Edit Application" : "New Application"}
          </p>
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 text-muted-foreground hover:text-foreground md:h-8 md:w-8"
            onClick={() => onOpenChange(false)}
          >
            <X className="h-5 w-5 md:h-4 md:w-4" />
          </Button>
        </div>

        <div className="flex flex-col gap-5 px-4 pb-5 md:flex-row md:gap-8 md:px-6 md:pb-6">
          {/* Left: main fields */}
          <div className="min-w-0 flex-1 space-y-4">
            <input
              ref={titleRef}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Job title..."
              className="w-full border-none bg-transparent text-base font-semibold text-foreground outline-none placeholder:text-muted-foreground/50 md:text-xl"
            />

            <div className="flex items-center gap-2 text-muted-foreground">
              <Building2 className="h-4 w-4 shrink-0" />
              <input
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="Company name..."
                className="w-full border-none bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground/50 sm:text-sm"
              />
            </div>

            <Separator />

            <div className="flex items-center gap-2 text-muted-foreground">
              <ExternalLink className="h-4 w-4 shrink-0" />
              <input
                value={jobUrl}
                onChange={(e) => setJobUrl(e.target.value)}
                placeholder="Job posting URL..."
                className="w-full border-none bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground/50 sm:text-sm"
              />
              {jobUrl.trim() && (
                <a
                  href={jobUrl.trim()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 rounded p-1 text-primary hover:bg-accent"
                  title="Open link"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </div>

            <div className="flex items-center gap-2 text-muted-foreground">
              <DollarSign className="h-4 w-4 shrink-0" />
              <input
                value={salary}
                onChange={(e) => setSalary(e.target.value)}
                placeholder="Salary range (e.g. $20-$30/hr)..."
                className="w-full border-none bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground/50 sm:text-sm"
              />
            </div>

            <div className="flex items-center gap-2 text-muted-foreground">
              <ListChecks className="h-4 w-4 shrink-0" />
              <input
                value={nextSteps}
                onChange={(e) => setNextSteps(e.target.value)}
                placeholder="Next steps (e.g. Waiting, Interview Feb 20)..."
                className="w-full border-none bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground/50 sm:text-sm"
              />
            </div>

            <div className="flex items-start gap-2 text-muted-foreground">
              <ClipboardCheck className="mt-0.5 h-4 w-4 shrink-0" />
              <textarea
                value={assessmentNotes}
                onChange={(e) => setAssessmentNotes(e.target.value)}
                rows={2}
                placeholder="Assessment details (e.g. LeetCode medium, 90-min, HackerRank link)..."
                className="w-full resize-none border-none bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground/50 sm:text-sm"
              />
            </div>

            <div className="flex items-start gap-2 text-muted-foreground">
              <StickyNote className="mt-0.5 h-4 w-4 shrink-0" />
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Notes..."
                className="w-full resize-none border-none bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground/50 sm:text-sm"
              />
            </div>

            {job && history.length > 0 && (
              <div className="pt-2">
                <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  History
                </div>
                <div className="space-y-2">
                  {history.map((entry, i) => (
                    <div
                      key={entry.id}
                      className="flex items-start gap-3 text-sm"
                    >
                      <div className="flex flex-col items-center pt-1">
                        <div className="h-2 w-2 rounded-full bg-primary" />
                        {i < history.length - 1 && (
                          <div className="mt-0.5 h-6 w-px bg-border" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1 pb-2">
                        <div className="flex flex-wrap items-center gap-2">
                          {entry.fromStatus ? (
                            <>
                              <span
                                className={cn(
                                  "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                                  APPLICATION_STATUS_COLORS[entry.fromStatus]
                                )}
                              >
                                {APPLICATION_STATUS_LABELS[entry.fromStatus]}
                              </span>
                              <span className="text-muted-foreground">→</span>
                            </>
                          ) : null}
                          <span
                            className={cn(
                              "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                              APPLICATION_STATUS_COLORS[entry.toStatus]
                            )}
                          >
                            {APPLICATION_STATUS_LABELS[entry.toStatus]}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(entry.createdAt), {
                            addSuffix: true,
                          })}
                          {entry.note ? ` — ${entry.note}` : ""}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right: metadata sidebar */}
          <div className="flex w-full flex-col gap-3 md:w-48">
            {/* Status */}
            <Popover open={statusOpen} onOpenChange={setStatusOpen}>
              <PopoverTrigger asChild>
                <button className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground hover:bg-accent">
                  <span className="flex items-center gap-2">
                    <span
                      className={cn(
                        "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                        APPLICATION_STATUS_COLORS[status]
                      )}
                    >
                      {APPLICATION_STATUS_LABELS[status]}
                    </span>
                  </span>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-48 p-1" align="start">
                {STATUS_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => {
                      setStatus(opt.value);
                      setStatusOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent",
                      status === opt.value && "bg-accent"
                    )}
                  >
                    <span
                      className={cn(
                        "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                        APPLICATION_STATUS_COLORS[opt.value]
                      )}
                    >
                      {opt.label}
                    </span>
                  </button>
                ))}
              </PopoverContent>
            </Popover>

            {/* Date Applied */}
            <Popover open={dateOpen} onOpenChange={setDateOpen}>
              <PopoverTrigger asChild>
                <button className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground hover:bg-accent">
                  <span className="flex items-center gap-2">
                    <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                    {dateApplied ? format(dateApplied, "MMM d, yyyy") : "Date"}
                  </span>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dateApplied}
                  onSelect={(d) => {
                    if (d) {
                      setDateApplied(d);
                      setDateOpen(false);
                    }
                  }}
                />
              </PopoverContent>
            </Popover>

            {/* Location */}
            <Popover open={locationOpen} onOpenChange={setLocationOpen}>
              <PopoverTrigger asChild>
                <button className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground hover:bg-accent">
                  <span className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    {location ? (
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                          WORK_LOCATION_COLORS[location]
                        )}
                      >
                        {WORK_LOCATION_LABELS[location]}
                      </span>
                    ) : (
                      "Location"
                    )}
                  </span>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-48 p-1" align="start">
                {LOCATION_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => {
                      setLocation(opt.value);
                      setLocationOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent",
                      location === opt.value && "bg-accent"
                    )}
                  >
                    {opt.value ? (
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                          WORK_LOCATION_COLORS[opt.value]
                        )}
                      >
                        {opt.label}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">{opt.label}</span>
                    )}
                  </button>
                ))}
              </PopoverContent>
            </Popover>

            {/* Follow-up Date */}
            <Popover open={followUpDateOpen} onOpenChange={setFollowUpDateOpen}>
              <PopoverTrigger asChild>
                <button className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground hover:bg-accent">
                  <span className="flex items-center gap-2">
                    <BellRing className="h-4 w-4 text-muted-foreground" />
                    {followUpDate ? (
                      <span className="text-amber-400">{format(followUpDate, "MMM d, yyyy")}</span>
                    ) : (
                      "Follow-up"
                    )}
                  </span>
                  {followUpDate ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setFollowUpDate(undefined);
                      }}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={followUpDate}
                  onSelect={(d) => {
                    if (d) {
                      setFollowUpDate(d);
                      setFollowUpDateOpen(false);
                    }
                  }}
                />
              </PopoverContent>
            </Popover>

            {/* Assessment Type */}
            <Popover open={assessmentOpen} onOpenChange={setAssessmentOpen}>
              <PopoverTrigger asChild>
                <button className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground hover:bg-accent">
                  <span className="flex items-center gap-2">
                    <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
                    <span
                      className={cn(
                        "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                        ASSESSMENT_TYPE_COLORS[assessmentType]
                      )}
                    >
                      {ASSESSMENT_TYPE_LABELS[assessmentType]}
                    </span>
                  </span>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-52 p-1" align="start">
                {ASSESSMENT_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => {
                      setAssessmentType(opt.value);
                      setAssessmentOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent",
                      assessmentType === opt.value && "bg-accent"
                    )}
                  >
                    <span
                      className={cn(
                        "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                        ASSESSMENT_TYPE_COLORS[opt.value]
                      )}
                    >
                      {opt.label}
                    </span>
                  </button>
                ))}
              </PopoverContent>
            </Popover>

            <Separator className="my-1" />

            <Button onClick={handleSubmit} className="w-full">
              {job ? "Update" : "Add Application"}
            </Button>

            <p className="hidden text-center text-xs text-muted-foreground sm:block">
              Press Cmd+Enter to submit
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
