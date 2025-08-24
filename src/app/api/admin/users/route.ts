import { getServerSession } from "next-auth";
import { authOptions } from "@/auth/config";
import { prisma } from "@/server/db";
import { z } from "zod";

const PatchSchema = z.object({
  id: z.string().cuid(),
  role: z.enum(["EMPLEADO", "ENCARGADO", "DUENO"]).optional(),
  active: z.boolean().optional(),
  gameName: z.string().max(64).optional(),
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "DUENO") return new Response("Forbidden", { status: 403 });
  const users = await prisma.user.findMany({ orderBy: { createdAt: "asc" }, include: { accounts: { where: { provider: "discord" }, select: { providerAccountId: true } } } });
  const shaped = users.map((u: { id: string; name: string | null; gameName: string | null; role: string; active: boolean; accounts: { providerAccountId: string }[] }) => ({
    id: u.id,
    name: u.name,
    gameName: u.gameName,
    role: u.role,
    active: u.active,
    email: null as string | null, // ocultar email en API del admin UI
    discordId: u.accounts[0]?.providerAccountId ?? null,
  }));
  return Response.json({ users: shaped });
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "DUENO") return new Response("Forbidden", { status: 403 });
  const body = await req.json().catch(() => null);
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) return new Response("Invalid body", { status: 400 });

  const { id, role, active, gameName } = parsed.data;

  // Protección: no dejar el sistema sin al menos un DUENO
  if (role && role !== "DUENO") {
    const target = await prisma.user.findUnique({ where: { id } });
    if (target?.role === "DUENO") {
      const owners = await prisma.user.count({ where: { role: "DUENO", id: { not: id } } });
      if (owners === 0) return new Response("Debe existir al menos un DUENO", { status: 400 });
    }
  }

  const updated = await prisma.user.update({ where: { id }, data: { ...(role ? { role } : {}), ...(active === undefined ? {} : { active, disabledAt: active ? null : new Date() }), ...(gameName !== undefined ? { gameName } : {}) } });
  return Response.json({ ok: true, user: updated });
}
