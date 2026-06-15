# Roteiro de construção — fases restantes (para executar com Claude Code)

Cada **sessão** abaixo é uma unidade de trabalho para uma sessão do Claude Code:
tem objetivo, um **prompt pronto para colar** e **critérios de aceite**. Execute
na ordem; não inicie uma sessão sem os critérios da anterior verificados.

**Antes de tudo:** o arquivo `CLAUDE.md` deste repositório contém as regras de
ouro — o Claude Code o lê automaticamente. Após cada sessão, rode
`cd packages/prev-engine && npm test` e confira os critérios.

**Status:** Fase 0 ✅ e extensões do motor da Fase 1 ✅ (cnis, indicadores,
irpf 2026, roi, cenários — 63 testes). Começa na Sessão 1.1.

---

## FASE 1 — App web local (restante)

### Sessão 1.1 — Esqueleto do app: Next.js + Prisma/SQLite + login

**Prompt:**
> Crie `apps/web`: Next.js (App Router) + TypeScript, sem Tailwind (CSS próprio
> em `globals.css`, visual sóbrio jurídico: azul-marinho #1F3864, fundo claro).
> Adicione o workspace no package.json raiz. Banco: Prisma + SQLite
> (`apps/web/prisma/schema.prisma`) com modelos: Usuario (id, nome, email único,
> senhaHash, papel: assistente|advogado|socio|admin, criadoEm), Caso (id,
> clienteNome, sexo, nascimento, status: coleta|conferencia|auditoria|cenarios|
> minutas|revisao|aprovado|entregue, cnisJson?, periodosJson?, competenciasJson?,
> carenciaAtual?, criadoPorId, timestamps), Cenario (id, casoId, rotulo,
> premissasJson, resultadoJson, criadoEm) e EventoAuditoria (id, usuarioId,
> casoId?, acao, detalhe, criadoEm). Autenticação SEM next-auth: bcryptjs +
> cookie JWT assinado (jose), middleware protegendo tudo exceto /login. Papéis
> só verificados no servidor. Seed: usuária admin laura@metodoadvdigital.com.br
> com senha inicial "mudar@123" e flag de troca obrigatória no primeiro login.
> Páginas: /login, / (lista de casos com status e busca), /casos/novo,
> /casos/[id] (abas vazias: Dados, CNIS, Auditoria, Cenários, Documentos).
> Importe o motor como dependência de workspace `@mfaa/prev-engine` (use o
> build `dist/`; adicione `transpilePackages` se necessário). Rodapé fixo em
> todas as telas: "PROTÓTIPO — uso interno, requer conferência do advogado".
> Critério: `npm run build` do apps/web sem erros e fluxo login→criar caso→ver
> caso funcionando.

**Aceite:** build verde; login funciona; caso criado aparece na lista; troca de
senha obrigatória no primeiro acesso; EventoAuditoria registra login e criação.

### Sessão 1.2 — Upload de CNIS + tela de conferência

**Prompt:**
> Na aba CNIS de /casos/[id]: upload do PDF do extrato CNIS (tipo "Vínculos,
> contribuições e remunerações"). Parse NO NAVEGADOR com pdfjs-dist (npm, sem
> CDN) usando `itensParaLinhas` + `parseCNISLinhas` do @mfaa/prev-engine.
> Mostrar resultado em TELA DE CONFERÊNCIA editável: identificação
> (nome/nascimento), tabela de vínculos (seq, origem, início, fim, tipo,
> indicadores — editável, com adição/remoção de linhas) e tabela de competências
> (competência, valor nominal — editável). Avisos do parser em destaque.
> Botão "Confirmar dados" salva no Caso (cnisJson bruto + periodosJson +
> competenciasJson conferidos) e muda status para "auditoria". REGRA: nenhum
> cálculo roda sobre dado não confirmado. Adicione também entrada manual
> (colar períodos/salários em texto, formatos do protótipo legado:
> `dd/mm/aaaa dd/mm/aaaa descrição` e `mm/aaaa valor`).

**Aceite:** subir um CNIS digital real preenche as tabelas; edição e confirmação
persistem; caso sem CNIS aceita entrada manual; status muda.

### Sessão 1.3 — Auditoria do CNIS

**Prompt:**
> Aba Auditoria: ao abrir, rodar `auditarCNIS` + `contarCarencia` do motor sobre
> os dados CONFERIDOS do caso. Exibir pendências agrupadas por severidade
> (alta/média/baixa) com significado e providência (já vêm do dicionário), e o
> resumo: TC em 12/11/2019, TC hoje, carência atual, idade. Campo "carência
> atual" editável (o advogado pode ajustar) — persistir em Caso.carenciaAtual.
> Botão "Gerar texto de pré-análise" produz o texto no formato do escritório
> (seções romanas: I - DOS VÍNCULOS, II - DOS INDICADORES, III - DA LACUNA DE
> RECOLHIMENTOS, IV - DA CONCLUSÃO com bloco `TC em 13/11/2019: XA/XM/XD`,
> idade, e datas de cada regra vindas de `avaliarRegras`) em textarea copiável.

**Aceite:** pendências corretas para um CNIS com PREM-EXT e vínculo aberto;
texto de pré-análise no formato (comparar com `resumo.atendimento.pre.analise`
dos casos-modelo); carência editável persiste.

### Sessão 1.4 — Cenários e ROI

**Prompt:**
> Aba Cenários: botão "Gerar grade padrão" chama `gradePadrao` do motor; cada
> cenário vira um card com: rótulo, DIB, idade na DIB, TC, carência projetada,
> RMI (média, coeficiente, descartes) e ROI líquido. Botão "Novo cenário"
> abre formulário de premissas (regra, base mínimo/teto/valor livre, cadência
> sem-parar/cada-6-meses, alíquota 20%/11%/custom) e chama `montarCenario`.
> Persistir cada cenário em Cenario (premissas + resultado + versão dos
> parâmetros usados). Tabela comparativa final usando `comparativosEncadeados`
> (A×B→vencedor×C...) com a diferença de ROI por confronto e o vencedor
> destacado — espelha os "Comparativos A/B/C" da planilha ROI do escritório.
> Cenários marcáveis como "selecionado para entrega" (numera Doc 2.0, 3.0...
> na ordem de seleção).

**Aceite:** grade gera ≥5 cenários para um caso real; resultados consistentes
com o motor (conferir 1 caso na mão); comparativo encadeado aponta vencedor;
seleção numera os docs.

### Sessão 1.5 — Documentos: Doc 1.0/X.0/X.Y imprimíveis + ROI.xlsx

**Prompt:**
> Aba Documentos: gerar o pacote do planejamento no padrão MFAA.
> (1) Views imprimíveis (rotas /casos/[id]/docs/...) com CSS @media print, layout
> fiel aos documentos reais (ver fixtures e descrição em
> packages/prev-engine/tests/fixtures/README.md): Doc 1.0 = contagem até
> 12/11/2019 com cabeçalho (Nome, NIT, CPF, Nascimento, Sexo, Espécie 42/41,
> DIB, Data da Atualização), tabela "Períodos Informados", tabela "Períodos
> Considerados no Cálculo" (com fator e totais) e página "Análise dos Dados"
> (quadros TC/Pedágio/Carência/Idade/85-95). Doc X.0 = contagem do cenário com
> períodos projetados rotulados "a recolher sem parar"/"a recolher a cada 6
> meses". Doc X.1 = Valor da Aposentadoria: tabela de salários (Nº, Data, Dias,
> Salário de Contribuição, Teto, Considerado, Índice, Corrigido, marca "D" nos
> descartados), bloco "Cálculo da R.M.I." (parcelas no PBC, idade, TC, soma,
> média, coeficiente, RMI) com as notas legais do §6º art. 26, e página
> "Cálculo do Descarte Automático" (a iteração já vem em
> `otimizarDescarteExato`; exponha os passos se necessário no motor).
> (2) Planilha ROI .xlsx via exceljs (rota API): blocos "Comparativo A/B/C",
> linhas exatamente como a planilha real (DER, idade, sobrevida, RMI bruta,
> IR mensal, RMI líquida, ganho até 65/após 65 com abatimento R$ 1.903,98,
> investimentos, "Aposentadoria que deixará de receber", ROI PREVIDENCIÁRIO
> LÍQUIDO) — modelo nos arquivos ROI*.xls dos casos (estrutura descrita no
> fixtures/README e no CLAUDE.md). Nomenclatura de download:
> `AAAAMMDD-tipo-descricao.doc.X.Y.pdf/.xlsx`. Marca d'água "MINUTA" até o
> caso estar com status aprovado.

