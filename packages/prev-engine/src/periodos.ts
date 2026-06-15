import { DAY, addDays, tcAnos } from './dates.js';
import type { Periodo } from './types.js';

/** Une sobreposições (remove concomitância). */
export function mesclarPeriodos(periodos: Periodo[]): Periodo[] {
  const ps = periodos
    .filter(p => p.ini != null && p.fim != null && p.fim >= p.ini)
    .slice().sort((a, b) => a.ini - b.ini);
  const out: Periodo[] = [];
  for (const p of ps) {
    const last = out[out.length - 1];
    if (last && p.ini <= addDays(last.fim, 1) && last.tipo === p.tipo) {
      if (p.fim > last.fim) last.fim = p.fim;
    } else out.push({ ini: p.ini, fim: p.fim, tipo: p.tipo, grauEspecial: p.grauEspecial, desc: p.desc });
  }
  return out;
}

/** Dias de contribuição até a data de corte (inclusive). Períodos já mesclados. */
export function diasAte(merged: Periodo[], corte: number): number {
  let dias = 0;
  for (const p of merged) {
    if (p.ini > corte) break;
    const fim = Math.min(p.fim, corte);
    dias += Math.round((fim - p.ini) / DAY) + 1;
  }
  return dias;
}

export function ultimoFim(merged: Periodo[]): number | null {
  return merged.length ? merged[merged.length - 1].fim : null;
}

/** Dias na data futura t, projetando contribuição contínua a partir de `base`. */
export function diasProjetados(merged: Periodo[], base: number, t: number): number {
  const atuais = diasAte(merged, base);
  if (t <= base) return diasAte(merged, t);
  return atuais + Math.round((t - base) / DAY);
}

export { tcAnos };
