// Gerador de cenários de planejamento: regra × base de contribuição futura ×
// cadência, com projeção de competências e cálculo de RMI — replica os
// "Docs X.0/X.Y" dos planejamentos do escritório.
import { parseBR, fmtBR, idadeAnos, diasParaAMD, fmtAMD, compKey, DAY } from './dates.js';
import { mesclarPeriodos, diasAte } from './periodos.js';
import { avaliarRegras, VESPERA } from './regras.js';
import { aplicarAtualizacao } from './atualizacao.js';
import { calcularRMI } from './rmi.js';
import { calcularROI } from './roi.js';
import { TC_MINIMO_ESPECIAL, diasComConversao } from './especial.js';
import { tcMinimoProfessor, TC_PERMANENTE_PROFESSOR } from './professor.js';
import { TC_MINIMO_PCD, TC_MINIMO_PCD_IDADE } from './pcd.js';
import type { Competencia, ParametrosVigentes, Periodo, Sexo, TipoCalculo } from './types.js';
import type { GrauDeficiencia } from './pcd.js';
import type { ResultadoRMI } from './rmi.js';
import type { ResultadoROI } from './roi.js';

export type RegraId =
  | 'da' | 'art15' | 'art16' | 'art17' | 'art18' | 'art20' | 'perm'
  // Especial
  | 'art21' | 'esp_perm'
  // Professor
  | 'prof_pontos' | 'prof_idade' | 'prof_ped100' | 'prof_perm'
  // PCD
  | 'pcd_tc' | 'pcd_idade';
export type Cadencia = 'sem-parar' | 'cada-6-meses' | 'parar';

export interface PerfilSegurado {
  nome: string;
  sexo: Sexo;
  /** dd/mm/aaaa */
  nascimento: string;
  /** períodos contributivos (do CNIS, conferidos) */
  periodos: Periodo[];
  /** competências do PBC (desde 07/1994) com salários NOMINAIS */
  competencias: Competencia[];
  /** carência atual (nº de contribuições válidas até hoje) */
  carenciaAtual: number;
  /** grau de exposição especial (15/20/25 anos), se aplicável */
  grauEspecial?: 15 | 20 | 25;
  /** flag professor (magistério educação básica) */
  professor?: boolean;
  /** grau de deficiência (PCD LC 142/2013) */
  grauPCD?: GrauDeficiencia;
}

export interface PremissasCenario {
  rotulo?: string;
  regra: RegraId;
  /** base das contribuições futuras */
  base: 'minimo' | 'teto' | 'valor';
  valorBase?: number;
  cadencia: Cadencia;
  /** alíquota da contribuição futura (ex.: 0.20 CI, 0.11 facultativo simplificado) */
  aliquota: number;
  /** data-base da análise (default hoje) */
  hoje?: string;
}

export interface ResultadoCenario {
  rotulo: string;
  regra: RegraId;
  elegivel: boolean;
  dib: string | null;
  idadeNaDIB: number | null;
  tcNaDIB: string | null;
  tcDias: number;
  carenciaNaDIB: number;
  mesesProjetados: number;
  contribuicaoMensal: number;
  rmi: ResultadoRMI | null;
  roi: ResultadoROI | null;
  observacoes: string[];
}

const TIPO_CALCULO: Record<RegraId, TipoCalculo> = {
  da: 'media80', art15: 'media100_coef', art16: 'media100_coef', art17: 'media100_fator',
  art18: 'media100_coef', art20: 'media100', perm: 'media100_coef',
  // Especial: 60% + 2%/ano acima de 20 (art. 21 §2º EC 103)
  art21: 'media100_coef', esp_perm: 'media100_coef',
  // Professor: mesma regra de coeficiente
  prof_pontos: 'media100_coef', prof_idade: 'media100_coef', prof_ped100: 'media100_coef', prof_perm: 'media100_coef',
  // PCD TC: 100% da média; PCD idade: 70% + 1%/ano
  pcd_tc: 'media100', pcd_idade: 'media100_coef',
};
const TC_MIN_REGRA: Record<RegraId, (s: Sexo) => number> = {
  da: s => s === 'M' ? 35 : 30, art15: s => s === 'M' ? 35 : 30, art16: s => s === 'M' ? 35 : 30,
  art17: s => s === 'M' ? 35 : 30, art18: () => 15, art20: s => s === 'M' ? 35 : 30,
  perm: s => s === 'M' ? 20 : 15,
  // Especial
  art21: () => 25, esp_perm: () => 25,
  // Professor
  prof_pontos: s => tcMinimoProfessor(s), prof_idade: s => tcMinimoProfessor(s),
  prof_ped100: s => tcMinimoProfessor(s), prof_perm: () => TC_PERMANENTE_PROFESSOR,
  // PCD (usa grave como padrão; o motor ajusta internamente pelo grau)
  pcd_tc: s => s === 'M' ? 25 : 20, pcd_idade: () => TC_MINIMO_PCD_IDADE,
};

