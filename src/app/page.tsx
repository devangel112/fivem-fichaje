import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth/config";

export default async function Home() {
  const session = await getServerSession(authOptions);
  const loggedIn = !!session?.user;
  const role = session?.user?.role;
  return (
    <div className="min-h-screen flex items-center justify-center p-10">
      <div className="max-w-md w-full text-center space-y-6">
        <h1 className="text-3xl font-semibold">Sistema de Fichajes</h1>
        <p className="opacity-80">Conecta tu Discord y registra entradas/salidas. Dashboard con roles.</p>
        <div className="flex gap-3 justify-center">
          {loggedIn ? (
            <Link href={role === "VISITANTE" ? "/landing" : "/dashboard"} className="rounded bg-black text-white px-4 py-2">Entrar</Link>
          ) : (
            <Link href="/login" className="rounded bg-indigo-600 text-white px-4 py-2">Iniciar sesión</Link>
          )}
          <Link href="/api/auth/signin" className="rounded border px-4 py-2">Auth</Link>
        </div>
      </div>
    </div>
  );
}
