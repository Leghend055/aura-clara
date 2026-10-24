# Aura Clara — Beta pública

Aura Clara es un espacio de estudio en español para crear mapas mentales y estudiar documentos. Esta versión conserva el dashboard React/TypeScript existente e incorpora una capa opcional en la nube con Supabase Auth, sincronización privada de mapas, un generador mediante IA y exámenes de selección múltiple basados en el material aportado.

## Stack de la beta

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS 4, React Flow y Lucide React.
- **Hosting web:** Cloudflare Pages (sitio estático, plan gratuito sujeto a los límites del proveedor).
- **Cuentas y datos:** Supabase Auth + Postgres con Row Level Security (RLS).
- **IA:** Supabase Edge Function `generate-study-content` que llama a Groq mediante una clave guardada en secretos del backend. Modelo inicial configurable; valor predeterminado `openai/gpt-oss-20b`.
- **Privacidad:** las solicitudes de IA necesitan sesión válida; hay una cuota beta por cuenta; los mapas se consultan/guardan con políticas RLS.

## Funciones listas en el código

- Registro, inicio de sesión por email/contraseña, recuperación y cambio de contraseña.
- Mis Espacios lee y guarda mapas en la nube por usuario cuando Supabase está configurado; sin configuración mantiene el modo local anterior.
- Generación de mapas desde apuntes usando IA en modo nube, con generador heurístico como respaldo si el endpoint falla.
- Generación de exámenes de opción múltiple desde el material del espacio mediante IA; la interfaz muestra explicación y un fragmento de apoyo.
- Validación del fragmento citado por cada pregunta: se descartan preguntas si el extracto devuelto no aparece literalmente en los apuntes normalizados.
- Cuota inicial: hasta 10 solicitudes por día y 60.000 caracteres de entrada diarios por cuenta, aplicada por función SQL.
- SQL de tablas, índices, cuota y políticas RLS en `supabase/migrations/202610230001_aura_clara_beta.sql`.
- La beta conserva el texto extraído en los datos del mapa. **No conserva el PDF binario original** en Storage; tampoco descarga páginas web automáticamente a partir de un enlace.

## 1. Requisitos

- Node.js 20.19+ o 22.12+.
- npm.
- Un proyecto Supabase.
- Una API key de Groq para habilitar generación con IA.
- Cuenta de GitHub y Cloudflare para publicar.

## 2. Ejecutar localmente

```bash
npm install
cp .env.example .env.local
npm run dev
```

Completa `.env.local` con los datos de Supabase:

```dotenv
VITE_SUPABASE_URL=https://TU_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=TU_PUBLISHABLE_KEY
```

La clave publicable/anon puede estar en el frontend **solo** porque las tablas tienen RLS y la clave no tiene privilegios de servicio. Nunca pegues `service_role`, `secret key` ni `GROQ_API_KEY` en variables `VITE_*`.

Si las variables de Supabase no están configuradas, Aura Clara funciona en modo local: los mapas viven en `localStorage`; no hay registro, sincronización multiusuario ni generación semántica remota.

## 3. Configurar Supabase

### 3.1 Crear tablas y permisos

1. Abre tu proyecto de Supabase.
2. Entra en **SQL Editor → New query**.
3. Copia y ejecuta el contenido completo de `supabase/migrations/202610230001_aura_clara_beta.sql`.
4. Verifica que se crearon `public.study_maps`, `public.ai_usage_daily` y la función `public.consume_ai_quota`.

La tabla de cuota no da acceso directo al rol `anon` ni al rol `authenticated`; solo la Edge Function la utiliza mediante el rol de servicio. `study_maps` tiene RLS para que el usuario autenticado solo lea, cree, cambie o borre registros cuyo `user_id` sea su propio ID.

### 3.2 Configurar autenticación

1. En **Authentication → Providers**, activa Email.
2. Para una beta pública, recomendamos mantener la confirmación de correo habilitada y configurar SMTP fiable si los límites del correo de prueba no bastan.
3. En **Authentication → URL Configuration**, establece el **Site URL** en tu URL pública de Cloudflare Pages y añade las URL locales y de producción permitidas en **Redirect URLs**, por ejemplo `http://localhost:5173/**` y `https://TU-PROYECTO.pages.dev/**`.
4. Prueba el registro, confirmación de email, login, logout y restablecimiento de contraseña.

## 4. Publicar el endpoint de IA

La clave de Groq debe existir únicamente en los secretos de Supabase Edge Functions.

