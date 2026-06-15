// ---------- datas (UTC, dias corridos) ----------
export const DAY = 86400000;

export function dt(d: number, m: number, y: number): number { return Date.UTC(y, m - 1, d); }

export function parseBR(s: string): number | null {
  const m = String(s).trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const t = dt(+m[1], +m[2], +m[3]);
  const c = new Date(t);
  if (c.getUTCDate() !== +m[1] || c.getUTCMonth() !== +m[2] - 1) return null;
  return t;
}

export function fmtBR(t: number): string {
  const d = new Date(t);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
}

export function addDays(t: number, n: number): number { return t + n * DAY; }
export function yearOf(t: number): number { return new Date(t).getUTCFullYear(); }

/** idade em anos fracionários na data t */
export function idadeAnos(nasc: number, t: number): number { return (t - nasc) / (365.25 * DAY); }

export interface AMD { y: number; m: number; d: number; dias?: number }

/** idade exata em anos/meses/dias (calendário) */
export function idadeAMD(nasc: number, t: number): AMD {
  const a = new Date(nasc), b = new Date(t);
  let y = b.getUTCFullYear() - a.getUTCFullYear();
  let m = b.getUTCMonth() - a.getUTCMonth();
  let d = b.getUTCDate() - a.getUTCDate();
  if (d < 0) { m--; d += 30; }
  if (m < 0) { y--; m += 12; }
  return { y, m, d };
}

/** data em que completa X anos (aceita meio ano: fração ≥ 0,49 = +6 meses) */
export function dataAoCompletar(nasc: number, anos: number): number {
  const inteiro = Math.floor(anos);
  const frac = anos - inteiro;
  const a = new Date(nasc);
  const y = a.getUTCFullYear() + inteiro, m = a.getUTCMonth() + (frac >= 0.49 ? 6 : 0), d = a.getUTCDate();
  const ultimo = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return Date.UTC(y, m, Math.min(d, ultimo));
}

export function atingiuIdade(nasc: number, t: number, anos: number): boolean {
  return t >= dataAoCompletar(nasc, anos);
}

export function diasParaAMD(dias: number): AMD {
  const y = Math.floor(dias / 365);
  const r = dias % 365;
  return { y, m: Math.floor(r / 30), d: r % 30, dias };
}

export function fmtAMD(o: AMD): string { return `${o.y} ano(s), ${o.m} mês(es) e ${o.d} dia(s)`; }
export function tcAnos(dias: number): number { return dias / 365; }

/** competência "MM/AAAA" → chave ordenável AAAAMM */
export function compKey(comp: string): number {
  const [m, a] = comp.split('/');
  return +a * 100 + +m;
}
