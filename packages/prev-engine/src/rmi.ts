import { tcAnos } from './dates.js';
import type { Competencia, ParametrosVigentes, Sexo, TipoCalculo } from './types.js';

const round2 = (x: number) => Math.round(x * 100) / 100;

/** Coeficiente pós-EC 103: 60% + 2% por ano (inteiro) que exceder 20 (H) / 15 (M). Sem cap (configurável). */
export function coef(tcAnosVal: number, sexo: Sexo, cap100 = true): number {
  const exc = Math.max(0, Math.floor(tcAnosVal) - (sexo === 'M' ? 20 : 15));
  const c = 0.60 + 0.02 * exc;
  return cap100 ? Math.min(1, c) : c;
}

/** Fator previdenciário: f = (Tc×a/Es) × [1 + (Id + Tc×a)/100], a = 0,31. */
export function fatorPrev(tc: number, idade: number, es: number): number {
  const a = 0.31;
  return (tc * a / es) * (1 + (idade + tc * a) / 100);
}

export function mediaSimples(vals: number[], divisorMinimo = 0): number {
  const n = vals.length;
  if (!n) return 0;
  const soma = vals.reduce((a, b) => a + b, 0);
  return soma / Math.max(n, divisorMinimo);
}

export interface OpcoesDescarte {
  /** TC total em dias na DER (antes de qualquer descarte) */
  tcTotalDias: number;
  /** tempo mínimo da regra em anos (o descarte não pode reduzir abaixo disso) */
  tcMinAnos: number;
  sexo: Sexo;
  /** nº de contribuições válidas para carência na DIB (do quadro "Análise dos Dados") */
  carenciaNaDIB?: number;
  /** carência mínima exigida (default 180 quando carenciaNaDIB informada) */
  carenciaMinima?: number;
  /** piso de competências remanescentes (art. 135-A, Lei 14.331/2022): 108 */
  restanteMinimo?: number;
  /** piso e teto para a RMI ao otimizar */
  salarioMinimo: number;
  teto: number;
}

export interface ResultadoDescarte {
  descartes: number;
  indicesDescartados: number[];
  somaConsiderada: number;
  divisor: number;
  media: number;
  tcRestanteDias: number;
  coeficiente: number;
  rmiBruta: number;
  rmi: number;
}

/**
 * Descarte otimizado (art. 26, §6º, EC 103) — replica a mecânica do
 * "Cálculo do Descarte Automático" dos documentos profissionais:
 * varredura gulosa em ordem crescente de salário corrigido; uma competência
 * só é descartada se o TC remanescente continuar ≥ tempo mínimo da regra
 * (competências inviáveis pelo TC são PULADAS — ex.: doc 6.1 Suely descarta a
 * competência de 7 dias e pula as de 30); a carência remanescente deve
 * continuar ≥ 180 (doc 8.1: carência exatamente 180 → zero descartes) e o
 * nº de competências remanescentes ≥ 108 (art. 135-A). Escolhe-se o passo de
 * MAIOR RMI final; empate (ex.: RMI no piso) → MENOS descartes.
 */
