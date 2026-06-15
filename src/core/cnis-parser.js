// ===================================================================
// LEITOR DE CNIS (Extrato Previdenciário digital do Meu INSS)
// Recebe linhas de texto (agrupadas por posição vertical) e devolve
// {nome, nascimento, vinculos:[{seq,origem,ini,fim,aberto,indicadores}],
//  competencias:[{comp,valor}], indicadores:Set, avisos:[]}
// ===================================================================
"use strict";

const RX_DATA = /\b(\d{2}\/\d{2}\/\d{4})\b/g;
const RX_COMP = /(?<![\d\/])(\d{2}\/\d{4})\b/g;
const RX_MONEY = /\b\d{1,3}(?:\.\d{3})*,\d{2}\b/g;
const RX_NIT = /\b\d{3}\.\d{5}\.\d{2}-\d\b/;
const RX_IND = /\b[A-Z]{3,5}(?:-[A-Z0-9]{2,14}){1,3}\b/g;

function moneyToNum(s) { return parseFloat(s.replace(/\./g, '').replace(',', '.')); }
function compToOrd(c) { const [m, a] = c.split('/').map(Number); return a * 12 + m; }

function parseCNISLinhas(linhas) {
  const out = { nome: null, nascimento: null, vinculos: [], competencias: [], indicadores: new Set(), avisos: [] };
  const porComp = {}; // comp -> soma
  let ultimoVinculo = null;
  let modo = null; // 'remu' | 'contrib'

  for (let i = 0; i < linhas.length; i++) {
    const L = linhas[i].replace(/\s+/g, ' ').trim();
    if (!L) continue;

    // cabeçalhos / rodapés
    if (/Página \d+ de \d+|CNIS - Cadastro|Extrato Previdenciário|poderá rever a qualquer tempo|terá reconhecida como tempo|Identificação do Filiado|Relações Previdenciárias|autenticidade/i.test(L)) continue;

    // identificação
    if (!out.nome) { const m = L.match(/Nome:\s*([A-ZÀ-Ü][A-ZÀ-Ü ']+?)(?:\s+Nome da mãe|$)/); if (m) out.nome = m[1].trim(); }
    if (!out.nascimento) { const m = L.match(/Data de nascimento:\s*(\d{2}\/\d{2}\/\d{4})/); if (m) out.nascimento = m[1]; }

    // legenda de indicadores: parar coleta de competências
    if (/Legenda de Indicadores/i.test(L)) { modo = null; ultimoVinculo = null; continue; }
    if (/Valores Consolidados por Ano Civil/i.test(L)) { modo = null; continue; }

    // marcadores de seção
    if (/^Remunerações\b/.test(L)) { modo = 'remu'; continue; }
    if (/^Contribuições\b/.test(L)) { modo = 'contrib'; continue; }

    // linha de vínculo: começa com seq numérico e tem NIT
    const mSeq = L.match(/^(\d{1,3})\s/);
    if (mSeq && RX_NIT.test(L) && !/^\d{2}\/\d{4}/.test(L)) {
      const datas = [...L.matchAll(RX_DATA)].map(m => m[1]);
      const seq = +mSeq[1];
      // origem: entre NIT/código e o resto
      let origem = '';
      const mOri = L.match(/\d{3}\.\d{5}\.\d{2}-\d\s+(?:[\d.]+\s+)?([A-ZÀ-Ü][A-ZÀ-Ü0-9 .\/&'-]*?)(?=\s+(?:\d{4,}|Empregado|Contribuinte|Trabalhador|Facultativo|Segurado|\d{2}\/\d{2}\/\d{4}))/);
      if (mOri) origem = mOri[1].trim();
      const tipoCI = /Contribuinte Individual|RECOLHIMENTO|Facultativo/i.test(L);
      const v = {
        seq, origem: origem || ('Vínculo seq. ' + seq),
        ini: datas[0] || null,
        fim: datas[1] || null,
        aberto: datas.length < 2,
        tipo: tipoCI ? 'CI' : 'Empregado',
        indicadores: []
      };
      out.vinculos.push(v);
      ultimoVinculo = v;
      modo = null;
      continue;
    }

    // linha de indicadores do vínculo
    if (/^Indicadores:/.test(L) && ultimoVinculo) {
      const inds = L.match(RX_IND) || [];
      for (const x of inds) if (x !== 'Indicadores') { ultimoVinculo.indicadores.push(x); out.indicadores.add(x); }
      continue;
    }

    // linhas de competências (remunerações ou contribuições)
    const comps = [...L.matchAll(RX_COMP)].map(m => ({ comp: m[1], idx: m.index }));
    if (comps.length && modo) {
      // não confundir com linha de vínculo CI (tem dd/mm/aaaa no padrão data e não mm/aaaa)
      for (let c = 0; c < comps.length; c++) {
        const ini = comps[c].idx;
        const fim = c + 1 < comps.length ? comps[c + 1].idx : L.length;
        const seg = L.slice(ini + 7, fim); // depois de mm/aaaa
        const monies = seg.match(RX_MONEY) || [];
        let valor = null;
        if (modo === 'contrib') {
          // contribuição: [data pgto] contribuição salário -> usar o MAIOR (salário de contribuição)
          if (monies.length) valor = Math.max(...monies.map(moneyToNum));
        } else {
          // remuneração: primeiro valor monetário do segmento
          if (monies.length) valor = moneyToNum(monies[0]);
        }
        if (valor != null && isFinite(valor)) {
          porComp[comps[c].comp] = (porComp[comps[c].comp] || 0) + valor;
        }
        // indicadores por competência
        const inds = seg.match(RX_IND) || [];
        for (const x of inds) out.indicadores.add(x);
      }
      continue;
    }
  }

  out.competencias = Object.entries(porComp)
    .map(([comp, valor]) => ({ comp, valor: Math.round(valor * 100) / 100 }))
    .sort((a, b) => compToOrd(a.comp) - compToOrd(b.comp));

  if (!out.vinculos.length) out.avisos.push('Nenhum vínculo identificado — o PDF pode ser digitalizado (imagem) ou de layout diferente. Confira manualmente.');
  for (const v of out.vinculos) if (v.aberto) out.avisos.push(`Vínculo seq. ${v.seq} (${v.origem}) sem data fim no CNIS — informe a data fim ou a data-base.`);
  if (out.indicadores.has('PSC-MEN-SM-EC103')) out.avisos.push('Há competências abaixo do salário mínimo (PSC-MEN-SM-EC103): podem exigir complementação/agrupamento para contar como tempo (art. 29, EC 103).');
  if (out.indicadores.has('PREM-BLOQ-EC103')) out.avisos.push('Há contribuições com bloqueio para ajuste (PREM-BLOQ-EC103) — foram somadas na competência, mas o INSS pode desconsiderá-las/ajustá-las; confira na tela antes de calcular.');
  if (out.indicadores.has('IREC-INDPEND') || out.indicadores.has('IREM-INDPEND')) out.avisos.push('Há recolhimentos/remunerações com pendências (IREC/IREM-INDPEND): validar documentação.');
  out.avisos.push('Salários importados são NOMINAIS (sem atualização monetária). Para RMI precisa, aplicar os fatores de atualização oficiais.');
  return out;
}

// agrupa itens do pdf.js em linhas de texto, em coordenadas de tela
// (corrige páginas rotacionadas usando o transform do viewport)
function itensParaLinhas(items, viewport, Util) {
  const rows = [];
  for (const it of items) {
    let x = it.transform[4], y = it.transform[5];
    if (viewport && Util) {
      const t = Util.transform(viewport.transform, it.transform);
      x = t[4]; y = t[5]; // espaço de tela: y cresce para baixo
    } else {
      y = -y; // fallback: inverte para ordenar de cima p/ baixo
    }
    const s = it.str;
    if (!s.trim()) continue;
    let row = rows.find(r => Math.abs(r.y - y) < 4);
    if (!row) { row = { y, cells: [] }; rows.push(row); }
    row.cells.push({ x, s });
  }
  rows.sort((a, b) => a.y - b.y);
  return rows.map(r => r.cells.sort((a, b) => a.x - b.x).map(c => c.s).join(' '));
}

if (typeof module !== 'undefined') module.exports = { parseCNISLinhas, itensParaLinhas, moneyToNum };
