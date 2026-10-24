import type { GeneratedMap } from './contentParser';
import { supabase } from './supabase';

export async function generateStudyMapWithAI(title: string, content: string, sourceUrl = ''): Promise<GeneratedMap> {
  if (!supabase) throw new Error('La conexión en la nube no está configurada.');
  const trimmed = content.trim();
  if (!trimmed) throw new Error('Añade apuntes antes de solicitar una generación con IA.');
  if (trimmed.length > 30000) throw new Error('El texto supera el límite beta de 30.000 caracteres. Divide el documento en partes más pequeñas.');
  const { data, error } = await supabase.functions.invoke('generate-study-content', {
    body: { action: 'map', title: title.trim().slice(0, 120), content: trimmed, sourceUrl: sourceUrl.trim().slice(0, 1000) },
  });
  if (error) throw new Error(error.message || 'La función de IA no respondió.');
  if (!data || !Array.isArray(data.nodes) || !Array.isArray(data.edges) || data.nodes.length < 2) {
    throw new Error('La IA devolvió una estructura incompleta. Vuelve a intentarlo.');
  }
  return { nodes: data.nodes, edges: data.edges } as GeneratedMap;
}

export type AIExamQuestion = {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  sourceExcerpt: string;
};

export async function generateAIExam(title: string, content: string): Promise<AIExamQuestion[]> {
  if (!supabase) throw new Error('La conexión en la nube no está configurada.');
  const trimmed = content.trim();
  if (trimmed.length < 80) throw new Error('Necesitas al menos 80 caracteres de material para crear un examen.');
  if (trimmed.length > 30000) throw new Error('El material supera el límite beta de 30.000 caracteres.');
  const { data, error } = await supabase.functions.invoke('generate-study-content', {
    body: { action: 'exam', title: title.trim().slice(0, 120), content: trimmed, sourceUrl: '' },
  });
  if (error) throw new Error(error.message || 'La función de IA no respondió.');
  if (!data || !Array.isArray(data.questions) || data.questions.length < 3) {
    throw new Error(data?.error || 'La IA no devolvió suficientes preguntas.');
  }
  return data.questions as AIExamQuestion[];
}
