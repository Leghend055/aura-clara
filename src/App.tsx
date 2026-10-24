import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowDownRight, ArrowRight, BookOpen, CheckCircle2, ChevronDown, CircleHelp, Download,
  ExternalLink, Headphones, Layers3, ListTree, Maximize2, Network, Plus, Search, Settings2,
  Target, X, ZoomIn, ZoomOut, RotateCcw, BrainCircuit, BookMarked, Info, Palette, Pencil, Check, Sparkles,
  LayoutGrid, Clock, ArrowUpRight, GraduationCap, FileText, ChevronLeft, ChevronRight, Lightbulb, LogOut, Cloud, LoaderCircle, UserRound,
} from 'lucide-react';
import {
  Background, BackgroundVariant, Controls, MiniMap, Panel, ReactFlow, ReactFlowProvider,
  useEdgesState, useNodesState, useReactFlow,
} from '@xyflow/react';
import type { NodeMouseHandler } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import * as pdfjs from 'pdfjs-dist';
import type { StudyEdge, StudyMapFile, StudyNode, StudyNodeData } from './types';
import { categories } from './data/initialMap';
import StudyNodeCard from './components/StudyNode';
import CreatorModal from './components/CreatorModal';
import DetailsPanel from './components/DetailsPanel';
import { generateMapFromNotes } from './lib/contentParser';
import { conceptsUnderBranch, getOrderedRoute, makeStudyMapFile, parseStudyMapFile } from './lib/mapUtils';
import './index.css';
import { AuthGate, useAuth } from './auth/AuthGate';
import { supabase } from './lib/supabase';
import { generateAIExam, generateStudyMapWithAI } from './lib/aiStudy';
import type { AIExamQuestion } from './lib/aiStudy';

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const nodeTypes = { study: StudyNodeCard };
type Tab = 'Mapa' | 'Lectura' | 'Repasar' | 'Fuentes';

type StudyWorkspace = { id: string; title: string; nodes: StudyNode[]; edges: StudyEdge[]; sourceDocument?: string; updatedAt: string };
type AppView = 'spaces' | 'study';
type ThemeName = 'crema' | 'lavanda' | 'menta' | 'cielo' | 'rosa';

const themeOptions: { id: ThemeName; name: string; description: string; colors: string[] }[] = [
  { id: 'crema', name: 'Crema suave', description: 'Cálido y sereno', colors: ['#f7f5ef', '#ffffff', '#667eaa'] },
  { id: 'lavanda', name: 'Lavanda', description: 'Tranquilo y delicado', colors: ['#f5f0fa', '#fffaff', '#9274b5'] },
  { id: 'menta', name: 'Menta', description: 'Fresco y natural', colors: ['#eff7f2', '#fbfffc', '#588e79'] },
  { id: 'cielo', name: 'Cielo', description: 'Ligero y luminoso', colors: ['#eef5fb', '#fbfdff', '#5d87b7'] },
  { id: 'rosa', name: 'Rosa empolvado', description: 'Suave y acogedor', colors: ['#fbf1f3', '#fffafb', '#b7748a'] },
];
const WORKSPACES_KEY = 'aura-clara-workspaces-v1';
const LEGACY_STORAGE_KEY = 'aura-clara-study-map-v2';
const ONBOARDING_KEY = 'aura-clara-onboarding-v1';

function makeWorkspaceId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `space-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function readStoredWorkspaces(): StudyWorkspace[] {
  try {
    const storedWorkspaces = localStorage.getItem(WORKSPACES_KEY);
    if (storedWorkspaces) {
      const raw = JSON.parse(storedWorkspaces);
      if (Array.isArray(raw)) {
        return raw.flatMap((item: unknown, index: number) => {
          try {
            if (!item || typeof item !== 'object') return [];
            const candidate = item as Partial<StudyWorkspace>;
            const parsed = parseStudyMapFile({ schemaVersion: 1, title: candidate.title, exportedAt: candidate.updatedAt, nodes: candidate.nodes, edges: candidate.edges, sourceDocument: candidate.sourceDocument });
            return [{ id: typeof candidate.id === 'string' ? candidate.id : `recovered-${index}`, title: parsed.title, nodes: parsed.nodes, edges: parsed.edges, sourceDocument: parsed.sourceDocument ?? '', updatedAt: typeof candidate.updatedAt === 'string' ? candidate.updatedAt : parsed.exportedAt }];
          } catch { return []; }
        });
      }
    }
    // Migrate the previous single-map version without showing sample content to new users.
    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacy) {
      const parsed = parseStudyMapFile(JSON.parse(legacy));
      return [{ id: 'migrated-main-space', title: parsed.title, nodes: parsed.nodes, edges: parsed.edges, sourceDocument: parsed.sourceDocument ?? '', updatedAt: parsed.exportedAt ?? new Date().toISOString() }];
    }
  } catch { /* El inicio permanece disponible aunque el almacenamiento local esté bloqueado. */ }
  return [];
}

function shouldShowOnboarding(): boolean {
  try { return localStorage.getItem(ONBOARDING_KEY) !== 'done'; } catch { return true; }
}

function externalSourceUrl(source: string): string {
  const urlMatch = source.match(/https?:\/\/\S+/i);
  return urlMatch ? urlMatch[0].replace(/[),.;]+$/, '') : `https://scholar.google.com/scholar?q=${encodeURIComponent(source)}`;
}

