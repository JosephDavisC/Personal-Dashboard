const API_BASE = "https://api.anthropic.com";
const API_VERSION = "2023-06-01";

function getAdminKey(): string {
  const key = process.env.ANTHROPIC_ADMIN_KEY;
  if (!key) {
    throw new Error("ANTHROPIC_ADMIN_KEY is not configured");
  }
  return key;
}

async function anthropicFetch<T>(pathOrUrl: string, params?: URLSearchParams): Promise<T> {
  const key = getAdminKey();
  const url = pathOrUrl.startsWith("http")
    ? pathOrUrl
    : params
      ? `${API_BASE}${pathOrUrl}?${params.toString()}`
      : `${API_BASE}${pathOrUrl}`;

  const res = await fetch(url, {
    headers: {
      "x-api-key": key,
      "anthropic-version": API_VERSION,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Anthropic API error ${res.status}: ${text}`);
  }

  return (await res.json()) as T;
}

// ============ Types ============

export interface UsageBucket {
  starting_at: string;
  ending_at: string;
  results: UsageResult[];
}

export interface UsageResult {
  uncached_input_tokens: number;
  cache_read_input_tokens: number;
  cache_creation: {
    ephemeral_5m_input_tokens: number;
    ephemeral_1h_input_tokens: number;
  };
  output_tokens: number;
  server_tool_use: {
    web_search_requests: number;
  };
  model?: string;
  api_key_id?: string;
  workspace_id?: string;
  service_tier?: string;
}

export interface UsageResponse {
  data: UsageBucket[];
  has_more: boolean;
  next_page: string | null;
}

export interface CostBucket {
  starting_at: string;
  ending_at: string;
  results: CostResult[];
}

export interface CostResult {
  amount: string; // cents as string
  currency: string;
  cost_type: string; // "tokens" | "web_search" | "code_execution"
  token_type?: string;
  model?: string;
  service_tier?: string;
  workspace_id?: string | null;
  description?: string;
}

export interface CostResponse {
  data: CostBucket[];
  has_more: boolean;
  next_page: string | null;
}

// ============ API Functions ============

export async function getUsageReport(
  startingAt: string,
  endingAt: string,
  options?: {
    bucketWidth?: "1m" | "1h" | "1d";
    groupBy?: string[];
    models?: string[];
    limit?: number;
  }
): Promise<UsageResponse> {
  const params = new URLSearchParams({
    starting_at: startingAt,
    ending_at: endingAt,
  });

  if (options?.bucketWidth) params.set("bucket_width", options.bucketWidth);
  params.set("limit", String(options?.limit ?? 31));
  if (options?.groupBy) {
    for (const g of options.groupBy) params.append("group_by[]", g);
  }
  if (options?.models) {
    for (const m of options.models) params.append("models[]", m);
  }

  // Fetch all pages
  const allBuckets: UsageBucket[] = [];
  let page = await anthropicFetch<UsageResponse>(
    "/v1/organizations/usage_report/messages",
    params
  );
  allBuckets.push(...page.data);

  while (page.has_more && page.next_page) {
    page = await anthropicFetch<UsageResponse>(page.next_page);
    allBuckets.push(...page.data);
  }

  return { data: allBuckets, has_more: false, next_page: null };
}

export async function getCostReport(
  startingAt: string,
  endingAt: string,
  options?: {
    bucketWidth?: "1d";
    groupBy?: string[];
    limit?: number;
  }
): Promise<CostResponse> {
  const params = new URLSearchParams({
    starting_at: startingAt,
    ending_at: endingAt,
  });

  if (options?.bucketWidth) params.set("bucket_width", options.bucketWidth);
  params.set("limit", String(options?.limit ?? 31));
  if (options?.groupBy) {
    for (const g of options.groupBy) params.append("group_by[]", g);
  }

  // Fetch all pages
  const allBuckets: CostBucket[] = [];
  let page = await anthropicFetch<CostResponse>(
    "/v1/organizations/cost_report",
    params
  );
  allBuckets.push(...page.data);

  while (page.has_more && page.next_page) {
    page = await anthropicFetch<CostResponse>(page.next_page);
    allBuckets.push(...page.data);
  }

  return { data: allBuckets, has_more: false, next_page: null };
}
