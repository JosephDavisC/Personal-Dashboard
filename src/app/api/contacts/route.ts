import { auth } from "@/lib/auth";
import { searchContacts } from "@/lib/google-contacts";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q");

  if (!query || query.length < 2) {
    return NextResponse.json({ data: [] });
  }

  // Search local contacts DB and Google API in parallel
  const [localResults, googleResults] = await Promise.all([
    prisma.contact.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          { email: { contains: query, mode: "insensitive" } },
        ],
        email: { not: null },
      },
      select: { email: true, name: true },
      take: 20,
      orderBy: { name: "asc" },
    }).then((rows) =>
      rows
        .filter((r): r is typeof r & { email: string } => !!r.email)
        .map((r) => ({ email: r.email, name: r.name }))
    ),
    searchContacts(query).catch(() => [] as { email: string; name?: string }[]),
  ]);

  // Merge and deduplicate by email (local results first)
  const seen = new Set<string>();
  const merged: { email: string; name?: string }[] = [];

  for (const c of localResults) {
    const key = c.email.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(c);
    }
  }
  for (const c of googleResults) {
    const key = c.email.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(c);
    }
  }

  return NextResponse.json({ data: merged.slice(0, 20) });
}
