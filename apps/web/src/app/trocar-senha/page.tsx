'use client';

import { useActionState } from 'react';
import { trocarSenhaAction } from './actions';

export default function TrocarSenhaPage() {
  const [state, formAction, pending] = useActionState(trocarSenhaAction, null);

  return (
    <div className="login-container">
      <div className="login-card">
        <h1>Troca de senha obrigatória</h1>
        <p className="subtitulo">Defina uma nova senha para continuar.</p>

        {state?.erro && <div className="msg msg-erro">{state.erro}</div>}

        <form action={formAction}>
          <div className="form-group">
            <label htmlFor="nova">Nova senha</label>
            <input type="password" id="nova" name="nova" required autoFocus minLength={6} />
          </div>
          <div className="form-group">
            <label htmlFor="confirma">Confirmar nova senha</label>
            <input type="password" id="confirma" name="confirma" required minLength={6} />
          </div>
          <button type="submit" className="btn-primario" style={{ width: '100%', justifyContent: 'center' }} disabled={pending}>
            {pending ? 'Salvando...' : 'Definir senha e entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}
