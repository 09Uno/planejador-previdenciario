import { describe, it, expect } from 'vitest';
import {
  calcularIRMensal, calcularROI, montarCenario, parseCNISLinhas, auditarCNIS,
  PARAMS_2026, dt,
} from '../src/index.js';

describe('IRPF mensal 2026 (Lei 15.270/2025)', () => {
  it('isento até R$ 5.000', () => {
    expect(calcularIRMensal(5000)).toBe(0);
    expect(calcularIRMensal(1621)).toBe(0);
    expect(calcularIRMensal(3000)).toBe(0);
  });
  it('redução parcial entre 5.000,01 e 7.350', () => {
    const ir6000 = calcularIRMensal(6000);
    expect(ir6000).toBeGreaterThan(0);
    expect(ir6000).toBeCloseTo(394.54, 1);
  });
  it('sem redução acima de 7.350 (teto 2026)', () => {
    expect(calcularIRMensal(8475.55)).toBeCloseTo(1255.07, 1);
  });
  it('isenção extra 65+ reduz o imposto', () => {
    expect(calcularIRMensal(8475.55, { isencao65: true })).toBeLessThan(calcularIRMensal(8475.55));
  });
});

describe('ROI — metodologia do escritório', () => {
  it('estrutura da planilha (fases antes/depois dos 65, 13 pagamentos)', () => {
    const r = calcularROI({
      rotulo: 'A', dataAposentadoria: '15/02/2033', idadeNaDER: 62,
      rmiBruta: 1621, contribuicaoMensal: 178.31, mesesContribuicao: 84,
    });
    expect(r.irMensalAte65).toBe(0); // isento (≤ 5.000)
    expect(r.ganhoAte65).toBeCloseTo(1621 * 13 * 3, 0);
    expect(r.ganhoApos65).toBeCloseTo(1621 * 13 * 18.9, 0); // tábua IBGE 2024: ES(65)=18,9
    expect(r.roiLiquido).toBeCloseTo(r.ganhoTotal - 178.31 * 84, 1);
  });
});

describe('cenários', () => {
  const perfil = {
    nome: 'Teste', sexo: 'F' as const, nascimento: '15/02/1971',
    periodos: [
      { ini: dt(1, 2, 1985), fim: dt(30, 6, 1992) },
      { ini: dt(1, 8, 1992), fim: dt(15, 3, 2005) },
    ],
    competencias: Array.from({ length: 60 }, (_, i) => ({
      competencia: `${String((i % 12) + 1).padStart(2, '0')}/${1995 + Math.floor(i / 12)}`,
      dias: 30, salarioContribuicao: 1200,
    })),
    carenciaAtual: 230,
  };
  it('art. 18 (62 anos) projeta DIB no aniversário de 62 e calcula RMI', () => {
    const c = montarCenario(perfil, { regra: 'art18', base: 'teto', cadencia: 'sem-parar', aliquota: 0.20, hoje: '11/06/2026' }, PARAMS_2026);
    expect(c.elegivel).toBe(true);
    expect(c.dib).toBe('15/02/2033');
    expect(c.mesesProjetados).toBeGreaterThan(70);
    expect(c.rmi!.rmi).toBeGreaterThan(PARAMS_2026.salarioMinimo);
    expect(c.roi!.roiLiquido).not.toBe(0);
  });
  it('cadência a cada 6 meses projeta ~1/6 das competências', () => {
    const c = montarCenario(perfil, { regra: 'art18', base: 'minimo', cadencia: 'cada-6-meses', aliquota: 0.11, hoje: '11/06/2026' }, PARAMS_2026);
    expect(c.elegivel).toBe(true);
    const cheio = montarCenario(perfil, { regra: 'art18', base: 'minimo', cadencia: 'sem-parar', aliquota: 0.11, hoje: '11/06/2026' }, PARAMS_2026);
    expect(c.mesesProjetados).toBeLessThan(cheio.mesesProjetados / 4);
  });
});

describe('CNIS parser + auditoria', () => {
  const linhas = [
    'Nome: MARIA DA SILVA Nome da mãe: ...',
    'Data de nascimento: 15/02/1971',
    '1 123.45678.90-1 EMPRESA ALFA LTDA Empregado 01/02/1985 30/06/1992',
    'Indicadores: PREM-EXT',
    '2 123.45678.90-1 RECOLHIMENTO Contribuinte Individual 01/08/1995 30/09/2001',
    '3 123.45678.90-1 RECOLHIMENTO Contribuinte Individual 01/01/2010',
    'Remunerações',
    '03/1995 1.200,00 04/1995 1.250,00',
    'Contribuições',
    '05/1995 10/06/1995 240,00 1.200,00',
  ];
  const r = parseCNISLinhas(linhas);
  it('extrai identificação, vínculos e competências', () => {
    expect(r.nome).toBe('MARIA DA SILVA');
    expect(r.nascimento).toBe('15/02/1971');
    expect(r.vinculos.length).toBe(3);
    expect(r.vinculos[1].tipo).toBe('CI');
    expect(r.vinculos[2].aberto).toBe(true);
    expect(r.competencias.find(c => c.comp === '05/1995')!.valor).toBe(1200);
    expect(r.indicadores).toContain('PREM-EXT');
  });
  it('auditoria gera pendências ordenadas por severidade', () => {
    const pend = auditarCNIS(r);
    expect(pend.some(p => p.titulo.includes('PREM-EXT'))).toBe(true);
    expect(pend.some(p => p.tipo === 'vinculo-aberto')).toBe(true);
    expect(pend.some(p => p.tipo === 'lacuna')).toBe(true);
    expect(pend[0].severidade).toBe('alta');
  });
});
