import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Check, CircleHelp, Network } from 'lucide-react';
import type { CSSProperties } from 'react';
import type { StudyNode } from '../types';

function StudyNodeCard({ data, selected }: NodeProps<StudyNode>) {
  const colorStyle = { '--node-color': data.color } as CSSProperties;
  const isRoot = data.kind === 'root';
  const isBranch = data.kind === 'branch';

  return (
    <div className={`study-node ${isRoot ? 'study-node-root' : ''} ${isBranch ? 'study-node-branch' : ''} ${selected ? 'is-selected' : ''}`} style={colorStyle}>
      {isRoot ? (
        <>
          <Handle type="source" position={Position.Left} id="left" className="flow-handle" />
          <Handle type="source" position={Position.Right} id="right" className="flow-handle" />
        </>
      ) : (
        <>
          <Handle type="target" position={data.side === 'left' ? Position.Right : Position.Left} id="target" className="flow-handle" />
          {isBranch && <Handle type="source" position={data.side === 'left' ? Position.Left : Position.Right} id="source" className="flow-handle" />}
        </>
      )}
      <div className="node-topline">
        <span className="node-emoji">{data.emoji}</span>
        <span className="node-kind">{isRoot ? 'TEMA CENTRAL' : isBranch ? 'RAMA PRINCIPAL' : data.category.toUpperCase()}</span>
      </div>
      <div className="node-title">{data.title}</div>
      {isRoot && <div className="node-subtitle">Mapa de aprendizaje interactivo</div>}
      {!isRoot && <div className="node-footer">
        <span className="node-meta"><Network size={12} /> {isBranch ? 'Explorar rama' : 'Ver concepto'}</span>
        <span className="node-status" title={data.completed ? 'Concepto completado' : data.question ? 'Incluido en el repaso' : 'Concepto'}>
          {data.completed ? <Check size={13} /> : data.question ? <CircleHelp size={13} /> : null}
        </span>
      </div>}
    </div>
  );
}

export default memo(StudyNodeCard);