function Dashboard() {
  const { user, signOut, cloudEnabled } = useAuth();
  const [workspaces, setWorkspaces] = useState<StudyWorkspace[]>(() => readStoredWorkspaces());
  const [cloudReady, setCloudReady] = useState(!cloudEnabled);
  const [currentView, setCurrentView] = useState<AppView>('spaces');
  const [currentWorkspaceId, setCurrentWorkspaceId] = useState<string | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(shouldShowOnboarding);
  const [onboardingReplayKey, setOnboardingReplayKey] = useState(0);
  const [title, setTitle] = useState('');
  const [titleDraft, setTitleDraft] = useState('');
  const [editingTitle, setEditingTitle] = useState(false);
  const [nodes, setNodes, onNodesChange] = useNodesState<StudyNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<StudyEdge>([]);
  const [sourceDocument, setSourceDocument] = useState('');
  const [selectedNodeId, setSelectedNodeId] = useState('');
  const [tab, setTab] = useState<Tab>('Mapa');
  const [search, setSearch] = useState('');
  const [creatorOpen, setCreatorOpen] = useState(false);
  const [themePickerOpen, setThemePickerOpen] = useState(false);
  const [theme, setTheme] = useState<ThemeName>(() => {
    try { const saved = localStorage.getItem('aura-clara-theme'); return themeOptions.some((option) => option.id === saved) ? saved as ThemeName : 'crema'; } catch { return 'crema'; }
  });
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [toast, setToast] = useState('');
  const [reviewIndex, setReviewIndex] = useState(0);
  const [reviewChoice, setReviewChoice] = useState<string | null>(null);
  const [reviewChecked, setReviewChecked] = useState(false);
  const [reviewScore, setReviewScore] = useState(0);
  const [aiExam, setAiExam] = useState<AIExamQuestion[] | null>(null);
  const [aiExamIndex, setAiExamIndex] = useState(0);
  const [aiExamChoice, setAiExamChoice] = useState<number | null>(null);
  const [aiExamChecked, setAiExamChecked] = useState(false);
  const [aiExamScore, setAiExamScore] = useState(0);
  const [aiExamLoading, setAiExamLoading] = useState(false);
  const { zoomIn, zoomOut, fitView, setCenter } = useReactFlow();

  const selectedNode = useMemo(() => nodes.find((node) => node.id === selectedNodeId), [nodes, selectedNodeId]);
  const orderedRoute = useMemo(() => getOrderedRoute(nodes), [nodes]);
  const concepts = useMemo(() => nodes.filter((node) => node.data.kind === 'concept'), [nodes]);
  const branches = useMemo(() => nodes.filter((node) => node.data.kind === 'branch'), [nodes]);
  const questionNodes = useMemo(() => nodes.filter((node) => node.data.question && node.data.kind !== 'root'), [nodes]);
  const completedConcepts = concepts.filter((node) => node.data.completed).length;
  const completionPercentage = concepts.length ? Math.round((completedConcepts / concepts.length) * 100) : 0;

  useEffect(() => {
    if (cloudEnabled) return;
    try { localStorage.setItem(WORKSPACES_KEY, JSON.stringify(workspaces)); }
    catch { /* Exportar JSON sigue disponible si el almacenamiento está lleno o bloqueado. */ }
  }, [workspaces, cloudEnabled]);

  // In cloud mode, load only records owned by the signed-in user. Local cache is not shown or migrated automatically.
  useEffect(() => {
    if (!cloudEnabled || !user || !supabase) { setCloudReady(true); return; }
    let cancelled = false;
    setCloudReady(false);
    void (async () => {
      const { data, error } = await supabase
        .from('study_maps')
        .select('id,title,map_data,updated_at')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });
      if (error) throw error;
      const loaded: StudyWorkspace[] = (data ?? []).flatMap((row: { id: string; title: string; map_data: unknown; updated_at: string }) => {
        const value = row.map_data as { nodes?: StudyNode[]; edges?: StudyEdge[]; sourceDocument?: string } | null;
        if (!value || !Array.isArray(value.nodes) || !Array.isArray(value.edges)) return [];
        return [{ id: row.id, title: row.title, nodes: value.nodes, edges: value.edges, sourceDocument: typeof value.sourceDocument === 'string' ? value.sourceDocument : '', updatedAt: row.updated_at }];
      });
      if (!cancelled) { setWorkspaces(loaded); setCloudReady(true); }
    })().catch((error: unknown) => {
      if (!cancelled) { setWorkspaces([]); setCloudReady(true); setToast(`No se pudieron cargar tus mapas de la nube: ${error instanceof Error ? error.message : 'error desconocido'}`); }
    });
    return () => { cancelled = true; };
  }, [cloudEnabled, user?.id]);

  // Debounced sync prevents every node drag from producing a database write.
  useEffect(() => {
    if (!cloudEnabled || !user || !supabase || !cloudReady) return;
    if (!workspaces.length) return;
    const timeout = window.setTimeout(() => {
      const rows = workspaces.map((workspace) => ({
        user_id: user.id,
        id: workspace.id,
        title: workspace.title || 'Nuevo tema de estudio',
        map_data: { schemaVersion: 1, nodes: workspace.nodes, edges: workspace.edges, sourceDocument: workspace.sourceDocument ?? '' },
        updated_at: workspace.updatedAt || new Date().toISOString(),
      }));
      void supabase.from('study_maps').upsert(rows, { onConflict: 'user_id,id' }).then(({ error }) => {
        if (error) setToast(`No se pudo sincronizar con la nube: ${error.message}`);
      });
    }, 900);
    return () => window.clearTimeout(timeout);
  }, [workspaces, cloudEnabled, user?.id, cloudReady]);

  useEffect(() => {
    if (!currentWorkspaceId) return;
    setWorkspaces((current) => {
      if (!current.some((workspace) => workspace.id === currentWorkspaceId)) return current;
      const nextUpdatedAt = new Date().toISOString();
      return current.map((workspace) => workspace.id === currentWorkspaceId
        ? { ...workspace, title: title || 'Nuevo tema de estudio', nodes, edges, sourceDocument, updatedAt: nextUpdatedAt }
        : workspace);
    });
  }, [title, nodes, edges, sourceDocument, currentWorkspaceId]);

  useEffect(() => {
    try { localStorage.setItem('aura-clara-theme', theme); } catch { /* La apariencia sigue disponible durante esta sesión. */ }
  }, [theme]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => () => {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  }, []);

  const centerOnNode = useCallback((node: StudyNode) => {
    setSelectedNodeId(node.id);
    setTab('Mapa');
    setCenter(node.position.x + (node.data.kind === 'root' ? 120 : 90), node.position.y + 38, { zoom: node.data.kind === 'root' ? 0.72 : 0.95, duration: 450 });
  }, [setCenter]);

  const onNodeClick: NodeMouseHandler<StudyNode> = useCallback((_event, node) => {
    setSelectedNodeId(node.id);
  }, []);

  const handleSearch = useCallback((value = search) => {
    const normalized = value.trim().toLocaleLowerCase('es');
    if (!normalized) return;
    const match = nodes.find((node) => `${node.data.title} ${node.data.description} ${node.data.category}`.toLocaleLowerCase('es').includes(normalized));
    if (match) {
      setSelectedNodeId(match.id);
      setTab('Mapa');
      setCenter(match.position.x + 80, match.position.y + 35, { zoom: 0.9, duration: 500 });
    } else {
      setToast('No se encontraron conceptos con ese término.');
    }
  }, [nodes, search, setCenter]);

  const speakText = useCallback((text: string) => {
    if (!('speechSynthesis' in window)) {
      setToast('Este navegador no admite síntesis de voz. Prueba con una versión actualizada de Chrome, Edge o Safari.');
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'es-ES';
    utterance.rate = speed;
    utterance.onstart = () => { setIsSpeaking(true); setIsPaused(false); };
    utterance.onend = () => { setIsSpeaking(false); setIsPaused(false); };
    utterance.onerror = () => { setIsSpeaking(false); setIsPaused(false); };
    window.speechSynthesis.speak(utterance);
    setIsSpeaking(true);
    setIsPaused(false);
  }, [speed]);

  const narrate = useCallback((fromCurrent: boolean) => {
    const baseNode = selectedNode;
    if (!baseNode) return;
    const startIndex = orderedRoute.findIndex((node) => node.id === baseNode.id);
    const list = fromCurrent ? orderedRoute.slice(Math.max(0, startIndex)) : [baseNode];
    const speech = list.map((node) => `${node.data.title}. ${node.data.description} ${node.data.summary.join('. ')}`).join('. Siguiente concepto. ');
    speakText(speech);
  }, [orderedRoute, selectedNode, speakText]);

  const narrateWholeRoute = useCallback(() => {
    const speech = orderedRoute.map((node) => `${node.data.title}. ${node.data.description}`).join('. Siguiente punto. ');
    if (!speech.trim()) { setToast('Primero crea un mapa para poder narrar el recorrido.'); return; }
    speakText(speech);
  }, [orderedRoute, speakText]);

  const togglePause = useCallback(() => {
    if (!('speechSynthesis' in window)) return;
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
      setIsPaused(false);
      setIsSpeaking(true);
    } else if (window.speechSynthesis.speaking) {
      window.speechSynthesis.pause();
      setIsPaused(true);
    }
  }, []);

  const goToNextNode = useCallback(() => {
    if (!orderedRoute.length) return;
    const currentIndex = orderedRoute.findIndex((node) => node.id === selectedNodeId);
    const next = orderedRoute[(currentIndex + 1 + orderedRoute.length) % orderedRoute.length];
    centerOnNode(next);
  }, [centerOnNode, orderedRoute, selectedNodeId]);

  const toggleComplete = useCallback(() => {
    if (!selectedNode) return;
    const nextValue = !selectedNode.data.completed;
    setNodes((current) => current.map((node) => node.id === selectedNode.id ? { ...node, data: { ...node.data, completed: nextValue } } : node));
  }, [selectedNode, setNodes]);

  const generateFromNotes = useCallback(async (newTitle: string, content: string, sourceUrl: string) => {
    let generated = generateMapFromNotes(newTitle, content, sourceUrl);
    let aiGenerated = false;
    let aiFailure = '';
    if (cloudEnabled && user && content.trim()) {
      try {
        generated = await generateStudyMapWithAI(newTitle, content, sourceUrl);
        aiGenerated = true;
      } catch (error) {
        aiFailure = error instanceof Error ? error.message : 'No se pudo contactar con el servicio de IA.';
      }
    }
    const workspaceId = makeWorkspaceId();
    const freshWorkspace: StudyWorkspace = { id: workspaceId, title: newTitle, nodes: generated.nodes, edges: generated.edges, sourceDocument: content, updatedAt: new Date().toISOString() };
    setWorkspaces((current) => [...current, freshWorkspace]);
    setCurrentWorkspaceId(workspaceId);
    setCurrentView('study');
    setTitle(newTitle);
    setTitleDraft(newTitle);
    setEditingTitle(false);
    setSourceDocument(content);
    setNodes(generated.nodes);
    setEdges(generated.edges);
    setSelectedNodeId('root');
    setTab('Mapa');
    setReviewIndex(0);
    setReviewChoice(null);
    setReviewChecked(false);
    setReviewScore(0);
    setCreatorOpen(false);
    setTimeout(() => fitView({ padding: 0.18, duration: 500 }), 80);
    setToast(aiGenerated ? 'Mapa generado con IA a partir de tus apuntes. Revisa las explicaciones y fuentes antes de estudiar.' : aiFailure ? `La IA no respondió (${aiFailure}). Se creó una estructura básica; puedes volver a intentarlo.` : content.trim() ? 'Mapa organizado localmente. Inicia sesión y configura la función de IA para obtener generación semántica.' : 'Estructura inicial creada. Añade apuntes para completar las explicaciones.');
  }, [cloudEnabled, fitView, setEdges, setNodes, user?.id]);

  const importMapFromFile = useCallback((mapFile: StudyMapFile) => {
    const workspaceId = makeWorkspaceId();
    const importedWorkspace: StudyWorkspace = { id: workspaceId, title: mapFile.title, nodes: mapFile.nodes, edges: mapFile.edges, sourceDocument: mapFile.sourceDocument ?? '', updatedAt: new Date().toISOString() };
    setWorkspaces((current) => [...current, importedWorkspace]);
    setCurrentWorkspaceId(workspaceId);
    setCurrentView('study');
    setCreatorOpen(false);
    setTitle(mapFile.title);
    setTitleDraft(mapFile.title);
    setEditingTitle(false);
    setSourceDocument(mapFile.sourceDocument ?? '');
    setNodes(mapFile.nodes);
    setEdges(mapFile.edges);
    setSelectedNodeId(mapFile.nodes.find((node) => node.data.kind === 'root')?.id ?? mapFile.nodes[0].id);
    setTab('Mapa');
    setReviewIndex(0);
    setReviewChoice(null);
    setReviewChecked(false);
    setReviewScore(0);
    setTimeout(() => fitView({ padding: 0.18, duration: 500 }), 80);
    setToast(`Mapa «${mapFile.title}» importado correctamente.`);
  }, [fitView, setEdges, setNodes]);

  const openWorkspace = useCallback((workspace: StudyWorkspace) => {
    setCurrentWorkspaceId(workspace.id);
    setTitle(workspace.title);
    setTitleDraft(workspace.title);
    setEditingTitle(false);
    setNodes(workspace.nodes);
    setEdges(workspace.edges);
    setSourceDocument(workspace.sourceDocument ?? '');
    setSelectedNodeId(workspace.nodes.find((node) => node.data.kind === 'root')?.id ?? workspace.nodes[0]?.id ?? '');
    setTab('Mapa');
    setCurrentView('study');
    setReviewIndex(0); setReviewChoice(null); setReviewChecked(false); setReviewScore(0);
    window.setTimeout(() => fitView({ padding: 0.18, duration: 500 }), 100);
  }, [fitView, setEdges, setNodes]);

  const returnToSpaces = useCallback(() => {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    setIsSpeaking(false); setIsPaused(false);
    setCurrentView('spaces');
    setThemePickerOpen(false);
  }, []);

  const deleteWorkspace = useCallback((workspaceId: string) => {
    const workspace = workspaces.find((item) => item.id === workspaceId);
    if (!workspace || !window.confirm(`¿Eliminar «${workspace.title}» de Mis Espacios? Esta acción no se puede deshacer.`)) return;
    setWorkspaces((current) => current.filter((item) => item.id !== workspaceId));
    if (cloudEnabled && user && supabase) { void supabase.from('study_maps').delete().eq('user_id', user.id).eq('id', workspaceId).then(({ error }) => { if (error) setToast(`No se pudo eliminar de la nube: ${error.message}`); }); }
    if (currentWorkspaceId === workspaceId) {
      setCurrentWorkspaceId(null); setTitle(''); setTitleDraft(''); setSourceDocument(''); setNodes([]); setEdges([]); setSelectedNodeId('');
    }
    setToast('El espacio se eliminó correctamente.');
  }, [cloudEnabled, currentWorkspaceId, setEdges, setNodes, user?.id, workspaces]);

  const finishOnboarding = useCallback(() => {
    try { localStorage.setItem(ONBOARDING_KEY, 'done'); } catch { /* El tutorial puede cerrarse aunque el navegador no permita guardar preferencias. */ }
    setShowOnboarding(false);
  }, []);

  const replayOnboarding = useCallback(() => {
    setOnboardingReplayKey((key) => key + 1);
    setShowOnboarding(true);
  }, []);

  const readFileForCreator = useCallback(async (file: File): Promise<string | null> => {
    const lowerName = file.name.toLowerCase();
    if (lowerName.endsWith('.json')) {
      const parsed = parseStudyMapFile(JSON.parse(await file.text()));
      importMapFromFile(parsed);
      return null;
    }
    if (lowerName.endsWith('.pdf') || file.type === 'application/pdf') {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const document = await pdfjs.getDocument({ data: bytes }).promise;
      const pages: string[] = [];
      for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
        const page = await document.getPage(pageNumber);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item) => ('str' in item ? item.str : '')).join(' ');
        pages.push(pageText);
      }
      const result = pages.join('\n\n').trim();
      if (!result) throw new Error('No se encontró texto seleccionable en el PDF. Si es un escaneo, convierte sus páginas a texto o pega un resumen.');
      return result;
    }
    if (/\.(txt|md|markdown|csv)$/i.test(lowerName) || file.type.startsWith('text/')) return await file.text();
    throw new Error('Formato no compatible. Usa PDF, TXT, Markdown, CSV o JSON.');
  }, [importMapFromFile]);

  const exportMap = useCallback(() => {
    if (!nodes.length) { setToast('Crea o importa un mapa antes de exportarlo.'); return; }
    const file = makeStudyMapFile(title || 'Nuevo tema de estudio', nodes, edges, sourceDocument);
    const blob = new Blob([JSON.stringify(file, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${title.toLocaleLowerCase('es').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-') || 'mapa-estudio'}.json`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setToast('Mapa exportado en formato JSON.');
  }, [edges, nodes, sourceDocument, title]);

  const saveTitle = useCallback(() => {
    const nextTitle = titleDraft.trim() || 'Nuevo tema de estudio';
    setTitle(nextTitle);
    setTitleDraft(nextTitle);
    setNodes((current) => current.map((node) => node.data.kind === 'root' ? { ...node, data: { ...node.data, title: nextTitle } } : node));
    setEditingTitle(false);
  }, [setNodes, titleDraft]);

  const chooseTab = (nextTab: Tab) => {
    setThemePickerOpen(false);
    setTab(nextTab);
    if (nextTab === 'Mapa') setTimeout(() => fitView({ padding: 0.15, duration: 350 }), 50);
  };

  const retryReview = () => {
    setReviewIndex(0);
    setReviewChoice(null);
    setReviewChecked(false);
    setReviewScore(0);
  };

  const handleGenerateAIExam = useCallback(async () => {
    if (!cloudEnabled || !user) { setToast('Inicia sesión y configura la beta en la nube para generar un examen con IA.'); return; }
    const material = sourceDocument.trim() || nodes.filter((node) => node.data.kind !== 'root').map((node) => `${node.data.title}\n${node.data.description}\n${node.data.summary.join('\n')}`).join('\n\n');
    setAiExamLoading(true);
    try {
      const generated = await generateAIExam(title, material);
      setAiExam(generated); setAiExamIndex(0); setAiExamChoice(null); setAiExamChecked(false); setAiExamScore(0);
      setToast(`Examen generado con IA: ${generated.length} preguntas basadas en el material de estudio.`);
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'No se pudo generar el examen con IA.');
    } finally { setAiExamLoading(false); }
  }, [cloudEnabled, nodes, sourceDocument, title, user?.id]);

  if (cloudEnabled && !cloudReady) return <div className="cloud-loading-screen"><div className="auth-spinner-wrap"><LoaderCircle className="auth-spinner" size={26}/></div><h2>Sincronizando tus espacios</h2><p>Estamos cargando tus mapas privados.</p></div>;

  return (
    <div className="app-shell" data-theme={theme}>
      {currentView === 'spaces' ? (
        <SpacesDashboard
          workspaces={workspaces}
          theme={theme}
          themeOptions={themeOptions}
          onThemeChange={setTheme}
          onCreate={() => setCreatorOpen(true)}
          onOpen={openWorkspace}
          onDelete={deleteWorkspace}
          onReplayTutorial={replayOnboarding}
          cloudEnabled={cloudEnabled}
          userEmail={user?.email ?? ''}
          onSignOut={() => { void signOut(); }}
        />
      ) : (
      <>
      <header className="app-header">
        <div className="header-main-row">
          <button className="brand-lockup" onClick={returnToSpaces} aria-label="Ir a Mis Espacios">
            <span className="brand-mark"><BrainCircuit size={23} strokeWidth={1.8} /></span>
            <span className="brand-name">aura<span>clara</span><small>STUDY SPACE</small></span>
          </button>
          <button className="spaces-return-button" onClick={returnToSpaces} title="Volver al panel de mapas"><LayoutGrid size={15} /> <span>Mis Espacios</span></button>
          <div className="header-topic">
            <div className="header-topic-eyebrow"><span className="tiny-status-dot" /> TU ESPACIO DE APRENDIZAJE</div>
            <div className="header-topic-title-row">
              {editingTitle ? <form className="title-edit-form" onSubmit={(event) => { event.preventDefault(); saveTitle(); }}><input autoFocus aria-label="Nuevo título del mapa" value={titleDraft} onChange={(event) => setTitleDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Escape') setEditingTitle(false); }} placeholder="Título del tema" /><button className="icon-button title-save-button" type="submit" aria-label="Guardar título"><Check size={15} /></button></form> : <><h1>{title || 'Tu espacio de estudio'}</h1>{nodes.length > 0 && <button className="title-edit-button" title="Editar título del mapa" aria-label="Editar título del mapa" onClick={() => { setTitleDraft(title); setEditingTitle(true); }}><Pencil size={13} /></button>}</>}
            </div>
            <p>{nodes.length ? 'Organiza ideas. Conecta conceptos. Aprende a tu ritmo.' : 'Tu lienzo está listo para tus propias ideas y apuntes.'}</p>
          </div>
          <div className="header-right-tools">
            <div className="global-search-wrap">
              <Search size={16} />
              <input aria-label="Buscar conceptos" value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') handleSearch(); }} placeholder="Buscar conceptos…" />
              {search && <button className="search-clear" aria-label="Limpiar búsqueda" onClick={() => setSearch('')}><X size={14} /></button>}
              <kbd>↵</kbd>
            </div>
            <div className="header-zoom-group" aria-label="Controles de zoom del mapa">
              <button className="icon-button" aria-label="Alejar mapa" title="Alejar" disabled={!nodes.length} onClick={() => void zoomOut({ duration: 140 })}><ZoomOut size={16} /></button>
              <button className="icon-button" aria-label="Acercar mapa" title="Acercar" disabled={!nodes.length} onClick={() => void zoomIn({ duration: 140 })}><ZoomIn size={16} /></button>
              <button className="icon-button" aria-label="Ajustar mapa a pantalla" title="Ajustar a pantalla" disabled={!nodes.length} onClick={() => void fitView({ padding: 0.16, duration: 320 })}><Maximize2 size={15} /></button>
            </div>
          </div>
        </div>
        <div className="header-lower-row">
          <nav className="main-nav" aria-label="Secciones del espacio de estudio">
            {([
              { name: 'Mapa', icon: Network }, { name: 'Lectura', icon: BookOpen }, { name: 'Repasar', icon: CircleHelp }, { name: 'Fuentes', icon: BookMarked },
            ] as const).map(({ name, icon: Icon }) => (
              <button key={name} className={`nav-tab ${tab === name ? 'nav-tab-active' : ''}`} onClick={() => chooseTab(name)}><Icon size={16} strokeWidth={1.8} />{name}{tab === name && <span className="nav-tab-dot" />}</button>
            ))}
          </nav>
          <div className="header-actions">
            <div className="theme-picker-wrap">
              <button className={`quiet-button theme-trigger ${themePickerOpen ? 'theme-trigger-active' : ''}`} onClick={() => setThemePickerOpen((open) => !open)} aria-expanded={themePickerOpen}><Palette size={15} /> Temas</button>
              {themePickerOpen && <div className="theme-picker-popover" role="dialog" aria-label="Temas de apariencia"><div className="theme-picker-heading"><strong>Un espacio a tu gusto</strong><span>Elige una paleta visual</span></div>{themeOptions.map((option) => <button className={`theme-choice ${theme === option.id ? 'theme-choice-active' : ''}`} key={option.id} onClick={() => { setTheme(option.id); setThemePickerOpen(false); }}><span className="theme-swatches">{option.colors.map((color) => <i key={color} style={{ backgroundColor: color }} />)}</span><span className="theme-choice-copy"><strong>{option.name}</strong><small>{option.description}</small></span><span className="theme-choice-check">{theme === option.id ? '✓' : ''}</span></button>)}<p className="theme-picker-footnote">La preferencia se guarda en este navegador.</p></div>}
            </div>
            <button className="quiet-button" onClick={exportMap} disabled={!nodes.length}><Download size={15} /> Exportar JSON</button>
            <button className="primary-button header-create-button" onClick={() => { setThemePickerOpen(false); setCreatorOpen(true); }}><Plus size={17} /> Crear mapa</button>
          </div>
        </div>
      </header>

      <div className="workspace-heading-row">
        <div className="breadcrumb"><span>Mis espacios</span><ArrowRight size={13} /><strong>{title || 'Sin mapa seleccionado'}</strong></div>
        <div className="workspace-status"><span className="saved-dot" /> {nodes.length ? (cloudEnabled ? 'Sincronización en la nube activa' : 'Guardado localmente') : 'Espacio vacío'} <span className="status-divider" /> <span>{completionPercentage}% completado</span></div>
      </div>

      <main className="workspace-grid">
        <aside className="explorer-panel">
          <div className="panel-section-title"><div className="panel-title-icon"><ListTree size={17} /></div><div><h2>Tu recorrido</h2><p>Explorador de conceptos</p></div><button className="icon-button panel-settings" title="Opciones del recorrido" onClick={() => setToast('Consejo: selecciona una rama para explorar sus conceptos.')}><Settings2 size={16} /></button></div>
          <div className="stats-grid">
            <div className="stat-tile"><span className="stat-icon stat-icon-blue"><Layers3 size={16} /></span><strong>{concepts.length}</strong><span>Conceptos</span></div>
            <div className="stat-tile"><span className="stat-icon stat-icon-peach"><Network size={16} /></span><strong>{branches.length}</strong><span>Ramas</span></div>
            <div className="stat-tile"><span className="stat-icon stat-icon-purple"><CircleHelp size={16} /></span><strong>{questionNodes.length}</strong><span>Preguntas</span></div>
          </div>

          <div className="journey-card">
            <div className="journey-card-top"><div className="journey-icon"><Target size={17} /></div><span className="journey-chip">EN PROGRESO</span></div>
            <h3>Tu siguiente paso</h3>
            <p>Continúa donde lo dejaste y avanza concepto a concepto.</p>
            <button className="journey-button" onClick={goToNextNode} disabled={!orderedRoute.length}>Retomar recorrido <ArrowRight size={15} /></button>
            <button className="journey-audio-button" onClick={narrateWholeRoute} disabled={!orderedRoute.length}><Headphones size={15} /> Escuchar recorrido narrado</button>
            {!nodes.length && <p className="sidebar-empty-note">Cuando cargues apuntes, tus ramas y el progreso aparecerán aquí.</p>}
          </div>

          <div className="explorer-list-header"><h3>Vista general</h3><span>{completedConcepts}/{concepts.length} conceptos</span></div>
          <div className="overall-progress"><div className="overall-progress-fill" style={{ width: `${completionPercentage}%` }} /></div>
          <div className="branch-list">
            {branches.map((branch, index) => {
              const branchConcepts = conceptsUnderBranch(nodes, branch.id);
              const done = branchConcepts.filter((node) => node.data.completed).length;
              const isActive = selectedNodeId === branch.id || selectedNode?.data.parentId === branch.id;
              return (
                <button className={`branch-row ${isActive ? 'branch-row-active' : ''}`} key={branch.id} onClick={() => centerOnNode(branch)}>
                  <span className="branch-emoji" style={{ backgroundColor: `${branch.data.color}19` }}>{branch.data.emoji}</span>
                  <span className="branch-row-copy"><strong>{branch.data.title}</strong><small>{done}/{branchConcepts.length} conceptos</small><span className="branch-mini-progress"><span style={{ width: `${branchConcepts.length ? done / branchConcepts.length * 100 : 0}%`, backgroundColor: branch.data.color }} /></span></span>
                  <span className="branch-row-end"><span className="branch-index">{String(index + 1).padStart(2, '0')}</span><ChevronDown size={14} className="branch-chevron" /></span>
                </button>
              );
            })}
          </div>

          <div className="explorer-bottom-card"><div className="book-illustration"><BookOpen size={19} /></div><div><strong>Pequeños pasos, grandes ideas</strong><p>Completa una rama para consolidar lo aprendido.</p></div></div>
        </aside>

        <section className="center-workspace" aria-label="Contenido principal">
          {tab === 'Mapa' && (
            <div className="map-panel">
              {!nodes.length ? <div className="empty-map-state"><div className="empty-map-art"><span className="empty-orbit empty-orbit-one" /><span className="empty-orbit empty-orbit-two" /><span className="empty-brain-icon"><BrainCircuit size={36} /></span><span className="empty-sparkle empty-sparkle-one">✦</span><span className="empty-sparkle empty-sparkle-two">✧</span></div><span className="eyebrow">TU LIENZO PERSONAL</span><h2>Todo empieza con una idea</h2><p>Sube un documento, pega tus apuntes o escribe un tema para convertirlo en un mapa mental que puedas explorar a tu ritmo.</p><div className="empty-map-actions"><button className="primary-button" onClick={() => setCreatorOpen(true)}><Sparkles size={16} /> Crear mi primer mapa</button><button className="secondary-button" onClick={() => setCreatorOpen(true)}><BookOpen size={16} /> Cargar apuntes</button></div><div className="empty-map-perks"><span><CheckCircle2 size={14} /> PDF y texto</span><span><CheckCircle2 size={14} /> Lectura integrada</span><span><CheckCircle2 size={14} /> Temas personalizables</span></div></div> : <>
              <div className="canvas-topbar"><div><span className="canvas-eyebrow">MAPA CONCEPTUAL</span><h2>Explora las conexiones <span>↗</span></h2></div><div className="canvas-top-actions"><span className="canvas-hint"><span className="hint-dot" /> Selecciona cualquier nodo</span><button className="canvas-fit-button" onClick={() => void fitView({ padding: 0.16, duration: 350 })}><Maximize2 size={14} /> Ajustar</button></div></div>
              <div className="flow-canvas">
                <ReactFlow
                  nodes={nodes}
                  edges={edges}
                  nodeTypes={nodeTypes}
                  onNodesChange={onNodesChange}
                  onEdgesChange={onEdgesChange}
                  onNodeClick={onNodeClick}
                  fitView
                  fitViewOptions={{ padding: 0.12 }}
                  minZoom={0.18}
                  maxZoom={1.55}
                  nodesDraggable
                  nodesConnectable={false}
                  elementsSelectable
                  proOptions={{ hideAttribution: true }}
                  defaultEdgeOptions={{ type: 'default' }}
                >
                  <Background variant={BackgroundVariant.Dots} gap={23} size={1.1} color="#d8d9d2" />
                  <Controls showInteractive={false} position="bottom-left" />
                  <MiniMap position="bottom-right" pannable zoomable nodeColor={(node) => (node.data as StudyNodeData).color ?? '#a4b0c6'} maskColor="rgba(250,249,245,0.68)" />
                  <Panel position="top-right" className="flow-legend-panel">
                    <div className="legend-heading">LEYENDA</div>
                    {categories.map((category) => <span className="legend-row" key={category.name}><span style={{ backgroundColor: category.color }} />{category.name}</span>)}
                  </Panel>
                  <Panel position="bottom-center" className="canvas-helper-pill"><ArrowDownRight size={13} /> Arrastra para explorar · rueda para zoom</Panel>
                </ReactFlow>
              </div>
              <div className="canvas-bottom-meta"><span><span className="meta-bullet" />{nodes.length} nodos</span><span><span className="meta-bullet meta-bullet-line" />{edges.length} conexiones</span><span className="canvas-bottom-note">El mapa es editable: mueve los nodos para reorganizarlo.</span></div>
              </>}
            </div>
          )}

          {tab === 'Lectura' && <ReadingView title={title} nodes={nodes} sourceDocument={sourceDocument} onSelect={centerOnNode} onCreate={() => setCreatorOpen(true)} />}
          {tab === 'Repasar' && (
            <ReviewView
              nodes={concepts}
              reviewIndex={reviewIndex}
              reviewChoice={reviewChoice}
              reviewChecked={reviewChecked}
              reviewScore={reviewScore}
              onChoose={(id) => { if (!reviewChecked) { setReviewChoice(id); setReviewChecked(true); if (id === concepts[reviewIndex]?.id) setReviewScore((score) => score + 1); } }}
              onNext={() => { setReviewIndex((index) => (index + 1) % Math.max(concepts.length, 1)); setReviewChoice(null); setReviewChecked(false); }}
              onRetry={retryReview}
              onSelectNode={(node) => { setSelectedNodeId(node.id); setTab('Mapa'); }}
              aiExam={aiExam}
              aiExamIndex={aiExamIndex}
              aiExamChoice={aiExamChoice}
              aiExamChecked={aiExamChecked}
              aiExamScore={aiExamScore}
              aiExamLoading={aiExamLoading}
              onGenerateAIExam={handleGenerateAIExam}
              onAIExamChoose={(index) => { if (!aiExamChecked) setAiExamChoice(index); }}
              onAIExamCheck={() => { if (!aiExamChecked && aiExamChoice !== null && aiExam?.[aiExamIndex]) { setAiExamChecked(true); if (aiExamChoice === aiExam[aiExamIndex].correctIndex) setAiExamScore((score) => score + 1); } }}
              onAIExamNext={() => { if ((aiExamIndex + 1) >= (aiExam?.length ?? 0)) { setAiExam(null); setToast(`Examen finalizado: ${aiExamScore}/${aiExam?.length ?? 0} aciertos.`); } else { setAiExamIndex((index) => index + 1); setAiExamChoice(null); setAiExamChecked(false); } }}
              onExitAIExam={() => setAiExam(null)}
            />
          )}
          {tab === 'Fuentes' && <SourcesView nodes={nodes} />}
        </section>

        <DetailsPanel
          node={selectedNode?.data}
          isSpeaking={isSpeaking}
          isPaused={isPaused}
          speed={speed}
          onSpeedChange={setSpeed}
          onNarrate={narrate}
          onPauseToggle={togglePause}
          onToggleComplete={toggleComplete}
        />
      </main>

      <footer className="app-footer"><div><span className="footer-brand-mark"><BrainCircuit size={14} /></span> <strong>Aura Clara</strong><span>· Un espacio para aprender conectando ideas.</span></div><div className="footer-credit"><span>Hecho para estudiar mejor</span><span className="footer-heart">✳</span><span>Edición personal</span><span className="watermark-credit" aria-label="Diseñado por Cesar Gabriel">Cesar Gabriel :)</span></div></footer>
      </>
      )}

      {creatorOpen && <CreatorModal initialTitle="Nuevo tema de estudio" onClose={() => setCreatorOpen(false)} onGenerate={generateFromNotes} onReadFile={readFileForCreator} cloudEnabled={cloudEnabled} />}
      {showOnboarding && <WelcomeTutorial key={onboardingReplayKey} onClose={finishOnboarding} />}
      {toast && <div className="toast-message" role="status"><CheckCircle2 size={17} />{toast}<button onClick={() => setToast('')} aria-label="Cerrar aviso"><X size={14} /></button></div>}
    </div>
  );
}

type SpacesDashboardProps = {
  workspaces: StudyWorkspace[];
  theme: ThemeName;
  themeOptions: { id: ThemeName; name: string; description: string; colors: string[] }[];
  onThemeChange: (theme: ThemeName) => void;
  onCreate: () => void;
  onOpen: (workspace: StudyWorkspace) => void;
  onDelete: (workspaceId: string) => void;
  onReplayTutorial: () => void;
  cloudEnabled: boolean;
  userEmail: string;
  onSignOut: () => void;
};

function SpacesDashboard({ workspaces, theme, themeOptions: themes, onThemeChange, onCreate, onOpen, onDelete, onReplayTutorial, cloudEnabled, userEmail, onSignOut }: SpacesDashboardProps) {
  const [query, setQuery] = useState('');
  const [showThemes, setShowThemes] = useState(false);
  const filtered = useMemo(() => workspaces
    .filter((workspace) => `${workspace.title} ${workspace.sourceDocument}`.toLocaleLowerCase('es').includes(query.trim().toLocaleLowerCase('es')))
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()), [workspaces, query]);

  return (
    <div className="spaces-home">
      <header className="spaces-header">
        <button className="brand-lockup spaces-brand" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} aria-label="Aura Clara inicio">
          <span className="brand-mark"><BrainCircuit size={23} strokeWidth={1.8} /></span>
          <span className="brand-name">aura<span>clara</span><small>STUDY SPACE</small></span>
        </button>
        <div className="spaces-header-actions">
          <button className="quiet-button" onClick={() => setShowThemes((value) => !value)} aria-expanded={showThemes}><Palette size={15} /> Apariencia</button>
          <button className="quiet-button" onClick={onReplayTutorial}><CircleHelp size={15} /> Ver tutorial</button>
          {cloudEnabled && <span className="cloud-user-chip" title={userEmail}><UserRound size={14}/><span>{userEmail}</span></span>}
          {cloudEnabled && <button className="quiet-button" onClick={onSignOut} title="Cerrar sesión"><LogOut size={15}/> Salir</button>}
          <button className="primary-button" onClick={onCreate}><Plus size={16} /> Crear mapa</button>
        </div>
      </header>

      {showThemes && <section className="spaces-theme-panel" aria-label="Seleccionar tema visual"><div><strong>Tu ambiente de estudio</strong><span>Elige una paleta que te resulte cómoda.</span></div><div className="spaces-theme-options">{themes.map((option) => <button key={option.id} className={`spaces-theme-option ${theme === option.id ? 'active' : ''}`} onClick={() => { onThemeChange(option.id); setShowThemes(false); }} title={option.description}><span>{option.colors.map((color) => <i key={color} style={{ background: color }} />)}</span><small>{option.name}</small>{theme === option.id && <CheckCircle2 size={14} />}</button>)}</div></section>}

      <main className="spaces-main">
        <section className="spaces-hero">
          <div className="spaces-hero-copy">
            <span className="spaces-kicker"><Sparkles size={13} /> TU BIBLIOTECA DE APRENDIZAJE</span>
            <h1>Buenas ideas merecen <em>un espacio propio.</em></h1>
            <p>Reúne tus mapas mentales, apuntes y recorridos de estudio en un lugar tranquilo. Elige un espacio para continuar justo donde lo dejaste.</p>
            <div className="spaces-hero-meta"><span><span className="hero-meta-dot" /> {workspaces.length} {workspaces.length === 1 ? 'espacio creado' : 'espacios creados'}</span><span>{cloudEnabled ? <><Cloud size={14}/> Tus mapas se sincronizan en la nube</> : <><Layers3 size={14}/> Tu progreso se guarda en este navegador</>}</span></div>
          </div>
          <div className="spaces-hero-art" aria-hidden="true"><div className="hero-art-orbit orbit-a"/><div className="hero-art-orbit orbit-b"/><div className="hero-art-core"><BrainCircuit size={35}/></div><span className="hero-art-node node-a">✦</span><span className="hero-art-node node-b">●</span><span className="hero-art-node node-c">✧</span><span className="hero-art-label label-a">ideas</span><span className="hero-art-label label-b">conectar</span><span className="hero-art-label label-c">aprender</span></div>
        </section>

        <section className="spaces-library-section">
          <div className="spaces-section-heading"><div><span className="eyebrow">TU COLECCIÓN</span><h2>Mis Espacios <span>{workspaces.length}</span></h2><p>Abre un mapa para seguir explorando o crea uno nuevo.</p></div><div className="spaces-library-tools"><label className="spaces-search"><Search size={16}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar en mis espacios…" aria-label="Buscar mis espacios"/>{query && <button onClick={() => setQuery('')} aria-label="Limpiar búsqueda"><X size={14}/></button>}</label><button className="primary-button create-card-button" onClick={onCreate}><Plus size={16}/> Nuevo mapa</button></div></div>

          {filtered.length ? <div className="spaces-card-grid">
            {filtered.map((workspace, index) => {
              const concepts = workspace.nodes.filter((node) => node.data.kind === 'concept');
              const branches = workspace.nodes.filter((node) => node.data.kind === 'branch');
              const done = concepts.filter((node) => node.data.completed).length;
              const colors = branches.slice(0, 5).map((branch) => branch.data.color);
              const updatedDate = new Date(workspace.updatedAt);
              const updatedLabel = Number.isNaN(updatedDate.getTime()) ? 'Reciente' : new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short' }).format(updatedDate);
              return <article className={`space-card space-card-tone-${index % 4}`} key={workspace.id}>
                <button className="space-card-open" onClick={() => onOpen(workspace)} aria-label={`Abrir ${workspace.title}`}>
                  <div className="space-card-art"><div className="space-card-art-grid"/><div className="space-card-map-preview"><span className="preview-root"/><i className="preview-line line-one"/><i className="preview-line line-two"/><i className="preview-line line-three"/><span className="preview-dot dot-one"/><span className="preview-dot dot-two"/><span className="preview-dot dot-three"/><span className="preview-dot dot-four"/><span className="preview-dot dot-five"/></div><span className="space-card-type"><Network size={12}/> MAPA MENTAL</span><span className="space-card-open-icon"><ArrowUpRight size={17}/></span></div>
                  <div className="space-card-body"><div className="space-card-topline"><span className="space-card-tag"><span style={{ background: colors[0] ?? 'var(--theme-accent)' }}/>{branches.length ? `${branches.length} ${branches.length === 1 ? 'rama' : 'ramas'}` : 'En preparación'}</span><span className="space-card-updated"><Clock size={12}/>{updatedLabel}</span></div><h3>{workspace.title}</h3><p>{workspace.sourceDocument.trim() ? `${workspace.sourceDocument.trim().split(/\s+/).length.toLocaleString('es')} palabras de apuntes importados` : 'Un espacio de ideas para organizar y profundizar.'}</p><div className="space-card-progress"><div className="space-card-progress-label"><span>Progreso de conceptos</span><strong>{concepts.length ? Math.round(done / concepts.length * 100) : 0}%</strong></div><div className="space-card-progress-track"><span style={{ width: `${concepts.length ? done / concepts.length * 100 : 0}%` }}/></div></div><div className="space-card-footer"><span><Layers3 size={13}/>{workspace.nodes.length} nodos</span><span><CheckCircle2 size={13}/>{done}/{concepts.length} completados</span></div><div className="space-card-color-strip">{(colors.length ? colors : ['#a5b4c8', '#c3b4d6', '#aed3c0']).map((color, colorIndex) => <i key={`${color}-${colorIndex}`} style={{ background: color }}/>)}</div></div>
                </button>
                <button className="space-card-delete" onClick={() => onDelete(workspace.id)} title={`Eliminar ${workspace.title}`} aria-label={`Eliminar ${workspace.title}`}><X size={14}/></button>
              </article>;
            })}
          </div> : <div className="spaces-empty-library"><div className="spaces-empty-art"><span/><span/><span/><BrainCircuit size={30}/></div><h3>{query ? 'No encontramos ese espacio' : 'Tu biblioteca empieza aquí'}</h3><p>{query ? 'Prueba con otro título o una palabra presente en tus apuntes.' : 'Todavía no has creado mapas mentales. Sube tus apuntes, pega un resumen o empieza con una pregunta que te intrigue.'}</p>{query ? <button className="secondary-button" onClick={() => setQuery('')}>Limpiar búsqueda</button> : <button className="primary-button" onClick={onCreate}><Sparkles size={15}/> Crear mi primer mapa</button>}</div>}
        </section>

        <section className="spaces-tip"><span className="spaces-tip-icon"><Lightbulb size={17}/></span><div><strong>Una idea a la vez</strong><p>Puedes dedicar un espacio a cada asignatura y volver a ellos cuando quieras. Cada mapa conserva sus apuntes y progreso por separado.</p></div><button onClick={onReplayTutorial}>Cómo funciona <ArrowUpRight size={14}/></button></section>
      </main>
      <footer className="spaces-footer"><div><BrainCircuit size={14}/><strong>Aura Clara</strong><span>· Un espacio para aprender conectando ideas.</span></div><span>Creado con cariño <b>✳</b><i>Cesar Gabriel :)</i></span></footer>
    </div>
  );
}

