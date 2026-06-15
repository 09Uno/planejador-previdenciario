// ===================================================================
// NÚCLEO DE CÁLCULO PREVIDENCIÁRIO (RGPS) — puro, testável em Node
// Protótipo Machado Filgueiras — não substitui conferência profissional
// ===================================================================
"use strict";

// ---------- datas ----------
function dt(d, m, y) { return Date.UTC(y, m - 1, d); }
function parseBR(s) {
  const m = String(s).trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const t = dt(+m[1], +m[2], +m[3]);
  const c = new Date(t);
  if (c.getUTCDate() !== +m[1] || c.getUTCMonth() !== +m[2] - 1) return null;
  return t;
}
function fmtBR(t) {
  const d = new Date(t);
  const p = n => String(n).padStart(2, "0");
  return `${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
}
const DAY = 86400000;
function addDays(t, n) { return t + n * DAY; }
function yearOf(t) { return new Date(t).getUTCFullYear(); }

// idade em anos fracionários na data t
function idadeAnos(nasc, t) {
  return (t - nasc) / (365.25 * DAY);
}
// idade exata em anos/meses/dias (calendário)
function idadeAMD(nasc, t) {
  const a = new Date(nasc), b = new Date(t);
  let y = b.getUTCFullYear() - a.getUTCFullYear();
  let m = b.getUTCMonth() - a.getUTCMonth();
  let d = b.getUTCDate() - a.getUTCDate();
  if (d < 0) { m--; d += 30; }
  if (m < 0) { y--; m += 12; }
  return { y, m, d };
}
function dataAoCompletar(nasc, anos) { // data em que completa X anos (aceita meio ano)
  const inteiro = Math.floor(anos);
  const frac = anos - inteiro;
  const a = new Date(nasc);
  let y = a.getUTCFullYear() + inteiro, m = a.getUTCMonth() + (frac >= 0.49 ? 6 : 0), d = a.getUTCDate();
  const ultimo = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return Date.UTC(y, m, Math.min(d, ultimo));
}
function atingiuIdade(nasc, t, anos) { return t >= dataAoCompletar(nasc, anos); }

// ---------- períodos ----------
// período: {ini, fim, desc}
function mesclarPeriodos(periodos) { // remove concomitância (une sobreposições)
  const ps = periodos.filter(p => p.ini != null && p.fim != null && p.fim >= p.ini)
    .slice().sort((a, b) => a.ini - b.ini);
  const out = [];
  for (const p of ps) {
    const last = out[out.length - 1];
    if (last && p.ini <= addDays(last.fim, 1)) {
      if (p.fim > last.fim) last.fim = p.fim;
    } else out.push({ ini: p.ini, fim: p.fim });
  }
  return out;
}
// dias de contribuição até a data corte (inclusive), períodos já mesclados
function diasAte(merged, corte) {
  let dias = 0;
  for (const p of merged) {
    if (p.ini > corte) break;
    const fim = Math.min(p.fim, corte);
    dias += Math.round((fim - p.ini) / DAY) + 1;
  }
  return dias;
}
function diasParaAMD(dias) {
  const y = Math.floor(dias / 365);
  const r = dias % 365;
  return { y, m: Math.floor(r / 30), d: r % 30, dias };
}
function fmtAMD(o) {
  return `${o.y} ano(s), ${o.m} mês(es) e ${o.d} dia(s)`;
}
function tcAnos(dias) { return dias / 365; }

// fim do último período (para projeção)
function ultimoFim(merged) { return merged.length ? merged[merged.length - 1].fim : null; }

// dias projetados na data futura t: contribuição contínua a partir de "base"
function diasProjetados(merged, base, t) {
  const atuais = diasAte(merged, base);
  if (t <= base) return diasAte(merged, t);
  return atuais + Math.round((t - base) / DAY);
}

// ---------- marcos ----------
const EC103 = dt(13, 11, 2019);
const VESPERA = dt(12, 11, 2019);

// ---------- requisitos por regra ----------
// sexo: 'M' (homem) | 'F' (mulher)
function tcMinimo(sexo) { return sexo === 'M' ? 35 : 30; }

function pontosMinimos(ano, sexo) {
  const base = sexo === 'M' ? 96 : 86;
  const cap = sexo === 'M' ? 105 : 100;
  return Math.min(base + Math.max(0, ano - 2019), cap);
}
function idadeMinimaArt16(ano, sexo) {
  const base = sexo === 'M' ? 61 : 56;
  const cap = sexo === 'M' ? 65 : 62;
  return Math.min(base + 0.5 * Math.max(0, ano - 2019), cap);
}
function idadeMinimaArt18(ano, sexo) {
  if (sexo === 'M') return 65;
  return Math.min(60 + 0.5 * Math.max(0, ano - 2019), 62);
}
function pontos8595(ano) { // direito adquirido Lei 13.183 (para isenção de fator pré-reforma)
  // 85/95 até 30/12/2018; 86/96 de 31/12/2018 a 30/12/2020... (Lei 13.183/15)
  if (ano <= 2018) return { F: 85, M: 95 };
  if (ano <= 2020) return { F: 86, M: 96 };
  if (ano <= 2022) return { F: 87, M: 97 };
  if (ano <= 2024) return { F: 88, M: 98 };
  if (ano <= 2026) return { F: 89, M: 99 };
  return { F: 90, M: 100 };
}

// ---------- avaliação das regras ----------
// ctx: {sexo, nasc, merged, hoje, continuaContribuindo}
function baseProjecao(ctx) {
  const uf = ultimoFim(ctx.merged);
  if (uf == null) return ctx.hoje;
  return Math.min(Math.max(uf, ctx.hoje), ctx.hoje); // contribui até hoje; futuro = a partir de hoje
}
// procura a primeira data (passo mensal, refino diário) em que cond(t) === true
function primeiraData(cond, inicio, limiteAnos = 45) {
  const fim = addDays(inicio, Math.round(limiteAnos * 365.25));
  if (cond(inicio)) return inicio;
  let t = inicio, passo = 30 * DAY;
  while (t < fim) {
    const prox = t + passo;
    if (cond(prox)) { // refina diário
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

function avaliarRegras(ctx) {
  const { sexo, nasc, merged, hoje } = ctx;
  const tcMin = tcMinimo(sexo);
  const diasNaEC = diasAte(merged, VESPERA);
  const tcNaEC = tcAnos(diasNaEC);
  const base = baseProjecao(ctx);
  const cont = ctx.continuaContribuindo !== false;

  const TC = t => tcAnos(cont ? diasProjetados(merged, base, t) : diasAte(merged, t));
  const ID = t => idadeAnos(nasc, t);

  const res = [];

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
          (pontosEC >= p8595 ? `Pontuação ${pontosEC.toFixed(1)} ≥ ${p8595} (regra 85/95 progressiva): fator previdenciário afastável.` :
            `Pontuação ${pontosEC.toFixed(1)} < ${p8595}: cálculo com fator previdenciário.`)
        : `Em 12/11/2019 o tempo era de ${fmtAMD(diasParaAMD(diasNaEC))} — inferior a ${tcMin} anos.`,
      calc: ok && pontosEC >= p8595 ? 'media80' : 'media80_fator'
    });
  }

  // ---- Art. 15 — pontos ----
  {
    const cond = t => {
      const tc = TC(t);
      return tc >= tcMin && (tc + ID(t)) >= pontosMinimos(yearOf(t), sexo);
    };
    const d = primeiraData(cond, EC103) ?? null;
    const cumpridaHoje = cond(hoje);
    res.push({
      id: 'art15', nome: 'Transição — Pontos (art. 15, EC 103)',
      fundamento: 'EC 103/2019, art. 15', cumprida: cumpridaHoje, data: d,
      detalhe: d ? `${cumpridaHoje ? 'Requisitos já cumpridos' : 'Projeção de implemento'} em ${fmtBR(d)}: ` +
        `TC ${TC(d).toFixed(1)} anos + idade ${ID(d).toFixed(1)} = ${(TC(d) + ID(d)).toFixed(1)} pontos (mínimo ${pontosMinimos(yearOf(d), sexo)} em ${yearOf(d)}).`
        : 'Não alcançada no horizonte de 45 anos.',
      calc: 'media100_coef'
    });
  }

  // ---- Art. 16 — idade progressiva ----
  {
    const cond = t => TC(t) >= tcMin && atingiuIdade(nasc, t, idadeMinimaArt16(yearOf(t), sexo));
    const d = primeiraData(cond, EC103);
    res.push({
      id: 'art16', nome: 'Transição — Idade mínima progressiva (art. 16, EC 103)',
      fundamento: 'EC 103/2019, art. 16', cumprida: cond(hoje), data: d,
      detalhe: d ? `${cond(hoje) ? 'Requisitos já cumpridos' : 'Projeção de implemento'} em ${fmtBR(d)}: TC ${TC(d).toFixed(1)} anos e idade ${ID(d).toFixed(1)} (mínima ${idadeMinimaArt16(yearOf(d), sexo).toFixed(1)} em ${yearOf(d)}).`
        : 'Não alcançada no horizonte de 45 anos.',
      calc: 'media100_coef'
    });
  }

  // ---- Art. 17 — pedágio 50% ----
  {
    const faltavaDias = Math.round(tcMin * 365) - diasNaEC;
    const elegivel = faltavaDias > 0 && faltavaDias <= Math.round(2 * 365);
    let d = null;
    if (elegivel) {
      const alvoDias = Math.round(tcMin * 365) + Math.ceil(faltavaDias * 0.5);
      const cond = t => (cont ? diasProjetados(merged, base, t) : diasAte(merged, t)) >= alvoDias;
      d = primeiraData(cond, EC103);
    }
    res.push({
      id: 'art17', nome: 'Transição — Pedágio de 50% (art. 17, EC 103)',
      fundamento: 'EC 103/2019, art. 17', cumprida: elegivel && d != null && d <= hoje, data: d,
      detalhe: elegivel
        ? `Faltavam ${fmtAMD(diasParaAMD(faltavaDias))} em 13/11/2019 (≤ 2 anos). Pedágio: ${fmtAMD(diasParaAMD(Math.ceil(faltavaDias * 0.5)))}. ` +
          (d ? `Implemento em ${fmtBR(d)}. Cálculo com fator previdenciário (verificar se favorável).` : 'Não alcançada.')
        : (faltavaDias <= 0 ? 'Inaplicável: tempo mínimo já cumprido antes da EC (ver direito adquirido).' : `Inaplicável: faltavam mais de 2 anos em 13/11/2019 (${fmtAMD(diasParaAMD(faltavaDias))}).`),
      calc: 'media100_fator'
    });
  }

  // ---- Art. 18 — idade ----
  {
    const cond = t => TC(t) >= 15 && atingiuIdade(nasc, t, idadeMinimaArt18(yearOf(t), sexo));
    const d = primeiraData(cond, EC103);
    res.push({
      id: 'art18', nome: 'Transição — Aposentadoria por idade (art. 18, EC 103)',
      fundamento: 'EC 103/2019, art. 18', cumprida: cond(hoje), data: d,
      detalhe: d ? `${cond(hoje) ? 'Requisitos já cumpridos' : 'Projeção de implemento'} em ${fmtBR(d)}: idade ${ID(d).toFixed(1)} (mínima ${idadeMinimaArt18(yearOf(d), sexo)}) e TC ${TC(d).toFixed(1)} anos (mínimo 15).`
        : 'Não alcançada no horizonte de 45 anos.',
      calc: 'media100_coef'
    });
  }

  // ---- Art. 20 — pedágio 100% ----
  {
    const faltavaDias = Math.max(0, Math.round(tcMin * 365) - diasNaEC);
    const idadeMin = sexo === 'M' ? 60 : 57;
    const alvoDias = Math.round(tcMin * 365) + faltavaDias; // tcMin + pedágio 100%
    const cond = t => {
      const dd = cont ? diasProjetados(merged, base, t) : diasAte(merged, t);
      return dd >= alvoDias && atingiuIdade(nasc, t, idadeMin);
    };
    const d = primeiraData(cond, EC103);
    res.push({
      id: 'art20', nome: 'Transição — Pedágio de 100% (art. 20, EC 103)',
      fundamento: 'EC 103/2019, art. 20', cumprida: cond(hoje), data: d,
      detalhe: d ? `${cond(hoje) ? 'Requisitos já cumpridos' : 'Projeção de implemento'} em ${fmtBR(d)}: idade mínima ${idadeMin} anos + TC ${tcMin} anos + pedágio de ${fmtAMD(diasParaAMD(faltavaDias))}. Cálculo: 100% da média.`
        : 'Não alcançada no horizonte de 45 anos.',
      calc: 'media100'
    });
  }

  // ---- Regra permanente (referência) ----
  {
    const idMin = sexo === 'M' ? 65 : 62;
    const tcMinP = sexo === 'M' ? 20 : 15;
    const cond = t => TC(t) >= tcMinP && atingiuIdade(nasc, t, idMin);
    const d = primeiraData(cond, EC103);
    res.push({
      id: 'perm', nome: 'Regra permanente (art. 19, EC 103 — referência)',
      fundamento: 'EC 103/2019', cumprida: cond(hoje), data: d,
      detalhe: d ? `Idade ${idMin} + ${tcMinP} anos de TC em ${fmtBR(d)}.` : 'Não alcançada no horizonte de 45 anos.',
      calc: 'media100_coef'
    });
  }

  return { regras: res, diasNaEC, base };
}

// ---------- salários e RMI ----------
// salarios: [{comp: 'mm/aaaa', valor: number}] — valores JÁ ATUALIZADOS monetariamente
function parseSalarios(texto) {
  const out = []; const erros = [];
  for (const raw of String(texto).split(/\n+/)) {
    const line = raw.trim();
    if (!line) continue;
    const m = line.match(/(\d{2})\/(\d{4})[\s;,\t]+R?\$?\s*([\d.,]+)/);
    if (!m) { erros.push(line); continue; }
    const valor = parseFloat(m[3].replace(/\./g, '').replace(',', '.'));
    if (!isFinite(valor)) { erros.push(line); continue; }
    out.push({ comp: `${m[1]}/${m[2]}`, ano: +m[2], mes: +m[1], valor });
  }
  return { salarios: out, erros };
}

function mediaSimples(vals, divisorMinimo) {
  const n = vals.length;
  const soma = vals.reduce((a, b) => a + b, 0);
  const div = Math.max(n, divisorMinimo || 0);
  return n ? soma / div : 0;
}

// coeficiente 60% + 2%/ano excedente (cap 100%)
function coef(tcAnosVal, sexo) {
  const exc = Math.max(0, Math.floor(tcAnosVal) - (sexo === 'M' ? 20 : 15));
  return Math.min(1, 0.60 + 0.02 * exc);
}

function fatorPrev(tc, idade, es) {
  const a = 0.31;
  return (tc * a / es) * (1 + (idade + tc * a) / 100);
}

// otimização do descarte (art. 26, §6º): remove menores salários enquanto
// (a) média sobe, (b) TC remanescente ≥ tempo mínimo da regra, (c) respeita divisor mínimo
function otimizarDescarte(vals, tcDias, tcMinAnos, divisorMinimo) {
  const sorted = vals.slice().sort((a, b) => a - b);
  let melhores = { media: mediaSimples(vals, divisorMinimo), descartes: 0 };
  for (let k = 1; k <= sorted.length - 1; k++) {
    const rem = sorted.slice(k);
    const tcRestDias = tcDias - k * 30; // aproximação: 1 competência ≈ 30 dias
    if (tcAnos(tcRestDias) < tcMinAnos) break;
    const m = mediaSimples(rem, divisorMinimo);
    if (m > melhores.media) melhores = { media: m, descartes: k, tcRestDias };
  }
  return melhores;
}

// calcula RMI por tipo de cálculo
// params: {teto, salMin, divisorMinimo, tabuaEs}
function calcularRMI(tipo, opts) {
  const { salarios, tcDiasNaDER, idadeNaDER, sexo, tcMinRegra, params } = opts;
  const vals = salarios.map(s => s.valor);
  if (!vals.length) return { erro: 'Sem salários informados.' };
  const esIdade = Math.min(75, Math.max(45, Math.floor(idadeNaDER)));
  const es = params.tabuaEs[esIdade] ?? 18;
  const tc = tcAnos(tcDiasNaDER);
  let media, fator = null, coefic = null, descartes = 0, obs = [];

  if (tipo === 'media80' || tipo === 'media80_fator') {
    const sorted = vals.slice().sort((a, b) => b - a);
    const n80 = Math.max(1, Math.round(sorted.length * 0.8));
    media = mediaSimples(sorted.slice(0, n80), 0);
    if (tipo === 'media80_fator') { fator = fatorPrev(tc, idadeNaDER, es); media *= fator; }
    obs.push(`Média dos ${n80} maiores salários (80%).`);
  } else if (tipo === 'media100') {
    media = mediaSimples(vals, params.divisorMinimo);
    coefic = 1;
    obs.push('100% da média, sem descarte (art. 26, §3º, I).');
  } else if (tipo === 'media100_fator') {
    media = mediaSimples(vals, params.divisorMinimo);
    fator = fatorPrev(tc, idadeNaDER, es);
    if (fator > 1) obs.push('Fator previdenciário > 1: favorável.');
    media *= fator;
    coefic = 1;
  } else { // media100_coef (60% + 2%)
    const ot = otimizarDescarte(vals, tcDiasNaDER, tcMinRegra, params.divisorMinimo);
    descartes = ot.descartes;
    const tcFinal = tcAnos(ot.tcRestDias ?? tcDiasNaDER);
    coefic = coef(tcFinal, sexo);
    media = ot.media * coefic;
    obs.push(`Descarte otimizado: ${descartes} competência(s) (art. 26, §6º). Coeficiente: ${(coefic * 100).toFixed(0)}%.`);
  }

  let rmi = media;
  if (rmi > params.teto) { rmi = params.teto; obs.push('Limitada ao teto do RGPS.'); }
  if (rmi < params.salMin) { rmi = params.salMin; obs.push('Elevada ao salário mínimo.'); }
  return {
    rmi, fator, coefic, descartes, es, idadeEs: esIdade,
    obs: obs.join(' ')
  };
}

if (typeof module !== 'undefined') module.exports = {
  dt, parseBR, fmtBR, addDays, idadeAnos, idadeAMD, mesclarPeriodos, diasAte,
  diasParaAMD, fmtAMD, tcAnos, diasProjetados, EC103, VESPERA, tcMinimo,
  pontosMinimos, idadeMinimaArt16, idadeMinimaArt18, pontos8595, avaliarRegras,
  parseSalarios, mediaSimples, coef, fatorPrev, otimizarDescarte, calcularRMI, primeiraData, dataAoCompletar, atingiuIdade
};
