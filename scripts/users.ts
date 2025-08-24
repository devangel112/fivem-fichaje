/*
CLI de administración de usuarios con Prisma.

Uso (PowerShell):
node .\scripts\users.ts list
node .\scripts\users.ts promote --email someone@example.com --role DUENO
node .\scripts\users.ts set-role --email someone@example.com --role ENCARGADO
node .\scripts\users.ts disable --email someone@example.com
node .\scripts\users.ts enable --email someone@example.com

Roles válidos: EMPLEADO | ENCARGADO | DUENO
*/

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function list() {
  const users = await prisma.user.findMany({ orderBy: { createdAt: "asc" } });
  console.table(
    users.map((u: { id: string; email: string | null; name: string | null; role: string; active: boolean; disabledAt: Date | null }) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      active: u.active,
      disabledAt: u.disabledAt,
    }))
  );
}

type Role = "EMPLEADO" | "ENCARGADO" | "DUENO";

async function setRole(email: string, role: Role) {
  const user = await prisma.user.update({ where: { email }, data: { role } });
  console.log(`Rol actualizado: ${user.email} -> ${user.role}`);
}

async function disable(email: string) {
  const user = await prisma.user.update({ where: { email }, data: { active: false, disabledAt: new Date() } });
  console.log(`Usuario deshabilitado: ${user.email}`);
}

async function enable(email: string) {
  const user = await prisma.user.update({ where: { email }, data: { active: true, disabledAt: null } });
  console.log(`Usuario habilitado: ${user.email}`);
}

async function main() {
  const [, , cmd, ...rest] = process.argv;
  const args = Object.fromEntries(
    rest
      .map((a) => a.trim())
      .filter(Boolean)
      .map((a) => (a.startsWith("--") ? a.slice(2) : a))
      .map((kv) => {
        const [k, v] = kv.split("=");
        return [k, v ?? true];
      })
  );

  try {
    if (cmd === "list") await list();
    else if (cmd === "set-role") await setRole(String(args.email), String(args.role) as Role);
    else if (cmd === "disable") await disable(String(args.email));
    else if (cmd === "enable") await enable(String(args.email));
    else {
      console.log("Uso:\n  node .\\scripts\\users.ts list\n  node .\\scripts\\users.ts set-role --email=correo@dominio --role=DUENO|ENCARGADO|EMPLEADO\n  node .\\scripts\\users.ts disable --email=correo@dominio\n  node .\\scripts\\users.ts enable --email=correo@dominio");
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
