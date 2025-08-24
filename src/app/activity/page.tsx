"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams, useRouter } from "next/navigation";

type Role = "EMPLEADO" | "ENCARGADO" | "DUENO";
type Log = {
  id: string;
  type: "IN" | "OUT" | string;
  createdAt: string;
  note?: string | null;
  user?: { id: string; name: string | null; gameName: string | null; role: Role } | null;
};

type ApiResponse = {
  data: Log[];
  page: number;
  pageSize: number;
  total: number;
  pages: number;
  summary: { in: number; out: number };
  period: { from: string; to: string };
  sort: "asc" | "desc";
  filters: { type: "IN" | "OUT" | "ALL"; userId: string | null };
};

export default function ActivityPage() {
  return (
    <Suspense fallback={<div className="p-6">Cargando actividad…</div>}>
      <ActivityContent />
    </Suspense>
  );
}

function ActivityContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const sp = useSearchParams();
  const [resp, setResp] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const isManager = (session?.user?.role === "ENCARGADO" || session?.user?.role === "DUENO");

  const q = useMemo(() => {
    const q = new URLSearchParams(sp?.toString() || "");
    if (!q.get("from") || !q.get("to")) {
      const now = new Date();
      const from = new Date(now); from.setHours(0, 0, 0, 0);
      q.set("from", from.toISOString());
      q.set("to", now.toISOString());
      if (!q.get("preset")) q.set("preset", "today");
    }
    if (!q.get("type")) q.set("type", "ALL");
    if (!q.get("page")) q.set("page", "1");
    if (!q.get("pageSize")) q.set("pageSize", "20");
    if (!q.get("sort")) q.set("sort", "desc");
    return q;
  }, [sp]);

  useEffect(() => {
    if (status === "loading") return;
    if (!isManager) return;
    const url = "/api/activity?" + q.toString();
    setLoading(true);
    fetch(url).then(async (r) => {
      if (!r.ok) throw new Error("No autorizado");
      return r.json();
    }).then((j: ApiResponse) => setResp(j)).catch(() => setResp(null)).finally(() => setLoading(false));
  }, [q, status, isManager]);

  if (status !== "authenticated") return <div className="p-6">No autenticado. Ve a /login.</div>;
  if (!isManager) return <div className="p-6">No tienes permisos para ver esta página.</div>;

  const setParam = (k: string, v: string) => {
    const next = new URLSearchParams(q);
    // reset page on any filter change
    if (["from","to","userId","type","sort","pageSize"].includes(k)) next.set("page", "1");
    // custom change clears preset
    if (["from","to","userId","type","sort","pageSize"].includes(k)) next.delete("preset");
    next.set(k, v);
    router.push("/activity?" + next.toString());
  };

  const setPreset = (key: string) => {
    const now = new Date();
    const p = new URLSearchParams(q);
    const setRange = (from: Date, to: Date) => {
      p.set("from", from.toISOString());
      p.set("to", to.toISOString());
    };
    if (key === "today") {
      const start = new Date(now); start.setHours(0,0,0,0);
      setRange(start, now);
    } else if (key === "week") {
      const d = new Date(now);
      const day = d.getDay();
      const diffToMonday = (day + 6) % 7;
      d.setDate(d.getDate() - diffToMonday);
      d.setHours(0,0,0,0);
      setRange(d, now);
    } else if (key === "month") {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      setRange(start, now);
    } else if (key === "last7") {
      const start = new Date(now); start.setDate(start.getDate() - 7); start.setHours(0,0,0,0);
      setRange(start, now);
    } else if (key === "last30") {
      const start = new Date(now); start.setDate(start.getDate() - 30); start.setHours(0,0,0,0);
      setRange(start, now);
    }
    p.set("preset", key);
    p.set("page", "1");
    router.push("/activity?" + p.toString());
  };

  const resetFilters = () => {
    const now = new Date();
    const start = new Date(now); start.setHours(0,0,0,0);
    const p = new URLSearchParams();
    p.set("from", start.toISOString());
    p.set("to", now.toISOString());
    p.set("type", "ALL");
    p.set("page", "1");
    p.set("pageSize", "20");
    p.set("sort", "desc");
    p.set("preset", "today");
    router.push("/activity?" + p.toString());
  };

  const from = q.get("from")!;
  const to = q.get("to")!;
  const preset = q.get("preset") || "";
  const type = q.get("type")!;
  const userId = q.get("userId") || "";
  const page = parseInt(q.get("page") || "1", 10);
  const pageSize = parseInt(q.get("pageSize") || "20", 10);
  const sort = (q.get("sort") as "asc" | "desc") || "desc";

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Actividad del equipo</h1>
  <a className="px-3 py-1.5 rounded bg-neutral-800 text-white hover:bg-neutral-700" href={(() => { const p = new URLSearchParams(q.toString()); p.set("format", "csv"); return "/api/activity?" + p.toString(); })()}>Exportar CSV</a>
      </div>
      <Presets selected={preset} onPick={setPreset} onReset={resetFilters} />
      <Filters from={from} to={to} type={type} userId={userId} onChange={setParam} sort={sort} pageSize={pageSize} />
      <Summary loading={loading} resp={resp} />
      <Table loading={loading} resp={resp} />
      <Pagination resp={resp} setParam={setParam} page={page} />
    </div>
  );
}

