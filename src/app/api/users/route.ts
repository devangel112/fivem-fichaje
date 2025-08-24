import { getServerSession } from "next-auth";
import { authOptions } from "@/auth/config";
import { prisma } from "@/server/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role;
  const isManager = role === "ENCARGADO" || role === "DUENO";
  if (!session?.user || !isManager) return new Response("Unauthorized", { status: 401 });

  const users = await prisma.user.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, gameName: true, role: true },
  });
  return Response.json(users);
}