1. Instala el CLI de Supabase si no lo tienes: consulta [la instalación oficial](https://supabase.com/docs/guides/cli).
2. En el directorio del proyecto inicia sesión y enlaza el proyecto:

```bash
npx supabase login
npx supabase link --project-ref TU_PROJECT_REF
```

3. Para la primera puesta en marcha establece la clave y el modelo (no los guardes en Git). Mientras aún no conozcas el dominio público puedes dejar `APP_ORIGIN` como `*`; la función sigue exigiendo un usuario autenticado y la cuota diaria. Después del primer despliegue del frontend, restringe `APP_ORIGIN` al dominio público exacto.

```bash
npx supabase secrets set GROQ_API_KEY=TU_GROQ_API_KEY GROQ_MODEL=openai/gpt-oss-20b APP_ORIGIN='*'
```

4. Despliega la función:

```bash
npx supabase functions deploy generate-study-content
```

5. Revisa el registro de ejecución en **Supabase → Edge Functions → Logs**. La configuración de la función activa la verificación JWT; la función verifica al usuario e impone una cuota diaria antes de llamar a Groq.

El modelo es configurable mediante `GROQ_MODEL`. Consulta los modelos activos y las cuotas actuales en el panel del proveedor; los límites gratuitos pueden cambiar. Una vez que se agote el límite del proveedor, la función devuelve un error y la app usa su estructura heurística como respaldo para mapas, mientras que el examen con IA pide intentarlo más tarde.

## 5. Publicar en Cloudflare Pages

### 5.1 Subir a GitHub

Crea un repositorio vacío en tu cuenta de GitHub. Desde la carpeta raíz de Aura Clara ejecuta:

```bash
git init
git add .
git commit -m "Prepare Aura Clara public beta"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/TU_REPOSITORIO.git
git push -u origin main
```

Comprueba que `.env.local`, secretos y archivos de credenciales no se suban. El `.gitignore` excluye los `.env` locales.

### 5.2 Configuración del proyecto en Cloudflare

1. En Cloudflare, abre **Workers & Pages → Create → Pages → Connect to Git** (la interfaz puede presentar el flujo dentro de Workers según los cambios de la plataforma).
2. Selecciona el repositorio.
3. Configura el comando de build `npm run build` y el directorio de salida `dist`.
4. En las variables de entorno de producción, configura:
   - `VITE_SUPABASE_URL` = URL del proyecto Supabase.
   - `VITE_SUPABASE_PUBLISHABLE_KEY` = clave publicable/anon del proyecto Supabase.
5. Lanza el primer despliegue y copia el dominio asignado (por ejemplo, `https://aura-clara.pages.dev`).
6. Vuelve a Supabase → Authentication → URL Configuration y añade el dominio en Redirect URLs. Restringe el CORS del generador al dominio público actualizando el secreto con `npx supabase secrets set APP_ORIGIN=https://TU-DOMINIO.pages.dev`. Supabase aplica el nuevo secreto sin que tengas que volver a desplegar la función.
7. Haz un nuevo despliegue después de añadir/cambiar las variables `VITE_*`, pues son sustituidas durante la compilación.

## 6. Comprobaciones antes de invitar estudiantes

- [ ] `npm run typecheck` pasa.
- [ ] `npm run build` crea `dist/` sin errores.
- [ ] Registro y confirmación de email funcionan en la URL de producción.
- [ ] Un usuario puede crear un mapa, recargar y recuperarlo desde otra sesión.
- [ ] Dos cuentas distintas no pueden consultar o modificar los mapas de la otra.
- [ ] La Edge Function rechaza llamadas sin sesión y limita solicitudes tras agotar la cuota.
- [ ] La IA devuelve un mapa con ramas y el examen se basa en el material cargado.
- [ ] Se probaron PDFs con texto seleccionable y se avisó que los escaneados requieren OCR.
- [ ] El sitio incluye aviso de privacidad y explica que el texto aportado se envía al proveedor de IA cuando se solicita generación.
- [ ] Hay correo/medio para que estudiantes reporten errores y soliciten borrado de datos.

## Limitaciones deliberadas de la primera beta

- Se admiten PDF con texto seleccionable, TXT, Markdown, CSV y JSON; los PDF escaneados no incluyen OCR todavía.
- El enlace externo se conserva como referencia, pero el endpoint no descarga ni lee artículos web. Eso necesita una función de extracción con validación de dominio, límites de tamaño y defensa frente a SSRF.
- Se almacena el texto extraído dentro del JSON de cada mapa; el PDF original no se guarda en Supabase Storage en esta versión.
- No incluye colaboración en tiempo real, administración de grupos, pagos, certificados ni sincronización offline avanzada.
- Las respuestas de IA pueden contener errores y necesitan revisión. El examen intenta verificar que la cita textual aparezca en el material, pero eso no demuestra que la respuesta correcta esté libre de errores.
- La cuota se aplica por cuenta, pero una API compartida sigue teniendo límites globales del proveedor. Añade una alerta de consumo antes de aumentar el número de usuarios.

## Scripts

```bash
npm run dev        # desarrollo
npm run typecheck  # chequeo TypeScript
npm run build      # compilación de producción
npm run preview    # vista previa local de dist/
```

## Documentación oficial útil

- [Supabase Auth + React](https://supabase.com/docs/guides/auth/quickstarts/react)
- [Supabase Edge Function secrets](https://supabase.com/docs/guides/functions/secrets)
- [Cloudflare Pages límites](https://developers.cloudflare.com/pages/platform/limits/)
- [Groq rate limits](https://console.groq.com/docs/rate-limits)
- [Groq structured outputs](https://console.groq.com/docs/structured-outputs)
