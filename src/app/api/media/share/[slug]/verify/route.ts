import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPasswordSchema } from "@/lib/validations/media";
import { verifyPassword } from "@/lib/media-utils";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const body: unknown = await request.json();
  const parsed = verifyPasswordSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const file = await prisma.mediaFile.findUnique({
    where: { shareSlug: slug },
    select: { password: true },
  });

  if (!file || !file.password) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!verifyPassword(parsed.data.password, file.password)) {
    return NextResponse.json({ error: "Invalid password" }, { status: 403 });
  }

  // Set auth cookie (stores the raw password so share route can verify)
  const response = NextResponse.json({ data: { verified: true } });
  response.cookies.set(`media_auth_${slug}`, parsed.data.password, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 86400, // 24 hours
    path: "/",
  });

  return response;
}
