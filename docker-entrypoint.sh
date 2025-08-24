#!/usr/bin/env sh
set -eu

# Generar cliente Prisma por si falta
npx prisma generate >/dev/null 2>&1 || true

# Aplicar esquema (crea DB/tables si no existen)
if [ -n "${DATABASE_URL:-}" ]; then
  npx prisma db push --accept-data-loss || true
fi

# Ejecutar Next.js
exec npm run start
