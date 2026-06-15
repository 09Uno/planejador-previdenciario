// Gera os arquivos de entrada para testar o app web a partir dos fixtures
// reais (packages/prev-engine/tests/fixtures). Rodar da raiz do repositório:
//   node kit-teste/gerar-entradas.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const kit = dirname(fileURLToPath(import.meta.url));
const fixtures = join(kit, '..', 'packages', 'prev-engine', 'tests', 'fixtures');
const outDir = join(kit, 'entradas');
mkdirSync(outDir, { recursive: true });

const contagens = JSON.parse(readFileSync(join(fixtures, 'contagens.json'), 'utf8'));

const fmtBR = (n) => n.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');

function gerarCaso(caso, docSalarios, anoCorteProjecao) {
  const c = contagens.casos[caso];
  if (!c) { console.warn(`contagens.json sem o caso ${caso}`); return; }

  // 1) períodos REAIS (doc 1.0 — sem os períodos projetados "a recolher")
  const periodos = (c.contagem_anterior_ec103?.periodos_informados ?? [])
    .filter(p => !/a recolher/i.test(p.empresa ?? ''))
    .map(p => `${p.inicio} ${p.fim} ${p.empresa}`)
    .join('\n');
  writeFileSync(join(outDir, `${caso}-periodos.txt`), periodos + '\n');

  // 2) salários históricos NOMINAIS (competências anteriores ao ano de corte;
  //    as demais são projeções geradas pelo próprio app)
  const fx = JSON.parse(readFileSync(join(fixtures, docSalarios), 'utf8'));
  const hist = fx.salarios.filter(s => +s.competencia.split('/')[1] < anoCorteProjecao);
  const linhas = hist.map(s => `${s.competencia} ${fmtBR(s.salarioContribuicao)}`).join('\n');
  writeFileSync(join(outDir, `${caso}-salarios.txt`), linhas + '\n');

  // 3) resumo dos dados cadastrais e esperados
  const seg = c.segurado;
  console.log(`${caso}: ${seg.nome} (${seg.sexo}) nasc. ${seg.nascimento} — ${hist.length} salários históricos, períodos OK`);
}

gerarCaso('dulcimara', 'dulcimara_doc_3_2.json', 2026);
gerarCaso('gian_carlo', 'gian_carlo_doc_3_2.json', 2026);

// 4) tabela de valores esperados (extraída dos próprios fixtures)
const esperados = {};
for (const arq of ['dulcimara_doc_2_1', 'dulcimara_doc_2_2', 'dulcimara_doc_3_1', 'dulcimara_doc_3_2', 'dulcimara_doc_4_1',
  'gian_carlo_doc_2_1', 'gian_carlo_doc_3_1', 'gian_carlo_doc_3_2']) {
  const f = JSON.parse(readFileSync(join(fixtures, `${arq}.json`), 'utf8'));
  esperados[arq] = { titulo: f.titulo, dib: f.dib, ...f.esperado };
}
writeFileSync(join(outDir, 'valores-esperados.json'), JSON.stringify(esperados, null, 2));
console.log('Arquivos gerados em kit-teste/entradas/. Ver kit-teste/README.md para o passo a passo.');
