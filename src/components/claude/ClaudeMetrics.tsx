"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTheme } from "next-themes";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import {
  Bot,
  DollarSign,
  Search,
  Code,
  Zap,
  ArrowDownToLine,
  ArrowUpFromLine,
  ExternalLink,
  MessageSquare,
  Info,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { UsageResponse, CostResponse } from "@/lib/anthropic";
import { format, subDays, startOfMonth } from "date-fns";

type DateRange = "7d" | "14d" | "30d" | "month";

interface ApiResponse<T> {
  data?: T;
  error?: string;
}

// Use stable date strings (start of day) so query keys don't change every render
function stableDate(d: Date): string {
  return format(d, "yyyy-MM-dd") + "T00:00:00Z";
}

function getDateRange(range: DateRange): { from: string; to: string } {
  const now = new Date();
  const to = format(now, "yyyy-MM-dd") + "T23:59:59Z";
  switch (range) {
    case "7d":
      return { from: stableDate(subDays(now, 7)), to };
    case "14d":
      return { from: stableDate(subDays(now, 14)), to };
    case "30d":
      return { from: stableDate(subDays(now, 30)), to };
    case "month":
      return { from: stableDate(startOfMonth(now)), to };
  }
}

const rangeOptions: { key: DateRange; label: string }[] = [
  { key: "7d", label: "7 days" },
  { key: "14d", label: "14 days" },
  { key: "30d", label: "30 days" },
  { key: "month", label: "This month" },
];

// Model display names and colors
const MODEL_COLORS: Record<string, string> = {
  "claude-opus-4-6": "#a855f7",
  "claude-sonnet-4-5-20250929": "#3b82f6",
  "claude-haiku-4-5-20251001": "#22c55e",
  "claude-haiku-4-5": "#22c55e",
  "claude-3-5-sonnet-20241022": "#f59e0b",
  "claude-3-5-haiku-20241022": "#06b6d4",
};

function getModelColor(model: string): string {
  return MODEL_COLORS[model] ?? "#6b7280";
}

