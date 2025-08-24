import { getServerSession } from "next-auth";
import { authOptions } from "@/auth/config";
import { prisma } from "@/server/db";
import type { NextRequest } from "next/server";

type ParamsPromise = { params: Promise<{ id: string }> };

function toDto(a: { id: string; startAt: Date; endAt: Date; reason: string | null }) {
  return {
    id: a.id,
    startAt: a.startAt.toISOString(),
    endAt: a.endAt.toISOString(),
    reason: a.reason ?? null,
  };
}

type PatchBody = {
  startAt?: string;
  endAt?: string;
  reason?: string | null;
};

export async function PATCH(req: NextRequest, { params }: ParamsPromise) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });
  const userId = session.user.id as string;
  const { id } = await params;

  const existing = await prisma.absence.findUnique({ where: { id } });
  if (!existing || existing.userId !== userId) return new Response("Not found", { status: 404 });

  const body: PatchBody = await req.json().catch(() => ({}));
  const hasStart = typeof body.startAt === "string";
  const hasEnd = typeof body.endAt === "string";
  const reason = typeof body.reason === "string" ? body.reason.trim() : body.reason === null ? null : undefined;

  let newStart = existing.startAt;
  let newEnd = existing.endAt;

  if (hasStart) {
    const d = new Date(body.startAt as string);
    if (!d || isNaN(d.getTime())) return new Response("Invalid startAt", { status: 400 });
    newStart = d;
  }
  if (hasEnd) {
    const d = new Date(body.endAt as string);
    if (!d || isNaN(d.getTime())) return new Response("Invalid endAt", { status: 400 });
    newEnd = d;
  }
  if (newEnd < newStart) return new Response("End before start", { status: 400 });

  const updated = await prisma.absence.update({
    where: { id },
    data: {
      startAt: newStart,
      endAt: newEnd,
      ...(reason !== undefined ? { reason } : {}),
    },
  });
  return Response.json(toDto(updated));
}

export async function DELETE(_req: NextRequest, { params }: ParamsPromise) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });
  const userId = session.user.id as string;
  const { id } = await params;

  const existing = await prisma.absence.findUnique({ where: { id }, select: { id: true, userId: true } });
  if (!existing || existing.userId !== userId) return new Response("Not found", { status: 404 });

  await prisma.absence.delete({ where: { id } });
  return new Response(null, { status: 204 });
}
