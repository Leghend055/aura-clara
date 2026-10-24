import type { CategoryMeta, StudyEdge, StudyNode, StudyNodeData } from '../types';

export const categories: CategoryMeta[] = [
  { name: 'Generalidades', color: '#6f89bd', tint: '#edf1fb', emoji: '🧭' },
  { name: 'Morfología', color: '#4d9c83', tint: '#e7f5ef', emoji: '🔬' },
  { name: 'Clasificación', color: '#c88b47', tint: '#fbf0df', emoji: '🗂️' },
  { name: 'Ciclo biológico', color: '#8d79bf', tint: '#f0ebfb', emoji: '🔄' },
  { name: 'Importancia médica', color: '#d36f7b', tint: '#fbe9ec', emoji: '🩺' },
  { name: 'Prevención y control', color: '#3f96a5', tint: '#e5f5f7', emoji: '🛡️' },
];

const references = [
  'Becerril, M. A. (2014). Parasitología médica (4.ª ed.). McGraw-Hill Education.',
  'Botero, D., & Restrepo, M. (2012). Parasitosis humanas (5.ª ed.). Corporación para Investigaciones Biológicas.',
  'Centers for Disease Control and Prevention. DPDx: Laboratory identification of parasites of public health concern.',
];

type SeedConcept = { title: string; description: string; summary: string[] };
type SeedBranch = { category: CategoryMeta; id: string; description: string; concepts: SeedConcept[] };

const seedBranches: SeedBranch[] = [
  {
    category: categories[0], id: 'branch-generalidades',
    description: 'Los artrópodos son invertebrados con exoesqueleto, cuerpo segmentado y apéndices articulados. Algunos tienen importancia parasitológica directa y otros actúan como vectores.',
    concepts: [
      { title: 'Características generales', description: 'El filo Arthropoda reúne animales con simetría bilateral, apéndices articulados y un exoesqueleto rico en quitina. Para crecer, muchos deben mudar la cutícula.', summary: ['Exoesqueleto que brinda protección y soporte.', 'Apéndices articulados y cuerpo segmentado.', 'Crecimiento mediante ecdisis o muda.'] },
      { title: 'Relación con el humano', description: 'La asociación con las personas puede ser temporal o persistente. Algunos artrópodos parasitan la piel; otros contactan al humano al alimentarse y pueden transmitir agentes infecciosos.', summary: ['Ectoparasitismo y alimentación sobre el huésped.', 'Picaduras, lesiones y reacciones de hipersensibilidad.', 'Transmisión de agentes biológicos en algunas especies.'] },
    ],
  },
  {
    category: categories[1], id: 'branch-morfologia',
    description: 'La morfología externa permite reconocer grandes grupos: insectos, arácnidos y otros artrópodos difieren en número de patas, tagmas y estructuras bucales.',
    concepts: [
      { title: 'Insectos', description: 'En el adulto típico, el cuerpo se organiza en cabeza, tórax y abdomen. Presentan tres pares de patas y un par de antenas; algunos tienen alas.', summary: ['Tres pares de patas en el adulto típico.', 'Cabeza, tórax y abdomen.', 'Antenas y piezas bucales adaptadas a distintas dietas.'] },
      { title: 'Arácnidos', description: 'Las garrapatas y los ácaros pertenecen a los arácnidos. En general, los adultos poseen cuatro pares de patas y carecen de antenas; la larva de las garrapatas tiene tres pares.', summary: ['Cuatro pares de patas en adultos y ninfas típicos.', 'Sin antenas.', 'Incluye garrapatas y ácaros de importancia médica.'] },
    ],
  },
  {
    category: categories[2], id: 'branch-clasificacion',
    description: 'En parasitología médica interesa clasificar los artrópodos por su grupo zoológico y por la relación que mantienen con el huésped o con los agentes infecciosos.',
    concepts: [
      { title: 'Insecta', description: 'Incluye mosquitos, moscas, pulgas, piojos, triatominos y otros insectos. Sus ciclos y hábitos de alimentación determinan su relevancia médica.', summary: ['Mosquitos y flebótomos: vectores de varios patógenos.', 'Pulgas y piojos: ectoparásitos y posibles vectores.', 'Moscas: algunas especies producen miasis.'] },
      { title: 'Arachnida', description: 'Incluye garrapatas y ácaros. Pueden producir lesiones locales, dermatitis, escabiosis o transmitir microorganismos, según la especie.', summary: ['Garrapatas: hematofagia y transmisión de agentes.', 'Ácaros: algunos producen escabiosis o dermatitis.', 'La identificación requiere observar rasgos morfológicos.'] },
    ],
  },
  {
    category: categories[3], id: 'branch-ciclo',
    description: 'El ciclo de vida varía entre grupos y especies. Conocer sus estadios ayuda a identificar el momento de mayor riesgo y la estrategia de control más eficaz.',
    concepts: [
      { title: 'Metamorfosis completa', description: 'En muchos insectos el desarrollo incluye huevo, larva, pupa y adulto. Las etapas inmaduras pueden ocupar hábitats distintos de los adultos.', summary: ['Huevo → larva → pupa → adulto.', 'La pupa es una fase de transformación.', 'El control de criaderos puede interrumpir el ciclo.'] },
      { title: 'Metamorfosis incompleta', description: 'En otros insectos se observan huevo, ninfas y adulto, sin una fase pupal. Las ninfas se parecen al adulto, aunque aún no son sexualmente maduras.', summary: ['Huevo → ninfas → adulto.', 'No existe fase pupal.', 'La duración depende de especie y ambiente.'] },
    ],
  },
  {
    category: categories[4], id: 'branch-medica',
    description: 'El daño causado por artrópodos puede ser directo —por picaduras, infestación o toxinas— o indirecto, al participar en la transmisión de agentes infecciosos.',
    concepts: [
      { title: 'Vectores', description: 'Un vector biológico permite que un agente se desarrolle o multiplique en él; un vector mecánico lo transporta sin que exista ese desarrollo. La relación concreta depende del agente y la especie.', summary: ['Vector biológico: el agente cumple parte del ciclo en el vector.', 'Vector mecánico: transporte físico del agente.', 'No todos los artrópodos son vectores de enfermedades.'] },
      { title: 'Ectoparasitismo y lesiones', description: 'Piojos, pulgas y algunos ácaros viven sobre el huésped o en contacto con él. Pueden causar prurito, inflamación, excoriaciones e infecciones secundarias por rascado.', summary: ['Prurito, eritema y lesiones por rascado.', 'Escabiosis y pediculosis requieren manejo específico.', 'La historia de exposición orienta el diagnóstico.'] },
    ],
  },
  {
    category: categories[5], id: 'branch-control',
    description: 'La prevención combina medidas personales, ambientales y comunitarias. La intervención debe ajustarse al artrópodo, su hábitat y la vía de exposición.',
    concepts: [
      { title: 'Protección personal', description: 'El uso correcto de repelentes autorizados, mosquiteros, ropa protectora y revisión de la piel reduce el contacto con algunos artrópodos de interés médico.', summary: ['Usar repelentes según etiqueta y edad.', 'Instalar mosquiteros y barreras físicas cuando correspondan.', 'Revisar la piel después de exposiciones de riesgo.'] },
      { title: 'Control ambiental', description: 'Eliminar recipientes con agua estancada, gestionar residuos, proteger alimentos y mejorar el saneamiento disminuye criaderos o refugios de determinadas especies.', summary: ['Eliminar agua estancada y criaderos.', 'Mantener patios y viviendas limpios y protegidos.', 'Aplicar control integrado y evitar insecticidas indiscriminados.'] },
    ],
  },
];

