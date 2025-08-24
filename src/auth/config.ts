import { type NextAuthOptions } from "next-auth";
import Discord from "next-auth/providers/discord";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "@/server/db";

type Role = "EMPLEADO" | "ENCARGADO" | "DUENO" | "VISITANTE";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  providers: [
    Discord({
      clientId: process.env.AUTH_DISCORD_ID!,
      clientSecret: process.env.AUTH_DISCORD_SECRET!,
      allowDangerousEmailAccountLinking: true,
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      // Primer inicio de sesión
      if (user) {
        token.id = (user as { id: string }).id;
        token.role = (user as { role?: Role }).role;
        token.rUpdatedAt = Date.now();
      }

      // Refrescar rol desde DB máx. cada 60s o cuando el cliente lo pida (trigger === 'update')
      const needsRefresh = !token.rUpdatedAt || (Date.now() - (token.rUpdatedAt as number)) > 60_000 || trigger === "update";
      if (needsRefresh && token.id) {
        const u = await prisma.user.findUnique({ where: { id: token.id as string }, select: { role: true } });
        if (u) {
          token.role = u.role as Role;
          token.rUpdatedAt = Date.now();
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
  session.user.id = token.id as string;
  session.user.role = token.role as Role | undefined;
      }
      return session;
    },
    async signIn({ user }) {
      // Evitar que usuarios deshabilitados usen la app
      const dbUser = await prisma.user.findUnique({ where: { id: (user as { id: string }).id } });
      if (dbUser && dbUser.active === false) return false;
      return true;
    },
  },
  events: {
    async createUser({ user }) {
      // Si no existe ningún DUENO aún, el primer usuario creado se convierte en DUENO
      const existingOwner = await prisma.user.findFirst({ where: { role: "DUENO" } });
      if (!existingOwner) {
        await prisma.user.update({ where: { id: (user as { id: string }).id }, data: { role: "DUENO" } });
      }
    },
  },
  secret: process.env.AUTH_SECRET,
};

