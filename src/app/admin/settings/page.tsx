"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

type Role = "EMPLEADO" | "ENCARGADO" | "DUENO" | "VISITANTE";

export default function AdminSettingsPage() {
  const { data, status } = useSession();
  const router = useRouter();
  const role: Role | undefined = (data?.user?.role as Role | undefined);
  const [logoUrl, setLogoUrl] = useState<string>("");
  const [businessName, setBusinessName] = useState<string>("Mi Negocio");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string>("");
  const [bonusThresholdHours, setBonusThresholdHours] = useState<number>(10);
  const [bonusAmount, setBonusAmount] = useState<number>(5000);

  useEffect(() => {
    if (status === "loading") return;
    if (!role) return; // not logged in yet
    if (role !== "DUENO") {
      router.replace("/dashboard");
      return;
    }
  fetch("/api/config", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        setLogoUrl(j.logoUrl ?? "");
        setBusinessName(j.businessName?.trim() || "Mi Negocio");
    if (j.bonusThresholdHours !== null && j.bonusThresholdHours !== undefined) setBonusThresholdHours(Number(j.bonusThresholdHours) || 0);
    if (j.bonusAmount !== null && j.bonusAmount !== undefined) setBonusAmount(Number(j.bonusAmount) || 0);
      })
      .finally(() => setLoading(false));
  }, [role, status, router]);

  async function save() {
    setSaving(true);
    setMsg("");
    try {
      if (file) {
        const fd = new FormData();
        fd.append("file", file);
        const up = await fetch("/api/config/logo", { method: "POST", body: fd });
        if (!up.ok) throw new Error("Error upload");
        const j = await up.json();
        setLogoUrl(j.logoUrl ?? logoUrl);
        setFile(null);
        setMsg("Logo subido");
    } else {
        const res = await fetch("/api/config", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ logoUrl, businessName, bonusThresholdHours, bonusAmount }),
        });
        if (!res.ok) throw new Error("Error");
        try {
          const j = await res.json();
      if (j?.logoUrl !== undefined) setLogoUrl(j.logoUrl ?? "");
    if (j?.businessName !== undefined) setBusinessName(j.businessName || "Mi Negocio");
    if (j?.bonusThresholdHours !== undefined) setBonusThresholdHours(Number(j.bonusThresholdHours) || 0);
    if (j?.bonusAmount !== undefined) setBonusAmount(Number(j.bonusAmount) || 0);
        } catch {}
        setMsg("Guardado");
      }
    } catch {
      setMsg("No se pudo guardar");
    } finally {
      setSaving(false);
    }
    // Notificar a la app que el logo cambió
    try {
      window.dispatchEvent(new CustomEvent("app:logoUpdated", { detail: { logoUrl } }));
  window.dispatchEvent(new CustomEvent("app:businessNameUpdated", { detail: { businessName } }));
  window.dispatchEvent(new CustomEvent("app:bonusUpdated", { detail: { bonusThresholdHours, bonusAmount } }));
    } catch {}
  }

  async function removeLogo() {
    setSaving(true);
    setMsg("");
    try {
      const res = await fetch("/api/config/logo", { method: "DELETE" });
      if (!res.ok) throw new Error("Error");
      setLogoUrl("");
      setFile(null);
      setMsg("Logo eliminado");
    } catch {
      setMsg("No se pudo eliminar");
    } finally {
      setSaving(false);
    }
    try {
      window.dispatchEvent(new CustomEvent("app:logoUpdated", { detail: { logoUrl: null } }));
    } catch {}
  }

  if (loading) return <div className="px-4 py-6">Cargando…</div>;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Configuraciones</h1>
        <p className="text-sm text-neutral-400 mt-1">Personaliza la apariencia del sistema.</p>
      </div>

      <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-neutral-800">
          <h2 className="text-sm font-medium text-neutral-200">Apariencia</h2>
        </div>

        <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="md:col-span-2 space-y-4">
            <div className="space-y-2">
              <label className="block text-sm text-neutral-300">Nombre del negocio</label>
              <input
                type="text"
                className="w-full rounded-lg bg-neutral-900 border border-neutral-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600/50 focus:border-indigo-600/50"
                placeholder="Mi Negocio"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                maxLength={80}
              />
              <p className="text-xs text-neutral-500">Se mostrará en el encabezado del menú.</p>
            </div>
            <div className="space-y-2">
              <label className="block text-sm text-neutral-300">URL del logotipo</label>
              <input
                type="url"
                className="w-full rounded-lg bg-neutral-900 border border-neutral-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600/50 focus:border-indigo-600/50"
                placeholder="https://…/logo.webp"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
              />
              <p className="text-xs text-neutral-500">Recomendado formato WebP y proporción 1:1.</p>
            </div>

            <div className="space-y-2">
              <label className="block text-sm text-neutral-300">Subir imagen (se convierte a WebP)</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="block w-full text-sm file:mr-4 file:rounded-lg file:border-0 file:bg-neutral-800 file:px-4 file:py-2 file:text-sm file:text-neutral-200 hover:file:bg-neutral-700"
              />
              <p className="text-xs text-neutral-500">Máx. 5MB. Se convertirá a WebP 512×512 (recortado).</p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={save}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
              >
                {saving ? "Guardando…" : file ? "Subir y guardar" : "Guardar"}
              </button>
              <button
                onClick={removeLogo}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-lg bg-neutral-700 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-600 disabled:opacity-50"
              >
                Eliminar logo
              </button>
              {msg && <span className="text-sm text-neutral-300">{msg}</span>}
            </div>
          </div>

          <div>
            <div className="text-sm text-neutral-400 mb-2">Vista previa</div>
            <div className="w-28 h-28 rounded-lg bg-neutral-800 overflow-hidden flex items-center justify-center ring-1 ring-neutral-700">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" />
              ) : (
                <span className="text-neutral-500 text-xs">Sin logo</span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-neutral-800">
          <h2 className="text-sm font-medium text-neutral-200">Bonificaciones</h2>
        </div>
        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="space-y-2">
            <label className="block text-sm text-neutral-300">Umbral de horas por semana (L–D)</label>
            <input
              type="number"
              min={0}
              step={0.5}
              className="w-full rounded-lg bg-neutral-900 border border-neutral-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600/50 focus:border-indigo-600/50"
              value={bonusThresholdHours}
              onChange={(e) => setBonusThresholdHours(Number(e.target.value))}
            />
            <p className="text-xs text-neutral-500">Si un empleado supera este umbral semanal, aplica la “Prima máxima”.</p>
          </div>
          <div className="space-y-2">
            <label className="block text-sm text-neutral-300">Monto de “Prima máxima” (USD)</label>
            <input
              type="number"
              min={0}
              step={100}
              className="w-full rounded-lg bg-neutral-900 border border-neutral-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600/50 focus:border-indigo-600/50"
              value={bonusAmount}
              onChange={(e) => setBonusAmount(Number(e.target.value))}
            />
            <p className="text-xs text-neutral-500">Cantidad mostrada cuando se cumple el umbral semanal.</p>
          </div>
        </div>
        <div className="px-5 pb-5">
          <button
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
          >{saving ? "Guardando…" : "Guardar cambios"}</button>
          {msg && <span className="ml-3 text-sm text-neutral-300">{msg}</span>}
        </div>
      </div>
    </div>
  );
}
