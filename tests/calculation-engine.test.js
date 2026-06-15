const C = require('../src/core/calculation-engine');
let fails = 0;
function ok(cond, msg) { console.log((cond ? 'PASS' : 'FAIL') + ' - ' + msg); if (!cond) fails++; }
function approx(a, b, tol, msg) { ok(Math.abs(a - b) <= tol, `${msg} (obtido ${a}, esperado ${b}±${tol})`); }

// ---- datas ----
ok(C.parseBR('29/02/2024') !== null, 'parseBR aceita 29/02/2024 (bissexto)');
ok(C.parseBR('31/04/2024') === null, 'parseBR rejeita 31/04');
ok(C.fmtBR(C.dt(5, 12, 2024)) === '05/12/2024', 'fmtBR');

// ---- mesclagem e contagem ----
const ps = [
  { ini: C.dt(1, 1, 2000), fim: C.dt(31, 12, 2004) },
  { ini: C.dt(1, 6, 2003), fim: C.dt(31, 12, 2006) },
  { ini: C.dt(1, 1, 2010), fim: C.dt(30, 6, 2010) },
];
const merged = C.mesclarPeriodos(ps);
ok(merged.length === 2, 'mescla sobreposição em 2 períodos');
const dias = C.diasAte(merged, C.dt(31, 12, 2030));
approx(dias, 2557 + 181, 0, 'contagem de dias com concomitância eliminada');

// período único de exatos 35 anos
const p35 = [{ ini: C.dt(1, 1, 1984), fim: C.dt(30, 12, 2018) }];
const m35 = C.mesclarPeriodos(p35);
const d35 = C.diasAte(m35, C.VESPERA);
const amd = C.diasParaAMD(d35);
console.log('  35 anos ->', C.fmtAMD(amd));
ok(amd.y === 35, '≈35 anos contados');

// ---- thresholds ----
ok(C.pontosMinimos(2026, 'M') === 103 && C.pontosMinimos(2026, 'F') === 93, 'pontos 2026 = 103/93');
ok(C.pontosMinimos(2030, 'M') === 105 && C.pontosMinimos(2035, 'F') === 100, 'caps de pontos');
approx(C.idadeMinimaArt16(2026, 'M'), 64.5, 0.001, 'idade art.16 H 2026 = 64,5');
approx(C.idadeMinimaArt16(2026, 'F'), 59.5, 0.001, 'idade art.16 M 2026 = 59,5');
approx(C.idadeMinimaArt16(2031, 'F'), 62, 0.001, 'cap idade art.16 F = 62');
ok(C.idadeMinimaArt18(2026, 'F') === 62, 'idade art.18 F 2026 = 62');

// ---- caso de referência ----
const nasc = C.dt(6, 7, 1960);
const per = [{ ini: C.dt(30, 10, 1984), fim: C.dt(31, 5, 2026) }];
const ctx = { sexo: 'M', nasc, merged: C.mesclarPeriodos(per), hoje: C.dt(10, 6, 2026), continuaContribuindo: true };
const av = C.avaliarRegras(ctx);
const byId = Object.fromEntries(av.regras.map(r => [r.id, r]));
console.log('  TC na véspera:', C.fmtAMD(C.diasParaAMD(av.diasNaEC)));
ok(byId.da.cumprida, 'direito adquirido reconhecido');
ok(byId.art17.detalhe.includes('Inaplicável'), 'art.17 inaplicável quando DA já cumprido');
ok(byId.art15.cumprida, 'art.15 cumprido hoje');
ok(byId.art16.cumprida, 'art.16 cumprido hoje');
ok(byId.art18.cumprida === true, 'art.18 cumprido');
console.log('  art18:', byId.art18.detalhe);
ok(C.fmtBR(byId.art18.data) === '06/07/2025', `art.18 data = 06/07/2025`);

// ---- pedágio 50% ----
const per2 = [{ ini: C.dt(13, 11, 1985), fim: C.dt(31, 5, 2026) }];
const ctx2 = { sexo: 'M', nasc: C.dt(1, 1, 1962), merged: C.mesclarPeriodos(per2), hoje: C.dt(10, 6, 2026), continuaContribuindo: true };
const av2 = C.avaliarRegras(ctx2);
const b2 = Object.fromEntries(av2.regras.map(r => [r.id, r]));
console.log('  TC véspera caso2:', C.fmtAMD(C.diasParaAMD(av2.diasNaEC)));
ok(!b2.da.cumprida, 'caso2: sem direito adquirido');
ok(b2.art17.detalhe.includes('Pedágio'), 'caso2: art.17 aplicável');
ok(b2.art17.data !== null && C.fmtBR(b2.art17.data).endsWith('2021'), 'caso2: implemento em 2021');

// ---- fator previdenciário ----
approx(C.fatorPrev(35, 55, 21.8), 0.8255, 0.002, 'fator previdenciário fórmula');

// ---- salários e RMI ----
const txt = `01/2020 3.500,00\n02/2020 R$ 3.600,00\n03/2020\t3700,00\nlinha invalida`;
const psal = C.parseSalarios(txt);
ok(psal.salarios.length === 3 && psal.erros.length === 1, 'parseSalarios: 3 válidos, 1 erro');
approx(psal.salarios[1].valor, 3600, 0.001, 'parse valor com R$');

// média com divisor mínimo
approx(C.mediaSimples(Array(10).fill(1000), 108), 9259.26 / 100, 0.01, 'divisor mínimo 108');

// coeficiente
ok(C.coef(40, 'M') === 1, 'coef H 40a = 100%');
approx(C.coef(25, 'M'), 0.70, 0.001, 'coef H 25a = 70%');
approx(C.coef(20, 'F'), 0.70, 0.001, 'coef F 20a = 70%');

// descarte
const vals = Array(116).fill(5000).concat([100, 100, 100, 100]);
const ot = C.otimizarDescarte(vals, Math.round(36 * 365), 35, 108);
ok(ot.descartes === 4, `descarte otimizado remove os 4 baixos`);
approx(ot.media, 5000, 0.01, 'média pós-descarte = 5000');

// RMI
const params = { teto: 8475.55, salMin: 1621, divisorMinimo: 108, tabuaEs: { 64: 19.6, 65: 18.9 } };
const r = C.calcularRMI('media100_coef', {
  salarios: Array(200).fill(0).map((_, i) => ({ valor: 12000 })),
  tcDiasNaDER: Math.round(40 * 365), idadeNaDER: 64.5, sexo: 'M', tcMinRegra: 35, params
});
approx(r.rmi, 8475.55, 0.01, 'RMI limitada ao teto');
ok(r.coefic === 1, 'coef 100% com 40 anos');

console.log(fails === 0 ? '\nTODOS OS TESTES PASSARAM' : `\n${fails} FALHA(S)`);
process.exit(fails ? 1 : 0);