type WelcomeTutorialProps = { onClose: () => void };
function WelcomeTutorial({ onClose }: WelcomeTutorialProps) {
  const [step, setStep] = useState(0);
  const steps = [
    { icon: GraduationCap, eyebrow: 'BIENVENIDO A AURA CLARA', title: 'Tu espacio para aprender a tu manera', body: 'Organiza cada asignatura en su propio espacio. Aquí encontrarás tus mapas mentales y podrás retomar el estudio cuando quieras.', preview: 'spaces' },
    { icon: FileText, eyebrow: 'PASO 1 DE 3', title: 'Carga tus apuntes y crea un mapa', body: 'Sube un PDF con texto seleccionable, importa texto o pega tus notas. Aura Clara organiza el contenido en un nodo central, ramas y conceptos.', preview: 'create' },
    { icon: Network, eyebrow: 'PASO 2 DE 3', title: 'Explora las conexiones', body: 'Selecciona y mueve nodos, consulta las explicaciones y utiliza el recorrido narrado para estudiar sin prisa.', preview: 'map' },
    { icon: BookOpen, eyebrow: 'PASO 3 DE 3', title: 'Lee, repasa y vuelve cuando quieras', body: 'Lee el documento original, practica con preguntas y conserva tus mapas en Mis Espacios. Tu progreso se guarda en tu cuenta cuando utilizas la nube o en este navegador en modo local.', preview: 'study' },
  ];
  const active = steps[step];
  const StepIcon = active.icon;
  return (
    <div className="onboarding-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="onboarding-dialog" role="dialog" aria-modal="true" aria-labelledby="onboarding-title">
        <button className="onboarding-close" onClick={onClose} aria-label="Cerrar tutorial"><X size={17}/></button>
        <div className="onboarding-visual"><div className="onboarding-visual-orbit onboarding-orbit-one"/><div className="onboarding-visual-orbit onboarding-orbit-two"/><div className={`onboarding-preview onboarding-preview-${active.preview}`}><span className="onboard-preview-line p-line-a"/><span className="onboard-preview-line p-line-b"/><span className="onboard-preview-line p-line-c"/><span className="onboard-preview-node p-node-a"/><span className="onboard-preview-node p-node-b"/><span className="onboard-preview-node p-node-c"/><span className="onboard-preview-node p-node-d"/><span className="onboard-preview-node p-node-root"><BrainCircuit size={22}/></span><span className="onboard-preview-pill">aura clara</span></div><div className="onboarding-icon-float"><StepIcon size={18}/></div><span className="onboarding-star star-one">✦</span><span className="onboarding-star star-two">✧</span></div>
        <div className="onboarding-copy"><span className="onboarding-eyebrow"><Sparkles size={13}/>{active.eyebrow}</span><h2 id="onboarding-title">{active.title}</h2><p>{active.body}</p></div>
        <div className="onboarding-step-footer"><div className="onboarding-dots" aria-label={`Paso ${step + 1} de ${steps.length}`}>{steps.map((item, index) => <button key={item.preview} className={index === step ? 'active' : ''} aria-label={`Ir al paso ${index + 1}`} onClick={() => setStep(index)}/>)}</div><span className="onboarding-counter">0{step + 1} <i>/ 0{steps.length}</i></span></div>
        <div className="onboarding-actions"><button className="onboarding-skip" onClick={onClose}>Saltar tutorial</button><div>{step > 0 && <button className="secondary-button onboarding-back" onClick={() => setStep((current) => current - 1)}><ChevronLeft size={15}/> Atrás</button>}<button className="primary-button" onClick={() => step === steps.length - 1 ? onClose() : setStep((current) => current + 1)}>{step === steps.length - 1 ? 'Empezar a explorar' : 'Siguiente'} {step === steps.length - 1 ? <Sparkles size={15}/> : <ChevronRight size={15}/>}</button></div></div>
      </section>
    </div>
  );
}

