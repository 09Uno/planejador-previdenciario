import { DAY, addDays, dt, fmtBR, idadeAnos, yearOf, atingiuIdade, diasParaAMD, fmtAMD, tcAnos } from './dates.js';
import { diasAte, diasProjetados, ultimoFim } from './periodos.js';
import { diasComConversao, PONTOS_TRANSICAO_ESPECIAL, IDADE_MINIMA_ESPECIAL_PERMANENTE, TC_MINIMO_ESPECIAL } from './especial.js';
import { pontosMinProfessor, idadeMinProgressivaProfessor, tcMinimoProfessor, IDADE_PEDAGIO100_PROFESSOR, IDADE_PERMANENTE_PROFESSOR, TC_PERMANENTE_PROFESSOR } from './professor.js';
import { TC_MINIMO_PCD, IDADE_MINIMA_PCD, TC_MINIMO_PCD_IDADE, coefPCDIdade, type GrauDeficiencia } from './pcd.js';
import type { Periodo, Regra, Sexo } from './types.js';

export const EC103 = dt(13, 11, 2019);
export const VESPERA = dt(12, 11, 2019);

export function tcMinimo(sexo: Sexo): number { return sexo === 'M' ? 35 : 30; }

/** Pontos exigidos pelo art. 15 da EC 103 no ano (2026: 93/103; caps 100/105). */
export function pontosMinimos(ano: number, sexo: Sexo): number {
  const base = sexo === 'M' ? 96 : 86;
  const cap = sexo === 'M' ? 105 : 100;
  return Math.min(base + Math.max(0, ano - 2019), cap);
}

/** Idade mínima do art. 16 no ano (2026: 59,5/64,5; caps 62/65). */
export function idadeMinimaArt16(ano: number, sexo: Sexo): number {
  const base = sexo === 'M' ? 61 : 56;
  const cap = sexo === 'M' ? 65 : 62;
  return Math.min(base + 0.5 * Math.max(0, ano - 2019), cap);
}

/** Idade mínima do art. 18 no ano (H: 65; M: progressiva até 62 em 2023). */
export function idadeMinimaArt18(ano: number, sexo: Sexo): number {
  if (sexo === 'M') return 65;
  return Math.min(60 + 0.5 * Math.max(0, ano - 2019), 62);
}

/** Pontuação 85/95 progressiva (Lei 13.183/2015) — para direito adquirido pré-EC. */
export function pontos8595(ano: number): { F: number; M: number } {
  if (ano <= 2018) return { F: 85, M: 95 };
  if (ano <= 2020) return { F: 86, M: 96 };
  if (ano <= 2022) return { F: 87, M: 97 };
  if (ano <= 2024) return { F: 88, M: 98 };
  if (ano <= 2026) return { F: 89, M: 99 };
  return { F: 90, M: 100 };
}

export interface CtxAvaliacao {
  sexo: Sexo;
  nasc: number;
  merged: Periodo[];
  hoje: number;
  continuaContribuindo?: boolean;
  /** Se presente, avalia também regras de aposentadoria especial para este grau. */
  grauEspecial?: 15 | 20 | 25;
  /** Se true, avalia regras de professor (magistério na educação básica). */
  professor?: boolean;
  /** Se presente, avalia regras de PCD (LC 142/2013) para este grau. */
  grauPCD?: GrauDeficiencia;
}

export function baseProjecao(ctx: CtxAvaliacao): number {
  const uf = ultimoFim(ctx.merged);
  if (uf == null) return ctx.hoje;
  return Math.min(Math.max(uf, ctx.hoje), ctx.hoje);
}

/** Primeira data em que cond(t) === true (passo mensal, refino diário). */
export function primeiraData(cond: (t: number) => boolean, inicio: number, limiteAnos = 45): number | null {
  const fim = addDays(inicio, Math.round(limiteAnos * 365.25));
  if (cond(inicio)) return inicio;
  let t = inicio;
  const passo = 30 * DAY;
  while (t < fim) {
    const prox = t + passo;
    if (cond(prox)) {
      let lo = t, hi = prox;
      while (hi - lo > DAY) {
        const mid = lo + Math.floor((hi - lo) / (2 * DAY)) * DAY;
        if (cond(mid)) hi = mid; else lo = mid;
      }
      return hi;
    }
    t = prox;
  }
  return null;
}

export interface ResultadoAvaliacao { regras: Regra[]; diasNaEC: number; base: number; }

