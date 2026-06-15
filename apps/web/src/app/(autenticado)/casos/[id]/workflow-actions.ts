'use server';

import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { lerSessao } from '@/lib/auth';
import { registrarEvento } from '@/lib/auditoria';
import { podeTransitar } from '@/lib/workflow';

export async function alterarStatusAction(casoId: string, novoStatus: string) {
  const sessao = await lerSessao();
  if (!sessao) redirect('/login');

  const caso = await prisma.caso.findUnique({ where: { id: casoId }, select: { status: true } });
  if (!caso) return { erro: 'Caso não encontrado.' };

  if (!podeTransitar(caso.status, novoStatus, sessao.papel)) {
    return { erro: `Transição de ${caso.status} para ${novoStatus} não permitida para o papel ${sessao.papel}.` };
  }

  const data: Record<string, unknown> = { status: novoStatus };
  if (novoStatus === 'aprovado') {
    data.aprovadoPor = sessao.usuarioId;
  }

  await prisma.caso.update({ where: { id: casoId }, data });

  await registrarEvento(
    sessao.usuarioId,
    'alterar_status',
    `Status alterado: ${caso.status} → ${novoStatus}`,
    casoId,
  );

  return { ok: true };
}

export async function adicionarComentarioAction(casoId: string, texto: string) {
  const sessao = await lerSessao();
  if (!sessao) redirect('/login');

  if (!texto.trim()) return { erro: 'Comentário vazio.' };

  await prisma.comentario.create({
    data: { casoId, usuarioId: sessao.usuarioId, texto: texto.trim() },
  });

  await registrarEvento(sessao.usuarioId, 'comentario', texto.trim().substring(0, 100), casoId);

  return { ok: true };
}

export async function carregarComentariosAction(casoId: string) {
  return prisma.comentario.findMany({
    where: { casoId },
    orderBy: { criadoEm: 'desc' },
    include: { usuario: { select: { nome: true } } },
    take: 50,
  });
}

export async function criarFollowUpAction(casoId: string, descricao: string, prazo: string) {
  const sessao = await lerSessao();
  if (!sessao) redirect('/login');

  if (!descricao.trim()) return { erro: 'Descrição vazia.' };

  await prisma.followUp.create({
    data: {
      casoId,
      responsavelId: sessao.usuarioId,
      descricao: descricao.trim(),
      prazo: new Date(prazo),
    },
  });

  await registrarEvento(sessao.usuarioId, 'criar_followup', descricao.trim().substring(0, 100), casoId);

  return { ok: true };
}

export async function concluirFollowUpAction(followUpId: string) {
  const sessao = await lerSessao();
  if (!sessao) redirect('/login');

  await prisma.followUp.update({ where: { id: followUpId }, data: { concluido: true } });

  return { ok: true };
}

export async function carregarFollowUpsAction(casoId: string) {
  return prisma.followUp.findMany({
    where: { casoId },
    orderBy: { prazo: 'asc' },
    include: { responsavel: { select: { nome: true } } },
  });
}