export function otimizarDescarteExato(comps: Competencia[], o: OpcoesDescarte): ResultadoDescarte {
  const n = comps.length;
  const ordem = comps.map((_, i) => i).sort((a, b) => comps[a].salarioCorrigido! - comps[b].salarioCorrigido!);
  const somaTotal = comps.reduce((s, c) => s + c.salarioCorrigido!, 0);
  const carenciaMin = o.carenciaMinima ?? (o.carenciaNaDIB != null ? 180 : 0);
  const restanteMin = o.restanteMinimo ?? 108;

  const estado = (k: number, descartados: number[], soma: number, dias: number): ResultadoDescarte => {
    const rem = n - k;
    const divisor = rem;
    const tcRest = o.tcTotalDias - dias;
    const media = (somaTotal - soma) / divisor;
    const c = coef(tcAnos(tcRest), o.sexo);
    const rmiBruta = media * c;
    const rmi = Math.min(Math.max(rmiBruta, o.salarioMinimo), o.teto);
    return {
      descartes: k, indicesDescartados: descartados.slice(), somaConsiderada: round2(somaTotal - soma),
      divisor, media: round2(media), tcRestanteDias: tcRest, coeficiente: c,
      rmiBruta: round2(rmiBruta), rmi: round2(rmi),
    };
  };

  let somaDesc = 0, diasDesc = 0, k = 0;
  const descartados: number[] = [];
  let atual = estado(0, descartados, 0, 0);
  let melhor = atual;
  let melhorBruta = atual.rmiBruta;

  for (const i of ordem) {
    const c = comps[i];
    // restrições de contagem (monotônicas → param a varredura)
    if (n - (k + 1) < restanteMin) break;
    if (o.carenciaNaDIB != null && o.carenciaNaDIB - (k + 1) < carenciaMin) break;
    // restrição de tempo mínimo: se inviável, PULA esta competência
    if (tcAnos(o.tcTotalDias - (diasDesc + c.dias)) < o.tcMinAnos) continue;
    k++; somaDesc += c.salarioCorrigido!; diasDesc += c.dias; descartados.push(i);
    atual = estado(k, descartados, somaDesc, diasDesc);
    if (atual.rmi > melhor.rmi + 1e-9) { melhor = atual; melhorBruta = atual.rmiBruta; }
  }
  return melhor;
}

export interface EntradaRMI {
  /** competências do PBC com salarioCorrigido preenchido (ver aplicarAtualizacao) */
  competencias: Competencia[];
  tipo: TipoCalculo;
  /** TC total em dias na DER */
  tcTotalDias: number;
  idadeNaDER: number;
  sexo: Sexo;
  /** tempo mínimo da regra (anos) — restringe o descarte */
  tcMinRegra: number;
  params: ParametrosVigentes;
  /** aplica divisor mínimo de 108 na média (art. 135-A: filiado até 07/1994 e DER ≥ 05/05/2022) */
  aplicarDivisorMinimo?: boolean;
  /** nº de contribuições válidas para carência na DIB — restringe o descarte (mín. 180) */
  carenciaNaDIB?: number;
}

export interface ResultadoRMI {
  rmi: number;
  rmiBruta: number;
  media: number;
  salarioBeneficio: number;
  coeficiente: number | null;
  fator: number | null;
  descartes: number;
  indicesDescartados: number[];
  divisor: number;
  parcelasPBC: number;
  tcConsideradoDias: number;
  es: number | null;
  obs: string[];
}

/** Competência mínima do PBC (art. 29, Lei 8.213 / Lei 9.876/99). */
const PBC_INICIO = '07/1994';
function compKey(comp: string): number { const [m, a] = comp.split('/').map(Number); return a * 12 + m; }
const PBC_INICIO_KEY = compKey(PBC_INICIO);

