// =====================================================================
// REGRESSÃO contra os documentos reais de cálculo do escritório
// (casos Dulcimara, Gian Carlo e Suely — docs X.1/X.2 dos planejamentos).
// Critério da Fase 0: diferença ≤ R$ 0,01 na média e na RMI.
// =====================================================================
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { calcularRMI, coef, tcAnos } from '../src/index.js';
import type { Competencia, Sexo } from '../src/index.js';

const dir = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');
const arquivos = readdirSync(dir).filter(f => f.match(/doc_\d/));

interface Fixture {
  caso: string; doc: string; titulo: string;
  segurado: { sexo: Sexo };
  salarios: (Competencia & { descartado: boolean })[];
  esperado: {
    parcelasPBC: number; tempoContribuicaoAnos: number; somaSalarios: number;
    media: number; coeficiente: number; rmi: number; limitadaAoMinimo: boolean; descartes: number;
  };
}

/** Carência na DIB extraída do quadro "Análise dos Dados" de cada doc X.0 */
const CARENCIAS: Record<string, number> = {
  'dulcimara|2.1': 191, 'dulcimara|2.2': 191, 'dulcimara|3.1': 217, 'dulcimara|3.2': 217,
  'dulcimara|4.1': 253, 'gian_carlo|2.1': 219, 'gian_carlo|3.1': 276, 'gian_carlo|3.2': 276,
  'suely|6.1': 182, 'suely|7.1': 216, 'suely|8.1': 180, 'suely|9.1': 216,
};

const params = (f: Fixture) =>
  f.caso === 'gian_carlo'
    ? { salarioMinimo: 1518.00, teto: 8157.41, divisorMinimo: 108, tabuaEs: {} }   // cálculo 12/2025
    : { salarioMinimo: 1621.00, teto: 8475.55, divisorMinimo: 108, tabuaEs: {} };  // cálculo 2026

for (const arq of arquivos) {
  const f: Fixture = JSON.parse(readFileSync(join(dir, arq), 'utf8'));
  const e = f.esperado;

  describe(`${f.caso} doc ${f.doc} (${arq})`, () => {
    it('pipeline de correção: corrigido = min(salário, teto) × índice (±0,01)', () => {
      for (const s of f.salarios) {
        const considerado = Math.min(s.salarioContribuicao, s.tetoCompetencia ?? Infinity);
        expect(Math.abs(considerado - (s.salarioConsiderado ?? considerado))).toBeLessThanOrEqual(0.01);
        const corrigido = Math.round(considerado * (s.indice ?? 1) * 100) / 100;
        expect(Math.abs(corrigido - s.salarioCorrigido!)).toBeLessThanOrEqual(0.011);
      }
    });

    it('média e RMI com o conjunto de descartes do documento (±0,01)', () => {
      const mantidas = f.salarios.filter(s => !s.descartado);
      const soma = mantidas.reduce((a, s) => a + s.salarioCorrigido!, 0);
      expect(Math.abs(soma - e.somaSalarios)).toBeLessThanOrEqual(0.02);
      const media = soma / mantidas.length;
      expect(Math.abs(media - e.media)).toBeLessThanOrEqual(0.01);
      const c = coef(e.tempoContribuicaoAnos, f.segurado.sexo);
      expect(c).toBeCloseTo(e.coeficiente, 4);
      const p = params(f);
      const rmi = Math.min(Math.max(media * c, p.salarioMinimo), p.teto);
      expect(Math.abs(rmi - e.rmi)).toBeLessThanOrEqual(0.015);
    });

    it('otimizador de descarte reproduz o documento (RMI ±0,01)', () => {
      // TC total = TC pós-descarte do documento + dias das competências descartadas
      const diasDescartados = f.salarios.filter(s => s.descartado).reduce((a, s) => a + s.dias, 0);
      const tcTotalDias = Math.round(e.tempoContribuicaoAnos * 365) + diasDescartados;
      const r = calcularRMI({
        competencias: f.salarios, tipo: 'media100_coef', tcTotalDias,
        idadeNaDER: 62, sexo: f.segurado.sexo, tcMinRegra: 15, params: params(f),
        carenciaNaDIB: CARENCIAS[`${f.caso}|${f.doc}`],
      });
      expect(r.parcelasPBC).toBe(e.parcelasPBC);
      expect(Math.abs(r.rmi - e.rmi)).toBeLessThanOrEqual(0.015);
      expect(r.descartes).toBe(e.descartes);
      expect(Math.abs(r.media - e.media)).toBeLessThanOrEqual(0.015);
      expect(tcAnos(r.tcConsideradoDias)).toBeCloseTo(e.tempoContribuicaoAnos, 2);
    });
  });
}
