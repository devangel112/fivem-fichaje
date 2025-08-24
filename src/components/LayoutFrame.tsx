"use client";
import { Sidebar } from "@/components/Sidebar";
import { useSession } from "next-auth/react";
import { useEffect } from "react";

type Role = "EMPLEADO" | "ENCARGADO" | "DUENO" | "VISITANTE";

export function LayoutFrame({ children }: { children: React.ReactNode }) {
  const { data, update } = useSession();
  const role = (data?.user?.role as Role | undefined) ?? "VISITANTE";

  const showSidebar = role === "EMPLEADO" || role === "ENCARGADO" || role === "DUENO";

  // Refresco proactivo del rol cada 60s (llama a session.update -> trigger:"update")
  useEffect(() => {
    let timer: number | undefined;
    // solo si hay sesión
    if (data && typeof update === "function") {
      timer = window.setInterval(() => {
        update();
      }, 60_000);
    }
    return () => {
      if (timer !== undefined) window.clearInterval(timer);
    };
  }, [data, update]);

  return (
    <div className="min-h-screen">
      {showSidebar ? (
        <aside className="fixed left-0 top-0 h-screen w-64 bg-neutral-900 text-neutral-100 border-r border-neutral-800 overflow-y-auto">
          <Sidebar />
        </aside>
      ) : null}
      <main className={showSidebar ? "ml-64 p-4 md:p-6" : "ml-0 p-4 md:p-6"}>{children}</main>
    </div>
  );
}
