/**
 * Resumo de atendimento / análise (formato narrativo do escritório Machado Filgueiras).
 *
 * Espelha o texto real lançado no andamento do caso, ex.:
 *   "...trata-se de planejamento para uma aposentadoria por idade. Neste sentido
 *    foi realizado as simulações das seguintes formas:
 *    a) Art.18 em 15/02/2033 (62 anos) ... pelo teto;
 *    Diante dos cenários acima, foi realizado os seguintes comparativos:
 *    f) cenário a X cenário b; g) resultado f X cenário d;
 *    Diante dos comparativos, resultou a aposentadoria do artigo 18 (62 anos)
 *    em 15/02/2033 ... sobre o teto DIRETO SEM PARAR (Doc.3.0/3.2)."
 *
 * REGRA DE OURO: regras, datas, idade e RMI vêm dos cenários do motor. O texto
 * comercial (escopo, honorários, documentos) é o único conteúdo livre.
 *
 * Módulo PURO (sem dependências de Node) — usável no cliente e no servidor.
 */

export interface CenarioResumo {
  /** Letra do cenário no texto (a, b, c, ...) */
  letra: string;
  /** Nome da regra (ex.: "Art. 18 — Aposentadoria por idade") */
  regraNome: string;
  /** Fundamento legal */
  fundamento: string;
  /** Data de implemento / DIB (dd/mm/aaaa) */
  dib: string | null;
  /** Idade na DIB (anos, pode ter casas) */
  idade: number | null;
  /** RMI estimada (R$) */
  rmi: number | null;
  /** Descrição das premissas (ex.: "teto, sem parar") */
  rotulo: string;
  /** Numeração dos documentos (ex.: "3.0/3.1") */
  docNum?: string;
}

export interface ComparativoResumo {
  /** Letra do comparativo (continua após os cenários) */
  letra: string;
  /** Descrição (ex.: "cenário a X cenário b" ou "resultado f X cenário d") */
  descricao: string;
}

export interface RecomendacaoResumo {
  /** Texto do cenário vencedor (regra, idade, dib, premissa) */
  texto: string;
  docNum?: string;
}

export interface PendenciaResumo {
  severidade: 'alta' | 'media' | 'baixa';
  titulo: string;
  providencia: string;
}

export interface DadosResumo {
  clienteNome: string;
  /** Tipo de aposentadoria predominante (ex.: "aposentadoria por idade") */
  tipoAposentadoria: string;
  cenarios: CenarioResumo[];
  comparativos: ComparativoResumo[];
  recomendacao: RecomendacaoResumo | null;
  pendencias: PendenciaResumo[];
  minuta: boolean;
}

export interface InputsResumo {
  /** Contexto da reunião/análise (ex.: "conforme reunião do dia 10/06/2026") */
  contexto?: string;
  /** Documentos que o cliente deve providenciar (um por linha) */
  documentosProvidenciar: string[];
  /** Escopo do serviço proposto */
  escopo?: string;
  /** Valor / proposta comercial */
  valor?: string;
  /** Validade da proposta (ex.: "10 dias") */
  validade?: string;
}

const fmtMoeda = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const anos = (idade: number | null) => (idade != null ? `${Math.floor(idade)} anos` : 'idade a apurar');

export function assuntoResumo(clienteNome: string): string {
  return `Aposentadoria - ${clienteNome} - Planejamento Previdenciário e/ou Assessoria - Machado Filgueiras Adv.`;
}

/**
 * Monta o texto da análise no formato narrativo do escritório.
 */
export function montarTextoResumo(dados: DadosResumo, inputs: InputsResumo): string {
  const L: string[] = [];

  L.push(`Assunto: ${assuntoResumo(dados.clienteNome)}`);
  L.push('');

  // Preâmbulo
  const ctx = inputs.contexto?.trim() ? `${inputs.contexto.trim()} e ` : '';
  L.push(
    `${capitalizar(ctx)}conforme anotações, no presente caso, trata-se de planejamento para uma ${dados.tipoAposentadoria}.`,
  );
  L.push('');

  // Simulações (a, b, c, ...)
  if (dados.cenarios.length > 0) {
    L.push('Neste sentido foram realizadas as simulações das seguintes formas:');
    L.push('');
    for (const c of dados.cenarios) {
      const dib = c.dib ?? 'data a apurar';
      const rmi = c.rmi != null ? ` — RMI estimada ${fmtMoeda(c.rmi)}` : '';
      L.push(`${c.letra}) ${c.regraNome} em ${dib} (${anos(c.idade)}), ${c.rotulo}${rmi};`);
    }
    L.push('');
  }

  // Comparativos (f, g, h, ...)
  if (dados.comparativos.length > 0) {
    L.push('Diante dos cenários acima, foram realizados os seguintes comparativos:');
    L.push('');
    for (const cmp of dados.comparativos) {
      L.push(`${cmp.letra}) ${cmp.descricao};`);
    }
    L.push('');
  }

  // Recomendação / resultado
  if (dados.recomendacao) {
    const doc = dados.recomendacao.docNum ? ` (Doc. ${dados.recomendacao.docNum})` : '';
    L.push(`Diante dos comparativos, resultou ${dados.recomendacao.texto}${doc} como a opção mais favorável.`);
    L.push('');
  }

  // Pendências do CNIS
  if (dados.pendencias.length > 0) {
    L.push('Quanto às pendências identificadas no CNIS:');
    const SEV: Record<string, string> = { alta: 'alta', media: 'média', baixa: 'baixa' };
    for (const p of dados.pendencias) {
      L.push(`  - ${p.titulo} (severidade ${SEV[p.severidade]}). Providência: ${p.providencia}`);
    }
    L.push('');
  }

  // Documentos a providenciar
  const docs = inputs.documentosProvidenciar.map(d => d.trim()).filter(Boolean);
  if (docs.length > 0) {
    L.push('Documentos a providenciar:');
    for (const d of docs) L.push(`  - ${d}`);
    L.push('');
  }

  // Proposta
  if (inputs.escopo?.trim() || inputs.valor?.trim() || inputs.validade?.trim()) {
    const partes: string[] = [];
    if (inputs.escopo?.trim()) partes.push(`escopo: ${inputs.escopo.trim()}`);
    if (inputs.valor?.trim()) partes.push(`honorários: ${inputs.valor.trim()}`);
    if (inputs.validade?.trim()) partes.push(`validade da proposta: ${inputs.validade.trim()}`);
    L.push(`Proposta — ${partes.join('; ')}.`);
    L.push('');
  }

  // Fecho
  L.push('Após, redigi o parecer e enviei tudo por e-mail à cliente. Vide anexo.');

  if (dados.minuta) {
    L.push('');
    L.push('—');
    L.push('MINUTA — requer conferência do advogado antes do envio.');
  }

  return L.join('\n');
}

function capitalizar(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}
