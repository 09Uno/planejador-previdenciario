import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { DocPrintView } from './doc-print-view';

export default async function DocPrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ doc?: string; cenarioIdx?: string }>;
}) {
  const { id } = await params;
  const { doc, cenarioIdx } = await searchParams;

  const caso = await prisma.caso.findUnique({
    where: { id },
    include: { cenarios: { orderBy: { criadoEm: 'asc' } } },
  });

  if (!caso) notFound();

  const cenarios = caso.cenarios.map(c => ({
    rotulo: c.rotulo,
    resultado: JSON.parse(c.resultadoJson),
    premissas: JSON.parse(c.premissasJson),
  }));

  return (
    <DocPrintView
      caso={{
        clienteNome: caso.clienteNome,
        sexo: caso.sexo,
        nascimento: caso.nascimento,
        status: caso.status,
        periodosJson: caso.periodosJson,
        competenciasJson: caso.competenciasJson,
      }}
      cenarios={cenarios}
      tipoDoc={doc || '1.0'}
      cenarioIdx={cenarioIdx ? parseInt(cenarioIdx) : undefined}
    />
  );
}
