// ===================================================================
// LEITOR DE CNIS (Extrato Previdenciário digital do Meu INSS)
// Recebe linhas de texto (agrupadas por posição vertical) e devolve
// estrutura tipada com vínculos, competências, indicadores e avisos.
// ===================================================================

const RX_DATA = /\b(\d{2}\/\d{2}\/\d{4})\b/g;
const RX_COMP = /(?<![\d\/])(\d{2}\/\d{4})\b/g;
const RX_MONEY = /\b\d{1,3}(?:\.\d{3})*,\d{2}\b/g;
const RX_NIT = /\b\d{3}\.\d{5}\.\d{2}-\d\b/;
const RX_IND = /\b[A-Z]{3,5}(?:-[A-Z0-9]{2,14}){1,3}\b/g;

export function moneyToNum(s: string): number {
  return parseFloat(s.replace(/\./g, '').replace(',', '.'));
}
function compToOrd(c: string): number { const [m, a] = c.split('/').map(Number); return a * 12 + m; }

export interface VinculoCNIS {
  seq: number;
  origem: string;
  ini: string | null;
  fim: string | null;
  aberto: boolean;
  tipo: 'CI' | 'Empregado';
  indicadores: string[];
}

export interface CompetenciaCNIS { comp: string; valor: number; }

export interface ResultadoCNIS {
  nome: string | null;
  nascimento: string | null;
  vinculos: VinculoCNIS[];
  competencias: CompetenciaCNIS[];
  indicadores: string[];
  avisos: string[];
}

/**
 * Pré-processa linhas do PDF juntando continuações.
 * No CNIS, uma linha de vínculo pode quebrar em 2+ linhas no PDF quando
 * o nome da empresa é longo. Critério: se a próxima linha NÃO começa com
 * seq+espaço, mm/aaaa, "Indicadores:", "Remunerações", "Contribuições",
 * "Legenda", "Página", ela é continuação da anterior.
 */
export function juntarContinuacoes(linhas: string[]): string[] {
  const out: string[] = [];
  const RX_INICIO = /^(?:\d{1,3}\s|Indicadores:|Remunerações|Contribuições|Legenda|Página \d|Valores Consolidados|Nome:|Data de nascimento:|NIT:|CNIS|Extrato|Relações)/i;
  const RX_COMP_INICIO = /^\d{2}\/\d{4}\b/;
  // Só faz sentido "continuar" uma linha de VÍNCULO (nome de empresa longo
  // quebrado pelo PDF). Colar continuação em linha de remuneração faz o
  // rodapé engolir competências (bug: últimas linhas antes do rodapé sumiam).
  const RX_VINCULO_INICIO = /^\d{1,3}\s+\d{3}\.\d{5}\.\d{2}-\d/;
  const RX_RODAPE = /^(?:O INSS poderá|O segurado somente|ou agrupamento|Matrícula|Identificação do Filiado|Seq\.|Competência\s+Remuneração)/i;

  for (const raw of linhas) {
    const L = raw.replace(/\s+/g, ' ').trim();
    if (!L) continue;
    const anterior = out[out.length - 1];
    const podeContinuar = anterior != null && RX_VINCULO_INICIO.test(anterior);
    if (podeContinuar && !RX_INICIO.test(L) && !RX_COMP_INICIO.test(L) && !RX_RODAPE.test(L)) {
      out[out.length - 1] += ' ' + L;
    } else {
      out.push(L);
    }
  }
  return out;
}

