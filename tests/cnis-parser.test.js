// Teste do leitor de CNIS. Uso:
//   npm install pdfjs-dist@3.11.174
//   node tests/cnis-parser.test.js "C:\caminho\para\extrato.pdf"
const { parseCNISLinhas, itensParaLinhas } = require('../src/core/cnis-parser');
const caminho = process.argv[2];
if (!caminho) { console.log('Informe o caminho do PDF do CNIS. Ex.: node tests/cnis-parser.test.js extrato.pdf'); process.exit(0); }
(async () => {
  const pdfjs = require('pdfjs-dist/legacy/build/pdf.js');
  const fs = require('fs');
  const data = new Uint8Array(fs.readFileSync(caminho));
  const doc = await pdfjs.getDocument({ data, useSystemFonts: true }).promise;
  let linhas = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    linhas = linhas.concat(itensParaLinhas(tc.items, page.getViewport({ scale: 1 }), pdfjs.Util));
  }
  const r = parseCNISLinhas(linhas);
  console.log('Nome:', r.nome, '| Nascimento:', r.nascimento);
  console.log('Vínculos:', r.vinculos.length);
  r.vinculos.forEach(v => console.log(`  seq ${v.seq}: ${v.origem} | ${v.ini} -> ${v.fim || '(aberto)'} | ${v.tipo}`));
  console.log('Competências:', r.competencias.length);
  console.log('Indicadores:', [...r.indicadores].join(', ') || '-');
  r.avisos.forEach(a => console.log('⚠', a));
})().catch(e => { console.error(e.message); process.exit(1); });
