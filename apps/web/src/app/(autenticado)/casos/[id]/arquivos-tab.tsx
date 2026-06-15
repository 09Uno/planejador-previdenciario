'use client';

import { useState, useEffect, useRef } from 'react';
import { LABEL_CLASSIFICACAO, CLASSIFICACOES, classificarArquivo } from '@/lib/classificar-arquivo';
import { extrairTextoPDF, acharPeriodoIndex } from '@/lib/ler-pdf';
import { extrairPPP, extrairCTC, extrairCTSM } from '@mfaa/prev-engine';
import {
  uploadArquivoAction,
  listarArquivosAction,
  reclassificarArquivoAction,
  excluirArquivoAction,
  marcarSoArquivoAction,
  processarPPPAction,
  processarCTSMAction,
  processarCTCAction,
} from './arquivos-actions';

interface CasoResumo {
  id: string;
  nascimento: string;
  periodosJson: string | null;
}

interface ArquivoDB {
  id: string;
  nome: string;
  tipo: string;
  tamanho: number;
  classificacao: string;
  status: string;
  dadosExtraidos: string | null;
  criadoEm: string | Date;
}

const fmtTamanho = (b: number) =>
  b >= 1_048_576 ? `${(b / 1_048_576).toFixed(1)} MB` : `${Math.round(b / 1024)} KB`;

const STATUS_BADGE: Record<string, { cor: string; label: string }> = {
  pendente: { cor: 'var(--alerta)', label: 'Pendente' },
  processado: { cor: 'var(--sucesso)', label: 'Processado' },
  'so-arquivo': { cor: 'var(--texto-secundario)', label: 'Só arquivo' },
};

