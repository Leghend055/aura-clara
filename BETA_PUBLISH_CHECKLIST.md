# Aura Clara — checklist de publicación de la beta

## Antes de publicar
- [ ] Copiar `.env.example` a `.env.local` y añadir URL + publishable key de Supabase.
- [ ] Ejecutar el SQL de `supabase/migrations/202610230001_aura_clara_beta.sql` en el SQL Editor de Supabase.
- [ ] Activar Email Auth y configurar Site URL/Redirect URLs para localhost y el dominio público.
- [ ] Añadir `GROQ_API_KEY`, `GROQ_MODEL` y `APP_ORIGIN` como secretos de Supabase; desplegar `generate-study-content`.
- [ ] Crear repositorio GitHub y subir el proyecto sin `.env.local` ni claves privadas.
- [ ] Conectar el repositorio con Cloudflare Pages; build `npm run build`, output `dist`, Node `22`.
- [ ] Configurar `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` en Cloudflare; hacer un nuevo build.
- [ ] Copiar el dominio de Cloudflare a Supabase Auth Redirect URLs y al secreto `APP_ORIGIN`.
- [ ] Ejecutar `npm run typecheck` y `npm run build` en un equipo con acceso a npm.
- [ ] Probar la generación de mapas/exámenes y dos cuentas distintas.

## Antes de compartirla ampliamente
- [ ] Activar CAPTCHA/anti-bot en Supabase Auth.
- [ ] Añadir una política de privacidad y explicar que los textos enviados para generación con IA se comparten con Groq.
- [ ] Probar separación de datos entre cuentas y confirmar que no haya claves secretas en los assets de `dist/`.
- [ ] Definir cómo atender solicitudes de borrado y reportes de errores.
- [ ] Revisar cuotas y límites del proveedor IA; el límite local por usuario no sustituye el control global de consumo.

## Importante
No compartas contraseñas, `service_role`, claves secretas ni `GROQ_API_KEY` por el chat o en GitHub. Solo las dos variables `VITE_SUPABASE_*` indicadas son necesarias en el frontend; la clave del modelo debe quedar en los secretos de Supabase.