function ReadingView({ title, nodes, sourceDocument, onSelect, onCreate }: { title: string; nodes: StudyNode[]; sourceDocument: string; onSelect: (node: StudyNode) => void; onCreate: () => void }) {
  const [readingMode, setReadingMode] = useState<'guide' | 'source'>('guide');
  const root = nodes.find((node) => node.data.kind === 'root');
  const branches = nodes.filter((node) => node.data.kind === 'branch');
  const wordCount = sourceDocument.trim() ? sourceDocument.trim().split(/\s+/).length : 0;

  if (!nodes.length) return (
    <div className="reading-view content-view reading-empty-state">
      <div className="reading-empty-icon"><BookOpen size={25} /></div>
      <span className="eyebrow">MODO DE LECTURA</span>
      <h2>Tus documentos, en un solo lugar</h2>
      <p>Cuando cargues apuntes o un PDF, podrás leer el texto original aquí y recorrer también la versión organizada por conceptos.</p>
      <button className="primary-button" onClick={onCreate}><Plus size={16} /> Subir apuntes o crear tema</button>
    </div>
  );

  return (
    <div className="reading-view content-view">
      <div className="content-view-heading"><span className="content-view-icon"><BookOpen size={20} /></span><div><span className="eyebrow">MODO DE LECTURA</span><h2>{title || 'Lectura de estudio'}</h2><p>Lee tus apuntes originales o estudia el contenido ordenado por conceptos.</p></div></div>
      {sourceDocument.trim() && <div className="reading-mode-switch" role="tablist" aria-label="Modo de lectura"><button role="tab" aria-selected={readingMode === 'guide'} className={readingMode === 'guide' ? 'reading-mode-active' : ''} onClick={() => setReadingMode('guide')}><Layers3 size={15} /> Lectura guiada</button><button role="tab" aria-selected={readingMode === 'source'} className={readingMode === 'source' ? 'reading-mode-active' : ''} onClick={() => setReadingMode('source')}><FileTextIcon /> Apuntes originales <span>{wordCount.toLocaleString('es')} palabras</span></button></div>}
      {readingMode === 'source' && sourceDocument.trim() ? <article className="source-document-card"><div className="source-document-header"><div><span className="eyebrow">DOCUMENTO ORIGINAL</span><h3>{title || 'Apuntes importados'}</h3></div><span className="source-document-wordcount">{wordCount.toLocaleString('es')} palabras</span></div><div className="source-document-body">{sourceDocument}</div><p className="source-document-note"><Info size={14} /> Este texto corresponde al material que cargaste o pegaste. Comprueba la fidelidad de la extracción si proviene de un PDF.</p></article> : <>
        {root && <article className="reading-intro-card"><span className="reading-card-label">INTRODUCCIÓN</span><h3>{root.data.title}</h3><p>{root.data.description}</p><div className="reading-goals">{root.data.summary.map((item, i) => <div key={item}><span>{String(i + 1).padStart(2, '0')}</span>{item}</div>)}</div></article>}
        <div className="reading-branch-list">
          {branches.map((branch, i) => {
            const children = nodes.filter((node) => node.data.parentId === branch.id);
            return <section className="reading-branch-card" key={branch.id}>
              <div className="reading-branch-header"><span className="reading-branch-emoji" style={{ background: `${branch.data.color}18` }}>{branch.data.emoji}</span><div><span className="eyebrow">RAMA {String(i + 1).padStart(2, '0')}</span><h3>{branch.data.title}</h3></div><button className="text-button" onClick={() => onSelect(branch)}>Abrir rama <ArrowRight size={14} /></button></div>
              <p>{branch.data.description}</p>
              <div className="reading-concepts-list">{children.map((child) => <button key={child.id} className="reading-concept-row" onClick={() => onSelect(child)}><span className="reading-concept-dot" style={{ background: child.data.color }} /><span><strong>{child.data.title}</strong><small>{child.data.description}</small></span><ArrowRight size={15} /></button>)}</div>
            </section>;
          })}
        </div>
      </>}
    </div>
  );
}

