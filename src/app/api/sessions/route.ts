import { getServerSession } from "next-auth";
import { authOptions } from "@/auth/config";
import { prisma } from "@/server/db";

type Sort = "asc" | "desc";

function parseDate(value: string | null, fallback: Date): Date {
  if (!value) return fallback;
  const d = new Date(value);
  return isNaN(d.getTime()) ? fallback : d;
}

function toHMS(ms: number) {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role;
  const isManager = role === "ENCARGADO" || role === "DUENO";
  if (!session?.user || !isManager) return new Response("Unauthorized", { status: 401 });

  const { searchParams } = new URL(req.url);
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");
  const userId = searchParams.get("userId");
  const minDurationMs = parseInt(searchParams.get("minDurationMs") || "0", 10) || 0;
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") || "20", 10)));
  const sort: Sort = (searchParams.get("sort") === "asc" ? "asc" : "desc");
  const format = searchParams.get("format"); // csv | json

  const now = new Date();
  const defaultFrom = new Date(now);
  defaultFrom.setDate(defaultFrom.getDate() - 7);
  defaultFrom.setHours(0, 0, 0, 0);
  const defaultTo = now;

  const from = parseDate(fromParam, defaultFrom);
  const to = parseDate(toParam, defaultTo);

  const where = {
    endedAt: { gte: from, lte: to },
    ...(userId ? { userId } : {}),
    ...(minDurationMs > 0 ? { durationMs: { gte: minDurationMs } } : {}),
  } as const;

  const [total, agg] = await Promise.all([
    prisma.workSession.count({ where }),
    prisma.workSession.aggregate({ _sum: { durationMs: true }, where }),
  ]);

  if (format === "csv") {
    const cap = Math.min(5000, total);
    const rows = await prisma.workSession.findMany({
      where,
      orderBy: { endedAt: sort },
      take: cap,
      include: { user: { select: { id: true, name: true, gameName: true, role: true } } },
    });
    const header = ["id", "userId", "userName", "gameName", "role", "startedAt", "endedAt", "durationMs", "duration", "note"].join(",");
    const esc = (v: unknown): string => {
      if (v == null) return "";
      const s = String(v).replace(/"/g, '""');
      return `"${s}` + `"`;
    };
    const lines = rows.map((r) => [
      r.id,
      r.userId,
      r.user?.name ?? "",
      r.user?.gameName ?? "",
      r.user?.role ?? "",
      new Date(r.startedAt).toISOString(),
      new Date(r.endedAt).toISOString(),
      r.durationMs,
      toHMS(r.durationMs),
      r.note ?? "",
    ].map(esc).join(","));
    const csv = [header, ...lines].join("\n");
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="sesiones_${from.toISOString()}_${to.toISOString()}.csv"`,
      },
    });
  }

  const skip = (page - 1) * pageSize;
  const data = await prisma.workSession.findMany({
    where,
    orderBy: { endedAt: sort },
    skip,
    take: pageSize,
    include: { user: { select: { id: true, name: true, gameName: true, role: true } } },
  });

  const totalMs = agg._sum.durationMs ?? 0;
  const avgMs = total > 0 ? Math.floor(totalMs / total) : 0;

  return Response.json({
    data,
    page,
    pageSize,
    total,
    pages: Math.max(1, Math.ceil(total / pageSize)),
    summary: { totalMs, avgMs },
    period: { from: from.toISOString(), to: to.toISOString() },
    sort,
    filters: { userId: userId ?? null, minDurationMs },
  });
}
