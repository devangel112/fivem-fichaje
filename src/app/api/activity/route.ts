import { getServerSession } from "next-auth";
import { authOptions } from "@/auth/config";
import { prisma } from "@/server/db";

type FilterType = "IN" | "OUT" | "ALL";
type TimeLogWhere = {
  createdAt?: { gte?: Date; lte?: Date };
  type?: Exclude<FilterType, "ALL">;
  userId?: string;
};

function parseDate(value: string | null, fallback: Date): Date {
  if (!value) return fallback;
  const d = new Date(value);
  return isNaN(d.getTime()) ? fallback : d;
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role;
  const isManager = role === "ENCARGADO" || role === "DUENO";
  if (!session?.user || !isManager) return new Response("Unauthorized", { status: 401 });

  const { searchParams } = new URL(req.url);
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");
  const type = (searchParams.get("type") as FilterType | null) || "ALL"; // IN | OUT | ALL
  const userId = searchParams.get("userId");
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") || "20", 10)));
  const sort = (searchParams.get("sort") === "asc" ? "asc" : "desc") as "asc" | "desc";
  const format = searchParams.get("format"); // csv | json

  const now = new Date();
  const defaultFrom = new Date(now);
  defaultFrom.setDate(defaultFrom.getDate() - 7);
  defaultFrom.setHours(0, 0, 0, 0);
  const defaultTo = now;

  const from = parseDate(fromParam, defaultFrom);
  const to = parseDate(toParam, defaultTo);

  const where: TimeLogWhere = {
    createdAt: { gte: from, lte: to },
  };
  if (type === "IN" || type === "OUT") where.type = type;
  if (userId) where.userId = userId;

  // Summary counts (entrada/salida)
  const [total, inCount, outCount] = await Promise.all([
    prisma.timeLog.count({ where }),
    prisma.timeLog.count({ where: { ...where, type: "IN" } }),
    prisma.timeLog.count({ where: { ...where, type: "OUT" } }),
  ]);

  // CSV export (limited)
  if (format === "csv") {
    const cap = Math.min(5000, total);
    const rows = await prisma.timeLog.findMany({
      where,
      orderBy: { createdAt: sort },
      take: cap,
      include: { user: { select: { id: true, name: true, gameName: true, role: true } } },
    });
  const header = ["id", "datetime", "type", "userId", "userName", "gameName", "role", "note"].join(",");
    const esc = (v: unknown): string => {
      if (v == null) return "";
      const s = String(v).replace(/"/g, '""');
      return `"${s}` + `"`;
    };
  const lines = rows.map((r: typeof rows[number]) => [
      r.id,
      new Date(r.createdAt).toISOString(),
      r.type,
      r.userId,
      r.user?.name ?? "",
      r.user?.gameName ?? "",
      r.user?.role ?? "",
      r.note ?? "",
    ].map(esc).join(","));
    const csv = [header, ...lines].join("\n");
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="actividad_${from.toISOString()}_${to.toISOString()}.csv"`,
      },
    });
  }

  const skip = (page - 1) * pageSize;
  const data = await prisma.timeLog.findMany({
    where,
    orderBy: { createdAt: sort },
    skip,
    take: pageSize,
    include: { user: { select: { id: true, name: true, gameName: true, role: true } } },
  });

  return Response.json({
    data,
    page,
    pageSize,
    total,
    pages: Math.max(1, Math.ceil(total / pageSize)),
    summary: { in: inCount, out: outCount },
    period: { from: from.toISOString(), to: to.toISOString() },
    sort,
    filters: { type: type ?? "ALL", userId: userId ?? null },
  });
}