function proximaComp(ts: number): { m: number; a: number } {
  const d = new Date(ts);
  return { m: d.getUTCMonth() + 1, a: d.getUTCFullYear() };
}

/** Monta um cenário completo: elegibilidade, projeção, RMI e ROI. */
export function montarCenario(perfil: PerfilSegurado, p: PremissasCenario, params: ParametrosVigentes): ResultadoCenario {
  const obs: string[] = [];
  const hoje = p.hoje ? parseBR(p.hoje)! : Date.now();
  const nasc = parseBR(perfil.nascimento)!;
  const merged = mesclarPeriodos(perfil.periodos);
  const valorBase = p.base === 'minimo' ? params.salarioMinimo : p.base === 'teto' ? params.teto : (p.valorBase ?? params.salarioMinimo);
  const contribuicaoMensal = Math.round(valorBase * p.aliquota * 100) / 100;

  // elegibilidade: qualquer cadência ≠ 'parar' projeta TC contínuo para checar a
  // DATA em que a regra é atingida (art. 18 exige TC ≥ 15 + idade ≥ 62, logo a
  // projeção precisa assumir contribuição contínua). A cadência reduzida afeta
  // apenas o PBC e a RMI, não a data de elegibilidade.
  const continua = p.cadencia !== 'parar';
  const av = avaliarRegras({
    sexo: perfil.sexo, nasc, merged, hoje, continuaContribuindo: continua,
    grauEspecial: perfil.grauEspecial, professor: perfil.professor, grauPCD: perfil.grauPCD,
  });
  const regra = av.regras.find(r => r.id === p.regra)!;

  const rotulo = p.rotulo ?? `${regra.nome} — ${p.base === 'minimo' ? 'salário mínimo' : p.base === 'teto' ? 'teto' : `R$ ${valorBase.toFixed(2)}`} — ${p.cadencia}`;

  if (!regra.data) {
    return {
      rotulo, regra: p.regra, elegivel: false, dib: null, idadeNaDIB: null, tcNaDIB: null,
      tcDias: 0, carenciaNaDIB: perfil.carenciaAtual, mesesProjetados: 0, contribuicaoMensal,
      rmi: null, roi: null, observacoes: [regra.detalhe],
    };
  }

  const dib = Math.max(regra.data, hoje);
  // projeção de competências futuras (do mês seguinte à data-base até a DIB)
  const projetadas: Competencia[] = [];
  let { m, a } = proximaComp(hoje);
  m++; if (m > 12) { m = 1; a++; }
  const fim = proximaComp(dib);
  let contador = 0;
  while (a * 100 + m <= fim.a * 100 + fim.m) {
    const usa = p.cadencia === 'sem-parar' || (p.cadencia === 'cada-6-meses' && contador % 6 === 0);
    if (usa && p.cadencia !== 'parar') {
      projetadas.push({
        competencia: `${String(m).padStart(2, '0')}/${a}`,
        dias: 30, salarioContribuicao: valorBase, tetoCompetencia: params.teto, indice: 1.0,
      });
    }
    contador++;
    m++; if (m > 12) { m = 1; a++; }
  }
  if (projetadas.length) obs.push(`${projetadas.length} competência(s) projetada(s) ("a recolher ${p.cadencia === 'sem-parar' ? 'sem parar' : 'a cada 6 meses'}") sobre R$ ${valorBase.toFixed(2)}.`);

  // TC e carência na DIB — inclui a conversão especial→comum (art. 25, §2º, EC 103)
  const temEspecial = merged.some(pp => pp.tipo === 'especial');
  const bonusConv = temEspecial
    ? Math.max(0, diasComConversao(merged, perfil.sexo, VESPERA).diasConvertidos - diasAte(merged, VESPERA))
    : 0;
  const diasHist = diasAte(merged, Math.min(hoje, dib)) + bonusConv;
  const diasProj = p.cadencia === 'sem-parar'
    ? Math.max(0, Math.round((dib - Math.min(hoje, dib)) / DAY))
    : projetadas.length * 30;
  const tcDias = diasHist + diasProj;
  const carenciaNaDIB = perfil.carenciaAtual + projetadas.length;

  // PBC: históricas corrigidas (tabela) + projetadas (índice 1,0 já embutido)
  const pbc = aplicarAtualizacao([...perfil.competencias, ...projetadas]);

  const idadeNaDIB = idadeAnos(nasc, dib);
  let rmi: ResultadoRMI | null = null;
  if (pbc.length) {
    rmi = calcularRMI({
      competencias: pbc, tipo: TIPO_CALCULO[p.regra], tcTotalDias: tcDias,
      idadeNaDER: idadeNaDIB, sexo: perfil.sexo, tcMinRegra: TC_MIN_REGRA[p.regra](perfil.sexo),
      params, carenciaNaDIB,
    });
  } else obs.push('Sem competências no PBC — informe os salários do CNIS.');

  // Carência insuficiente → não elegível (art. 25, I, Lei 8.213/91)
  if (carenciaNaDIB < 180) {
    return {
      rotulo, regra: p.regra, elegivel: false, dib: fmtBR(dib), idadeNaDIB: Math.round(idadeAnos(nasc, dib) * 100) / 100,
      tcNaDIB: fmtAMD(diasParaAMD(tcDias)), tcDias, carenciaNaDIB,
      mesesProjetados: projetadas.length, contribuicaoMensal,
      rmi: null, roi: null,
      observacoes: [`Não elegível: carência projetada na DIB = ${carenciaNaDIB} < 180. Faltam ${180 - carenciaNaDIB} contribuição(ões).`],
    };
  }

  const mesesAteDib = Math.max(0, Math.round((dib - hoje) / DAY / 30.4375));
  const roi = rmi ? calcularROI({
    rotulo, dataAposentadoria: fmtBR(dib), idadeNaDER: idadeNaDIB, rmiBruta: rmi.rmi,
    contribuicaoMensal, mesesContribuicao: projetadas.length || (p.cadencia === 'sem-parar' ? mesesAteDib : 0),
    tabuaEs: params.tabuaEs,
  }) : null;

  return {
    rotulo, regra: p.regra, elegivel: true, dib: fmtBR(dib), idadeNaDIB: Math.round(idadeNaDIB * 100) / 100,
    tcNaDIB: fmtAMD(diasParaAMD(tcDias)), tcDias, carenciaNaDIB,
    mesesProjetados: projetadas.length, contribuicaoMensal, rmi, roi, observacoes: obs,
  };
}

