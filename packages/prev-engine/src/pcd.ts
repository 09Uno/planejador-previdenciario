// ===================================================================
// PCD — Aposentadoria da Pessoa com Deficiência (LC 142/2013)
// Fonte: Lei Complementar 142/2013, regulamentada pelo Dec. 8.145/2013.
// ===================================================================
import type { Sexo } from './types.js';

export type GrauDeficiencia = 'grave' | 'moderada' | 'leve';

/**
 * Aposentadoria PCD por tempo de contribuição.
 * TC mínimo por grau e sexo (art. 3º, LC 142/2013):
 *   Grave: H 25, M 20
 *   Moderada: H 29, M 24
 *   Leve: H 33, M 28
 * RMI = 100% da média (sem coeficiente redutor).
 */
export const TC_MINIMO_PCD: Record<GrauDeficiencia, Record<Sexo, number>> = {
  grave:    { M: 25, F: 20 },
  moderada: { M: 29, F: 24 },
  leve:     { M: 33, F: 28 },
};

/**
 * Aposentadoria PCD por idade (art. 3º, IV, LC 142/2013).
 * Idade mínima: H 60, M 55.
 * TC mínimo: 15 anos (ambos os sexos).
 * RMI = 70% + 1% por ano de contribuição (sem cap de 100%).
 * Fonte: art. 8º, LC 142/2013.
 */
export const IDADE_MINIMA_PCD: Record<Sexo, number> = { M: 60, F: 55 };
export const TC_MINIMO_PCD_IDADE = 15;

/**
 * Coeficiente da aposentadoria PCD por idade.
 * 70% + 1% por grupo de 12 contribuições (art. 8º, LC 142/2013).
 */
export function coefPCDIdade(tcAnos: number): number {
  return 0.70 + 0.01 * Math.floor(tcAnos);
}

/**
 * Tabela de conversão entre graus de deficiência (art. 7º, Dec. 8.145/2013).
 * Para determinar o grau preponderante quando há mudança de grau ao longo da vida.
 * Fator: tempo no grau × multiplicador → acumula no grau preponderante.
 *
 * Multiplicadores para converter PARA o grau de referência:
 *   De grave para moderada: × 1.1600
 *   De grave para leve:     × 1.3200
 *   De moderada para grave: × 0.8621
 *   De moderada para leve:  × 1.1379
 *   De leve para grave:     × 0.7576
 *   De leve para moderada:  × 0.8788
 *
 * Fonte: Dec. 8.145/2013, art. 7º, tabela.
 */
export const FATOR_CONVERSAO_GRAU: Record<GrauDeficiencia, Record<GrauDeficiencia, number>> = {
  grave: {
    grave: 1,
    moderada: 25 / 29,  // 0.8621
    leve: 25 / 33,      // 0.7576
  },
  moderada: {
    grave: 29 / 25,     // 1.16
    moderada: 1,
    leve: 29 / 33,      // 0.8788
  },
  leve: {
    grave: 33 / 25,     // 1.32
    moderada: 33 / 29,  // 1.1379
    leve: 1,
  },
};