function shortModelName(model: string): string {
  if (model.includes("opus-4")) return "Opus 4.6";
  if (model.includes("sonnet-4-5")) return "Sonnet 4.5";
  if (model.includes("haiku-4-5")) return "Haiku 4.5";
  if (model.includes("sonnet") && model.includes("3-5")) return "Sonnet 3.5";
  if (model.includes("haiku") && model.includes("3-5")) return "Haiku 3.5";
  if (model.includes("opus")) return "Opus";
  if (model.includes("sonnet")) return "Sonnet";
  if (model.includes("haiku")) return "Haiku";
  return model;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function ClaudeMetrics() {
  const [range, setRange] = useState<DateRange>("30d");
  const { resolvedTheme } = useTheme();
  const tickColor = resolvedTheme === "dark" ? "#e4e4e7" : "#3f3f46";

  const { from, to } = getDateRange(range);

  const {
    data: costData,
    isLoading: costLoading,
    error: costError,
  } = useQuery<CostResponse | null>({
    queryKey: ["claude-costs", from, to],
    queryFn: async () => {
      const res = await fetch(
        `/api/claude/costs?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
      );
      const json = (await res.json()) as ApiResponse<CostResponse>;
      if (json.error === "not_configured") return null;
      if (json.error) throw new Error(json.error);
      return json.data ?? null;
    },
    staleTime: 60_000,
    refetchInterval: 300_000, // 5 min
    retry: false,
  });

  const {
    data: usageData,
    isLoading: usageLoading,
    error: usageError,
  } = useQuery<UsageResponse | null>({
    queryKey: ["claude-usage", from, to],
    queryFn: async () => {
      const res = await fetch(
        `/api/claude/usage?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&groupBy=model`
      );
      const json = (await res.json()) as ApiResponse<UsageResponse>;
      if (json.error === "not_configured") return null;
      if (json.error) throw new Error(json.error);
      return json.data ?? null;
    },
    staleTime: 60_000,
    refetchInterval: 300_000,
    retry: false,
  });

  // Live dashboard chat usage (today)
  const { data: liveData } = useQuery<{
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheWriteTokens: number;
    messageCount: number;
    date: string;
  } | null>({
    queryKey: ["claude-live"],
    queryFn: async () => {
      const res = await fetch("/api/claude/live");
      const json = (await res.json()) as ApiResponse<{
        inputTokens: number;
        outputTokens: number;
        cacheReadTokens: number;
        cacheWriteTokens: number;
        messageCount: number;
        date: string;
      }>;
      if (json.error) return null;
      return json.data ?? null;
    },
    staleTime: 30_000,
    refetchInterval: 60_000, // 1 min
    retry: false,
  });

  // Compute cost totals
  const costTotals = useMemo(() => {
    if (!costData?.data) return { tokens: 0, webSearch: 0, codeExecution: 0 };
    let tokens = 0;
    let webSearch = 0;
    let codeExecution = 0;
    for (const bucket of costData.data) {
      for (const r of bucket.results) {
        const amount = parseFloat(r.amount) / 100; // cents to dollars
        switch (r.cost_type) {
          case "tokens":
            tokens += amount;
            break;
          case "web_search":
            webSearch += amount;
            break;
          case "code_execution":
            codeExecution += amount;
            break;
        }
      }
    }
    return { tokens, webSearch, codeExecution };
  }, [costData]);

  // Compute usage totals
  const usageTotals = useMemo(() => {
    if (!usageData?.data) return { input: 0, output: 0, cacheRead: 0, cacheCreation: 0, webSearches: 0 };
    let input = 0;
    let output = 0;
    let cacheRead = 0;
    let cacheCreation = 0;
    let webSearches = 0;
    for (const bucket of usageData.data) {
      for (const r of bucket.results) {
        input += r.uncached_input_tokens;
        output += r.output_tokens;
        cacheRead += r.cache_read_input_tokens;
        cacheCreation +=
          (r.cache_creation?.ephemeral_5m_input_tokens ?? 0) +
          (r.cache_creation?.ephemeral_1h_input_tokens ?? 0);
        webSearches += r.server_tool_use?.web_search_requests ?? 0;
      }
    }
    return { input, output, cacheRead, cacheCreation, webSearches };
  }, [usageData]);

  // Daily cost chart data
  const dailyCostChart = useMemo(() => {
    if (!costData?.data) return [];
    const dayMap = new Map<string, number>();
    for (const bucket of costData.data) {
      const day = format(new Date(bucket.starting_at), "MMM d");
      let total = dayMap.get(day) ?? 0;
      for (const r of bucket.results) {
        total += parseFloat(r.amount) / 100;
      }
      dayMap.set(day, total);
    }
    return Array.from(dayMap.entries()).map(([day, cost]) => ({
      day,
      cost: Math.round(cost * 10000) / 10000, // 4 decimal places
    }));
  }, [costData]);

  // Model usage breakdown
  const modelBreakdown = useMemo(() => {
    if (!usageData?.data) return [];
    const modelMap = new Map<string, { input: number; output: number; cacheRead: number }>();
    for (const bucket of usageData.data) {
      for (const r of bucket.results) {
        const model = r.model ?? "unknown";
        const existing = modelMap.get(model) ?? { input: 0, output: 0, cacheRead: 0 };
        existing.input += r.uncached_input_tokens;
        existing.output += r.output_tokens;
        existing.cacheRead += r.cache_read_input_tokens;
        modelMap.set(model, existing);
      }
    }
    return Array.from(modelMap.entries())
      .map(([model, data]) => ({
        model,
        shortName: shortModelName(model),
        color: getModelColor(model),
        ...data,
        total: data.input + data.output + data.cacheRead,
      }))
      .sort((a, b) => b.total - a.total);
  }, [usageData]);

  // Daily usage chart (stacked by model)
  const dailyUsageChart = useMemo(() => {
    if (!usageData?.data) return { data: [] as Record<string, string | number>[], models: [] as string[] };
    const dayMap = new Map<string, Record<string, number>>();
    const allModels = new Set<string>();
    for (const bucket of usageData.data) {
      const day = format(new Date(bucket.starting_at), "MMM d");
      const existing = dayMap.get(day) ?? {};
      for (const r of bucket.results) {
        const model = r.model ? shortModelName(r.model) : "unknown";
        allModels.add(model);
        existing[model] = (existing[model] ?? 0) + r.uncached_input_tokens + r.output_tokens + r.cache_read_input_tokens;
      }
      dayMap.set(day, existing);
    }
    const models = Array.from(allModels);
    const data = Array.from(dayMap.entries()).map(([day, tokens]) => ({
      day,
      ...tokens,
    }));
    return { data, models };
  }, [usageData]);

  const isLoading = costLoading || usageLoading;
  const anyError = costError || usageError;

  // Not configured state
  if (!isLoading && !anyError && costData === null) {
    return (
      <Card className="mx-auto max-w-md border-border bg-card">
        <CardContent className="py-10 text-center">
          <Bot className="mx-auto mb-4 h-10 w-10 text-muted-foreground/40" />
          <h3 className="mb-2 text-lg font-semibold text-foreground">
            Anthropic Admin API not configured
          </h3>
          <p className="mb-4 text-sm text-muted-foreground">
            Add your Anthropic Admin API key to enable usage monitoring.
          </p>
          <ol className="mb-4 space-y-1 text-left text-sm text-muted-foreground">
            <li>
              1. Go to{" "}
              <a
                href="https://console.anthropic.com/settings/admin-keys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Console → Admin Keys
                <ExternalLink className="ml-1 inline h-3 w-3" />
              </a>
            </li>
            <li>2. Generate a new Admin API key</li>
            <li>
              3. Add to <code className="rounded bg-accent px-1 text-xs">.env</code>:
            </li>
          </ol>
          <pre className="rounded-lg bg-background p-3 text-left text-xs text-muted-foreground">
            {`ANTHROPIC_ADMIN_KEY=sk-ant-admin-...`}
          </pre>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground/60">
        Loading Claude metrics...
      </p>
    );
  }

  if (anyError) {
    const errMsg = anyError instanceof Error ? anyError.message : "Failed to load metrics";
    const isRateLimit = errMsg.includes("rate_limit") || errMsg.includes("429");
    return (
      <Card className="mx-auto max-w-md border-border bg-card">
        <CardContent className="py-10 text-center">
          <Bot className="mx-auto mb-4 h-10 w-10 text-muted-foreground/40" />
          <h3 className="mb-2 text-lg font-semibold text-foreground">
            {isRateLimit ? "Rate limited" : "Failed to load metrics"}
          </h3>
          <p className="text-sm text-muted-foreground">
            {isRateLimit
              ? "Anthropic API rate limit reached. The page will auto-refresh in a few minutes."
              : errMsg}
          </p>
        </CardContent>
      </Card>
    );
  }

  const totalCost = costTotals.tokens + costTotals.webSearch + costTotals.codeExecution;

  return (
    <div className="space-y-6">
      {/* Date range selector */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-heading text-xl font-semibold text-foreground sm:text-2xl">
          Claude API Usage
        </h2>
        <div className="flex gap-1">
          {rangeOptions.map((opt) => (
            <Button
              key={opt.key}
              variant={range === opt.key ? "secondary" : "ghost"}
              size="sm"
              className={cn(
                "h-7 text-xs",
                range === opt.key ? "bg-accent text-foreground" : "text-muted-foreground"
              )}
              onClick={() => setRange(opt.key)}
            >
              {opt.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Today (Live) — real-time dashboard chat usage */}
      {liveData && liveData.messageCount > 0 && (
        <Card className="border-primary/20 bg-card">
          <CardContent className="p-4">
            <div className="mb-3 flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10">
                <MessageSquare className="h-3.5 w-3.5 text-primary" />
              </div>
              <span className="text-sm font-medium text-foreground">Today (Live)</span>
              <span className="rounded-full bg-green-500/20 px-2 py-0.5 text-[10px] font-medium text-green-400">
                LIVE
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              <div>
                <p className="text-xs text-muted-foreground">Messages</p>
                <p className="text-lg font-semibold text-foreground">{liveData.messageCount}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Input</p>
                <p className="text-lg font-semibold text-foreground">{formatTokens(liveData.inputTokens)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Output</p>
                <p className="text-lg font-semibold text-foreground">{formatTokens(liveData.outputTokens)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Cache Read</p>
                <p className="text-lg font-semibold text-foreground">{formatTokens(liveData.cacheReadTokens)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Cache Write</p>
                <p className="text-lg font-semibold text-foreground">{formatTokens(liveData.cacheWriteTokens)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Admin API delay notice */}
      <div className="flex items-start gap-2 rounded-lg bg-accent/50 px-3 py-2.5 text-xs text-muted-foreground">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>
          Anthropic Admin API data is delayed ~24 hours. &ldquo;Today (Live)&rdquo; shows real-time usage from dashboard chat only.
        </span>
      </div>

      {/* Cost summary cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <CostCard
          icon={DollarSign}
          label="Total Cost"
          value={`$${totalCost.toFixed(2)}`}
          color="text-emerald-400"
        />
        <CostCard
          icon={Zap}
          label="Token Cost"
          value={`$${costTotals.tokens.toFixed(2)}`}
          color="text-blue-400"
        />
        <CostCard
          icon={Search}
          label="Web Search"
          value={`$${costTotals.webSearch.toFixed(2)}`}
          color="text-orange-400"
        />
        <CostCard
          icon={Code}
          label="Code Execution"
          value={`$${costTotals.codeExecution.toFixed(2)}`}
          color="text-purple-400"
        />
      </div>

      {/* Token usage cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <TokenCard
          icon={ArrowUpFromLine}
          label="Input Tokens"
          value={formatTokens(usageTotals.input)}
        />
        <TokenCard
          icon={ArrowDownToLine}
          label="Output Tokens"
          value={formatTokens(usageTotals.output)}
        />
        <TokenCard
          icon={Zap}
          label="Cache Read"
          value={formatTokens(usageTotals.cacheRead)}
        />
        <TokenCard
          icon={Zap}
          label="Cache Created"
          value={formatTokens(usageTotals.cacheCreation)}
        />
        <TokenCard
          icon={Search}
          label="Web Searches"
          value={String(usageTotals.webSearches)}
        />
      </div>

      {/* Daily cost chart */}
      {dailyCostChart.length > 0 && (
        <Card className="border-border bg-card">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2.5 text-lg font-semibold text-foreground">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
                <DollarSign className="h-4 w-4 text-primary" />
              </div>
              Daily Cost
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={dailyCostChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="day"
                  tick={{ fill: tickColor, fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fill: tickColor, fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  width={50}
                  tickFormatter={(v) => `$${v}`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                  labelStyle={{ color: "hsl(var(--muted-foreground))" }}
                  itemStyle={{ color: "hsl(var(--foreground))" }}
                  formatter={(value) => [`$${Number(value).toFixed(4)}`, "Cost"]}
                />
                <Bar dataKey="cost" fill="#3b82f6" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Daily token usage chart (stacked) */}
      {dailyUsageChart.data.length > 0 && (
        <Card className="border-border bg-card">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2.5 text-lg font-semibold text-foreground">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
                <Zap className="h-4 w-4 text-primary" />
              </div>
              Daily Token Usage
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={dailyUsageChart.data}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="day"
                  tick={{ fill: tickColor, fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fill: tickColor, fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  width={55}
                  tickFormatter={(v) => formatTokens(Number(v))}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                  labelStyle={{ color: "hsl(var(--muted-foreground))" }}
                  itemStyle={{ color: "hsl(var(--foreground))" }}
                  formatter={(value, name) => [formatTokens(Number(value)), String(name)]}
                />
                <Legend
                  wrapperStyle={{ fontSize: "12px", color: tickColor }}
                />
                {dailyUsageChart.models.map((model) => (
                  <Bar
                    key={model}
                    dataKey={model}
                    stackId="tokens"
                    fill={getModelColor(
                      // reverse lookup full model name
                      modelBreakdown.find((m) => m.shortName === model)?.model ?? model
                    )}
                    radius={[0, 0, 0, 0]}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Model breakdown */}
      {modelBreakdown.length > 0 && (
        <Card className="border-border bg-card">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2.5 text-lg font-semibold text-foreground">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
                <Bot className="h-4 w-4 text-primary" />
              </div>
              Model Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {modelBreakdown.map((m) => {
                const maxTokens = modelBreakdown[0]?.total ?? 1;
                const percent = (m.total / maxTokens) * 100;
                return (
                  <div key={m.model}>
                    <div className="mb-1.5 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: m.color }}
                        />
                        <span className="text-sm font-medium text-foreground">
                          {m.shortName}
                        </span>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {formatTokens(m.total)} tokens
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-border">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${percent}%`,
                          backgroundColor: m.color,
                        }}
                      />
                    </div>
                    <div className="mt-1 flex gap-4 text-xs text-muted-foreground">
                      <span>Input: {formatTokens(m.input)}</span>
                      <span>Output: {formatTokens(m.output)}</span>
                      {m.cacheRead > 0 && <span>Cache: {formatTokens(m.cacheRead)}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function CostCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: typeof DollarSign;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <Card className="border-border bg-card">
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">{label}</span>
        </div>
        <p className={cn("mt-2 text-2xl font-bold", color)}>{value}</p>
      </CardContent>
    </Card>
  );
}

function TokenCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Zap;
  label: string;
  value: string;
}) {
  return (
    <Card className="border-border bg-card">
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
        <p className="mt-1.5 text-lg font-semibold text-foreground">{value}</p>
      </CardContent>
    </Card>
  );
}
