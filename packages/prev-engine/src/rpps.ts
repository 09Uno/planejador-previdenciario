// ===================================================================
// RPPS — Regime Próprio de Previdência Social (parametrizado por ente)
// Implementação: Estado de São Paulo (LC 1.354/2020 e LC 1.380/2022)
// ===================================================================
import { DAY, dt, fmtBR, idadeAnos, yearOf, atingiuIdade, diasParaAMD, fmtAMD, tcAnos } from './dates.js';
import { diasAte, diasProjetados, ultimoFim } from './periodos.js';
import { primeiraData, EC103, VESPERA } from './regras.js';
import type { Periodo, Regra, Sexo } from './types.js';

// ===================================================================
// Parâmetros do ente
// ===================================================================

export interface ParametrosRPPS {
  ente: string;
  /** Regra permanente: idade mínima por sexo */
  idadePermanente: Record<Sexo, number>;
  /** Regra permanente: TC total mínimo */
  tcPermanente: number;
  /** Tempo mínimo no serviço público */
  tempoServPublico: number;
  /** Tempo mínimo no cargo */
  tempoCargo: number;
  /** Transição por pontos: base (2019) por sexo */
  pontosTransicaoBase: Record<Sexo, number>;
  /** Progressão de pontos por ano */
  pontosProgressao: number;
  /** Cap de pontos por sexo */
  pontosCap: Record<Sexo, number>;
  /** Idade mínima da transição por pontos, por sexo e ano de atingimento */
  idadeMinTransicao: Record<Sexo, number>;
  /** Coeficiente: base (ex.: 0.60 = 60%) */
  coefBase: number;
  /** Anos de TC acima dos quais soma 2% por ano */
  coefAcimaDe: number;
  /** Se o ente permite integralidade para ingresso até 31/12/2003 */
  permiteIntegralidade: boolean;
  /** Data limite de ingresso para integralidade */
  integralidadeAte?: number;
  /** Contribuição do inativo: alíquota sobre excedente do teto RGPS */
  aliquotaInativo?: number;
  /** Teto RGPS vigente (para cálculo da contribuição do inativo) */
  tetoRGPS?: number;
}

// ===================================================================
// SP-Estado (LC 1.354/2020)
// ===================================================================

/**
 * Parâmetros do RPPS do Estado de São Paulo.
 * Fonte: LC 1.354/2020 (ALESP), LC 1.380/2022 (contribuição do inativo).
 *
 * Pontuação art. 10 — CONFIRMADO no texto da ALESP (06/2026):
 *   Base 2019: F 86 / M 96 (mesma da EC 103 art. 15)
 *   §2º: "a partir de 1º de janeiro de 2020, acréscimo de 1 ponto por ano"
 *   Cap: F 100 / M 105
 *   2026: 86+7 = 93 (F) / 96+7 = 103 (M) ← CORRETO
 *   Fonte: al.sp.gov.br/repositorio/legislacao/lei.complementar/2020/lei.complementar-1354-06.03.2020.html
 *
 * Idade mínima transição: F 57 / M 62 — fixas desde 2022 (art. 10, §1º).
 * Integralidade: ingresso até 31/12/2003, com idade do §6º (art. 10).
 */
export const RPPS_SP: ParametrosRPPS = {
  ente: 'Estado de São Paulo',
  idadePermanente: { M: 65, F: 62 },
  tcPermanente: 25,
  tempoServPublico: 10,
  tempoCargo: 5,
  pontosTransicaoBase: { M: 96, F: 86 },
  pontosProgressao: 1,
  pontosCap: { M: 105, F: 100 },
  idadeMinTransicao: { M: 62, F: 57 },
  coefBase: 0.60,
  coefAcimaDe: 20,
  permiteIntegralidade: true,
  // LC 1.380/2022: 16% sobre o que excede o teto RGPS
  aliquotaInativo: 0.16,
  tetoRGPS: 8475.55,
};
RPPS_SP.integralidadeAte = dt(31, 12, 2003);

// ===================================================================
// Funções de cálculo RPPS
// ===================================================================

/** Pontos exigidos na transição por pontos (art. 10, LC 1.354/2020). */
export function pontosTransicaoRPPS(params: ParametrosRPPS, ano: number, sexo: Sexo): number {
  const base = params.pontosTransicaoBase[sexo];
  const cap = params.pontosCap[sexo];
  return Math.min(base + Math.max(0, ano - 2019) * params.pontosProgressao, cap);
}