function FileTextIcon() {
  return <BookMarked size={15} />;
}

function ReviewView({
  nodes, reviewIndex, reviewChoice, reviewChecked, reviewScore, onChoose, onNext, onRetry, onSelectNode,
  aiExam, aiExamIndex, aiExamChoice, aiExamChecked, aiExamScore, aiExamLoading, onGenerateAIExam, onAIExamChoose, onAIExamCheck, onAIExamNext, onExitAIExam,
}: {
  nodes: StudyNode[]; reviewIndex: number; reviewChoice: string | null; reviewChecked: boolean; reviewScore: number;
  onChoose: (id: string) => void; onNext: () => void; onRetry: () => void; onSelectNode: (node: StudyNode) => void;
  aiExam: AIExamQuestion[] | null; aiExamIndex: number; aiExamChoice: number | null; aiExamChecked: boolean; aiExamScore: number; aiExamLoading: boolean;
  onGenerateAIExam: () => void; onAIExamChoose: (index: number) => void; onAIExamCheck: () => void; onAIExamNext: () => void; onExitAIExam: () => void;
}) {
  const current = nodes[reviewIndex];
  const aiQuestion = aiExam?.[aiExamIndex];
  if (aiExam?.length && aiQuestion) return (
    <div className="review-view content-view">
      <div className="content-view-heading"><span className="content-view-icon review-icon"><Sparkles size={20}/></span><div><span className="eyebrow">EXAMEN GENERADO CON IA</span><h2>Comprueba lo aprendido</h2><p>Preguntas creadas a partir de los apuntes de este espacio.</p></div><div className="review-score"><span>ACIERTOS</span><strong>{aiExamScore}</strong></div></div>
      <div className="review-progress-line"><span style={{ width: `${((aiExamIndex + 1) / aiExam.length) * 100}%` }}/></div>
      <div className="review-card">
        <div className="review-card-meta"><span className="review-question-number">PREGUNTA {String(aiExamIndex + 1).padStart(2, '0')}</span><span>{aiExam.length} preguntas</span></div>
        <h3>{aiQuestion.question}</h3>
        <div className="review-options">{aiQuestion.options.map((option, index) => { const selected = aiExamChoice === index; const correct = aiQuestion.correctIndex === index; const stateClass = aiExamChecked ? (correct ? 'option-correct' : selected ? 'option-incorrect' : '') : selected ? 'option-selected' : ''; return <button key={`${aiExamIndex}-${index}`} className={`review-option ${stateClass}`} onClick={() => onAIExamChoose(index)} disabled={aiExamChecked}><span className="option-letter">{String.fromCharCode(65 + index)}</span><span>{option}</span>{aiExamChecked && correct && <CheckCircle2 size={17}/>}</button>; })}</div>
        {aiExamChecked && <div className={`review-feedback ${aiExamChoice === aiQuestion.correctIndex ? 'review-feedback-correct' : 'review-feedback-wrong'}`}><strong>{aiExamChoice === aiQuestion.correctIndex ? '¡Respuesta correcta!' : 'Repasa este punto'}</strong><p>{aiQuestion.explanation}</p><p><b>Fragmento de apoyo:</b> “{aiQuestion.sourceExcerpt}”</p></div>}
        <div className="review-footer"><button className="quiet-button" onClick={onExitAIExam}><RotateCcw size={15}/> Salir del examen</button>{!aiExamChecked ? <button className="primary-button" onClick={onAIExamCheck} disabled={aiExamChoice === null}>Comprobar respuesta <ArrowRight size={15}/></button> : <button className="primary-button" onClick={onAIExamNext}>{aiExamIndex === aiExam.length - 1 ? 'Finalizar examen' : 'Siguiente pregunta'} <ArrowRight size={15}/></button>}</div>
      </div>
      <p className="review-note"><Info size={14}/> El examen se generó con IA. Comprueba siempre la evidencia citada y contrasta los contenidos importantes con tus fuentes académicas.</p>
    </div>
  );
  const options = useMemo(() => {
    if (!current || nodes.length <= 1) return current ? [current] : [];
    const remaining = nodes.filter((node) => node.id !== current.id);
    const distractors: StudyNode[] = [];
    for (let i = 0; i < Math.min(3, remaining.length); i += 1) distractors.push(remaining[(reviewIndex + i * 2) % remaining.length]);
    return [current, ...distractors].sort((a, b) => a.data.title.localeCompare(b.data.title, 'es'));
  }, [current, nodes, reviewIndex]);

  if (!current) return <div className="empty-content-view"><CircleHelp size={28} /><h2>Aún no hay conceptos para repasar</h2><p>Genera un mapa desde tus apuntes para crear preguntas de práctica.</p></div>;

  return (
    <div className="review-view content-view">
      <div className="content-view-heading"><span className="content-view-icon review-icon"><CircleHelp size={20} /></span><div><span className="eyebrow">RECUERDO ACTIVO</span><h2>Repasa lo que sabes</h2><p>Identifica el concepto a partir de su explicación, no solo de su nombre.</p></div><div className="review-score"><span>ACIERTOS</span><strong>{reviewScore}</strong></div><button className="primary-button ai-exam-button" onClick={onGenerateAIExam} disabled={aiExamLoading}><Sparkles size={15}/>{aiExamLoading ? 'Generando examen…' : 'Generar examen con IA'}</button></div>
      <div className="review-progress-line"><span style={{ width: `${((reviewIndex + 1) / Math.max(nodes.length, 1)) * 100}%` }} /></div>
      <div className="review-card">
        <div className="review-card-meta"><span className="review-question-number">PREGUNTA {String(reviewIndex + 1).padStart(2, '0')}</span><span>{nodes.length} conceptos</span></div>
        <h3>¿Qué concepto describe mejor esta idea?</h3>
        <p className="review-question-description">{current.data.description}</p>
        <div className="review-options">
          {options.map((option, index) => {
            const isCorrect = option.id === current.id;
            const isChosen = reviewChoice === option.id;
            const stateClass = reviewChecked ? (isCorrect ? 'option-correct' : isChosen ? 'option-incorrect' : '') : isChosen ? 'option-selected' : '';
            return <button key={option.id} className={`review-option ${stateClass}`} onClick={() => onChoose(option.id)} disabled={reviewChecked}><span className="option-letter">{String.fromCharCode(65 + index)}</span><span>{option.data.title}</span>{reviewChecked && isCorrect && <CheckCircle2 size={17} />}{reviewChecked && isChosen && !isCorrect && <X size={17} />}</button>;
          })}
        </div>
        {reviewChecked && <div className={`review-feedback ${reviewChoice === current.id ? 'review-feedback-correct' : 'review-feedback-wrong'}`}><strong>{reviewChoice === current.id ? '¡Bien hecho!' : 'Repasa este concepto'}</strong><p>{current.data.summary[0] ?? current.data.description}</p><button className="text-button" onClick={() => onSelectNode(current)}>Ver explicación completa <ArrowRight size={14} /></button></div>}
        <div className="review-footer"><button className="quiet-button" onClick={onRetry}><RotateCcw size={15} /> Reiniciar sesión</button><button className="primary-button" onClick={onNext} disabled={!reviewChecked}>{reviewIndex === nodes.length - 1 ? 'Volver al inicio' : 'Siguiente pregunta'} <ArrowRight size={15} /></button></div>
      </div>
      <p className="review-note"><Info size={14} /> Las preguntas se generan desde los nodos del mapa. Revisa el material fuente para validar conceptos y matices.</p>
    </div>
  );
}

