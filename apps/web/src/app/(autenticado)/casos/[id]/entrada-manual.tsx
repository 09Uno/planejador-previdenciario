'use client';

import { useState } from 'react';
import type { VinculoEditavel, CompetenciaEditavel } from './cnis-tab';

interface Props {
  onConfirmar: (vinculos: VinculoEditavel[], competencias: CompetenciaEditavel[]) => void;
}

export function EntradaManual({ onConfirmar }: Props) {
  const [textoPeriodos, setTextoPeriodos] = useState('');
  const [textoSalarios, setTextoSalarios] = useState('');
  const [erros, setErros] = useState<string[]>([]);

  function processar() {
    const errs: string[] = [];
    const vinculos: VinculoEditavel[] = [];
    const competencias: CompetenciaEditavel[] = [];

    // Parse períodos: dd/mm/aaaa dd/mm/aaaa descrição
    for (const raw of textoPeriodos.split('\n')) {
      const line = raw.trim();
      if (!line) continue;
      const m = line.match(/^(\d{1,2}\/\d{1,2}\/\d{4})[\s;,\t]+(\d{1,2}\/\d{1,2}\/\d{4})\s*(.*)$/);
      if (!m) {
        errs.push(`Período inválido: ${line}`);
        continue;
      }
      vinculos.push({
        seq: vinculos.length + 1,
        origem: m[3]?.trim() || '',
        ini: m[1],
        fim: m[2],
        tipo: 'Empregado',
        indicadores: [],
      });
    }

    // Parse salários: mm/aaaa valor
    for (const raw of textoSalarios.split('\n')) {
      const line = raw.trim();
      if (!line) continue;
      const m = line.match(/(\d{2}\/\d{4})[\s;,\t]+R?\$?\s*([\d.,]+)/);
      if (!m) {
        errs.push(`Salário inválido: ${line}`);
        continue;
      }
      const valor = parseFloat(m[2].replace(/\./g, '').replace(',', '.'));
      if (isNaN(valor)) {
        errs.push(`Valor inválido: ${line}`);
        continue;
      }
      competencias.push({ comp: m[1], valor });
    }

    setErros(errs);

    if (vinculos.length === 0 && competencias.length === 0) {
      setErros([...errs, 'Nenhum dado válido encontrado.']);
      return;
    }

    onConfirmar(vinculos, competencias);
  }

  return (
    <div className="card">
      <h4 style={{ marginBottom: 8, color: 'var(--azul-marinho)' }}>Entrada manual</h4>

      <div className="form-group">
        <label>Períodos de contribuição</label>
        <p className="text-muted" style={{ marginBottom: 6, fontSize: 12 }}>
          Um por linha: <code>dd/mm/aaaa dd/mm/aaaa descrição</code>
        </p>
        <textarea
          rows={6}
          value={textoPeriodos}
          onChange={e => setTextoPeriodos(e.target.value)}
          placeholder={'01/02/1985 30/06/1992 Empresa A\n01/08/1992 15/03/2005 Empresa B\n01/04/2005 10/06/2026 Contrib. Individual'}
        />
      </div>

      <div className="form-group">
        <label>Salários de contribuição (opcional)</label>
        <p className="text-muted" style={{ marginBottom: 6, fontSize: 12 }}>
          Um por linha: <code>mm/aaaa valor</code> (valores já atualizados monetariamente)
        </p>
        <textarea
          rows={4}
          value={textoSalarios}
          onChange={e => setTextoSalarios(e.target.value)}
          placeholder={'07/1994 2.500,00\n08/1994 2.500,00'}
        />
      </div>

      {erros.length > 0 && (
        <div className="msg msg-alerta" style={{ marginBottom: 12 }}>
          <strong>Avisos:</strong>
          <ul style={{ margin: '4px 0 0 16px', fontSize: 13 }}>
            {erros.map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        </div>
      )}

      <button className="btn btn-primario" onClick={processar}>
        Prosseguir para conferência
      </button>
    </div>
  );
}
