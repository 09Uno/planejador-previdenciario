'use client';

import { useState, useCallback } from 'react';
import {
  parseBR, fmtBR,
  gradePadrao, montarCenario, comparativosEncadeados,
  type PremissasCenario, type ResultadoCenario, type PerfilSegurado,
  type ParametrosVigentes, type Periodo, type Competencia, type Comparativo,
  type RegraId, type Cadencia,
} from '@mfaa/prev-engine';
import { salvarCenariosAction } from './cenarios-actions';
import { RppsPanel } from './rpps-panel';

// Parâmetros 2026 (default — conferir com params.ts)
const PARAMS_2026: ParametrosVigentes = {
  salarioMinimo: 1621,
  teto: 8475.55,
  divisorMinimo: 108,
  tabuaEs: {
    45: 34.6, 46: 33.7, 47: 32.9, 48: 32.0, 49: 31.2, 50: 30.4,
    51: 29.6, 52: 28.8, 53: 28.0, 54: 27.2, 55: 26.4, 56: 25.6,
    57: 24.9, 58: 24.1, 59: 23.3, 60: 22.6, 61: 21.8, 62: 21.1,
    63: 20.4, 64: 19.6, 65: 18.9, 66: 18.2, 67: 17.5, 68: 16.9,
    69: 16.2, 70: 15.5, 71: 14.9, 72: 14.3, 73: 13.7, 74: 13.1, 75: 12.5,
  },
};

const REGRA_LABEL: Record<string, string> = {
  da: 'Direito Adquirido', art15: 'Art. 15 (Pontos)', art16: 'Art. 16 (Idade progressiva)',
  art17: 'Art. 17 (Pedágio 50%)', art18: 'Art. 18 (Idade)', art20: 'Art. 20 (Pedágio 100%)',
  perm: 'Permanente',
  // Especial
  art21: 'Art. 21 — Especial (Transição)', esp_perm: 'Especial (Permanente)',
  // Professor
  prof_pontos: 'Professor (Pontos)', prof_idade: 'Professor (Idade)',
  prof_ped100: 'Professor (Pedágio 100%)', prof_perm: 'Professor (Permanente)',
  // PCD
  pcd_tc: 'PCD — por TC (LC 142)', pcd_idade: 'PCD — por Idade (LC 142)',
};

const fmtMoeda = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

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

