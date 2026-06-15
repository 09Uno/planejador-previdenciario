import { describe, it, expect } from 'vitest';
import { extrairPPP, extrairCTC, extrairCTSM, extrairDatas, nomeProvavel, trecho } from '../src/extratores.js';

// Trechos representativos do texto extraído dos formulários padronizados do INSS
// (Anexo XVII - PPP, Anexo XV - CTC) e da Declaração de Tempo de Serviço Militar.

const PPP_TXT = `INSTITUTO NACIONAL DO SEGURO SOCIAL ANEXO XVII INSTRUÇÃO NORMATIVA PRES/INSS Nº 128, 28 DE MARÇO DE 2022
PERFIL PROFISSIOGRÁFICO PREVIDENCIÁRIO – PPP
2 – Nome Empresarial INDUSTRIA METALURGICA MODELO LTDA 3 – CNAE 24.51-2/00
4 – Nome do Trabalhador JOAO CARLOS DE OLIVEIRA 6 – CPF nº 123.456.789-00
7 – Data de Nascimento 10/05/1972 8 – Sexo (F/M) M 10 – Data de Admissão 02/01/1996
13 – LOTAÇÃO E ATRIBUIÇÃO 13.1 – Período 02 01 1996 a 11 11 2005 13.3 – Setor PRODUCAO 13.4 – Cargo OPERADOR DE MAQUINAS
REGISTROS AMBIENTAIS 15 – EXPOSIÇÃO A FATORES DE RISCOS 15.3 RUIDO 92 dB(A) Dosimetria N`;

const CTC_TXT = `INSTITUTO NACIONAL DO SEGURO SOCIAL ANEXO XV CERTIDÃO DE TEMPO DE CONTRIBUIÇÃO Nº 001/2026
ÓRGÃO EXPEDIDOR: PREFEITURA MUNICIPAL DE MODELO - RPPS CNPJ: 11.222.333/0001-44
NOME DO SERVIDOR: JOAO CARLOS DE OLIVEIRA SEXO: M CPF: 123.456.789-00 DATA DE NASCIMENTO: 10/05/1972
DATA DE ADMISSÃO: 01 06 2007 DATA DE EXONERAÇÃO/DEMISSÃO: 31 12 2015
PERÍODO DE CONTRIBUIÇÃO COMPREENDIDO NESTA CERTIDÃO: DE 01 06 2007 A 31 12 2015
DESTINAÇÃO DO TEMPO DE CONTRIBUIÇÃO: RGPS - INSS`;

const MIL_TXT = `MINISTÉRIO DA DEFESA EXÉRCITO BRASILEIRO DECLARAÇÃO DE TEMPO DE SERVIÇO MILITAR ANTERIOR
1.Eu, JOAO CARLOS DE OLIVEIRA Identidade nº 12.345.678-9 CPF nº 123.456.789-00
possuo 01 anos, 00 meses, 00 dias de tempo de serviço prestado a órgão público
2. Declaro também, nos Art. 299 e 304 do Decreto-Lei nº 2.848, de 7 de dezembro de 1940 e art. 312 do Decreto-Lei nº 1.001, de 21 de outubro de 1969`;

describe('extrairDatas', () => {
  it('lê dd/mm/aaaa e dd mm aaaa, ignora linhas em branco', () => {
    expect(extrairDatas('02/01/1996 a 11 11 2005 ____/____/____')).toEqual(['02/01/1996', '11/11/2005']);
  });
  it('lê data por extenso', () => {
    expect(extrairDatas('10 de maio de 1972')).toEqual(['10/05/1972']);
  });
});

describe('trecho (escopo por seção)', () => {
  it('recorta entre marcadores', () => {
    expect(trecho('aaa INICIO meio FIM zzz', /INICIO/, /FIM/).trim()).toBe('meio');
  });
});

describe('extrairPPP', () => {
  const r = extrairPPP(PPP_TXT);
  it('identifica o agente nocivo e a intensidade', () => {
    expect(r.agente).toBe('RUÍDO');
    expect(r.intensidade).toMatch(/92/);
  });
  it('sugere grau 25 (CONFERIR)', () => expect(r.grauSugerido).toBe(25));
  it('extrai o período de exposição sem ruído das datas legais', () => {
    expect(r.periodos).toEqual([{ ini: '02/01/1996', fim: '11/11/2005' }]);
  });
  it('extrai CPF e nascimento', () => {
    expect(r.cpf).toBe('123.456.789-00');
    expect(r.nascimento).toBe('10/05/1972');
  });
  it('sempre devolve avisos para conferência', () => expect(r.avisos.length).toBeGreaterThan(0));
});

describe('extrairCTC', () => {
  const r = extrairCTC(CTC_TXT);
  it('extrai o período certificado', () => {
    expect(r.periodos).toEqual([{ ini: '01/06/2007', fim: '31/12/2015' }]);
  });
  it('extrai CPF e nascimento', () => {
    expect(r.cpf).toBe('123.456.789-00');
    expect(r.nascimento).toBe('10/05/1972');
  });
});

describe('extrairCTSM', () => {
  const r = extrairCTSM(MIL_TXT);
  it('lê a duração declarada', () => {
    expect(r.duracao).toEqual({ anos: 1, meses: 0, dias: 0 });
  });
  it('NÃO confunde as datas dos Decretos-Lei com período militar', () => {
    expect(r.periodos).toEqual([]);
  });
  it('extrai CPF', () => expect(r.cpf).toBe('123.456.789-00'));
});

describe('nomeProvavel', () => {
  it('pega o nome em CAIXA, ignorando cabeçalhos', () => {
    expect(nomeProvavel('INSTITUTO NACIONAL DO SEGURO SOCIAL JOAO CARLOS DE OLIVEIRA')).toBe('JOAO CARLOS DE OLIVEIRA');
  });
});
