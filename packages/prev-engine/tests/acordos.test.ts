import { describe, it, expect } from 'vitest';
import { parseBR } from '../src/dates.js';
import {
  PAISES_CONVENIADOS, diasExterior, rmiProRata,
  type PeriodoExterior,
} from '../src/acordos.js';

describe('Acordos internacionais', () => {
  it('lista de países conveniados inclui França', () => {
    expect(PAISES_CONVENIADOS).toContain('França');
    expect(PAISES_CONVENIADOS).toContain('Portugal');
    expect(PAISES_CONVENIADOS).toContain('Itália');
    expect(PAISES_CONVENIADOS.length).toBeGreaterThanOrEqual(20);
  });

  it('calcula dias de período no exterior', () => {
    const periodos: PeriodoExterior[] = [
      { pais: 'França', ini: parseBR('01/01/2010')!, fim: parseBR('31/12/2019')! },
    ];
    const dias = diasExterior(periodos);
    expect(dias).toBe(3652); // ~10 anos (01/01/2010 a 31/12/2019 inclusive)
  });

  it('RMI pro rata: proporção tempo brasileiro / total', () => {
    // Exemplo do roteiro: coeficiente proporcional 55,6%
    const rmiBrasileira = 5000;
    const diasBrasil = 7300;  // ~20 anos
    const diasTotal = 13140;   // ~36 anos
    const { rmiProporcional, coeficienteProporcional } = rmiProRata(rmiBrasileira, diasBrasil, diasTotal);

    expect(coeficienteProporcional).toBeCloseTo(0.556, 2);
    expect(rmiProporcional).toBeCloseTo(2777.78, 0);
  });

  it('pro rata com todo o tempo no Brasil = RMI integral', () => {
    const { rmiProporcional, coeficienteProporcional } = rmiProRata(5000, 10000, 10000);
    expect(coeficienteProporcional).toBe(1);
    expect(rmiProporcional).toBe(5000);
  });

  it('pro rata sem tempo = 0', () => {
    const { rmiProporcional } = rmiProRata(5000, 0, 0);
    expect(rmiProporcional).toBe(0);
  });
});
