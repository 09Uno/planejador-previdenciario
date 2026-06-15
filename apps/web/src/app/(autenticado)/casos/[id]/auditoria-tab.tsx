'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  parseBR, fmtBR, fmtAMD, idadeAnos, idadeAMD, mesclarPeriodos,
  diasAte, diasParaAMD, tcAnos, diasComConversao,
  auditarCNIS, contarCarencia, avaliarRegras,
  VESPERA, EC103,
  type Pendencia, type VinculoCNIS, type CompetenciaCNIS, type ResultadoCNIS,
  type Periodo, type Sexo, type Regra,
} from '@mfaa/prev-engine';
import { salvarCarenciaAction } from './auditoria-actions';
import { listarArquivosAction } from './arquivos-actions';
import { LABEL_CLASSIFICACAO } from '@/lib/classificar-arquivo';

interface CasoResumo {
  id: string;
  clienteNome: string;
  sexo: string;
  nascimento: string;
  status: string;
  periodosJson: string | null;
  competenciasJson: string | null;
  cnisJson: string | null;
  carenciaAtual: number | null;
}

const SEVER_LABEL: Record<string, string> = { alta: 'Alta', media: 'Média', baixa: 'Baixa' };
const SEVER_COR: Record<string, string> = { alta: '#DC2626', media: '#D97706', baixa: '#6B7280' };

