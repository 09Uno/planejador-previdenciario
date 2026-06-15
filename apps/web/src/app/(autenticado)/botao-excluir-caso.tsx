'use client';

import { useState } from 'react';
import { excluirCasoAction } from './actions';

export function BotaoExcluirCaso({ casoId, clienteNome }: { casoId: string; clienteNome: string }) {
  const [excluindo, setExcluindo] = useState(false);

  async function handleExcluir() {
    if (!confirm(`Tem certeza que deseja excluir o caso "${clienteNome}"?\n\nTodos os dados (cenários, documentos, comentários) serão removidos permanentemente.`)) {
      return;
    }
    setExcluindo(true);
    try {
      await excluirCasoAction(casoId);
    } catch {
      alert('Erro ao excluir o caso.');
      setExcluindo(false);
    }
  }

  return (
    <button
      className="btn btn-perigo"
      onClick={handleExcluir}
      disabled={excluindo}
      title={`Excluir caso ${clienteNome}`}
      style={{ padding: '4px 10px', fontSize: '0.85rem' }}
    >
      {excluindo ? '…' : '✕'}
    </button>
  );
}
