'use server';

import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { lerSessao } from '@/lib/auth';
import { registrarEvento } from '@/lib/auditoria';

export async function salvarCenariosAction(
  casoId: string,
  cenarios: { rotulo: string; premissasJson: string; resultadoJson: string }[],
) {
  const sessao = await lerSessao();
  if (!sessao) redirect('/login');

  // Apagar cenários antigos e recriar
  await prisma.cenario.deleteMany({ where: { casoId } });

  for (const c of cenarios) {
    await prisma.cenario.create({
      data: {
        casoId,
        rotulo: c.rotulo,
        premissasJson: c.premissasJson,
        resultadoJson: c.resultadoJson,
      },
    });
  }

  // Atualizar status se ainda está em auditoria
  const caso = await prisma.caso.findUnique({ where: { id: casoId }, select: { status: true } });
  if (caso && (caso.status === 'auditoria' || caso.status === 'coleta' || caso.status === 'conferencia')) {
    await prisma.caso.update({ where: { id: casoId }, data: { status: 'cenarios' } });
  }

  await registrarEvento(
    sessao.usuarioId,
    'gerar_cenarios',
    `${cenarios.length} cenário(s) gerado(s)`,
    casoId,
  );

  return { ok: true };
}

export async function carregarCenariosAction(casoId: string) {
  const cenarios = await prisma.cenario.findMany({
    where: { casoId },
    orderBy: { criadoEm: 'asc' },
  });
  return cenarios.map(c => ({
    id: c.id,
    rotulo: c.rotulo,
    premissasJson: c.premissasJson,
    resultadoJson: c.resultadoJson,
  }));
}