/** Coeficiente RPPS: 60% + 2% por ano acima de 20 (padrão). */
export function coefRPPS(params: ParametrosRPPS, tcAnos: number): number {
  const excedente = Math.max(0, tcAnos - params.coefAcimaDe);
  return Math.min(1, params.coefBase + 0.02 * excedente);
}

/**
 * Média RPPS: 100% dos salários de contribuição, SEM teto RGPS.
 * Diferente do RGPS que usa teto.
 */
export function mediaRPPS(salarios: number[]): number {
  if (!salarios.length) return 0;
  return salarios.reduce((a, b) => a + b, 0) / salarios.length;
}

/**
 * Calcula RMI no RPPS.
 * tipo: 'coeficiente' (média × coeficiente) ou 'integralidade' (última remuneração).
 */
export function calcularRMI_RPPS(opts: {
  tipo: 'coeficiente' | 'integralidade';
  salarios: number[];
  tcAnos: number;
  ultimaRemuneracao?: number;
  params: ParametrosRPPS;
}): { rmi: number; media: number; coeficiente: number | null; tipo: string } {
  if (opts.tipo === 'integralidade') {
    const rmi = opts.ultimaRemuneracao ?? 0;
    return { rmi, media: rmi, coeficiente: null, tipo: 'Integralidade (última remuneração)' };
  }
  const media = mediaRPPS(opts.salarios);
  const coef = coefRPPS(opts.params, opts.tcAnos);
  const rmi = Math.round(media * coef * 100) / 100;
  return { rmi, media: Math.round(media * 100) / 100, coeficiente: coef, tipo: `Média × ${(coef * 100).toFixed(0)}%` };
}

/**
 * Contribuição do inativo (LC 1.380/2022, SP).
 * Alíquota de 16% sobre o que excede o teto RGPS.
 */
export function contribuicaoInativo(beneficio: number, params: ParametrosRPPS): number {
  const teto = params.tetoRGPS ?? 8475.55;
  const aliq = params.aliquotaInativo ?? 0.16;
  const base = Math.max(0, beneficio - teto);
  return Math.round(base * aliq * 100) / 100;
}

/**
 * Abono de permanência: servidor que cumpre requisitos mas permanece em atividade
 * recebe de volta a contribuição previdenciária. Valor = contribuição mensal do servidor.
 */
export function abonoPermanencia(remuneracao: number, aliquotaServidor: number = 0.14): number {
  return Math.round(remuneracao * aliquotaServidor * 100) / 100;
}

// ===================================================================
// avaliarRegrasRPPS — análogo ao avaliarRegras do RGPS
// ===================================================================

export interface CtxAvaliacaoRPPS {
  sexo: Sexo;
  nasc: number;
  merged: Periodo[];
  hoje: number;
  continuaContribuindo?: boolean;
  params: ParametrosRPPS;
  /** Data de ingresso no serviço público */
  ingressoServPublico: number;
  /** Data de ingresso no cargo atual */
  ingressoCargo: number;
}