export function parseCNISLinhas(linhas: string[]): ResultadoCNIS {
  const out: ResultadoCNIS = { nome: null, nascimento: null, vinculos: [], competencias: [], indicadores: [], avisos: [] };
  const indicadores = new Set<string>();
  const porComp: Record<string, number> = {};
  let ultimoVinculo: VinculoCNIS | null = null;
  let modo: 'remu' | 'contrib' | null = null;

  const linhasJuntas = juntarContinuacoes(linhas);

  for (const raw of linhasJuntas) {
    const L = raw.replace(/\s+/g, ' ').trim();
    if (!L) continue;

    if (/Página \d+ de \d+|CNIS - Cadastro|Extrato Previdenciário|poderá rever a qualquer tempo|terá reconhecida como tempo|Identificação do Filiado|Relações Previdenciárias|autenticidade/i.test(L)) continue;

    if (!out.nome) { const m = L.match(/Nome:\s*([A-ZÀ-Ü][A-ZÀ-Ü ']+?)(?:\s+Nome da mãe|$)/); if (m) out.nome = m[1].trim(); }
    if (!out.nascimento) { const m = L.match(/Data de nascimento:\s*(\d{2}\/\d{2}\/\d{4})/); if (m) out.nascimento = m[1]; }

    if (/Legenda de Indicadores/i.test(L)) { modo = null; ultimoVinculo = null; continue; }
    if (/Valores Consolidados por Ano Civil/i.test(L)) { modo = null; continue; }
    if (/^Remunerações\b/.test(L)) { modo = 'remu'; continue; }
    if (/^Contribuições\b/.test(L)) { modo = 'contrib'; continue; }

    const mSeq = L.match(/^(\d{1,3})\s/);
    const temNIT = RX_NIT.test(L);
    const datas = [...L.matchAll(RX_DATA)].map(m => m[1]);
    // Linha de vínculo: começa com seq e tem NIT, ou começa com seq e tem ≥1 data
    // (após juntar continuações, a maioria terá NIT; fallback por datas para layouts sem NIT visível)
    const ehVinculo = mSeq && !/^\d{2}\/\d{4}/.test(L) && (temNIT || datas.length >= 1);
    if (ehVinculo) {
      const seq = +mSeq[1];
      let origem = '';
      // Tentar extrair origem após NIT
      if (temNIT) {
        const mOri = L.match(/\d{3}\.\d{5}\.\d{2}-\d\s+(?:[\d.]+\s+)?([A-ZÀ-Ü][A-ZÀ-Ü0-9 .\/&'()-]*?)(?=\s+(?:\d{4,}|Empregado|Contribuinte|Trabalhador|Facultativo|Segurado|\d{2}\/\d{2}\/\d{4}))/);
        if (mOri) origem = mOri[1].trim();
      }
      // Fallback: extrair texto entre seq e a primeira data
      if (!origem && datas.length) {
        const idxData = L.indexOf(datas[0]);
        if (idxData > 3) {
          origem = L.slice(mSeq[0].length, idxData).replace(/\d{3}\.\d{5}\.\d{2}-\d/, '').replace(/^\s+|\s+$/g, '').replace(/\s+/g, ' ').trim();
        }
      }
      const tipoCI = /Contribuinte Individual|RECOLHIMENTO|Facultativo/i.test(L);
      const v: VinculoCNIS = {
        seq, origem: origem || ('Vínculo seq. ' + seq),
        ini: datas[0] || null, fim: datas[1] || null,
        aberto: datas.length < 2,
        tipo: tipoCI ? 'CI' : 'Empregado',
        indicadores: [],
      };
      out.vinculos.push(v);
      ultimoVinculo = v;
      modo = null;
      continue;
    }

    if (/^Indicadores:/.test(L) && ultimoVinculo) {
      const inds = L.match(RX_IND) || [];
      for (const x of inds) if (x !== 'Indicadores') { ultimoVinculo.indicadores.push(x); indicadores.add(x); }
      continue;
    }

    const comps = [...L.matchAll(RX_COMP)].map(m => ({ comp: m[1], idx: m.index! }));
    if (comps.length && modo) {
      for (let c = 0; c < comps.length; c++) {
        const ini = comps[c].idx;
        const fim = c + 1 < comps.length ? comps[c + 1].idx : L.length;
        const seg = L.slice(ini + 7, fim);
        const monies = seg.match(RX_MONEY) || [];
        let valor: number | null = null;
        if (modo === 'contrib') {
          if (monies.length) valor = Math.max(...monies.map(moneyToNum));
        } else {
          if (monies.length) valor = moneyToNum(monies[0]!);
        }
        if (valor != null && isFinite(valor)) porComp[comps[c].comp] = (porComp[comps[c].comp] || 0) + valor;
        const inds = seg.match(RX_IND) || [];
        for (const x of inds) indicadores.add(x);
      }
      continue;
    }
  }

  out.competencias = Object.entries(porComp)
    .map(([comp, valor]) => ({ comp, valor: Math.round(valor * 100) / 100 }))
    .sort((a, b) => compToOrd(a.comp) - compToOrd(b.comp));
  out.indicadores = [...indicadores];

  if (!out.vinculos.length) out.avisos.push('Nenhum vínculo identificado — o PDF pode ser digitalizado (imagem) ou de layout diferente. Confira manualmente.');
  for (const v of out.vinculos) if (v.aberto) out.avisos.push(`Vínculo seq. ${v.seq} (${v.origem}) sem data fim no CNIS — informe a data fim ou a data-base.`);
  out.avisos.push('Salários importados são NOMINAIS. A atualização monetária é aplicada pelo motor (tabela de fatores) — confira a data-base.');
  return out;
}

/** Agrupa itens do pdf.js em linhas de texto, em coordenadas de tela. */
export function itensParaLinhas(
  items: { str: string; transform: number[] }[],
  viewport?: { transform: number[] },
  Util?: { transform: (a: number[], b: number[]) => number[] },
): string[] {
  const rows: { y: number; cells: { x: number; s: string }[] }[] = [];
  for (const it of items) {
    let x = it.transform[4], y = it.transform[5];
    if (viewport && Util) {
      const t = Util.transform(viewport.transform, it.transform);
      x = t[4]; y = t[5];
    } else {
      y = -y;
    }
    if (!it.str.trim()) continue;
    let row = rows.find(r => Math.abs(r.y - y) < 4);
    if (!row) { row = { y, cells: [] }; rows.push(row); }
    row.cells.push({ x, s: it.str });
  }
  rows.sort((a, b) => a.y - b.y);
  return rows.map(r => r.cells.sort((a, b) => a.x - b.x).map(c => c.s).join(' '));
}
