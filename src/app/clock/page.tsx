"use client";
import { useEffect, useState } from "react";

type Log = {
  id: string;
  type: "IN" | "OUT";
  createdAt: string;
  note?: string | null;
};
type WorkSession = {
  startedAt: string;
  endedAt: string;
  durationMs: number;
  note?: string | null;
};

export default function ClockPage() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeStart, setActiveStart] = useState<string | null>(null);
  const [now, setNow] = useState<number>(Date.now());
  const [sessions, setSessions] = useState<WorkSession[]>([]);
  const [summary, setSummary] = useState<{
    todayMs: number;
    weekMs: number;
    monthMs: number;
  } | null>(null);
  const [absences, setAbsences] = useState<Array<{ id: string; startAt: string; endAt: string; reason: string | null }>>([]);
  const [newAbsStart, setNewAbsStart] = useState<string>("");
  const [newAbsEnd, setNewAbsEnd] = useState<string>("");
  const [newAbsReason, setNewAbsReason] = useState<string>("");
  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editStart, setEditStart] = useState<string>("");
  const [editEnd, setEditEnd] = useState<string>("");
  const [editReason, setEditReason] = useState<string>("");

  async function load() {
    const res = await fetch("/api/clock", { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    setLogs(data.logs);
    setActiveStart(data.activeStart ?? null);
    setSessions(data.sessions ?? []);
    setSummary(data.summary ?? null);
    try {
      const a = await fetch("/api/absences", { cache: "no-store" });
      if (a.ok) {
        const rows = await a.json();
        setAbsences(rows);
      }
    } catch {}
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    let t: ReturnType<typeof setInterval> | undefined;
    if (activeStart) {
      t = setInterval(() => setNow(Date.now()), 1000);
    }
    return () => {
      if (t) clearInterval(t);
    };
  }, [activeStart]);

  async function punch(type: "IN" | "OUT") {
    setLoading(true);
    try {
      const res = await fetch("/api/clock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });
      if (res.ok) await load();
    } finally {
      setLoading(false);
    }
  }

  async function createAbsence() {
    if (!newAbsStart || !newAbsEnd) return;
    // Interpretar inputs date como rangos completos del día local
    const start = new Date(newAbsStart);
    start.setHours(0,0,0,0);
    const end = new Date(newAbsEnd);
    end.setHours(23,59,59,999);
    const payload = { startAt: start.toISOString(), endAt: end.toISOString(), reason: newAbsReason || undefined };
    const res = await fetch("/api/absences", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (res.ok) {
      setNewAbsStart(""); setNewAbsEnd(""); setNewAbsReason("");
      await load();
    }
  }

  function startEdit(a: { id: string; startAt: string; endAt: string; reason: string | null }) {
    setEditingId(a.id);
    // Pre-fill with local date strings (YYYY-MM-DD)
    const d1 = new Date(a.startAt); const d2 = new Date(a.endAt);
    const toLocalDate = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset()*60000).toISOString().slice(0,10);
    setEditStart(toLocalDate(d1));
    setEditEnd(toLocalDate(d2));
    setEditReason(a.reason || "");
  }

  function cancelEdit() {
    setEditingId(null);
    setEditStart(""); setEditEnd(""); setEditReason("");
  }

  async function saveEdit(id: string) {
    if (!editStart || !editEnd) return;
    const s = new Date(editStart); s.setHours(0,0,0,0);
    const e = new Date(editEnd); e.setHours(23,59,59,999);
    const payload: { startAt: string; endAt: string; reason?: string | null } = { startAt: s.toISOString(), endAt: e.toISOString() };
    payload.reason = editReason === "" ? null : editReason;
    const res = await fetch(`/api/absences/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (res.ok) {
      cancelEdit();
      await load();
    }
  }

  async function deleteAbsence(id: string) {
    if (typeof window !== "undefined") {
      const ok = window.confirm("¿Seguro que deseas cancelar esta ausencia?");
      if (!ok) return;
    }
    const res = await fetch(`/api/absences/${id}`, { method: "DELETE" });
    if (res.ok) await load();
  }

  return (
    <div className="p-6 space-y-8">
      <div className="flex items-center gap-4">
        <button
          disabled={loading || !!activeStart}
          onClick={() => punch("IN")}
          className="rounded bg-green-600 disabled:opacity-50 text-white px-4 py-2"
        >
          Empezar jornada
        </button>
        <button
          disabled={loading || !activeStart}
          onClick={() => punch("OUT")}
          className="rounded bg-red-600 disabled:opacity-50 text-white px-4 py-2"
        >
          Finalizar jornada
        </button>
        <div className="ml-auto text-xl tabular-nums">
          {activeStart ? (
            (() => {
              const start = new Date(activeStart).getTime();
              const diff = Math.max(0, now - start);
              const h = Math.floor(diff / 3600000);
              const m = Math.floor((diff % 3600000) / 60000);
              const s = Math.floor((diff % 60000) / 1000);
              const pad = (n: number) => String(n).padStart(2, "0");
              return (
                <span className="font-mono">
                  {pad(h)}:{pad(m)}:{pad(s)}
                </span>
              );
            })()
          ) : (
            <span className="opacity-70">No tienes una jornada activa</span>
          )}
        </div>
      </div>
      {summary && (
        <div className="grid gap-4 md:grid-cols-3">
          <SummaryCard title="Hoy" ms={summary.todayMs} />
          <SummaryCard title="Esta semana" ms={summary.weekMs} />
          <SummaryCard title="Este mes" ms={summary.monthMs} />
        </div>
      )}
      <div className="grid gap-8 md:grid-cols-2">
        <div>
          <h2 className="text-xl font-semibold mb-2">Últimas sesiones</h2>
          <ul className="space-y-2">
            {sessions.map((s, i) => (
              <li
                key={i}
                className="rounded border p-3 flex items-center justify-between"
              >
                <div>
                  <div className="text-sm opacity-70">
                    {new Date(s.startedAt).toLocaleString()} →{" "}
                    {new Date(s.endedAt).toLocaleString()}
                  </div>
                </div>
                <div className="font-mono">
                  {(() => {
                    const ms = s.durationMs;
                    const h = Math.floor(ms / 3600000);
                    const m = Math.floor((ms % 3600000) / 60000);
                    const s2 = Math.floor((ms % 60000) / 1000);
                    const pad = (n: number) => String(n).padStart(2, "0");
                    return `${pad(h)}:${pad(m)}:${pad(s2)}`;
                  })()}
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="text-xl font-semibold mb-2">Actividad reciente</h2>
          <ul className="space-y-2">
            {logs.map((l) => (
              <li
                key={l.id}
                className="rounded border p-3 flex items-center justify-between"
              >
                <div className="font-medium">
                  {l.type === "IN" ? "Entrada" : "Salida"}
                </div>
                <div className="text-sm opacity-70">
                  {new Date(l.createdAt).toLocaleString()
                  }
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="grid gap-8 md:grid-cols-2">
        <div className="md:col-span-2">
          <h2 className="text-xl font-semibold mb-2">Ausencias</h2>
          <div className="rounded border p-4 space-y-4">
            <div className="grid md:grid-cols-4 gap-3 items-end">
              <div>
                <label className="block text-xs opacity-70 mb-1">Desde</label>
                <input type="date" className="w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1" value={newAbsStart} onChange={e => setNewAbsStart(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs opacity-70 mb-1">Hasta</label>
                <input type="date" className="w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1" value={newAbsEnd} onChange={e => setNewAbsEnd(e.target.value)} />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs opacity-70 mb-1">Motivo (opcional)</label>
                <input type="text" className="w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1" value={newAbsReason} onChange={e => setNewAbsReason(e.target.value)} placeholder="Vacaciones, permiso, etc." />
              </div>
              <div>
                <button onClick={createAbsence} className="rounded bg-neutral-800 hover:bg-neutral-700 text-white px-3 py-1.5">Agregar</button>
              </div>
            </div>
            <div className="rounded border overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-neutral-900 text-neutral-200">
                  <tr>
                    <th className="text-left p-2">Inicio</th>
                    <th className="text-left p-2">Fin</th>
                    <th className="text-left p-2">Motivo</th>
                    <th className="text-left p-2">Estado</th>
                    <th className="text-left p-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {absences.length === 0 && (
                    <tr><td className="p-2" colSpan={5}>Sin ausencias</td></tr>
                  )}
                  {absences.map(a => {
                    const nowTs = Date.now();
                    const st = new Date(a.startAt).getTime();
                    const en = new Date(a.endAt).getTime();
                    const state = nowTs < st ? "Programada" : nowTs > en ? "Finalizada" : "En curso";
                    const isEditing = editingId === a.id;
                    return (
                      <tr key={a.id} className="border-t border-neutral-800">
                        <td className="p-2 whitespace-nowrap">
                          {isEditing ? (
                            <input type="date" className="bg-neutral-900 border border-neutral-700 rounded px-2 py-1" value={editStart} onChange={e=>setEditStart(e.target.value)} />
                          ) : (
                            new Date(a.startAt).toLocaleDateString()
                          )}
                        </td>
                        <td className="p-2 whitespace-nowrap">
                          {isEditing ? (
                            <input type="date" className="bg-neutral-900 border border-neutral-700 rounded px-2 py-1" value={editEnd} onChange={e=>setEditEnd(e.target.value)} />
                          ) : (
                            new Date(a.endAt).toLocaleDateString()
                          )}
                        </td>
                        <td className="p-2">
                          {isEditing ? (
                            <input type="text" className="w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1" value={editReason} onChange={e=>setEditReason(e.target.value)} />
                          ) : (
                            a.reason || ""
                          )}
                        </td>
                        <td className="p-2">{state}</td>
                        <td className="p-2 whitespace-nowrap space-x-2">
                          {isEditing ? (
                            <>
                              <button onClick={() => saveEdit(a.id)} className="rounded bg-green-700 hover:bg-green-600 px-2 py-1">Guardar</button>
                              <button onClick={cancelEdit} className="rounded bg-neutral-800 hover:bg-neutral-700 px-2 py-1">Descartar</button>
                            </>
                          ) : (
                            <>
                              <button onClick={() => startEdit(a)} className="rounded bg-neutral-800 hover:bg-neutral-700 px-2 py-1">Editar</button>
                              <button onClick={() => deleteAbsence(a.id)} className="rounded bg-red-700 hover:bg-red-600 px-2 py-1">Cancelar ausencia</button>
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ title, ms }: { title: string; ms: number }) {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    <div className="rounded border p-4">
      <div className="text-sm opacity-70">{title}</div>
      <div className="text-2xl font-semibold font-mono">
        {pad(h)}:{pad(m)}:{pad(s)}
      </div>
    </div>
  );
}