export function avaliarRegrasRPPS(ctx: CtxAvaliacaoRPPS): { regras: Regra[] } {
  const { sexo, nasc, merged, hoje, params } = ctx;
  const cont = ctx.continuaContribuindo !== false;
  const base = Math.min(ultimoFim(merged) ?? hoje, hoje);

  const TC = (t: number) => tcAnos(cont ? diasProjetados(merged, base, t) : diasAte(merged, t));
  const ID = (t: number) => idadeAnos(nasc, t);
  const tempoServ = (t: number) => (t - ctx.ingressoServPublico) / (365.25 * DAY);
  const tempoCargo = (t: number) => (t - ctx.ingressoCargo) / (365.25 * DAY);

  const res: Regra[] = [];

  // ---- Regra permanente (art. 2º, III, LC 1.354/2020) ----
  {
    const idMin = params.idadePermanente[sexo];
    const cond = (t: number) =>
      TC(t) >= params.tcPermanente &&
      atingiuIdade(nasc, t, idMin) &&
      tempoServ(t) >= params.tempoServPublico &&
      tempoCargo(t) >= params.tempoCargo;
    const d = primeiraData(cond, EC103);
    res.push({
      id: 'rpps_perm', nome: `RPPS ${params.ente} — Permanente (art. 2º, III)`,
      fundamento: 'LC 1.354/2020, art. 2º, III', cumprida: cond(hoje), data: d,
      detalhe: d
        ? `Idade ${idMin} + ${params.tcPermanente} TC + ${params.tempoServPublico} serv. público + ${params.tempoCargo} cargo em ${fmtBR(d)}. Coeficiente: 60% + 2%/ano acima de ${params.coefAcimaDe}.`
        : 'Não alcançada.',
      calc: 'media100_coef',
    });
  }

  // ---- Transição por pontos (art. 10, LC 1.354/2020) ----
  {
    const idMin = params.idadeMinTransicao[sexo];
    const cond = (t: number) => {
      const tc = TC(t);
      return tc >= params.tcPermanente &&
        atingiuIdade(nasc, t, idMin) &&
        tempoServ(t) >= params.tempoServPublico &&
        tempoCargo(t) >= params.tempoCargo &&
        (tc + ID(t)) >= pontosTransicaoRPPS(params, yearOf(t), sexo);
    };
    const d = primeiraData(cond, EC103);
    res.push({
      id: 'rpps_pontos', nome: `RPPS ${params.ente} — Transição por pontos (art. 10)`,
      fundamento: 'LC 1.354/2020, art. 10', cumprida: cond(hoje), data: d,
      detalhe: d
        ? `Pontos ${(TC(d) + ID(d)).toFixed(1)} ≥ ${pontosTransicaoRPPS(params, yearOf(d), sexo)} em ${yearOf(d)}, idade ${ID(d).toFixed(1)} ≥ ${idMin}, serv. público ≥ ${params.tempoServPublico}, cargo ≥ ${params.tempoCargo}. ${params.permiteIntegralidade && ctx.ingressoServPublico <= (params.integralidadeAte ?? 0) ? 'Elegível a integralidade/paridade.' : 'Coeficiente: 60% + 2%/ano.'}`
        : 'Não alcançada.',
      calc: 'media100_coef',
    });
  }

  // ---- Pedágio (art. 11, LC 1.354/2020) ----
  {
    const tcMinPed = sexo === 'M' ? 35 : 30;
    const idMinPed = sexo === 'M' ? 62 : 57;
    const diasNaEC = diasAte(merged, VESPERA);
    const faltavaDias = Math.max(0, Math.round(tcMinPed * 365) - diasNaEC);
    const alvoDias = Math.round(tcMinPed * 365) + faltavaDias; // 100% pedágio
    const cond = (t: number) => {
      const dd = cont ? diasProjetados(merged, base, t) : diasAte(merged, t);
      return dd >= alvoDias &&
        atingiuIdade(nasc, t, idMinPed) &&
        tempoServ(t) >= 20 &&
        tempoCargo(t) >= 5;
    };
    const d = primeiraData(cond, EC103);
    res.push({
      id: 'rpps_pedagio', nome: `RPPS ${params.ente} — Pedágio 100% (art. 11)`,
      fundamento: 'LC 1.354/2020, art. 11', cumprida: cond(hoje), data: d,
      detalhe: d
        ? `Idade ${idMinPed} + TC ${tcMinPed} + pedágio ${fmtAMD(diasParaAMD(faltavaDias))} + 20 serv. público + 5 cargo em ${fmtBR(d)}.`
        : 'Não alcançada.',
      calc: 'media100',
    });
  }

  // ---- Especial RPPS (art. 13, LC 1.354/2020) — 86 pontos + 25 exposição ----
  {
    const cond = (t: number) => {
      const tc = TC(t);
      return tc >= 25 && (tc + ID(t)) >= 86;
    };
    const d = primeiraData(cond, EC103);
    res.push({
      id: 'rpps_especial', nome: `RPPS ${params.ente} — Especial (art. 13)`,
      fundamento: 'LC 1.354/2020, art. 13', cumprida: cond(hoje), data: d,
      detalhe: d
        ? `86 pontos (TC + idade) + 25 anos de exposição em ${fmtBR(d)}.`
        : 'Não alcançada (exige 25 anos exposição + 86 pontos).',
      calc: 'media100_coef',
    });
  }

  return { regras: res };
}
