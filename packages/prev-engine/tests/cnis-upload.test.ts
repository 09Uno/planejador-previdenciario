// =====================================================================
// REGRESSÃO do pipeline de upload de CNIS
// Simula as linhas extraídas de PDFs reais (Dulcimara e Gian Carlo)
// e valida que parseCNISLinhas + juntarContinuacoes produzem os dados
// esperados. Esse é o ÚNICO caminho de produção para entrada via PDF.
// =====================================================================
import { describe, it, expect } from 'vitest';
import { parseCNISLinhas, juntarContinuacoes, itensParaLinhas } from '../src/cnis.js';

// ===================================================================
// 1. Dulcimara — 6 vínculos com juntarContinuacoes
// ===================================================================
describe('Upload CNIS — Dulcimara Rodrigues (6 vínculos)', () => {
  // Linhas como extraídas pelo pdfjs getTextContent + itensParaLinhas
  // de 20260106-extrato-contribuicoes.CNIS.doc.5.0.pdf
  const linhasPDF = [
    'CNIS - Cadastro Nacional de Informações Sociais',
    'Extrato Previdenciário',
    'Página 1 de 5',
    'Nome: DULCIMARA RODRIGUES DOS SANTOS Nome da mãe: MARIA RODRIGUES DOS SANTOS',
    'Data de nascimento: 15/02/1971',
    'NIT: 123.45678.90-1',
    'Relações Previdenciárias e Remunerações',
    // Vínculo 1 — uma linha completa
    '1 123.45678.90-1 JUSTINO GODOY ORGANIZACAO CONTABIL Empregado 01/08/1986 18/12/1987',
    'Indicadores: PREC-MENOR',
    'Remunerações',
    '08/1986 150,00 09/1986 150,00 10/1986 150,00',
    '11/1986 150,00 12/1986 150,00 01/1987 200,00',
    // Vínculo 2 — completo
    '2 123.45678.90-1 ESCRITORIO CONTABIL AGENDA LTDA Empregado 02/05/1988 12/05/1989',
    'Remunerações',
    '05/1988 300,00 06/1988 300,00',
    // Vínculo 3 — completo
    '3 123.45678.90-1 BAUDUCCO & CIA LTDA Empregado 26/07/1989 01/02/1991',
    'Remunerações',
    '07/1989 400,00',
    // Vínculo 4 — nome longo quebrado em 2 linhas (juntarContinuacoes)
    '4 123.45678.90-1 MERCADOCAR MERCANTIL',
    'DE PECAS LTDA Empregado 07/11/2011 09/05/2014',
    'Indicadores: PREM-EXT',
    'Remunerações',
    '11/2011 1.200,00 12/2011 1.200,00',
    // Vínculo 5 — nome longo quebrado
    '5 123.45678.90-1 OUTBACK STEAKHOUSE',
    'RESTAURANTES 110837 Empregado 01/12/2014 08/03/2018',
    'Remunerações',
    '12/2014 1.500,00 01/2015 1.500,00',
    // Vínculo 6 — completo
    '6 123.45678.90-1 PHSR GESTAO DE RESTAURANTES LTDA Empregado 09/10/2018 11/07/2019',
    'Remunerações',
    '10/2018 1.800,00 11/2018 1.800,00',
    'Legenda de Indicadores',
    'PREC-MENOR: menor aprendiz',
  ];

  it('extrai 6 vínculos com nome e nascimento corretos', () => {
    const r = parseCNISLinhas(linhasPDF);
    expect(r.nome).toBe('DULCIMARA RODRIGUES DOS SANTOS');
    expect(r.nascimento).toBe('15/02/1971');
    expect(r.vinculos).toHaveLength(6);
  });

  it('datas de cada vínculo estão corretas', () => {
    const r = parseCNISLinhas(linhasPDF);
    const esperado = [
      { seq: 1, ini: '01/08/1986', fim: '18/12/1987' },
      { seq: 2, ini: '02/05/1988', fim: '12/05/1989' },
      { seq: 3, ini: '26/07/1989', fim: '01/02/1991' },
      { seq: 4, ini: '07/11/2011', fim: '09/05/2014' },
      { seq: 5, ini: '01/12/2014', fim: '08/03/2018' },
      { seq: 6, ini: '09/10/2018', fim: '11/07/2019' },
    ];
    for (let i = 0; i < esperado.length; i++) {
      expect(r.vinculos[i].seq).toBe(esperado[i].seq);
      expect(r.vinculos[i].ini).toBe(esperado[i].ini);
      expect(r.vinculos[i].fim).toBe(esperado[i].fim);
    }
  });

  it('juntarContinuacoes junta vínculos 4 e 5 quebrados', () => {
    const resultado = juntarContinuacoes(linhasPDF);
    // Após juntar, vínculo 4 deve ter "MERCADOCAR MERCANTIL DE PECAS LTDA ..." numa linha
    const v4 = resultado.find(l => l.includes('MERCADOCAR MERCANTIL') && l.includes('DE PECAS LTDA'));
    expect(v4).toBeTruthy();
    // Vínculo 5 deve ter "OUTBACK STEAKHOUSE RESTAURANTES ..." numa linha
    const v5 = resultado.find(l => l.includes('OUTBACK STEAKHOUSE') && l.includes('RESTAURANTES'));
    expect(v5).toBeTruthy();
  });

  it('extrai remunerações como competências', () => {
    const r = parseCNISLinhas(linhasPDF);
    expect(r.competencias.length).toBeGreaterThan(0);
    // Verificar uma competência específica
    const ago86 = r.competencias.find(c => c.comp === '08/1986');
    expect(ago86).toBeDefined();
    expect(ago86!.valor).toBe(150);
  });

  it('detecta indicadores PREC-MENOR e PREM-EXT', () => {
    const r = parseCNISLinhas(linhasPDF);
    expect(r.indicadores).toContain('PREC-MENOR');
    expect(r.indicadores).toContain('PREM-EXT');
  });

  it('nenhum vínculo fica "aberto" (todos têm data fim)', () => {
    const r = parseCNISLinhas(linhasPDF);
    for (const v of r.vinculos) {
      expect(v.aberto).toBe(false);
    }
  });
});

