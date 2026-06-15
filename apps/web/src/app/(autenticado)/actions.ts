'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { destruirSessao, lerSessao } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { registrarEvento } from '@/lib/auditoria';

export async function logoutAction() {
  await destruirSessao();
  redirect('/login');
}

export async function excluirCasoAction(casoId: string) {
  const sessao = await lerSessao();
  if (!sessao) throw new Error('Não autenticado');

  const caso = await prisma.caso.findUnique({ where: { id: casoId }, select: { clienteNome: true } });
  if (!caso) throw new Error('Caso não encontrado');

  await prisma.caso.delete({ where: { id: casoId } });
  await registrarEvento(sessao.usuarioId, 'excluir_caso', `Caso excluído: ${caso.clienteNome}`);

  revalidatePath('/');
}
