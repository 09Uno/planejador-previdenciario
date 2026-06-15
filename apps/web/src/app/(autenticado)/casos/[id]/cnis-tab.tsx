'use client';

import { useState } from 'react';
import { UploadCNIS } from './upload-cnis';
import { ConferenciaCNIS } from './conferencia-cnis';
import { EntradaManual } from './entrada-manual';
import { confirmarCNISAction } from './cnis-actions';
import { parseBR, mesclarPeriodos, contarCarencia } from '@mfaa/prev-engine';
import type { VinculoCNIS, CompetenciaCNIS, ResultadoCNIS, Periodo } from '@mfaa/prev-engine';

interface CasoResumo {
  id: string;
  clienteNome: string;
  sexo: string;
  nascimento: string;
  status: string;
  periodosJson: string | null;
  competenciasJson: string | null;
  cnisJson: string | null;
}

export interface VinculoEditavel {
  seq: number;
  origem: string;
  ini: string;
  fim: string;
  tipo: string;
  indicadores: string[];
}

export interface CompetenciaEditavel {
  comp: string;
  valor: number;
}

type Modo = 'escolher' | 'pdf' | 'manual' | 'conferencia';

export function CNISTab({ caso }: { caso: CasoResumo }) {
  const [modo, setModo] = useState<Modo>(caso.cnisJson || caso.periodosJson ? 'conferencia' : 'escolher');
  const [vinculos, setVinculos] = useState<VinculoEditavel[]>(() => carregarVinculos(caso));
  const [competencias, setCompetencias] = useState<CompetenciaEditavel[]>(() => carregarCompetencias(caso));
  const [avisos, setAvisos] = useState<string[]>([]);
  const [cnisJsonBruto, setCnisJsonBruto] = useState<string | null>(caso.cnisJson);
  const [nomeDetectado, setNomeDetectado] = useState<string | null>(null);
  const [nascDetectado, setNascDetectado] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState<{ tipo: 'sucesso' | 'erro'; texto: string } | null>(null);

  const jaConfirmado = caso.status !== 'coleta' && caso.status !== 'conferencia';

  function onCNISParsed(resultado: ResultadoCNIS) {
    setCnisJsonBruto(JSON.stringify(resultado));
    setAvisos(resultado.avisos);
    setNomeDetectado(resultado.nome);
    setNascDetectado(resultado.nascimento);

    setVinculos(resultado.vinculos.map(v => ({
      seq: v.seq,
      origem: v.origem,
      ini: v.ini || '',
      fim: v.fim || '',
      tipo: v.tipo,
      indicadores: v.indicadores,
    })));

    setCompetencias(resultado.competencias.map(c => ({
      comp: c.comp,
      valor: c.valor,
    })));

    setModo('conferencia');
  }

  function onEntradaManual(vs: VinculoEditavel[], cs: CompetenciaEditavel[]) {
    setVinculos(vs);
    setCompetencias(cs);
    setCnisJsonBruto(null);
    setAvisos([]);
    setModo('conferencia');
  }

  async function confirmar() {
    setSalvando(true);
    setMensagem(null);
    try {
      // Validar que há pelo menos um período com datas
      const periodosValidos = vinculos.filter(v => v.ini && v.fim);
      if (periodosValidos.length === 0) {
        setMensagem({ tipo: 'erro', texto: 'Informe ao menos um período com data de início e fim.' });
        setSalvando(false);
        return;
      }

      const periodosJson = JSON.stringify(periodosValidos.map(v => ({
        ini: v.ini,
        fim: v.fim,
        desc: v.origem,
        tipo: v.tipo === 'CI' ? 'CI' : 'Empregado',
      })));

      const competenciasJson = JSON.stringify(competencias.map(c => ({
        comp: c.comp,
        valor: c.valor,
      })));

      // Calcular carência automaticamente (empregados: cada mês civil conta)
      const periodosEmprego: Periodo[] = periodosValidos
        .filter(v => v.tipo !== 'CI')
        .map(v => ({ ini: parseBR(v.ini)!, fim: parseBR(v.fim)! }));
      const carenciaCalc = contarCarencia({
        vinculosEmprego: mesclarPeriodos(periodosEmprego),
      });

      const result = await confirmarCNISAction(caso.id, {
        cnisJson: cnisJsonBruto,
        periodosJson,
        competenciasJson,
        nascimento: nascDetectado || undefined,
        clienteNome: nomeDetectado || undefined,
        carenciaAtual: carenciaCalc.total,
      });

      if (result.ok) {
        setMensagem({ tipo: 'sucesso', texto: 'Dados confirmados — status alterado para auditoria. Recarregue a página para ver as mudanças.' });
      }
    } catch {
      setMensagem({ tipo: 'erro', texto: 'Erro ao salvar. Tente novamente.' });
    }
    setSalvando(false);
  }

  if (jaConfirmado && modo === 'conferencia') {
    return (
      <div>
        <h3 style={{ marginBottom: 16, color: 'var(--azul-marinho)' }}>CNIS — Dados confirmados</h3>
        <div className="msg msg-sucesso">Dados já confirmados (status: {caso.status}). Para editar, altere o status do caso para "coleta".</div>
        <ConferenciaCNIS
          vinculos={vinculos}
          competencias={competencias}
          avisos={avisos}
          somenteLeitura
          onVinculosChange={() => {}}
          onCompetenciasChange={() => {}}
        />
      </div>
    );
  }

  return (
    <div>
      <h3 style={{ marginBottom: 16, color: 'var(--azul-marinho)' }}>CNIS — Importação e Conferência</h3>

      {mensagem && (
        <div className={`msg ${mensagem.tipo === 'sucesso' ? 'msg-sucesso' : 'msg-erro'}`}>
          {mensagem.texto}
        </div>
      )}

      {modo === 'escolher' && (
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <p style={{ marginBottom: 20, color: 'var(--texto-secundario)' }}>
            Escolha como inserir os dados do CNIS:
          </p>
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center' }}>
            <button className="btn btn-primario" onClick={() => setModo('pdf')}>
              Upload de PDF do CNIS
            </button>
            <button className="btn btn-secundario" onClick={() => setModo('manual')}>
              Entrada manual (colar texto)
            </button>
          </div>
        </div>
      )}

      {modo === 'pdf' && (
        <>
          <UploadCNIS onParsed={onCNISParsed} />
          <button className="btn btn-secundario mt-4" onClick={() => setModo('escolher')}>
            Voltar
          </button>
        </>
      )}

      {modo === 'manual' && (
        <>
          <EntradaManual onConfirmar={onEntradaManual} />
          <button className="btn btn-secundario mt-4" onClick={() => setModo('escolher')}>
            Voltar
          </button>
        </>
      )}

      {modo === 'conferencia' && (
        <>
          {(nomeDetectado || nascDetectado) && (
            <div className="card" style={{ marginBottom: 16 }}>
              <h4 style={{ marginBottom: 8, color: 'var(--azul-marinho)' }}>Identificação detectada</h4>
              {nomeDetectado && <p><strong>Nome:</strong> {nomeDetectado}</p>}
              {nascDetectado && <p><strong>Nascimento:</strong> {nascDetectado}</p>}
              <p className="text-muted mt-4">Ao confirmar, estes dados serão atualizados no caso.</p>
            </div>
          )}

          <ConferenciaCNIS
            vinculos={vinculos}
            competencias={competencias}
            avisos={avisos}
            onVinculosChange={setVinculos}
            onCompetenciasChange={setCompetencias}
          />

          <div className="toolbar mt-4">
            <button
              className="btn btn-primario"
              onClick={confirmar}
              disabled={salvando}
            >
              {salvando ? 'Confirmando...' : 'Confirmar dados'}
            </button>
            <button className="btn btn-secundario" onClick={() => setModo('escolher')}>
              Voltar
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function carregarVinculos(caso: CasoResumo): VinculoEditavel[] {
  if (caso.periodosJson) {
    try {
      const ps = JSON.parse(caso.periodosJson);
      return ps.map((p: { ini: string; fim: string; desc?: string; tipo?: string }, i: number) => ({
        seq: i + 1,
        origem: p.desc || '',
        ini: p.ini,
        fim: p.fim,
        tipo: p.tipo || 'Empregado',
        indicadores: [],
      }));
    } catch { /* fallback */ }
  }
  return [];
}

function carregarCompetencias(caso: CasoResumo): CompetenciaEditavel[] {
  if (caso.competenciasJson) {
    try {
      return JSON.parse(caso.competenciasJson);
    } catch { /* fallback */ }
  }
  return [];
}