function Presets({ selected, onPick, onReset }: { selected: string; onPick: (key: string) => void; onReset: () => void }) {
  const buttons = [
    {k:"today", l:"Hoy"},
    {k:"week", l:"Esta semana"},
    {k:"month", l:"Este mes"},
    {k:"last7", l:"Últimos 7 días"},
    {k:"last30", l:"Últimos 30 días"},
  ];
  return (
    <div className="flex flex-wrap gap-2 items-center">
      {buttons.map(p => {
        const isActive = selected === p.k;
        const base = "px-3 py-1.5 rounded border cursor-pointer transition-colors";
        const active = "bg-indigo-600 text-white border-indigo-500 shadow-sm shadow-indigo-500/30 hover:bg-indigo-500";
        const inactive = "border-neutral-700 hover:bg-neutral-800";
        return (
          <button
            key={p.k}
            aria-pressed={isActive}
            className={`${base} ${isActive ? active : inactive}`}
            onClick={() => onPick(p.k)}
          >{p.l}</button>
        );
      })}
      <button className="px-3 py-1.5 rounded border cursor-pointer hover:bg-neutral-800 border-neutral-700 transition-colors" onClick={onReset}>Reiniciar filtros</button>
    </div>
  );
}

function Filters(props: { from: string; to: string; type: string; userId: string; sort: "asc" | "desc"; pageSize: number; onChange: (k: string, v: string) => void }) {
  const [users, setUsers] = useState<Array<{ id: string; name: string | null; gameName: string | null }> | null>(null);
  useEffect(() => {
    fetch("/api/users").then(r => r.ok ? r.json() : []).then(setUsers).catch(() => setUsers([]));
  }, []);
  const onDate = (k: "from" | "to", v: string) => {
    const d = new Date(v);
    if (isNaN(d.getTime())) return;
    props.onChange(k, d.toISOString());
  };
  const toInput = (iso: string) => new Date(iso).toISOString().slice(0, 16);
  return (
    <div className="rounded border p-4 grid md:grid-cols-6 gap-3 items-end">
      <div>
        <label className="block text-xs opacity-70 mb-1">Desde</label>
        <input type="datetime-local" className="w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1" value={toInput(props.from)} onChange={e => onDate("from", e.target.value)} />
      </div>
      <div>
        <label className="block text-xs opacity-70 mb-1">Hasta</label>
        <input type="datetime-local" className="w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1" value={toInput(props.to)} onChange={e => onDate("to", e.target.value)} />
      </div>
      <div>
        <label className="block text-xs opacity-70 mb-1">Tipo</label>
        <select className="w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1" value={props.type} onChange={e => props.onChange("type", e.target.value)}>
          <option value="ALL">Todos</option>
          <option value="IN">Entrada</option>
          <option value="OUT">Salida</option>
        </select>
      </div>
      <div>
        <label className="block text-xs opacity-70 mb-1">Usuario</label>
        <select className="w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1" value={props.userId} onChange={e => props.onChange("userId", e.target.value)}>
          <option value="">Todos</option>
          {users?.map(u => (
            <option key={u.id} value={u.id}>{u.gameName || u.name || "Usuario"}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs opacity-70 mb-1">Orden</label>
        <select className="w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1" value={props.sort} onChange={e => props.onChange("sort", e.target.value)}>
          <option value="desc">Más reciente</option>
          <option value="asc">Más antiguo</option>
        </select>
      </div>
      <div>
        <label className="block text-xs opacity-70 mb-1">Por página</label>
        <select className="w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1" value={String(props.pageSize)} onChange={e => props.onChange("pageSize", e.target.value)}>
          {[10,20,50,100].map(n => <option key={n} value={n}>{n}</option>)}
        </select>
      </div>
    </div>
  );
}

function Summary({ loading, resp }: { loading: boolean; resp: ApiResponse | null }) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <div className="rounded border p-4"><div className="text-xs opacity-70">Total</div><div className="text-2xl font-semibold">{resp?.total ?? (loading ? "…" : 0)}</div></div>
      <div className="rounded border p-4"><div className="text-xs opacity-70">Entradas</div><div className="text-2xl font-semibold">{resp?.summary.in ?? (loading ? "…" : 0)}</div></div>
      <div className="rounded border p-4"><div className="text-xs opacity-70">Salidas</div><div className="text-2xl font-semibold">{resp?.summary.out ?? (loading ? "…" : 0)}</div></div>
    </div>
  );
}

function Table({ loading, resp }: { loading: boolean; resp: ApiResponse | null }) {
  return (
    <div className="rounded border overflow-x-auto">
      <table className="min-w-full text-sm table-fixed">
        <thead className="bg-neutral-900 text-neutral-200">
          <tr>
            <th className="text-left p-2">Fecha</th>
            <th className="text-left p-2">Usuario</th>
            <th className="text-left p-2">Tipo</th>
            <th className="text-left p-2 hidden sm:table-cell">Nota</th>
          </tr>
        </thead>
        <tbody>
          {loading && <tr><td className="p-2" colSpan={4}>Cargando…</td></tr>}
          {!loading && resp?.data.length === 0 && <tr><td className="p-2" colSpan={4}>Sin resultados</td></tr>}
          {resp?.data.map((r) => {
            const uname = r.user?.gameName || r.user?.name || r.user?.id || "Usuario";
            return (
              <tr key={r.id} className="border-t border-neutral-800">
                <td className="p-2 whitespace-nowrap text-xs sm:text-sm">{new Date(r.createdAt).toLocaleString()}</td>
                <td className="p-2 max-w-[160px] truncate sm:max-w-none" title={uname}>{uname}</td>
                <td className="p-2 whitespace-nowrap text-xs sm:text-sm">{r.type === "IN" ? "Entrada" : "Salida"}</td>
                <td className="p-2 hidden sm:table-cell max-w-[240px] truncate" title={r.note || undefined}>{r.note || ""}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Pagination({ resp, setParam, page }: { resp: ApiResponse | null; setParam: (k: string, v: string) => void; page: number }) {
  const totalPages = resp?.pages ?? 1;
  return (
    <div className="flex items-center gap-2">
  <button className="px-3 py-1.5 rounded border disabled:opacity-50 cursor-pointer" onClick={() => setParam("page", String(page - 1))} disabled={page <= 1}>Anterior</button>
      <div className="text-sm">Página {page} de {totalPages}</div>
  <button className="px-3 py-1.5 rounded border disabled:opacity-50 cursor-pointer" onClick={() => setParam("page", String(page + 1))} disabled={page >= totalPages}>Siguiente</button>
    </div>
  );
}
