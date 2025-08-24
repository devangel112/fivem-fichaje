"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { Role } from "@/constants/roles";
import { useEffect, useMemo, useState } from "react";

// Role type unificado

const NAV_ITEMS: { href: string; label: string; roles: Role[] }[] = [
  { href: "/landing", label: "Inicio", roles: ["VISITANTE"] },
  { href: "/profile", label: "Perfil", roles: ["EMPLEADO", "ENCARGADO", "DUENO", "VISITANTE"] },
  { href: "/dashboard", label: "Dashboard", roles: ["EMPLEADO", "ENCARGADO", "DUENO"] },
  { href: "/clock", label: "Fichaje", roles: ["EMPLEADO", "ENCARGADO", "DUENO"] },
  { href: "/activity", label: "Registros", roles: ["ENCARGADO", "DUENO"] },
  { href: "/sessions", label: "Sesiones de trabajo", roles: ["ENCARGADO", "DUENO"] },
  { href: "/manager/users", label: "Usuarios", roles: ["ENCARGADO"] },
  { href: "/admin/users", label: "Usuarios", roles: ["DUENO"] },
  { href: "/admin/settings", label: "Configuraciones", roles: ["DUENO"] },
];

export function Sidebar() {
  const { data } = useSession();
  const pathname = usePathname();
  const role: Role = (data?.user?.role as Role) || "VISITANTE";

  const items = NAV_ITEMS.filter((i) => i.roles.includes(role));

  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [businessName, setBusinessName] = useState<string>("Mi Negocio");
  const [bust, setBust] = useState<number>(0);
  useEffect(() => {
    // Carga logo dinámico
    fetch("/api/config", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        setLogoUrl(j.logoUrl ?? null);
        if (typeof j.businessName === "string" && j.businessName.trim()) setBusinessName(j.businessName);
      })
      .catch(() => setLogoUrl(null));
    const handler = (e: Event) => {
      const ce = e as CustomEvent<{ logoUrl: string | null } | undefined>;
      const next = ce?.detail?.logoUrl ?? null;
      setLogoUrl(next);
      setBust(Date.now());
    };
    const nameHandler = (e: Event) => {
      const ce = e as CustomEvent<{ businessName?: string } | undefined>;
      const name = ce?.detail?.businessName;
      if (typeof name === "string") setBusinessName(name || "Mi Negocio");
    };
    window.addEventListener("app:logoUpdated", handler);
    window.addEventListener("app:businessNameUpdated", nameHandler);
    return () => {
      window.removeEventListener("app:logoUpdated", handler);
      window.removeEventListener("app:businessNameUpdated", nameHandler);
    };
  }, []);

  const logoSrc = useMemo(() => {
    if (!logoUrl) return null;
    const sep = logoUrl.includes("?") ? "&" : "?";
    return `${logoUrl}${sep}v=${bust || 0}`;
  }, [logoUrl, bust]);

  return (
    <nav className="p-4 space-y-1 text-sm">
      <div className="px-3 py-4 flex items-center gap-3">
    {logoSrc ? (
          // imagen cuadrada, contenedor fijo
          <div className="w-12 h-12 rounded bg-neutral-800 overflow-hidden flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={logoSrc} alt="Logo" className="w-full h-full object-cover" />
          </div>
        ) : (
          <div className="w-12 h-12 rounded bg-neutral-800 flex items-center justify-center text-neutral-400 text-xs select-none">
            LOGO
          </div>
        )}
        <div className="min-w-0">
          <div className="text-sm font-medium truncate">{businessName || "Mi Negocio"}</div>
          <div className="text-[11px] text-neutral-400">Sistema de fichaje</div>
        </div>
      </div>
      <div className="px-3 py-3 uppercase text-xs tracking-wide text-neutral-400">Menú</div>
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(item.href + "/");
        const base = "block px-3 py-2 rounded transition-colors";
        const state = active
          ? "bg-neutral-800 text-white"
          : "text-neutral-300 hover:bg-neutral-800 hover:text-white";
        return (
          <Link key={item.href} href={item.href} className={`${base} ${state}`}>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