**Aceite:** imprimir Doc 1.0 e X.1 de um caso real e comparar lado a lado com
os PDFs-modelo (mesmos campos e numeração); xlsx abre no Excel com os blocos.

### Sessão 1.6 — Validação ponta a ponta da Fase 1

**Prompt:**
> Rode o caso-modelo Dulcimara de ponta a ponta usando os dados dos fixtures
> (packages/prev-engine/tests/fixtures/contagens.json e dulcimara_doc_*.json):
> crie o caso, insira períodos e salários, gere os cenários equivalentes aos
> docs 2.x/3.x/4.x e confira RMIs contra os valores esperados (1.621,00 /
> 3.350,05 / 1.621,00 / 4.077,96 / 4.973,02). Crie um teste e2e (Playwright)
> cobrindo login→caso→conferência→cenário→documento. Corrija divergências.
> Atualize README raiz com instruções Windows (Node 20+, npm install,
> npx prisma migrate dev, npm run dev).

**Aceite:** RMIs batem; e2e verde; README permite subir do zero no Windows.

### Sessão 1.7 — Repositório de documentos do caso (upload de TODOS os tipos)

**Prompt:**
> Crie a aba "Arquivos" em /casos/[id]: upload múltiplo de QUALQUER documento do
> caso (PDF/imagem). Modelo Prisma `Arquivo` (id, casoId, nome, tipo, tamanho,
> caminho, classificacao, status: pendente|processado|so-arquivo, observacao,
> criadoEm). Armazenar em pasta local `storage/casos/<id>/` com nomenclatura
> MFAA (AAAAMMDD-tipo-descricao.ext). Classificação no upload: tentar automática
> por heurística no texto da 1ª página (CNIS, CTPS, PPP, CTSM/certidão militar,
> CTC, carta de concessão, laudo/LTCAT, procuração, outro) com dropdown para o
> usuário corrigir. AÇÃO POR TIPO: CNIS → botão "Processar" que envia ao fluxo
> de conferência já existente; PPP → marcar a quais períodos se refere e
> habilitar flag "especial" (grau 15/20/25) na tabela de períodos da conferência;
> CTSM → atalho "criar período militar" (pré-preenchido, com aviso "não conta
> carência" e ajuste automático sugerido no campo carência); CTC → registrar
> períodos certificados (prepara a Fase 3); demais tipos → "só arquivo" (prova).
> Cada arquivo aparece com selo do que foi extraído/vinculado. A aba Auditoria
> passa a listar "documentos do caso" e a acusar: períodos especiais sem PPP
> anexado, período militar sem CTSM, competências sem período correspondente.
> Tela de conferência do CNIS ganha a coluna "Tipo" com opção especial/militar.

**Aceite:** subir 4 documentos de tipos diferentes → classificados e listados;
PPP habilita especial num período; CTSM cria período sem carência; auditoria
cruza documentos × períodos; CNIS continua com o fluxo atual.

---

## FASE 2 — Atividade especial, PCD, professor e entregáveis textuais

### Sessão 2.1 — Atividade especial no motor

**Prompt:**
> Em packages/prev-engine, implemente atividade especial: (1) períodos marcados
> `tipo: 'especial'` com grau 15/20/25 anos; (2) conversão especial→comum com
> fatores 1,4 (H) / 1,2 (M) APENAS para períodos até 13/11/2019 (art. 25 §2º
> EC 103; tabela art. 70 Dec. 3.048/99); (3) regras art. 19 §1º (permanente
> 55/58/60 anos) e art. 21 (transição: 66/76/86 pontos fixos + tempo especial
> mínimo) em `avaliarRegras`; (4) contagens com e sem conversão (o caso Suely
> nos fixtures tem cenários c/ e s/ especial — docs 6-9). Atenção: nos
> documentos reais os dias da coluna "Dias" do PBC já saem CONVERTIDOS — siga
> esse comportamento. Testes: reproduzir as contagens com especial da Suely
> (fixtures suely_doc_8_1/9_1: TC com conversão 16a4m22d na DIB 26/02/2026).
> Adicione enquadramento por categoria profissional até 28/04/1995 como tabela
> de códigos (Dec. 53.831/64 Anexo III e 83.080/79) com os códigos citados nos
> pareceres: 2.4.1 aeronautas, 2.1.3 médicos/dentistas/enfermeiros, 1.1.6
> ruído, 1.2.11 hidrocarbonetos — estrutura extensível, com fonte comentada.

**Aceite:** npm test verde incluindo novos testes de conversão; regressão
intacta; TC com especial da Suely reproduzido.

### Sessão 2.2 — Professor e PCD (LC 142/2013)

**Prompt:**
> Adicione ao motor: (1) professor (magistério na educação básica): requisitos
> 25/30 anos de magistério, pontos 2026 = 88/98 (+1/ano), idade progressiva
> 2026 = 54,5/59,5 (+6m/ano), pedágio 100% 52/55, permanente 57/60+25 — como
> variante das regras existentes ativada por flag `professor` no perfil, com
> períodos marcados `magisterio: true`; (2) PCD LC 142: por TC (H 25/29/33,
> M 20/24/28 conforme grau grave/moderada/leve, RMI = 100% da média) e por
> idade (60/55 + 15 anos, RMI = 70% + 1%/ano), com conversão entre graus pela
> tabela da LC (grau preponderante). Cite fontes nos comentários. Testes
> unitários para cada regra (use os números do parecer PCD 20250324 como
> referência se aplicável). Exponha as novas regras na grade de cenários do
> app (Sessão 1.4) quando o perfil tiver as flags.

**Aceite:** testes verdes; cenários professor/PCD aparecem no app só quando
aplicáveis.

### Sessão 2.3 — Parecer .docx completo

**Prompt:**
> Crie `packages/doc-gen` (workspace) com geração do PARECER PREVIDENCIÁRIO em
> .docx (biblioteca `docx`), template fiel à estrutura dos pareceres do Dr.
> Ailton: capa (PARECER PREVIDENCIÁRIO + segurado + benefícios analisados),
> sumário numerado X.0/X.Y, preâmbulo fixo ("Trata-se de parecer previdenciário,
> com base nos documentos apresentados..."), seção 1 requisitos anteriores à
> reforma com TC em 12/11/2019, seção 2 requisitos posteriores (transcrição
> padronizada das regras arts. 15-20 com "Requisitos" e "Forma de Cálculo"),
> "Caso Concreto" (enquadramentos com data exata por cenário), "Projeções para
> a Concessão dos Benefícios" (blocos por cenário: TC TOTAL ref. Doc X.0, IDADE,
> PONTUAÇÃO, RMI ref. Doc X.1, APLICAÇÃO DO DESCARTE, EXPECTATIVA DE SOBREVIDA,
> COEFICIENTE, hipótese contributiva), "Estimativa de Investimento x Tempo de
> Recuperação" (quadros 2 colunas), tabela ROI, "Das Omissões e Divergências"
> (alimentada pela auditoria), CONCLUSÃO/OPINIÃO em alíneas a)/b)/c) com
> ressalva fixa e fecho "É o que nos parece, salvo melhor juízo...". TODOS os
> números vêm dos objetos ResultadoCenario/ResultadoROI/Pendencia — texto entre
> números é template fixo com placeholders. Sem LLM nesta sessão. Botão
> "Gerar parecer (minuta)" na aba Documentos.

