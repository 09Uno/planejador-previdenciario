// ===================================================================
// PROFESSOR — magistério na educação básica (infantil, fundamental, médio)
// Fonte: art. 201 §8º CF, EC 103/2019 arts. 15/16/19/20 com reduções,
//        IN PRES/INSS 128/2022.
// ===================================================================
import type { Sexo } from './types.js';

/**
 * TC mínimo de magistério: 25 (H) / 25 (M) — sim, ambos 25 para professor.
 * Mas o TC total exigido é 25 (M) / 30 (H) com redução de 5 anos.
 */
export function tcMinimoProfessor(sexo: Sexo): number {
  return sexo === 'M' ? 30 : 25;
}

/**
 * Art. 15 — Pontos progressivos para professor.
 * 2026: H = 98, M = 88 (+1/ano); cap H = 100, M = 92.
 * Fonte: EC 103/2019, art. 15, §§ 3º e 4º.
 */
export function pontosMinProfessor(ano: number, sexo: Sexo): number {
  const base = sexo === 'M' ? 91 : 81;  // 2019
  const cap = sexo === 'M' ? 100 : 92;
  return Math.min(base + Math.max(0, ano - 2019), cap);
}

/**
 * Art. 16 — Idade mínima progressiva para professor.
 * 2026: H = 59,5, M = 54,5 (+6m/ano); cap H = 60, M = 57.
 * Fonte: EC 103/2019, art. 16, § 2º.
 */
export function idadeMinProgressivaProfessor(ano: number, sexo: Sexo): number {
  const base = sexo === 'M' ? 56 : 51;  // 2019
  const cap = sexo === 'M' ? 60 : 57;
  return Math.min(base + 0.5 * Math.max(0, ano - 2019), cap);
}

/**
 * Art. 20 — Pedágio 100% para professor.
 * Idade mínima: H = 55, M = 52.
 * TC mínimo: 30 (H) / 25 (M) + pedágio 100% do que faltava.
 */
export const IDADE_PEDAGIO100_PROFESSOR: Record<Sexo, number> = { M: 55, F: 52 };

/**
 * Art. 19 — Regra permanente para professor.
 * Idade mínima: H = 60, M = 57.
 * TC mínimo: 25 anos de magistério.
 * Coeficiente: 60% + 2%/ano acima de 20 (H) ou 15 (M).
 */
export const IDADE_PERMANENTE_PROFESSOR: Record<Sexo, number> = { M: 60, F: 57 };
export const TC_PERMANENTE_PROFESSOR = 25;
