import { useEffect, useState } from 'react';
import { AudioLines, CheckCircle2, Circle, ExternalLink, Headphones, Pause, Play, RotateCcw, Volume2, X } from 'lucide-react';
import type { StudyNodeData } from '../types';

type DetailsPanelProps = {
  node?: StudyNodeData;
  isSpeaking: boolean;
  isPaused: boolean;
  speed: number;
  onSpeedChange: (speed: number) => void;
  onNarrate: (fromCurrent: boolean) => void;
  onPauseToggle: () => void;
  onToggleComplete: () => void;
  onClose: () => void;
};

function sourceHref(source: string): string {
  const urlMatch = source.match(/https?:\/\/\S+/i);
  if (urlMatch) return urlMatch[0].replace(/[),.;]+$/, '');
  return `https://scholar.google.com/scholar?q=${encodeURIComponent(source)}`;
}

export default function DetailsPanel({ node, isSpeaking, isPaused, speed, onSpeedChange, onNarrate, onPauseToggle, onToggleComplete, onClose }: DetailsPanelProps) {
  const [expandedSources, setExpandedSources] = useState(false);
  useEffect(() => setExpandedSources(false), [node?.title]);

  if (!node) {
    return <aside className="details-panel empty-details">
      <div className="mobile-detail-sheet-header"><span>DETALLE DEL CONCEPTO</span><button className="icon-button" type="button" onClick={onClose} aria-label="Cerrar detalles"><X size={17} /></button></div>
      <div className="empty-state-icon"><AudioLines size={24} /></div><h3>Selecciona un concepto</h3><p>Sus explicaciones, resumen y fuentes aparecerán en este panel.</p>
    </aside>;
  }

  const allSources = node.sources ?? [];
  const shownSources = expandedSources ? allSources : allSources.slice(0, 2);

  return (
    <aside className="details-panel">
      <div className="mobile-detail-sheet-header"><span>DETALLE DEL CONCEPTO</span><button className="icon-button" type="button" onClick={onClose} aria-label="Cerrar detalles"><X size={17} /></button></div>
      <div className="details-panel-scroll">
        <div className="details-label-row"><span className="eyebrow">DETALLE DEL CONCEPTO</span><span className="category-pill" style={{ color: node.color, backgroundColor: `${node.color}17` }}><span className="category-dot" style={{ backgroundColor: node.color }} />{node.category}</span></div>
        <div className="detail-title-row">
          <div className="detail-emoji" style={{ backgroundColor: `${node.color}18` }}>{node.emoji}</div>
          <h2>{node.title}</h2>
        </div>
        <p className="detail-description">{node.description}</p>

        <div className="audio-card">
          <div className="audio-card-top">
            <div className="audio-icon"><Headphones size={18} /></div>
            <div className="audio-title-wrap"><strong>Explicación en audio</strong><span>Voz sintetizada del navegador</span></div>
            <span className={`audio-live ${isSpeaking ? 'audio-live-on' : ''}`}><span />{isSpeaking ? (isPaused ? 'Pausado' : 'En curso') : 'Listo'}</span>
          </div>
          <div className="audio-controls">
            <button className="audio-play-button" onClick={() => isSpeaking ? onPauseToggle() : onNarrate(false)} aria-label={isSpeaking ? (isPaused ? 'Reanudar audio' : 'Pausar audio') : 'Reproducir explicación'}>
              {isSpeaking && !isPaused ? <Pause size={17} fill="currentColor" /> : <Play size={17} fill="currentColor" />}
            </button>
            <div className="audio-track"><div className={`audio-wave ${isSpeaking && !isPaused ? 'audio-wave-active' : ''}`}><span /><span /><span /><span /><span /><span /><span /><span /><span /><span /><span /><span /><span /><span /><span /><span /><span /><span /><span /></div><span className="audio-track-caption">{isSpeaking ? 'Narración activa' : 'Listo para escuchar'}</span></div>
            <label className="speed-select-label" htmlFor="narration-speed">Vel.</label>
            <select id="narration-speed" className="speed-select" value={speed} onChange={(event) => onSpeedChange(Number(event.target.value))}>
              <option value={0.75}>0.75×</option><option value={1}>1×</option><option value={1.25}>1.25×</option><option value={1.5}>1.5×</option>
            </select>
          </div>
          <button className="narrate-from-button" onClick={() => onNarrate(true)}><Volume2 size={15} /> Narrar desde aquí <span>·</span> concepto actual y siguientes</button>
        </div>

        <section className="detail-section">
          <div className="section-heading"><div className="section-heading-icon" style={{ color: node.color, backgroundColor: `${node.color}15` }}><CheckCircle2 size={17} /></div><div><h3>Resumen estructurado</h3><p>Ideas clave para recordar</p></div></div>
          <div className="summary-list">
            {(node.summary.length ? node.summary : [node.description]).map((point, index) => (
              <div className="summary-item" key={`${point}-${index}`}><span className="summary-number" style={{ color: node.color, backgroundColor: `${node.color}15` }}>{String(index + 1).padStart(2, '0')}</span><p>{point}</p></div>
            ))}
          </div>
        </section>

        <section className="detail-section sources-section">
          <div className="section-heading"><div className="section-heading-icon sources-heading-icon"><ExternalLink size={17} /></div><div><h3>Fuentes y referencias</h3><p>Revisa la bibliografía para profundizar</p></div></div>
          <div className="source-list">
            {shownSources.length ? shownSources.map((source, index) => (
              <a className="source-item" href={sourceHref(source)} target="_blank" rel="noreferrer" key={`${source}-${index}`}><span className="source-index">{String(index + 1).padStart(2, '0')}</span><span className="source-text">{source}</span><ExternalLink size={13} /></a>
            )) : <p className="empty-source-copy">Todavía no se han añadido referencias a este nodo.</p>}
          </div>
          {allSources.length > 2 && <button className="text-button source-more-button" onClick={() => setExpandedSources((value) => !value)}>{expandedSources ? 'Mostrar menos' : `Ver ${allSources.length - 2} fuentes más`}</button>}
        </section>
      </div>
      <div className="details-panel-footer">
        <button className={`complete-button ${node.completed ? 'is-complete' : ''}`} onClick={onToggleComplete}>
          {node.completed ? <CheckCircle2 size={17} /> : <Circle size={17} />}
          {node.completed ? 'Concepto completado' : 'Marcar como aprendido'}
        </button>
        <button className="reset-audio-button" onClick={() => onNarrate(false)} aria-label="Volver a escuchar"><RotateCcw size={16} /></button>
      </div>
    </aside>
  );
}
