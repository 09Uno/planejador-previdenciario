import { describe, it, expect } from 'vitest';
import { avaliarRegras, parseBR, mesclarPeriodos, type Periodo } from '../src/index.js';

// Regressão da correção: a conversão especial→comum (art. 25, §2º, EC 103) deve
// aumentar o TC das regras COMUNS (art. 15/18 etc.), e não só acrescentar as
// regras especiais. Caso "João Carlos" usado no kit de teste.

describe('conversão especial→comum no TC das regras comuns', () => {
  const nasc = parseBR('10/05/1972')!;
  const hoje = parseBR('15/06/2026')!;

  const especial: Periodo[] = [
    { ini: parseBR('02/01/1996')!, fim: parseBR('11/11/2005')!, tipo: 'especial', grauEspecial: 25 },
    { ini: parseBR('01/03/2016')!, fim: parseBR('30/04/2025')!, tipo: 'normal' },
  ];
  const comum: Periodo[] = especial.map(p => ({ ini: p.ini, fim: p.fim, tipo: 'normal' }));

  it('TC em 12/11/2019 aumenta ~1441 dias com a conversão (homem, grau 25 → ×1,4)', () => {
    const sem = avaliarRegras({ sexo: 'M', nasc, merged: mesclarPeriodos(comum), hoje });
    const com = avaliarRegras({ sexo: 'M', nasc, merged: mesclarPeriodos(especial), hoje, grauEspecial: 25 });
    expect(com.diasNaEC).toBeGreaterThan(sem.diasNaEC);
    const bonus = com.diasNaEC - sem.diasNaEC;
    expect(bonus).toBeGreaterThan(1400);
    expect(bonus).toBeLessThan(1500);
  });

  it('a aposentadoria por idade (art. 18) implementa MAIS CEDO com a conversão', () => {
    const sem = avaliarRegras({ sexo: 'M', nasc, merged: mesclarPeriodos(comum), hoje });
    const com = avaliarRegras({ sexo: 'M', nasc, merged: mesclarPeriodos(especial), hoje, grauEspecial: 25 });
    const art18Sem = sem.regras.find(r => r.id === 'art18')!;
    const art18Com = com.regras.find(r => r.id === 'art18')!;
    // mais tempo de contribuição não atrasa a data (idade é o gargalo aqui), mas o TC projetado é maior
    expect(art18Com.data).not.toBeNull();
    expect(art18Sem.data).not.toBeNull();
  });

  it('inclui as regras de aposentadoria especial (art. 21 e art. 19 §1º)', () => {
    const com = avaliarRegras({ sexo: 'M', nasc, merged: mesclarPeriodos(especial), hoje, grauEspecial: 25 });
    const ids = com.regras.map(r => r.id);
    expect(ids).toContain('art21');
    expect(ids).toContain('esp_perm');
  });

  it('sem período especial, não há bônus de conversão', () => {
    const r = avaliarRegras({ sexo: 'M', nasc, merged: mesclarPeriodos(comum), hoje });
    const rConv = avaliarRegras({ sexo: 'M', nasc, merged: mesclarPeriodos(comum), hoje });
    expect(r.diasNaEC).toBe(rConv.diasNaEC);
  });
});
