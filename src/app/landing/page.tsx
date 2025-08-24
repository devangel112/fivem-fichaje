import { getServerSession } from "next-auth";
import { authOptions } from "@/auth/config";
import Link from "next/link";
import { roleLabels } from "@/constants/roles";

export default async function Landing() {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role;
  return (
    <div className="p-10 max-w-2xl mx-auto space-y-6">
      <h1 className="text-3xl font-semibold">Bienvenido</h1>
    {role === "VISITANTE" ? (
        <>
      <p className="opacity-80">Tu cuenta está como “{roleLabels["VISITANTE"]}”. No tienes acceso a actividad ni sesiones.</p>
          <p className="opacity-80">Contacta con un Encargado/Dueño para que te asignen rol de Empleado.</p>
          <div className="flex gap-3">
            <Link href="/profile" className="rounded bg-indigo-600 text-white px-4 py-2">Completar perfil</Link>
            <Link href="/api/auth/signout" className="rounded border px-4 py-2">Cerrar sesión</Link>
          </div>
        </>
      ) : (
        <>
          <p className="opacity-80">No eres visitante. Ir al dashboard.</p>
          <Link href="/dashboard" className="rounded bg-black text-white px-4 py-2">Dashboard</Link>
        </>
      )}
    </div>
  );
}
