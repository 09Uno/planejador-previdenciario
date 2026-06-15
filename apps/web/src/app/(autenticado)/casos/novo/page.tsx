'use client';

import { useActionState } from 'react';
import { criarCasoAction } from './actions';
import Link from 'next/link';

export default function NovoCasoPage() {
  const [state, formAction, pending] = useActionState(criarCasoAction, null);

  return (
    <>
      <h2 className="page-titulo">Novo caso</h2>

      <div className="card">
        {state?.erro && <div className="msg msg-erro">{state.erro}</div>}

        <form action={formAction}>
          <div className="form-group">
            <label htmlFor="clienteNome">Nome do(a) segurado(a)</label>
            <input type="text" id="clienteNome" name="clienteNome" required autoFocus placeholder="Nome completo" />
          </div>

          <div className="form-row">
            <div>
              <label htmlFor="sexo">Sexo</label>
              <select id="sexo" name="sexo">
                <option value="M">Masculino</option>
                <option value="F">Feminino</option>
              </select>
            </div>
            <div>
              <label htmlFor="nascimento">Nascimento (dd/mm/aaaa)</label>
              <input type="text" id="nascimento" name="nascimento" required placeholder="01/01/1965" />
            </div>
          </div>

          <div className="toolbar">
            <button type="submit" className="btn btn-primario" disabled={pending}>
              {pending ? 'Criando...' : 'Criar caso'}
            </button>
            <Link href="/" className="btn btn-secundario" style={{ textDecoration: 'none' }}>
              Cancelar
            </Link>
          </div>
        </form>
      </div>
    </>
  );
}
