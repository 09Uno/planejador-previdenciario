// ===================================================================
// ACORDOS INTERNACIONAIS — totalização de períodos no exterior
// Fonte: Decreto 3.048/99, art. 244; acordos bilaterais/multilaterais.
// Período estrangeiro soma para REQUISITO (tempo/carência) mas NÃO
// entra na média salarial; RMI proporcional pro rata.
// ===================================================================

import { DAY } from './dates.js';
import type { Periodo } from './types.js';

/**
 * Lista de países com acordo previdenciário vigente com o Brasil.
 * Fonte: gov.br/previdencia — Acordos Internacionais de Previdência Social.
 */
export const PAISES_CONVENIADOS = [
  'Alemanha', 'Argentina', 'Bélgica', 'Bolívia', 'Cabo Verde', 'Canadá',
  'Chile', 'Coreia do Sul', 'El Salvador', 'Equador', 'Espanha',
  'Estados Unidos', 'França', 'Grécia', 'Hungria', 'Israel', 'Itália',
  'Japão', 'Luxemburgo', 'Moçambique', 'Paraguai', 'Portugal',
  'Quebec (Canadá)', 'República Tcheca', 'Suíça', 'Uruguai',
  // Multilaterais (MERCOSUL, Ibero-Americano)
  'MERCOSUL (multilateral)', 'Ibero-Americano (multilateral)',
] as const;

export type PaisConveniado = typeof PAISES_CONVENIADOS[number] | string;

export interface PeriodoExterior {
  pais: PaisConveniado;
  ini: number;
  fim: number;
  desc?: string;
}

/**
 * Calcula dias de período no exterior.
 */
export function diasExterior(periodos: PeriodoExterior[]): number {
  let dias = 0;
  for (const p of periodos) {
    dias += Math.round((p.fim - p.ini) / DAY) + 1;
  }
  return dias;
}

/**
 * Benefício proporcional pro rata:
 *   RMI cheia × (tempo brasileiro ÷ tempo total)
 *
 * O tempo estrangeiro soma para atingir o REQUISITO (TC mínimo, carência),
 * mas a RMI é calculada apenas sobre os salários brasileiros, e depois
 * proporcionalizada pelo tempo brasileiro / tempo total.
 *
 * @param rmiBrasileira RMI calculada sobre salários brasileiros
 * @param diasBrasil Total de dias de contribuição no Brasil
 * @param diasTotal Total de dias (Brasil + exterior)
 * @returns RMI proporcional
 */
export function rmiProRata(rmiBrasileira: number, diasBrasil: number, diasTotal: number): {
  rmiProporcional: number;
  coeficienteProporcional: number;
} {
  if (diasTotal <= 0) return { rmiProporcional: 0, coeficienteProporcional: 0 };
  const coef = diasBrasil / diasTotal;
  return {
    rmiProporcional: Math.round(rmiBrasileira * coef * 100) / 100,
    coeficienteProporcional: Math.round(coef * 1000) / 1000,
  };
}
