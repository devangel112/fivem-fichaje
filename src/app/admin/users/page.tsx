"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { roleLabels } from "@/constants/roles";

type Role = "EMPLEADO" | "ENCARGADO" | "DUENO";
type User = { id: string; name: string | null; gameName: string | null; role: Role; active: boolean; discordId: string | null };

export default function AdminUsersPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "loading") return;
    if (!session?.user) return router.push("/login");
    if (session.user.role !== "DUENO") return router.push("/dashboard");
    (async () => {
      setLoading(true);
      const res = await fetch("/api/admin/users");
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users);
      }
      setLoading(false);
    })();
  }, [status, session, router]);

  const updateUser = async (id: string, patch: Partial<Pick<User, "role" | "active" | "gameName">>) => {
    const res = await fetch("/api/admin/users", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, ...patch }) });
    if (res.ok) {
      const { user } = await res.json();
      setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, ...user } : u)));
    } else {
      const text = await res.text();
      alert(text || "Error al actualizar");
    }
  };

  if (loading) return <div className="p-6">Cargando...</div>;

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Administración de usuarios</h1>
      <div className="overflow-x-auto border border-neutral-800 rounded bg-neutral-900">
        <table className="min-w-full text-sm text-neutral-200 table-fixed">
          <thead className="bg-neutral-950">
            <tr>
              <th className="text-left p-2 text-neutral-400">Nombre</th>
              <th className="text-left p-2 text-neutral-400">Nombre en juego</th>
              <th className="text-left p-2 text-neutral-400 hidden sm:table-cell">Discord ID</th>
              <th className="text-left p-2 text-neutral-400">Rol</th>
              <th className="text-left p-2 text-neutral-400 hidden sm:table-cell">Estado</th>
              <th className="text-left p-2 text-neutral-400">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-neutral-800 hover:bg-neutral-800/50">
                <td className="p-2 max-w-[160px] truncate sm:max-w-none" title={u.name || undefined}>{u.name || "—"}</td>
                <td className="p-2">
                  <input
                    className="border border-neutral-700 bg-neutral-900 text-neutral-100 rounded p-1 w-full"
                    value={u.gameName ?? ""}
                    onChange={(e) => setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, gameName: e.target.value } : x)))}
                    onBlur={() => updateUser(u.id, { gameName: u.gameName ?? "" })}
                    placeholder="Apodo en el juego"
                  />
                </td>
                <td className="p-2 font-mono text-xs hidden sm:table-cell truncate" title={u.discordId || undefined}>{u.discordId ?? "—"}</td>
                <td className="p-2">
                  <select
                    className="border border-neutral-700 bg-neutral-900 text-neutral-100 rounded p-1"
                    value={u.role}
                    onChange={(e) => updateUser(u.id, { role: e.target.value as Role })}
                  >
          <option value="EMPLEADO">{roleLabels["EMPLEADO"]}</option>
          <option value="ENCARGADO">{roleLabels["ENCARGADO"]}</option>
          <option value="DUENO">{roleLabels["DUENO"]}</option>
                  </select>
                </td>
                <td className="p-2 hidden sm:table-cell">{u.active ? <span className="text-green-500">Activo</span> : <span className="text-red-500">Deshabilitado</span>}</td>
                <td className="p-2 space-x-2">
                  {u.active ? (
                    <button className="px-2 py-1 border border-neutral-700 rounded text-neutral-200 hover:bg-neutral-800" onClick={() => updateUser(u.id, { active: false })}>
                      Deshabilitar
                    </button>
                  ) : (
                    <button className="px-2 py-1 border border-neutral-700 rounded text-neutral-200 hover:bg-neutral-800" onClick={() => updateUser(u.id, { active: true })}>
                      Habilitar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