**Aceite:** .docx abre no Word com todas as seções; números idênticos aos da
tela; marca MINUTA presente.

### Sessão 2.4 — E-mail de resumo e pré-análise para o CRM

**Prompt:**
> Gere na aba Documentos: (1) E-mail de resumo de consulta (texto copiável +
> .docx) no formato dos modelos do Dr. Edson Jr.: assunto padronizado
> "Aposentadoria - [Cliente] - Planejamento Previdenciário e/ou Assessoria -
> Machado Filgueiras Adv.", gancho "Conforme nossa reunião...", itens numerados
> de contagem por cenário com regras em romanos e datas ("Aposentadoria por
> Tempo de contribuição conforme regra do art.15 da E.C. 103/19 (105 pts) }
> 10.06.2035"), bloco de pendências do CNIS com instruções, lista de documentos
> a providenciar, etapas do escopo numeradas e fechamento comercial (proposta
> anexa, validade 10 dias). (2) Texto de pré-análise (já existe da Sessão 1.3 —
> mover para Documentos e versionar junto). Campos editáveis antes de copiar.

**Aceite:** e-mail gerado comparável aos .msg modelo; datas/regras corretas.

---

## FASE 3 — RPPS-SP, híbridos e teses

### Sessão 3.1 — RPPS parametrizado + Estado de SP (LC 1.354/2020)

