import { describe, it, expect } from 'vitest';
import { parseCNISLinhas } from '../src/cnis.js';
import { aplicarAtualizacao, extrairAvisosFator } from '../src/atualizacao.js';
import { calcularRMI } from '../src/rmi.js';
import type { Competencia } from '../src/types.js';

// ===================================================================
// 1. Parser de vínculos — linhas quebradas
// ===================================================================
describe('Parser CNIS — vínculos com linhas quebradas', () => {
  it('junta linhas de continuação e extrai vínculo completo', () => {
    // Simula layout real: seq + NIT numa linha, empresa/datas noutra
    const linhas = [
      '1 123.45678.90-1',
      'JUSTINO GODOY ORGANIZACAO CONTABIL Empregado 01/08/1986 18/12/1987',
      'Remunerações',
    ];
    const r = parseCNISLinhas(linhas);
    expect(r.vinculos.length).toBe(1);
    expect(r.vinculos[0].ini).toBe('01/08/1986');
    expect(r.vinculos[0].fim).toBe('18/12/1987');
  });

  it('extrai 6 vínculos da Dulcimara (linhas simuladas)', () => {
    const linhas = [
      'Nome: DULCIMARA RODRIGUES DOS SANTOS Nome da mãe: MARIA',
      'Data de nascimento: 15/02/1971',
      // Vínculo 1
      '1 123.45678.90-1 JUSTINO GODOY ORGANIZACAO CONTABIL Empregado 01/08/1986 18/12/1987',
      // Vínculo 2
      '2 123.45678.90-1 ESCRITORIO CONTABIL AGENDA LTDA Empregado 02/05/1988 12/05/1989',
      // Vínculo 3
      '3 123.45678.90-1 BAUDUCCO & CIA LTDA Empregado 26/07/1989 01/02/1991',
      // Vínculo 4 - nome longo que pode quebrar
      '4 123.45678.90-1 MERCADOCAR MERCANTIL',
      'DE PECAS LTDA Empregado 07/11/2011 09/05/2014',
      // Vínculo 5 - nome longo
      '5 123.45678.90-1 OUTBACK STEAKHOUSE',
      'RESTAURANTES 110837 Empregado 01/12/2014 08/03/2018',
      // Vínculo 6
      '6 123.45678.90-1 PHSR GESTAO DE RESTAURANTES LTDA Empregado 09/10/2018 11/07/2019',
    ];
    const r = parseCNISLinhas(linhas);
    expect(r.vinculos.length).toBe(6);
    expect(r.vinculos[0].ini).toBe('01/08/1986');
    expect(r.vinculos[3].ini).toBe('07/11/2011');
    expect(r.vinculos[3].fim).toBe('09/05/2014');
    expect(r.vinculos[4].ini).toBe('01/12/2014');
    expect(r.vinculos[5].ini).toBe('09/10/2018');
    expect(r.vinculos[5].fim).toBe('11/07/2019');
    expect(r.nome).toBe('DULCIMARA RODRIGUES DOS SANTOS');
    expect(r.nascimento).toBe('15/02/1971');
  });

  it('extrai vínculos CI do Gian Carlo (linhas simuladas)', () => {
    const linhas = [
      '1 111.22222.33-4 EMPRESÁRIO / EMPREGADOR Empregado 01/06/1995 31/12/1997',
      '7 111.22222.33-4 RECOLHIMENTO Contribuinte Individual 01/12/1999 31/12/1999',
      '10 111.22222.33-4 Pro Ita Corretora',
      'Seg. Ltda - Ativa Contribuinte Individual 01/09/2004 31/01/2007',
    ];
    const r = parseCNISLinhas(linhas);
    expect(r.vinculos.length).toBe(3);
    expect(r.vinculos[0].tipo).toBe('Empregado');
    expect(r.vinculos[1].tipo).toBe('CI');
    expect(r.vinculos[2].tipo).toBe('CI');
    expect(r.vinculos[2].ini).toBe('01/09/2004');
    expect(r.vinculos[2].fim).toBe('31/01/2007');
  });
});

