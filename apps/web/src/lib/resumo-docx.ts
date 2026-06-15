/**
 * Geração do .docx do Resumo de Atendimento (servidor), no formato narrativo do escritório.
 * Números vêm dos cenários do motor.
 */
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  AlignmentType, BorderStyle, LevelFormat,
} from 'docx';
import { assuntoResumo, type DadosResumo, type InputsResumo } from './resumo-atendimento';

const AZUL = '1F3864';
const CINZA = '595959';
const fmtMoeda = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const anos = (i: number | null) => (i != null ? `${Math.floor(i)} anos` : 'idade a apurar');

const P = (children: TextRun[], opts: Record<string, unknown> = {}) =>
  new Paragraph({ spacing: { after: 120, line: 276 }, children, ...opts });
const T = (t: string) => new TextRun(t);
const B = (t: string) => new TextRun({ text: t, bold: true });

export async function gerarResumoDocx(dados: DadosResumo, inputs: InputsResumo): Promise<Buffer> {
  const children: Paragraph[] = [];

  children.push(new Paragraph({
    spacing: { after: 80 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: AZUL, space: 4 } },
    children: [new TextRun({ text: 'Resumo da Análise / Atendimento', bold: true, size: 32, color: AZUL })],
  }));
  children.push(P([new TextRun({ text: assuntoResumo(dados.clienteNome), italics: true, color: CINZA, size: 20 })]));

  // Preâmbulo
  const ctx = inputs.contexto?.trim() ? `${inputs.contexto.trim()} e ` : '';
  const preambulo = `${ctx ? ctx.charAt(0).toUpperCase() + ctx.slice(1) : ''}conforme anotações, no presente caso, trata-se de planejamento para uma ${dados.tipoAposentadoria}.`;
  children.push(P([T(preambulo)]));

  // Simulações
  if (dados.cenarios.length > 0) {
    children.push(P([T('Neste sentido foram realizadas as simulações das seguintes formas:')]));
    for (const c of dados.cenarios) {
      const dib = c.dib ?? 'data a apurar';
      const rmi = c.rmi != null ? ` — RMI estimada ${fmtMoeda(c.rmi)}` : '';
      children.push(new Paragraph({
        spacing: { after: 40, line: 276 }, indent: { left: 540, hanging: 280 },
        children: [B(`${c.letra}) `), T(`${c.regraNome} em ${dib} (${anos(c.idade)}), ${c.rotulo}${rmi};`)],
      }));
    }
    children.push(P([]));
  }

  // Comparativos
  if (dados.comparativos.length > 0) {
    children.push(P([T('Diante dos cenários acima, foram realizados os seguintes comparativos:')]));
    for (const cmp of dados.comparativos) {
      children.push(new Paragraph({
        spacing: { after: 40, line: 276 }, indent: { left: 540, hanging: 280 },
        children: [B(`${cmp.letra}) `), T(`${cmp.descricao};`)],
      }));
    }
    children.push(P([]));
  }

  // Recomendação
  if (dados.recomendacao) {
    const doc = dados.recomendacao.docNum ? ` (Doc. ${dados.recomendacao.docNum})` : '';
    children.push(P([
      T('Diante dos comparativos, resultou '), B(`${dados.recomendacao.texto}${doc}`),
      T(' como a opção mais favorável.'),
    ]));
  }

  // Pendências
  if (dados.pendencias.length > 0) {
    children.push(new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun('Pendências identificadas no CNIS')] }));
    const SEV: Record<string, string> = { alta: 'alta', media: 'média', baixa: 'baixa' };
    for (const p of dados.pendencias) {
      children.push(new Paragraph({
        numbering: { reference: 'pend', level: 0 }, spacing: { after: 20, line: 276 },
        children: [B(p.titulo), new TextRun({ text: ` (severidade ${SEV[p.severidade]})`, color: CINZA })],
      }));
      children.push(new Paragraph({
        spacing: { after: 100, line: 276 }, indent: { left: 720 },
        children: [new TextRun({ text: `Providência: ${p.providencia}`, color: CINZA, size: 20 })],
      }));
    }
  }

  // Documentos a providenciar
  const docs = inputs.documentosProvidenciar.map(d => d.trim()).filter(Boolean);
  if (docs.length > 0) {
    children.push(new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun('Documentos a providenciar')] }));
    for (const d of docs) {
      children.push(new Paragraph({ numbering: { reference: 'docs', level: 0 }, spacing: { after: 40, line: 276 }, children: [T(d)] }));
    }
  }

  // Proposta
  if (inputs.escopo?.trim() || inputs.valor?.trim() || inputs.validade?.trim()) {
    children.push(new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun('Proposta de trabalho')] }));
    if (inputs.escopo?.trim()) children.push(P([B('Escopo: '), T(inputs.escopo.trim())]));
    if (inputs.valor?.trim()) children.push(P([B('Honorários: '), T(inputs.valor.trim())]));
    if (inputs.validade?.trim()) children.push(P([B('Validade da proposta: '), T(inputs.validade.trim())]));
  }

  children.push(P([T('Após, redigi o parecer e enviei tudo por e-mail à cliente. Vide anexo.')], { spacing: { before: 160, after: 120, line: 276 } }));

  if (dados.minuta) {
    children.push(new Paragraph({
      spacing: { before: 240 },
      border: { top: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC', space: 6 } },
      children: [new TextRun({ text: 'MINUTA — requer conferência do advogado antes do envio.', italics: true, color: CINZA, size: 18 })],
    }));
  }

  const doc = new Document({
    styles: {
      default: { document: { run: { font: 'Arial', size: 22 } } },
      paragraphStyles: [
        { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 24, bold: true, font: 'Arial', color: AZUL },
          paragraph: { spacing: { before: 200, after: 100 }, outlineLevel: 1 } },
      ],
    },
    numbering: {
      config: ['pend', 'docs'].map(ref => ({
        reference: ref,
        levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 280 } } } }],
      })),
    },
    sections: [{
      properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
      children,
    }],
  });

  return Packer.toBuffer(doc);
}
