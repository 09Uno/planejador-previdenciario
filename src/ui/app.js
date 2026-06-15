// ===================== UI LOGIC =====================
"use strict";

const $ = id => document.getElementById(id);
const fmtMoeda = v => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
let ultimaAnalise = null;

(function init() {
  const n = new Date();
  $('hoje').value = String(n.getDate()).padStart(2, '0') + '/' + String(n.getMonth() + 1).padStart(2, '0') + '/' + n.getFullYear();
  atualizarCasos();
})();

function parsePeriodos(texto, erros) {
  const out = [];
  for (const raw of String(texto).split(/\n+/)) {
    const line = raw.trim();
    if (!line) continue;
    const m = line.match(/^(\d{1,2}\/\d{1,2}\/\d{4})[\s;,\t]+(\d{1,2}\/\d{1,2}\/\d{4})\s*(.*)$/);
    if (!m) { erros.push('Período inválido: ' + line); continue; }
    const ini = parseBR(m[1]), fim = parseBR(m[2]);
    if (ini == null || fim == null || fim < ini) { erros.push('Datas inválidas: ' + line); continue; }
    out.push({ ini, fim, desc: m[3] || '' });
  }
  return out;
}

function lerParametros() {
  const num = s => parseFloat(String(s).replace(/\./g, '').replace(',', '.'));
  const tabuaEs = {};
  for (const par of $('ptabua').value.split(',')) {
    const m = par.trim().match(/^(\d+)\s*=\s*([\d.]+)$/);
    if (m) tabuaEs[+m[1]] = +m[2];
  }
  return { teto: num($('pteto').value), salMin: num($('psalmin').value), divisorMinimo: parseInt($('pdivmin').value) || 108, tabuaEs };
}

function analisar() {
  const erros = [];
  $('msg').textContent = '';
  const nasc = parseBR($('nasc').value);
  const hoje = parseBR($('hoje').value);
  if (nasc == null) erros.push('Informe a data de nascimento (dd/mm/aaaa).');
  if (hoje == null) erros.push('Informe a data-base (dd/mm/aaaa).');
  const periodos = parsePeriodos($('periodos').value, erros);
  if (!periodos.length) erros.push('Informe ao menos um período de contribuição.');
  const ps = parseSalarios($('salarios').value);
  for (const e of ps.erros) erros.push('Salário ignorado (formato): ' + e);
  if (erros.length && (nasc == null || hoje == null || !periodos.length)) { $('msg').textContent = erros.join('\n'); return; }
  if (erros.length) $('msg').textContent = erros.join('\n');

  const sexo = $('sexo').value;
  const merged = mesclarPeriodos(periodos);
  const ctx = { sexo, nasc, merged, hoje, continuaContribuindo: $('continua').checked };
  const av = avaliarRegras(ctx);
  const params = lerParametros();

  const dHoje = $('continua').checked ? diasProjetados(merged, av.base, hoje) : diasAte(merged, hoje);
  const idade = idadeAMD(nasc, hoje);
  const carenciaMeses = ps.salarios.length || Math.floor(dHoje / 30);
  $('cardsTempo').innerHTML = [
    ['Tempo em 12/11/2019 (véspera da EC 103)', fmtAMD(diasParaAMD(av.diasNaEC))],
    ['Tempo na data-base', fmtAMD(diasParaAMD(dHoje))],
    ['Idade na data-base', `${idade.y} anos, ${idade.m} meses e ${idade.d} dias`],
    ['Competências p/ carência (aprox.)', String(carenciaMeses)],
  ].map(c => `<div class="card"><div class="l">${c[0]}</div><div class="v">${c[1]}</div></div>`).join('');

  const tb = $('tabRegras').querySelector('tbody');
  tb.innerHTML = '';
  const linhas = [];
  for (const r of av.regras) {
    let st, cls;
    if (r.detalhe.startsWith('Inaplicável')) { st = 'Inaplicável'; cls = 'st-na'; }
    else if (r.cumprida) { st = 'Cumprida'; cls = 'st-ok'; }
    else if (r.data) { st = 'Projetada'; cls = 'st-fut'; }
    else { st = 'Não alcançada'; cls = 'st-na'; }

    let rmiTxt = '—', rmiInfo = null;
    if (ps.salarios.length && r.data && st !== 'Inaplicável') {
      const der = Math.max(r.data, r.id === 'da' ? r.data : r.data);
      const sal = r.id === 'da' ? ps.salarios.filter(s => s.ano < 2019 || (s.ano === 2019 && s.mes <= 10)) : ps.salarios;
      if (sal.length) {
        const tcDias = $('continua').checked ? diasProjetados(merged, av.base, der) : diasAte(merged, der);
        rmiInfo = calcularRMI(r.calc, { salarios: sal, tcDiasNaDER: tcDias, idadeNaDER: idadeAnos(nasc, der), sexo, tcMinRegra: tcMinimo(sexo), params });
        if (!rmiInfo.erro) rmiTxt = fmtMoeda(rmiInfo.rmi);
      }
    }
    r._rmi = rmiInfo;
    r._st = st;
    linhas.push(`<tr><td><b>${r.nome}</b><br><span class="hint">${r.fundamento}</span></td><td class="${cls}">${st}</td><td>${r.data ? fmtBR(r.data) : '—'}</td><td>${r.detalhe}${rmiInfo && !rmiInfo.erro ? '<br><span class="hint">' + rmiInfo.obs + (rmiInfo.fator ? ` Fator: ${rmiInfo.fator.toFixed(4)}.` : '') + '</span>' : ''}</td><td class="rmi">${rmiTxt}</td></tr>`);
  }
  tb.innerHTML = linhas.join('');
  $('resultado').style.display = '';
  ultimaAnalise = { ctx, av, params, salarios: ps.salarios, dHoje, idade };
  $('secMinuta').style.display = 'none';
}

