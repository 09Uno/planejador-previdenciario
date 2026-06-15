// ===================================================================
// GERADOR DE PARECER PREVIDENCIÁRIO (.docx)
// Template fiel à estrutura dos pareceres do Dr. Ailton (MFAA).
// Todos os números vêm dos objetos do motor — ZERO geração por LLM.
// ===================================================================
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, HeadingLevel, WidthType, BorderStyle,
  Header, Footer, PageNumber, NumberFormat,
  ShadingType,
} from 'docx';
import type { Regra, Sexo } from '@mfaa/prev-engine';
import type { ResultadoRMI } from '@mfaa/prev-engine';
import type { ResultadoROI, Comparativo } from '@mfaa/prev-engine';
import type { Pendencia } from '@mfaa/prev-engine';

export interface CenarioParecer {
  docNum: string;
  rotulo: string;
  regra: Regra;
  dib: string | null;
  idadeNaDIB: number | null;
  tcNaDIB: string | null;
  tcDias: number;
  carenciaNaDIB: number;
  mesesProjetados: number;
  contribuicaoMensal: number;
  rmi: ResultadoRMI | null;
  roi: ResultadoROI | null;
}

export interface DadosParecer {
  clienteNome: string;
  sexo: Sexo;
  nascimento: string;
  /** TC em 12/11/2019 formatado */
  tcVespera: string;
  /** Idade em 12/11/2019 formatada */
  idadeVespera: string;
  /** Regras avaliadas (todas) */
  regras: Regra[];
  /** Cenários selecionados para o parecer */
  cenarios: CenarioParecer[];
  /** Comparativos encadeados de ROI */
  comparativos: Comparativo[];
  /** Pendências da auditoria do CNIS */
  pendencias: Pendencia[];
  /** Se é minuta (marca d'água) */
  minuta: boolean;
}

const AZUL = '1F3864';
const CINZA = 'F2F2F2';

function t(text: string, opts: Partial<{ bold: boolean; size: number; color: string; italics: boolean }> = {}): TextRun {
  return new TextRun({ text, bold: opts.bold, size: opts.size ?? 22, color: opts.color, italics: opts.italics });
}

function heading(text: string, level: typeof HeadingLevel[keyof typeof HeadingLevel] = HeadingLevel.HEADING_1): Paragraph {
  return new Paragraph({ heading: level, children: [t(text, { bold: true, color: AZUL })] });
}

function para(text: string, opts: { bold?: boolean; alignment?: typeof AlignmentType[keyof typeof AlignmentType]; spacing?: { after?: number } } = {}): Paragraph {
  return new Paragraph({
    alignment: opts.alignment,
    spacing: opts.spacing ?? { after: 120 },
    children: [t(text, { bold: opts.bold })],
  });
}

function bullet(text: string): Paragraph {
  return new Paragraph({
    bullet: { level: 0 },
    spacing: { after: 80 },
    children: [t(text)],
  });
}

function alinea(letra: string, text: string): Paragraph {
  return new Paragraph({
    spacing: { after: 100 },
    indent: { left: 720 },
    children: [t(`${letra}) `, { bold: true }), t(text)],
  });
}

