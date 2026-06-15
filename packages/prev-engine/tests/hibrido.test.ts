import { describe, it, expect } from 'vitest';
import { parseBR, fmtAMD, diasParaAMD } from '../src/dates.js';
import {
  separarPorRegime, simularCTC, resumoPorRegime, cenariosAverbacao,
  type PeriodoHibrido,
} from '../src/hibrido.js';

const periodosSuely: PeriodoHibrido[] = [
  // RGPS
  { ini: parseBR('21/03/1994')!, fim: parseBR('07/11/1997')!, regime: 'RGPS', tipo: 'especial', grauEspecial: 25, desc: 'SERMED' },
  { ini: parseBR('01/01/2009')!, fim: parseBR('31/03/2009')!, regime: 'RGPS', desc: 'Unimed CI' },
  { ini: parseBR('09/11/2015')!, fim: parseBR('12/11/2019')!, regime: 'RGPS', tipo: 'especial', grauEspecial: 25, desc: 'ASF especial' },
  { ini: parseBR('13/11/2019')!, fim: parseBR('14/11/2025')!, regime: 'RGPS', desc: 'ASF CLT' },
  // RPPS (hipotético para teste)
  { ini: parseBR('01/05/2000')!, fim: parseBR('31/12/2008')!, regime: 'RPPS', desc: 'Estado SP - cargo X' },
];

describe('separarPorRegime', () => {
  it('separa corretamente RGPS e RPPS', () => {
    const { rgps, rpps } = separarPorRegime(periodosSuely);
    expect(rgps.length).toBe(4);
    expect(rpps.length).toBe(1);
  });
});

describe('simularCTC', () => {
  it('averba RPPS para RGPS corretamente', () => {
    const { periodosResultantes, avisos } = simularCTC(periodosSuely, [4], 'RGPS');
    // Período 4 (RPPS) deve virar RGPS
    expect(periodosResultantes[4].regime).toBe('RGPS');
    expect(avisos.length).toBe(0);
  });

  it('averba RGPS especial para RPPS com alerta', () => {
    const { periodosResultantes, avisos } = simularCTC(periodosSuely, [0], 'RPPS');
    expect(periodosResultantes[0].regime).toBe('RPPS');
    // Deve alertar sobre especial via CTC
    expect(avisos.some(a => a.includes('especial'))).toBe(true);
    expect(avisos.some(a => a.includes('Nota Técnica 792'))).toBe(true);
    // Tipo convertido para normal
    expect(periodosResultantes[0].tipo).toBe('normal');
  });

  it('ignora averbação de período já no destino', () => {
    const { avisos } = simularCTC(periodosSuely, [0], 'RGPS');
    expect(avisos.some(a => a.includes('já pertence'))).toBe(true);
  });

  it('vedada dupla contagem: período sai da origem', () => {
    const { periodosResultantes } = simularCTC(periodosSuely, [4], 'RGPS');
    const { rgps, rpps } = separarPorRegime(periodosResultantes);
    expect(rpps.length).toBe(0); // nenhum período ficou no RPPS
    expect(rgps.length).toBe(5); // todos no RGPS agora
  });
});

describe('resumoPorRegime', () => {
  it('conta dias por regime separadamente', () => {
    const corte = parseBR('10/06/2026')!;
    const resumo = resumoPorRegime(periodosSuely, corte);
    expect(resumo.rgps.dias).toBeGreaterThan(0);
    expect(resumo.rpps.dias).toBeGreaterThan(0);
    expect(resumo.total.dias).toBe(resumo.rgps.dias + resumo.rpps.dias);
  });
});

describe('cenariosAverbacao', () => {
  it('gera 3 cenários: sem averbação, CTC→RPPS, CTC→RGPS', () => {
    const cenarios = cenariosAverbacao(periodosSuely);
    expect(cenarios.length).toBe(3);
    expect(cenarios[0].rotulo).toContain('Sem averbação');
    expect(cenarios[1].rotulo).toContain('RPPS');
    expect(cenarios[2].rotulo).toContain('RGPS');
  });

  it('cenário CTC→RPPS move todos os RGPS para RPPS', () => {
    const cenarios = cenariosAverbacao(periodosSuely);
    const ctcRpps = cenarios[1];
    const { rgps, rpps } = separarPorRegime(ctcRpps.periodos);
    expect(rgps.length).toBe(0);
    expect(rpps.length).toBe(5);
  });

  it('cenário CTC→RGPS move todos os RPPS para RGPS', () => {
    const cenarios = cenariosAverbacao(periodosSuely);
    const ctcRgps = cenarios[2];
    const { rgps, rpps } = separarPorRegime(ctcRgps.periodos);
    expect(rpps.length).toBe(0);
    expect(rgps.length).toBe(5);
  });

  it('se só tem RGPS, gera 2 cenários (sem averbação + CTC→RPPS)', () => {
    const sohRGPS: PeriodoHibrido[] = [
      { ini: parseBR('01/01/2000')!, fim: parseBR('31/12/2025')!, regime: 'RGPS' },
    ];
    const cenarios = cenariosAverbacao(sohRGPS);
    // Sem averbação + opção de CTC→RPPS (mesmo que não haja RPPS)
    expect(cenarios.length).toBe(2);
    expect(cenarios[0].rotulo).toContain('Sem averbação');
  });
});
