'use client';

import Link from 'next/link';
import { ResumoAtendimentoCard } from './resumo-atendimento-card';

interface CasoResumo {
  id: string;
  clienteNome: string;
  status: string;
  periodosJson: string | null;
}

interface CenarioSalvo {
  rotulo: string;
  premissas: { selecionado?: boolean };
}

export function DocumentosTab({ caso, cenarios }: { caso: CasoResumo; cenarios: CenarioSalvo[] }) {
  const selecionados = cenarios
    .map((c, i) => ({ ...c, idx: i }))
    .filter(c => c.premissas.selecionado);

  const basePath = `/casos/${caso.id}/docs/print`;

  return (
    <div>
      <h3 style={{ marginBottom: 16, color: 'var(--azul-marinho)' }}>Documentos</h3>

      {!caso.periodosJson ? (
        <div className="msg msg-alerta">Confirme os dados do CNIS antes de gerar documentos.</div>
      ) : (
        <>
          {/* Doc 1.0 */}
          <div className="card" style={{ marginBottom: 16 }}>
            <h4 style={{ marginBottom: 8, color: 'var(--azul-marinho)' }}>Doc. 1.0 — Contagem até 12/11/2019</h4>
            <p className="text-muted" style={{ marginBottom: 12 }}>
              Contagem de tempo de contribuição anterior à EC 103/2019.
            </p>
            <Link
              href={`${basePath}?doc=1.0`}
              target="_blank"
              className="btn btn-primario"
              style={{ textDecoration: 'none' }}
            >
              Abrir para impressão
            </Link>
          </div>

          {/* Docs de cenários */}
          {selecionados.length === 0 && cenarios.length === 0 ? (
            <div className="msg msg-alerta">
              Gere cenários na aba Cenários e selecione os que deseja incluir nos documentos.
            </div>
          ) : selecionados.length === 0 ? (
            <div className="msg msg-alerta">
              Nenhum cenário selecionado para entrega. Marque cenários na aba Cenários.
            </div>
          ) : (
            selecionados.map((c, docIdx) => {
              const docNum = docIdx + 2;
              return (
                <div key={c.idx} className="card" style={{ marginBottom: 16 }}>
                  <h4 style={{ marginBottom: 4, color: 'var(--azul-marinho)' }}>
                    Doc. {docNum}.0 / {docNum}.1 — {c.rotulo}
                  </h4>
                  <p className="text-muted" style={{ marginBottom: 12 }}>
                    Contagem do cenário e valor da aposentadoria.
                  </p>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Link
                      href={`${basePath}?doc=${docNum}.0&cenarioIdx=${c.idx}`}
                      target="_blank"
                      className="btn btn-secundario"
                      style={{ textDecoration: 'none' }}
                    >
                      Doc {docNum}.0 (Contagem)
                    </Link>
                    <Link
                      href={`${basePath}?doc=${docNum}.1&cenarioIdx=${c.idx}`}
                      target="_blank"
                      className="btn btn-secundario"
                      style={{ textDecoration: 'none' }}
                    >
                      Doc {docNum}.1 (RMI)
                    </Link>
                  </div>
                </div>
              );
            })
          )}

          {/* Parecer .docx */}
          {cenarios.length > 0 && (
            <div className="card" style={{ marginBottom: 16 }}>
              <h4 style={{ marginBottom: 8, color: 'var(--azul-marinho)' }}>Parecer Previdenciário (.docx)</h4>
              <p className="text-muted" style={{ marginBottom: 12 }}>
                Parecer completo no padrão do escritório com todas as seções:
                preâmbulo, requisitos, caso concreto, projeções, ROI, pendências e conclusão.
                {caso.status !== 'aprovado' && ' Marca MINUTA incluída.'}
              </p>
              <a
                href={`/api/casos/${caso.id}/parecer-docx`}
                className="btn btn-primario"
                style={{ textDecoration: 'none' }}
                download
              >
                Gerar parecer (minuta)
              </a>
            </div>
          )}

          {/* ROI xlsx */}
          {cenarios.length > 0 && (
            <div className="card" style={{ marginBottom: 16 }}>
              <h4 style={{ marginBottom: 8, color: 'var(--azul-marinho)' }}>Planilha ROI</h4>
              <p className="text-muted" style={{ marginBottom: 12 }}>
                Planilha Excel com comparativo de ROI de todos os cenários salvos.
              </p>
              <a
                href={`/api/casos/${caso.id}/roi-xlsx`}
                className="btn btn-primario"
                style={{ textDecoration: 'none' }}
                download
              >
                Baixar ROI.xlsx
              </a>
            </div>
          )}

          {/* Resumo de atendimento (e-mail do cliente) */}
          <ResumoAtendimentoCard casoId={caso.id} />
        </>
      )}
    </div>
  );
}
