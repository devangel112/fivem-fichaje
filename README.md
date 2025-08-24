# Fichajes BPT

Sistema de fichajes con Next.js 15, NextAuth (Discord), Prisma y API para FiveM.

## Características
- Login con Discord (NextAuth v4)
- Roles: Empleado, Encargado, Dueño
- Registro de fichajes (IN/OUT)
- Webhook a Discord
- Dashboard básico de productividad
- API para integración con FiveM

## Requisitos
- Node.js 20+
- Acceso a una base de datos (por defecto SQLite; recomendado MySQL en producción)
- PowerShell (Windows) o bash (Linux/Mac)

## Variables de entorno
Crea tu `.env` a partir de `.env.example` y completa valores:

```powershell
Copy-Item .env.example .env
# Edita .env y completa: DATABASE_URL, NEXTAUTH_URL, AUTH_*, etc.
```

Claves principales:
- DATABASE_URL: cadena de conexión (SQLite o MySQL)
- NEXTAUTH_URL: URL pública de la app (https://tu-dominio.com)
- AUTH_DISCORD_ID / AUTH_DISCORD_SECRET / AUTH_SECRET
- Opcionales: DISCORD_WEBHOOK_URL, FIVEM_API_KEY

## Desarrollo
```powershell
npm ci
npm run prisma:generate
npm run db:push
npm run dev
```

## Producción (elige una opción)

### A) Clonar el repositorio (simple)
En el servidor (Node 20+):
```powershell
npm ci
npm run prisma:generate
npm run db:push
npm run build
npm run start
```
Sugerencias:
- Mantén `public/uploads` persistente si subes logos.
- Usa PM2/systemd para ejecutarlo en segundo plano.

### B) Docker (portátil y consistente)
```powershell
# Construir imagen
docker build -t fivem-fichaje .

# Ejecutar contenedor (usa MySQL remoto o tu DB)
docker run -d --name fivem-fichaje `
  -p 3000:3000 `
  --env-file .\.env `
  -v fivem_fichaje_uploads:/app/public/uploads `
  fivem-fichaje
```

### C) Artefactos de build (sin git)
Posible, pero debes compilar para el mismo OS/arquitectura donde se ejecutará.
Copiar:
- `.next/`
- `node_modules/` (instalado con `npm ci` en el server destino)
- `package.json`
- `public/`
- `prisma/` (para `db:push` si aplica)
- `.env`
Arranque: `npm run start`

Tip: Podemos habilitar output “standalone” para copiar menos archivos y arrancar con `node .next/standalone/server.js`.

## MySQL (producción recomendada)
1) En `prisma/schema.prisma`: `provider = "mysql"` (ya configurado)
2) En `.env`, `DATABASE_URL=mysql://usuario:password@host:3306/basedatos`
3) Inicializa esquema:
```powershell
npm run prisma:generate
npm run db:push
```
Si conectas a un MySQL remoto, asegúrate de:
- Abrir el puerto 3306 o usar túnel/gestor
- Usuario con permisos: `GRANT ALL ON basedatos.* TO 'usuario'@'%'`

## Endpoints
- Auth: `/api/auth/[...nextauth]`
- Fichajes (usuario autenticado):
  - `POST /api/clock` { type: "IN" | "OUT", note? }
  - `GET /api/clock`
- FiveM: `POST /api/fivem` con header `x-api-key` y body `{ discordId, type, note? }`

## Páginas
- `/login` Iniciar sesión con Discord
- `/dashboard` Dashboard del usuario
- `/clock` Página simple para marcar IN/OUT
- `/activity` Actividad del equipo (manager/owner)
- `/sessions` Sesiones de trabajo (manager/owner)

## Resolución de problemas
- Error P1001 (Prisma): no se puede conectar a MySQL. Verifica host/puerto, firewall, usuario y permisos.
- NEXTAUTH_URL: usa la URL pública real (http/https) o fallará el callback de login.
- Subida de logos: persiste `public/uploads` (volumen Docker o carpeta en disco).
