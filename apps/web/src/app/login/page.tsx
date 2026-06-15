'use client';

import { useActionState } from 'react';
import { loginAction } from './actions';

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(loginAction, null);

  return (
    <div className="login-container">
      <div className="login-card">
        <h1>Planejador Previdenciário</h1>
        <p className="subtitulo">Machado Filgueiras Advocacia</p>

        {state?.erro && <div className="msg msg-erro">{state.erro}</div>}

        <form action={formAction}>
          <div className="form-group">
            <label htmlFor="usuario">Usuário</label>
            <input type="text" id="usuario" name="usuario" required autoFocus />
          </div>
          <div className="form-group">
            <label htmlFor="senha">Senha</label>
            <input type="password" id="senha" name="senha" required />
          </div>
          <button type="submit" className="btn-primario" style={{ width: '100%', justifyContent: 'center' }} disabled={pending}>
            {pending ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}
