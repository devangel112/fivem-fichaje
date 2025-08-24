import { getServerSession } from "next-auth";
import Link from "next/link";
import { authOptions } from "@/auth/config";
import { prisma } from "@/server/db";
import { ClientTime } from "@/components/ClientTime";
import { roleLabels } from "@/constants/roles";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return <div className="p-8">No autenticado. Ve a /login.</div>;
  if (session.user.role === "VISITANTE") {
    return (
      <div className="p-8">
        Tu rol es {roleLabels["VISITANTE"]}. Ve a <a className="underline" href="/landing">/landing</a>.
      </div>
    );
  }

  const userId = session.user.id!;
  const me = await prisma.user.findUnique({ where: { id: userId }, select: { gameName: true, name: true, currentShiftStart: true } });
  const total = await prisma.timeLog.count({ where: { userId } });
  const isManager = session.user.role === "ENCARGADO" || session.user.role === "DUENO";
  const teamLogs = await prisma.timeLog.findMany({ orderBy: { createdAt: "desc" }, take: 20, include: { user: true } });

  // Config de bonificación
  const cfg = await prisma.config.findMany({ where: { key: { in: ["bonusThresholdHours", "bonusAmount"] } } });
  const cfgMap = new Map(cfg.map((c: { key: string; value: string | null }) => [c.key, c.value] as const));
  const bonusThresholdHours = Number(cfgMap.get("bonusThresholdHours") ?? 10) || 10;
  const bonusAmount = Number(cfgMap.get("bonusAmount") ?? 5000) || 5000;

  // Ventana semanal (L-D)
  const now = new Date();
  const weekStart = new Date(now);
  const day = weekStart.getDay();
  const diffToMonday = (day + 6) % 7;
  weekStart.setDate(weekStart.getDate() - diffToMonday);
  weekStart.setHours(0, 0, 0, 0);
  const sundayEnd = new Date(weekStart); sundayEnd.setDate(sundayEnd.getDate() + 6); sundayEnd.setHours(23,59,59,999);
  const weekEndBound = now < sundayEnd ? now : sundayEnd;
  const clip = (s: Date, e: Date, start: Date, end: Date) => Math.max(0, Math.min(e.getTime(), end.getTime()) - Math.max(s.getTime(), start.getTime()));

  let weeklySummary: { userId: string; name: string | null; gameName: string | null; role: string; ms: number; }[] = [];
  let absentNow = new Set<string>();
  if (isManager) {
    const sessions = await prisma.workSession.findMany({ where: { startedAt: { lte: weekEndBound }, endedAt: { gte: weekStart } }, include: { user: { select: { id: true, name: true, gameName: true, role: true, active: true } } } });
    const map = new Map<string, { userId: string; name: string | null; gameName: string | null; role: string; ms: number }>();
    for (const s of sessions) {
      const u = s.user; if (!u || !u.active || u.role === "VISITANTE") continue;
      const ms = clip(new Date(s.startedAt), new Date(s.endedAt), weekStart, weekEndBound); if (ms <= 0) continue;
      const prev = map.get(u.id) ?? { userId: u.id, name: u.name, gameName: u.gameName, role: u.role, ms: 0 }; prev.ms += ms; map.set(u.id, prev);
    }
    const activeUsers = await prisma.user.findMany({ where: { currentShiftStart: { not: null, lte: weekEndBound }, active: true, NOT: { role: "VISITANTE" } }, select: { id: true, name: true, gameName: true, role: true, currentShiftStart: true } });
    for (const u of activeUsers) {
      const ms = clip(new Date(u.currentShiftStart!), now, weekStart, weekEndBound); if (ms <= 0) continue;
      const prev = map.get(u.id) ?? { userId: u.id, name: u.name, gameName: u.gameName, role: u.role, ms: 0 }; prev.ms += ms; map.set(u.id, prev);
    }
    const allEmployees = await prisma.user.findMany({ where: { active: true, NOT: { role: "VISITANTE" } }, select: { id: true, name: true, gameName: true, role: true } });
    for (const u of allEmployees) if (!map.has(u.id)) map.set(u.id, { userId: u.id, name: u.name, gameName: u.gameName, role: u.role, ms: 0 });
    weeklySummary = Array.from(map.values()).sort((a, b) => b.ms - a.ms);
    const abs = await prisma.absence.findMany({ where: { startAt: { lte: now }, endAt: { gte: now } }, select: { userId: true } });
    absentNow = new Set(abs.map((a: { userId: string }) => a.userId));
  }

  async function getTopWorkers() {
    const now = new Date();
    const dayStart = new Date(now); dayStart.setHours(0,0,0,0);
    const weekStart = new Date(now); const day = weekStart.getDay(); const diffToMonday = (day + 6) % 7; weekStart.setDate(weekStart.getDate() - diffToMonday); weekStart.setHours(0,0,0,0);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const clip = (s: Date, e: Date, start: Date, end: Date) => Math.max(0, Math.min(e.getTime(), end.getTime()) - Math.max(s.getTime(), start.getTime()));
    const aggregate = (sessions: { userId: string; startedAt: Date; endedAt: Date; user: { id: string; name: string | null; gameName: string | null } }[], start: Date, end: Date) => {
      const map = new Map<string, { userId: string; name: string | null; gameName: string | null; ms: number }>();
      for (const s of sessions) { const ms = clip(new Date(s.startedAt), new Date(s.endedAt), start, end); if (ms <= 0) continue; const prev = map.get(s.userId) ?? { userId: s.userId, name: s.user.name, gameName: s.user.gameName, ms: 0 }; prev.ms += ms; map.set(s.userId, prev); }
      let top: { userId: string; name: string | null; gameName: string | null; ms: number } | null = null; for (const v of map.values()) if (!top || v.ms > top.ms) top = v; return top;
    };
    const [daySessions, weekSessions, monthSessions] = await Promise.all([
      prisma.workSession.findMany({ where: { endedAt: { gte: dayStart } }, include: { user: { select: { id: true, name: true, gameName: true } } } }),
      prisma.workSession.findMany({ where: { endedAt: { gte: weekStart } }, include: { user: { select: { id: true, name: true, gameName: true } } } }),
      prisma.workSession.findMany({ where: { endedAt: { gte: monthStart } }, include: { user: { select: { id: true, name: true, gameName: true } } } }),
    ]);
    return { day: aggregate(daySessions, dayStart, now), week: aggregate(weekSessions, weekStart, now), month: aggregate(monthSessions, monthStart, now) };
  }

  const top = isManager ? await getTopWorkers() : null;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Hola, {me?.gameName || me?.name || "Usuario"}</h1>
  <Link href="/api/auth/signout" className="rounded bg-gray-200 hover:bg-gray-300 text-gray-800 px-3 py-1.5">Cerrar sesión</Link>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded border p-4"><div className="text-sm opacity-70">Fichajes</div><div className="text-3xl font-bold">{total}</div></div>
        <div className="rounded border p-4"><div className="text-sm opacity-70">Rol</div><div className="text-3xl font-bold">{roleLabels[session.user.role as keyof typeof roleLabels]}</div></div>
      </div>

      {isManager && top && (
        <div className="grid gap-4 md:grid-cols-3">
          <TopCard title="Top del día" data={top.day} />
          <TopCard title="Top de la semana" data={top.week} />
          <TopCard title="Top del mes" data={top.month} />
        </div>
      )}

      {isManager && (
        <div>
          <h2 className="text-xl font-semibold mt-6 mb-2">Resumen semanal por empleado (L–D)</h2>
          <div className="overflow-x-auto rounded border">
            <table className="min-w-full text-sm table-fixed">
              <thead className="bg-neutral-900 text-neutral-200">
                <tr>
                  <th className="text-left p-2">Empleado</th>
                  <th className="text-left p-2 hidden sm:table-cell">Rol</th>
                  <th className="text-right p-2">Horas (L–D)</th>
                  <th className="text-left p-2 hidden sm:table-cell">Ausencia</th>
                  <th className="text-right p-2 hidden sm:table-cell">Prima máxima</th>
                </tr>
              </thead>
              <tbody>
                {weeklySummary.map((row) => {
                  const name = row.gameName || row.name || "Usuario";
                  const h = Math.floor(row.ms / 3600000); const m = Math.floor((row.ms % 3600000) / 60000); const s = Math.floor((row.ms % 60000) / 1000);
                  const pad = (n: number) => String(n).padStart(2, "0");
                  const time = `${pad(h)}:${pad(m)}:${pad(s)}`;
                  const qualifies = row.ms / 3600000 >= bonusThresholdHours;
                  const isAbsent = absentNow.has(row.userId);
                  return (
                    <tr key={row.userId} className="border-t border-neutral-800">
                      <td className="p-2 max-w-[180px] truncate sm:max-w-none" title={name}>{name}</td>
                      <td className="p-2 whitespace-nowrap hidden sm:table-cell">{roleLabels[row.role as keyof typeof roleLabels]}</td>
                      <td className="p-2 whitespace-nowrap text-right font-mono">{time}</td>
                      <td className="p-2 whitespace-nowrap hidden sm:table-cell">{isAbsent ? (<span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">En ausencia</span>) : (<span className="text-xs opacity-70">—</span>)}</td>
                      <td className="p-2 whitespace-nowrap text-right hidden sm:table-cell">{qualifies ? `$${bonusAmount.toLocaleString("es-MX")}` : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div>
        <h2 className="text-xl font-semibold mb-2">Actividad del equipo</h2>
        <ul className="space-y-2">
          {teamLogs.map((l: { id: string; type: string; createdAt: Date; note: string | null; user?: { name?: string | null; gameName?: string | null } | null; }) => (
            <li key={l.id} className="rounded border p-3 flex items-center justify-between">
              <div className="min-w-0">
                <div className="font-medium truncate max-w-[70vw] sm:max-w-[50vw]">{l.user?.gameName || l.user?.name || "Usuario"} — {l.type === "IN" ? "Entrada" : "Salida"}</div>
                {l.note && (<div className="text-sm opacity-70 truncate max-w-[70vw] sm:max-w-[50vw]">{l.note}</div>)}
              </div>
              <ClientTime className="text-sm opacity-70 shrink-0" iso={new Date(l.createdAt).toISOString()} />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function TopCard({ title, data }: { title: string; data: { userId: string; name: string | null; gameName: string | null; ms: number; } | null; }) {
  const display = data ? data.gameName || data.name || "Usuario" : "—";
  const ms = data?.ms ?? 0;
  const h = Math.floor(ms / 3600000); const m = Math.floor((ms % 3600000) / 60000); const s = Math.floor((ms % 60000) / 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  const time = `${pad(h)}:${pad(m)}:${pad(s)}`;
  return (
    <div className="rounded border p-4">
      <div className="text-sm opacity-70">{title}</div>
      <div className="text-xl font-semibold truncate" title={display}>{display}</div>
      <div className="text-sm opacity-70 font-mono">{ms ? time : "Sin datos"}</div>
    </div>
  );
}
