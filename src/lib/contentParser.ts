import type { StudyEdge, StudyNode, StudyNodeData } from '../types';
import { categories } from '../data/initialMap';

export type GeneratedMap = { nodes: StudyNode[]; edges: StudyEdge[] };

type ContentSection = { heading: string; text: string };

function extractSections(rawText: string): ContentSection[] {
  const cleaned = rawText
    .replace(/\r/g, '')
    .replace(/\t/g, ' ')
    .replace(/[ ]{2,}/g, ' ')
    .trim();
  if (!cleaned) return [];

  const lines = cleaned.split('\n').map((line) => line.trim()).filter(Boolean);
  const isHeading = (line: string) => {
    const plain = line.replace(/^#{1,6}\s*/, '').replace(/[*_`]/g, '').replace(/:$/, '').trim();
    return (
      /^#{1,6}\s/.test(line) ||
      (plain.length > 3 && plain.length < 72 && /:$/.test(line)) ||
      (plain.length > 3 && plain.length < 62 && plain.split(/\s+/).length <= 7 && plain === plain.toLocaleUpperCase('es'))
    );
  };

  const headingCount = lines.filter(isHeading).length;
  if (headingCount >= 2) {
    const result: ContentSection[] = [];
    let currentHeading = 'Ideas principales';
    let currentText: string[] = [];
    for (const line of lines) {
      if (isHeading(line)) {
        if (currentText.length) result.push({ heading: currentHeading, text: currentText.join(' ') });
        currentHeading = line.replace(/^#{1,6}\s*/, '').replace(/[*_`]/g, '').replace(/:$/, '').trim();
        currentText = [];
      } else {
        currentText.push(line.replace(/^[-*•]\s*/, '').replace(/^\d+[.)]\s*/, ''));
      }
    }
    if (currentText.length) result.push({ heading: currentHeading, text: currentText.join(' ') });
    return result.filter((section) => section.text.trim().length > 0).slice(0, 8);
  }

  const blocks = cleaned.split(/\n\s*\n/).map((block) => block.replace(/\n/g, ' ').replace(/^[-*•]\s*/gm, '').trim()).filter((block) => block.length > 18);
  if (blocks.length >= 2) return blocks.slice(0, 8).map((text, index) => ({ heading: guessHeading(text, index), text }));

  const sentences = cleaned.split(/(?<=[.!?])\s+/).filter((sentence) => sentence.length > 18);
  const chunkSize = Math.max(1, Math.ceil(sentences.length / 5));
  const grouped: ContentSection[] = [];
  for (let i = 0; i < sentences.length; i += chunkSize) {
    grouped.push({ heading: `Idea clave ${grouped.length + 1}`, text: sentences.slice(i, i + chunkSize).join(' ') });
  }
  if (grouped.length) return grouped.slice(0, 6);
  return [{ heading: 'Resumen aportado', text: cleaned }];
}

function guessHeading(text: string, index: number): string {
  const firstSentence = text.split(/(?<=[.!?])\s+/)[0] ?? text;
  const candidate = firstSentence.replace(/^[-*•\d.)\s]+/, '').split(/[,;:—–]/)[0].trim();
  if (candidate.length >= 5 && candidate.length <= 42) return candidate.charAt(0).toLocaleUpperCase('es') + candidate.slice(1);
  return `Idea clave ${index + 1}`;
}

function splitConcepts(text: string): string[] {
  const sentences = text.split(/(?<=[.!?])\s+/).map((sentence) => sentence.trim()).filter((sentence) => sentence.length > 15);
  if (sentences.length <= 1) {
    const chunks = text.split(/[;•]\s*/).filter((chunk) => chunk.trim().length > 15);
    return chunks.slice(0, 3);
  }
  return sentences.slice(0, 3);
}

function makeNodeData(input: Partial<StudyNodeData> & Pick<StudyNodeData, 'title' | 'category' | 'color' | 'emoji' | 'kind' | 'side' | 'description' | 'summary' | 'sources'>): StudyNodeData {
  return { completed: false, question: input.kind !== 'root', ...input };
}

