import type { Edge, Node } from '@xyflow/react';

export type NodeKind = 'root' | 'branch' | 'concept';
export type NodeSide = 'left' | 'right' | 'center';

export type StudyNodeData = {
  title: string;
  category: string;
  color: string;
  emoji: string;
  kind: NodeKind;
  side: NodeSide;
  description: string;
  summary: string[];
  sources: string[];
  completed: boolean;
  question: boolean;
  parentId?: string;
  sourceUrl?: string;
};

export type StudyNode = Node<StudyNodeData, 'study'>;
export type StudyEdge = Edge;

export type StudyMapFile = {
  schemaVersion: 1;
  title: string;
  exportedAt: string;
  nodes: StudyNode[];
  edges: StudyEdge[];
  sourceDocument?: string;
};

export type CategoryMeta = {
  name: string;
  color: string;
  tint: string;
  emoji: string;
};
