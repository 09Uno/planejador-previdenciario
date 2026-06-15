import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { BuscaCasos } from './busca-casos';
import { BotaoExcluirCaso } from './botao-excluir-caso';

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

export default async function HomePage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const busca = q?.trim() || '';

  const casos = await prisma.caso.findMany({
    where: busca
      ? { clienteNome: { contains: busca } }
      : undefined,
    orderBy: { atualizadoEm: 'desc' },
    include: { criadoPor: { select: { nome: true } } },
    take: 100,
  });

  return (
    <>
      <div className="toolbar" style={{ justifyContent: 'space-between' }}>
        <h2 className="page-titulo" style={{ margin: 0 }}>Casos</h2>
        <Link href="/casos/novo" className="btn btn-primario" style={{ textDecoration: 'none' }}>
          Novo caso
        </Link>
      </div>

      <BuscaCasos valorInicial={busca} />

      {casos.length === 0 ? (
        <div className="card text-center" style={{ padding: '40px' }}>
          <p className="text-muted">
            {busca ? 'Nenhum caso encontrado.' : 'Nenhum caso cadastrado ainda.'}
          </p>
        </div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Sexo</th>
              <th>Nascimento</th>
              <th>Status</th>
              <th>Criado por</th>
              <th>Atualizado em</th>
              <th><span className="sr-only">Ações</span></th>
            </tr>
          </thead>
          <tbody>
            {casos.map(c => (
              <tr key={c.id}>
                <td>
                  <Link href={`/casos/${c.id}`}>{c.clienteNome}</Link>
                </td>
                <td>{c.sexo === 'M' ? 'Masculino' : 'Feminino'}</td>
                <td>{c.nascimento}</td>
                <td>
                  <span className={`badge badge-${c.status}`}>
                    {LABEL_STATUS[c.status] || c.status}
                  </span>
                </td>
                <td>{c.criadoPor.nome}</td>
                <td>{c.atualizadoEm.toLocaleDateString('pt-BR')}</td>
                <td>
                  <BotaoExcluirCaso casoId={c.id} clienteNome={c.clienteNome} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