export function CenariosTab({ caso }: { caso: CasoResumo }) {
  const [cenarios, setCenarios] = useState<ResultadoCenario[]>([]);
  const [selecionados, setSelecionados] = useState<Set<number>>(new Set());
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState('');
  const [mostrarNovo, setMostrarNovo] = useState(false);
  const [dataBase, setDataBase] = useState('');
  // Flags de regras avançadas
  const [grauEspecial, setGrauEspecial] = useState<0 | 15 | 20 | 25>(0);
  const [professor, setProfessor] = useState(false);
  const [grauPCD, setGrauPCD] = useState<'' | 'grave' | 'moderada' | 'leve'>('');

  const montarPerfil = useCallback((): PerfilSegurado | null => {
    if (!caso.periodosJson) return null;
    const periodos: { ini: string; fim: string; desc?: string; tipo?: string; grauEspecial?: 15 | 20 | 25 }[] = JSON.parse(caso.periodosJson);
    const comps: { comp: string; valor: number }[] = caso.competenciasJson ? JSON.parse(caso.competenciasJson) : [];

    // Grau especial: usa o do dropdown; se não, deriva dos períodos marcados (PPP)
    const grausPeriodos = periodos.filter(p => p.tipo === 'especial' && p.grauEspecial).map(p => p.grauEspecial!);
    const grauEspecialEfetivo = grauEspecial || (grausPeriodos.length ? Math.min(...grausPeriodos) as 15 | 20 | 25 : undefined);

    return {
      nome: caso.clienteNome,
      sexo: caso.sexo as 'M' | 'F',
      nascimento: caso.nascimento,
      periodos: periodos.map(p => ({
        ini: parseBR(p.ini)!, fim: parseBR(p.fim)!, desc: p.desc,
        tipo: p.tipo === 'especial' ? ('especial' as const) : ('normal' as const),
        grauEspecial: p.tipo === 'especial' ? p.grauEspecial : undefined,
      })),
      competencias: comps.map(c => ({
        competencia: c.comp,
        dias: 30,
        salarioContribuicao: c.valor,
      })),
      carenciaAtual: caso.carenciaAtual!,
      grauEspecial: grauEspecialEfetivo,
      professor: professor || undefined,
      grauPCD: grauPCD || undefined,
    };
  }, [caso, grauEspecial, professor, grauPCD]);

  if (!caso.periodosJson) {
    return (
      <div>
        <h3 style={{ marginBottom: 16, color: 'var(--azul-marinho)' }}>Cenários</h3>
        <div className="msg msg-alerta">Confirme os dados do CNIS antes de gerar cenários.</div>
      </div>
    );
  }

  if (caso.carenciaAtual == null) {
    return (
      <div>
        <h3 style={{ marginBottom: 16, color: 'var(--azul-marinho)' }}>Cenários</h3>
        <div className="msg msg-alerta">
          Preencha a carência atual na aba <strong>Auditoria</strong> antes de gerar cenários.
          A carência é necessária para o cálculo correto dos descartes e da RMI.
        </div>
      </div>
    );
  }

  /** Data-base dd/mm/aaaa para projeção (se vazio, usa hoje) */
  const hojeParam = dataBase || undefined;

  function gerarGrade() {
    const perfil = montarPerfil();
    if (!perfil) return;
    const resultado = gradePadrao(perfil, PARAMS_2026, hojeParam);
    setCenarios(resultado);
    setSelecionados(new Set());
    setMensagem('');
  }

  function adicionarCenario(premissas: PremissasCenario) {
    const perfil = montarPerfil();
    if (!perfil) return;
    if (hojeParam) premissas.hoje = hojeParam;
    const resultado = montarCenario(perfil, premissas, PARAMS_2026);
    setCenarios(prev => [...prev, resultado]);
    setMostrarNovo(false);
  }

  function toggleSelecao(idx: number) {
    setSelecionados(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  }

  async function salvar() {
    setSalvando(true);
    setMensagem('');
    try {
      await salvarCenariosAction(
        caso.id,
        cenarios.map((c, i) => ({
          rotulo: c.rotulo,
          premissasJson: JSON.stringify({ regra: c.regra, selecionado: selecionados.has(i) }),
          resultadoJson: JSON.stringify(c),
        })),
      );
      setMensagem('Cenários salvos com sucesso.');
    } catch {
      setMensagem('Erro ao salvar.');
    }
    setSalvando(false);
  }

  // Comparativo encadeado dos cenários selecionados
  const cenariosComROI = cenarios
    .map((c, i) => ({ c, i }))
    .filter(({ c, i }) => selecionados.has(i) && c.roi);
  const comparativos: Comparativo[] = cenariosComROI.length >= 2
    ? comparativosEncadeados(cenariosComROI.map(({ c }) => c.roi!))
    : [];

  // Numeração dos docs selecionados
  const docNumeros: Record<number, string> = {};
  let docCount = 2;
  for (const idx of [...selecionados].sort((a, b) => a - b)) {
    docNumeros[idx] = `${docCount}.0`;
    docCount++;
  }

  return (
    <div>
      <h3 style={{ marginBottom: 16, color: 'var(--azul-marinho)' }}>Cenários e ROI</h3>

      {mensagem && <div className={`msg ${mensagem.includes('Erro') ? 'msg-erro' : 'msg-sucesso'}`}>{mensagem}</div>}

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="form-row" style={{ alignItems: 'flex-end' }}>
          <div>
            <label>Data-base da análise</label>
            <input
              type="text"
              value={dataBase}
              onChange={e => setDataBase(e.target.value)}
              placeholder="dd/mm/aaaa (vazio = hoje)"
              style={{ width: 180, padding: '6px 8px' }}
            />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primario" onClick={gerarGrade}>Gerar grade padrão</button>
            <button className="btn btn-secundario" onClick={() => setMostrarNovo(!mostrarNovo)}>Novo cenário</button>
            {cenarios.length > 0 && (
              <button className="btn btn-secundario" onClick={salvar} disabled={salvando}>
                {salvando ? 'Salvando...' : 'Salvar cenários'}
              </button>
            )}
          </div>
        </div>
        <div className="form-row" style={{ marginTop: 12 }}>
          <div>
            <label>Atividade especial</label>
            <select title="Atividade especial" value={grauEspecial} onChange={e => setGrauEspecial(+e.target.value as 0 | 15 | 20 | 25)}>
              <option value={0}>Não se aplica</option>
              <option value={25}>Grau 25 anos</option>
              <option value={20}>Grau 20 anos</option>
              <option value={15}>Grau 15 anos</option>
            </select>
          </div>
          <div>
            <label>Professor</label>
            <select title="Professor" value={professor ? '1' : '0'} onChange={e => setProfessor(e.target.value === '1')}>
              <option value="0">Não</option>
              <option value="1">Sim (magistério educação básica)</option>
            </select>
          </div>
          <div>
            <label>PCD (LC 142/2013)</label>
            <select title="PCD" value={grauPCD} onChange={e => setGrauPCD(e.target.value as '' | 'grave' | 'moderada' | 'leve')}>
              <option value="">Não se aplica</option>
              <option value="grave">Grave</option>
              <option value="moderada">Moderada</option>
              <option value="leve">Leve</option>
            </select>
          </div>
        </div>
        <p className="text-muted" style={{ marginTop: 8 }}>
          Carência atual: <strong>{caso.carenciaAtual}</strong> contribuição(ões)
          {grauEspecial > 0 && ` · Especial ${grauEspecial}a`}
          {professor && ' · Professor'}
          {grauPCD && ` · PCD ${grauPCD}`}
        </p>
      </div>

      {mostrarNovo && <FormNovoCenario onAdd={adicionarCenario} onCancel={() => setMostrarNovo(false)} />}

      {/* Cards de cenários */}
      {cenarios.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16, marginBottom: 24 }}>
          {cenarios.map((c, i) => (
            <div key={i} className="card" style={{
              borderLeft: selecionados.has(i) ? '4px solid var(--azul-marinho)' : '4px solid transparent',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div>
                  <strong style={{ fontSize: 14 }}>{REGRA_LABEL[c.regra] || c.regra}</strong>
                  {docNumeros[i] && <span className="badge badge-aprovado" style={{ marginLeft: 8 }}>Doc {docNumeros[i]}</span>}
                </div>
                <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                  <input type="checkbox" checked={selecionados.has(i)} onChange={() => toggleSelecao(i)} />
                  Selecionar
                </label>
              </div>
              <p className="text-muted" style={{ fontSize: 12, marginBottom: 8 }}>{c.rotulo}</p>

              {!c.elegivel ? (
                <p style={{ color: 'var(--erro)', fontSize: 13 }}>Não elegível</p>
              ) : (
                <div style={{ fontSize: 13 }}>
                  <div className="form-row" style={{ marginBottom: 4 }}>
                    <div><label>DIB</label><p>{c.dib}</p></div>
                    <div><label>Idade</label><p>{c.idadeNaDIB?.toFixed(1)} anos</p></div>
                  </div>
                  <div className="form-row" style={{ marginBottom: 4 }}>
                    <div><label>TC na DIB</label><p>{c.tcNaDIB}</p></div>
                    <div><label>Carência</label><p>{c.carenciaNaDIB}</p></div>
                  </div>
                  {c.rmi && (
                    <div className="form-row" style={{ marginBottom: 4 }}>
                      <div><label>RMI</label><p style={{ fontWeight: 600, color: 'var(--azul-marinho)' }}>{fmtMoeda(c.rmi.rmi)}</p></div>
                      <div><label>Coef.</label><p>{((c.rmi.coeficiente ?? 0) * 100).toFixed(0)}%</p></div>
                      <div><label>Descartes</label><p>{c.rmi.descartes}</p></div>
                    </div>
                  )}
                  {c.roi && (
                    <div style={{ marginTop: 4, padding: '6px 0', borderTop: '1px solid var(--borda)' }}>
                      <label>ROI líquido</label>
                      <p style={{ fontWeight: 600, color: c.roi.roiLiquido >= 0 ? 'var(--sucesso)' : 'var(--erro)' }}>
                        {fmtMoeda(c.roi.roiLiquido)}
                      </p>
                    </div>
                  )}
                  {c.observacoes.length > 0 && (
                    <div className="text-muted" style={{ fontSize: 11, marginTop: 4 }}>
                      {c.observacoes.map((o, j) => <p key={j}>{o}</p>)}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Tabela comparativa encadeada */}
      {comparativos.length > 0 && (
        <div className="card">
          <h4 style={{ marginBottom: 12, color: 'var(--azul-marinho)' }}>Comparativo encadeado</h4>
          <table>
            <thead>
              <tr>
                <th>Confronto</th>
                <th>Cenário A</th>
                <th>ROI A</th>
                <th>Cenário B</th>
                <th>ROI B</th>
                <th>Diferença</th>
                <th>Vencedor</th>
              </tr>
            </thead>
            <tbody>
              {comparativos.map((c, i) => (
                <tr key={i}>
                  <td style={{ fontWeight: 500 }}>{String.fromCharCode(65 + i)}</td>
                  <td className="text-muted" style={{ fontSize: 12 }}>{c.a.rotulo}</td>
                  <td>{fmtMoeda(c.a.roiLiquido)}</td>
                  <td className="text-muted" style={{ fontSize: 12 }}>{c.b.rotulo}</td>
                  <td>{fmtMoeda(c.b.roiLiquido)}</td>
                  <td style={{ fontWeight: 600, color: c.diferencaROI >= 0 ? 'var(--sucesso)' : 'var(--erro)' }}>
                    {fmtMoeda(c.diferencaROI)}
                  </td>
                  <td style={{ fontWeight: 600, color: 'var(--azul-marinho)' }}>
                    {c.vencedor === c.a.rotulo ? 'A' : 'B'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {comparativos.length > 0 && (
            <p style={{ marginTop: 8, fontWeight: 600, color: 'var(--azul-marinho)' }}>
              Vencedor final: {comparativos[comparativos.length - 1].vencedor}
            </p>
          )}
        </div>
      )}

      <RppsPanel caso={caso} />
    </div>
  );
}

// ---------- Formulário para novo cenário ----------
function FormNovoCenario({ onAdd, onCancel }: { onAdd: (p: PremissasCenario) => void; onCancel: () => void }) {
  const [regra, setRegra] = useState<RegraId>('art18');
  const [base, setBase] = useState<'minimo' | 'teto' | 'valor'>('minimo');
  const [valorBase, setValorBase] = useState('');
  const [cadencia, setCadencia] = useState<Cadencia>('sem-parar');
  const [aliquota, setAliquota] = useState('20');

  function submeter(e: React.FormEvent) {
    e.preventDefault();
    onAdd({
      regra,
      base,
      valorBase: base === 'valor' ? parseFloat(valorBase.replace(/\./g, '').replace(',', '.')) || 0 : undefined,
      cadencia,
      aliquota: parseFloat(aliquota) / 100 || 0.20,
    });
  }

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <h4 style={{ marginBottom: 12, color: 'var(--azul-marinho)' }}>Novo cenário</h4>
      <form onSubmit={submeter}>
        <div className="form-row">
          <div>
            <label>Regra</label>
            <select value={regra} onChange={e => setRegra(e.target.value as RegraId)}>
              <option value="art18">Art. 18 (Idade)</option>
              <option value="art15">Art. 15 (Pontos)</option>
              <option value="art16">Art. 16 (Idade progressiva)</option>
              <option value="art17">Art. 17 (Pedágio 50%)</option>
              <option value="art20">Art. 20 (Pedágio 100%)</option>
              <option value="perm">Permanente</option>
              <option value="da">Direito Adquirido</option>
            </select>
          </div>
          <div>
            <label>Base de contribuição</label>
            <select value={base} onChange={e => setBase(e.target.value as 'minimo' | 'teto' | 'valor')}>
              <option value="minimo">Salário mínimo</option>
              <option value="teto">Teto RGPS</option>
              <option value="valor">Valor livre</option>
            </select>
          </div>
          {base === 'valor' && (
            <div>
              <label>Valor (R$)</label>
              <input type="text" value={valorBase} onChange={e => setValorBase(e.target.value)} placeholder="3.500,00" />
            </div>
          )}
        </div>
        <div className="form-row">
          <div>
            <label>Cadência</label>
            <select value={cadencia} onChange={e => setCadencia(e.target.value as Cadencia)}>
              <option value="sem-parar">Sem parar</option>
              <option value="cada-6-meses">A cada 6 meses</option>
              <option value="parar">Parar de contribuir</option>
            </select>
          </div>
          <div>
            <label>Alíquota (%)</label>
            <input type="text" value={aliquota} onChange={e => setAliquota(e.target.value)} placeholder="20" />
          </div>
        </div>
        <div className="toolbar">
          <button type="submit" className="btn btn-primario">Adicionar cenário</button>
          <button type="button" className="btn btn-secundario" onClick={onCancel}>Cancelar</button>
        </div>
      </form>
    </div>
  );
}