export function generateMapFromNotes(titleInput: string, content: string, sourceUrl = ''): GeneratedMap {
  const title = titleInput.trim() || 'Nuevo tema de estudio';
  const sections = extractSections(content).slice(0, 6);
  const fallbackSections: ContentSection[] = [
    { heading: 'Conceptos fundamentales', text: 'Identifica las definiciones esenciales, los componentes principales y las relaciones que explican el tema.' },
    { heading: 'Desarrollo y mecanismos', text: 'Organiza los procesos, las etapas y los mecanismos importantes en una secuencia que permita comprender cómo funciona el tema.' },
    { heading: 'Aplicaciones y repaso', text: 'Relaciona lo estudiado con ejemplos, aplicaciones prácticas y preguntas de autoevaluación.' },
  ];
  const finalSections = sections.length ? sections : fallbackSections;
  const userSources = [content.trim() ? `Material de estudio aportado: ${title}` : `Estructura inicial creada para: ${title}`];
  if (sourceUrl.trim()) userSources.unshift(`Enlace aportado: ${sourceUrl.trim()}`);
  const colors = categories;
  const nodes: StudyNode[] = [];
  const edges: StudyEdge[] = [];
  nodes.push({
    id: 'root', type: 'study', position: { x: 570, y: 300 },
    data: makeNodeData({
      title, category: 'Tema central', color: '#526b9e', emoji: '🧠', kind: 'root', side: 'center',
      description: content.trim() ? `Mapa creado a partir del material proporcionado sobre ${title}. La estructura automática propone temas y conceptos para que revises, edites y completes el contenido.` : `Estructura inicial de estudio para ${title}. Añade apuntes o un resumen para personalizar las explicaciones.`,
      summary: ['Revisa los títulos de cada rama y corrige los que no representen el material.', 'Verifica las explicaciones creadas a partir de tus apuntes.', 'Completa o reemplaza las fuentes propuestas antes de usar el mapa como material académico.'],
      sources: userSources, sourceUrl: sourceUrl.trim() || undefined,
    }),
  });

  finalSections.forEach((section, index) => {
    const meta = colors[index % colors.length];
    const side = index % 2 === 0 ? 'left' : 'right';
    const row = Math.floor(index / 2);
    const branchId = `branch-${index + 1}`;
    const y = 62 + row * 235;
    nodes.push({
      id: branchId, type: 'study', position: { x: side === 'left' ? 260 : 900, y },
      data: makeNodeData({
        title: section.heading.slice(0, 58), category: meta.name, color: meta.color, emoji: meta.emoji,
        kind: 'branch', side, parentId: 'root', description: section.text,
        summary: splitConcepts(section.text).slice(0, 3).length ? splitConcepts(section.text).slice(0, 3) : [section.text], sources: userSources,
        sourceUrl: sourceUrl.trim() || undefined,
      }),
    });
    edges.push({ id: `e-root-${branchId}`, source: 'root', target: branchId, sourceHandle: side, targetHandle: 'target', type: 'default', style: { stroke: meta.color, strokeWidth: 2.2 } });

    const conceptLines = splitConcepts(section.text).slice(0, 2);
    conceptLines.forEach((line, conceptIndex) => {
      const conceptId = `${branchId}-concept-${conceptIndex + 1}`;
      const conceptTitle = guessHeading(line, conceptIndex).slice(0, 48);
      nodes.push({
        id: conceptId, type: 'study', position: { x: side === 'left' ? 18 : 1150, y: y - 20 + conceptIndex * 104 },
        data: makeNodeData({
          title: conceptTitle, category: meta.name, color: meta.color, emoji: meta.emoji,
          kind: 'concept', side, parentId: branchId, description: line,
          summary: [line, 'Contrasta este punto con tus fuentes de clase y añade un ejemplo concreto.'], sources: userSources,
          sourceUrl: sourceUrl.trim() || undefined,
        }),
      });
      edges.push({ id: `e-${branchId}-${conceptId}`, source: branchId, target: conceptId, sourceHandle: 'source', targetHandle: 'target', type: 'default', style: { stroke: meta.color, strokeWidth: 1.7, opacity: 0.8 } });
    });
  });
  return { nodes, edges };
}
