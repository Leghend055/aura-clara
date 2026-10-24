import type { StudyEdge, StudyMapFile, StudyNode } from '../types';

export function makeStudyMapFile(title: string, nodes: StudyNode[], edges: StudyEdge[], sourceDocument = ''): StudyMapFile {
  return { schemaVersion: 1, title, exportedAt: new Date().toISOString(), nodes, edges, ...(sourceDocument ? { sourceDocument } : {}) };
}

export function parseStudyMapFile(raw: unknown): StudyMapFile {
  if (!raw || typeof raw !== 'object') throw new Error('El archivo no contiene un objeto JSON válido.');
  const candidate = raw as Partial<StudyMapFile>;
  if (candidate.schemaVersion !== 1 || typeof candidate.title !== 'string' || !Array.isArray(candidate.nodes) || !Array.isArray(candidate.edges)) {
    throw new Error('El JSON no tiene el formato de un mapa de estudio exportado por esta aplicación.');
  }
  if (!candidate.nodes.length || !candidate.nodes.every((node) => node && typeof node.id === 'string' && node.position && node.data && typeof node.data.title === 'string')) {
    throw new Error('El JSON contiene nodos incompletos o no válidos.');
  }
  if (!candidate.edges.every((edge) => edge && typeof edge.id === 'string' && typeof edge.source === 'string' && typeof edge.target === 'string')) {
    throw new Error('El JSON contiene conexiones no válidas.');
  }
  return { schemaVersion: 1, title: candidate.title, exportedAt: candidate.exportedAt ?? new Date().toISOString(), nodes: candidate.nodes as StudyNode[], edges: candidate.edges as StudyEdge[], sourceDocument: typeof candidate.sourceDocument === 'string' ? candidate.sourceDocument : '' };
}

export function getOrderedRoute(nodes: StudyNode[]): StudyNode[] {
  const ordered: StudyNode[] = [];
  const visit = (parentId: string) => {
    const children = nodes.filter((node) => node.data.parentId === parentId);
    for (const child of children) {
      ordered.push(child);
      visit(child.id);
    }
  };
  const root = nodes.find((node) => node.id === 'root');
  if (root) ordered.push(root);
  visit('root');
  return ordered;
}

export function conceptsUnderBranch(nodes: StudyNode[], branchId: string): StudyNode[] {
  return nodes.filter((node) => node.data.parentId === branchId && node.data.kind === 'concept');
}
