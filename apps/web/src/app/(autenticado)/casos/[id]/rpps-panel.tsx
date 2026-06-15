'use client';

import { useMemo, useState } from 'react';
import {
  parseBR, fmtBR, mesclarPeriodos, diasAte, tcAnos,
  RPPS_SP, avaliarRegrasRPPS, calcularRMI_RPPS,
  pontosTransicaoRPPS, contribuicaoInativo, abonoPermanencia,
  cenariosAverbacao, resumoPorRegime,
  type Periodo, type Regra, type PeriodoHibrido, type Regime,
} from '@mfaa/prev-engine';

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

interface PeriodoEntrada { ini: string; fim: string; desc?: string }

interface RegraRPPS extends Regra {
  rmiCoef: { rmi: number; media: number; coeficiente: number | null; tipo: string } | null;
  rmiIntegral: { rmi: number; media: number; coeficiente: number | null; tipo: string } | null;
  anosTC: number;
  pontosExigidos: number | null;
}

export function RppsPanel({ caso }: { caso: CasoResumo }) {
  const [aberto, setAberto] = useState(false);
  const [ingressoServ, setIngressoServ] = useState('');
  const [ingressoCargo, setIngressoCargo] = useState('');
  const [ultimaRem, setUltimaRem] = useState('');
  const [dataBase, setDataBase] = useState('');
  const [analisado, setAnalisado] = useState(false);
  const [erro, setErro] = useState('');
  const [resultado, setResultado] = useState<RegraRPPS[]>([]);

  // Períodos do caso (conferidos)
  const periodosEntrada: PeriodoEntrada[] = useMemo(
    () => (caso.periodosJson ? JSON.parse(caso.periodosJson) : []),
    [caso.periodosJson],
  );

  // Salários RPPS = valores das competências do caso (100%, sem teto)
  const salariosRPPS: number[] = useMemo(() => {
    if (!caso.competenciasJson) return [];
    const comps: { comp: string; valor: number }[] = JSON.parse(caso.competenciasJson);
    return comps.map(c => c.valor).filter(v => v > 0);
  }, [caso.competenciasJson]);

  // Regime por período (default: todos RPPS) — para a dupla opinião
  const [regimes, setRegimes] = useState<Regime[]>(() => periodosEntrada.map(() => 'RPPS'));

  function analisar() {
    setErro('');
    const nasc = parseBR(caso.nascimento);
    const iServ = parseBR(ingressoServ);
    const iCargo = parseBR(ingressoCargo);
    if (nasc == null) { setErro('Data de nascimento do caso inválida.'); return; }
    if (iServ == null) { setErro('Informe a data de ingresso no serviço público.'); return; }
    if (iCargo == null) { setErro('Informe a data de ingresso no cargo.'); return; }
    if (!periodosEntrada.length) { setErro('Sem períodos conferidos no caso.'); return; }

    const periodos: Periodo[] = periodosEntrada.map(p => ({
      ini: parseBR(p.ini)!, fim: parseBR(p.fim)!, desc: p.desc,
    }));
    const merged = mesclarPeriodos(periodos);
    const hoje = parseBR(dataBase) ?? Date.now();
    const ultima = parseFloat(ultimaRem.replace(/\./g, '').replace(',', '.')) || 0;
    const elegivelIntegralidade = RPPS_SP.permiteIntegralidade
      && iServ <= (RPPS_SP.integralidadeAte ?? 0);

    const { regras } = avaliarRegrasRPPS({
      sexo: caso.sexo as 'M' | 'F',
      nasc, merged, hoje, params: RPPS_SP,
      ingressoServPublico: iServ,
      ingressoCargo: iCargo,
    });

    const out: RegraRPPS[] = regras.map(r => {
      let rmiCoef = null as RegraRPPS['rmiCoef'];
      let rmiIntegral = null as RegraRPPS['rmiIntegral'];
      let anosTC = 0;
      let pontosExigidos: number | null = null;
      if (r.data != null) {
        anosTC = tcAnos(diasAte(merged, r.data));
        rmiCoef = calcularRMI_RPPS({ tipo: 'coeficiente', salarios: salariosRPPS, tcAnos: anosTC, params: RPPS_SP });
        if (elegivelIntegralidade && ultima > 0) {
          rmiIntegral = calcularRMI_RPPS({ tipo: 'integralidade', salarios: salariosRPPS, tcAnos: anosTC, ultimaRemuneracao: ultima, params: RPPS_SP });
        }
        if (r.id === 'rpps_pontos') {
          pontosExigidos = pontosTransicaoRPPS(RPPS_SP, new Date(r.data).getFullYear(), caso.sexo as 'M' | 'F');
        }
      }
      return { ...r, rmiCoef, rmiIntegral, anosTC, pontosExigidos };
    });

    setResultado(out);
    setAnalisado(true);
  }

  if (!caso.periodosJson) return null;

  return (
    <div className="card" style={{ marginTop: 24, borderTop: '3px solid var(--azul-marinho)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
        onClick={() => setAberto(!aberto)}>
        <h4 style={{ color: 'var(--azul-marinho)', margin: 0 }}>
          Dupla opinião — RPPS ({RPPS_SP.ente})
        </h4>
        <button className="btn btn-secundario" type="button">{aberto ? 'Ocultar' : 'Abrir'}</button>
      </div>

      {aberto && (
        <div style={{ marginTop: 16 }}>
          <p className="text-muted" style={{ fontSize: 12, marginBottom: 12 }}>
            Avalia as regras do Regime Próprio (LC 1.354/2020) lado a lado com a grade RGPS acima.
            Os salários usados na média são os valores das competências conferidas (RPPS: 100%, sem teto RGPS).
          </p>

          {erro && <div className="msg msg-erro" style={{ marginBottom: 12 }}>{erro}</div>}

          <div className="form-row" style={{ alignItems: 'flex-end' }}>
            <div>
              <label>Ingresso no serviço público</label>
              <input type="text" value={ingressoServ} onChange={e => setIngressoServ(e.target.value)} placeholder="dd/mm/aaaa" style={{ width: 150 }} />
            </div>
            <div>
              <label>Ingresso no cargo</label>
              <input type="text" value={ingressoCargo} onChange={e => setIngressoCargo(e.target.value)} placeholder="dd/mm/aaaa" style={{ width: 150 }} />
            </div>
            <div>
              <label>Última remuneração (integralidade)</label>
              <input type="text" value={ultimaRem} onChange={e => setUltimaRem(e.target.value)} placeholder="10.000,00" style={{ width: 150 }} />
            </div>
            <div>
              <label>Data-base</label>
              <input type="text" value={dataBase} onChange={e => setDataBase(e.target.value)} placeholder="dd/mm/aaaa (vazio = hoje)" style={{ width: 170 }} />
            </div>
            <button className="btn btn-primario" type="button" onClick={analisar}>Analisar RPPS</button>
          </div>

          {salariosRPPS.length === 0 && (
            <p className="msg msg-alerta" style={{ marginTop: 12 }}>
              Sem competências conferidas — a RMI por coeficiente ficará zerada. Confira o CNIS ou informe a integralidade.
            </p>
          )}

          {analisado && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16, marginTop: 16 }}>
                {resultado.map((r, i) => (
                  <div key={i} className="card" style={{ borderLeft: r.cumprida ? '4px solid var(--sucesso)' : '4px solid var(--borda)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                      <strong style={{ fontSize: 13 }}>{r.nome}</strong>
                      {r.data != null && (
                        <span className={`badge ${r.cumprida ? 'badge-aprovado' : ''}`} style={{ whiteSpace: 'nowrap' }}>
                          {r.cumprida ? 'Cumprida' : 'Futura'}
                        </span>
                      )}
                    </div>
                    <p className="text-muted" style={{ fontSize: 11, margin: '4px 0' }}>{r.fundamento}</p>
                    {r.data == null ? (
                      <p style={{ color: 'var(--erro)', fontSize: 13 }}>Não alcançada</p>
                    ) : (
                      <div style={{ fontSize: 13 }}>
                        <div className="form-row" style={{ marginBottom: 4 }}>
                          <div><label>DIB</label><p>{fmtBR(r.data)}</p></div>
                          <div><label>TC na DIB</label><p>{r.anosTC.toFixed(1)} anos</p></div>
                          {r.pontosExigidos != null && (
                            <div><label>Pontos exig.</label><p>{r.pontosExigidos}</p></div>
                          )}
                        </div>
                        {r.rmiCoef && (
                          <div className="form-row" style={{ marginBottom: 4 }}>
                            <div><label>RMI (coef.)</label>
                              <p style={{ fontWeight: 600, color: 'var(--azul-marinho)' }}>{fmtMoeda(r.rmiCoef.rmi)}</p>
                            </div>
                            <div><label>Média</label><p>{fmtMoeda(r.rmiCoef.media)}</p></div>
                            <div><label>Coef.</label><p>{((r.rmiCoef.coeficiente ?? 0) * 100).toFixed(0)}%</p></div>
                          </div>
                        )}
                        {r.rmiIntegral && (
                          <div style={{ padding: '4px 0', borderTop: '1px solid var(--borda)' }}>
                            <label>RMI (integralidade)</label>
                            <p style={{ fontWeight: 600, color: 'var(--azul-marinho)' }}>{fmtMoeda(r.rmiIntegral.rmi)}</p>
                          </div>
                        )}
                        {r.rmiCoef && r.rmiCoef.rmi > 0 && (
                          <p className="text-muted" style={{ fontSize: 11, marginTop: 4 }}>
                            Contrib. inativo: {fmtMoeda(contribuicaoInativo(r.rmiCoef.rmi, RPPS_SP))} ·
                            líquida ≈ {fmtMoeda(r.rmiCoef.rmi - contribuicaoInativo(r.rmiCoef.rmi, RPPS_SP))}
                          </p>
                        )}
                        <p className="text-muted" style={{ fontSize: 11, marginTop: 4 }}>{r.detalhe}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <DuplaOpiniao periodos={periodosEntrada} regimes={regimes} setRegimes={setRegimes} dataBase={dataBase} />

              <p className="text-muted" style={{ fontSize: 11, marginTop: 12 }}>
                Abono de permanência (se permanecer em atividade após cumprir requisito): devolução da contribuição
                do servidor — ex.: {fmtMoeda(abonoPermanencia(parseFloat(ultimaRem.replace(/\./g, '').replace(',', '.')) || 0))} sobre a última remuneração.
                MINUTA — requer conferência do advogado.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ---------- Dupla opinião: averbação por CTC ----------
function DuplaOpiniao({
  periodos, regimes, setRegimes, dataBase,
}: {
  periodos: PeriodoEntrada[];
  regimes: Regime[];
  setRegimes: (r: Regime[]) => void;
  dataBase: string;
}) {
  const corte = parseBR(dataBase) ?? Date.now();

  const hibridos: PeriodoHibrido[] = periodos.map((p, i) => ({
    ini: parseBR(p.ini)!, fim: parseBR(p.fim)!, desc: p.desc,
    regime: regimes[i] ?? 'RPPS',
  }));

  const cenarios = cenariosAverbacao(hibridos);

  function alternar(i: number) {
    const next = [...regimes];
    next[i] = (next[i] === 'RPPS' ? 'RGPS' : 'RPPS');
    setRegimes(next);
  }

  return (
    <div style={{ marginTop: 20 }}>
      <h4 style={{ color: 'var(--azul-marinho)', marginBottom: 8 }}>Averbação por CTC (dupla opinião)</h4>
      <p className="text-muted" style={{ fontSize: 12, marginBottom: 8 }}>
        Marque o regime de cada período e compare as contagens com e sem averbação. Vedada dupla contagem;
        tempo especial em CTC não é convertido (Nota Técnica 792, STF).
      </p>

      <table style={{ marginBottom: 12 }}>
        <thead>
          <tr><th>#</th><th>Início</th><th>Fim</th><th>Descrição</th><th>Regime</th></tr>
        </thead>
        <tbody>
          {periodos.map((p, i) => (
            <tr key={i}>
              <td>{i + 1}</td>
              <td>{p.ini}</td>
              <td>{p.fim}</td>
              <td className="text-muted" style={{ fontSize: 12 }}>{p.desc ?? '—'}</td>
              <td>
                <button type="button" className="btn btn-secundario" style={{ padding: '2px 10px' }}
                  onClick={() => alternar(i)}>
                  {regimes[i] ?? 'RPPS'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <table>
        <thead>
          <tr><th>Cenário de averbação</th><th>TC RGPS</th><th>TC RPPS</th><th>TC total</th></tr>
        </thead>
        <tbody>
          {cenarios.map((c, i) => {
            const resumo = resumoPorRegime(c.periodos, corte);
            return (
              <tr key={i}>
                <td style={{ fontWeight: 500 }}>{c.rotulo}</td>
                <td>{resumo.rgps.tc}</td>
                <td>{resumo.rpps.tc}</td>
                <td style={{ fontWeight: 600, color: 'var(--azul-marinho)' }}>{resumo.total.tc}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {cenarios.some(c => c.avisos.length > 0) && (
        <div className="text-muted" style={{ fontSize: 11, marginTop: 8 }}>
          {cenarios.flatMap(c => c.avisos).map((a, i) => <p key={i}>⚠ {a}</p>)}
        </div>
      )}
    </div>
  );
}
