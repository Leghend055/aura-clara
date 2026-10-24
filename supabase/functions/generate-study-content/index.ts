import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('APP_ORIGIN') || '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json; charset=utf-8',
};
const MODEL = Deno.env.get('GROQ_MODEL') || 'openai/gpt-oss-20b';
const MAX_INPUT_CHARS = 30000;
const MAX_DAILY_CHARS = 60000;
const MAX_DAILY_REQUESTS = 10;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

function boundedText(value: unknown, max: number) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function safeString(value: unknown, fallback: string, max = 900) {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : fallback;
}

const categories = [
  { name: 'Generalidades', color: '#6f89bd', tint: '#edf1fb', emoji: '🧭' },
  { name: 'Morfología', color: '#4d9c83', tint: '#e7f5ef', emoji: '🔬' },
  { name: 'Clasificación', color: '#c88b47', tint: '#fbf0df', emoji: '🗂️' },
  { name: 'Mecanismos', color: '#8d79bf', tint: '#f0ebfb', emoji: '🔄' },
  { name: 'Aplicaciones', color: '#d36f7b', tint: '#fbe9ec', emoji: '🩺' },
  { name: 'Prevención y repaso', color: '#3f96a5', tint: '#e5f5f7', emoji: '🛡️' },
];

function makeMap(title: string, content: string, sourceUrl: string, structured: any) {
  if (!structured || !Array.isArray(structured.branches)) throw new Error('La respuesta de IA no contiene ramas.');
  const branches = structured.branches.slice(0, 6).filter((branch: any) => branch && typeof branch.title === 'string' && Array.isArray(branch.concepts));
  if (branches.length < 2) throw new Error('El modelo generó muy pocas ramas.');
  const source = `Apuntes proporcionados por el usuario: ${title}`;
  const nodes: any[] = [{
    id: 'root', type: 'study', position: { x: 570, y: 300 },
    data: { title, category: 'Tema central', color: '#526b9e', emoji: '🧠', kind: 'root', side: 'center', description: safeString(structured.overview, `Mapa generado a partir del material proporcionado sobre ${title}. Comprueba las explicaciones antes de utilizarlas académicamente.`), summary: Array.isArray(structured.learningGoals) ? structured.learningGoals.slice(0, 4).map((x: unknown) => safeString(x, 'Repasar el material fuente.', 240)) : ['Revisa cada explicación contra el documento original.', 'Las referencias corresponden al material que aportaste; verifica cualquier dato externo.'], sources: [source, ...(sourceUrl ? [`Enlace aportado (no consultado automáticamente): ${sourceUrl}`] : [])], sourceUrl: sourceUrl || undefined, completed: false, question: false },
  }];
  const edges: any[] = [];
  branches.forEach((branch: any, branchIndex: number) => {
    const meta = categories[branchIndex % categories.length];
    const side = branchIndex % 2 === 0 ? 'left' : 'right';
    const row = Math.floor(branchIndex / 2);
    const branchId = `branch-${branchIndex + 1}`;
    const branchTitle = safeString(branch.title, `Rama ${branchIndex + 1}`, 58);
    const branchDescription = safeString(branch.description, 'Consulta los apuntes originales para ampliar esta rama.');
    nodes.push({ id: branchId, type: 'study', position: { x: side === 'left' ? 260 : 900, y: 62 + row * 235 }, data: { title: branchTitle, category: meta.name, color: meta.color, emoji: meta.emoji, kind: 'branch', side, parentId: 'root', description: branchDescription, summary: Array.isArray(branch.summary) ? branch.summary.slice(0, 4).map((x: unknown) => safeString(x, branchDescription, 240)) : [branchDescription], sources: [source, ...(sourceUrl ? [`Enlace aportado (no consultado automáticamente): ${sourceUrl}`] : [])], sourceUrl: sourceUrl || undefined, completed: false, question: true } });
    edges.push({ id: `e-root-${branchId}`, source: 'root', target: branchId, sourceHandle: side, targetHandle: 'target', type: 'default', style: { stroke: meta.color, strokeWidth: 2.2 } });
    (branch.concepts as any[]).slice(0, 3).forEach((concept, conceptIndex) => {
      const conceptId = `${branchId}-concept-${conceptIndex + 1}`;
      const conceptTitle = safeString(concept?.title, `Concepto ${conceptIndex + 1}`, 48);
      const description = safeString(concept?.explanation ?? concept?.description, 'Revisa el material original para confirmar los detalles de este concepto.');
      const summary = Array.isArray(concept?.summary) ? concept.summary.slice(0, 4).map((x: unknown) => safeString(x, description, 240)) : [description];
      nodes.push({ id: conceptId, type: 'study', position: { x: side === 'left' ? 18 : 1150, y: 42 + row * 235 + conceptIndex * 104 }, data: { title: conceptTitle, category: meta.name, color: meta.color, emoji: meta.emoji, kind: 'concept', side, parentId: branchId, description, summary: summary.length ? summary : [description], sources: [source, ...(sourceUrl ? [`Enlace aportado (no consultado automáticamente): ${sourceUrl}`] : [])], sourceUrl: sourceUrl || undefined, completed: false, question: true } });
      edges.push({ id: `e-${branchId}-${conceptId}`, source: branchId, target: conceptId, sourceHandle: 'source', targetHandle: 'target', type: 'default', style: { stroke: meta.color, strokeWidth: 1.7, opacity: 0.8 } });
    });
  });
  return { nodes, edges };
}

