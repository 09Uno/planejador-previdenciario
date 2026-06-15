// ROI previdenciário — metodologia Machado Filgueiras (planilhas ROI dos casos):
// ganho líquido vitalício (13 pagamentos/ano, IR antes/depois dos 65 anos com
// isenção extra) menos investimentos (contribuições futuras + débitos +
// benefício não recebido ao adiar a DER).
import { calcularIRMensal } from './irpf.js';
import { TABUA_IBGE_2024 } from './params.js';

const round2 = (x: number) => Math.round(x * 100) / 100;

export interface EntradaROI {
  rotulo: string;
  /** data da aposentadoria (DER/DIB) */
  dataAposentadoria: string;
  /** idade na DER em anos (fracionário) */
  idadeNaDER: number;
  rmiBruta: number;
  /** contribuição mensal futura (R$) e nº de meses até a DER */
  contribuicaoMensal: number;
  mesesContribuicao: number;
  /** débito a quitar (indenizações/complementações) */
  debitoQuitar?: number;
  /** benefício que deixa de receber ao adiar a DER (custo de oportunidade) */
  beneficioNaoRecebido?: number;
  /** tábua de sobrevida (default IBGE 2024) */
  tabuaEs?: Record<number, number>;
}

export interface ResultadoROI {
  rotulo: string;
  dataAposentadoria: string;
  idadeNaDER: number;
  rmiBruta: number;
  expectativaSobrevidaNaDER: number;
  // fase até 65
  irMensalAte65: number;
  rmiLiquidaAte65: number;
  anosAte65: number;
  ganhoAte65: number;
  // fase 65+
  irMensalApos65: number;
  rmiLiquidaApos65: number;
  sobrevidaApos65: number;
  ganhoApos65: number;
  ganhoTotal: number;
  // investimentos
  totalContribuicoes: number;
  debitoQuitar: number;
  beneficioNaoRecebido: number;
  totalInvestimentos: number;
  roiLiquido: number;
}

export function calcularROI(e: EntradaROI): ResultadoROI {
  const tabua = e.tabuaEs ?? TABUA_IBGE_2024;
  const idadeInt = Math.min(75, Math.max(45, Math.floor(e.idadeNaDER)));
  const es = tabua[idadeInt] ?? 18;

  const anosAte65 = Math.max(0, 65 - e.idadeNaDER);
  const irAte65 = calcularIRMensal(e.rmiBruta);
  const liqAte65 = e.rmiBruta - irAte65;
  const ganhoAte65 = liqAte65 * 13 * anosAte65;

  const irApos65 = calcularIRMensal(e.rmiBruta, { isencao65: true });
  const liqApos65 = e.rmiBruta - irApos65;
  const sobrevidaApos65 = e.idadeNaDER >= 65 ? es : (tabua[65] ?? 18.9);
  const ganhoApos65 = liqApos65 * 13 * sobrevidaApos65;

  const totalContribuicoes = e.contribuicaoMensal * e.mesesContribuicao;
  const debito = e.debitoQuitar ?? 0;
  const naoRecebido = e.beneficioNaoRecebido ?? 0;
  const totalInvestimentos = totalContribuicoes + debito + naoRecebido;
  const ganhoTotal = ganhoAte65 + ganhoApos65;

  return {
    rotulo: e.rotulo, dataAposentadoria: e.dataAposentadoria, idadeNaDER: e.idadeNaDER,
    rmiBruta: round2(e.rmiBruta), expectativaSobrevidaNaDER: es,
    irMensalAte65: irAte65, rmiLiquidaAte65: round2(liqAte65),
    anosAte65: Math.round(anosAte65 * 10) / 10, ganhoAte65: round2(ganhoAte65),
    irMensalApos65: irApos65, rmiLiquidaApos65: round2(liqApos65),
    sobrevidaApos65, ganhoApos65: round2(ganhoApos65),
    ganhoTotal: round2(ganhoTotal),
    totalContribuicoes: round2(totalContribuicoes), debitoQuitar: debito,
    beneficioNaoRecebido: naoRecebido, totalInvestimentos: round2(totalInvestimentos),
    roiLiquido: round2(ganhoTotal - totalInvestimentos),
  };
}

export interface Comparativo {
  a: ResultadoROI;
  b: ResultadoROI;
  diferencaROI: number;
  vencedor: string;
}

export function compararROI(a: ResultadoROI, b: ResultadoROI): Comparativo {
  const diferencaROI = round2(a.roiLiquido - b.roiLiquido);
  return { a, b, diferencaROI, vencedor: diferencaROI >= 0 ? a.rotulo : b.rotulo };
}

/** Comparativos encadeados A→B→C... como nas planilhas do escritório. */
export function comparativosEncadeados(cenarios: ResultadoROI[]): Comparativo[] {
  const out: Comparativo[] = [];
  if (cenarios.length < 2) return out;
  let atual = cenarios[0];
  for (let i = 1; i < cenarios.length; i++) {
    const c = compararROI(atual, cenarios[i]);
    out.push(c);
    atual = c.vencedor === c.a.rotulo ? c.a : c.b;
  }
  return out;
}
