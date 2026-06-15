'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { mkdir, writeFile, unlink, rename } from 'node:fs/promises';
import { join } from 'node:path';
import { prisma } from '@/lib/prisma';
import { lerSessao } from '@/lib/auth';
import { registrarEvento } from '@/lib/auditoria';

const STORAGE_ROOT = join(process.cwd(), 'storage', 'casos');
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

function sanitize(s: string): string {
  return s.replace(/[^a-zA-Z0-9_.-]/g, '_').replace(/_+/g, '_').slice(0, 80);
}

function mfaaFilename(classificacao: string, nomeOriginal: string): string {
  const d = new Date();
  const prefix = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const ext = nomeOriginal.includes('.') ? nomeOriginal.slice(nomeOriginal.lastIndexOf('.')) : '';
  const desc = sanitize(nomeOriginal.replace(/\.[^.]+$/, ''));
  return `${prefix}-${classificacao}-${desc}${ext}`;
}

// ── Upload ──────────────────────────────────────────────────────────
export async function uploadArquivoAction(casoId: string, formData: FormData) {
  const sessao = await lerSessao();
  if (!sessao) redirect('/login');

  const file = formData.get('file') as File | null;
  const classificacao = (formData.get('classificacao') as string) || 'outro';
  if (!file) throw new Error('Nenhum arquivo enviado');
  if (file.size > MAX_FILE_SIZE) throw new Error('Arquivo excede 20 MB');

  const dir = join(STORAGE_ROOT, casoId);
  await mkdir(dir, { recursive: true });

  const nomeArquivo = mfaaFilename(classificacao, file.name);
  const caminho = join('storage', 'casos', casoId, nomeArquivo);
  const caminhoAbsoluto = join(STORAGE_ROOT, casoId, nomeArquivo);

  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(caminhoAbsoluto, buffer);

  const arquivo = await prisma.arquivo.create({
    data: {
      casoId,
      nome: file.name,
      tipo: file.type,
      tamanho: file.size,
      caminho,
      classificacao,
      status: 'pendente',
    },
  });

  await registrarEvento(
    sessao.usuarioId,
    'upload_arquivo',
    `Upload: ${file.name} (${classificacao})`,
    casoId,
  );

  revalidatePath(`/casos/${casoId}`);
  return arquivo;
}

// ── Listar ──────────────────────────────────────────────────────────
export async function listarArquivosAction(casoId: string) {
  const sessao = await lerSessao();
  if (!sessao) redirect('/login');

  return prisma.arquivo.findMany({
    where: { casoId },
    orderBy: { criadoEm: 'desc' },
  });
}

// ── Reclassificar ───────────────────────────────────────────────────
export async function reclassificarArquivoAction(arquivoId: string, novaClassificacao: string) {
  const sessao = await lerSessao();
  if (!sessao) redirect('/login');

  const arq = await prisma.arquivo.findUnique({ where: { id: arquivoId } });
  if (!arq) throw new Error('Arquivo não encontrado');

  // Renomear arquivo no disco para refletir nova classificação
  const novoNome = mfaaFilename(novaClassificacao, arq.nome);
  const novoCaminho = join('storage', 'casos', arq.casoId, novoNome);
  const antigoAbs = join(process.cwd(), arq.caminho);
  const novoAbs = join(process.cwd(), novoCaminho);

  try { await rename(antigoAbs, novoAbs); } catch { /* arquivo pode já ter sido movido */ }

  await prisma.arquivo.update({
    where: { id: arquivoId },
    data: { classificacao: novaClassificacao, caminho: novoCaminho },
  });

  await registrarEvento(
    sessao.usuarioId,
    'reclassificar_arquivo',
    `Reclassificado para ${novaClassificacao}: ${arq.nome}`,
    arq.casoId,
  );

  revalidatePath(`/casos/${arq.casoId}`);
}

// ── Excluir ─────────────────────────────────────────────────────────
export async function excluirArquivoAction(arquivoId: string) {
  const sessao = await lerSessao();
  if (!sessao) redirect('/login');

  const arq = await prisma.arquivo.findUnique({ where: { id: arquivoId } });
  if (!arq) throw new Error('Arquivo não encontrado');

  try { await unlink(join(process.cwd(), arq.caminho)); } catch { /* ok se já removido */ }

  await prisma.arquivo.delete({ where: { id: arquivoId } });

  await registrarEvento(
    sessao.usuarioId,
    'excluir_arquivo',
    `Excluído: ${arq.nome}`,
    arq.casoId,
  );

  revalidatePath(`/casos/${arq.casoId}`);
}