function makeData(partial: Partial<StudyNodeData> & Pick<StudyNodeData, 'title' | 'category' | 'color' | 'emoji' | 'kind' | 'side' | 'description' | 'summary' | 'sources'>): StudyNodeData {
  return {
    completed: false,
    question: partial.kind !== 'root',
    ...partial,
  };
}

export function createInitialMap(title = 'Artrópodos de importancia médica'): { nodes: StudyNode[]; edges: StudyEdge[] } {
  const nodes: StudyNode[] = [];
  const edges: StudyEdge[] = [];
  const rootId = 'root';
  nodes.push({
    id: rootId,
    type: 'study',
    position: { x: 575, y: 305 },
    data: makeData({
      title,
      category: 'Tema central', color: '#526b9e', emoji: '🧠', kind: 'root', side: 'center',
      description: 'Mapa de estudio para comprender las generalidades, la morfología, la clasificación, el ciclo biológico, la importancia médica y el control de los artrópodos relacionados con la salud humana.',
      summary: ['Reconocer rasgos que permiten diferenciar los principales grupos.', 'Relacionar morfología y ciclo de vida con su importancia médica.', 'Distinguir el daño directo del papel como vector.', 'Vincular cada medida preventiva con el modo de exposición.'],
      sources: references,
    }),
  });

  seedBranches.forEach((branch, index) => {
    const side = index < 3 ? 'left' : 'right';
    const rowIndex = index % 3;
    const branchId = branch.id;
    const y = 54 + rowIndex * 224;
    const x = side === 'left' ? 265 : 900;
    nodes.push({
      id: branchId,
      type: 'study',
      position: { x, y },
      data: makeData({
        title: branch.category.name, category: branch.category.name, color: branch.category.color, emoji: branch.category.emoji,
        kind: 'branch', side, parentId: rootId, description: branch.description,
        summary: [branch.description, `Esta rama contiene ${branch.concepts.length} conceptos clave para repasar.`], sources: references,
      }),
    });
    edges.push({
      id: `e-root-${branchId}`, source: rootId, target: branchId,
      sourceHandle: side, targetHandle: 'target', type: 'default',
      style: { stroke: branch.category.color, strokeWidth: 2.2 },
    });

    branch.concepts.forEach((concept, conceptIndex) => {
      const conceptId = `${branchId}-concept-${conceptIndex + 1}`;
      const conceptY = y - 26 + conceptIndex * 100;
      const conceptX = side === 'left' ? 22 : 1160;
      nodes.push({
        id: conceptId,
        type: 'study',
        position: { x: conceptX, y: conceptY },
        data: makeData({
          title: concept.title, category: branch.category.name, color: branch.category.color, emoji: branch.category.emoji,
          kind: 'concept', side, parentId: branchId, description: concept.description,
          summary: concept.summary, sources: references,
        }),
      });
      edges.push({
        id: `e-${branchId}-${conceptId}`, source: branchId, target: conceptId,
        sourceHandle: 'source', targetHandle: 'target', type: 'default',
        style: { stroke: branch.category.color, strokeWidth: 1.7, opacity: 0.78 },
      });
    });
  });

  return { nodes, edges };
}