// ===================== DOCUMENT GENERATION =====================
function gerarMinuta() {
  if (!ultimaAnalise) return;
  const { ctx, av, dHoje, idade } = ultimaAnalise;
  const nome = ($('nome').value || 'SEGURADO(A)').toUpperCase();
  const sx = ctx.sexo === 'M' ? 'o segurado' : 'a segurada';
  const tcMin = tcMinimo(ctx.sexo);
  const L = [];
  L.push('PARECER PREVIDENCIÁRIO');
  L.push('');
  L.push((ctx.sexo === 'M' ? 'SEGURADO: ' : 'SEGURADA: ') + nome);
  L.push('');
  L.push('BENEFÍCIO: APOSENTADORIA PELAS REGRAS DE TRANSIÇÃO PREVISTAS NA EC 103/2019 (INSS – RGPS)');
  L.push('');
  L.push('Trata-se de parecer previdenciário, com base nos documentos apresentados, bem como nas informações sociais que constam na base de dados do INSS.');
  L.push('');
  L.push('1.0 - DOS REQUISITOS PARA A CONCESSÃO DE APOSENTADORIA POR TEMPO DE CONTRIBUIÇÃO – ANTERIOR À EC 103/2019');
  L.push('');
  L.push(`Os requisitos para a concessão da aposentadoria por tempo de contribuição estão definidos no artigo 201, § 7º, inciso I, da Constituição Federal: ${tcMin} anos de contribuição (${ctx.sexo === 'M' ? 'homem' : 'mulher'}).`);
  L.push('');
  L.push(`No caso em exame, efetuada a análise contributiva com base nos períodos informados, verifica-se que, até 12/11/2019 (data anterior à publicação da EC 103/2019), o tempo de contribuição era de: ${fmtAMD(diasParaAMD(av.diasNaEC))}.`);
  L.push('');
  L.push(`Na data-base desta análise (${fmtBR(ctx.hoje)}), o tempo de contribuição apurado é de ${fmtAMD(diasParaAMD(dHoje))} e a idade de ${idade.y} anos, ${idade.m} meses e ${idade.d} dias.`);
  L.push('');
  L.push('2.0 - DOS REQUISITOS APÓS A VIGÊNCIA DA EMENDA CONSTITUCIONAL 103/2019 E DO CASO CONCRETO');
  L.push('');
  L.push('Aplicadas as regras de transição da EC 103/2019 ao caso concreto, temos os seguintes cenários:');
  L.push('');
  let i = 0;
  for (const r of av.regras) {
    if (r._st === 'Inaplicável' || r._st === 'Não alcançada') continue;
    i++;
    L.push(`2.${i} - ${r.nome.toUpperCase()}`);
    L.push(r.detalhe);
    if (r._rmi && !r._rmi.erro) {
      L.push(`RENDA MENSAL INICIAL estimada em ${fmtBR(r.data)}: ${fmtMoeda(r._rmi.rmi)}`);
      if (r._rmi.descartes) L.push(`APLICAÇÃO DO DESCARTE (art. 26, §6º, EC 103/19): ${r._rmi.descartes} contribuição(ões)`);
      if (r._rmi.coefic != null) L.push(`COEFICIENTE DE CÁLCULO: ${(r._rmi.coefic * 100).toFixed(0)}%`);
      if (r._rmi.fator != null) L.push(`FATOR PREVIDENCIÁRIO: ${r._rmi.fator.toFixed(4)} — EXPECTATIVA DE SOBREVIDA: ${r._rmi.es} anos (fonte IBGE)`);
    }
    L.push('');
  }
  L.push('3.0 - OPINIÃO');
  L.push('');
  L.push('[A SER COMPLETADO PELO ADVOGADO: comparação entre os cenários, omissões e divergências do CNIS, providências e estratégia recomendada.]');
  L.push('');
  L.push('Todavia, caso haja mudança da legislação previdenciária, orientamos ' + sx + ' a reavaliar a sua situação previdenciária com base na lei vigente.');
  L.push('');
  L.push('É o que nos parece, salvo melhor juízo, estando à disposição para quaisquer esclarecimentos.');
  L.push('');
  L.push('São Paulo, ' + new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }) + '.');
  L.push('');
  L.push('— Minuta gerada por protótipo. Conferir todos os números, índices de atualização e a tábua IBGE vigente antes do uso. —');
  $('minuta').value = L.join('\n');
  $('secMinuta').style.display = '';
  $('secMinuta').scrollIntoView({ behavior: 'smooth' });
}

