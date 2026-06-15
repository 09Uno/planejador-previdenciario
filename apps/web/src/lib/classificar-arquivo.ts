/**
 * Classifica um documento do caso pela heurística no texto da 1ª página.
 * Ordem importa: padrões mais específicos primeiro.
 */

type Classificacao =
  | 'cnis' | 'ctps' | 'ppp' | 'ctsm' | 'ctc'
  | 'carta-concessao' | 'laudo-ltcat' | 'procuracao' | 'outro';

const REGRAS: { cls: Classificacao; rx: RegExp }[] = [
  { cls: 'cnis',            rx: /CNIS|Cadastro Nacional de Informa|Extrato Previdenci|DATAPREV/i },
  { cls: 'ppp',             rx: /PPP|Perfil Profissiogr[áa]fico/i },
  { cls: 'ctsm',            rx: /CTSM|Certificado.{0,20}Tempo.{0,20}Servi[çc]o Militar|Ex[ée]rcito|Marinha|Aeron[áa]utica/i },
  { cls: 'ctc',             rx: /CTC|Certid[ãa]o de Tempo de Contribui/i },
  { cls: 'carta-concessao', rx: /Carta de Concess[ãa]o|Concess[ãa]o de Benef[íi]cio|Despacho de Benef/i },
  { cls: 'laudo-ltcat',     rx: /LTCAT|Laudo T[ée]cnico.{0,30}Condi[çc][õo]es Ambientais/i },
  { cls: 'ctps',            rx: /CTPS|Carteira de Trabalho|Carteira Profissional/i },
  { cls: 'procuracao',      rx: /Procura[çc][ãa]o|outorgante|outorgado/i },
];

export function classificarArquivo(textoPrimeiraPagina: string): Classificacao {
  for (const { cls, rx } of REGRAS) {
    if (rx.test(textoPrimeiraPagina)) return cls;
  }
  return 'outro';
}

export const LABEL_CLASSIFICACAO: Record<string, string> = {
  'cnis': 'CNIS',
  'ctps': 'CTPS',
  'ppp': 'PPP',
  'ctsm': 'CTSM (Militar)',
  'ctc': 'CTC',
  'carta-concessao': 'Carta de Concessão',
  'laudo-ltcat': 'Laudo/LTCAT',
  'procuracao': 'Procuração',
  'outro': 'Outro',
};

export const CLASSIFICACOES = Object.keys(LABEL_CLASSIFICACAO);
