/**
 * Transições de status controladas por papel.
 * assistente: pode avançar até 'minutas'
 * advogado/socio: pode revisar e aprovar
 * admin: pode tudo
 */

type Papel = 'assistente' | 'advogado' | 'socio' | 'admin';
type Status = 'coleta' | 'conferencia' | 'auditoria' | 'cenarios' | 'minutas' | 'revisao' | 'aprovado' | 'entregue';

const TRANSICOES: Record<Status, { proximo: Status[]; papeis: Papel[] }> = {
  coleta:       { proximo: ['conferencia'], papeis: ['assistente', 'advogado', 'socio', 'admin'] },
  conferencia:  { proximo: ['auditoria'], papeis: ['assistente', 'advogado', 'socio', 'admin'] },
  auditoria:    { proximo: ['cenarios'], papeis: ['assistente', 'advogado', 'socio', 'admin'] },
  cenarios:     { proximo: ['minutas'], papeis: ['assistente', 'advogado', 'socio', 'admin'] },
  minutas:      { proximo: ['revisao'], papeis: ['advogado', 'socio', 'admin'] },
  revisao:      { proximo: ['aprovado', 'minutas'], papeis: ['socio', 'admin'] },
  aprovado:     { proximo: ['entregue'], papeis: ['advogado', 'socio', 'admin'] },
  entregue:     { proximo: [], papeis: [] },
};

export function podeTransitar(statusAtual: string, statusNovo: string, papel: string): boolean {
  const t = TRANSICOES[statusAtual as Status];
  if (!t) return false;
  if (!t.proximo.includes(statusNovo as Status)) return false;
  if (!t.papeis.includes(papel as Papel) && papel !== 'admin') return false;
  return true;
}

export function proximosStatus(statusAtual: string, papel: string): string[] {
  const t = TRANSICOES[statusAtual as Status];
  if (!t) return [];
  if (papel === 'admin') return t.proximo;
  if (!t.papeis.includes(papel as Papel)) return [];
  return t.proximo;
}

export const LABEL_STATUS: Record<string, string> = {
  coleta: 'Coleta',
  conferencia: 'Conferência',
  auditoria: 'Auditoria',
  cenarios: 'Cenários',
  minutas: 'Minutas',
  revisao: 'Revisão',
  aprovado: 'Aprovado',
  entregue: 'Entregue',
};