// ===================================================================
// 2. Filtro PBC — competências < 07/1994
// ===================================================================
describe('Filtro PBC — competências anteriores a 07/1994', () => {
  it('calcularRMI ignora competências antes de 07/1994', () => {
    const comps: Competencia[] = [
      { competencia: '03/1994', dias: 30, salarioContribuicao: 500, salarioCorrigido: 5000 },
      { competencia: '06/1994', dias: 30, salarioContribuicao: 600, salarioCorrigido: 6000 },
      { competencia: '07/1994', dias: 30, salarioContribuicao: 700, salarioCorrigido: 7000 },
      { competencia: '08/1994', dias: 30, salarioContribuicao: 800, salarioCorrigido: 8000 },
    ];
    const params = { salarioMinimo: 1621, teto: 8475.55, divisorMinimo: 108, tabuaEs: { 62: 21.1 } };
    const r = calcularRMI({
      competencias: comps, tipo: 'media100_coef', tcTotalDias: 10000,
      idadeNaDER: 62, sexo: 'F', tcMinRegra: 15, params,
    });
    // Só 07 e 08/1994 devem entrar
    expect(r.parcelasPBC).toBe(2);
    expect(r.media).toBeCloseTo(7500, 0); // (7000 + 8000) / 2
  });

  it('erro se TODAS competências são < 07/1994', () => {
    const comps: Competencia[] = [
      { competencia: '01/1990', dias: 30, salarioContribuicao: 500, salarioCorrigido: 5000 },
    ];
    const params = { salarioMinimo: 1621, teto: 8475.55, divisorMinimo: 108, tabuaEs: {} };
    expect(() => calcularRMI({
      competencias: comps, tipo: 'media100_coef', tcTotalDias: 10000,
      idadeNaDER: 62, sexo: 'F', tcMinRegra: 15, params,
    })).toThrow('Sem competências no PBC');
  });
});

// ===================================================================
// 3. Fator 1.0 — só para projeções futuras
// ===================================================================
describe('Fator padrão 1.0 — alerta para históricas', () => {
  it('competência futura/projetada recebe fator 1.0 sem aviso', () => {
    const comps: Competencia[] = [
      { competencia: '12/2026', dias: 30, salarioContribuicao: 5000 },
    ];
    const result = aplicarAtualizacao(comps, { competenciaProjecaoDesde: '06/2026' });
    expect(result[0].indice).toBe(1);
    const avisos = extrairAvisosFator(result);
    expect(avisos.length).toBe(0);
  });

  it('competência histórica sem fator gera aviso', () => {
    const comps: Competencia[] = [
      { competencia: '03/2020', dias: 30, salarioContribuicao: 3000 },
    ];
    // Tabela vazia = nenhum fator para 03/2020
    const result = aplicarAtualizacao(comps, { tabelaFatores: {}, competenciaProjecaoDesde: '06/2026' });
    expect(result[0].indice).toBe(1); // fallback
    const avisos = extrairAvisosFator(result);
    expect(avisos.length).toBe(1);
    expect(avisos[0]).toContain('03/2020');
    expect(avisos[0]).toContain('tabela de fatores');
  });

  it('competência com fator na tabela não gera aviso', () => {
    const comps: Competencia[] = [
      { competencia: '01/2020', dias: 30, salarioContribuicao: 3000 },
    ];
    const result = aplicarAtualizacao(comps, {
      tabelaFatores: { '01/2020': 1.15 },
      competenciaProjecaoDesde: '06/2026',
    });
    expect(result[0].indice).toBe(1.15);
    expect(extrairAvisosFator(result).length).toBe(0);
  });

  it('competência com indice já preenchido na entrada não gera aviso', () => {
    const comps: Competencia[] = [
      { competencia: '01/2020', dias: 30, salarioContribuicao: 3000, indice: 1.25 },
    ];
    const result = aplicarAtualizacao(comps, { tabelaFatores: {}, competenciaProjecaoDesde: '06/2026' });
    expect(result[0].indice).toBe(1.25);
    expect(extrairAvisosFator(result).length).toBe(0);
  });
});
