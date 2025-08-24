import { getServerSession } from "next-auth";
import { authOptions } from "@/auth/config";
import { prisma } from "@/server/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });
  const userId = session.user.id as string;
  const rows = await prisma.absence.findMany({ where: { userId }, orderBy: { startAt: "desc" } });
  return Response.json(rows.map(a => ({
    id: a.id,
    startAt: a.startAt.toISOString(),
    endAt: a.endAt.toISOString(),
    reason: a.reason ?? null,
  })));
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });
  const userId = session.user.id as string;
  const body = await req.json().catch(() => ({}));
  const startAt = new Date(body.startAt);
  const endAt = new Date(body.endAt);
  const reason = typeof body.reason === "string" ? body.reason.trim() : undefined;
  if (!startAt || isNaN(startAt.getTime()) || !endAt || isNaN(endAt.getTime())) {
    return new Response("Invalid dates", { status: 400 });
  }
  if (endAt < startAt) {
    return new Response("End before start", { status: 400 });
  }
  const created = await prisma.absence.create({ data: { userId, startAt, endAt, reason } });
  return Response.json({
    id: created.id,
    startAt: created.startAt.toISOString(),
    endAt: created.endAt.toISOString(),
    reason: created.reason ?? null,
  });
}
