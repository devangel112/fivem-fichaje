"use client";
import { signIn, useSession } from "next-auth/react";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const { status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "authenticated") router.replace("/dashboard");
  }, [status, router]);

  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="max-w-sm w-full bg-white/5 border border-white/10 rounded-lg p-6 text-center">
        {status === "authenticated" ? (
          <div className="text-sm opacity-80">Entrando…</div>
        ) : (
          <>
            <h1 className="text-2xl font-semibold mb-4">Inicia sesión</h1>
            <p className="text-sm opacity-80 mb-6">Usa tu cuenta de Discord para continuar.</p>
            <button
              onClick={() => signIn("discord", { callbackUrl: "/dashboard" })}
              className="w-full rounded-md bg-indigo-600 hover:bg-indigo-500 text-white py-2.5"
            >
              Continuar con Discord
            </button>
          </>
        )}
      </div>
    </div>
  );
}