export function ArquivosTab({ caso }: { caso: CasoResumo }) {
  const [arquivos, setArquivos] = useState<ArquivoDB[]>([]);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Estado para ações inline
  const [acaoAberta, setAcaoAberta] = useState<{ id: string; tipo: string } | null>(null);
  const [pppForm, setPppForm] = useState({ periodoIndex: 0, grau: 25 as 15 | 20 | 25 });
  const [ctsmForm, setCtsmForm] = useState({ ini: '', fim: '', desc: 'Serviço militar' });
  const [ctcForm, setCtcForm] = useState({ ini: '', fim: '', desc: '' });
  // Leitura automática do documento (pré-preenchimento)
  const [lendo, setLendo] = useState<string | null>(null);
  const [lidos, setLidos] = useState<Record<string, { resumo: string; avisos: string[]; ocr: boolean }>>({});

  useEffect(() => {
    listarArquivosAction(caso.id).then(setArquivos);
  }, [caso.id]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files?.length) return;

    setUploading(true);
    setStatus('');

    for (const file of Array.from(files)) {
      try {
        // Classificação client-side: extrair texto da 1ª página se PDF
        let cls = 'outro';
        if (file.type === 'application/pdf') {
          try {
            const pdfjsLib = await import('pdfjs-dist');
            if (typeof window !== 'undefined') {
              pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
            }
            const data = new Uint8Array(await file.arrayBuffer());
            const doc = await pdfjsLib.getDocument({ data }).promise;
            const page = await doc.getPage(1);
            const tc = await page.getTextContent();
            const texto = tc.items
              .filter(it => 'str' in it)
              .map(it => (it as { str: string }).str)
              .join(' ');
            cls = classificarArquivo(texto);
          } catch {
            // Se falhar extração, fica como 'outro'
          }
        }

        const fd = new FormData();
        fd.set('file', file);
        fd.set('classificacao', cls);
        await uploadArquivoAction(caso.id, fd);
      } catch (err) {
        setStatus(`Erro em ${file.name}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // Recarregar lista
    const lista = await listarArquivosAction(caso.id);
    setArquivos(lista);
    setUploading(false);
    setStatus(`${files.length} arquivo(s) enviado(s).`);
    if (inputRef.current) inputRef.current.value = '';
  }

  async function handleReclassificar(arqId: string, novaCls: string) {
    await reclassificarArquivoAction(arqId, novaCls);
    setArquivos(await listarArquivosAction(caso.id));
  }

  async function handleExcluir(arqId: string, nome: string) {
    if (!confirm(`Excluir "${nome}"?`)) return;
    await excluirArquivoAction(arqId);
    setArquivos(await listarArquivosAction(caso.id));
  }

  async function handleMarcarSoArquivo(arqId: string) {
    await marcarSoArquivoAction(arqId);
    setArquivos(await listarArquivosAction(caso.id));
    setAcaoAberta(null);
  }

  async function handlePPP(arqId: string) {
    await processarPPPAction(arqId, pppForm);
    setArquivos(await listarArquivosAction(caso.id));
    setAcaoAberta(null);
  }

  async function handleCTSM(arqId: string) {
    await processarCTSMAction(arqId, ctsmForm);
    setArquivos(await listarArquivosAction(caso.id));
    setAcaoAberta(null);
  }

  async function handleCTC(arqId: string) {
    await processarCTCAction(arqId, { periodos: [ctcForm] });
    setArquivos(await listarArquivosAction(caso.id));
    setAcaoAberta(null);
  }

  // Lê o PDF, roda o extrator do tipo e pré-preenche o formulário da ação.
  async function lerEPreencher(arq: ArquivoDB) {
    setLendo(arq.id);
    setStatus('');
    try {
      const resp = await fetch(`/api/arquivos/${arq.id}`);
      const buf = new Uint8Array(await resp.arrayBuffer());
      const { texto, ocr } = await extrairTextoPDF(buf);
      const periodosCaso: { ini: string; fim: string }[] = caso.periodosJson ? JSON.parse(caso.periodosJson) : [];
      let resumo = '';
      let avisos: string[] = [];

      if (arq.classificacao === 'ppp') {
        const r = extrairPPP(texto);
        const idx = acharPeriodoIndex(r.periodos[0], periodosCaso);
        setPppForm({ periodoIndex: idx >= 0 ? idx : 0, grau: r.grauSugerido ?? 25 });
        resumo = `${r.agente ?? 'agente?'}${r.intensidade ? ' ' + r.intensidade : ''} · grau ${r.grauSugerido ?? 25}`
          + (r.periodos[0] ? ` · ${r.periodos[0].ini}–${r.periodos[0].fim}` : '');
        avisos = r.avisos;
      } else if (arq.classificacao === 'ctc') {
        const r = extrairCTC(texto, { nascimento: caso.nascimento });
        if (r.periodos[0]) setCtcForm({ ini: r.periodos[0].ini, fim: r.periodos[0].fim, desc: r.orgao ?? 'CTC' });
        resumo = r.periodos[0] ? `${r.periodos[0].ini}–${r.periodos[0].fim}` : 'período não lido — informe manualmente';
        avisos = r.avisos;
      } else if (arq.classificacao === 'ctsm') {
        const r = extrairCTSM(texto);
        if (r.periodos[0]) setCtsmForm(f => ({ ...f, ini: r.periodos[0].ini, fim: r.periodos[0].fim }));
        resumo = r.periodos[0]
          ? `${r.periodos[0].ini}–${r.periodos[0].fim}`
          : (r.duracao ? `duração ${r.duracao.anos}a ${r.duracao.meses}m ${r.duracao.dias}d — informe as datas` : 'sem datas no documento');
        avisos = r.avisos;
      }

      setLidos(m => ({ ...m, [arq.id]: { resumo, avisos, ocr } }));
      setAcaoAberta({ id: arq.id, tipo: arq.classificacao });
    } catch (e) {
      setStatus(`Falha ao ler ${arq.nome}: ${e instanceof Error ? e.message : String(e)}`);
    }
    setLendo(null);
  }

  const periodos: { ini: string; fim: string; desc?: string }[] =
    caso.periodosJson ? JSON.parse(caso.periodosJson) : [];

  return (
    <div>
      <h3 style={{ marginBottom: 16, color: 'var(--azul-marinho)' }}>Arquivos do Caso</h3>

      {/* Upload */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h4 style={{ marginBottom: 8, color: 'var(--azul-marinho)' }}>Upload de documentos</h4>
        <p className="text-muted" style={{ marginBottom: 12 }}>
          Envie PDFs ou imagens (CNIS, PPP, CTSM, CTC, carta de concessão, laudos, procuração, etc.).
          A classificação é sugerida automaticamente pelo conteúdo do PDF.
        </p>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <button className="btn btn-primario" onClick={() => inputRef.current?.click()} disabled={uploading}>
            {uploading ? 'Enviando...' : 'Selecionar arquivos'}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,image/*"
            multiple
            style={{ display: 'none' }}
            onChange={handleUpload}
          />
        </div>
        {status && <p className="text-muted mt-4">{status}</p>}
      </div>

      {/* Lista */}
      {arquivos.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <p className="text-muted">Nenhum arquivo enviado.</p>
        </div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Arquivo</th>
              <th>Classificação</th>
              <th>Status</th>
              <th>Tamanho</th>
              <th>Extraído</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {arquivos.map(arq => {
              const badge = STATUS_BADGE[arq.status] || STATUS_BADGE.pendente;
              const dados = arq.dadosExtraidos ? JSON.parse(arq.dadosExtraidos) : null;
              return (
                <tr key={arq.id}>
                  <td>
                    <a href={`/api/arquivos/${arq.id}`} target="_blank" rel="noopener noreferrer">
                      {arq.nome}
                    </a>
                  </td>
                  <td>
                    <select
                      value={arq.classificacao}
                      onChange={e => handleReclassificar(arq.id, e.target.value)}
                      style={{ padding: '2px 4px', fontSize: 12 }}
                    >
                      {CLASSIFICACOES.map(c => (
                        <option key={c} value={c}>{LABEL_CLASSIFICACAO[c]}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <span style={{ color: badge.cor, fontWeight: 600, fontSize: 12 }}>
                      {badge.label}
                    </span>
                  </td>
                  <td className="text-muted">{fmtTamanho(arq.tamanho)}</td>
                  <td className="text-muted" style={{ fontSize: 12 }}>
                    {dados?.tipo === 'ppp' && `Especial grau ${dados.grau} → período ${dados.periodoIndex + 1}`}
                    {dados?.tipo === 'ctsm' && `Militar: ${dados.periodo.ini} a ${dados.periodo.fim}`}
                    {dados?.tipo === 'ctc' && `${dados.periodos} período(s) CTC`}
                    {!dados && lidos[arq.id] && (
                      <span title={lidos[arq.id].avisos.join('\n')}>
                        🔎 {lidos[arq.id].resumo}{lidos[arq.id].ocr ? ' (OCR)' : ''}
                      </span>
                    )}
                    {!dados && !lidos[arq.id] && '—'}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {arq.status === 'pendente' && arq.classificacao === 'cnis' && (
                        <span className="text-muted" style={{ fontSize: 11 }}>
                          Use a aba CNIS para processar
                        </span>
                      )}
                      {arq.status === 'pendente' && arq.classificacao === 'ppp' && (
                        <button className="btn btn-secundario" style={{ padding: '2px 8px', fontSize: 11 }}
                          disabled={lendo === arq.id}
                          onClick={() => lerEPreencher(arq)}>
                          {lendo === arq.id ? 'Lendo...' : 'Ler e vincular especial'}
                        </button>
                      )}
                      {arq.status === 'pendente' && arq.classificacao === 'ctsm' && (
                        <button className="btn btn-secundario" style={{ padding: '2px 8px', fontSize: 11 }}
                          disabled={lendo === arq.id}
                          onClick={() => lerEPreencher(arq)}>
                          {lendo === arq.id ? 'Lendo...' : 'Ler e criar período militar'}
                        </button>
                      )}
                      {arq.status === 'pendente' && arq.classificacao === 'ctc' && (
                        <button className="btn btn-secundario" style={{ padding: '2px 8px', fontSize: 11 }}
                          disabled={lendo === arq.id}
                          onClick={() => lerEPreencher(arq)}>
                          {lendo === arq.id ? 'Lendo...' : 'Ler e registrar períodos'}
                        </button>
                      )}
                      {arq.status === 'pendente' && !['cnis', 'ppp', 'ctsm', 'ctc'].includes(arq.classificacao) && (
                        <button className="btn btn-secundario" style={{ padding: '2px 8px', fontSize: 11 }}
                          onClick={() => handleMarcarSoArquivo(arq.id)}>
                          Só arquivo
                        </button>
                      )}
                      <button className="btn btn-perigo" style={{ padding: '2px 8px', fontSize: 11 }}
                        onClick={() => handleExcluir(arq.id, arq.nome)}>
                        ✕
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {/* Forms inline para ações por tipo */}
      {acaoAberta?.tipo === 'ppp' && (
        <div className="card mt-4">
          <h4 style={{ marginBottom: 8, color: 'var(--azul-marinho)' }}>Vincular PPP a período especial</h4>
          <div className="form-row">
            <div>
              <label>Período</label>
              <select value={pppForm.periodoIndex} onChange={e => setPppForm(p => ({ ...p, periodoIndex: +e.target.value }))}>
                {periodos.map((p, i) => (
                  <option key={i} value={i}>{i + 1}. {p.ini} a {p.fim} — {p.desc || 'sem descrição'}</option>
                ))}
              </select>
            </div>
            <div>
              <label>Grau de exposição</label>
              <select value={pppForm.grau} onChange={e => setPppForm(p => ({ ...p, grau: +e.target.value as 15 | 20 | 25 }))}>
                <option value={25}>25 anos</option>
                <option value={20}>20 anos</option>
                <option value={15}>15 anos</option>
              </select>
            </div>
          </div>
          <div className="toolbar mt-4">
            <button className="btn btn-primario" onClick={() => handlePPP(acaoAberta.id)}>Confirmar</button>
            <button className="btn btn-secundario" onClick={() => setAcaoAberta(null)}>Cancelar</button>
          </div>
        </div>
      )}

      {acaoAberta?.tipo === 'ctsm' && (
        <div className="card mt-4">
          <h4 style={{ marginBottom: 8, color: 'var(--azul-marinho)' }}>Criar período de serviço militar</h4>
          <p className="text-muted mb-4">Período militar conta como tempo de contribuição mas NÃO conta como carência (art. 55, I, Lei 8.213/91).</p>
          <p className="msg msg-alerta" style={{ fontSize: 12, marginBottom: 12 }}>
            ⚠ Muitas declarações militares trazem apenas a <strong>duração</strong> (anos/meses/dias), sem as datas.
            Neste caso o sistema não preenche o período sozinho — informe o <strong>início (incorporação)</strong> e
            o <strong>fim</strong> conforme a duração declarada, evitando sobreposição com outros vínculos.
          </p>
          <div className="form-row">
            <div>
              <label>Início (dd/mm/aaaa)</label>
              <input type="text" value={ctsmForm.ini} onChange={e => setCtsmForm(p => ({ ...p, ini: e.target.value }))} placeholder="01/03/1990" />
            </div>
            <div>
              <label>Fim (dd/mm/aaaa)</label>
              <input type="text" value={ctsmForm.fim} onChange={e => setCtsmForm(p => ({ ...p, fim: e.target.value }))} placeholder="01/03/1991" />
            </div>
            <div>
              <label>Descrição</label>
              <input type="text" value={ctsmForm.desc} onChange={e => setCtsmForm(p => ({ ...p, desc: e.target.value }))} />
            </div>
          </div>
          <div className="toolbar mt-4">
            <button className="btn btn-primario" onClick={() => handleCTSM(acaoAberta.id)}>Criar período</button>
            <button className="btn btn-secundario" onClick={() => setAcaoAberta(null)}>Cancelar</button>
          </div>
        </div>
      )}

      {acaoAberta?.tipo === 'ctc' && (
        <div className="card mt-4">
          <h4 style={{ marginBottom: 8, color: 'var(--azul-marinho)' }}>Registrar período certificado (CTC)</h4>
          <div className="form-row">
            <div>
              <label>Início (dd/mm/aaaa)</label>
              <input type="text" value={ctcForm.ini} onChange={e => setCtcForm(p => ({ ...p, ini: e.target.value }))} placeholder="01/01/2000" />
            </div>
            <div>
              <label>Fim (dd/mm/aaaa)</label>
              <input type="text" value={ctcForm.fim} onChange={e => setCtcForm(p => ({ ...p, fim: e.target.value }))} placeholder="31/12/2010" />
            </div>
            <div>
              <label>Descrição</label>
              <input type="text" value={ctcForm.desc} onChange={e => setCtcForm(p => ({ ...p, desc: e.target.value }))} placeholder="RPPS - Estado SP" />
            </div>
          </div>
          <div className="toolbar mt-4">
            <button className="btn btn-primario" onClick={() => handleCTC(acaoAberta.id)}>Registrar</button>
            <button className="btn btn-secundario" onClick={() => setAcaoAberta(null)}>Cancelar</button>
          </div>
        </div>
      )}
    </div>
  );
}
