// ===================================================================
// INDENIZAÇÃO — art. 45-A, Lei 8.212/91
// Cálculo da indenização de período decadente de Contribuinte Individual.
// Fonte: art. 45-A, Lei 8.212/91 (incluído pela LC 128/2008).
// ===================================================================

const round2 = (x: number) => Math.round(x * 100) / 100;

/**
 * Data de corte para juros/multa: competências anteriores a 14/10/1996
 * não têm juros de mora nem multa (art. 45-A, §1º).
 * Fonte: Lei 8.212/91, art. 45-A, §1º.
 */
export const DATA_CORTE_JUROS = new Date(Date.UTC(1996, 9, 14)).getTime(); // 14/10/1996

export interface EntradaIndenizacao {
  /** Competências do período a indenizar (MM/AAAA) */
  competencias: string[];
  /** Média aritmética simples dos 80% maiores salários desde 07/1994, corrigidos.
   *  Se não informada, usar a base abaixo. */
  media80PorcentoMaiores?: number;
  /** Salários de contribuição desde 07/1994 corrigidos (para calcular média 80%) */
  salariosCorrigidos?: number[];
  /** Alíquota de contribuição (default 20%) */
  aliquota?: number;
}

export interface MemoriaIndenizacao {
  numCompetencias: number;
  media80: number;
  baseCalculo: number;
  /** Competências com juros/multa (≥ 14/10/1996) */
  competenciasComJuros: number;
  /** Competências sem juros/multa (< 14/10/1996) */
  competenciasSemJuros: number;
  /** Valor base (sem juros/multa) por competência */
  valorBasePorComp: number;
  /** Subtotal base (competências × valor base) */
  subtotalBase: number;
  /** Juros de mora: 0,5% a.m., limitados a 50% do valor */
  juros: number;
  /** Multa: 10% sobre base + juros das competências ≥ 14/10/1996 */
  multa: number;
  /** Total da indenização */
  total: number;
}

function compToDate(comp: string): number {
  const [m, a] = comp.split('/').map(Number);
  return Date.UTC(a, m - 1, 1);
}

/**
 * Calcula a indenização de período decadente de CI (art. 45-A, Lei 8.212/91).
 *
 * Fórmula:
 *   Base = média aritmética simples dos 80% maiores salários desde 07/1994 × 20%
 *   Juros de mora = 0,5% a.m., limitados a 50% (apenas ≥ 14/10/1996)
 *   Multa = 10% (apenas ≥ 14/10/1996)
 *   Total = base × nComp + juros + multa
 *
 * Conferência oficial: SAL/RFB (Sistema de Acréscimos Legais da Receita Federal).
 */
export function calcularIndenizacao(e: EntradaIndenizacao): MemoriaIndenizacao {
  const aliquota = e.aliquota ?? 0.20;

  // Calcular média 80%
  let media80: number;
  if (e.media80PorcentoMaiores != null) {
    media80 = e.media80PorcentoMaiores;
  } else if (e.salariosCorrigidos?.length) {
    const sorted = [...e.salariosCorrigidos].sort((a, b) => b - a);
    const n80 = Math.max(1, Math.ceil(sorted.length * 0.8));
    const top80 = sorted.slice(0, n80);
    media80 = top80.reduce((a, b) => a + b, 0) / top80.length;
  } else {
    throw new Error('Informe media80PorcentoMaiores ou salariosCorrigidos.');
  }

  const baseCalculo = round2(media80 * aliquota);
  const competenciasComJuros = e.competencias.filter(c => compToDate(c) >= DATA_CORTE_JUROS).length;
  const competenciasSemJuros = e.competencias.length - competenciasComJuros;

  const subtotalBase = round2(baseCalculo * e.competencias.length);

  // Juros: 0,5% a.m. por competência com juros, limitados a 50%
  // Simplificação: como não temos a data exata de pagamento, usamos
  // um número fixo de meses de atraso baseado na competência mais antiga.
  // Em produção, conferir com SAL/RFB.
  const agora = new Date();
  let totalJuros = 0;
  for (const comp of e.competencias) {
    if (compToDate(comp) < DATA_CORTE_JUROS) continue;
    const dt = new Date(compToDate(comp));
    const mesesAtraso = (agora.getFullYear() - dt.getUTCFullYear()) * 12 + (agora.getMonth() - dt.getUTCMonth());
    const taxaJuros = Math.min(0.5, mesesAtraso * 0.005); // cap 50%
    totalJuros += baseCalculo * taxaJuros;
  }
  const juros = round2(totalJuros);

  // Multa: 10% sobre base das competências com juros
  const multa = round2(baseCalculo * competenciasComJuros * 0.10);

  const total = round2(subtotalBase + juros + multa);

  return {
    numCompetencias: e.competencias.length,
    media80,
    baseCalculo,
    competenciasComJuros,
    competenciasSemJuros,
    valorBasePorComp: baseCalculo,
    subtotalBase,
    juros,
    multa,
    total,
  };
}
