import { describe, it, expect } from 'vitest';
import {
  dt, parseBR, fmtBR, fmtAMD, diasParaAMD, mesclarPeriodos, diasAte, VESPERA,
  pontosMinimos, idadeMinimaArt16, idadeMinimaArt18, avaliarRegras, fatorPrev,
  parseSalarios, mediaSimples, coef, calcularRMI, aplicarAtualizacao,
  contarCarencia, parseTabelaFatoresCSV, PARAMS_2026,
} from '../src/index.js';

describe('datas', () => {
  it('parseBR aceita 29/02/2024 e rejeita 31/04', () => {
    expect(parseBR('29/02/2024')).not.toBeNull();
    expect(parseBR('31/04/2024')).toBeNull();
  });
  it('fmtBR', () => expect(fmtBR(dt(5, 12, 2024))).toBe('05/12/2024'));
});

describe('períodos', () => {
  it('mescla concomitância e conta dias', () => {
    const merged = mesclarPeriodos([
      { ini: dt(1, 1, 2000), fim: dt(31, 12, 2004) },
      { ini: dt(1, 6, 2003), fim: dt(31, 12, 2006) },
      { ini: dt(1, 1, 2010), fim: dt(30, 6, 2010) },
    ]);
    expect(merged.length).toBe(2);
    expect(diasAte(merged, dt(31, 12, 2030))).toBe(2557 + 181);
  });
  it('~35 anos', () => {
    const m = mesclarPeriodos([{ ini: dt(1, 1, 1984), fim: dt(30, 12, 2018) }]);
    expect(diasParaAMD(diasAte(m, VESPERA)).y).toBe(35);
  });
});

describe('thresholds 2026', () => {
  it('pontos art. 15', () => {
    expect(pontosMinimos(2026, 'M')).toBe(103);
    expect(pontosMinimos(2026, 'F')).toBe(93);
    expect(pontosMinimos(2030, 'M')).toBe(105);
    expect(pontosMinimos(2035, 'F')).toBe(100);
  });
  it('idades art. 16/18', () => {
    expect(idadeMinimaArt16(2026, 'M')).toBeCloseTo(64.5, 3);
    expect(idadeMinimaArt16(2026, 'F')).toBeCloseTo(59.5, 3);
    expect(idadeMinimaArt16(2031, 'F')).toBeCloseTo(62, 3);
    expect(idadeMinimaArt18(2026, 'F')).toBe(62);
  });
});

describe('avaliarRegras — casos de referência', () => {
  it('direito adquirido + art. 18 H', () => {
    const ctx = {
      sexo: 'M' as const, nasc: dt(6, 7, 1960),
      merged: mesclarPeriodos([{ ini: dt(30, 10, 1984), fim: dt(31, 5, 2026) }]),
      hoje: dt(10, 6, 2026), continuaContribuindo: true,
    };
    const by = Object.fromEntries(avaliarRegras(ctx).regras.map(r => [r.id, r]));
    expect(by.da.cumprida).toBe(true);
    expect(by.art17.detalhe).toContain('Inaplicável');
    expect(by.art15.cumprida).toBe(true);
    expect(by.art16.cumprida).toBe(true);
    expect(by.art18.cumprida).toBe(true);
    expect(fmtBR(by.art18.data!)).toBe('06/07/2025');
  });
  it('pedágio 50% aplicável', () => {
    const ctx = {
      sexo: 'M' as const, nasc: dt(1, 1, 1962),
      merged: mesclarPeriodos([{ ini: dt(13, 11, 1985), fim: dt(31, 5, 2026) }]),
      hoje: dt(10, 6, 2026), continuaContribuindo: true,
    };
    const by = Object.fromEntries(avaliarRegras(ctx).regras.map(r => [r.id, r]));
    expect(by.da.cumprida).toBe(false);
    expect(by.art17.detalhe).toContain('Pedágio');
    expect(fmtBR(by.art17.data!)).toMatch(/2021$/);
  });
});

describe('rmi — blocos', () => {
  it('fator previdenciário', () => expect(fatorPrev(35, 55, 21.8)).toBeCloseTo(0.8255, 2));
  it('parseSalarios', () => {
    const p = parseSalarios('01/2020 3.500,00\n02/2020 R$ 3.600,00\n03/2020\t3700,00\nlinha invalida');
    expect(p.salarios.length).toBe(3);
    expect(p.erros.length).toBe(1);
    expect(p.salarios[1].valor).toBeCloseTo(3600, 3);
  });
  it('média com divisor mínimo 108', () => expect(mediaSimples(Array(10).fill(1000), 108)).toBeCloseTo(92.59, 1));
  it('coeficiente', () => {
    expect(coef(40, 'M')).toBe(1);
    expect(coef(25, 'M')).toBeCloseTo(0.70, 3);
    expect(coef(20, 'F')).toBeCloseTo(0.70, 3);
    expect(coef(15.4687, 'F')).toBeCloseTo(0.60, 3);
  });
  it('RMI limitada ao teto', () => {
    const comps = Array(200).fill(0).map((_, i) => ({
      competencia: `${String((i % 12) + 1).padStart(2, '0')}/${2000 + Math.floor(i / 12)}`,
      dias: 30, salarioContribuicao: 12000, salarioCorrigido: 12000,
    }));
    const r = calcularRMI({
      competencias: comps, tipo: 'media100_coef', tcTotalDias: Math.round(40 * 365),
      idadeNaDER: 64.5, sexo: 'M', tcMinRegra: 35, params: PARAMS_2026,
    });
    expect(r.rmi).toBeCloseTo(8475.55, 2);
    expect(r.coeficiente).toBe(1);
  });
});

describe('atualização monetária', () => {
  it('aplica teto e índice', () => {
    const [c] = aplicarAtualizacao([{ competencia: '11/2011', dias: 24, salarioContribuicao: 35950.83 }]);
    expect(c.salarioConsiderado).toBeCloseTo(3691.74, 2); // teto 11/2011
    expect(c.salarioCorrigido).toBeCloseTo(8075.55, 2);   // × 2,187465 (base 01/2026)
  });
  it('projeção futura: fator 1,0', () => {
    const [c] = aplicarAtualizacao([{ competencia: '01/2033', dias: 30, salarioContribuicao: 8475.55, tetoCompetencia: 8475.55 }]);
    expect(c.salarioCorrigido).toBeCloseTo(8475.55, 2);
  });
  it('parseTabelaFatoresCSV', () => {
    const t = parseTabelaFatoresCSV('07/1994;7,123456\n08/1994\t6,987654\nlixo');
    expect(t['07/1994']).toBeCloseTo(7.123456, 6);
    expect(Object.keys(t).length).toBe(2);
  });
});

describe('carência', () => {
  it('vínculo de emprego conta por mês civil', () => {
    const r = contarCarencia({ vinculosEmprego: [{ ini: dt(15, 1, 2020), fim: dt(10, 4, 2020) }] });
    expect(r.total).toBe(4); // jan, fev, mar, abr
  });
  it('recolhimento abaixo do mínimo não conta', () => {
    const r = contarCarencia({
      recolhimentos: [
        { competencia: '01/2026', dias: 30, salarioContribuicao: 500 },
        { competencia: '02/2026', dias: 30, salarioContribuicao: 1621 },
      ],
      salarioMinimoDaCompetencia: () => 1621,
    });
    expect(r.total).toBe(1);
    expect(r.abaixoDoMinimo).toEqual(['01/2026']);
  });
});