/** Grade padrão de cenários (como o escritório monta: a–g + regras avançadas quando aplicáveis). */
export function gradePadrao(perfil: PerfilSegurado, params: ParametrosVigentes, hoje?: string): ResultadoCenario[] {
  const al = 0.20;
  const grade: PremissasCenario[] = [
    // Grade padrão RGPS
    { regra: 'art18', base: 'minimo', cadencia: 'cada-6-meses', aliquota: 0.11, hoje },
    { regra: 'art18', base: 'minimo', cadencia: 'sem-parar', aliquota: 0.11, hoje },
    { regra: 'art18', base: 'teto', cadencia: 'sem-parar', aliquota: al, hoje },
    { regra: 'perm', base: 'teto', cadencia: 'sem-parar', aliquota: al, hoje },
    { regra: 'art15', base: 'teto', cadencia: 'sem-parar', aliquota: al, hoje },
    { regra: 'art16', base: 'teto', cadencia: 'sem-parar', aliquota: al, hoje },
    { regra: 'art20', base: 'teto', cadencia: 'sem-parar', aliquota: al, hoje },
  ];

  // Especial (se perfil tem grau)
  if (perfil.grauEspecial) {
    grade.push({ regra: 'art21', base: 'teto', cadencia: 'sem-parar', aliquota: al, hoje });
    grade.push({ regra: 'esp_perm', base: 'teto', cadencia: 'sem-parar', aliquota: al, hoje });
  }

  // Professor (se flag ativa)
  if (perfil.professor) {
    grade.push({ regra: 'prof_pontos', base: 'teto', cadencia: 'sem-parar', aliquota: al, hoje });
    grade.push({ regra: 'prof_idade', base: 'teto', cadencia: 'sem-parar', aliquota: al, hoje });
    grade.push({ regra: 'prof_perm', base: 'teto', cadencia: 'sem-parar', aliquota: al, hoje });
  }

  // PCD (se grau definido)
  if (perfil.grauPCD) {
    grade.push({ regra: 'pcd_tc', base: 'teto', cadencia: 'sem-parar', aliquota: al, hoje });
    grade.push({ regra: 'pcd_idade', base: 'teto', cadencia: 'sem-parar', aliquota: al, hoje });
  }

  return grade.map(g => montarCenario(perfil, g, params));
}