export function AuditoriaTab({ caso }: { caso: CasoResumo }) {
  // Inicializado com o valor salvo; atualizado pelo useMemo quando carenciaCalc fica disponível
  const [carencia, setCarencia] = useState<number>(caso.carenciaAtual ?? 0);
  const [carenciaInicializada, setCarenciaInicializada] = useState(caso.carenciaAtual != null);
  const [salvando, setSalvando] = useState(false);
  const [msgCarencia, setMsgCarencia] = useState('');
  const [mostrarPreAnalise, setMostrarPreAnalise] = useState(false);
  const [arquivos, setArquivos] = useState<{ id: string; classificacao: string; status: string; nome: string; dadosExtraidos: string | null }[]>([]);

  useEffect(() => {
    listarArquivosAction(caso.id).then(setArquivos);
  }, [caso.id]);

  const analise = useMemo(() => {
    if (!caso.periodosJson) return null;

    const periodos: { ini: string; fim: string; desc?: string; tipo?: string; grauEspecial?: 15 | 20 | 25 }[] = JSON.parse(caso.periodosJson);
    const merged: Periodo[] = mesclarPeriodos(
      periodos.map(p => ({
        ini: parseBR(p.ini)!,
        fim: parseBR(p.fim)!,
        desc: p.desc,
        tipo: p.tipo === 'especial' ? ('especial' as const) : ('normal' as const),
        grauEspecial: p.tipo === 'especial' ? p.grauEspecial : undefined,
      }))
    );
    // Grau especial do perfil (menor grau = mais favorável) para as regras art. 21 / 19 §1º
    const grausEsp = periodos.filter(p => p.tipo === 'especial' && p.grauEspecial).map(p => p.grauEspecial!);
    const grauEspecial = grausEsp.length ? (Math.min(...grausEsp) as 15 | 20 | 25) : undefined;

    const nasc = parseBR(caso.nascimento)!;
    const hoje = Date.now();

    // Conversão especial→comum (art. 25 §2º EC 103): soma o "bônus" do tempo especial pré-reforma.
    const bonusConv = grauEspecial
      ? Math.max(0, diasComConversao(merged, caso.sexo as Sexo, VESPERA).diasConvertidos - diasAte(merged, VESPERA))
      : 0;

    // TC na véspera e hoje (já com a conversão especial)
    const diasVespera = diasAte(merged, VESPERA) + bonusConv;
    const diasHoje = diasAte(merged, hoje) + bonusConv;
    const tcVespera = diasParaAMD(diasVespera);
    const tcHoje = diasParaAMD(diasHoje);
    const idadeHoje = idadeAnos(nasc, hoje);
    const idadeAMDHoje = idadeAMD(nasc, hoje);

    // Carência (simplificada: cada competência do vínculo)
    const carenciaCalc = contarCarencia({
      vinculosEmprego: merged,
    });

    // Auditoria (se tem CNIS)
    let pendencias: Pendencia[] = [];
    if (caso.cnisJson) {
      const cnisData: ResultadoCNIS = JSON.parse(caso.cnisJson);
      pendencias = auditarCNIS(cnisData);
    }

    // Regras
    const avaliacao = avaliarRegras({
      sexo: caso.sexo as Sexo,
      nasc,
      merged,
      hoje,
      continuaContribuindo: true,
      grauEspecial,
    });

    return {
      merged, nasc, hoje,
      diasVespera, diasHoje,
      tcVespera, tcHoje,
      idadeHoje, idadeAMDHoje,
      carenciaCalc,
      pendencias,
      avaliacao,
    };
  }, [caso]);

  // Se carência não foi salva ainda, inicializar com o valor calculado
  useEffect(() => {
    if (!carenciaInicializada && analise?.carenciaCalc) {
      setCarencia(analise.carenciaCalc.total);
      setCarenciaInicializada(true);
    }
  }, [carenciaInicializada, analise]);

  if (!caso.periodosJson) {
    return (
      <div>
        <h3 style={{ marginBottom: 16, color: 'var(--azul-marinho)' }}>Auditoria</h3>
        <div className="msg msg-alerta">
          Confirme os dados do CNIS na aba CNIS antes de rodar a auditoria.
        </div>
      </div>
    );
  }

  if (!analise) return null;

  const { tcVespera, tcHoje, idadeAMDHoje, carenciaCalc, pendencias, avaliacao } = analise;

  async function salvarCarencia() {
    setSalvando(true);
    setMsgCarencia('');
    try {
      const valor = carencia || carenciaCalc.total;
      await salvarCarenciaAction(caso.id, valor);
      setMsgCarencia(`Carência ${valor} salva.`);
    } catch {
      setMsgCarencia('Erro ao salvar.');
    }
    setSalvando(false);
  }

  function gerarPreAnalise(): string {
    const regras = avaliacao.regras;
    const sexoLabel = caso.sexo === 'M' ? 'o segurado' : 'a segurada';
    const linhas: string[] = [];

    linhas.push(`PRÉ-ANÁLISE — ${caso.clienteNome}`);
    linhas.push(`${'='.repeat(60)}`);
    linhas.push('');

    // I - DOS VÍNCULOS
    linhas.push('I — DOS VÍNCULOS');
    linhas.push('');
    const periodos: { ini: string; fim: string; desc?: string }[] = JSON.parse(caso.periodosJson!);
    periodos.forEach((p, i) => {
      linhas.push(`  ${i + 1}. ${p.ini} a ${p.fim}${p.desc ? ' — ' + p.desc : ''}`);
    });
    linhas.push('');

    // II - DOS INDICADORES
    linhas.push('II — DOS INDICADORES');
    linhas.push('');
    if (pendencias.length === 0) {
      linhas.push('  Nenhuma pendência identificada.');
    } else {
      const agrupados = { alta: [] as Pendencia[], media: [] as Pendencia[], baixa: [] as Pendencia[] };
      for (const p of pendencias) agrupados[p.severidade].push(p);
      for (const sev of ['alta', 'media', 'baixa'] as const) {
        if (agrupados[sev].length === 0) continue;
        linhas.push(`  [${SEVER_LABEL[sev]}]`);
        for (const p of agrupados[sev]) {
          linhas.push(`    • ${p.titulo}: ${p.detalhe}`);
          linhas.push(`      Providência: ${p.providencia}`);
        }
      }
    }
    linhas.push('');

    // III - DA LACUNA DE RECOLHIMENTOS
    linhas.push('III — DA LACUNA DE RECOLHIMENTOS');
    linhas.push('');
    const lacunas = pendencias.filter(p => p.tipo === 'lacuna');
    if (lacunas.length === 0) {
      linhas.push('  Sem lacunas significativas identificadas.');
    } else {
      for (const l of lacunas) {
        linhas.push(`  • ${l.titulo}: ${l.detalhe}`);
      }
    }
    linhas.push('');

    // IV - DA CONCLUSÃO
    linhas.push('IV — DA CONCLUSÃO');
    linhas.push('');
    linhas.push(`  TC em 13/11/2019: ${fmtAMD(tcVespera)}`);
    linhas.push(`  TC atual (projeção contínua): ${fmtAMD(tcHoje)}`);
    linhas.push(`  Idade: ${idadeAMDHoje.y} ano(s), ${idadeAMDHoje.m} mês(es) e ${idadeAMDHoje.d} dia(s)`);
    linhas.push(`  Carência: ${(carencia || carenciaCalc.total)} contribuição(ões)`);
    linhas.push('');
    linhas.push('  Enquadramento por regra:');

    for (const r of regras) {
      const status = r.cumprida ? 'CUMPRIDA' : (r.data ? `projeção: ${fmtBR(r.data)}` : 'não alcançada');
      linhas.push(`    • ${r.nome}: ${status}`);
    }
    linhas.push('');
    linhas.push('  MINUTA — requer conferência do advogado.');

    return linhas.join('\n');
  }

  return (
    <div>
      <h3 style={{ marginBottom: 16, color: 'var(--azul-marinho)' }}>Auditoria do CNIS</h3>

      {/* Resumo */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h4 style={{ marginBottom: 12, color: 'var(--azul-marinho)' }}>Resumo</h4>
        <div className="form-row">
          <div>
            <label>TC em 12/11/2019</label>
            <p style={{ fontWeight: 600 }}>{fmtAMD(tcVespera)}</p>
          </div>
          <div>
            <label>TC atual (projeção contínua)</label>
            <p style={{ fontWeight: 600 }}>{fmtAMD(tcHoje)}</p>
          </div>
          <div>
            <label>Idade atual</label>
            <p style={{ fontWeight: 600 }}>{idadeAMDHoje.y}a {idadeAMDHoje.m}m {idadeAMDHoje.d}d</p>
          </div>
          <div>
            <label>Carência (contribuições)</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="number"
                value={carencia}
                onChange={e => setCarencia(parseInt(e.target.value) || 0)}
                style={{ width: 80, padding: '4px 8px', fontSize: 14 }}
              />
              <button
                className="btn btn-secundario"
                onClick={salvarCarencia}
                disabled={salvando}
                style={{ padding: '4px 10px', fontSize: 12 }}
              >
                {salvando ? '...' : 'Salvar'}
              </button>
            </div>
            {msgCarencia && <span className="text-muted" style={{ fontSize: 12 }}>{msgCarencia}</span>}
          </div>
        </div>
      </div>

      {/* Pendências */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h4 style={{ marginBottom: 12, color: 'var(--azul-marinho)' }}>
          Pendências ({pendencias.length})
        </h4>
        {pendencias.length === 0 ? (
          <p className="text-muted">Nenhuma pendência identificada.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th style={{ width: 90 }}>Severidade</th>
                <th style={{ width: '25%' }}>Título</th>
                <th>Significado</th>
                <th style={{ width: '25%' }}>Providência</th>
              </tr>
            </thead>
            <tbody>
              {pendencias.map((p, i) => (
                <tr key={i}>
                  <td>
                    <span style={{ color: SEVER_COR[p.severidade], fontWeight: 600, fontSize: 13 }}>
                      {SEVER_LABEL[p.severidade]}
                    </span>
                  </td>
                  <td style={{ fontWeight: 500 }}>{p.titulo}</td>
                  <td className="text-muted">{p.detalhe}</td>
                  <td className="text-muted">{p.providencia}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Enquadramento por regra */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h4 style={{ marginBottom: 12, color: 'var(--azul-marinho)' }}>Enquadramento nas regras</h4>
        <table>
          <thead>
            <tr>
              <th style={{ width: '30%' }}>Regra</th>
              <th style={{ width: 100 }}>Situação</th>
              <th style={{ width: 110 }}>Data</th>
              <th>Detalhamento</th>
            </tr>
          </thead>
          <tbody>
            {avaliacao.regras.map((r, i) => (
              <tr key={i}>
                <td style={{ fontWeight: 500 }}>{r.nome}</td>
                <td>
                  <span className={`badge ${r.cumprida ? 'badge-aprovado' : 'badge-coleta'}`}>
                    {r.cumprida ? 'Cumprida' : 'Pendente'}
                  </span>
                </td>
                <td>{r.data ? fmtBR(r.data) : '—'}</td>
                <td className="text-muted" style={{ fontSize: 13 }}>{r.detalhe}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pré-análise */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h4 style={{ color: 'var(--azul-marinho)' }}>Texto de pré-análise</h4>
          <button
            className="btn btn-primario"
            onClick={() => setMostrarPreAnalise(!mostrarPreAnalise)}
          >
            {mostrarPreAnalise ? 'Ocultar' : 'Gerar texto de pré-análise'}
          </button>
        </div>
        {mostrarPreAnalise && (
          <div>
            <textarea
              readOnly
              value={gerarPreAnalise()}
              rows={25}
              style={{ fontFamily: 'monospace', fontSize: 13 }}
            />
            <button
              className="btn btn-secundario mt-4"
              onClick={() => {
                navigator.clipboard.writeText(gerarPreAnalise());
              }}
            >
              Copiar para a área de transferência
            </button>
          </div>
        )}
      </div>

      {/* Cruzamento documentos × períodos */}
      {arquivos.length > 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <h4 style={{ marginBottom: 12, color: 'var(--azul-marinho)' }}>
            Documentos do caso ({arquivos.length})
          </h4>
          <table>
            <thead>
              <tr>
                <th>Arquivo</th>
                <th>Classificação</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {arquivos.map(a => (
                <tr key={a.id}>
                  <td>{a.nome}</td>
                  <td>{LABEL_CLASSIFICACAO[a.classificacao] || a.classificacao}</td>
                  <td style={{ color: a.status === 'processado' ? 'var(--sucesso)' : 'var(--texto-secundario)', fontWeight: 600, fontSize: 12 }}>
                    {a.status === 'processado' ? 'Processado' : a.status === 'so-arquivo' ? 'Só arquivo' : 'Pendente'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Alertas de documentos faltantes */}
          {(() => {
            const alertas: string[] = [];
            const periodos: { tipo?: string; grauEspecial?: number; desc?: string }[] =
              caso.periodosJson ? JSON.parse(caso.periodosJson) : [];

            const temPPP = arquivos.some(a => a.classificacao === 'ppp');
            const temCTSM = arquivos.some(a => a.classificacao === 'ctsm');

            for (let i = 0; i < periodos.length; i++) {
              const p = periodos[i];
              if (p.tipo === 'especial' && !temPPP) {
                alertas.push(`Período ${i + 1} marcado como especial (grau ${p.grauEspecial}) mas nenhum PPP foi anexado.`);
              }
              if (p.tipo === 'militar' && !temCTSM) {
                alertas.push(`Período ${i + 1} (${p.desc || 'militar'}) sem CTSM anexado.`);
              }
            }

            if (alertas.length === 0) return null;

            return (
              <div className="msg msg-alerta mt-4">
                <strong>Documentos faltantes:</strong>
                <ul style={{ margin: '8px 0 0 16px', padding: 0 }}>
                  {alertas.map((a, i) => <li key={i}>{a}</li>)}
                </ul>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
