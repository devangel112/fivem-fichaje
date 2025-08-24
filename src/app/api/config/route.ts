import { prisma } from "@/server/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth/config";

// GET /api/config -> devuelve config pública (logoUrl)
export async function GET() {
  const keys = ["logoUrl", "businessName", "bonusThresholdHours", "bonusAmount"] as const;
  const cfg = await prisma.config.findMany({ where: { key: { in: keys as unknown as string[] } } });
  const map = new Map(cfg.map((c: { key: string; value: string | null }) => [c.key, c.value] as const));
  return Response.json({
    logoUrl: map.get("logoUrl") ?? null,
    businessName: map.get("businessName") ?? null,
    bonusThresholdHours: map.get("bonusThresholdHours") ?? null,
    bonusAmount: map.get("bonusAmount") ?? null,
  });
}

// PATCH /api/config { logoUrl?: string }
export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  const role = (session?.user && "role" in session.user ? (session.user as { role?: string }).role : undefined);
  if (role !== "DUENO") {
    return new Response("Forbidden", { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  const logoUrl = typeof body.logoUrl === "string" ? body.logoUrl.trim() : undefined;
  const businessName = typeof body.businessName === "string" ? body.businessName.trim() : undefined;
  const bonusThresholdHours = body.bonusThresholdHours !== undefined ? Number(body.bonusThresholdHours) : undefined;
  const bonusAmount = body.bonusAmount !== undefined ? Number(body.bonusAmount) : undefined;
  if (
    logoUrl === undefined &&
    businessName === undefined &&
    bonusThresholdHours === undefined &&
    bonusAmount === undefined
  ) {
    return new Response("Bad Request", { status: 400 });
  }
  if (logoUrl !== undefined) {
    await prisma.config.upsert({ where: { key: "logoUrl" }, update: { value: logoUrl }, create: { key: "logoUrl", value: logoUrl } });
  }
  if (businessName !== undefined) {
    await prisma.config.upsert({ where: { key: "businessName" }, update: { value: businessName }, create: { key: "businessName", value: businessName } });
  }
  if (bonusThresholdHours !== undefined && !Number.isNaN(bonusThresholdHours)) {
    await prisma.config.upsert({ where: { key: "bonusThresholdHours" }, update: { value: String(bonusThresholdHours) }, create: { key: "bonusThresholdHours", value: String(bonusThresholdHours) } });
  }
  if (bonusAmount !== undefined && !Number.isNaN(bonusAmount)) {
    await prisma.config.upsert({ where: { key: "bonusAmount" }, update: { value: String(bonusAmount) }, create: { key: "bonusAmount", value: String(bonusAmount) } });
  }
  return Response.json({ ok: true, logoUrl, businessName, bonusThresholdHours, bonusAmount });
}