function baixarDoc() {
  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const paras = $('minuta').value.split('\n').map(l => l.trim() === ''
    ? '<p>&nbsp;</p>'
    : (/^[0-9]+\.[0-9]* ?-|^PARECER/.test(l) ? `<p><b>${esc(l)}</b></p>` : `<p style="text-align:justify">${esc(l)}</p>`)).join('');
  const html = `<html xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><style>body{font-family:Arial;font-size:12pt}</style></head><body>${paras}</body></html>`;
  const blob = new Blob(['﻿', html], { type: 'application/msword' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'minuta-parecer-' + ($('nome').value || 'caso').toLowerCase().replace(/\s+/g, '-') + '.doc';
  a.click();
}

// ===================== PERSISTENCE =====================
function dadosAtuais() {
  return {
    nome: $('nome').value, sexo: $('sexo').value, nasc: $('nasc').value, hoje: $('hoje').value,
    continua: $('continua').checked, periodos: $('periodos').value, salarios: $('salarios').value,
    pteto: $('pteto').value, psalmin: $('psalmin').value, pdivmin: $('pdivmin').value, ptabua: $('ptabua').value
  };
}

function aplicarDados(d) {
  for (const k of ['nome', 'nasc', 'hoje', 'periodos', 'salarios', 'pteto', 'psalmin', 'pdivmin', 'ptabua']) if (d[k] != null) $(k).value = d[k];
  if (d.sexo) $('sexo').value = d.sexo;
  if (d.continua != null) $('continua').checked = d.continua;
}

function salvarCaso() {
  const nome = $('nome').value.trim() || ('Caso ' + new Date().toLocaleString('pt-BR'));
  const tudo = JSON.parse(localStorage.getItem('mf_casos') || '{}');
  tudo[nome] = dadosAtuais();
  localStorage.setItem('mf_casos', JSON.stringify(tudo));
  atualizarCasos();
  $('msg').textContent = 'Caso salvo neste navegador: ' + nome;
}

function atualizarCasos() {
  const sel = $('casosSalvos');
  const tudo = JSON.parse(localStorage.getItem('mf_casos') || '{}');
  sel.innerHTML = '<option value="">Abrir caso salvo...</option>' + Object.keys(tudo).map(n => `<option>${n}</option>`).join('');
}

function abrirCaso(nome) {
  if (!nome) return;
  const tudo = JSON.parse(localStorage.getItem('mf_casos') || '{}');
  if (tudo[nome]) { aplicarDados(tudo[nome]); $('msg').textContent = 'Caso carregado: ' + nome; }
}

function exportarJSON() {
  const blob = new Blob([JSON.stringify(dadosAtuais(), null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'caso-previdenciario.json';
  a.click();
}

function importarJSON(inp) {
  const f = inp.files[0];
  if (!f) return;
  const r = new FileReader();
  r.onload = () => {
    try {
      aplicarDados(JSON.parse(r.result));
      $('msg').textContent = 'Dados importados.';
    } catch (e) {
      $('msg').textContent = 'Arquivo inválido.';
    }
  };
  r.readAsText(f);
}

// ============== IMPORTAÇÃO DE CNIS (PDF) ==============
const PDFJS_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';
let pdfjsPronto = null;
function carregarPdfJs(){
  if (pdfjsPronto) return pdfjsPronto;
  pdfjsPronto = new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = PDFJS_CDN + 'pdf.min.js';
    s.onload = () => { window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_CDN + 'pdf.worker.min.js'; res(window.pdfjsLib); };
    s.onerror = () => rej(new Error('Sem conexão com a internet — a leitura de PDF usa uma biblioteca on-line. Preencha manualmente ou conecte-se.'));
    document.head.appendChild(s);
  });
  return pdfjsPronto;
}

async function importarCNIS(inp){
  const file = inp.files[0];
  const st = $('cnisStatus');
  if (!file) return;
  st.textContent = 'Lendo ' + file.name + '...';
  try {
    const pdfjsLib = await carregarPdfJs();
    const data = new Uint8Array(await file.arrayBuffer());
    const doc = await pdfjsLib.getDocument({ data }).promise;
    let linhas = [];
    for (let p = 1; p <= doc.numPages; p++){
      const page = await doc.getPage(p);
      const tc = await page.getTextContent();
      linhas = linhas.concat(itensParaLinhas(tc.items, page.getViewport({ scale: 1 }), pdfjsLib.Util));
    }
    const r = parseCNISLinhas(linhas);
    if (!r.vinculos.length && !r.competencias.length){
      st.textContent = 'Não encontrei dados no PDF — pode ser CNIS digitalizado (imagem) ou outro layout. Preencha manualmente.';
      return;
    }
    // preencher campos
    if (r.nome && !$('nome').value) $('nome').value = r.nome;
    if (r.nascimento) $('nasc').value = r.nascimento;
    const hoje = $('hoje').value;
    $('periodos').value = r.vinculos.map(v =>
      `${v.ini} ${v.fim || hoje} ${v.origem}${v.aberto ? ' (SEM DATA FIM no CNIS — conferir)' : ''}`).join('\n');
    $('salarios').value = r.competencias.map(c =>
      `${c.comp} ${c.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`).join('\n');
    const inds = [...r.indicadores].join(', ') || 'nenhum';
    st.innerHTML = `<b>CNIS importado:</b> ${r.vinculos.length} vínculo(s), ${r.competencias.length} competência(s) de salário. Indicadores: ${inds}.<br>` +
      r.avisos.map(a => '⚠ ' + a).join('<br>') +
      '<br><b>Confira os dados nas caixas abaixo (e ajuste se necessário) antes de clicar em Analisar.</b>';
  } catch (e){
    st.textContent = 'Erro ao ler o PDF: ' + e.message;
  }
  inp.value = '';
}
