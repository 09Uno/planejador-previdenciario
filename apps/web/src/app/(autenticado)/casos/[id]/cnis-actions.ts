'use server';

import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { lerSessao } from '@/lib/auth';
import { registrarEvento } from '@/lib/auditoria';

export async function confirmarCNISAction(
  casoId: string,
  dados: {
    cnisJson: string | null;
    periodosJson: string;
    competenciasJson: string;
    nascimento?: string;
    clienteNome?: string;
    carenciaAtual?: number;
  },
) {
  const sessao = await lerSessao();
  if (!sessao) redirect('/login');

  await prisma.caso.update({
    where: { id: casoId },
    data: {
      cnisJson: dados.cnisJson,
      periodosJson: dados.periodosJson,
      competenciasJson: dados.competenciasJson,
      nascimento: dados.nascimento || undefined,
      clienteNome: dados.clienteNome || undefined,
      carenciaAtual: dados.carenciaAtual ?? undefined,
      status: 'auditoria',
    },
  });

  await registrarEvento(
    sessao.usuarioId,
    'confirmar_cnis',
    `Dados do CNIS confirmados — status alterado para auditoria` +
      (dados.carenciaAtual != null ? ` (carência: ${dados.carenciaAtual})` : ''),
    casoId,
  );

  return { ok: true };
}
