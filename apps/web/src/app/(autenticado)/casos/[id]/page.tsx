import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { lerSessao } from '@/lib/auth';
import Link from 'next/link';
import { CasoTabs } from './caso-tabs';

const LABEL_STATUS: Record<string, string> = {
  coleta: 'Coleta',
  conferencia: 'Conferência',
  auditoria: 'Auditoria',
  cenarios: 'Cenários',
  minutas: 'Minutas',
  revisao: 'Revisão',
  aprovado: 'Aprovado',
  entregue: 'Entregue',
};

export default async function CasoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const caso = await prisma.caso.findUnique({
    where: { id },
    include: {
      criadoPor: { select: { nome: true } },
      cenarios: { orderBy: { criadoEm: 'asc' }, select: { rotulo: true, premissasJson: true } },
    },
  });

  if (!caso) notFound();

  const sessao = await lerSessao();
  const papel = sessao?.papel ?? 'assistente';

  return (
    <>
      <div className="toolbar" style={{ justifyContent: 'space-between' }}>
        <div>
          <Link href="/" style={{ fontSize: 13 }}>Casos</Link>
          <span style={{ color: '#94A3B8', margin: '0 8px' }}>/</span>
          <h2 className="page-titulo" style={{ display: 'inline', fontSize: 18 }}>
            {caso.clienteNome}
          </h2>
          <span className={`badge badge-${caso.status}`} style={{ marginLeft: 12 }}>
            {LABEL_STATUS[caso.status] || caso.status}
          </span>
        </div>
        <span className="text-muted">
          {caso.sexo === 'M' ? 'Masculino' : 'Feminino'} — Nasc. {caso.nascimento}
        </span>
      </div>

      <CasoTabs
        caso={{
          id: caso.id,
          clienteNome: caso.clienteNome,
          sexo: caso.sexo,
          nascimento: caso.nascimento,
          status: caso.status,
          periodosJson: caso.periodosJson,
          competenciasJson: caso.competenciasJson,
          cnisJson: caso.cnisJson,
          carenciaAtual: caso.carenciaAtual,
        }}
        cenariosSalvos={caso.cenarios.map(c => ({
          rotulo: c.rotulo,
          premissas: JSON.parse(c.premissasJson),
        }))}
        papel={papel}
      />
    </>
  );
}
