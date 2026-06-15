# @mfaa/prev-engine

Motor de cálculo previdenciário (RGPS) do micro SaaS Machado Filgueiras — **Fase 0**.
Funções puras, determinísticas, em TypeScript. Toda saída requer conferência do advogado.

## O que está implementado

- **Regras de elegibilidade** (EC 103/2019): arts. 15, 16, 17, 18, 20, regra permanente
  e direito adquirido (85/95 progressiva), com projeção de datas de implemento.
- **Atualização monetária** (`aplicarAtualizacao`): teto por competência + fator de
  atualização por competência (tabela mensal das Portarias MPS). Inclui tabela com
  data-base 01/2026 e tetos históricos extraídos dos documentos reais.
- **RMI** (`calcularRMI`): média 100% desde 07/1994, coeficiente 60% + 2%/ano,
  fator previdenciário, média 80% pré-EC, piso/teto.
- **Descarte otimizado exato** (art. 26, §6º — `otimizarDescarteExato`): replica a
  mecânica do "Cálculo do Descarte Automático" dos softwares profissionais:
  varredura gulosa por salário corrigido crescente, com salto de competências que
  violem o tempo mínimo (dias reais por competência), restrição de carência ≥ 180
  e piso de 108 competências remanescentes (art. 135-A, Lei 14.331/2022).
- **Carência** (`contarCarencia`): meses de vínculo + recolhimentos válidos, com
  detecção de competências abaixo do mínimo (PREC-MENOR-MIN).

## Validação (regressão contra casos reais)

`tests/regression.test.ts` confere o motor contra **12 documentos reais** de cálculo
(casos Dulcimara, Gian Carlo e Suely — docs X.1/X.2 dos planejamentos): pipeline de
correção, média, coeficiente, nº de descartes e RMI, tudo com tolerância ≤ R$ 0,015.
Os fixtures em `tests/fixtures/` foram extraídos dos PDFs e validados contra os
valores impressos (Δ R$ 0,00).

```bash
npm install
npm test       # vitest — 54 testes
npm run build  # tsc → dist/
```

## Uso

```ts
import { mesclarPeriodos, avaliarRegras, aplicarAtualizacao, calcularRMI, dt, PARAMS_2026 } from '@mfaa/prev-engine';

const merged = mesclarPeriodos(periodosDoCNIS);
const { regras } = avaliarRegras({ sexo: 'F', nasc: dt(15,2,1971), merged, hoje: Date.now() });

const comps = aplicarAtualizacao(competenciasDoCNIS);     // teto + fatores 01/2026
const rmi = calcularRMI({
  competencias: comps, tipo: 'media100_coef',
  tcTotalDias, idadeNaDER: 62, sexo: 'F', tcMinRegra: 15,
  params: PARAMS_2026, carenciaNaDIB: 191,
});
```

## Manutenção das tabelas (obrigatória)

| Tabela | Onde | Quando atualizar |
|---|---|---|
| Fatores de atualização | `src/data/fatores-2026-01.json` (ou `parseTabelaFatoresCSV`) | todo mês (Portaria MPS) |
| Tetos por competência | `src/data/tetos-historicos.json` | a cada reajuste (janeiro) |
| Parâmetros do ano | `src/params.ts` (`PARAMS_*`) | janeiro |
| Tábua IBGE | `src/params.ts` (`TABUA_IBGE_*`) | dezembro |

## Pendências (Fase 1+)

Atividade especial (enquadramento/conversão), professor, PCD (LC 142), carência
art. 142, agrupamento de competências abaixo do mínimo, RPPS-SP, indenização
art. 45-A, reafirmação de DER. Ver `docs/` do repositório para o plano completo.
