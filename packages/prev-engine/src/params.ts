import tetosJson from './data/tetos-historicos.js';
import fatoresJson from './data/fatores-2026-01.js';
import type { ParametrosVigentes } from './types.js';

/**
 * Tábua IBGE (expectativa de sobrevida por idade, unissex) usada no fator previdenciário.
 * Fonte: Tábuas Completas de Mortalidade IBGE — ATUALIZAR a cada divulgação (1º/12).
 */
export const TABUA_IBGE_2024: Record<number, number> = {
  45: 34.6, 46: 33.7, 47: 32.9, 48: 32.0, 49: 31.2, 50: 30.4, 51: 29.6, 52: 28.8,
  53: 28.0, 54: 27.2, 55: 26.4, 56: 25.6, 57: 24.9, 58: 24.1, 59: 23.3, 60: 22.6,
  61: 21.8, 62: 21.1, 63: 20.4, 64: 19.6, 65: 18.9, 66: 18.2, 67: 17.5, 68: 16.9,
  69: 16.2, 70: 15.5, 71: 14.9, 72: 14.3, 73: 13.7, 74: 13.1, 75: 12.5,
};

/** Parâmetros vigentes em 2026 (Portaria Interministerial MPS/MF 13/2026; Decreto 12.797/2025). */
export const PARAMS_2026: ParametrosVigentes = {
  salarioMinimo: 1621.00,
  teto: 8475.55,
  divisorMinimo: 108,
  tabuaEs: TABUA_IBGE_2024,
};

/** Parâmetros vigentes em 2025 (para cálculos com data-base em 2025). */
export const PARAMS_2025: ParametrosVigentes = {
  salarioMinimo: 1518.00,
  teto: 8157.41,
  divisorMinimo: 108,
  tabuaEs: TABUA_IBGE_2024,
};

/**
 * Teto de contribuição por competência ("MM/AAAA").
 * Extraído dos documentos de cálculo reais (07/1994 em diante). Lacunas: completar
 * com as Portarias de reajuste — ver scripts/atualizar-tabelas (Fase 1).
 */
export const TETOS_HISTORICOS: Record<string, number> = tetosJson;

/**
 * Fatores de atualização monetária com DATA-BASE JANEIRO/2026
 * (Portaria MPS de fatores — tabela mensal). Para outra data-base, carregar a tabela
 * correspondente via `aplicarAtualizacao(..., { tabelaFatores })`.
 */
export const FATORES_2026_01: Record<string, number> = fatoresJson;
