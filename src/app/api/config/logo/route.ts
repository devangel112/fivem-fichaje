import { getServerSession } from "next-auth";
import { authOptions } from "@/auth/config";
import { prisma } from "@/server/db";
import sharp from "sharp";
import { promises as fs } from "fs";
import path from "path";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const role = (session?.user && "role" in session.user ? (session.user as { role?: string }).role : undefined);
  if (role !== "DUENO") return new Response("Forbidden", { status: 403 });

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return new Response("No file", { status: 400 });
  if (!file.type.startsWith("image/")) return new Response("Unsupported type", { status: 400 });
  if (file.size > 5_000_000) return new Response("File too large", { status: 413 });

  const arrayBuf = await file.arrayBuffer();
  const inputBuffer = Buffer.from(arrayBuf);

  // Convertir a WebP
  const webp = await sharp(inputBuffer).resize({ width: 512, height: 512, fit: "cover" }).webp({ quality: 85 }).toBuffer();

  const uploadsDir = path.join(process.cwd(), "public", "uploads");
  await fs.mkdir(uploadsDir, { recursive: true });
  const filename = `logo-${Date.now()}.webp`;
  const filepath = path.join(uploadsDir, filename);
  await fs.writeFile(filepath, webp);

  const publicPath = "/uploads/" + filename;

  // Eliminar archivo anterior si era local
  const prev = await prisma.config.findUnique({ where: { key: "logoUrl" } });
  if (prev?.value && prev.value.startsWith("/uploads/")) {
    const prevPath = path.join(process.cwd(), "public", prev.value);
    fs.unlink(prevPath).catch(() => {});
  }

  await prisma.config.upsert({
    where: { key: "logoUrl" },
    update: { value: publicPath },
    create: { key: "logoUrl", value: publicPath },
  });

  return Response.json({ ok: true, logoUrl: publicPath });
}

export async function DELETE() {
  const session = await getServerSession(authOptions);
  const role = (session?.user && "role" in session.user ? (session.user as { role?: string }).role : undefined);
  if (role !== "DUENO") return new Response("Forbidden", { status: 403 });

  const prev = await prisma.config.findUnique({ where: { key: "logoUrl" } });
  if (prev?.value) {
    if (prev.value.startsWith("/uploads/")) {
      const prevPath = path.join(process.cwd(), "public", prev.value);
      await fs.unlink(prevPath).catch(() => {});
    }
    // eliminar entrada de config
    try {
      await prisma.config.delete({ where: { key: "logoUrl" } });
    } catch {
      // no-op si ya no existe
    }
  }
  return Response.json({ ok: true, logoUrl: null });
}
