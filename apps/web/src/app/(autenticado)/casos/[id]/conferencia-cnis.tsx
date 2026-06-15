'use client';

import type { VinculoEditavel, CompetenciaEditavel } from './cnis-tab';

interface Props {
  vinculos: VinculoEditavel[];
  competencias: CompetenciaEditavel[];
  avisos: string[];
  somenteLeitura?: boolean;
  onVinculosChange: (v: VinculoEditavel[]) => void;
  onCompetenciasChange: (c: CompetenciaEditavel[]) => void;
}

export function ConferenciaCNIS({
  vinculos, competencias, avisos,
  somenteLeitura,
  onVinculosChange, onCompetenciasChange,
}: Props) {
  function atualizarVinculo(idx: number, campo: keyof VinculoEditavel, valor: string) {
    const novos = vinculos.map((v, i) => i === idx ? { ...v, [campo]: valor } : v);
    onVinculosChange(novos);
  }

  function removerVinculo(idx: number) {
    onVinculosChange(vinculos.filter((_, i) => i !== idx));
  }

  function adicionarVinculo() {
    onVinculosChange([...vinculos, {
      seq: vinculos.length + 1,
      origem: '',
      ini: '',
      fim: '',
      tipo: 'Empregado',
      indicadores: [],
    }]);
  }

  function atualizarCompetencia(idx: number, campo: keyof CompetenciaEditavel, valor: string) {
    const novos = competencias.map((c, i) => {
      if (i !== idx) return c;
      if (campo === 'valor') {
        const num = parseFloat(valor.replace(/\./g, '').replace(',', '.'));
        return { ...c, valor: isNaN(num) ? 0 : num };
      }
      return { ...c, [campo]: valor };
    });
    onCompetenciasChange(novos);
  }

  function removerCompetencia(idx: number) {
    onCompetenciasChange(competencias.filter((_, i) => i !== idx));
  }

  function adicionarCompetencia() {
    onCompetenciasChange([...competencias, { comp: '', valor: 0 }]);
  }

  return (
    <>
      {/* Avisos */}
      {avisos.length > 0 && (
        <div className="card" style={{ marginBottom: 16, background: '#FFFBEB', border: '1px solid #FDE68A' }}>
          <h4 style={{ marginBottom: 8, color: '#92400E' }}>Avisos do parser</h4>
          <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: '#92400E' }}>
            {avisos.map((a, i) => <li key={i} style={{ marginBottom: 4 }}>{a}</li>)}
          </ul>
        </div>
      )}

      {/* Vínculos */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h4 style={{ color: 'var(--azul-marinho)' }}>
            Vínculos / Períodos ({vinculos.length})
          </h4>
          {!somenteLeitura && (
            <button className="btn btn-secundario" onClick={adicionarVinculo} style={{ padding: '4px 12px', fontSize: 13 }}>
              + Adicionar
            </button>
          )}
        </div>

        {vinculos.length === 0 ? (
          <p className="text-muted">Nenhum vínculo cadastrado.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th style={{ width: 50 }}>#</th>
                  <th>Origem / Descrição</th>
                  <th style={{ width: 120 }}>Início</th>
                  <th style={{ width: 120 }}>Fim</th>
                  <th style={{ width: 120 }}>Tipo</th>
                  <th style={{ width: 180 }}>Indicadores</th>
                  {!somenteLeitura && <th style={{ width: 50 }}></th>}
                </tr>
              </thead>
              <tbody>
                {vinculos.map((v, i) => (
                  <tr key={i}>
                    <td>{v.seq}</td>
                    <td>
                      {somenteLeitura ? v.origem : (
                        <input
                          type="text"
                          value={v.origem}
                          onChange={e => atualizarVinculo(i, 'origem', e.target.value)}
                          style={{ padding: '4px 6px', fontSize: 13 }}
                        />
                      )}
                    </td>
                    <td>
                      {somenteLeitura ? v.ini : (
                        <input
                          type="text"
                          value={v.ini}
                          onChange={e => atualizarVinculo(i, 'ini', e.target.value)}
                          placeholder="dd/mm/aaaa"
                          style={{ padding: '4px 6px', fontSize: 13 }}
                        />
                      )}
                    </td>
                    <td>
                      {somenteLeitura ? v.fim : (
                        <input
                          type="text"
                          value={v.fim}
                          onChange={e => atualizarVinculo(i, 'fim', e.target.value)}
                          placeholder="dd/mm/aaaa"
                          style={{ padding: '4px 6px', fontSize: 13 }}
                        />
                      )}
                    </td>
                    <td>
                      {somenteLeitura ? v.tipo : (
                        <select
                          value={v.tipo}
                          onChange={e => atualizarVinculo(i, 'tipo', e.target.value)}
                          style={{ padding: '4px 6px', fontSize: 13 }}
                        >
                          <option value="Empregado">Empregado</option>
                          <option value="CI">Contrib. Individual</option>
                        </select>
                      )}
                    </td>
                    <td>
                      <span className="text-muted" style={{ fontSize: 12 }}>
                        {v.indicadores.length > 0 ? v.indicadores.join(', ') : '—'}
                      </span>
                    </td>
                    {!somenteLeitura && (
                      <td>
                        <button
                          className="btn-perigo"
                          onClick={() => removerVinculo(i)}
                          style={{ padding: '2px 8px', fontSize: 12, borderRadius: 4 }}
                          title="Remover"
                        >
                          ✕
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Competências */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h4 style={{ color: 'var(--azul-marinho)' }}>
            Competências / Salários ({competencias.length})
          </h4>
          {!somenteLeitura && (
            <button className="btn btn-secundario" onClick={adicionarCompetencia} style={{ padding: '4px 12px', fontSize: 13 }}>
              + Adicionar
            </button>
          )}
        </div>

        {competencias.length === 0 ? (
          <p className="text-muted">Nenhuma competência cadastrada.</p>
        ) : (
          <div style={{ overflowX: 'auto', maxHeight: 400, overflowY: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th style={{ width: 50 }}>#</th>
                  <th style={{ width: 120 }}>Competência</th>
                  <th style={{ width: 160 }}>Valor (R$)</th>
                  {!somenteLeitura && <th style={{ width: 50 }}></th>}
                </tr>
              </thead>
              <tbody>
                {competencias.map((c, i) => (
                  <tr key={i}>
                    <td>{i + 1}</td>
                    <td>
                      {somenteLeitura ? c.comp : (
                        <input
                          type="text"
                          value={c.comp}
                          onChange={e => atualizarCompetencia(i, 'comp', e.target.value)}
                          placeholder="mm/aaaa"
                          style={{ padding: '4px 6px', fontSize: 13 }}
                        />
                      )}
                    </td>
                    <td>
                      {somenteLeitura ? c.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : (
                        <input
                          type="text"
                          value={c.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          onChange={e => atualizarCompetencia(i, 'valor', e.target.value)}
                          style={{ padding: '4px 6px', fontSize: 13, textAlign: 'right' }}
                        />
                      )}
                    </td>
                    {!somenteLeitura && (
                      <td>
                        <button
                          className="btn-perigo"
                          onClick={() => removerCompetencia(i)}
                          style={{ padding: '2px 8px', fontSize: 12, borderRadius: 4 }}
                          title="Remover"
                        >
                          ✕
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