export function avaliarRegras(ctx: CtxAvaliacao): ResultadoAvaliacao {
  const { sexo, nasc, merged, hoje } = ctx;
  const tcMin = tcMinimo(sexo);
  // Conversão especial→comum (art. 25, §2º, EC 103): o tempo especial até
  // 12/11/2019 entra CONVERTIDO (×1,4 H / ×1,2 F no grau 25) no TC das regras
  // comuns. O "bônus" é a diferença entre os dias convertidos e os dias brutos
  // do período pré-reforma — uma constante somada a todo TC daqui pra frente.
  const temEspecial = merged.some(p => p.tipo === 'especial');
  const bonusConv = temEspecial
    ? Math.max(0, diasComConversao(merged, sexo, VESPERA).diasConvertidos - diasAte(merged, VESPERA))
    : 0;
  const diasNaEC = diasAte(merged, VESPERA) + bonusConv;
  const tcNaEC = tcAnos(diasNaEC);
  const base = baseProjecao(ctx);
  const cont = ctx.continuaContribuindo !== false;

  const diasTC = (t: number) => (cont ? diasProjetados(merged, base, t) : diasAte(merged, t)) + bonusConv;
  const TC = (t: number) => tcAnos(diasTC(t));
  const ID = (t: number) => idadeAnos(nasc, t);

  const res: Regra[] = [];

  // ---- Direito adquirido (ATC pré-reforma) ----
  {
    const ok = tcNaEC >= tcMin;
    const idadeEC = idadeAnos(nasc, VESPERA);
    const p8595 = pontos8595(2019)[sexo];
    const pontosEC = tcNaEC + idadeEC;
    res.push({
      id: 'da', nome: 'Direito adquirido — ATC integral (pré-EC 103)',
      fundamento: 'Art. 201, §7º, I, CF; Lei 8.213/91; EC 103/2019, art. 3º',
      cumprida: ok, data: ok ? VESPERA : null,
      detalhe: ok
        ? `Em 12/11/2019 o tempo de contribuição era de ${fmtAMD(diasParaAMD(diasNaEC))} (mínimo: ${tcMin} anos). ` +
          (pontosEC >= p8595 ? `Pontuação ${pontosEC.toFixed(1)} ≥ ${p8595} (regra 85/95 progressiva): fator previdenciário afastável.`
            : `Pontuação ${pontosEC.toFixed(1)} < ${p8595}: cálculo com fator previdenciário.`)
        : `Em 12/11/2019 o tempo era de ${fmtAMD(diasParaAMD(diasNaEC))} — inferior a ${tcMin} anos.`,
      calc: ok && pontosEC >= p8595 ? 'media80' : 'media80_fator',
    });
  }

  // ---- Art. 15 — pontos ----
  {
    const cond = (t: number) => {
      const tc = TC(t);
      return tc >= tcMin && tc + ID(t) >= pontosMinimos(yearOf(t), sexo);
    };
    const d = primeiraData(cond, EC103);
    const cumpridaHoje = cond(hoje);
    res.push({
      id: 'art15', nome: 'Transição — Pontos (art. 15, EC 103)',
      fundamento: 'EC 103/2019, art. 15', cumprida: cumpridaHoje, data: d,
      detalhe: d ? `${cumpridaHoje ? 'Requisitos já cumpridos' : 'Projeção de implemento'} em ${fmtBR(d)}: ` +
        `TC ${TC(d).toFixed(1)} anos + idade ${ID(d).toFixed(1)} = ${(TC(d) + ID(d)).toFixed(1)} pontos (mínimo ${pontosMinimos(yearOf(d), sexo)} em ${yearOf(d)}).`
        : 'Não alcançada no horizonte de 45 anos.',
      calc: 'media100_coef',
    });
  }

  // ---- Art. 16 — idade progressiva ----
  {
    const cond = (t: number) => TC(t) >= tcMin && atingiuIdade(nasc, t, idadeMinimaArt16(yearOf(t), sexo));
    const d = primeiraData(cond, EC103);
    res.push({
      id: 'art16', nome: 'Transição — Idade mínima progressiva (art. 16, EC 103)',
      fundamento: 'EC 103/2019, art. 16', cumprida: cond(hoje), data: d,
      detalhe: d ? `${cond(hoje) ? 'Requisitos já cumpridos' : 'Projeção de implemento'} em ${fmtBR(d)}: TC ${TC(d).toFixed(1)} anos e idade ${ID(d).toFixed(1)} (mínima ${idadeMinimaArt16(yearOf(d), sexo).toFixed(1)} em ${yearOf(d)}).`
        : 'Não alcançada no horizonte de 45 anos.',
      calc: 'media100_coef',
    });
  }

  // ---- Art. 17 — pedágio 50% ----
  {
    const faltavaDias = Math.round(tcMin * 365) - diasNaEC;
    const elegivel = faltavaDias > 0 && faltavaDias <= Math.round(2 * 365);
    let d: number | null = null;
    if (elegivel) {
      const alvoDias = Math.round(tcMin * 365) + Math.ceil(faltavaDias * 0.5);
      const cond = (t: number) => diasTC(t) >= alvoDias;
      d = primeiraData(cond, EC103);
    }
    res.push({
      id: 'art17', nome: 'Transição — Pedágio de 50% (art. 17, EC 103)',
      fundamento: 'EC 103/2019, art. 17', cumprida: elegivel && d != null && d <= hoje, data: d,
      detalhe: elegivel
        ? `Faltavam ${fmtAMD(diasParaAMD(faltavaDias))} em 13/11/2019 (≤ 2 anos). Pedágio: ${fmtAMD(diasParaAMD(Math.ceil(faltavaDias * 0.5)))}. ` +
          (d ? `Implemento em ${fmtBR(d)}. Cálculo com fator previdenciário (verificar se favorável).` : 'Não alcançada.')
        : (faltavaDias <= 0 ? 'Inaplicável: tempo mínimo já cumprido antes da EC (ver direito adquirido).'
          : `Inaplicável: faltavam mais de 2 anos em 13/11/2019 (${fmtAMD(diasParaAMD(faltavaDias))}).`),
      calc: 'media100_fator',
    });
  }

  // ---- Art. 18 — idade ----
  {
    const cond = (t: number) => TC(t) >= 15 && atingiuIdade(nasc, t, idadeMinimaArt18(yearOf(t), sexo));
    const d = primeiraData(cond, EC103);
    res.push({
      id: 'art18', nome: 'Transição — Aposentadoria por idade (art. 18, EC 103)',
      fundamento: 'EC 103/2019, art. 18', cumprida: cond(hoje), data: d,
      detalhe: d ? `${cond(hoje) ? 'Requisitos já cumpridos' : 'Projeção de implemento'} em ${fmtBR(d)}: idade ${ID(d).toFixed(1)} (mínima ${idadeMinimaArt18(yearOf(d), sexo)}) e TC ${TC(d).toFixed(1)} anos (mínimo 15).`
        : 'Não alcançada no horizonte de 45 anos.',
      calc: 'media100_coef',
    });
  }

  // ---- Art. 20 — pedágio 100% ----
  {
    const faltavaDias = Math.max(0, Math.round(tcMin * 365) - diasNaEC);
    const idadeMin = sexo === 'M' ? 60 : 57;
    const alvoDias = Math.round(tcMin * 365) + faltavaDias;
    const cond = (t: number) => {
      const dd = diasTC(t);
      return dd >= alvoDias && atingiuIdade(nasc, t, idadeMin);
    };
    const d = primeiraData(cond, EC103);
    res.push({
      id: 'art20', nome: 'Transição — Pedágio de 100% (art. 20, EC 103)',
      fundamento: 'EC 103/2019, art. 20', cumprida: cond(hoje), data: d,
      detalhe: d ? `${cond(hoje) ? 'Requisitos já cumpridos' : 'Projeção de implemento'} em ${fmtBR(d)}: idade mínima ${idadeMin} anos + TC ${tcMin} anos + pedágio de ${fmtAMD(diasParaAMD(faltavaDias))}. Cálculo: 100% da média.`
        : 'Não alcançada no horizonte de 45 anos.',
      calc: 'media100',
    });
  }

  // ---- Regra permanente (referência) ----
  {
    const idMin = sexo === 'M' ? 65 : 62;
    const tcMinP = sexo === 'M' ? 20 : 15;
    const cond = (t: number) => TC(t) >= tcMinP && atingiuIdade(nasc, t, idMin);
    const d = primeiraData(cond, EC103);
    res.push({
      id: 'perm', nome: 'Regra permanente (art. 19, EC 103 — referência)',
      fundamento: 'EC 103/2019', cumprida: cond(hoje), data: d,
      detalhe: d ? `Idade ${idMin} + ${tcMinP} anos de TC em ${fmtBR(d)}.` : 'Não alcançada no horizonte de 45 anos.',
      calc: 'media100_coef',
    });
  }

  // ---- Regras de aposentadoria especial (se grauEspecial informado) ----
  if (ctx.grauEspecial) {
    const grau = ctx.grauEspecial;
    const tcMinEsp = TC_MINIMO_ESPECIAL[grau];
    const pontosEsp = PONTOS_TRANSICAO_ESPECIAL[grau];
    const idMinEsp = IDADE_MINIMA_ESPECIAL_PERMANENTE[grau];

    // TC especial: dias de efetiva exposição (não convertidos)
    const diasEspeciais = (t: number) => {
      let d = 0;
      for (const p of merged) {
        if (p.ini > t) break;
        if (p.tipo === 'especial') {
          d += Math.round((Math.min(p.fim, t) - p.ini) / DAY) + 1;
        }
      }
      return d;
    };
    const TCesp = (t: number) => tcAnos(diasEspeciais(t));

    // Art. 21 — Transição especial (pontos fixos)
    {
      const cond = (t: number) => {
        const tce = TCesp(t);
        return tce >= tcMinEsp && (tce + ID(t)) >= pontosEsp;
      };
      const d = primeiraData(cond, EC103);
      res.push({
        id: 'art21', nome: `Transição — Aposentadoria especial ${grau} anos (art. 21, EC 103)`,
        fundamento: 'EC 103/2019, art. 21', cumprida: cond(hoje), data: d,
        detalhe: d
          ? `${cond(hoje) ? 'Requisitos já cumpridos' : 'Projeção de implemento'} em ${fmtBR(d)}: TC especial ${TCesp(d).toFixed(1)} anos (mínimo ${tcMinEsp}) + idade ${ID(d).toFixed(1)} = ${(TCesp(d) + ID(d)).toFixed(1)} pontos (mínimo ${pontosEsp}).`
          : `Não alcançada no horizonte de 45 anos (exige ${tcMinEsp} anos de exposição + ${pontosEsp} pontos).`,
        calc: 'media100_coef',
      });
    }

    // Art. 19, §1º — Permanente especial
    {
      const cond = (t: number) => TCesp(t) >= tcMinEsp && atingiuIdade(nasc, t, idMinEsp);
      const d = primeiraData(cond, EC103);
      res.push({
        id: 'esp_perm', nome: `Permanente — Aposentadoria especial ${grau} anos (art. 19, §1º, EC 103)`,
        fundamento: 'EC 103/2019, art. 19, §1º', cumprida: cond(hoje), data: d,
        detalhe: d
          ? `${cond(hoje) ? 'Requisitos já cumpridos' : 'Projeção'} em ${fmtBR(d)}: TC especial ${TCesp(d).toFixed(1)} anos (mínimo ${tcMinEsp}) + idade ${ID(d).toFixed(1)} (mínima ${idMinEsp}).`
          : `Não alcançada (exige ${tcMinEsp} anos de exposição + ${idMinEsp} anos de idade).`,
        calc: 'media100_coef',
      });
    }
  }

  // ---- Regras de professor (se professor === true) ----
  if (ctx.professor) {
    const tcMinProf = tcMinimoProfessor(sexo);

    // Pontos professor (art. 15, §§ 3º e 4º)
    {
      const cond = (t: number) => {
        const tc = TC(t);
        return tc >= tcMinProf && tc + ID(t) >= pontosMinProfessor(yearOf(t), sexo);
      };
      const d = primeiraData(cond, EC103);
      res.push({
        id: 'prof_pontos', nome: 'Professor — Pontos (art. 15, §§ 3º/4º, EC 103)',
        fundamento: 'EC 103/2019, art. 15, §§ 3º e 4º', cumprida: cond(hoje), data: d,
        detalhe: d
          ? `${cond(hoje) ? 'Cumprida' : 'Projeção'} em ${fmtBR(d)}: TC ${TC(d).toFixed(1)} anos + idade ${ID(d).toFixed(1)} = ${(TC(d) + ID(d)).toFixed(1)} pontos (mínimo ${pontosMinProfessor(yearOf(d), sexo)} em ${yearOf(d)}).`
          : 'Não alcançada no horizonte.',
        calc: 'media100_coef',
      });
    }

    // Idade progressiva professor (art. 16, § 2º)
    {
      const cond = (t: number) => TC(t) >= tcMinProf && atingiuIdade(nasc, t, idadeMinProgressivaProfessor(yearOf(t), sexo));
      const d = primeiraData(cond, EC103);
      res.push({
        id: 'prof_idade', nome: 'Professor — Idade progressiva (art. 16, § 2º, EC 103)',
        fundamento: 'EC 103/2019, art. 16, § 2º', cumprida: cond(hoje), data: d,
        detalhe: d
          ? `${cond(hoje) ? 'Cumprida' : 'Projeção'} em ${fmtBR(d)}: TC ${TC(d).toFixed(1)} anos (mínimo ${tcMinProf}) e idade ${ID(d).toFixed(1)} (mínima ${idadeMinProgressivaProfessor(yearOf(d), sexo).toFixed(1)}).`
          : 'Não alcançada no horizonte.',
        calc: 'media100_coef',
      });
    }

    // Pedágio 100% professor (art. 20, § 1º)
    {
      const faltavaDias = Math.max(0, Math.round(tcMinProf * 365) - diasNaEC);
      const idadeMin = IDADE_PEDAGIO100_PROFESSOR[sexo];
      const alvoDias = Math.round(tcMinProf * 365) + faltavaDias;
      const cond = (t: number) => {
        const dd = cont ? diasProjetados(merged, base, t) : diasAte(merged, t);
        return dd >= alvoDias && atingiuIdade(nasc, t, idadeMin);
      };
      const d = primeiraData(cond, EC103);
      res.push({
        id: 'prof_ped100', nome: 'Professor — Pedágio 100% (art. 20, § 1º, EC 103)',
        fundamento: 'EC 103/2019, art. 20, § 1º', cumprida: cond(hoje), data: d,
        detalhe: d
          ? `${cond(hoje) ? 'Cumprida' : 'Projeção'} em ${fmtBR(d)}: idade ${ID(d).toFixed(1)} (mín ${idadeMin}) + TC ${TC(d).toFixed(1)} + pedágio. Cálculo: 100% da média.`
          : 'Não alcançada.',
        calc: 'media100',
      });
    }

    // Permanente professor (art. 19)
    {
      const idMin = IDADE_PERMANENTE_PROFESSOR[sexo];
      const cond = (t: number) => TC(t) >= TC_PERMANENTE_PROFESSOR && atingiuIdade(nasc, t, idMin);
      const d = primeiraData(cond, EC103);
      res.push({
        id: 'prof_perm', nome: 'Professor — Permanente (art. 19, EC 103)',
        fundamento: 'EC 103/2019, art. 19', cumprida: cond(hoje), data: d,
        detalhe: d
          ? `Idade ${idMin} + ${TC_PERMANENTE_PROFESSOR} anos de magistério em ${fmtBR(d)}.`
          : 'Não alcançada.',
        calc: 'media100_coef',
      });
    }
  }

  // ---- Regras PCD (se grauPCD informado) ----
  if (ctx.grauPCD) {
    const grau = ctx.grauPCD;

    // PCD por TC (art. 3º, I-III, LC 142/2013)
    {
      const tcMinPCD = TC_MINIMO_PCD[grau][sexo];
      const cond = (t: number) => TC(t) >= tcMinPCD;
      const d = primeiraData(cond, EC103);
      res.push({
        id: 'pcd_tc', nome: `PCD (${grau}) — Por tempo de contribuição (LC 142/2013)`,
        fundamento: 'LC 142/2013, art. 3º', cumprida: cond(hoje), data: d,
        detalhe: d
          ? `${cond(hoje) ? 'Cumprida' : 'Projeção'} em ${fmtBR(d)}: TC ${TC(d).toFixed(1)} anos (mínimo ${tcMinPCD} para grau ${grau}). RMI = 100% da média.`
          : `Não alcançada (exige ${tcMinPCD} anos de TC).`,
        calc: 'media100',
      });
    }

    // PCD por idade (art. 3º, IV, LC 142/2013)
    {
      const idMin = IDADE_MINIMA_PCD[sexo];
      const cond = (t: number) => TC(t) >= TC_MINIMO_PCD_IDADE && atingiuIdade(nasc, t, idMin);
      const d = primeiraData(cond, EC103);
      res.push({
        id: 'pcd_idade', nome: `PCD (${grau}) — Por idade (LC 142/2013)`,
        fundamento: 'LC 142/2013, art. 3º, IV', cumprida: cond(hoje), data: d,
        detalhe: d
          ? `${cond(hoje) ? 'Cumprida' : 'Projeção'} em ${fmtBR(d)}: idade ${ID(d).toFixed(1)} (mín ${idMin}) + TC ${TC(d).toFixed(1)} (mín 15). RMI = 70% + 1%/ano.`
          : `Não alcançada (exige ${idMin} anos + 15 TC).`,
        calc: 'media100_coef',
      });
    }
  }

  return { regras: res, diasNaEC, base };
}
