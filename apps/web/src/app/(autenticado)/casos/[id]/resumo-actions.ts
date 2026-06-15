'use server';

import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { lerSessao } from '@/lib/auth';
import { registrarEvento } from '@/lib/auditoria';
import {
  parseBR, mesclarPeriodos, avaliarRegras, auditarCNIS,
  type Periodo, type Sexo, type ResultadoCNIS, type Pendencia,
} from '@mfaa/prev-engine';
import {
  montarTextoResumo,
  type DadosResumo, type InputsResumo, type CenarioResumo,
  type ComparativoResumo, type PendenciaResumo,
} from '@/lib/resumo-atendimento';
import { gerarResumoDocx } from '@/lib/resumo-docx';

const LETRAS = 'abcdefghijklmnopqrstuvwxyz'.split('');

/** Mapeia a regra para o tipo de aposentadoria narrado. */
function tipoAposentadoria(regraId: string): string {
  if (['art18', 'art16', 'perm'].includes(regraId)) return 'aposentadoria por idade';
  if (regraId === 'art15') return 'aposentadoria por tempo de contribuição (regra de pontos)';
  if (regraId === 'art17') return 'aposentadoria por tempo de contribuição (pedágio de 50%)';
  if (regraId === 'art20') return 'aposentadoria por tempo de contribuição (pedágio de 100%)';
  if (regraId === 'da') return 'aposentadoria por tempo de contribuição (direito adquirido)';
  if (['art21', 'esp_perm'].includes(regraId)) return 'aposentadoria especial';
  if (regraId.startsWith('prof_')) return 'aposentadoria do professor';
  if (regraId.startsWith('pcd_')) return 'aposentadoria da pessoa com deficiência';
  return 'aposentadoria';
}

/** Deriva, a partir do caso, a parte do resumo que vem do cálculo. */
async function derivarDados(casoId: string): Promise<DadosResumo> {
  const caso = await prisma.caso.findUnique({
    where: { id: casoId },
    include: { cenarios: { orderBy: { criadoEm: 'asc' } } },
  });
  if (!caso) throw new Error('Caso não encontrado');
  if (!caso.periodosJson) throw new Error('Confirme os dados do CNIS antes de gerar o resumo.');

  const periodos: { ini: string; fim: string; desc?: string }[] = JSON.parse(caso.periodosJson);
  const merged: Periodo[] = mesclarPeriodos(
    periodos.map(p => ({ ini: parseBR(p.ini)!, fim: parseBR(p.fim)!, desc: p.desc })),
  );
  const nasc = parseBR(caso.nascimento)!;
  const av = avaliarRegras({ sexo: caso.sexo as Sexo, nasc, merged, hoje: Date.now(), continuaContribuindo: true });

  // Cenários selecionados (na ordem de seleção = ordem de criação)
  const selecionados = caso.cenarios
    .map(c => ({ resultado: JSON.parse(c.resultadoJson), premissas: JSON.parse(c.premissasJson), rotulo: c.rotulo }))
    .filter(c => c.premissas.selecionado);

  const cenarios: CenarioResumo[] = selecionados.map((c, i) => {
    const regra = av.regras.find(r => r.id === c.resultado.regra);
    return {
      letra: LETRAS[i] ?? `${i + 1}`,
      regraNome: regra?.nome ?? c.rotulo,
      fundamento: regra?.fundamento ?? '—',
      dib: c.resultado.dib ?? null,
      idade: c.resultado.idadeNaDIB ?? null,
      rmi: c.resultado.rmi?.rmi ?? null,
      rotulo: c.rotulo,
      docNum: `${i + 2}.0/${i + 2}.1`,
    };
  });

  // Comparativos encadeados entre os cenários que têm ROI (guarda o índice original)
  const comRoi = selecionados
    .map((c, i) => ({ idx: i, letra: LETRAS[i] ?? `${i + 1}`, roi: c.resultado.roi as { roiLiquido: number } | null }))
    .filter((c): c is { idx: number; letra: string; roi: { roiLiquido: number } } => !!c.roi);

  const comparativos: ComparativoResumo[] = [];
  for (let k = 0; k < comRoi.length - 1; k++) {
    const letra = LETRAS[cenarios.length + k] ?? `c${k + 1}`;
    const esquerda = k === 0
      ? `cenário ${comRoi[0].letra}`
      : `resultado ${LETRAS[cenarios.length + k - 1]}`;
    const direita = `cenário ${comRoi[k + 1].letra}`;
    comparativos.push({ letra, descricao: `${esquerda} X ${direita}` });
  }

  // Vencedor = maior ROI líquido (o encadeamento sempre converge para o máximo)
  let recomendacao: DadosResumo['recomendacao'] = null;
  if (comRoi.length > 0) {
    const venc = comRoi.reduce((a, b) => (b.roi.roiLiquido > a.roi.roiLiquido ? b : a));
    const cv = cenarios[venc.idx];
    recomendacao = {
      texto: `a ${cv.regraNome.toLowerCase()} em ${cv.dib ?? 'data a apurar'} (${cv.idade != null ? Math.floor(cv.idade) : '—'} anos), ${cv.rotulo}`,
      docNum: cv.docNum,
    };
  } else if (cenarios.length === 1) {
    const cv = cenarios[0];
    recomendacao = { texto: `a ${cv.regraNome.toLowerCase()} em ${cv.dib ?? 'data a apurar'}, ${cv.rotulo}`, docNum: cv.docNum };
  }

  // Pendências da auditoria
  let pendencias: PendenciaResumo[] = [];
  if (caso.cnisJson) {
    const lista: Pendencia[] = auditarCNIS(JSON.parse(caso.cnisJson) as ResultadoCNIS);
    pendencias = lista.map(p => ({ severidade: p.severidade, titulo: p.titulo, providencia: p.providencia }));
  }

  return {
    clienteNome: caso.clienteNome,
    tipoAposentadoria: tipoAposentadoria(selecionados[0]?.resultado.regra ?? ''),
    cenarios,
    comparativos,
    recomendacao,
    pendencias,
    minuta: caso.status !== 'aprovado',
  };
}

/** Dados derivados (para o cliente montar o texto ao vivo). */
export async function prepararResumoAction(casoId: string): Promise<DadosResumo> {
  const sessao = await lerSessao();
  if (!sessao) redirect('/login');
  return derivarDados(casoId);
}

/** Gera o .docx do resumo e devolve em base64 para download no cliente. */
export async function gerarResumoDocxAction(casoId: string, inputs: InputsResumo): Promise<{ base64: string; nome: string }> {
  const sessao = await lerSessao();
  if (!sessao) redirect('/login');

  const dados = await derivarDados(casoId);
  const buffer = await gerarResumoDocx(dados, inputs);

  await registrarEvento(sessao.usuarioId, 'gerar_resumo_atendimento', 'Resumo de atendimento gerado (.docx)', casoId);

  const dataStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const nome = `${dataStr}-resumo-atendimento-${dados.clienteNome.replace(/\s+/g, '-').toLowerCase()}.docx`;
  return { base64: buffer.toString('base64'), nome };
}
