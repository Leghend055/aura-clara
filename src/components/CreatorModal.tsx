import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { FileText, Link2, Sparkles, Upload, X, WandSparkles } from 'lucide-react';

type CreatorModalProps = {
  initialTitle: string;
  onClose: () => void;
  onGenerate: (title: string, content: string, sourceUrl: string) => void | Promise<void>;
  onReadFile: (file: File) => Promise<string | null>;
  cloudEnabled?: boolean;
};

export default function CreatorModal({ initialTitle, onClose, onGenerate, onReadFile, cloudEnabled = false }: CreatorModalProps) {
  const [title, setTitle] = useState(initialTitle || 'Nuevo tema de estudio');
  const [content, setContent] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [fileName, setFileName] = useState('');
  const [fileError, setFileError] = useState('');
  const [generationError, setGenerationError] = useState('');
  const [aiConsent, setAiConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const handleFile = async (file?: File) => {
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) { setFileError('El archivo supera el máximo beta de 15 MB. Divide el documento e inténtalo de nuevo.'); return; }
    setFileError('');
    setFileName(file.name);
    setBusy(true);
    try {
      const extracted = await onReadFile(file);
      if (extracted !== null) setContent((previous) => previous ? `${previous}\n\n${extracted}` : extracted);
    } catch (error) {
      setFileError(error instanceof Error ? error.message : 'No se pudo leer el archivo.');
    } finally {
      setBusy(false);
    }
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setGenerationError('');
    setBusy(true);
    try {
      await onGenerate(title.trim() || 'Nuevo tema de estudio', content.trim(), sourceUrl.trim());
      onClose();
    } catch (error) {
      setGenerationError(error instanceof Error ? error.message : 'No se pudo generar el mapa.');
    } finally { setBusy(false); }
  };

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="creator-modal" role="dialog" aria-modal="true" aria-labelledby="creator-title">
        <header className="modal-header">
          <div className="modal-heading-icon"><WandSparkles size={22} /></div>
          <div className="modal-heading-copy">
            <span className="eyebrow">ESPACIO DE CREACIÓN</span>
            <h2 id="creator-title">Subir o generar contenido</h2>
            <p>Convierte apuntes en una primera estructura de estudio editable.</p>
          </div>
          <button className="icon-button modal-close" onClick={onClose} aria-label="Cerrar ventana"><X size={19} /></button>
        </header>

        <form onSubmit={submit}>
          <div className="creator-form-body">
            <label className="field-label" htmlFor="map-title">Título del tema</label>
            <input id="map-title" className="text-input" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ej. Fisiopatología respiratoria" />

            <div className="field-label-row">
              <label className="field-label" htmlFor="study-notes">Resumen o apuntes</label>
              <span className="subtle-label">Texto, Markdown o contenido pegado</span>
            </div>
            <textarea id="study-notes" className="text-area creator-textarea" value={content} onChange={(event) => setContent(event.target.value)} placeholder={'Pega aquí tus apuntes.\n\nPuedes organizar el contenido con encabezados para obtener ramas más claras.'} rows={8} />

            <div className="upload-row">
              <button type="button" className="secondary-button" onClick={() => fileInput.current?.click()} disabled={busy}><Upload size={16} /> {busy ? 'Leyendo archivo…' : 'Seleccionar archivo'}</button>
              <div className="upload-caption">
                <FileText size={15} />
                <span>{fileName || 'PDF, TXT, MD o JSON · hasta donde permita tu navegador'}</span>
              </div>
              <input ref={fileInput} type="file" accept=".txt,.md,.markdown,.pdf,.json,.csv" hidden onChange={(event) => { void handleFile(event.target.files?.[0]); event.currentTarget.value = ''; }} />
            </div>
            {fileError && <p className="inline-error">{fileError}</p>}
            {generationError && <p className="inline-error">{generationError}</p>}

            <label className="field-label" htmlFor="source-url"><Link2 size={15} className="label-icon" /> Enlace de referencia (opcional)</label>
            <input id="source-url" className="text-input" type="url" value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} placeholder="https://…" />
            <p className="helper-note">El enlace se conserva como referencia; esta beta no descarga automáticamente el contenido de páginas externas.</p>
            {cloudEnabled && content.trim().length > 0 && <label className="ai-consent-row"><input type="checkbox" checked={aiConsent} onChange={(event) => setAiConsent(event.target.checked)} required/><span>Entiendo que mis apuntes se enviarán a un proveedor externo de IA para generar el mapa. No subiré información confidencial ni datos personales de terceros.</span></label>}
          </div>
          <footer className="modal-footer">
            <span className="privacy-note">{busy ? 'Analizando apuntes y preparando tu mapa…' : cloudEnabled ? 'Tus mapas se guardan en tu cuenta.' : 'Los mapas se guardan en este navegador.'}</span>
            <button className="primary-button" type="submit" disabled={busy || (cloudEnabled && content.trim().length > 0 && !aiConsent)}><Sparkles size={16} /> {busy ? 'Generando…' : 'Generar mapa'}</button>
          </footer>
        </form>
      </section>
    </div>
  );
}