function SourcesView({ nodes }: { nodes: StudyNode[] }) {
  const sourceEntries = useMemo(() => {
    const values = new Map<string, Set<string>>();
    for (const node of nodes) {
      for (const source of node.data.sources ?? []) {
        if (!values.has(source)) values.set(source, new Set());
        values.get(source)?.add(node.data.title);
      }
    }
    return [...values.entries()].map(([source, concepts]) => ({ source, concepts: [...concepts] }));
  }, [nodes]);

  return (
    <div className="sources-view content-view">
      <div className="content-view-heading"><span className="content-view-icon sources-icon"><BookMarked size={20} /></span><div><span className="eyebrow">BIBLIOTECA DEL MAPA</span><h2>Fuentes y referencias</h2><p>Reúne las referencias asociadas a los conceptos de este espacio.</p></div></div>
      <div className="sources-summary-strip"><div><strong>{sourceEntries.length}</strong><span>fuentes únicas</span></div><div><strong>{nodes.length}</strong><span>nodos vinculados</span></div><div><strong>APA 7</strong><span>formato sugerido</span></div></div>
      {sourceEntries.length ? <div className="source-library-list">{sourceEntries.map(({ source, concepts: related }, index) => <article className="source-library-card" key={source}><div className="source-library-index">{String(index + 1).padStart(2, '0')}</div><div className="source-library-content"><h3>{source}</h3><p>Relacionada con: {related.slice(0, 4).join(', ')}{related.length > 4 ? ` y ${related.length - 4} concepto(s) más` : ''}.</p><a href={externalSourceUrl(source)} target="_blank" rel="noreferrer">Consultar fuente <ExternalLink size={13} /></a></div></article>)}</div> : <div className="empty-content-view"><BookMarked size={28} /><h2>Aún no hay fuentes asociadas</h2><p>Abre «Crear mapa» para incluir un enlace o agrega referencias a los nodos.</p></div>}
      <div className="sources-disclaimer"><Info size={16} /><p><strong>Verificación académica:</strong> los enlaces de búsqueda se generan como ayuda para localizar la referencia; comprueba los datos bibliográficos y la pertinencia de cada fuente antes de citarlos en un trabajo.</p></div>
    </div>
  );
}

export default function App() {
  return <AuthGate><ReactFlowProvider><Dashboard /></ReactFlowProvider></AuthGate>;
}
