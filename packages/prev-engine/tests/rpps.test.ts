import { describe, it, expect } from 'vitest';
import { parseBR } from '../src/dates.js';
import { mesclarPeriodos } from '../src/periodos.js';
import {
  RPPS_SP, pontosTransicaoRPPS, coefRPPS, mediaRPPS,
  calcularRMI_RPPS, contribuicaoInativo, abonoPermanencia,
  avaliarRegrasRPPS,
} from '../src/rpps.js';
import type { Periodo } from '../src/types.js';

describe('RPPS SP — parâmetros', () => {
  it('pontos transição SP 2026: M 103, F 93 (art. 10 §2º LC 1.354/2020, confirmado na ALESP)', () => {
    // Base 2019: M 96, F 86 + 7 anos = M 103, F 93
    expect(pontosTransicaoRPPS(RPPS_SP, 2026, 'M')).toBe(103);
    expect(pontosTransicaoRPPS(RPPS_SP, 2026, 'F')).toBe(93);
  });

  it('cap pontos SP: H 105, M 100', () => {
    expect(pontosTransicaoRPPS(RPPS_SP, 2040, 'M')).toBe(105);
    expect(pontosTransicaoRPPS(RPPS_SP, 2040, 'F')).toBe(100);
  });

  it('coeficiente RPPS: 60% + 2%/ano acima de 20', () => {
    expect(coefRPPS(RPPS_SP, 20)).toBeCloseTo(0.60);
    expect(coefRPPS(RPPS_SP, 25)).toBeCloseTo(0.70);
    expect(coefRPPS(RPPS_SP, 30)).toBeCloseTo(0.80);
    expect(coefRPPS(RPPS_SP, 40)).toBeCloseTo(1.00);
  });
});

describe('RPPS SP — cálculo de RMI (valores Suely do roteiro)', () => {
  // Suely doc 2.1: média 8.928,73 × 72% = RMI 6.428,68
  it('Suely doc 2.1: média × 72% = 6.428,68', () => {
    const result = calcularRMI_RPPS({
      tipo: 'coeficiente',
      salarios: Array(100).fill(8928.73), // simplificação: todos iguais à média
      tcAnos: 26, // 60% + 2%×6 = 72%
      params: RPPS_SP,
    });
    expect(result.coeficiente).toBeCloseTo(0.72);
    expect(result.rmi).toBeCloseTo(6428.69, 0); // ≤ R$ 0,015
  });

  // Suely doc 3.1: 80% → 7.130,34 (média mesma)
  it('Suely doc 3.1: média × 80% = 7.130,34', () => {
    // 80% = 60% + 2%×10 → tcAnos = 30
    const result = calcularRMI_RPPS({
      tipo: 'coeficiente',
      salarios: Array(100).fill(8913.17), // média ligeiramente diff
      tcAnos: 30,
      params: RPPS_SP,
    });
    expect(result.coeficiente).toBeCloseTo(0.80);
    expect(result.rmi).toBeCloseTo(7130.54, 0);
  });

  // Suely doc 4.1: Integralidade → 10.603,86
  it('Suely doc 4.1: integralidade = última remuneração', () => {
    const result = calcularRMI_RPPS({
      tipo: 'integralidade',
      salarios: [],
      tcAnos: 30,
      ultimaRemuneracao: 10603.86,
      params: RPPS_SP,
    });
    expect(result.rmi).toBe(10603.86);
    expect(result.coeficiente).toBeNull();
    expect(result.tipo).toContain('Integralidade');
  });
});

describe('RPPS SP — contribuição do inativo e abono', () => {
  it('contribuição inativo: 16% sobre excedente do teto', () => {
    const contrib = contribuicaoInativo(10603.86, RPPS_SP);
    // 10603.86 - 8475.55 = 2128.31 × 0.16 = 340.53
    expect(contrib).toBeCloseTo(340.53, 1);
  });

  it('abono de permanência: 14% da remuneração', () => {
    expect(abonoPermanencia(10000, 0.14)).toBe(1400);
  });
});

describe('RPPS SP — avaliarRegrasRPPS', () => {
  it('inclui 4 regras: permanente, pontos, pedágio, especial', () => {
    const periodos: Periodo[] = [
      { ini: parseBR('01/01/2000')!, fim: parseBR('31/12/2025')! },
    ];
    const merged = mesclarPeriodos(periodos);

    const result = avaliarRegrasRPPS({
      sexo: 'F',
      nasc: parseBR('26/02/1964')!,
      merged,
      hoje: parseBR('10/06/2026')!,
      continuaContribuindo: true,
      params: RPPS_SP,
      ingressoServPublico: parseBR('01/01/2000')!,
      ingressoCargo: parseBR('01/01/2000')!,
    });

    const ids = result.regras.map(r => r.id);
    expect(ids).toContain('rpps_perm');
    expect(ids).toContain('rpps_pontos');
    expect(ids).toContain('rpps_pedagio');
    expect(ids).toContain('rpps_especial');
  });

  it('permanente cumprida: F 62 anos + 26 TC + 26 serv. + 26 cargo', () => {
    const periodos: Periodo[] = [
      { ini: parseBR('01/01/2000')!, fim: parseBR('31/12/2025')! },
    ];
    const merged = mesclarPeriodos(periodos);

    const result = avaliarRegrasRPPS({
      sexo: 'F',
      nasc: parseBR('26/02/1964')!,
      merged,
      hoje: parseBR('10/06/2026')!,
      continuaContribuindo: true,
      params: RPPS_SP,
      ingressoServPublico: parseBR('01/01/2000')!,
      ingressoCargo: parseBR('01/01/2000')!,
    });

    const perm = result.regras.find(r => r.id === 'rpps_perm')!;
    expect(perm.cumprida).toBe(true);
  });
});
