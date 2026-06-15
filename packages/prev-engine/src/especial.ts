// ===================================================================
// ATIVIDADE ESPECIAL — conversão especial→comum e regras de aposentadoria
// Fonte: art. 57/58 Lei 8.213/91, art. 25 §2º EC 103/2019,
//        art. 70 Dec. 3.048/99, arts. 19 §1º e 21 EC 103/2019.
// ===================================================================
import { DAY, dt } from './dates.js';
import type { Periodo, Sexo } from './types.js';

/** EC 103 vigência — limite da conversão especial→comum. */
const EC103 = dt(13, 11, 2019);
const VESPERA = dt(12, 11, 2019);

/**
 * Fatores de conversão especial→comum (art. 70, Dec. 3.048/99).
 * multiplicador[grau][sexo] = fator para converter tempo especial em comum.
 * Ex.: 25 anos especial → 35 comum (H) = 35/25 = 1.40
 *      25 anos especial → 30 comum (M) = 30/25 = 1.20
 */
export const FATOR_CONVERSAO: Record<number, Record<Sexo, number>> = {
  15: { M: 35 / 15, F: 30 / 15 },  // 2.3333 / 2.0
  20: { M: 35 / 20, F: 30 / 20 },  // 1.75   / 1.50
  25: { M: 35 / 25, F: 30 / 25 },  // 1.40   / 1.20
};

/**
 * Calcula dias de contribuição com conversão especial→comum.
 * Períodos especiais até 12/11/2019 têm seus dias multiplicados pelo fator.
 * Períodos especiais após EC 103 NÃO são convertidos (art. 25, §2º, EC 103).
 *
 * Retorna { diasConvertidos, diasEspeciais, diasComuns }.
 */
export function diasComConversao(
  periodos: Periodo[],
  sexo: Sexo,
  corte: number,
): { diasConvertidos: number; diasEspeciais: number; diasComuns: number } {
  let diasEspeciais = 0;
  let diasComuns = 0;
  let diasConvertidos = 0;

  for (const p of periodos) {
    if (p.ini > corte) break;
    const fim = Math.min(p.fim, corte);
    const dias = Math.round((fim - p.ini) / DAY) + 1;

    if (p.tipo === 'especial') {
      diasEspeciais += dias;
      const grau = p.grauEspecial ?? 25;
      const fator = FATOR_CONVERSAO[grau]?.[sexo] ?? FATOR_CONVERSAO[25][sexo];
      // Conversão só para períodos até 12/11/2019
      const fimConversao = Math.min(fim, VESPERA);
      if (p.ini <= VESPERA) {
        const diasConv = Math.round((fimConversao - p.ini) / DAY) + 1;
        const diasPos = dias - diasConv;
        diasConvertidos += Math.round(diasConv * fator) + diasPos;
      } else {
        // Período especial inteiramente pós-EC: conta normal (sem conversão)
        diasConvertidos += dias;
      }
    } else {
      diasComuns += dias;
      diasConvertidos += dias;
    }
  }

  return { diasConvertidos, diasEspeciais, diasComuns };
}

/**
 * Aplica fator de conversão nos dias da competência do PBC.
 * Nos documentos reais, as competências de período especial
 * já saem com dias CONVERTIDOS (ex.: 30 × 1.2 = 36 para mulher grau 25).
 */
export function diasConvertidosCompetencia(
  dias: number,
  sexo: Sexo,
  grau: 15 | 20 | 25 = 25,
): number {
  const fator = FATOR_CONVERSAO[grau]?.[sexo] ?? FATOR_CONVERSAO[25][sexo];
  return Math.round(dias * fator);
}

// ===================================================================
// Regras de aposentadoria especial
// ===================================================================

/** Tempo mínimo de exposição (todo especial) por grau. */
export const TC_MINIMO_ESPECIAL: Record<number, number> = {
  15: 15,
  20: 20,
  25: 25,
};

/**
 * Art. 19, §1º, EC 103 — Regra permanente de aposentadoria especial.
 * Idade mínima por grau: 55 (grau 15), 58 (grau 20), 60 (grau 25).
 */
export const IDADE_MINIMA_ESPECIAL_PERMANENTE: Record<number, number> = {
  15: 55,
  20: 58,
  25: 60,
};

/**
 * Art. 21, EC 103 — Transição da aposentadoria especial.
 * Pontuação fixa (sem progressão): 66 (grau 15), 76 (grau 20), 86 (grau 25).
 * + tempo mínimo de efetiva exposição igual ao grau.
 */
export const PONTOS_TRANSICAO_ESPECIAL: Record<number, number> = {
  15: 66,
  20: 76,
  25: 86,
};

// ===================================================================
// Enquadramento por categoria profissional — até 28/04/1995
// Fonte: Dec. 53.831/64 Anexo III e Dec. 83.080/79.
// Estrutura extensível: código → { descrição, grau, fonte }.
// ===================================================================
export interface CategoriaEspecial {
  codigo: string;
  descricao: string;
  grau: 15 | 20 | 25;
  fonte: string;
}

/**
 * Tabela de enquadramento por categoria profissional (exemplos dos pareceres).
 * Válida para períodos até 28/04/1995 (data da Lei 9.032/95).
 * Após essa data, exige-se laudo/PPP individual.
 */
export const CATEGORIAS_ESPECIAIS: CategoriaEspecial[] = [
  {
    codigo: '2.4.1',
    descricao: 'Aeronautas (tripulantes de aeronaves)',
    grau: 25,
    fonte: 'Dec. 53.831/64, Anexo III, código 2.4.1',
  },
  {
    codigo: '2.1.3',
    descricao: 'Médicos, dentistas, enfermeiros e demais profissionais da área de saúde',
    grau: 25,
    fonte: 'Dec. 53.831/64, Anexo III, código 2.1.3',
  },
  {
    codigo: '1.1.6',
    descricao: 'Trabalhadores expostos a ruído acima dos limites de tolerância',
    grau: 25,
    fonte: 'Dec. 53.831/64, Anexo I, código 1.1.6; Dec. 83.080/79, Anexo I',
  },
  {
    codigo: '1.2.11',
    descricao: 'Trabalhadores expostos a hidrocarbonetos e derivados de carbono',
    grau: 25,
    fonte: 'Dec. 53.831/64, Anexo I, código 1.2.11; Dec. 83.080/79, Anexo I, código 1.2.11',
  },
];

/** Data limite para enquadramento por categoria profissional (Lei 9.032/95). */
export const LIMITE_ENQUADRAMENTO_CATEGORIA = dt(28, 4, 1995);
