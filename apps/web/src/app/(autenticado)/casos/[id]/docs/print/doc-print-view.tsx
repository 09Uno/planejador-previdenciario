'use client';

import './print.css';
import {
  parseBR, fmtBR, fmtAMD, idadeAnos, idadeAMD,
  mesclarPeriodos, diasAte, diasParaAMD, tcAnos,
  avaliarRegras, pontosMinimos, VESPERA, EC103,
  type Periodo, type Sexo, type ResultadoCenario,
} from '@mfaa/prev-engine';

interface CasoDados {
  clienteNome: string;
  sexo: string;
  nascimento: string;
  status: string;
  periodosJson: string | null;
  competenciasJson: string | null;
}

interface CenarioComPremissas {
  rotulo: string;
  resultado: ResultadoCenario;
  premissas: { regra: string; selecionado?: boolean };
}

interface Props {
  caso: CasoDados;
  cenarios: CenarioComPremissas[];
  tipoDoc: string;
  cenarioIdx?: number;
}

export function DocPrintView({ caso, cenarios, tipoDoc, cenarioIdx }: Props) {
  const minuta = caso.status !== 'aprovado';

  if (tipoDoc === '1.0') return <Doc10 caso={caso} minuta={minuta} />;

  if (tipoDoc.endsWith('.0') && cenarioIdx !== undefined) {
    const c = cenarios[cenarioIdx];
    if (!c) return <p>Cenário não encontrado.</p>;
    return <DocX0 caso={caso} cenario={c} docNum={tipoDoc} minuta={minuta} />;
  }

  if (tipoDoc.endsWith('.1') && cenarioIdx !== undefined) {
    const c = cenarios[cenarioIdx];
    if (!c) return <p>Cenário não encontrado.</p>;
    return <DocX1 caso={caso} cenario={c} docNum={tipoDoc} minuta={minuta} />;
  }

  return <p>Tipo de documento não reconhecido.</p>;
}

