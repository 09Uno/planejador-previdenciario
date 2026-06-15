'use client';

import { useState } from 'react';
import { montarTextoResumo, type DadosResumo, type InputsResumo } from '@/lib/resumo-atendimento';
import { prepararResumoAction, gerarResumoDocxAction } from './resumo-actions';

export function ResumoAtendimentoCard({ casoId }: { casoId: string }) {
  const [dados, setDados] = useState<DadosResumo | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [copiado, setCopiado] = useState(false);
  const [baixando, setBaixando] = useState(false);

  // Campos do atendimento (recheio livre)
  const [contexto, setContexto] = useState('');
  const [documentos, setDocumentos] = useState('');
  const [escopo, setEscopo] = useState('');
  const [valor, setValor] = useState('');
  const [validade, setValidade] = useState('10 dias');

  function inputs(): InputsResumo {
    return {
      contexto,
      documentosProvidenciar: documentos.split('\n'),
      escopo, valor, validade,
    };
  }

  async function preparar() {
    setErro(''); setCarregando(true);
    try {
      setDados(await prepararResumoAction(casoId));
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao preparar o resumo.');
    }
    setCarregando(false);
  }

  const texto = dados ? montarTextoResumo(dados, inputs()) : '';

  async function copiar() {
    await navigator.clipboard.writeText(texto);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  async function baixar() {
    setBaixando(true); setErro('');
    try {
      const { base64, nome } = await gerarResumoDocxAction(casoId, inputs());
      const bin = atob(base64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = nome; a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao gerar o .docx.');
    }
    setBaixando(false);
  }

  return (
    <div className="card" style={{ marginBottom: 16, borderLeft: '3px solid var(--azul-marinho)' }}>
      <h4 style={{ marginBottom: 8, color: 'var(--azul-marinho)' }}>Resumo de Atendimento (e-mail do cliente)</h4>
      <p className="text-muted" style={{ marginBottom: 12 }}>
        Monta o e-mail pós-reunião com os cenários selecionados, as pendências do CNIS, os documentos a
        providenciar e a proposta. As datas e RMIs vêm dos cenários; o texto comercial é livre.
      </p>

      {erro && <div className="msg msg-erro" style={{ marginBottom: 12 }}>{erro}</div>}

      {!dados ? (
        <button className="btn btn-primario" onClick={preparar} disabled={carregando}>
          {carregando ? 'Preparando...' : 'Preparar resumo'}
        </button>
      ) : (
        <>
          <p className="text-muted" style={{ fontSize: 12, marginBottom: 12 }}>
            {dados.cenarios.length} cenário(s) selecionado(s) · {dados.pendencias.length} pendência(s) do CNIS.
            {dados.cenarios.length === 0 && ' Selecione cenários na aba Cenários para incluí-los.'}
          </p>

          <div className="form-row">
            <div style={{ flex: 1 }}>
              <label>Contexto da análise</label>
              <input type="text" value={contexto} onChange={e => setContexto(e.target.value)}
                placeholder="ex.: em cumprimento ao follow-up de Análise.Planejamento, conforme reunião de 10/06/2026" style={{ width: '100%' }} />
            </div>
          </div>

          <div className="form-row" style={{ marginTop: 8 }}>
            <div style={{ flex: 1 }}>
              <label>Documentos a providenciar (um por linha)</label>
              <textarea value={documentos} onChange={e => setDocumentos(e.target.value)} rows={3}
                placeholder={'CTPS dos vínculos com pendência\nComprovantes de atividade no período da lacuna'}
                style={{ width: '100%', fontFamily: 'inherit' }} />
            </div>
          </div>

          <div className="form-row" style={{ marginTop: 8 }}>
            <div style={{ flex: 2 }}>
              <label>Escopo do serviço</label>
              <input type="text" value={escopo} onChange={e => setEscopo(e.target.value)}
                placeholder="ex.: regularização do CNIS + protocolo do requerimento" style={{ width: '100%' }} />
            </div>
            <div style={{ flex: 1 }}>
              <label>Honorários</label>
              <input type="text" value={valor} onChange={e => setValor(e.target.value)} placeholder="ex.: R$ 5.000,00" style={{ width: '100%' }} />
            </div>
            <div>
              <label>Validade</label>
              <input type="text" value={validade} onChange={e => setValidade(e.target.value)} style={{ width: 100 }} />
            </div>
          </div>

          <label style={{ marginTop: 12, display: 'block' }}>Prévia do e-mail</label>
          <textarea readOnly value={texto} rows={16}
            style={{ width: '100%', fontFamily: 'monospace', fontSize: 12, background: '#fafafa' }} />

          <div className="toolbar" style={{ marginTop: 8 }}>
            <button className="btn btn-secundario" onClick={copiar}>{copiado ? 'Copiado!' : 'Copiar texto'}</button>
            <button className="btn btn-primario" onClick={baixar} disabled={baixando}>
              {baixando ? 'Gerando...' : 'Baixar .docx'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
