// ===================================================================
// CASOS HÍBRIDOS RPPS+RGPS — averbação via CTC
// Simula transferência de períodos entre regimes para "dupla opinião":
// grade RGPS + grade RPPS, com cenários de averbação.
// Fonte: art. 201 §9º CF, Lei 6.226/75, Portaria MPS 154/2008.
// ===================================================================
import { mesclarPeriodos, diasAte } from './periodos.js';
import { DAY, parseBR, fmtBR, fmtAMD, diasParaAMD, tcAnos } from './dates.js';
import type { Periodo, Sexo } from './types.js';

export type Regime = 'RGPS' | 'RPPS';

export interface PeriodoHibrido extends Periodo {
  regime: Regime;
}

/**
 * Separa períodos por regime.
 */
export function separarPorRegime(periodos: PeriodoHibrido[]): {
  rgps: Periodo[];
  rpps: Periodo[];
} {
  return {
    rgps: periodos.filter(p => p.regime === 'RGPS').map(({ regime, ...p }) => p),
    rpps: periodos.filter(p => p.regime === 'RPPS').map(({ regime, ...p }) => p),
  };
}

/**
 * Simula averbação via CTC: transfere períodos de um regime para outro.
 * - Vedada dupla contagem: período averbado sai do regime de origem.
 * - Tempo especial em CTC: apenas registra alerta, sem converter
 *   (Nota Técnica 792 STF).
 *
 * @param periodos Todos os períodos do segurado com regime marcado
 * @param periodosAverbar Índices dos períodos a averbar
 * @param destino Regime de destino ('RGPS' ou 'RPPS')
 * @returns Períodos reorganizados + avisos
 */
export function simularCTC(
  periodos: PeriodoHibrido[],
  periodosAverbar: number[],
  destino: Regime,
): {
  periodosResultantes: PeriodoHibrido[];
  avisos: string[];
} {
  const avisos: string[] = [];
  const resultado = periodos.map((p, i) => {
    if (periodosAverbar.includes(i)) {
      if (p.regime === destino) {
        avisos.push(`Período ${i + 1} já pertence ao regime ${destino} — ignorado.`);
        return p;
      }
      if (p.tipo === 'especial') {
        avisos.push(
          `Período ${i + 1} (especial) averbado como tempo comum no ${destino}. ` +
          `Conversão de tempo especial via CTC não é aplicável (Nota Técnica 792, STF).`
        );
      }
      return { ...p, regime: destino, tipo: p.tipo === 'especial' ? 'normal' as const : p.tipo };
    }
    return p;
  });

  return { periodosResultantes: resultado, avisos };
}

/**
 * Resumo de contagem por regime após simulação.
 */
export function resumoPorRegime(periodos: PeriodoHibrido[], corte: number): {
  rgps: { dias: number; tc: string };
  rpps: { dias: number; tc: string };
  total: { dias: number; tc: string };
} {
  const { rgps, rpps } = separarPorRegime(periodos);
  const mergedRGPS = mesclarPeriodos(rgps);
  const mergedRPPS = mesclarPeriodos(rpps);

  const diasRGPS = diasAte(mergedRGPS, corte);
  const diasRPPS = diasAte(mergedRPPS, corte);
  const diasTotal = diasRGPS + diasRPPS;

  return {
    rgps: { dias: diasRGPS, tc: fmtAMD(diasParaAMD(diasRGPS)) },
    rpps: { dias: diasRPPS, tc: fmtAMD(diasParaAMD(diasRPPS)) },
    total: { dias: diasTotal, tc: fmtAMD(diasParaAMD(diasTotal)) },
  };
}

/**
 * Gera cenários de averbação para a "dupla opinião":
 * - Sem averbação (cada regime isolado)
 * - CTC do RGPS para o RPPS (tudo no RPPS)
 * - CTC do RPPS para o RGPS (tudo no RGPS)
 */
export function cenariosAverbacao(periodos: PeriodoHibrido[]): {
  rotulo: string;
  periodos: PeriodoHibrido[];
  avisos: string[];
}[] {
  const indicesRGPS = periodos.map((p, i) => p.regime === 'RGPS' ? i : -1).filter(i => i >= 0);
  const indicesRPPS = periodos.map((p, i) => p.regime === 'RPPS' ? i : -1).filter(i => i >= 0);

  const cenarios = [
    {
      rotulo: 'Sem averbação (regimes isolados)',
      periodos: [...periodos],
      avisos: [] as string[],
    },
  ];

  if (indicesRGPS.length > 0) {
    const { periodosResultantes, avisos } = simularCTC(periodos, indicesRGPS, 'RPPS');
    cenarios.push({
      rotulo: 'CTC do INSS para o Estado (tudo no RPPS)',
      periodos: periodosResultantes,
      avisos,
    });
  }

  if (indicesRPPS.length > 0) {
    const { periodosResultantes, avisos } = simularCTC(periodos, indicesRPPS, 'RGPS');
    cenarios.push({
      rotulo: 'CTC do Estado para o INSS (tudo no RGPS)',
      periodos: periodosResultantes,
      avisos,
    });
  }

  return cenarios;
}
