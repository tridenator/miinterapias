# Agenda Reiki — Deploy (Vercel + Supabase)

## 1) Supabase
1. Crea un proyecto en https://supabase.com (región más cercana).
2. En **SQL Editor**, pega y ejecuta `supabase/schema.sql` (puedes hacerlo por secciones).
3. En **Authentication → Providers**, habilita Email (password).
4. Copia `Project URL` y `anon public key` (Settings → API).

## 2) Variables de entorno (Vercel)
- `VITE_SUPABASE_URL` = (Project URL)
- `VITE_SUPABASE_ANON_KEY` = (anon public)
- `VITE_TZ` = `America/Montevideo`

## 3) Deploy en Vercel
- Subí este repo a GitHub.
- En https://vercel.com → New Project → Importa el repo.
- Build command: `npm run build`
- Output dir: `dist`
- Node 18+
- Agrega las variables de entorno anteriores.
- Deploy.

## 4) Primer uso
- Abre la app y **crea un usuario** (Signup).
- En Supabase → Table Editor → `profiles`, edita tu `full_name` si querés mostrar el nombre.
- Crea algunos pacientes y turnos en tu agenda.
- Crea un segundo usuario para probar que **solo vea “Ocupado”** en agendas de terceros.

## 5) Notas
- Las horas se guardan en UTC; el frontend muestra en la zona local configurada.
- El constraint de Postgres evita doble reserva.
- Políticas RLS aseguran privacidad por terapeuta.
