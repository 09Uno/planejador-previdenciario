'use client';

import { useState } from 'react';
import { CNISTab } from './cnis-tab';
import { AuditoriaTab } from './auditoria-tab';
import { CenariosTab } from './cenarios-tab';
import { DocumentosTab } from './documentos-tab';
import { ArquivosTab } from './arquivos-tab';
import { DadosTab } from './dados-tab';

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

interface CenarioSalvo {
  rotulo: string;
  premissas: { selecionado?: boolean };
}

const ABAS = ['Dados', 'CNIS', 'Auditoria', 'Cenários', 'Arquivos', 'Documentos'] as const;

export function CasoTabs({ caso, cenariosSalvos, papel }: {
  caso: CasoResumo;
  cenariosSalvos: CenarioSalvo[];
  papel: string;
}) {
  const [aba, setAba] = useState<typeof ABAS[number]>('Dados');

  return (
    <>
      <div className="tabs">
        {ABAS.map(a => (
          <button
            key={a}
            className={`tab ${a === aba ? 'ativa' : ''}`}
            onClick={() => setAba(a)}
          >
            {a}
          </button>
        ))}
      </div>

      {aba === 'Dados' && <DadosTab caso={caso} papel={papel} />}

      {aba === 'CNIS' && <CNISTab caso={caso} />}

      {aba === 'Auditoria' && <AuditoriaTab caso={caso} />}

      {aba === 'Cenários' && <CenariosTab caso={caso} />}

      {aba === 'Arquivos' && <ArquivosTab caso={caso} />}

      {aba === 'Documentos' && <DocumentosTab caso={caso} cenarios={cenariosSalvos} />}
    </>
  );
}