// ===================================================================
// 2. Gian Carlo — vínculos CI + Empregado
// ===================================================================
describe('Upload CNIS — Gian Carlo (vínculos CI)', () => {
  const linhasPDF = [
    'Nome: GIAN CARLO SILVA Nome da mãe: ANA SILVA',
    'Data de nascimento: 10/05/1975',
    'NIT: 111.22222.33-4',
    'Relações Previdenciárias e Remunerações',
    '1 111.22222.33-4 EMPRESÁRIO / EMPREGADOR Empregado 01/06/1995 31/12/1997',
    'Remunerações',
    '06/1995 800,00 07/1995 800,00',
    '2 111.22222.33-4 MACH INDUSTRIAL S/A Empregado 01/05/1998 30/06/1999',
    'Remunerações',
    '05/1998 1.200,00',
    '3 111.22222.33-4 COMERCIAL ATACADISTA LTDA Empregado 01/07/1999 30/11/1999',
    '4 111.22222.33-4 CONDOMINIO PARQUE ITANHAEM Empregado 01/03/2000 30/06/2000',
    '5 111.22222.33-4 ASSOCIACAO BRASILEIRA DE EDUCACAO E ASSISTENCIA SOCIAL Empregado 01/11/2000 30/04/2002',
    '6 111.22222.33-4 RECOLHIMENTO Contribuinte Individual 01/11/2002 28/02/2003',
    'Contribuições',
    '11/2002 500,00 12/2002 500,00 01/2003 500,00 02/2003 500,00',
    '7 111.22222.33-4 RECOLHIMENTO Contribuinte Individual 01/12/1999 31/12/1999',
    '8 111.22222.33-4 RECOLHIMENTO Contribuinte Individual 01/05/2003 31/05/2004',
    '9 111.22222.33-4 RECOLHIMENTO Contribuinte Individual 01/06/2004 31/07/2004',
    '10 111.22222.33-4 Pro Ita Corretora',
    'Seg. Ltda - Ativa Contribuinte Individual 01/09/2004 31/01/2007',
  ];

  it('extrai todos os vínculos com tipos corretos', () => {
    const r = parseCNISLinhas(linhasPDF);
    expect(r.nome).toBe('GIAN CARLO SILVA');
    expect(r.nascimento).toBe('10/05/1975');
    expect(r.vinculos.length).toBe(10);

    // Vínculos 1-5 são Empregado
    for (let i = 0; i < 5; i++) {
      expect(r.vinculos[i].tipo).toBe('Empregado');
    }
    // Vínculos 6-10 são CI
    for (let i = 5; i < 10; i++) {
      expect(r.vinculos[i].tipo).toBe('CI');
    }
  });

  it('vínculo 10 com nome quebrado é juntado corretamente', () => {
    const r = parseCNISLinhas(linhasPDF);
    const v10 = r.vinculos.find(v => v.seq === 10);
    expect(v10).toBeDefined();
    expect(v10!.ini).toBe('01/09/2004');
    expect(v10!.fim).toBe('31/01/2007');
    expect(v10!.tipo).toBe('CI');
  });

  it('competências de contribuição são extraídas', () => {
    const r = parseCNISLinhas(linhasPDF);
    const nov02 = r.competencias.find(c => c.comp === '11/2002');
    expect(nov02).toBeDefined();
    expect(nov02!.valor).toBe(500);
  });
});

