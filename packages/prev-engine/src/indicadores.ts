// Dicionário de indicadores do CNIS e auditoria de pendências.
// Fonte: legenda do Extrato CNIS + prática dos pareceres do escritório.
import { parseBR, DAY } from './dates.js';
import type { ResultadoCNIS } from './cnis.js';

export type Severidade = 'alta' | 'media' | 'baixa';

export interface InfoIndicador {
  significado: string;
  providencia: string;
  severidade: Severidade;
}

export const DICIONARIO_INDICADORES: Record<string, InfoIndicador> = {
  'PREC-MENOR-MIN': {
    significado: 'Recolhimento com salário de contribuição abaixo do mínimo — não conta como tempo/carência até regularização.',
    providencia: 'Complementar a diferença (GPS cód. 1163) ou agrupar/utilizar competências (art. 216, §27-A, II e III, Dec. 3.048/99).',
    severidade: 'alta',
  },
  'PSC-MEN-SM-EC103': {
    significado: 'Salário de contribuição inferior ao mínimo após a EC 103 — competência não computada.',
    providencia: 'Complementação, utilização ou agrupamento (art. 29, EC 103; art. 216, §27-A, Dec. 3.048/99).',
    severidade: 'alta',
  },
  'PREM-EXT': {
    significado: 'Remuneração extemporânea (informada fora do prazo) — pendente de validação.',
    providencia: 'Convalidar com documentos contemporâneos: IRPF, recibos, contrato, RAIS.',
    severidade: 'alta',
  },
  'PEXT': {
    significado: 'Vínculo/remuneração extemporânea — pendente de comprovação.',
    providencia: 'Apresentar prova contemporânea do vínculo (CTPS, ficha de registro, contracheques).',
    severidade: 'alta',
  },
  'PREM-FVIN': {
    significado: 'Remuneração após o fim do vínculo informado.',
    providencia: 'Verificar data fim real do vínculo (CTPS/rescisão) e pedir acerto de vínculos.',
    severidade: 'media',
  },
  'IREC-INDPEND': {
    significado: 'Recolhimento de contribuinte individual com indicador de pendência.',
    providencia: 'Validar GPS/atividade no período; possível necessidade de comprovação de exercício.',
    severidade: 'media',
  },
  'IREM-INDPEND': {
    significado: 'Remuneração com pendência de validação.',
    providencia: 'Validar documentação do período.',
    severidade: 'media',
  },
  'IREM-ACD': {
    significado: 'Remuneração de acordo coletivo/decisão — verificar natureza.',
    providencia: 'Conferir se compõe salário de contribuição.',
    severidade: 'baixa',
  },
  'PADM-EMPR': {
    significado: 'Pendência administrativa do empregador.',
    providencia: 'Verificar regularidade do vínculo; declaração do empregador se necessário.',
    severidade: 'media',
  },
  'PREM-BLOQ-EC103': {
    significado: 'Contribuição com bloqueio para ajuste (EC 103).',
    providencia: 'Conferir tratamento no Meu INSS antes de usar no cálculo.',
    severidade: 'alta',
  },
  'AEXT-VI': {
    significado: 'Acerto extemporâneo de vínculo.',
    providencia: 'Confirmar homologação do acerto.',
    severidade: 'baixa',
  },
  // ---- Indicadores MEI / LC 123 ----
  'IREC-MEI': {
    significado: 'Recolhimento como Microempreendedor Individual (MEI) — alíquota reduzida de 5% sobre o salário mínimo. Não gera aposentadoria por tempo de contribuição (apenas por idade), salvo complementação.',
    providencia: 'Para contar como tempo de contribuição: complementar de 5% para 20% (GPS cód. 1910, diferença de 15% sobre o salário mínimo da competência). Sem complementação, conta apenas para aposentadoria por idade e carência.',
    severidade: 'alta',
  },
  'IREC-LC123': {
    significado: 'Recolhimento pelo Simples Nacional / LC 123/2006 — alíquota reduzida (11% ou 5%). Pode não gerar direito a aposentadoria por tempo de contribuição.',
    providencia: 'Verificar se o plano é simplificado (11%) ou MEI (5%). Se for 5%, complementar para 20% (diferença de 15%) via GPS cód. 1910. Se for 11%, complementar para 20% (diferença de 9%) via GPS cód. 1295.',
    severidade: 'alta',
  },
  'IREC-FACULTAT': {
    significado: 'Recolhimento como segurado facultativo.',
    providencia: 'Verificar se alíquota é plena (20%) ou simplificada (11%). Se simplificada, complementar para gerar TC.',
    severidade: 'baixa',
  },
};

