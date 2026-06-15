// ===================================================================
// Extratores de documentos (PPP, CTC, CTSM/Declaração militar)
//
// Leem o TEXTO do documento (vindo de pdfjs para PDFs digitais, ou de OCR
// para escaneados) e PROPÕEM dados estruturados. Seguem a regra de ouro do
// projeto: a extração é AUXILIAR, nunca determinante — o advogado confere e
// confirma na tela antes de qualquer cálculo. Por isso cada função devolve
// `avisos[]` sinalizando o que precisa de conferência.
//
// Foco inicial: formulários padronizados do INSS (Anexo XV - CTC, Anexo XVII -
// PPP, IN 128/2022) e a Declaração de Tempo de Serviço Militar. Documentos com
// layout muito diferente podem extrair parcialmente — daí a conferência.
// ===================================================================

export interface PeriodoExtraido {
  /** dd/mm/aaaa */
  ini: string;
  /** dd/mm/aaaa */
  fim: string;
}

export interface DadosPPPExtraidos {
  segurado?: string;
  cpf?: string;
  nascimento?: string;
  empresa?: string;
  /** períodos de exposição candidatos */
  periodos: PeriodoExtraido[];
  /** agente nocivo identificado (ex.: "RUÍDO") */
  agente?: string;
  /** intensidade/concentração (ex.: "92 dB(A)") */
  intensidade?: string;
  /** grau sugerido (15/20/25) — quase sempre 25; CONFERIR */
  grauSugerido?: 15 | 20 | 25;
  /** todas as datas encontradas (para a conferência montar períodos) */
  datasEncontradas: string[];
  avisos: string[];
}

export interface DadosCTCExtraidos {
  segurado?: string;
  cpf?: string;
  nascimento?: string;
  orgao?: string;
  periodos: PeriodoExtraido[];
  datasEncontradas: string[];
  avisos: string[];
}

export interface DadosCTSMExtraidos {
  segurado?: string;
  cpf?: string;
  nascimento?: string;
  periodos: PeriodoExtraido[];
  /** duração declarada (alguns modelos declaram tempo, não datas) */
  duracao?: { anos: number; meses: number; dias: number };
  datasEncontradas: string[];
  avisos: string[];
}

// ---------- utilitários ----------

/** Normaliza: remove linhas de preenchimento (____), colapsa espaços. */
export function normalizarTexto(raw: string): string {
  return raw
    .replace(/_+/g, ' ')      // tira as linhas pontilhadas dos formulários
    .replace(/\s+/g, ' ')     // colapsa espaços/quebras
    .trim();
}

const MESES: Record<string, number> = {
  janeiro: 1, fevereiro: 2, março: 3, marco: 3, abril: 4, maio: 5, junho: 6,
  julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12,
};

function dataValida(d: number, m: number, a: number): boolean {
  return d >= 1 && d <= 31 && m >= 1 && m <= 12 && a >= 1900 && a <= 2100;
}

/**
 * Encontra todas as datas no texto, em ordem, no formato dd/mm/aaaa.
 * Aceita "dd/mm/aaaa", "dd mm aaaa" e "dd de <mês> de aaaa".
 */
