import { redirect } from 'next/navigation';
import { lerSessao } from '@/lib/auth';
import Link from 'next/link';
import { logoutAction } from './actions';

export default async function AutenticadoLayout({ children }: { children: React.ReactNode }) {
  const sessao = await lerSessao();
  if (!sessao) redirect('/login');

  return (
    <div className="app-container">
      <header className="app-header">
        <Link href="/" style={{ color: '#fff', textDecoration: 'none' }}>
          <h1>Planejador Previdenciário — MFAA</h1>
        </Link>
        <div className="usuario-info">
          <span>{sessao.nome} ({sessao.papel})</span>
          <form action={logoutAction}>
            <button type="submit" className="btn-secundario" style={{ color: '#CBD5E1', borderColor: '#475569', padding: '4px 12px', fontSize: '12px' }}>
              Sair
            </button>
          </form>
        </div>
      </header>
      <main className="app-main">
        {children}
      </main>
      <footer className="app-footer">
        PROTÓTIPO — uso interno, requer conferência do advogado
      </footer>
    </div>
  );
}
