import { prisma } from './prisma';

export async function registrarEvento(
  usuarioId: string,
  acao: string,
  detalhe?: string,
  casoId?: string,
) {
  await prisma.eventoAuditoria.create({
    data: { usuarioId, acao, detalhe, casoId },
  });
}