**Prompt:**
> Crie em packages/prev-engine o módulo `rpps.ts`: regras parametrizadas por
> ente. Implemente SP-Estado: regra permanente art. 2º III (62M/65H + 25 TC +
> 10 serviço público + 5 cargo; coeficiente 60% + 2%/ano acima de 20),
> transição art. 10 por pontos (ANTES DE CODIFICAR: confirme no texto da LC
> 1.354/2020 na ALESP a pontuação exigida em 2026 e a progressão — há dúvida
> registrada entre 92/102 e 93/103; idade mínima 57M/62H desde 2022;
> integralidade/paridade para ingresso até 31/12/2003 + idade do §6º),
> pedágio art. 11, especial art. 13 (86 pontos + 25 de exposição). Média RPPS:
> 100% dos salários SEM teto RGPS; coeficiente ou integralidade (última
> remuneração). Use os fixtures RPPS da Suely para regressão: doc 2.1
> (média 8.928,73 × 72% = RMI 6.428,68), doc 3.1 (80% → 7.130,34), doc 4.1
> (Integralidade → 10.603,86) — extraia os dados dos PDFs da pasta de modelos
> se necessário. Abono de permanência e contribuição do inativo (LC 1.380/2022:
> 16% sobre o que excede o teto RGPS) como funções utilitárias para o ROI.

