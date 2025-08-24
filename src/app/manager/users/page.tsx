"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { roleLabels } from "@/constants/roles";

type Role = "EMPLEADO" | "ENCARGADO" | "DUENO" | "VISITANTE";
type User = { id: string; name: string | null; gameName: string | null; role: Role; active: boolean };

export default function ManagerUsersPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "loading") return;
    if (!session?.user) return router.push("/login");
    if (session.user.role !== "ENCARGADO") return router.push("/dashboard");
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

  const setEmpleado = async (id: string) => {
    const res = await fetch("/api/admin/users", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, role: "EMPLEADO" }) });
    if (res.ok) {
      const { user } = await res.json();
      setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, ...user } : u)));
    } else {
      alert("No se pudo actualizar");
    }
  };

  if (loading) return <div className="p-6">Cargando...</div>;

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Gestión de usuarios (Encargado)</h1>
      <div className="overflow-x-auto border border-neutral-800 rounded bg-neutral-900">
        <table className="min-w-full text-sm text-neutral-200 table-fixed">
          <thead className="bg-neutral-950">
            <tr>
              <th className="text-left p-2 text-neutral-400">Nombre</th>
              <th className="text-left p-2 text-neutral-400">Nombre en juego</th>
              <th className="text-left p-2 text-neutral-400 hidden sm:table-cell">Rol</th>
              <th className="text-left p-2 text-neutral-400">Acción</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-neutral-800 hover:bg-neutral-800/50">
                <td className="p-2 max-w-[160px] truncate sm:max-w-none" title={u.name || undefined}>{u.name || "—"}</td>
                <td className="p-2 max-w-[160px] truncate sm:max-w-none" title={u.gameName || undefined}>{u.gameName || "—"}</td>
                <td className="p-2 hidden sm:table-cell">{roleLabels[u.role]}</td>
                <td className="p-2">
                  <button className="px-2 py-1 border border-neutral-700 rounded text-neutral-200 hover:bg-neutral-800" onClick={() => setEmpleado(u.id)}>
                    Poner como {roleLabels["EMPLEADO"]}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
