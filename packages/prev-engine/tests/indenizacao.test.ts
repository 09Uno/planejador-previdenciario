import { describe, it, expect } from 'vitest';
import { calcularIndenizacao, DATA_CORTE_JUROS } from '../src/indenizacao.js';

describe('Indenização art. 45-A', () => {
  it('calcula base = média80 × 20%', () => {
    const r = calcularIndenizacao({
      competencias: ['01/2000'],
      media80PorcentoMaiores: 5000,
    });
    expect(r.baseCalculo).toBe(1000); // 5000 × 0.20
    expect(r.numCompetencias).toBe(1);
  });

  it('competências antes de 14/10/1996 não têm juros nem multa', () => {
    const r = calcularIndenizacao({
      competencias: ['01/1990', '06/1993', '12/1995'],
      media80PorcentoMaiores: 3000,
    });
    expect(r.competenciasSemJuros).toBe(3);
    expect(r.competenciasComJuros).toBe(0);
    expect(r.multa).toBe(0);
    expect(r.juros).toBe(0);
    expect(r.total).toBe(r.subtotalBase);
  });

  it('competências após 14/10/1996 têm juros e multa', () => {
    const r = calcularIndenizacao({
      competencias: ['01/2000', '02/2000'],
      media80PorcentoMaiores: 5000,
    });
    expect(r.competenciasComJuros).toBe(2);
    expect(r.juros).toBeGreaterThan(0);
    expect(r.multa).toBeGreaterThan(0);
    expect(r.total).toBeGreaterThan(r.subtotalBase);
  });

  it('multa = 10% sobre base das competências com juros', () => {
    const r = calcularIndenizacao({
      competencias: ['01/2020'],
      media80PorcentoMaiores: 5000,
    });
    // base = 1000, multa = 1000 × 0.10 = 100
    expect(r.multa).toBe(100);
  });

  it('juros limitados a 50% do valor', () => {
    // Competência muito antiga (mas ≥ 14/10/1996): muitos meses, cap 50%
    const r = calcularIndenizacao({
      competencias: ['11/1996'],
      media80PorcentoMaiores: 5000,
    });
    // base = 1000, juros cap = 50% × 1000 = 500
    expect(r.juros).toBeLessThanOrEqual(500);
  });

  it('calcula média 80% a partir dos salários', () => {
    const salarios = [1000, 2000, 3000, 4000, 5000];
    // 80% maiores = top 4: [5000, 4000, 3000, 2000] → média = 3500
    const r = calcularIndenizacao({
      competencias: ['01/2020'],
      salariosCorrigidos: salarios,
    });
    expect(r.media80).toBe(3500);
    expect(r.baseCalculo).toBe(700); // 3500 × 0.20
  });

  it('memória de cálculo completa', () => {
    const r = calcularIndenizacao({
      competencias: ['01/1990', '01/2020'],
      media80PorcentoMaiores: 4000,
    });
    expect(r.numCompetencias).toBe(2);
    expect(r.competenciasSemJuros).toBe(1);
    expect(r.competenciasComJuros).toBe(1);
    expect(r.valorBasePorComp).toBe(800); // 4000 × 0.20
    expect(r.subtotalBase).toBe(1600);
    expect(r.total).toBeGreaterThan(r.subtotalBase);
  });
});