**Aceite:** 3 RMIs RPPS da Suely reproduzidas ≤ R$ 0,015; pontuação 2026
confirmada com fonte citada em comentário.

### Sessão 3.2 — Casos híbridos RPPS+RGPS e CTC

**Prompt:**
> Suporte a caso híbrido: perfil com vínculos RPPS e RGPS simultâneos/
> sequenciais; simulação de averbação via CTC nos dois sentidos (período sai
> de um regime e entra no outro; vedada dupla contagem; tempo especial em CTC
> conforme Nota Técnica 792 STF — apenas registrar alerta, sem converter).
> A aba Cenários ganha o modo "dupla opinião": grade RGPS + grade RPPS lado a
> lado, com cenários de averbação (ex.: "CTC do INSS para o Estado"). Documentos
> de contagem ganham as variantes RPPS (títulos e quadros como nos docs 1.0-4.0
> da Suely: "Tempo de Contribuição RPPS Estado de SP...", quadro Pontos,
> tempo no serviço público/cargo).

**Aceite:** caso Suely reproduzível de ponta a ponta (RPPS + RGPS, c/ e s/
especial); cenário de averbação altera contagens dos dois lados corretamente.

### Sessão 3.3 — Indenização art. 45-A e débitos

**Prompt:**
> Implemente no motor `indenizacao.ts`: cálculo da indenização de período
> decadente de CI (art. 45-A Lei 8.212/91): base = média aritmética simples dos
> 80% maiores salários de contribuição desde 07/1994 corrigidos × 20%, + juros
> de mora 0,5% a.m. limitados a 50% + multa de 10%; SEM juros/multa para
> competências anteriores a 14/10/1996. Saída com memória de cálculo (nº de
> competências, média, base, juros, multa, total) compatível com a seção dos
> pareceres. No app: cenários podem incluir "com indenização do período X-Y"
> (o período passa a contar para TC/carência e o custo entra no ROI como
> "Débito a quitar"). Referenciar o SAL/RFB como fonte de conferência oficial
> no texto gerado.

**Aceite:** memória de cálculo bate com o exemplo do parecer 20241009 (se os
valores constarem no PDF; senão, teste unitário com caso sintético validado
manualmente); ROI reflete o débito.

### Sessão 3.4 — Acordos internacionais (totalização)

**Prompt:**
> Implemente totalização de acordos internacionais: período estrangeiro
> (país + datas) soma para REQUISITO (tempo/carência) mas NÃO entra na média
> salarial; benefício proporcional pro rata (RMI cheia × tempo brasileiro ÷
> tempo total). Lista de países conveniados como dado (gov.br/previdencia —
> Acordos Internacionais). No app: seção "Períodos no exterior" no perfil e
> flag nos cenários. Documento de contagem mostra o período estrangeiro
> rotulado. Teste com o exemplo do parecer Brasil-França (coeficiente
> proporcional 55,6% citado) se os dados constarem; senão caso sintético.

**Aceite:** pro rata correto em teste; cenário com acordo gera RMI proporcional.

---

