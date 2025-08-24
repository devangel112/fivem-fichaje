import { getServerSession } from "next-auth";
import { authOptions } from "@/auth/config";
import { prisma } from "@/server/db";
import { sendDiscordWebhook } from "@/lib/webhook";
import { z } from "zod";

const BodySchema = z.object({ type: z.enum(["IN", "OUT"]), note: z.string().optional() });

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return new Response("Unauthorized", { status: 401 });
  const me = await prisma.user.findUnique({ where: { id: session.user.id! } });
  if (!me?.active) return new Response("Forbidden", { status: 403 });
  const json = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) return new Response("Invalid body", { status: 400 });
  const { type, note } = parsed.data;

  const user = await prisma.user.findUnique({ where: { id: session.user.id! } });
  if (!user) return new Response("Not found", { status: 404 });

  if (type === "IN") {
    if (user.currentShiftStart) return new Response("Ya estás dentro.", { status: 400 });
    const startedAt = new Date();
    const [updated, log] = await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: { currentShiftStart: startedAt } }),
      prisma.timeLog.create({ data: { userId: user.id, type: "IN", note, createdAt: startedAt }, include: { user: true } }),
    ]);
    await sendDiscordWebhook(`🕒 ${log.user.name ?? "Usuario"} marcó ENTRADA a las ${startedAt.toLocaleTimeString()}`);
    return Response.json({ ok: true, activeStart: updated.currentShiftStart, log });
  }

  if (!user.currentShiftStart) return new Response("No estás dentro.", { status: 400 });
  const startedAt = user.currentShiftStart;
  const endedAt = new Date();
  const durationMs = Math.max(0, endedAt.getTime() - new Date(startedAt).getTime());

  const [log] = await Promise.all([
    prisma.timeLog.create({ data: { userId: user.id, type: "OUT", note }, include: { user: true } }),
    prisma.workSession.create({ data: { userId: user.id, startedAt: new Date(startedAt), endedAt, durationMs, note } }),
  ]);
  await prisma.user.update({ where: { id: user.id }, data: { currentShiftStart: null } });
  const hh = Math.floor(durationMs / 3600000);
  const mm = Math.floor((durationMs % 3600000) / 60000);
  const ss = Math.floor((durationMs % 60000) / 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  await sendDiscordWebhook(`🕒 ${log.user.name ?? "Usuario"} marcó SALIDA a las ${endedAt.toLocaleTimeString()} (duración ${pad(hh)}:${pad(mm)}:${pad(ss)})`);
  return Response.json({ ok: true, activeStart: null, workSession: { startedAt, endedAt, durationMs } });
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return new Response("Unauthorized", { status: 401 });
  const me = await prisma.user.findUnique({ where: { id: session.user.id! } });
  if (!me?.active) return new Response("Forbidden", { status: 403 });
  const userId = session.user.id!;
  const [logs, user, sessions] = await Promise.all([
    prisma.timeLog.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 5 }),
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.workSession.findMany({ where: { userId }, orderBy: { endedAt: "desc" }, take: 5 }),
  ]);

  const activeStart = user?.currentShiftStart ?? null;

  // Resumen: hoy, semana, mes (incluye sesión activa si existe)
  const now = new Date();
  const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
  const day = now.getUTCDay();
  const diffToMonday = (day + 6) % 7;
  const weekStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - diffToMonday, 0, 0, 0, 0));
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
  // Para no limitar el resumen a las últimas 5 sesiones, cargamos todas las sesiones desde el inicio más temprano
  const earliestStart = new Date(Math.min(weekStart.getTime(), monthStart.getTime()));
  const summarySessions = await prisma.workSession.findMany({
    where: { userId, endedAt: { gte: earliestStart } },
    orderBy: { endedAt: "desc" },
    select: { startedAt: true, endedAt: true },
  });

  const clip = (s: Date, e: Date, start: Date, end: Date) => Math.max(0, Math.min(e.getTime(), end.getTime()) - Math.max(s.getTime(), start.getTime()));

  function sumRange(start: Date, end: Date) {
    let total = 0;
    for (const s of summarySessions) {
      total += clip(new Date(s.startedAt), new Date(s.endedAt), start, end);
    }
    if (activeStart) {
      total += clip(new Date(activeStart), now, start, end);
    }
    return total;
  }

  const summary = {
    todayMs: sumRange(dayStart, now),
    weekMs: sumRange(weekStart, now),
    monthMs: sumRange(monthStart, now),
  };

  const period = {
    now: now.toISOString(),
    dayStart: dayStart.toISOString(),
    weekStart: weekStart.toISOString(),
    monthStart: monthStart.toISOString(),
    timezone: "UTC",
  };

  return Response.json({ logs, activeStart, sessions, summary, period });
}
