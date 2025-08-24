import { prisma } from "@/server/db";
import { sendDiscordWebhook } from "@/lib/webhook";
import { z } from "zod";

const BodySchema = z.object({ discordId: z.string().min(2), type: z.enum(["IN", "OUT"]), note: z.string().optional() });
const QuerySchema = z.object({ discordId: z.string().min(2) });

export async function POST(req: Request) {
  const key = req.headers.get("x-api-key");
  if (!key || key !== process.env.FIVEM_API_KEY) return new Response("Unauthorized", { status: 401 });

  const json = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) return new Response("Invalid body", { status: 400 });
  const { discordId, type, note } = parsed.data;

  // Find user by Discord provider account
  const account = await prisma.account.findFirst({ where: { provider: "discord", providerAccountId: discordId } });
  if (!account) return new Response("User not found", { status: 404 });

  const log = await prisma.timeLog.create({ data: { userId: account.userId, type, note }, include: { user: true } });
  await sendDiscordWebhook(`🕒 (FiveM) ${log.user?.name ?? "Usuario"} marcó ${type} a las ${new Date(log.createdAt).toLocaleTimeString()}`);
  return Response.json({ ok: true, log });
}

export async function GET(req: Request) {
  const key = req.headers.get("x-api-key");
  if (!key || key !== process.env.FIVEM_API_KEY) return new Response("Unauthorized", { status: 401 });
  const { searchParams } = new URL(req.url);
  const parsed = QuerySchema.safeParse({ discordId: searchParams.get("discordId") ?? "" });
  if (!parsed.success) return new Response("Invalid query", { status: 400 });
  const account = await prisma.account.findFirst({ where: { provider: "discord", providerAccountId: parsed.data.discordId } });
  if (!account) return new Response("User not found", { status: 404 });
  const last = await prisma.timeLog.findFirst({ where: { userId: account.userId }, orderBy: { createdAt: "desc" } });
  return Response.json({ last });
}
