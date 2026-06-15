#!/usr/bin/env node
// =====================================================================
// Verificação anti-duplicação: garante que o app web não re-implementa
// funções que pertencem ao motor (@mfaa/prev-engine).
// Roda com: node scripts/check-engine-dup.js
// Falha com exit code 1 se encontrar duplicação.
// =====================================================================
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(import.meta.url), '..', '..');
const SRC = join(ROOT, 'src');

// Funções do motor que NUNCA devem ser redefinidas no app
const FUNCOES_PROIBIDAS = [
  'parseCNISLinhas',
  'itensParaLinhas',
  'juntarContinuacoes',
  'calcularRMI',
  'montarCenario',
  'gradePadrao',
  'avaliarRegras',
  'contarCarencia',
  'auditarCNIS',
  'aplicarAtualizacao',
  'moneyToNum',
  'comparativosEncadeados',
  'mesclarPeriodos',
];

// Padrão: "function nomeFuncao" ou "const nomeFuncao =" como definição local
const padroes = FUNCOES_PROIBIDAS.map(fn => ({
  fn,
  rx: new RegExp(`(?:^|\\s)(?:export\\s+)?(?:function|const|let|var)\\s+${fn}\\b`, 'm'),
}));

function listarArquivos(dir) {
  const result = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.next') continue;
      result.push(...listarArquivos(full));
    } else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) {
      result.push(full);
    }
  }
  return result;
}

let erros = 0;
for (const arq of listarArquivos(SRC)) {
  const conteudo = readFileSync(arq, 'utf8');
  for (const { fn, rx } of padroes) {
    if (rx.test(conteudo)) {
      const rel = relative(ROOT, arq);
      console.error(`ERRO: ${rel} redefine "${fn}" — use import de @mfaa/prev-engine`);
      erros++;
    }
  }
}

if (erros > 0) {
  console.error(`\n${erros} duplicação(ões) encontrada(s). O app deve importar do motor, não redefinir.`);
  process.exit(1);
} else {
  console.log('OK — nenhuma duplicação de funções do motor detectada.');
}
