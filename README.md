# Planejador Previdenciário RGPS

> **Para usar agora:** abra o arquivo `planejador.html` (raiz do projeto) com duplo clique — versão completa em arquivo único, com importação de CNIS em PDF, motor de cálculo e minuta de parecer. A estrutura `src/` contém o mesmo código separado em módulos, para evolução do projeto (Lovable/SaaS).

Protótipo de sistema para automatizar a elaboração de pareceres previdenciários com base em cálculos determinísticos e auditáveis.

## Estrutura do Projeto

```
projeto/
├── src/
│   ├── core/
│   │   ├── calculation-engine.js        # Motor de cálculo previdenciário
│   │   └── cnis-parser.js               # Leitor do CNIS (PDF do Meu INSS)
│   ├── document/
│   │   └── [geradores de documentos]
│   ├── ui/
│   │   ├── index.html                   # Página principal
│   │   ├── styles.css                   # Estilos
│   │   └── app.js                       # Lógica da interface
│   └── utils/
│       └── document-helpers.js          # Utilitários para documentos
├── tests/
│   └── calculation-engine.test.js       # Testes do motor
├── docs/
│   └── README.md                        # Documentação
├── package.json
└── .gitignore
```

## Sobre o Projeto

### Objetivo
Automatizar a elaboração de pareceres previdenciários do escritório Machado Filgueiras, mantendo total controle sobre a auditoria dos cálculos.

### Premissa Central
**Todo número que aparece no parecer (tempo de contribuição, datas, RMI) deve sair de um motor determinístico.**

- ✅ Motor de cálculo: 100% auditável
- ✅ Extração de dados: IA auxiliar (jamais determinante)
- ✅ Redação: Padrão do escritório com IA

### Regras Implementadas

#### Direito Adquirido (pré-EC 103/2019)
- Aposentadoria por tempo de contribuição integral
- Requisitos: 35 anos (H) / 30 anos (M)
- Fundamento: Art. 201, §7º, I CF

#### Transições (pós-EC 103/2019)
- **Art. 15**: Pontos progressivos (96/106 para homem, 86/100 para mulher)
- **Art. 16**: Idade progressiva (61-65 anos para homem, 56-62 para mulher)
- **Art. 17**: Pedágio de 50% (para quem faltava até 2 anos)
- **Art. 18**: Aposentadoria por idade (65M/62F com 15 anos de TC)
- **Art. 20**: Pedágio de 100% (para quem faltava 2-5 anos)

#### Cálculo de RMI
- **Media 80**: 80% maiores salários (pré-reforma)
- **Media 100**: 100% com descarte otimizado (art. 26, §6º)
- **Coeficiente**: 60% + 2% por ano excedente
- **Fator Previdenciário**: Fórmula (Tc × 0.31 / Es) × (1 + (Id + Tc × 0.31) / 100)

## Como Usar

### Requisitos
- Node.js 14+
- npm ou yarn

### Instalação
```bash
npm install
```

### Executar Testes
```bash
npm test
```

### Executar Servidor de Desenvolvimento
```bash
npm run dev
# Acesse http://localhost:8080
```

## Fluxo de Uso

1. **Entrada**: Cadastro do caso + upload de documentos (CNIS, CTPS, PPP)
2. **Extração**: IA extrai dados estruturados
3. **Conferência**: Revisor valida dados antes de calcular
4. **Análise**: Motor calcula todas as regras e cenários
5. **Parecer**: Geração automática do documento Word
6. **Revisão**: Advogado revisa, ajusta e assina

## Estrutura de Dados

### Caso (Context)
```javascript
{
  sexo: 'M' | 'F',           // Gênero
  nasc: timestamp,           // Data de nascimento (UTC)
  merged: [...],             // Períodos consolidados sem sobreposição
  hoje: timestamp,           // Data-base da análise
  continuaContribuindo: bool // Se contribui até data-base
}
```

### Período
```javascript
{
  ini: timestamp,            // Início (data UTC)
  fim: timestamp,            // Fim (data UTC)
  desc: string               // Descrição opcional
}
```

### Regra (Resultado)
```javascript
{
  id: string,                // Identificador único
  nome: string,              // Nome descritivo
  fundamento: string,        // Base legal
  cumprida: bool,            // Se atende requisitos em hoje
  data: timestamp,           // Data de implemento (primeiro dia que cumpre)
  detalhe: string,           // Descrição detalhada
  calc: string               // Tipo de cálculo de RMI
}
```

