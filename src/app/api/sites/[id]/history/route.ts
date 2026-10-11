import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { TIMEZONE } from "@/lib/constants";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const days = parseInt(searchParams.get("days") ?? "90", 10);

  try {
    const data = await prisma.$queryRaw<
      {
        date: string;
        total_pings: bigint;
        up_pings: bigint;
        uptime_percent: number;
        avg_response_time: number;
      }[]
    >`
      SELECT
        TO_CHAR(
          "checkedAt" AT TIME ZONE ${TIMEZONE},
          'YYYY-MM-DD'
        ) as date,
        COUNT(*)::bigint as total_pings,
        COUNT(*) FILTER (WHERE "isUp" = true)::bigint as up_pings,
        ROUND(
          COUNT(*) FILTER (WHERE "isUp" = true)::numeric
          / NULLIF(COUNT(*)::numeric, 0) * 100,
          2
        )::float as uptime_percent,
        ROUND(AVG("responseTime"))::integer as avg_response_time
      FROM "SitePing"
      WHERE "siteId" = ${id}
        AND "checkedAt" > NOW() - CAST(${days + ' days'} AS INTERVAL)
      GROUP BY 1
      ORDER BY date ASC
    `;

    const result = data.map((row) => ({
      date: row.date,
      totalPings: Number(row.total_pings),
      upPings: Number(row.up_pings),
      uptimePercent: row.uptime_percent,
      avgResponseTime: row.avg_response_time,
    }));

    return NextResponse.json({ data: result });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
