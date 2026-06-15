import { compKey } from './dates.js';
import type { Competencia, Periodo } from './types.js';

export interface ItemCarencia {
  competencia: string;
  valida: boolean;
  motivo?: 'abaixo-do-minimo' | 'sem-recolhimento';
}

export interface ResultadoCarencia {
  total: number;
  abaixoDoMinimo: string[];
  itens: ItemCarencia[];
}

/**
 * Carência: número de competências com contribuição válida.
 * - Vínculos de emprego: cada competência (mês civil) dentro do vínculo conta.
 * - CI/facultativo: a competência conta se o salário ≥ salário mínimo vigente
 *   na competência (senão, marca "abaixo-do-minimo" — exige complementação ou
 *   agrupamento, art. 216, §27-A, Dec. 3.048/99 — indicador PREC-MENOR-MIN).
 */
export function contarCarencia(opts: {
  /** vínculos de emprego (cada mês conta independentemente do valor) */
  vinculosEmprego?: Periodo[];
  /** recolhimentos CI/facultativo */
  recolhimentos?: Competencia[];
  /** salário mínimo por competência — para validar recolhimentos */
  salarioMinimoDaCompetencia?: (comp: string) => number | undefined;
}): ResultadoCarencia {
  const meses = new Map<number, ItemCarencia>();

  for (const p of opts.vinculosEmprego ?? []) {
    const a = new Date(p.ini), b = new Date(p.fim);
    let y = a.getUTCFullYear(), m = a.getUTCMonth() + 1;
    const yf = b.getUTCFullYear(), mf = b.getUTCMonth() + 1;
    while (y * 100 + m <= yf * 100 + mf) {
      const comp = `${String(m).padStart(2, '0')}/${y}`;
      meses.set(y * 100 + m, { competencia: comp, valida: true });
      m++; if (m > 12) { m = 1; y++; }
    }
  }

  const abaixo: string[] = [];
  for (const r of opts.recolhimentos ?? []) {
    const k = compKey(r.competencia);
    if (meses.get(k)?.valida) continue;
    const piso = opts.salarioMinimoDaCompetencia?.(r.competencia);
    if (piso != null && r.salarioContribuicao < piso) {
      abaixo.push(r.competencia);
      if (!meses.has(k)) meses.set(k, { competencia: r.competencia, valida: false, motivo: 'abaixo-do-minimo' });
    } else {
      meses.set(k, { competencia: r.competencia, valida: true });
    }
  }

  const itens = [...meses.entries()].sort((a, b) => a[0] - b[0]).map(([, v]) => v);
  return { total: itens.filter(i => i.valida).length, abaixoDoMinimo: abaixo, itens };
}

/** Carência mínima padrão das aposentadorias programadas. */
export const CARENCIA_MINIMA = 180;
