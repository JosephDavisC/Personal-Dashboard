import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getCostReport } from "@/lib/anthropic";

export async function GET(req: Request) {
  const { unauthorized } = await requireAuth();
  if (unauthorized) return unauthorized;

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  if (!from || !to) {
    return NextResponse.json({ error: "from and to are required" }, { status: 400 });
  }

  try {
    const data = await getCostReport(from, to, {
      bucketWidth: "1d",
      groupBy: ["description"],
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
