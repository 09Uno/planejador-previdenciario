'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

export function BuscaCasos({ valorInicial }: { valorInicial: string }) {
  const [q, setQ] = useState(valorInicial);
  const router = useRouter();
  const searchParams = useSearchParams();

  function buscar(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams(searchParams.toString());
    if (q.trim()) {
      params.set('q', q.trim());
    } else {
      params.delete('q');
    }
    router.push(`/?${params.toString()}`);
  }

  return (
    <form onSubmit={buscar} className="toolbar" style={{ marginBottom: 20 }}>
      <input
        type="search"
        className="busca-input"
        placeholder="Buscar por nome do cliente..."
        value={q}
        onChange={e => setQ(e.target.value)}
      />
      <button type="submit" className="btn btn-secundario">Buscar</button>
    </form>
  );
}