export interface Pendencia {
  tipo: 'indicador' | 'vinculo-aberto' | 'lacuna' | 'sem-remuneracao';
  severidade: Severidade;
  titulo: string;
  detalhe: string;
  providencia: string;
}

/** Auditoria do CNIS: indicadores + vínculos abertos + lacunas entre vínculos. */
export function auditarCNIS(cnis: ResultadoCNIS, opts: { lacunaMinimaDias?: number } = {}): Pendencia[] {
  const out: Pendencia[] = [];
  const lacunaMin = opts.lacunaMinimaDias ?? 90;

  for (const ind of cnis.indicadores) {
    const info = DICIONARIO_INDICADORES[ind];
    out.push({
      tipo: 'indicador', severidade: info?.severidade ?? 'media',
      titulo: `Indicador ${ind}`,
      detalhe: info?.significado ?? 'Indicador não catalogado — consultar a legenda do extrato.',
      providencia: info?.providencia ?? 'Analisar manualmente.',
    });
  }

  for (const v of cnis.vinculos) {
    if (v.aberto) out.push({
      tipo: 'vinculo-aberto', severidade: 'media',
      titulo: `Vínculo seq. ${v.seq} sem data fim`,
      detalhe: `${v.origem} (início ${v.ini ?? '?'}) está aberto no CNIS.`,
      providencia: 'Confirmar se o vínculo está ativo; se encerrado, requerer acerto com CTPS/rescisão.',
    });
  }

  const ordenados = cnis.vinculos
    .filter(v => v.ini && v.fim)
    .map(v => ({ v, ini: parseBR(v.ini!)!, fim: parseBR(v.fim!)! }))
    .sort((a, b) => a.ini - b.ini);
  let fimMax: number | null = null;
  let vAnterior: string | null = null;
  for (const { v, ini, fim } of ordenados) {
    if (fimMax != null && ini - fimMax > lacunaMin * DAY) {
      const dias = Math.round((ini - fimMax) / DAY);
      out.push({
        tipo: 'lacuna', severidade: 'media',
        titulo: `Lacuna de ${Math.floor(dias / 30)} mês(es) entre vínculos`,
        detalhe: `Entre ${vAnterior} e ${v.origem}.`,
        providencia: 'Verificar atividade no período (CI? indenização art. 45-A? rural?). Possível estratégia de complementação.',
      });
    }
    if (fimMax == null || fim > fimMax) { fimMax = fim; vAnterior = v.origem; }
  }

  // Competências fora de qualquer período cadastrado
  if (cnis.competencias.length && cnis.vinculos.length) {
    const vincComDatas = cnis.vinculos.filter(v => v.ini && v.fim);
    for (const c of cnis.competencias) {
      const [mm, aaaa] = c.comp.split('/').map(Number);
      const compIni = Date.UTC(aaaa, mm - 1, 1);
      const compFim = Date.UTC(aaaa, mm, 0); // último dia do mês
      // Coberta se qualquer dia do mês intersecta o vínculo (vínculos que
      // começam/terminam no meio do mês cobrem a competência daquele mês)
      const coberta = vincComDatas.some(v => {
        const vIni = parseBR(v.ini!)!;
        const vFim = parseBR(v.fim!)!;
        return compFim >= vIni && compIni <= vFim;
      });
      if (!coberta) {
        out.push({
          tipo: 'sem-remuneracao', severidade: 'media',
          titulo: `Competência ${c.comp} fora de qualquer período`,
          detalhe: `Salário de R$ ${c.valor.toFixed(2)} em ${c.comp} não está coberto por nenhum vínculo cadastrado.`,
          providencia: 'Verificar se falta um período no CNIS (CI não declarado? vínculo omitido?) ou se é recolhimento avulso que exige período correspondente.',
        });
      }
    }
  }

  const ordem = { alta: 0, media: 1, baixa: 2 } as const;
  return out.sort((a, b) => ordem[a.severidade] - ordem[b.severidade]);
}
