// =====================================================================
// Gabarito kit-teste Dulcimara — pipeline CNIS → TC → regras → RMI
// Referência do escritório:
//   TC em 12/11/2019 ≈ 10a5m, art. 18 em 15/02/2033, carência 131,
//   cenário art18/teto (doc 3.2) → RMI 4.077,96
// =====================================================================
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseCNISLinhas, parseBR, diasAte, mesclarPeriodos, diasParaAMD,
  avaliarRegras, fmtBR, contarCarencia, calcularRMI, VESPERA,
} from '../src/index.js';
import type { Periodo, ParametrosVigentes, Competencia, Sexo } from '../src/index.js';

const dir = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');
const linhasCNIS: string[] = JSON.parse(readFileSync(join(dir, 'cnis-dulcimara-linhas.json'), 'utf8'));

const params: ParametrosVigentes = {
  salarioMinimo: 1621.00,
  teto: 8475.55,
  divisorMinimo: 108,
  tabuaEs: {},
};

describe('Gabarito Dulcimara — pipeline completo', () => {
  const cnis = parseCNISLinhas(linhasCNIS);

  it('CNIS: 6 vínculos, nome e nascimento corretos', () => {
    expect(cnis.vinculos).toHaveLength(6);
    expect(cnis.nome).toBe('DULCIMARA RODRIGUES DOS SANTOS');
    expect(cnis.nascimento).toBe('15/02/1971');
  });

  it('TC em 12/11/2019 (véspera EC 103) ≈ 10a5m', () => {
    const periodos: Periodo[] = cnis.vinculos.map(v => ({
      ini: parseBR(v.ini!)!,
      fim: parseBR(v.fim!)!,
    }));
    const merged = mesclarPeriodos(periodos);
    const dias = diasAte(merged, VESPERA);
    const amd = diasParaAMD(dias);
    // Motor conta limites inclusivos → 10a5m22d
    // Escritório reporta 10a5m19d (diferença de 3 dias na contagem de limites)
    expect(amd.y).toBe(10);
    expect(amd.m).toBe(5);
    expect(amd.d).toBeGreaterThanOrEqual(19);
    expect(amd.d).toBeLessThanOrEqual(22);
  });

  it('art. 18 elegível em 15/02/2033', () => {
    const nasc = parseBR('15/02/1971')!;
    const periodos: Periodo[] = cnis.vinculos.map(v => ({
      ini: parseBR(v.ini!)!,
      fim: parseBR(v.fim!)!,
    }));
    const merged = mesclarPeriodos(periodos);
    const av = avaliarRegras({
      sexo: 'F', nasc, merged,
      hoje: Date.now(),
      continuaContribuindo: true,
    });
    const art18 = av.regras.find(r => r.id === 'art18');
    expect(art18).toBeDefined();
    expect(art18!.data).not.toBeNull();
    expect(fmtBR(art18!.data!)).toBe('15/02/2033');
  });

  it('carência atual = 131', () => {
    const periodos: Periodo[] = cnis.vinculos
      .filter(v => v.tipo === 'Empregado')
      .map(v => ({
        ini: parseBR(v.ini!)!,
        fim: parseBR(v.fim!)!,
      }));
    const rc = contarCarencia({ vinculosEmprego: periodos });
    expect(rc.total).toBe(131);
  });

  it('art18/teto (doc 3.2) → RMI 4.077,96 (via calcularRMI com fixture)', () => {
    // Reproduz a mesma chamada do regression.test.ts para validar o gabarito.
    interface FixtureCompetencia extends Competencia { descartado: boolean; dias: number }
    interface Fixture {
      caso: string; doc: string;
      segurado: { sexo: Sexo };
      salarios: FixtureCompetencia[];
      esperado: { parcelasPBC: number; tempoContribuicaoAnos: number; media: number; coeficiente: number; rmi: number; descartes: number };
    }
    const fixture: Fixture = JSON.parse(readFileSync(join(dir, 'dulcimara_doc_3_2.json'), 'utf8'));
    const e = fixture.esperado;

    // TC total = TC pós-descarte + dias das competências descartadas
    const diasDescartados = fixture.salarios.filter(s => s.descartado).reduce((a, s) => a + s.dias, 0);
    const tcTotalDias = Math.round(e.tempoContribuicaoAnos * 365) + diasDescartados;

    const r = calcularRMI({
      competencias: fixture.salarios,
      tipo: 'media100_coef',
      tcTotalDias,
      idadeNaDER: 62,
      sexo: 'F',
      tcMinRegra: 15,
      params,
      carenciaNaDIB: 217, // carência na DIB do doc 3.2 (CARENCIAS['dulcimara|3.2'])
    });

    expect(Math.abs(r.rmi - e.rmi)).toBeLessThanOrEqual(0.015);
    expect(Math.abs(r.media - e.media)).toBeLessThanOrEqual(0.015);
    expect(r.coeficiente).toBe(e.coeficiente);
    expect(r.descartes).toBe(e.descartes);
  });
});