## FASE 4 — Operação: workflow, integrações e IA

### Sessão 4.1 — Workflow e follow-ups

**Prompt:**
> Adicione gestão de fluxo: status do caso com transições controladas por papel
> (assistente prepara → advogado/gestor revisa → sócio aprova → entregue),
> fila "Minhas revisões", comentários por caso, e follow-ups (tarefa com
> responsável, prazo, recorrência simples) com painel "Vencendo hoje/atrasados".
> Trilha de auditoria completa (quem mudou o quê — EventoAuditoria já existe).
> Documentos só perdem a marca MINUTA quando o caso está "aprovado", e o
> aprovador fica registrado no rodapé do documento.

**Aceite:** transição de status respeita papéis; follow-up atrasado aparece no
painel; documento aprovado sai sem MINUTA e com aprovador.

### Sessão 4.2 — Conferência pós-concessão

**Prompt:**
> Nova etapa "Concessão": upload da carta de concessão (PDF), extração de DIB,
> RMI, espécie e DDB (parser tolerante + conferência manual), comparação
> automática com o cenário selecionado do planejamento: diferença de RMI > 5%
> ou DIB divergente gera alerta "possível revisão" com checklist (POP LEO-009).

**Aceite:** carta real importada; divergência sintética dispara alerta.

### Sessão 4.3 — OCR para CNIS digitalizado

**Prompt:**
> Fallback de OCR: quando o pdfjs não extrair texto (CNIS escaneado), oferecer
> OCR local com tesseract.js (pt-BR) página a página, alimentando o mesmo
> parseCNISLinhas. Marcar o caso como "extração por OCR — conferência
> obrigatória reforçada" e exigir confirmação campo a campo na tela de
> conferência. Documentar limitações no README.

**Aceite:** um CNIS escaneado de teste passa pelo fluxo com conferência.

### Sessão 4.4 — IA assistiva (com guarda-corpos)

**Prompt:**
> Integre a API da Anthropic (chave em .env, nunca no código) para DUAS funções:
> (1) redação assistida: transformar os dados calculados (cenários, ROI,
> pendências) em prosa para o parecer/e-mail DENTRO dos templates — o texto
> gerado nunca contém números próprios: os números são interpolados pelo código
> a partir dos objetos do motor (valide com regex que todo número no textoveio
> da interpolação; rejeite e regenere se o modelo inventar número); (2)
> classificação de documentos no upload (CNIS/CTPS/PPP/carta/outro). Toda
> saída de IA é marcada "rascunho IA" e exige aceite humano antes de entrar no
> documento. Registrar prompt+resposta na trilha de auditoria.

**Aceite:** parecer com prosa assistida mantém números 100% do motor (teste
automatizado da validação); classificação acerta os tipos nos arquivos-modelo.

### Sessão 4.5 — Integração SISJURI/TOTVS (exploratória)

**Prompt:**
> Sessão exploratória: investigue com o usuário as opções de integração com o
> SISJURI/TOTVS Legal Desk usado pelo escritório (API? banco Oracle? RPA?).
> NÃO implemente sem confirmar acesso. Entregue: documento de opções com
> esforço/risco e, se houver API acessível, um conector mínimo somente-leitura
> (buscar cliente por código) atrás de feature flag.

**Aceite:** documento de decisão; nada quebra sem a integração.

---

## Pendências jurídicas a confirmar antes das sessões correspondentes

| Item | Onde confirmar | Bloqueia |
|---|---|---|
| Pontuação art. 10 LC 1.354/2020 em 2026 | Texto na ALESP | Sessão 3.1 |
| Abono de permanência SP (regra exata) | LC 1.354/2020 / SPPREV | Sessão 3.1 |
| Coeficiente do homem no art. 18 (60% aos 15, cresce após 20) | IN PRES/INSS 128/2022 | já parametrizado — validar |
| Art. 135-A: critério "filiado até 07/1994" | Lei 8.213/91 (Planalto) | já parametrizado — validar |
| Salário-maternidade como tempo/carência | IN 128/2022 | Sessão 2.x se surgir caso |

## Rotina mensal (independe de fase)

Carregar a tabela de fatores de atualização do mês (Portaria MPS) via
`parseTabelaFatoresCSV` e atualizar `src/data/fatores-*.ts`; em janeiro:
salário mínimo, teto, IRPF e pontos; em dezembro: tábua IBGE.