## Parâmetros (2026)

- **Teto RGPS**: R$ 8.475,55
- **Salário Mínimo**: R$ 1.621,00
- **Divisor Mínimo**: 108 (Lei 14.331/22)
- **Marcos Legais**:
  - Véspera EC 103: 12/11/2019
  - EC 103 vigência: 13/11/2019

## Testes

O projeto inclui suite de testes que validam:
- ✅ Parsing e formatação de datas
- ✅ Mesclagem de períodos (concomitância)
- ✅ Contagem de tempo de contribuição
- ✅ Requisitos por regra
- ✅ Cálculo de RMI
- ✅ Casos de referência (pareceres históricos)

Rode com: `npm test`

## Avisos Importantes

⚠️ **Protótipo em desenvolvimento**
- Conferir todos os números antes de uso
- Validar com tábua IBGE vigente
- Revisar índices de atualização monetária
- Revisar conforme mudanças legislativas

## Próximas Etapas

- [ ] Integração com Supabase (banco + auth + storage)
- [ ] IA para extração de dados de documentos
- [ ] Geração de .docx no template do escritório
- [ ] Telas de conferência (human-in-the-loop)
- [ ] Dashboard de casos
- [ ] API de cálculo

## Referências

- [Constituição Federal - Art. 201](http://www.planalto.gov.br/ccivil_03/constituicao/constituicao.htm)
- [Lei 8.213/1991 - LBPS](http://www.planalto.gov.br/ccivil_03/leis/l8213cons.htm)
- [EC 103/2019 - Reforma Previdenciária](http://www.planalto.gov.br/ccivil_03/constituicao/emendas/emc/emc103_2019.htm)
- [Súmula STJ 1018 - Atrasados Previdenciários](https://www.stj.jus.br/docs_publi/publicacoes/pdf/suma1018.pdf)

## Licença

MIT - Uso interno do Escritório Machado Filgueiras

---

## Fase 0 — Motor TypeScript (`packages/prev-engine`)

O núcleo de cálculo foi migrado para o pacote **`@mfaa/prev-engine`** (TypeScript,
funções puras), com atualização monetária, carência e descarte exato (art. 26, §6º),
validado por **regressão contra 12 documentos reais** dos casos-modelo (RMI ≤ R$ 0,015
de diferença). Ver `packages/prev-engine/README.md`.

```bash
cd packages/prev-engine && npm install && npm test
```

## Fase 1 — App Web (`apps/web`)

App Next.js (App Router) + Prisma/SQLite com:
- Autenticação JWT (bcryptjs + jose), troca obrigatória de senha no primeiro acesso
- CRUD de casos com status progressivo (coleta → conferência → auditoria → cenários → minutas → revisão → aprovado → entregue)
- Upload de CNIS (PDF) com parse local via pdfjs-dist + motor, ou entrada manual
- Tela de conferência editável (vínculos e competências)
- Auditoria do CNIS (pendências por severidade, enquadramento nas regras, pré-análise)
- Cenários e ROI (grade padrão, cenário customizado, comparativo encadeado)
- Documentos imprimíveis: Doc 1.0 (contagem pré-EC), Doc X.0 (contagem cenário), Doc X.1 (RMI)
- Planilha ROI .xlsx via exceljs
- Marca d'água MINUTA até aprovação
- Trilha de auditoria completa (EventoAuditoria)

### Subindo do zero no Windows (Node 20+)

```bash
# 1. Instalar dependências
npm install

# 2. Build do motor
cd packages/prev-engine && npm run build && cd ../..

# 3. Preparar banco de dados
cd apps/web
npx prisma migrate dev --name init
npx prisma db seed
cd ../..

# 4. Rodar o app
cd apps/web && npm run dev
# Acesse http://localhost:3000

# Login inicial:
#   Email: laura@metodoadvdigital.com.br
#   Senha: mudar@123 (troca obrigatória no primeiro acesso)
```

### Testes

```bash
# Motor de cálculo (63 testes)
cd packages/prev-engine && npm test

# E2E (Playwright)
cd apps/web && npx playwright test
```
