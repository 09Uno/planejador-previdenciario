// IRPF mensal 2026 — tabela progressiva (mantida de 2025) + redutor da
// Lei 15.270/2025 (isenção até R$ 5.000; redução parcial até R$ 7.350)
// + isenção extra do aposentado 65+ (R$ 1.903,98/mês).
// Fonte: Receita Federal / gov.br (jan/2026).

export interface FaixaIR { ate: number; aliquota: number; deducao: number; }

export const TABELA_IRPF_MENSAL_2026: FaixaIR[] = [
  { ate: 2428.80, aliquota: 0, deducao: 0 },
  { ate: 2826.65, aliquota: 0.075, deducao: 182.16 },
  { ate: 3751.05, aliquota: 0.15, deducao: 394.16 },
  { ate: 4664.68, aliquota: 0.225, deducao: 675.49 },
  { ate: Infinity, aliquota: 0.275, deducao: 908.73 },
];

export const DESCONTO_SIMPLIFICADO_MENSAL_2026 = 607.20;
export const ISENCAO_EXTRA_65_MAIS = 1903.98;

export interface OpcoesIR {
  /** aposentado com 65 anos ou mais (isenção extra de R$ 1.903,98) */
  isencao65?: boolean;
  /** aplica desconto simplificado mensal (padrão: sim) */
  descontoSimplificado?: boolean;
  tabela?: FaixaIR[];
}

/**
 * IR mensal sobre rendimento tributável (ex.: RMI bruta).
 * Aplica: isenção 65+ → desconto simplificado → tabela → redutor Lei 15.270/2025.
 */
export function calcularIRMensal(rendimentoMensal: number, opts: OpcoesIR = {}): number {
  const tabela = opts.tabela ?? TABELA_IRPF_MENSAL_2026;
  let base = rendimentoMensal;
  if (opts.isencao65) base -= ISENCAO_EXTRA_65_MAIS;
  if (opts.descontoSimplificado !== false) base -= DESCONTO_SIMPLIFICADO_MENSAL_2026;
  if (base <= 0) return 0;

  const faixa = tabela.find(f => base <= f.ate)!;
  let imposto = base * faixa.aliquota - faixa.deducao;
  if (imposto <= 0) return 0;

  // Redutor Lei 15.270/2025 sobre os rendimentos tributáveis mensais
  const r = rendimentoMensal;
  let redutor = 0;
  if (r <= 5000) redutor = 312.89;
  else if (r <= 7350) redutor = Math.max(0, 978.62 - 0.133145 * r);
  imposto = Math.max(0, imposto - redutor);
  return Math.round(imposto * 100) / 100;
}
