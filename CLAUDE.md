# Contexto do projeto — Planejador Previdenciário MFAA

Micro SaaS que automatiza o planejamento previdenciário do escritório Machado
Filgueiras: upload dos documentos do caso → auditoria do CNIS → cenários →
RMI/ROI → geração dos entregáveis no padrão do escritório.
Plano completo: `Plano_Desenvolvimento_MicroSaaS_Previdenciario.docx` (na pasta raiz, se presente)
e roteiro de execução em `ROTEIRO-CLAUDE-CODE.md`.

## Estado atual

- `packages/prev-engine` — motor de cálculo RGPS em TypeScript (PRONTO, 63 testes):
  regras EC 103 (arts. 15/16/17/18/20, permanente, direito adquirido), atualização
  monetária (tabelas de fatores/tetos), RMI com descarte exato (art. 26 §6º),
  carência, parser de CNIS, dicionário de indicadores + auditoria, IRPF mensal 2026
  (Lei 15.270/2025), ROI (metodologia do escritório) e gerador de cenários.
- `src/` + `planejador.html` — protótipo legado (referência funcional; não evoluir).
- `tests/fixtures` do prev-engine — extraídos de 12 documentos REAIS de cálculo.

## Regras de ouro (NUNCA violar)

1. **Números vêm do motor, nunca de LLM.** Qualquer cálculo novo entra em
   `packages/prev-engine` como função pura + testes.
2. **Regressão é sagrada**: `cd packages/prev-engine && npm test` precisa passar
   100% antes de qualquer commit. Os testes de regressão reproduzem documentos
   reais do escritório com tolerância ≤ R$ 0,015 — se quebrar, o erro é seu, não do teste.
3. **Parâmetros legais são versionados e citam fonte** (`src/params.ts`). Não
   inventar valores: se não tiver certeza (alíquota, ponto, data), marcar
   `// TODO CONFERIR` e avisar no resumo.
4. **Toda saída para cliente carrega o selo** "MINUTA — requer conferência do
   advogado" até existir fluxo de aprovação.
5. **LGPD**: nunca armazenar senhas gov.br de clientes; dados de casos só no
   banco local; nada de telemetria externa.
6. UI e código em **português brasileiro** (identificadores em pt-BR como já
   está no motor: `calcularRMI`, `montarCenario` etc.).

## Comandos

```bash
cd packages/prev-engine && npm install && npm test   # motor (vitest)
cd packages/prev-engine && npm run build             # tsc → dist/
cd apps/web && npm install && npm run dev            # app web (quando existir)
```

## Arquitetura decidida (não rediscutir sem pedido do usuário)

Monorepo npm workspaces. Fase 1: `apps/web` = Next.js (App Router) + TypeScript,
SQLite via Prisma (local), login simples (e-mail/senha + cookie assinado, papéis:
assistente/advogado/socio/admin). Geração de documentos: views imprimíveis
(layout dos docs reais) + xlsx (exceljs) + docx (biblioteca docx) nas fases 2+.
