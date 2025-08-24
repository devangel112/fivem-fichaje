"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { roleLabels } from "@/constants/roles";

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [gameName, setGameName] = useState("");
  const [role, setRole] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string>("");

  useEffect(() => {
    if (status === "loading") return;
    if (!session?.user) return router.push("/login");
    (async () => {
      const r = await fetch("/api/profile");
      if (r.ok) {
        const j = await r.json();
        setGameName(j.user?.gameName ?? "");
        setRole(j.user?.role ?? "");
      }
    })();
  }, [status, session, router]);

  const save = async () => {
    setSaving(true);
    setMsg("");
    try {
      await fetch("/api/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ gameName }) });
      setMsg("Guardado");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Mi perfil</h1>
        <p className="text-sm text-neutral-400 mt-1">Actualiza tu nombre en el juego y revisa tu rol.</p>
      </div>

      <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 shadow-sm">
        <div className="p-5 border-b border-neutral-800 flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-neutral-800 overflow-hidden flex items-center justify-center relative">
            {session?.user?.image ? (
              <Image src={session.user.image} alt={session.user.name ?? "avatar"} fill className="object-cover" />
            ) : (
              <span className="text-neutral-500 text-sm">SIN FOTO</span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-base font-medium truncate">{session?.user?.name ?? "Usuario"}</div>
            <div className="mt-1">
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                role === "DUENO" ? "bg-indigo-600/20 text-indigo-300 border border-indigo-700/40" :
                role === "ENCARGADO" ? "bg-emerald-600/20 text-emerald-300 border border-emerald-700/40" :
                role === "EMPLEADO" ? "bg-neutral-700/40 text-neutral-200 border border-neutral-600/40" :
                "bg-amber-600/20 text-amber-300 border border-amber-700/40"
              }`}>{role ? roleLabels[role as keyof typeof roleLabels] : "—"}</span>
            </div>
          </div>
        </div>

        <div className="p-5 space-y-4">
          <div className="space-y-2">
            <label className="block text-sm text-neutral-300">Nombre dentro del juego</label>
            <input
              className="w-full rounded-lg bg-neutral-900 border border-neutral-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600/50 focus:border-indigo-600/50"
              value={gameName}
              onChange={(e) => setGameName(e.target.value)}
              placeholder="Apodo/IC"
              maxLength={64}
            />
            <p className="text-xs text-neutral-500">Se usará por defecto en listados, saludos y actividad.</p>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-500 disabled:opacity-50"
              disabled={saving}
              onClick={save}
            >
              {saving ? "Guardando…" : "Guardar cambios"}
            </button>
            {msg && <span className="text-sm text-neutral-300">{msg}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
