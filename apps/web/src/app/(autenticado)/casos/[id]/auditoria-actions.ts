'use server';

import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { lerSessao } from '@/lib/auth';
import { registrarEvento } from '@/lib/auditoria';

export async function salvarCarenciaAction(casoId: string, carenciaAtual: number) {
  const sessao = await lerSessao();
  if (!sessao) redirect('/login');

  await prisma.caso.update({
    where: { id: casoId },
    data: { carenciaAtual },
  });

  await registrarEvento(
    sessao.usuarioId,
    'editar_carencia',
    `Carência ajustada manualmente para ${carenciaAtual}`,
    casoId,
  );

  return { ok: true };
}