// ========== Doc 1.0 — Contagem até 12/11/2019 ==========
function Doc10({ caso, minuta }: { caso: CasoDados; minuta: boolean }) {
  if (!caso.periodosJson) return <p>Sem períodos cadastrados.</p>;

  const periodos: { ini: string; fim: string; desc?: string }[] = JSON.parse(caso.periodosJson);
  const merged: Periodo[] = mesclarPeriodos(
    periodos.map(p => ({ ini: parseBR(p.ini)!, fim: parseBR(p.fim)!, desc: p.desc }))
  );

  const nasc = parseBR(caso.nascimento)!;
  const diasVesp = diasAte(merged, VESPERA);
  const tcVesp = diasParaAMD(diasVesp);
  const idadeVesp = idadeAMD(nasc, VESPERA);
  const pontosVesp = tcAnos(diasVesp) + idadeAnos(nasc, VESPERA);

  const av = avaliarRegras({ sexo: caso.sexo as Sexo, nasc, merged, hoje: VESPERA, continuaContribuindo: false });

  return (
    <div className="doc-print">
      {minuta && <div className="marca-dagua">MINUTA</div>}

      <div className="doc-header">
        <h1>Tempo de Contribuição até 12/11/2019</h1>
        <h2>Anterior à EC 103/2019 — Doc. 1.0</h2>
      </div>

      <dl className="doc-info">
        <dt>Nome</dt><dd>{caso.clienteNome}</dd>
        <dt>Sexo</dt><dd>{caso.sexo === 'M' ? 'Masculino' : 'Feminino'}</dd>
        <dt>Nascimento</dt><dd>{caso.nascimento}</dd>
        <dt>Espécie</dt><dd>{caso.sexo === 'M' ? '42' : '41'}</dd>
      </dl>

      <div className="doc-section">
        <h3>Períodos Informados</h3>
        <table>
          <thead>
            <tr><th>#</th><th>Início</th><th>Fim</th><th>Descrição</th></tr>
          </thead>
          <tbody>
            {periodos.map((p, i) => (
              <tr key={i}>
                <td>{i + 1}</td><td>{p.ini}</td><td>{p.fim}</td><td>{p.desc || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="doc-section">
        <h3>Períodos Considerados no Cálculo</h3>
        <table>
          <thead>
            <tr><th>#</th><th>Início</th><th>Fim</th><th>Dias</th></tr>
          </thead>
          <tbody>
            {merged.map((p, i) => {
              const dias = Math.round((Math.min(p.fim, VESPERA) - p.ini) / (86400000)) + 1;
              return p.ini <= VESPERA ? (
                <tr key={i}>
                  <td>{i + 1}</td>
                  <td>{fmtBR(p.ini)}</td>
                  <td>{fmtBR(Math.min(p.fim, VESPERA))}</td>
                  <td>{dias}</td>
                </tr>
              ) : null;
            })}
            <tr style={{ fontWeight: 'bold', background: '#e8edf5' }}>
              <td colSpan={3}>Total</td>
              <td>{diasVesp} dias = {fmtAMD(tcVesp)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="doc-section">
        <h3>Análise dos Dados</h3>
        <div className="analise-quadro">
          <dl>
            <dt>TC em 12/11/2019:</dt><dd>{fmtAMD(tcVesp)}</dd><br />
            <dt>Idade em 12/11/2019:</dt><dd>{idadeVesp.y}a {idadeVesp.m}m {idadeVesp.d}d</dd><br />
            <dt>Pontos em 12/11/2019:</dt><dd>{pontosVesp.toFixed(1)}</dd><br />
          </dl>
        </div>
      </div>

      <div className="rodape">
        PROTÓTIPO — uso interno, requer conferência do advogado
      </div>

      <div className="no-print" style={{ marginTop: 20, textAlign: 'center' }}>
        <button className="btn btn-primario" onClick={() => window.print()}>Imprimir</button>
        <button className="btn btn-secundario" onClick={() => window.history.back()} style={{ marginLeft: 8 }}>Voltar</button>
      </div>
    </div>
  );
}

// ========== Doc X.0 — Contagem do cenário ==========
function DocX0({ caso, cenario, docNum, minuta }: {
  caso: CasoDados; cenario: CenarioComPremissas; docNum: string; minuta: boolean;
}) {
  const r = cenario.resultado;
  if (!caso.periodosJson) return <p>Sem períodos.</p>;

  const periodos: { ini: string; fim: string; desc?: string }[] = JSON.parse(caso.periodosJson);

  return (
    <div className="doc-print">
      {minuta && <div className="marca-dagua">MINUTA</div>}

      <div className="doc-header">
        <h1>Contagem de Tempo de Contribuição — Doc. {docNum}</h1>
        <h2>{cenario.rotulo}</h2>
      </div>

      <dl className="doc-info">
        <dt>Nome</dt><dd>{caso.clienteNome}</dd>
        <dt>DIB</dt><dd>{r.dib || '—'}</dd>
        <dt>Sexo</dt><dd>{caso.sexo === 'M' ? 'Masculino' : 'Feminino'}</dd>
        <dt>Nascimento</dt><dd>{caso.nascimento}</dd>
      </dl>

      <div className="doc-section">
        <h3>Períodos Informados</h3>
        <table>
          <thead>
            <tr><th>#</th><th>Início</th><th>Fim</th><th>Descrição</th></tr>
          </thead>
          <tbody>
            {periodos.map((p, i) => (
              <tr key={i}>
                <td>{i + 1}</td><td>{p.ini}</td><td>{p.fim}</td><td>{p.desc || '—'}</td>
              </tr>
            ))}
            {r.mesesProjetados > 0 && (
              <tr style={{ fontStyle: 'italic', color: '#2563EB' }}>
                <td>{periodos.length + 1}</td>
                <td colSpan={2}>Projeção: {r.mesesProjetados} mês(es)</td>
                <td>a recolher {cenario.rotulo.includes('6 meses') ? 'a cada 6 meses' : 'sem parar'}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="doc-section">
        <h3>Resumo</h3>
        <div className="analise-quadro">
          <dl>
            <dt>TC na DIB:</dt><dd>{r.tcNaDIB}</dd><br />
            <dt>Idade na DIB:</dt><dd>{r.idadeNaDIB?.toFixed(1)} anos</dd><br />
            <dt>Carência:</dt><dd>{r.carenciaNaDIB} contribuições</dd><br />
          </dl>
        </div>
      </div>

      <div className="rodape">
        PROTÓTIPO — uso interno, requer conferência do advogado
      </div>

      <div className="no-print" style={{ marginTop: 20, textAlign: 'center' }}>
        <button className="btn btn-primario" onClick={() => window.print()}>Imprimir</button>
        <button className="btn btn-secundario" onClick={() => window.history.back()} style={{ marginLeft: 8 }}>Voltar</button>
      </div>
    </div>
  );
}

// ========== Doc X.1 — Valor da Aposentadoria ==========
function DocX1({ caso, cenario, docNum, minuta }: {
  caso: CasoDados; cenario: CenarioComPremissas; docNum: string; minuta: boolean;
}) {
  const r = cenario.resultado;
  const rmi = r.rmi;
  if (!rmi) return <p>Sem dados de RMI para este cenário.</p>;

  const fmtMoeda = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="doc-print">
      {minuta && <div className="marca-dagua">MINUTA</div>}

      <div className="doc-header">
        <h1>Valor da Aposentadoria — Doc. {docNum}</h1>
        <h2>{cenario.rotulo}</h2>
      </div>

      <dl className="doc-info">
        <dt>Nome</dt><dd>{caso.clienteNome}</dd>
        <dt>DIB</dt><dd>{r.dib || '—'}</dd>
        <dt>Sexo</dt><dd>{caso.sexo === 'M' ? 'Masculino' : 'Feminino'}</dd>
        <dt>Nascimento</dt><dd>{caso.nascimento}</dd>
      </dl>

      <div className="doc-section">
        <h3>Cálculo da R.M.I.</h3>
        <div className="calculo-bloco">
          <dl>
            <dt>Parcelas no PBC:</dt><dd>{rmi.parcelasPBC}</dd><br />
            <dt>Idade na DIB:</dt><dd>{r.idadeNaDIB?.toFixed(1)} anos</dd><br />
            <dt>TC considerado:</dt><dd>{r.tcNaDIB}</dd><br />
            <dt>Descartes (art. 26, §6º):</dt><dd>{rmi.descartes}</dd><br />
            <dt>Divisor:</dt><dd>{rmi.divisor}</dd><br />
            <dt>Média:</dt><dd>R$ {fmtMoeda(rmi.media)}</dd><br />
            <dt>Salário de benefício:</dt><dd>R$ {fmtMoeda(rmi.salarioBeneficio)}</dd><br />
            {rmi.coeficiente != null && <><dt>Coeficiente:</dt><dd>{(rmi.coeficiente * 100).toFixed(0)}%</dd><br /></>}
            {rmi.fator != null && <><dt>Fator Previdenciário:</dt><dd>{rmi.fator.toFixed(4)}</dd><br /></>}
            <dt className="rmi-final">RMI:</dt><dd className="rmi-final">R$ {fmtMoeda(rmi.rmi)}</dd><br />
          </dl>
          {rmi.obs.length > 0 && (
            <ul style={{ fontSize: '9pt', color: '#555', marginTop: 8 }}>
              {rmi.obs.map((o, i) => <li key={i}>{o}</li>)}
            </ul>
          )}
        </div>
        <p style={{ fontSize: '9pt', color: '#666', marginTop: 8 }}>
          Nota: A tabela detalhada de salários com índices de atualização e marcação de descartes
          será incluída quando os salários forem processados pelo motor com a tabela de fatores completa.
        </p>
      </div>

      <div className="rodape">
        PROTÓTIPO — uso interno, requer conferência do advogado
      </div>

      <div className="no-print" style={{ marginTop: 20, textAlign: 'center' }}>
        <button className="btn btn-primario" onClick={() => window.print()}>Imprimir</button>
        <button className="btn btn-secundario" onClick={() => window.history.back()} style={{ marginLeft: 8 }}>Voltar</button>
      </div>
    </div>
  );
}
