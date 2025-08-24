"use client";
import { SessionProvider } from "next-auth/react";

export function Providers({ children }: { children: React.ReactNode }) {
  // refetchInterval: fuerza actualización de la sesión (y rol) cada 60s
  return <SessionProvider refetchInterval={60}>{children}</SessionProvider>;
}
