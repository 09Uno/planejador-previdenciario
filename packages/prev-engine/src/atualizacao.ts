import { compKey } from './dates.js';
import { TETOS_HISTORICOS, FATORES_2026_01 } from './params.js';
import type { Competencia } from './types.js';

export interface OpcoesAtualizacao {
  /** tabela de fatores por competência (data-base específica). Default: FATORES_2026_01 */
  tabelaFatores?: Record<string, number>;
  /** tabela de tetos por competência. Default: TETOS_HISTORICOS */
  tabelaTetos?: Record<string, number>;
  /** competências sem fator na tabela recebem 1,0 (projeções futuras) */
  fatorPadrao?: number;
  /** se true, gera aviso (não erro) para competências históricas sem fator. Default: true */
  alertarFatorAusente?: boolean;
  /** competência a partir da qual fator 1.0 é legítimo (projeções). Default: mês corrente */
  competenciaProjecaoDesde?: string;
}

export interface AvisoAtualizacao {
  competencia: string;
  tipo: 'fator-ausente';
  mensagem: string;
}

const round2 = (x: number) => Math.round(x * 100) / 100;

/**
 * Aplica teto e atualização monetária a cada competência:
 *   salarioConsiderado = min(salarioContribuicao, tetoCompetencia)
 *   salarioCorrigido   = round2(salarioConsiderado × índice)
 * Prioridade dos valores: o que vier preenchido na competência > tabela > padrão.
 */
/**
 * Aplica teto e atualização monetária a cada competência.
 * Retorna as competências corrigidas. avisos: informar ao caller sobre fatores ausentes.
 */
export function aplicarAtualizacao(comps: Competencia[], opts: OpcoesAtualizacao = {}): Competencia[] {
  const fatores = opts.tabelaFatores ?? FATORES_2026_01;
  const tetos = opts.tabelaTetos ?? TETOS_HISTORICOS;
  const fatorPadrao = opts.fatorPadrao ?? 1.0;

  // Determinar competência a partir da qual fator 1.0 é legítimo (projeções futuras)
  let projecaoDesde: number;
  if (opts.competenciaProjecaoDesde) {
    projecaoDesde = compKey(opts.competenciaProjecaoDesde);
  } else {
    const agora = new Date();
    projecaoDesde = (agora.getFullYear()) * 12 + (agora.getMonth() + 1);
  }

  return comps.map(c => {
    const teto = c.tetoCompetencia ?? tetos[c.competencia];
    const considerado = teto != null ? Math.min(c.salarioContribuicao, teto) : c.salarioContribuicao;
    const fatorTabela = c.indice ?? fatores[c.competencia];
    const ck = compKey(c.competencia);

    let indice: number;
    if (fatorTabela != null) {
      indice = fatorTabela;
    } else if (ck >= projecaoDesde) {
      // Competência futura/projetada: fator 1.0 é legítimo
      indice = fatorPadrao;
    } else {
      // Competência histórica sem fator na tabela: usar fator padrão com marcação
      // O aviso é propagado via campo _avisoFator na competência retornada
      indice = fatorPadrao;
      return {
        ...c, tetoCompetencia: teto, indice, salarioConsiderado: considerado,
        salarioCorrigido: round2(considerado * indice),
        _avisoFator: `Competência ${c.competencia}: tabela de fatores sem cobertura — usando fator 1,0 (resultado pode estar incorreto). Atualize a tabela de fatores.`,
      } as Competencia & { _avisoFator: string };
    }
    return { ...c, tetoCompetencia: teto, indice, salarioConsiderado: considerado, salarioCorrigido: round2(considerado * indice) };
  }).sort((a, b) => compKey(a.competencia) - compKey(b.competencia));
}

/** Extrai avisos de fator ausente das competências processadas por aplicarAtualizacao. */
export function extrairAvisosFator(comps: Competencia[]): string[] {
  return (comps as (Competencia & { _avisoFator?: string })[])
    .filter(c => c._avisoFator)
    .map(c => c._avisoFator!);
}

/** Parse de tabela de fatores em CSV simples: "MM/AAAA;1,234567" por linha. */
export function parseTabelaFatoresCSV(texto: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const raw of texto.split(/\r?\n/)) {
    const m = raw.trim().match(/^(\d{2}\/\d{4})[;,\t]\s*([\d.,]+)$/);
    if (!m) continue;
    out[m[1]] = parseFloat(m[2].replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'));
  }
  return out;
}
