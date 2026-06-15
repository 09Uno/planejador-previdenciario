'use client';

import { useState, useEffect } from 'react';
import { proximosStatus, LABEL_STATUS } from '@/lib/workflow';
import {
  alterarStatusAction,
  adicionarComentarioAction, carregarComentariosAction,
  criarFollowUpAction, concluirFollowUpAction, carregarFollowUpsAction,
} from './workflow-actions';

interface CasoResumo {
  id: string;
  clienteNome: string;
  sexo: string;
  nascimento: string;
  status: string;
  periodosJson: string | null;
  competenciasJson: string | null;
}

interface Props {
  caso: CasoResumo;
  papel: string;
}

export function DadosTab({ caso, papel }: Props) {
  const [status, setStatus] = useState(caso.status);
  const [msg, setMsg] = useState('');
  const [comentario, setComentario] = useState('');
  const [comentarios, setComentarios] = useState<{ texto: string; usuario: { nome: string }; criadoEm: string }[]>([]);
  const [followups, setFollowups] = useState<{ id: string; descricao: string; prazo: string; concluido: boolean; responsavel: { nome: string } }[]>([]);
  const [novoFU, setNovoFU] = useState({ descricao: '', prazo: '' });

  useEffect(() => {
    carregarComentariosAction(caso.id).then(c =>
      setComentarios(c.map(x => ({ ...x, criadoEm: x.criadoEm.toISOString() })))
    );
    carregarFollowUpsAction(caso.id).then(f =>
      setFollowups(f.map(x => ({ ...x, prazo: x.prazo.toISOString() })))
    );
  }, [caso.id]);

  const proximos = proximosStatus(status, papel);

  async function mudarStatus(novo: string) {
    setMsg('');
    const r = await alterarStatusAction(caso.id, novo);
    if ('erro' in r) { setMsg(r.erro!); return; }
    setStatus(novo);
    setMsg(`Status alterado para ${LABEL_STATUS[novo] || novo}.`);
  }

  async function enviarComentario() {
    if (!comentario.trim()) return;
    await adicionarComentarioAction(caso.id, comentario);
    setComentario('');
    const c = await carregarComentariosAction(caso.id);
    setComentarios(c.map(x => ({ ...x, criadoEm: x.criadoEm.toISOString() })));
  }

  async function criarFU() {
    if (!novoFU.descricao || !novoFU.prazo) return;
    await criarFollowUpAction(caso.id, novoFU.descricao, novoFU.prazo);
    setNovoFU({ descricao: '', prazo: '' });
    const f = await carregarFollowUpsAction(caso.id);
    setFollowups(f.map(x => ({ ...x, prazo: x.prazo.toISOString() })));
  }

  async function concluirFU(id: string) {
    await concluirFollowUpAction(id);
    setFollowups(prev => prev.map(f => f.id === id ? { ...f, concluido: true } : f));
  }

  const hoje = new Date().toISOString().slice(0, 10);

  return (
    <div>
      {/* Dados básicos */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginBottom: 16, color: 'var(--azul-marinho)' }}>Dados do caso</h3>
        <div className="form-row">
          <div><label>Nome</label><p>{caso.clienteNome}</p></div>
          <div><label>Sexo</label><p>{caso.sexo === 'M' ? 'Masculino' : 'Feminino'}</p></div>
          <div><label>Nascimento</label><p>{caso.nascimento}</p></div>
          <div><label>Status</label><p><span className={`badge badge-${status}`}>{LABEL_STATUS[status] || status}</span></p></div>
        </div>
        {caso.periodosJson && (
          <p className="text-muted">{JSON.parse(caso.periodosJson).length} período(s) cadastrados</p>
        )}
      </div>

      {/* Workflow */}
      {proximos.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h4 style={{ marginBottom: 8, color: 'var(--azul-marinho)' }}>Alterar status</h4>
          {msg && <div className={`msg ${msg.includes('alterado') ? 'msg-sucesso' : 'msg-erro'}`} style={{ marginBottom: 8 }}>{msg}</div>}
          <div style={{ display: 'flex', gap: 8 }}>
            {proximos.map(s => (
              <button key={s} className="btn btn-primario" onClick={() => mudarStatus(s)}>
                {LABEL_STATUS[s] || s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Follow-ups */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h4 style={{ marginBottom: 8, color: 'var(--azul-marinho)' }}>Follow-ups</h4>
        {followups.filter(f => !f.concluido).length > 0 ? (
          <table style={{ marginBottom: 12 }}>
            <thead>
              <tr><th>Descrição</th><th>Prazo</th><th>Responsável</th><th style={{ width: 60 }}></th></tr>
            </thead>
            <tbody>
              {followups.filter(f => !f.concluido).map(f => {
                const vencido = f.prazo.slice(0, 10) < hoje;
                return (
                  <tr key={f.id}>
                    <td>{f.descricao}</td>
                    <td style={{ color: vencido ? 'var(--erro)' : undefined, fontWeight: vencido ? 600 : undefined }}>
                      {new Date(f.prazo).toLocaleDateString('pt-BR')} {vencido && '(ATRASADO)'}
                    </td>
                    <td>{f.responsavel.nome}</td>
                    <td>
                      <button className="btn btn-secundario" onClick={() => concluirFU(f.id)} style={{ padding: '2px 8px', fontSize: 12 }}>
                        Concluir
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <p className="text-muted" style={{ marginBottom: 8 }}>Nenhum follow-up pendente.</p>
        )}
        <div className="form-row" style={{ marginBottom: 0 }}>
          <div style={{ flex: 2 }}>
            <input type="text" placeholder="Descrição do follow-up" value={novoFU.descricao} onChange={e => setNovoFU(p => ({ ...p, descricao: e.target.value }))} />
          </div>
          <div>
            <input type="date" value={novoFU.prazo} onChange={e => setNovoFU(p => ({ ...p, prazo: e.target.value }))} />
          </div>
          <div>
            <button className="btn btn-secundario" onClick={criarFU}>Adicionar</button>
          </div>
        </div>
      </div>

      {/* Comentários */}
      <div className="card">
        <h4 style={{ marginBottom: 8, color: 'var(--azul-marinho)' }}>Comentários</h4>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <input type="text" placeholder="Adicionar comentário..." value={comentario} onChange={e => setComentario(e.target.value)} onKeyDown={e => e.key === 'Enter' && enviarComentario()} style={{ flex: 1 }} />
          <button className="btn btn-secundario" onClick={enviarComentario}>Enviar</button>
        </div>
        {comentarios.length === 0 ? (
          <p className="text-muted">Nenhum comentário.</p>
        ) : (
          <div style={{ maxHeight: 300, overflowY: 'auto' }}>
            {comentarios.map((c, i) => (
              <div key={i} style={{ padding: '8px 0', borderBottom: '1px solid var(--borda)' }}>
                <span style={{ fontWeight: 500, fontSize: 13 }}>{c.usuario.nome}</span>
                <span className="text-muted" style={{ marginLeft: 8, fontSize: 12 }}>{new Date(c.criadoEm).toLocaleString('pt-BR')}</span>
                <p style={{ margin: '4px 0 0', fontSize: 14 }}>{c.texto}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