// ── Marcar como só-arquivo ──────────────────────────────────────────
export async function marcarSoArquivoAction(arquivoId: string) {
  const sessao = await lerSessao();
  if (!sessao) redirect('/login');

  const arq = await prisma.arquivo.update({
    where: { id: arquivoId },
    data: { status: 'so-arquivo' },
  });

  revalidatePath(`/casos/${arq.casoId}`);
}

// ── Processar PPP (vincular período especial) ───────────────────────
export async function processarPPPAction(
  arquivoId: string,
  dados: { periodoIndex: number; grau: 15 | 20 | 25 },
) {
  const sessao = await lerSessao();
  if (!sessao) redirect('/login');

  const arq = await prisma.arquivo.findUnique({ where: { id: arquivoId } });
  if (!arq) throw new Error('Arquivo não encontrado');

  const caso = await prisma.caso.findUnique({ where: { id: arq.casoId } });
  if (!caso?.periodosJson) throw new Error('Caso sem períodos');

  const periodos = JSON.parse(caso.periodosJson);
  if (dados.periodoIndex < 0 || dados.periodoIndex >= periodos.length) throw new Error('Índice inválido');

  periodos[dados.periodoIndex].tipo = 'especial';
  periodos[dados.periodoIndex].grauEspecial = dados.grau;

  await prisma.caso.update({
    where: { id: arq.casoId },
    data: { periodosJson: JSON.stringify(periodos) },
  });

  await prisma.arquivo.update({
    where: { id: arquivoId },
    data: {
      status: 'processado',
      dadosExtraidos: JSON.stringify({
        tipo: 'ppp',
        periodoIndex: dados.periodoIndex,
        grau: dados.grau,
      }),
    },
  });

  await registrarEvento(
    sessao.usuarioId,
    'processar_ppp',
    `PPP vinculado ao período ${dados.periodoIndex + 1} (grau ${dados.grau})`,
    arq.casoId,
  );

  revalidatePath(`/casos/${arq.casoId}`);
}

// ── Processar CTSM (criar período militar) ──────────────────────────
export async function processarCTSMAction(
  arquivoId: string,
  dados: { ini: string; fim: string; desc: string },
) {
  const sessao = await lerSessao();
  if (!sessao) redirect('/login');

  const arq = await prisma.arquivo.findUnique({ where: { id: arquivoId } });
  if (!arq) throw new Error('Arquivo não encontrado');

  const caso = await prisma.caso.findUnique({ where: { id: arq.casoId } });
  const periodos = caso?.periodosJson ? JSON.parse(caso.periodosJson) : [];

  periodos.push({
    ini: dados.ini,
    fim: dados.fim,
    desc: dados.desc || 'Serviço militar',
    tipo: 'militar',
  });

  await prisma.caso.update({
    where: { id: arq.casoId },
    data: { periodosJson: JSON.stringify(periodos) },
  });

  await prisma.arquivo.update({
    where: { id: arquivoId },
    data: {
      status: 'processado',
      dadosExtraidos: JSON.stringify({
        tipo: 'ctsm',
        periodo: dados,
      }),
    },
  });

  await registrarEvento(
    sessao.usuarioId,
    'processar_ctsm',
    `Período militar criado: ${dados.ini} a ${dados.fim}`,
    arq.casoId,
  );

  revalidatePath(`/casos/${arq.casoId}`);
}

// ── Processar CTC (registrar períodos certificados) ─────────────────
export async function processarCTCAction(
  arquivoId: string,
  dados: { periodos: { ini: string; fim: string; desc: string }[] },
) {
  const sessao = await lerSessao();
  if (!sessao) redirect('/login');

  const arq = await prisma.arquivo.findUnique({ where: { id: arquivoId } });
  if (!arq) throw new Error('Arquivo não encontrado');

  const caso = await prisma.caso.findUnique({ where: { id: arq.casoId } });
  const periodos = caso?.periodosJson ? JSON.parse(caso.periodosJson) : [];

  for (const p of dados.periodos) {
    periodos.push({ ini: p.ini, fim: p.fim, desc: p.desc || 'CTC', tipo: 'CTC' });
  }

  await prisma.caso.update({
    where: { id: arq.casoId },
    data: { periodosJson: JSON.stringify(periodos) },
  });

  await prisma.arquivo.update({
    where: { id: arquivoId },
    data: {
      status: 'processado',
      dadosExtraidos: JSON.stringify({
        tipo: 'ctc',
        periodos: dados.periodos.length,
      }),
    },
  });

  await registrarEvento(
    sessao.usuarioId,
    'processar_ctc',
    `CTC: ${dados.periodos.length} período(s) registrado(s)`,
    arq.casoId,
  );

  revalidatePath(`/casos/${arq.casoId}`);
}
