## Getting Started

First, run the development server:

```bash
npm run dev
```

# or
# Fichajes BPT

Sistema de fichajes con Next.js 15, NextAuth (Discord), Prisma y API para FiveM.

## Características
- Login con Discord (NextAuth v4)
- Roles: Empleado, Encargado, Dueño
- Registro de fichajes (IN/OUT)
- Webhook a Discord
- Dashboard básico de productividad
- API para integración con FiveM

## Configuración
1. Copia `.env.local.example` a `.env.local` y completa:
```
DATABASE_URL="file:./dev.db"
AUTH_DISCORD_ID="..."
AUTH_DISCORD_SECRET="..."
AUTH_SECRET="..."
DISCORD_WEBHOOK_URL="..." # opcional
FIVEM_API_KEY="..."      # opcional
```

2. Genera Prisma y base de datos (SQLite por defecto):
```
npm run prisma:generate
npm run db:push
```

3. Ejecuta en desarrollo:
```
npm run dev
```

## Endpoints
- Auth: `/api/auth/[...nextauth]`
- Fichajes (usuario autenticado):
	- `POST /api/clock` { type: "IN" | "OUT", note? }
	- `GET /api/clock` últimos fichajes del usuario
- FiveM: `POST /api/fivem` con header `x-api-key` y body `{ discordId, type, note? }`

## Páginas
- `/login` Iniciar sesión con Discord
- `/dashboard` Dashboard del usuario
- `/clock` Página simple para marcar IN/OUT

## Notas
- El rol por defecto es `EMPLEADO`. Puedes actualizar roles en la tabla `User`.
- Para usar otra base de datos, cambia `provider` y `DATABASE_URL` en `prisma/schema.prisma`.