export function extrairDatas(texto: string): string[] {
  const t = normalizarTexto(texto);
  const achados: string[] = [];

  // dd/mm/aaaa ou dd mm aaaa (separadores / . - ou espaço)
  const reNum = /\b(\d{1,2})\s*[\/.\- ]\s*(\d{1,2})\s*[\/.\- ]\s*(\d{4})\b/g;
  let m: RegExpExecArray | null;
  while ((m = reNum.exec(t)) !== null) {
    const d = +m[1], mes = +m[2], a = +m[3];
    if (dataValida(d, mes, a)) achados.push(`${pad(d)}/${pad(mes)}/${a}`);
  }

  // dd de <mês por extenso> de aaaa
  const reExt = /\b(\d{1,2})\s+(?:de\s+)?(janeiro|fevereiro|mar[çc]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s+(?:de\s+)?(\d{4})\b/gi;
  while ((m = reExt.exec(t)) !== null) {
    const d = +m[1], mes = MESES[m[2].toLowerCase()], a = +m[3];
    if (mes && dataValida(d, mes, a)) achados.push(`${pad(d)}/${pad(mes)}/${a}`);
  }

  // dedup mantendo ordem
  return [...new Set(achados)];
}

/** Recorta o trecho do texto entre dois marcadores (para escopar a busca). */
export function trecho(texto: string, depoisDe?: RegExp, antesDe?: RegExp): string {
  const t = normalizarTexto(texto);
  let ini = 0, fim = t.length;
  if (depoisDe) {
    const m = t.match(depoisDe);
    if (m && m.index !== undefined) ini = m.index + m[0].length;
  }
  if (antesDe) {
    const resto = t.slice(ini);
    const m = resto.match(antesDe);
    if (m && m.index !== undefined) fim = ini + m.index;
  }
  return t.slice(ini, fim);
}

function pad(n: number): string { return String(n).padStart(2, '0'); }

function acharCPF(texto: string): string | undefined {
  const m = normalizarTexto(texto).match(/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/);
  return m?.[0];
}

/** Extrai o valor após um rótulo (até o próximo rótulo numerado ou em CAIXA). */
function valorApos(texto: string, rotulo: RegExp): string | undefined {
  const t = normalizarTexto(texto);
  const m = t.match(rotulo);
  if (!m || m.index === undefined) return undefined;
  const resto = t.slice(m.index + m[0].length).trim();
  // pega até o próximo marcador "N –", "N -", rótulo em CAIXA com ":" ou fim
  const corte = resto.search(/\s+(\d{1,2}\s*[–-]|[A-ZÁ-Ú/ ]{4,}:|CPF|SEXO|DATA)/);
  const val = (corte > 0 ? resto.slice(0, corte) : resto).trim();
  return val || undefined;
}

// ---------- PPP ----------

const AGENTES = [
  'RUÍDO', 'RUIDO', 'CALOR', 'FRIO', 'SÍLICA', 'SILICA', 'BENZENO', 'POEIRA',
  'HIDROCARBONETOS', 'RADIAÇÃO', 'RADIACAO', 'VIBRAÇÃO', 'VIBRACAO',
  'ELETRICIDADE', 'AGENTES BIOLÓGICOS', 'AGENTES BIOLOGICOS', 'CHUMBO', 'MERCÚRIO', 'MERCURIO',
];

export function extrairPPP(texto: string): DadosPPPExtraidos {
  const t = normalizarTexto(texto);
  const avisos: string[] = [];
  const datas = extrairDatas(t);

  const cpf = acharCPF(t);
  const nascimento = acharNascimento(t, datas);

  const segurado = nomeProvavel(trecho(t, /Nome do Trabalhador/i, /BR\/PDH|CPF|Sexo|Data de Nascimento/i));
  const empresa = nomeProvavel(trecho(t, /Nome Empresarial/i, /CNAE|Nome do Trabalhador/i));

  // agente nocivo
  let agente: string | undefined;
  for (const a of AGENTES) {
    if (t.toUpperCase().includes(a)) { agente = a.replace('RUIDO', 'RUÍDO'); break; }
  }
  // intensidade próxima a "dB", "ppm", "mg", "ºC"
  const mInt = t.match(/(\d{1,4}(?:[.,]\d+)?)\s*(dB\s*\(?\s*A?\s*\)?|ppm|mg\/m3|mg|m\/s2?|[ºo]C)/i);
  const intensidade = mInt ? `${mInt[1]} ${mInt[2]}`.replace(/\s+/g, ' ').trim() : undefined;

  // períodos: SÓ na seção de lotação/exposição (evita datas do texto legal)
  const secao = trecho(t, /LOTA[ÇC][ÃA]O E ATRIBUI/i, /REGISTROS AMBIENTAIS|14\s*[–-]\s*PROFISSIOGRAFIA/i);
  const datasPeriodo = extrairDatas(secao).filter(d => d !== nascimento);
  const periodos = parearPeriodos(datasPeriodo);

  if (!agente) avisos.push('Agente nocivo não identificado automaticamente — informe na conferência.');
  else avisos.push(`Agente "${agente}"${intensidade ? ` (${intensidade})` : ''} — confira a intensidade e o enquadramento.`);
  avisos.push('Grau sugerido 25 anos (padrão da maioria dos agentes) — CONFERIR conforme o anexo do Dec. 3.048/99.');
  if (periodos.length === 0) avisos.push('Nenhum período de exposição identificado — informe manualmente.');
  else if (periodos.length > 1) avisos.push(`${periodos.length} períodos candidatos encontrados — selecione o(s) correto(s).`);

  return {
    segurado, cpf, nascimento, empresa,
    periodos, agente, intensidade, grauSugerido: 25,
    datasEncontradas: datas, avisos,
  };
}

// ---------- CTC ----------

export function extrairCTC(texto: string, opts: { nascimento?: string } = {}): DadosCTCExtraidos {
  const t = normalizarTexto(texto);
  const avisos: string[] = [];
  const datas = extrairDatas(t);

  const cpf = acharCPF(t);
  // Prioriza a data de nascimento conhecida (passada pelo app) — formulários
  // têm ordem de texto bagunçada e o nascimento pode "vazar" para o período.
  const nascimento = opts.nascimento ?? acharNascimento(t, datas);
  const segurado = nomeProvavel(trecho(t, /NOME DO SERVIDOR\s*:?/i, /SEXO|MATR[ÍI]CULA|RG/i));
  const orgao = valorApos(t, /[ÓO]RG[ÃA]O EXPEDIDOR\s*:?/i);

  // Período certificado: prioriza "...COMPREENDIDO NESTA CERTIDÃO"; senão a faixa
  // admissão→exoneração. Usa [menor, maior] data (robusto à ordem do texto),
  // SEMPRE excluindo a data de nascimento.
  const excluir = new Set([nascimento].filter(Boolean) as string[]);
  let secaoDatas = extrairDatas(trecho(t, /COMPREENDID[OA] NESTA CERTID[ÃA]O/i, /DESTINA[ÇC][ÃA]O|INSTITUTO|FREQU[ÊE]NCIA/i))
    .filter(d => !excluir.has(d));
  if (secaoDatas.length < 2) {
    secaoDatas = extrairDatas(trecho(t, /DATA DE ADMISS/i, /DESTINA[ÇC][ÃA]O|FREQU[ÊE]NCIA/i))
      .filter(d => !excluir.has(d));
  }
  const periodos = periodoMinMax(secaoDatas);

  if (periodos.length === 0) avisos.push('Período certificado não identificado — informe manualmente.');
  else avisos.push('Confira o período certificado (admissão/exoneração) e o regime de origem.');
  avisos.push('Tempo especial em CTC não é convertido (Nota Técnica 792, STF).');

  return { segurado, cpf, nascimento, orgao, periodos, datasEncontradas: datas, avisos };
}

// ---------- CTSM / Declaração militar ----------

export function extrairCTSM(texto: string): DadosCTSMExtraidos {
  const t = normalizarTexto(texto);
  const avisos: string[] = [];
  const datas = extrairDatas(t);

  // só o primeiro parágrafo (antes das citações legais com datas de Decretos)
  const corpo = trecho(t, /\bEu\s*,?/i, /2\.\s*Declaro|ciente da responsabilidade|Decreto-?Lei/i);

  const cpf = acharCPF(corpo);
  const nascimento = acharNascimento(t, datas);
  const segurado = nomeProvavel(trecho(corpo, /\bEu\s*,?/i, /Identidade/i));

  // duração declarada: "possuo X anos, Y meses, Z dias"
  let duracao: { anos: number; meses: number; dias: number } | undefined;
  const mDur = corpo.match(/possuo\s+(\d{1,2})\s*anos?\s*,?\s*(\d{1,2})\s*meses?\s*,?\s*(\d{1,2})\s*dias?/i);
  if (mDur) duracao = { anos: +mDur[1], meses: +mDur[2], dias: +mDur[3] };

  const datasPeriodo = extrairDatas(corpo).filter(d => d !== nascimento);
  const periodos = parearPeriodos(datasPeriodo);

  if (periodos.length === 0) {
    avisos.push('Este modelo declara o TEMPO (duração), não as datas do período militar — informe início e fim na conferência.');
  } else {
    avisos.push('Confira as datas do período de serviço militar.');
  }
  avisos.push('Tempo militar conta para tempo de contribuição, mas NÃO para carência.');

  return { segurado, cpf, nascimento, periodos, duracao, datasEncontradas: datas, avisos };
}

// ---------- helpers de período/nascimento ----------

/** Heurística: data de nascimento é a que aparece logo após "Nascimento". */
function acharNascimento(t: string, datas: string[]): string | undefined {
  const m = t.match(/Nascimento\s*:?\s*(\d{1,2}\s*[\/.\- ]\s*\d{1,2}\s*[\/.\- ]\s*\d{4})/i);
  if (m) {
    const d = extrairDatas(m[1]);
    if (d[0]) return d[0];
  }
  return undefined;
}

const STOPWORDS_NOME = new Set([
  'INSTITUTO', 'NACIONAL', 'SEGURO', 'SOCIAL', 'PERFIL', 'PROFISSIOGRÁFICO',
  'PROFISSIOGRAFICO', 'PREVIDENCIÁRIO', 'PREVIDENCIARIO', 'CERTIDÃO', 'CERTIDAO',
  'TEMPO', 'CONTRIBUIÇÃO', 'CONTRIBUICAO', 'MINISTÉRIO', 'MINISTERIO', 'DEFESA',
  'EXÉRCITO', 'EXERCITO', 'BRASILEIRO', 'REGIÃO', 'REGIAO', 'MILITAR', 'DECLARAÇÃO',
  'DECLARACAO', 'SERVIÇO', 'SERVICO', 'ANTERIOR', 'DADOS', 'ADMINISTRATIVOS',
  'NOME', 'TRABALHADOR', 'SERVIDOR', 'EMPRESARIAL', 'ANEXO', 'NORMATIVA',
]);

/**
 * Heurística simples para o nome do segurado: primeira sequência de 2 a 5
 * palavras em CAIXA ALTA (admitindo de/da/dos/e) que não seja cabeçalho.
 * Sempre conferir — é só uma sugestão.
 */
export function nomeProvavel(texto: string): string | undefined {
  const t = normalizarTexto(texto);
  const re = /\b([A-ZÁÂÃÉÊÍÓÔÕÚÇ]{2,}(?:\s+(?:DE|DA|DO|DOS|DAS|E|[A-ZÁÂÃÉÊÍÓÔÕÚÇ]{2,})){1,4})\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(t)) !== null) {
    const cand = m[1].trim();
    const palavras = cand.split(/\s+/).filter(p => !['DE', 'DA', 'DO', 'DOS', 'DAS', 'E'].includes(p));
    if (palavras.length < 2) continue;
    if (palavras.some(p => STOPWORDS_NOME.has(p))) continue;
    return cand;
  }
  return undefined;
}

/** Forma períodos a partir de uma lista ordenada de datas (pares consecutivos). */
function parearPeriodos(datas: string[]): PeriodoExtraido[] {
  const ps: PeriodoExtraido[] = [];
  for (let i = 0; i + 1 < datas.length; i += 2) {
    ps.push({ ini: datas[i], fim: datas[i + 1] });
  }
  return ps;
}

/** dd/mm/aaaa → timestamp (para ordenar). */
function tsData(d: string): number {
  const m = d.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  return m ? Date.UTC(+m[3], +m[2] - 1, +m[1]) : 0;
}

/**
 * Período único = [menor, maior] data da lista. Robusto à ordem do texto
 * (importante em PDFs de formulário, onde o pdfjs embaralha a ordem).
 */
function periodoMinMax(datas: string[]): PeriodoExtraido[] {
  if (datas.length < 2) return [];
  const ord = [...new Set(datas)].sort((a, b) => tsData(a) - tsData(b));
  return [{ ini: ord[0], fim: ord[ord.length - 1] }];
}