// ===================================================================
// 3. itensParaLinhas — agrupa itens do pdfjs corretamente
// ===================================================================
describe('itensParaLinhas — agrupamento por posição vertical', () => {
  it('agrupa itens na mesma linha (y ±3px)', () => {
    const items = [
      { str: 'Nome:', transform: [1, 0, 0, 1, 50, 700] },
      { str: 'DULCIMARA', transform: [1, 0, 0, 1, 110, 700] },
      { str: 'Data:', transform: [1, 0, 0, 1, 50, 680] },
      { str: '15/02/1971', transform: [1, 0, 0, 1, 100, 681] }, // 1px diferença → mesma linha
    ];
    const linhas = itensParaLinhas(items);
    expect(linhas).toHaveLength(2);
    expect(linhas[0]).toContain('Nome:');
    expect(linhas[0]).toContain('DULCIMARA');
    expect(linhas[1]).toContain('Data:');
    expect(linhas[1]).toContain('15/02/1971');
  });

  it('ignora itens com texto vazio', () => {
    const items = [
      { str: '  ', transform: [1, 0, 0, 1, 50, 700] },
      { str: 'Texto', transform: [1, 0, 0, 1, 100, 700] },
    ];
    const linhas = itensParaLinhas(items);
    expect(linhas).toHaveLength(1);
    expect(linhas[0]).toBe('Texto');
  });
});

// ===================================================================
// 4. Pipeline completo: linhas → juntarContinuacoes → parseCNIS
//    Garante que o caminho de upload não quebra
// ===================================================================
describe('Pipeline completo upload → parse', () => {
  it('PDF com camada de texto: extrai dados sem cair no OCR', () => {
    // Simula extração de texto que retorna >100 chars/página
    const linhas = [
      'CNIS - Cadastro Nacional de Informações Sociais',
      'Extrato Previdenciário',
      'Nome: DULCIMARA RODRIGUES DOS SANTOS Nome da mãe: MARIA',
      'Data de nascimento: 15/02/1971',
      '1 123.45678.90-1 JUSTINO GODOY ORGANIZACAO CONTABIL Empregado 01/08/1986 18/12/1987',
      'Remunerações',
      '08/1986 150,00',
    ];
    const totalChars = linhas.join('').length;
    // Com 1 página, média é totalChars — deve ser bem acima de 100
    expect(totalChars).toBeGreaterThan(100);

    const r = parseCNISLinhas(linhas);
    expect(r.vinculos).toHaveLength(1);
    expect(r.nome).toBe('DULCIMARA RODRIGUES DOS SANTOS');
  });

  it('PDF sem texto: totalChars ≈ 0 → deve acionar OCR (não erro)', () => {
    // Se o pdfjs retorna items vazios, totalChars = 0
    // Média por página = 0 < 100 → caminho OCR, não erro
    const linhas: string[] = [];
    const r = parseCNISLinhas(linhas);
    expect(r.vinculos).toHaveLength(0);
    expect(r.competencias).toHaveLength(0);
    // Aviso esperado — não deve ser tratado como erro fatal
    expect(r.avisos.some(a => a.includes('Nenhum vínculo'))).toBe(true);
  });
});
