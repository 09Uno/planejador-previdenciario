export type Sexo = 'M' | 'F';

export interface Periodo {
  ini: number;
  fim: number;
  desc?: string;
  tipo?: 'normal' | 'especial';
  /** Grau da atividade especial: 15, 20 ou 25 anos. Default 25 se tipo === 'especial'. */
  grauEspecial?: 15 | 20 | 25;
}

/** Uma competência do PBC (período básico de cálculo, desde 07/1994). */
export interface Competencia {
  /** "MM/AAAA" */
  competencia: string;
  /** dias de contribuição dentro da competência (1-31) */
  dias: number;
  /** salário de contribuição nominal */
  salarioContribuicao: number;
  /** teto vigente na competência (se ausente, busca na tabela) */
  tetoCompetencia?: number;
  /** fator de atualização monetária até a data-base (se ausente, busca na tabela) */
  indice?: number;
  /** preenchido pelo motor: min(salário, teto) */
  salarioConsiderado?: number;
  /** preenchido pelo motor: considerado × índice */
  salarioCorrigido?: number;
  /** marcada como descartada (art. 26, §6º, EC 103) */
  descartado?: boolean;
}

export interface ParametrosVigentes {
  /** salário mínimo vigente na data do cálculo (piso da RMI) */
  salarioMinimo: number;
  /** teto RGPS vigente na data do cálculo (limite da RMI) */
  teto: number;
  /** divisor mínimo (art. 135-A, Lei 8.213): 108. Aplicado apenas se `aplicarDivisorMinimo`. */
  divisorMinimo: number;
  /** expectativa de sobrevida por idade (tábua IBGE vigente) */
  tabuaEs: Record<number, number>;
}

export type TipoCalculo = 'media80' | 'media80_fator' | 'media100' | 'media100_fator' | 'media100_coef';

export interface Regra {
  id: string;
  nome: string;
  fundamento: string;
  cumprida: boolean;
  data: number | null;
  detalhe: string;
  calc: TipoCalculo;
}
