import { describe, it, expect } from 'vitest';
import { parseBR } from '../src/dates.js';
import { mesclarPeriodos } from '../src/periodos.js';
import { avaliarRegras } from '../src/regras.js';
import {
  pontosMinProfessor, idadeMinProgressivaProfessor, tcMinimoProfessor,
  IDADE_PEDAGIO100_PROFESSOR, IDADE_PERMANENTE_PROFESSOR,
} from '../src/professor.js';
import {
  TC_MINIMO_PCD, IDADE_MINIMA_PCD, coefPCDIdade,
  FATOR_CONVERSAO_GRAU,
} from '../src/pcd.js';
import type { Periodo } from '../src/types.js';

// ===== Professor =====
describe('Professor — parâmetros', () => {
  it('TC mínimo professor: H 30, M 25', () => {
    expect(tcMinimoProfessor('M')).toBe(30);
    expect(tcMinimoProfessor('F')).toBe(25);
  });

  it('pontos professor 2026: H 98, M 88', () => {
    expect(pontosMinProfessor(2026, 'M')).toBe(98);
    expect(pontosMinProfessor(2026, 'F')).toBe(88);
  });

  it('cap pontos professor: H 100, M 92', () => {
    expect(pontosMinProfessor(2030, 'M')).toBe(100);
    expect(pontosMinProfessor(2035, 'F')).toBe(92);
  });

  it('idade progressiva professor 2026: H 59.5, M 54.5', () => {
    expect(idadeMinProgressivaProfessor(2026, 'M')).toBeCloseTo(59.5);
    expect(idadeMinProgressivaProfessor(2026, 'F')).toBeCloseTo(54.5);
  });

  it('cap idade progressiva: H 60, M 57', () => {
    expect(idadeMinProgressivaProfessor(2030, 'M')).toBe(60);
    expect(idadeMinProgressivaProfessor(2040, 'F')).toBe(57);
  });

  it('pedágio 100% professor: H 55, M 52', () => {
    expect(IDADE_PEDAGIO100_PROFESSOR.M).toBe(55);
    expect(IDADE_PEDAGIO100_PROFESSOR.F).toBe(52);
  });

  it('permanente professor: H 60, M 57', () => {
    expect(IDADE_PERMANENTE_PROFESSOR.M).toBe(60);
    expect(IDADE_PERMANENTE_PROFESSOR.F).toBe(57);
  });
});

describe('Professor — avaliarRegras', () => {
  it('inclui regras de professor quando professor=true', () => {
    const periodos: Periodo[] = [
      { ini: parseBR('01/01/1995')!, fim: parseBR('31/12/2025')! },
    ];
    const merged = mesclarPeriodos(periodos);
    const av = avaliarRegras({
      sexo: 'F',
      nasc: parseBR('01/01/1970')!,
      merged,
      hoje: parseBR('10/06/2026')!,
      continuaContribuindo: true,
      professor: true,
    });

    const ids = av.regras.map(r => r.id);
    expect(ids).toContain('prof_pontos');
    expect(ids).toContain('prof_idade');
    expect(ids).toContain('prof_ped100');
    expect(ids).toContain('prof_perm');
  });

  it('professora com 31 anos TC e 56 anos: pontos cumpridos (87 ≥ 88?)', () => {
    // TC = 31, idade = 56 → pontos = 87, mínimo 2026 = 88 → não cumprida
    const periodos: Periodo[] = [
      { ini: parseBR('01/01/1995')!, fim: parseBR('31/12/2025')! },
    ];
    const merged = mesclarPeriodos(periodos);
    const av = avaliarRegras({
      sexo: 'F',
      nasc: parseBR('01/01/1970')!,
      merged,
      hoje: parseBR('10/06/2026')!,
      continuaContribuindo: true,
      professor: true,
    });
    const prof = av.regras.find(r => r.id === 'prof_pontos')!;
    // 31 + 56.4 = 87.4 < 88 → não cumprida em 2026
    expect(prof.data).not.toBeNull(); // terá data de projeção
  });

  it('não inclui regras professor quando professor=false', () => {
    const periodos: Periodo[] = [
      { ini: parseBR('01/01/1995')!, fim: parseBR('31/12/2025')! },
    ];
    const merged = mesclarPeriodos(periodos);
    const av = avaliarRegras({
      sexo: 'F',
      nasc: parseBR('01/01/1970')!,
      merged,
      hoje: parseBR('10/06/2026')!,
    });
    const ids = av.regras.map(r => r.id);
    expect(ids).not.toContain('prof_pontos');
  });
});