async function callGroq(prompt: string, system: string) {
  const apiKey = Deno.env.get('GROQ_API_KEY');
  if (!apiKey) throw new Error('El servicio de IA no está configurado. Añade GROQ_API_KEY en los secretos de Supabase.');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 55000);
  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      signal: controller.signal,
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: MODEL, temperature: 0.2, max_tokens: 5000, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }] }),
    });
    if (!response.ok) {
      const details = (await response.text()).slice(0, 500);
      if (response.status === 429) throw new Error('Se alcanzó el límite temporal de IA. Espera y vuelve a intentarlo.');
      throw new Error(`El proveedor de IA respondió ${response.status}: ${details}`);
    }
    const data = await response.json();
    const text = data.choices?.[0]?.message?.content;
    if (typeof text !== 'string') throw new Error('La IA no devolvió contenido.');
    return JSON.parse(text);
  } finally { clearTimeout(timeout); }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Método no permitido.' }, 405);
  try {
    const authorization = req.headers.get('Authorization');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!authorization || !supabaseUrl || !anonKey || !serviceKey) return json({ error: 'Configuración de backend incompleta.' }, 500);
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false, autoRefreshToken: false } });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return json({ error: 'Debes iniciar sesión para usar el generador.' }, 401);

    const body = await req.json();
    const action = body?.action === 'exam' ? 'exam' : 'map';
    const title = boundedText(body?.title, 120) || 'Nuevo tema de estudio';
    const content = boundedText(body?.content, MAX_INPUT_CHARS);
    const sourceUrl = boundedText(body?.sourceUrl, 1000);
    if (content.length < 80) return json({ error: 'Añade al menos 80 caracteres de apuntes para generar contenido útil.' }, 400);
    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: allowed, error: quotaError } = await admin.rpc('consume_ai_quota', { p_user_id: user.id, p_max_requests: MAX_DAILY_REQUESTS, p_max_chars: MAX_DAILY_CHARS, p_chars: content.length });
    if (quotaError) { console.error('Quota RPC failed', quotaError.message); return json({ error: 'No se pudo validar la cuota de IA. Ejecuta la migración SQL de Aura Clara.' }, 500); }
    if (!allowed) return json({ error: 'Has alcanzado la cuota beta (10 generaciones o 60.000 caracteres al día por cuenta). Inténtalo mañana.' }, 429);

    if (action === 'exam') {
      const system = 'Eres un asistente de estudio riguroso. Trabaja exclusivamente con el material suministrado. No inventes citas, fuentes ni datos no respaldados. Si el material no permite una pregunta fiable, no la incluyas. Devuelve únicamente JSON válido.';
      const prompt = `Crea un examen en español para el tema "${title}" basado EXCLUSIVAMENTE en estos apuntes. Genera de 6 a 10 preguntas de opción múltiple, cada una con exactamente cuatro opciones plausibles, un índice correcto entre 0 y 3, una explicación breve y un fragmento de evidencia copiado literalmente de los apuntes. No preguntes información que no esté respaldada. JSON exacto: {"questions":[{"question":"...","options":["...","...","...","..."],"correctIndex":0,"explanation":"...","sourceExcerpt":"..."}]}. APUNTES:\n${content}`;
      const exam = await callGroq(prompt, system);
      if (!Array.isArray(exam.questions) || exam.questions.length < 3) return json({ error: 'No se pudieron crear suficientes preguntas a partir de este material.' }, 422);
      const normalizedContent = content.toLocaleLowerCase().replace(/\s+/g, ' ').trim();
      const questions = exam.questions.slice(0, 10).filter((q: any) => {
        if (typeof q.question !== 'string' || !Array.isArray(q.options) || q.options.length !== 4 || !Number.isInteger(q.correctIndex) || q.correctIndex < 0 || q.correctIndex >= 4 || typeof q.sourceExcerpt !== 'string') return false;
        const quote = q.sourceExcerpt.toLocaleLowerCase().replace(/\s+/g, ' ').trim();
        return quote.length >= 18 && normalizedContent.includes(quote);
      }).map((q: any) => ({ question: q.question.slice(0, 700), options: q.options.map((o: unknown) => safeString(o, 'Opción', 250)), correctIndex: q.correctIndex, explanation: safeString(q.explanation, 'Revisa los apuntes originales para profundizar.'), sourceExcerpt: safeString(q.sourceExcerpt, 'No se devolvió un fragmento verificable.', 500) }));
      return json({ questions, model: MODEL });
    }

    const system = 'Eres un tutor académico. Debes organizar y explicar exclusivamente la información que esté respaldada por el material dado. No añadas bibliografía externa ni afirmaciones médicas externas. Si los apuntes son ambiguos, deja constancia de ello. Devuelve únicamente JSON válido.';
    const prompt = `Transforma estos apuntes en un mapa mental en español para "${title}". Elabora entre 4 y 6 ramas temáticas; cada rama debe tener título, descripción y resumen de 1-3 puntos; cada rama debe contener 2 o 3 conceptos con título, explicación clara y resumen de 1-3 puntos. El resumen general debe tener una introducción corta y 3 objetivos de aprendizaje. No inventes información que no figure o no se pueda inferir directamente de los apuntes. No inventes referencias; se registrará como fuente el propio documento aportado. Devuelve JSON con este formato exacto: {"overview":"...","learningGoals":["...","...","..."],"branches":[{"title":"...","description":"...","summary":["..."],"concepts":[{"title":"...","explanation":"...","summary":["..."]}]}]}. TEMA: ${title}\nAPUNTES:\n${content}`;
    const structured = await callGroq(prompt, system);
    return json({ ...makeMap(title, content, sourceUrl, structured), model: MODEL });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error inesperado al generar contenido.';
    console.error('generate-study-content:', message);
    return json({ error: message.slice(0, 500) }, message.includes('límite') ? 429 : 500);
  }
});
