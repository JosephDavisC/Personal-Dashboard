import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getUsageReport } from "@/lib/anthropic";

export async function GET(req: Request) {
  const { unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const groupBy = searchParams.get("groupBy"); // comma-separated
  const bucketWidth = searchParams.get("bucketWidth") as "1m" | "1h" | "1d" | null;

  if (!from || !to) {
    return NextResponse.json({ error: "from and to are required" }, { status: 400 });
  }

  try {
    const data = await getUsageReport(from, to, {
      bucketWidth: bucketWidth ?? "1d",
      groupBy: groupBy ? groupBy.split(",") : ["model"],
    });
    return NextResponse.json({ data });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    if (message.includes("not configured")) {
      return NextResponse.json({ error: "not_configured" }, { status: 503 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