/** Cálculo da RMI por tipo (pós e pré-EC), com a mecânica dos documentos reais. */
export function calcularRMI(e: EntradaRMI): ResultadoRMI {
  // Filtrar competências anteriores a 07/1994 (fora do PBC)
  const comps = e.competencias.filter(c => compKey(c.competencia) >= PBC_INICIO_KEY);
  if (!comps.length) throw new Error('Sem competências no PBC (a partir de 07/1994).');
  const vals = comps.map(c => c.salarioCorrigido ?? c.salarioContribuicao);
  const divMin = e.aplicarDivisorMinimo ? e.params.divisorMinimo : 0;
  const obs: string[] = [];
  const esIdade = Math.min(75, Math.max(45, Math.floor(e.idadeNaDER)));
  const es = e.params.tabuaEs[esIdade] ?? 18;
  const tc = tcAnos(e.tcTotalDias);

  let media: number, fator: number | null = null, coefic: number | null = null;
  let descartes = 0, indicesDescartados: number[] = [], divisor = vals.length;
  let tcConsiderado = e.tcTotalDias;

  if (e.tipo === 'media80' || e.tipo === 'media80_fator') {
    const sorted = vals.slice().sort((a, b) => b - a);
    const n80 = Math.max(1, Math.round(sorted.length * 0.8));
    divisor = n80;
    media = mediaSimples(sorted.slice(0, n80), 0);
    obs.push(`Média dos ${n80} maiores salários (80%) — regra pré-EC 103.`);
    if (e.tipo === 'media80_fator') { fator = fatorPrev(tc, e.idadeNaDER, es); }
  } else if (e.tipo === 'media100') {
    divisor = Math.max(vals.length, divMin);
    media = mediaSimples(vals, divMin);
    coefic = 1;
    obs.push('100% da média, sem descarte (art. 26, §3º, I — pedágio 100%).');
  } else if (e.tipo === 'media100_fator') {
    divisor = Math.max(vals.length, divMin);
    media = mediaSimples(vals, divMin);
    fator = fatorPrev(tc, e.idadeNaDER, es);
    coefic = 1;
    if (fator > 1) obs.push('Fator previdenciário > 1: favorável.');
  } else {
    // media100_coef — com descarte otimizado exato
    const ot = otimizarDescarteExato(comps, {
      tcTotalDias: e.tcTotalDias, tcMinAnos: e.tcMinRegra, sexo: e.sexo,
      salarioMinimo: e.params.salarioMinimo, teto: e.params.teto,
      carenciaNaDIB: e.carenciaNaDIB, restanteMinimo: e.params.divisorMinimo,
    });
    media = ot.media; coefic = ot.coeficiente; descartes = ot.descartes;
    indicesDescartados = ot.indicesDescartados; divisor = ot.divisor; tcConsiderado = ot.tcRestanteDias;
    if (descartes > 0) obs.push(`Descarte otimizado: ${descartes} competência(s) (art. 26, §6º, EC 103). O tempo descartado não vale para nenhum fim.`);
    obs.push(`Coeficiente: ${(coefic * 100).toFixed(0)}% (TC considerado: ${tcAnos(tcConsiderado).toFixed(4)} anos).`);
  }

  let rmiBruta = media * (coefic ?? 1) * (fator ?? 1);
  let rmi = rmiBruta;
  if (rmi > e.params.teto) { rmi = e.params.teto; obs.push('Limitada ao teto do RGPS.'); }
  if (rmi < e.params.salarioMinimo) { rmi = e.params.salarioMinimo; obs.push('Elevada ao salário mínimo (piso).'); }

  return {
    rmi: round2(rmi), rmiBruta: round2(rmiBruta), media: round2(media),
    salarioBeneficio: round2(media), coeficiente: coefic, fator, descartes,
    indicesDescartados, divisor, parcelasPBC: comps.length, tcConsideradoDias: tcConsiderado,
    es: fator != null ? es : null, obs,
  };
}

/** Parse de salários "MM/AAAA valor" (um por linha) — compatível com a UI atual. */
export function parseSalarios(texto: string): { salarios: { comp: string; ano: number; mes: number; valor: number }[]; erros: string[] } {
  const out: { comp: string; ano: number; mes: number; valor: number }[] = [];
  const erros: string[] = [];
  for (const raw of String(texto).split(/\n+/)) {
    const line = raw.trim();
    if (!line) continue;
    const m = line.match(/(\d{2})\/(\d{4})[\s;,\t]+R?\$?\s*([\d.,]+)/);
    if (!m) { erros.push(line); continue; }
    const valor = parseFloat(m[3].replace(/\./g, '').replace(',', '.'));
    if (!isFinite(valor)) { erros.push(line); continue; }
    out.push({ comp: `${m[1]}/${m[2]}`, ano: +m[2], mes: +m[1], valor });
  }
  return { salarios: out, erros };
}