// ===== PCD =====
describe('PCD — parâmetros', () => {
  it('TC mínimo PCD grave: H 25, M 20', () => {
    expect(TC_MINIMO_PCD.grave.M).toBe(25);
    expect(TC_MINIMO_PCD.grave.F).toBe(20);
  });

  it('TC mínimo PCD moderada: H 29, M 24', () => {
    expect(TC_MINIMO_PCD.moderada.M).toBe(29);
    expect(TC_MINIMO_PCD.moderada.F).toBe(24);
  });

  it('TC mínimo PCD leve: H 33, M 28', () => {
    expect(TC_MINIMO_PCD.leve.M).toBe(33);
    expect(TC_MINIMO_PCD.leve.F).toBe(28);
  });

  it('idade mínima PCD: H 60, M 55', () => {
    expect(IDADE_MINIMA_PCD.M).toBe(60);
    expect(IDADE_MINIMA_PCD.F).toBe(55);
  });

  it('coeficiente PCD por idade: 70% + 1%/ano', () => {
    expect(coefPCDIdade(15)).toBeCloseTo(0.85);
    expect(coefPCDIdade(20)).toBeCloseTo(0.90);
    expect(coefPCDIdade(30)).toBeCloseTo(1.00);
  });

  it('fator conversão entre graus: grave→leve = 33/25', () => {
    expect(FATOR_CONVERSAO_GRAU.leve.grave).toBeCloseTo(33 / 25);
  });
});

describe('PCD — avaliarRegras', () => {
  it('inclui regras PCD quando grauPCD informado', () => {
    const periodos: Periodo[] = [
      { ini: parseBR('01/01/1995')!, fim: parseBR('31/12/2025')! },
    ];
    const merged = mesclarPeriodos(periodos);
    const av = avaliarRegras({
      sexo: 'M',
      nasc: parseBR('01/01/1965')!,
      merged,
      hoje: parseBR('10/06/2026')!,
      continuaContribuindo: true,
      grauPCD: 'moderada',
    });

    const ids = av.regras.map(r => r.id);
    expect(ids).toContain('pcd_tc');
    expect(ids).toContain('pcd_idade');
  });

  it('PCD grave homem com 26 anos TC: cumprida (25)', () => {
    const periodos: Periodo[] = [
      { ini: parseBR('01/01/2000')!, fim: parseBR('31/12/2025')! },
    ];
    const merged = mesclarPeriodos(periodos);
    const av = avaliarRegras({
      sexo: 'M',
      nasc: parseBR('01/01/1965')!,
      merged,
      hoje: parseBR('10/06/2026')!,
      continuaContribuindo: true,
      grauPCD: 'grave',
    });

    const pcdTc = av.regras.find(r => r.id === 'pcd_tc')!;
    expect(pcdTc.cumprida).toBe(true);
  });

  it('PCD por idade homem 61 anos + 16 TC: cumprida', () => {
    const periodos: Periodo[] = [
      { ini: parseBR('01/01/2010')!, fim: parseBR('31/12/2025')! },
    ];
    const merged = mesclarPeriodos(periodos);
    const av = avaliarRegras({
      sexo: 'M',
      nasc: parseBR('01/01/1965')!,
      merged,
      hoje: parseBR('10/06/2026')!,
      continuaContribuindo: true,
      grauPCD: 'leve',
    });

    const pcdIdade = av.regras.find(r => r.id === 'pcd_idade')!;
    expect(pcdIdade.cumprida).toBe(true); // 61 ≥ 60 + 16 ≥ 15
  });

  it('não inclui regras PCD quando grauPCD ausente', () => {
    const periodos: Periodo[] = [
      { ini: parseBR('01/01/2000')!, fim: parseBR('31/12/2025')! },
    ];
    const merged = mesclarPeriodos(periodos);
    const av = avaliarRegras({
      sexo: 'M',
      nasc: parseBR('01/01/1965')!,
      merged,
      hoje: parseBR('10/06/2026')!,
    });
    const ids = av.regras.map(r => r.id);
    expect(ids).not.toContain('pcd_tc');
    expect(ids).not.toContain('pcd_idade');
  });
});