const fmtMoeda = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export async function gerarParecer(dados: DadosParecer): Promise<Buffer> {
  const sexoLabel = dados.sexo === 'M' ? 'o segurado' : 'a segurada';
  const SexoLabel = dados.sexo === 'M' ? 'O segurado' : 'A segurada';

  const sections: Paragraph[] = [];

  // ---- CAPA ----
  sections.push(new Paragraph({ spacing: { before: 2400 } }));
  sections.push(para('PARECER PREVIDENCIÁRIO', { bold: true, alignment: AlignmentType.CENTER }));
  sections.push(new Paragraph({ spacing: { after: 400 } }));
  sections.push(para(dados.clienteNome, { bold: true, alignment: AlignmentType.CENTER }));
  sections.push(new Paragraph({ spacing: { after: 200 } }));

  const beneficios = dados.cenarios.map(c => c.rotulo).join('; ');
  sections.push(para(`Benefícios analisados: ${beneficios}`, { alignment: AlignmentType.CENTER }));
  sections.push(new Paragraph({ spacing: { after: 800 } }));

  if (dados.minuta) {
    sections.push(para('MINUTA — requer conferência do advogado', { bold: true, alignment: AlignmentType.CENTER }));
  }

  // ---- SUMÁRIO ----
  sections.push(heading('Sumário'));
  sections.push(para('Doc 1.0 — Contagem de tempo de contribuição anterior à EC 103/2019'));
  for (const c of dados.cenarios) {
    sections.push(para(`Doc ${c.docNum} — ${c.rotulo}`));
  }
  sections.push(new Paragraph({ spacing: { after: 400 } }));

  // ---- PREÂMBULO ----
  sections.push(heading('1. Preâmbulo'));
  sections.push(para(
    `Trata-se de parecer previdenciário, com base nos documentos apresentados, ` +
    `destinado a analisar as possibilidades de aposentadoria d${sexoLabel} ` +
    `${dados.clienteNome}, nascid${dados.sexo === 'M' ? 'o' : 'a'} em ${dados.nascimento}, ` +
    `no âmbito do Regime Geral de Previdência Social (RGPS), considerando ` +
    `as regras anteriores e posteriores à Emenda Constitucional nº 103/2019.`
  ));

  // ---- REQUISITOS ANTERIORES À REFORMA ----
  sections.push(heading('2. Requisitos anteriores à reforma'));
  sections.push(para(
    `${SexoLabel} contava, em 12/11/2019 (véspera da EC 103/2019), com ` +
    `tempo de contribuição de ${dados.tcVespera} e idade de ${dados.idadeVespera}.`
  ));
  const da = dados.regras.find(r => r.id === 'da');
  if (da) {
    sections.push(para(`Direito adquirido: ${da.cumprida ? 'SIM' : 'NÃO'}. ${da.detalhe}`));
  }

  // ---- REQUISITOS POSTERIORES (REGRAS ARTS. 15-20) ----
  sections.push(heading('3. Requisitos posteriores à reforma'));
  for (const r of dados.regras.filter(r => r.id !== 'da')) {
    sections.push(para(`${r.nome}`, { bold: true }));
    sections.push(para(`Fundamento: ${r.fundamento}`));
    sections.push(para(`Situação: ${r.cumprida ? 'CUMPRIDA' : 'PENDENTE'}${r.data ? ` — data: ${new Date(r.data).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}` : ''}`));
    sections.push(para(`${r.detalhe}`));
    sections.push(new Paragraph({ spacing: { after: 200 } }));
  }

  // ---- CASO CONCRETO ----
  sections.push(heading('4. Caso Concreto'));
  sections.push(para(
    `Analisando as regras aplicáveis ao caso concreto d${sexoLabel} ` +
    `${dados.clienteNome}, verificam-se as seguintes possibilidades:`
  ));
  for (const r of dados.regras) {
    const status = r.cumprida
      ? `requisitos já cumpridos`
      : (r.data ? `implemento projetado para ${new Date(r.data).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}` : 'não alcançada no horizonte analisado');
    sections.push(bullet(`${r.nome}: ${status}.`));
  }

  // ---- PROJEÇÕES PARA CONCESSÃO ----
  sections.push(heading('5. Projeções para a Concessão dos Benefícios'));
  for (const c of dados.cenarios) {
    sections.push(para(`Doc ${c.docNum} — ${c.rotulo}`, { bold: true }));

    if (c.dib) {
      sections.push(para(`TC TOTAL na DIB: ${c.tcNaDIB} (ref. Doc ${c.docNum.replace('.1', '.0')})`));
      sections.push(para(`IDADE na DIB: ${c.idadeNaDIB?.toFixed(1)} anos`));
      sections.push(para(`CARÊNCIA: ${c.carenciaNaDIB} contribuições`));

      if (c.rmi) {
        sections.push(para(`RMI: ${fmtMoeda(c.rmi.rmi)} (ref. Doc ${c.docNum})`));
        sections.push(para(`Média: ${fmtMoeda(c.rmi.media)} — ${c.rmi.coeficiente != null ? `Coeficiente: ${(c.rmi.coeficiente * 100).toFixed(0)}%` : ''} ${c.rmi.fator != null ? `Fator: ${c.rmi.fator.toFixed(4)}` : ''}`));
        if (c.rmi.descartes > 0) {
          sections.push(para(`APLICAÇÃO DO DESCARTE: ${c.rmi.descartes} competência(s) descartada(s) (art. 26, §6º, EC 103/2019).`));
        }
        if (c.rmi.es != null) {
          sections.push(para(`EXPECTATIVA DE SOBREVIDA (IBGE): ${c.rmi.es} anos`));
        }
      }

      if (c.mesesProjetados > 0) {
        sections.push(para(`Hipótese contributiva: ${c.mesesProjetados} mês(es) de contribuição futura sobre ${fmtMoeda(c.contribuicaoMensal)}/mês.`));
      }
    } else {
      sections.push(para('Regra não alcançada no horizonte analisado.'));
    }
    sections.push(new Paragraph({ spacing: { after: 200 } }));
  }

  // ---- ESTIMATIVA DE INVESTIMENTO / ROI ----
  if (dados.cenarios.some(c => c.roi)) {
    sections.push(heading('6. Estimativa de Investimento × Tempo de Recuperação'));
    for (const c of dados.cenarios.filter(c => c.roi)) {
      const roi = c.roi!;
      sections.push(para(`${c.rotulo}`, { bold: true }));
      sections.push(para(`RMI Bruta: ${fmtMoeda(roi.rmiBruta)} | RMI Líquida (até 65): ${fmtMoeda(roi.rmiLiquidaAte65)} | RMI Líquida (65+): ${fmtMoeda(roi.rmiLiquidaApos65)}`));
      sections.push(para(`Total contribuições: ${fmtMoeda(roi.totalContribuicoes)} | Total investimentos: ${fmtMoeda(roi.totalInvestimentos)}`));
      sections.push(para(`ROI PREVIDENCIÁRIO LÍQUIDO: ${fmtMoeda(roi.roiLiquido)}`, { bold: true }));
      sections.push(new Paragraph({ spacing: { after: 200 } }));
    }

    // Tabela comparativa
    if (dados.comparativos.length > 0) {
      sections.push(para('Comparativos encadeados:', { bold: true }));
      for (let i = 0; i < dados.comparativos.length; i++) {
        const comp = dados.comparativos[i];
        sections.push(para(
          `Confronto ${String.fromCharCode(65 + i)}: ` +
          `${comp.a.rotulo} (${fmtMoeda(comp.a.roiLiquido)}) × ` +
          `${comp.b.rotulo} (${fmtMoeda(comp.b.roiLiquido)}) → ` +
          `Diferença: ${fmtMoeda(comp.diferencaROI)} — Vencedor: ${comp.vencedor}`
        ));
      }
      const vencedorFinal = dados.comparativos[dados.comparativos.length - 1].vencedor;
      sections.push(para(`VENCEDOR FINAL: ${vencedorFinal}`, { bold: true }));
    }
  }

  // ---- OMISSÕES E DIVERGÊNCIAS ----
  const secOmissoes = dados.pendencias.length > 0 ? '7' : null;
  if (secOmissoes) {
    sections.push(heading(`${secOmissoes}. Das Omissões e Divergências`));
    sections.push(para('A auditoria do CNIS identificou as seguintes pendências:'));
    for (const p of dados.pendencias) {
      sections.push(bullet(`[${p.severidade.toUpperCase()}] ${p.titulo}: ${p.detalhe} — Providência: ${p.providencia}`));
    }
  }

  // ---- CONCLUSÃO ----
  const secConclusao = secOmissoes ? parseInt(secOmissoes) + 1 : 7;
  sections.push(heading(`${secConclusao}. Conclusão e Opinião`));
  sections.push(para('Diante do exposto, opina-se:'));

  const letras = 'abcdefghijklmnop';
  let idx = 0;

  for (const c of dados.cenarios) {
    if (c.dib && c.rmi) {
      sections.push(alinea(
        letras[idx++],
        `Pela possibilidade de requerimento da ${c.rotulo}, com DIB em ${c.dib}, ` +
        `RMI estimada de ${fmtMoeda(c.rmi.rmi)}${c.roi ? ` e ROI líquido de ${fmtMoeda(c.roi.roiLiquido)}` : ''}.`
      ));
    }
  }

  sections.push(new Paragraph({ spacing: { after: 200 } }));
  sections.push(para(
    'Ressalva-se que os valores apresentados são estimativas baseadas nos dados ' +
    'disponíveis e nos parâmetros vigentes na data da análise, podendo sofrer ' +
    'alterações em razão de atualizações legislativas, tabelas de atualização ' +
    'monetária e dados complementares.',
    { italics: true } as never
  ));

  sections.push(new Paragraph({ spacing: { after: 400 } }));
  sections.push(para('É o que nos parece, salvo melhor juízo.'));
  sections.push(new Paragraph({ spacing: { after: 400 } }));
  sections.push(para(`São Paulo, ${new Date().toLocaleDateString('pt-BR')}.`));

  // ---- Montar documento ----
  const doc = new Document({
    sections: [{
      properties: {},
      headers: {
        default: new Header({
          children: [para('MACHADO FILGUEIRAS ADVOCACIA', { bold: true, alignment: AlignmentType.RIGHT })],
        }),
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                t(dados.minuta ? 'MINUTA — requer conferência do advogado | ' : '', { size: 16, color: 'CC0000' }),
                t('Página ', { size: 16 }),
                new TextRun({ children: [PageNumber.CURRENT], size: 16 }),
              ],
            }),
          ],
        }),
      },
      children: sections,
    }],
  });

  return Buffer.from(await Packer.toBuffer(doc));
}
