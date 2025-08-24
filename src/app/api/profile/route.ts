import { getServerSession } from "next-auth";
import { authOptions } from "@/auth/config";
import { prisma } from "@/server/db";
import { z } from "zod";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return new Response("Unauthorized", { status: 401 });
  const user = await prisma.user.findUnique({ where: { id: session.user.id! }, select: { id: true, name: true, gameName: true, role: true, active: true } });
  return Response.json({ user });
}

const PatchSchema = z.object({ gameName: z.string().max(64) });

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return new Response("Unauthorized", { status: 401 });
  const body = await req.json().catch(() => null);
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) return new Response("Invalid body", { status: 400 });
  const { gameName } = parsed.data;
  const user = await prisma.user.update({ where: { id: session.user.id! }, data: { gameName } });
  return Response.json({ ok: true, user: { id: user.id, name: user.name, gameName: user.gameName, role: user.role } });
}
