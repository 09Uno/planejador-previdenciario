// Regressão do parser de CNIS contra as LINHAS REAIS (pdfjs → itensParaLinhas)
// dos extratos dos casos-modelo. Se este teste quebrar, o upload do app quebra.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCNISLinhas } from '../src/index.js';

const dir = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');
const carregar = (f: string): string[] => JSON.parse(readFileSync(join(dir, f), 'utf8'));

describe('CNIS real — Dulcimara (linhas pdfjs)', () => {
  const r = parseCNISLinhas(carregar('cnis-dulcimara-linhas.json'));
  it('identificação', () => {
    expect(r.nome).toBe('DULCIMARA RODRIGUES DOS SANTOS');
    expect(r.nascimento).toBe('15/02/1971');
  });
  it('extrai os 6 vínculos com datas corretas', () => {
    expect(r.vinculos.length).toBe(6);
    const datas = r.vinculos.map(v => `${v.ini}-${v.fim}`);
    expect(datas).toEqual([
      '01/08/1986-18/12/1987', '02/05/1988-12/05/1989', '26/07/1989-01/02/1991',
      '07/11/2011-09/05/2014', '01/12/2014-08/03/2018', '09/10/2018-11/07/2019',
    ]);
  });
  it('extrai as competências (incluindo as da última linha antes do rodapé)', () => {
    expect(r.competencias.length).toBe(125);
    expect(r.competencias[0]).toEqual({ comp: '01/1987', valor: 963.99 });
    const m = new Map(r.competencias.map(c => [c.comp, c.valor]));
    // pareamento fiel ao extrato impresso (pró-rata da admissão em 07/11/2011)
    expect(m.get('11/2011')).toBe(851.13);
    // competências que o bug do rodapé engolia (linhas finais de cada página)
    expect(m.get('01/2012')).toBe(1073.77);
    expect(m.get('04/2016')).toBe(1394.06);
    expect(m.get('07/2019')).toBe(1363.27);
  });
});

describe('CNIS real — Gian (linhas pdfjs)', () => {
  const r = parseCNISLinhas(carregar('cnis-gian-linhas.json'));
  it('extrai vínculos e competências', () => {
    expect(r.vinculos.length).toBeGreaterThanOrEqual(1);
    expect(r.competencias.length).toBeGreaterThanOrEqual(50);
  });
});
