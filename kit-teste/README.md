# Kit de teste — validação do app contra os casos reais (Sessão 1.6)

Valida o app web de ponta a ponta contra os **documentos reais** do escritório.
Critério de aceite da Fase 1: as RMIs do app devem bater com os documentos
com diferença ≤ R$ 0,02.

## 1. Gerar os arquivos de entrada

```bash
node kit-teste/gerar-entradas.mjs
```

Cria em `kit-teste/entradas/`:

| Arquivo | Conteúdo | Onde usar |
|---|---|---|
| `dulcimara-periodos.txt` | períodos reais (6 vínculos, 1986–2019) | aba CNIS → entrada manual de períodos |
| `dulcimara-salarios.txt` | salários NOMINAIS por competência (2011–2019) | aba CNIS → entrada manual de salários |
| `gian_carlo-periodos.txt` / `-salarios.txt` | idem (caso Gian) | idem |
| `valores-esperados.json` | RMI/média/coeficiente/descartes de cada doc real | conferência |

Para testar o **upload de PDF** (parser do CNIS), use os extratos reais que
estão na pasta do Drive que você me enviou:
`Modelos.Docts.Planejamento.Previdenciario/Dulcimara Rodrigues/20260106-extrato-contribuicoes.CNIS.doc.5.0.pdf`
e `.../Gian Carlo Cilento Filho/20251209-extrato-previdenciario.cnis.doc.5.0.pdf`.

## 2. Caso principal: DULCIMARA (validação exata)

Cadastro: **DULCIMARA RODRIGUES DOS SANTOS — Feminino — nasc. 15/02/1971 —
carência atual: 131**.

Fluxo: criar caso → aba CNIS → colar períodos e salários → confirmar →
aba Auditoria → conferir o resumo → aba Cenários → criar os cenários abaixo.

### 2.1 Conferência da Auditoria (contra o Doc 1.0 real)

| Item | Esperado (Doc 1.0) |
|---|---|
| TC em 12/11/2019 | **10 anos, 5 meses e 19 dias** |
| Carência em 12/11/2019 | 131 contribuições |
| Pontos em 12/11/2019 | 59 (sem tempo mínimo) |
| Art. 18 (62 anos) | implemento em **15/02/2033** |

### 2.2 Cenários e RMIs esperadas

O motor embute os fatores de atualização com **data-base 01/2026** (mesma dos
documentos da Dulcimara) — os valores devem bater exatos.

| Cenário no app (regra/base/cadência/alíquota) | Doc real | DIB | Média | Coef | Descartes | **RMI** |
|---|---|---|---|---|---|---|
| art18 / mínimo / sem parar / 11% | Doc 3.1 | 15/02/2033 | 2.352,09 | 64% | 0 | **1.621,00** (piso) |
| art18 / teto / sem parar / 20% | Doc 3.2 | 15/02/2033 | 6.796,60 | 60% | 33 | **4.077,96** |

Conferir também: carência na DIB = **217** nos dois cenários; nº de parcelas
no PBC = 166; no Doc X.1 impresso, a tabela de salários deve marcar "D" nas
33 descartadas e o quadro final deve mostrar soma/média/coeficiente acima.

### 2.3 Cenários que o app AINDA não reproduz (não é bug — registrar)

| Doc real | Premissa | Por que não sai igual |
|---|---|---|
| Doc 2.1/2.2 (RMI 1.621,00 / 3.350,05) | recolhe sem parar até 07/2030 e DEPOIS a cada 6 meses até a DIB | cadência **híbrida** — melhoria a implementar (cadência por trecho) |
| Doc 4.1 (RMI 4.973,02) | esperar até os 65 anos (DER adiada além do implemento) | app fixa DIB = data de implemento — melhoria: campo "DER desejada" |

Esses dois valores já são validados no motor pelos testes de regressão
(`packages/prev-engine/tests/regression.test.ts`).

## 3. Caso secundário: GIAN CARLO (teste de fluxo, não de valor exato)

Cadastro: **GIAN CARLO CILENTO FILHO — Masculino** (nascimento no
`contagens.json`; carência: ver pré-análise no mesmo arquivo).

Os documentos do Gian foram calculados em **dez/2025** (piso 1.518,00, teto
8.157,41, fatores data-base 12/2025). O app usa parâmetros 2026, então as RMIs
NÃO baterão exatas — use este caso para validar o fluxo (upload do PDF real,
conferência, cadência "a cada 6 meses", base intermediária R$ 4.500):

| Doc real | Premissa | RMI no doc (12/2025) |
|---|---|---|
| 2.1 | art18 65a / mínimo / cada 6 meses / 11% | 1.518,00 (piso) |
| 3.1 | art18 65a / valor R$ 4.500 / sem parar / 20% | 1.603,21 |
| 3.2 | art18 65a / teto / sem parar / 20% | 2.420,04 |

Melhoria futura: permitir escolher o conjunto de parâmetros/fatores da época
do cálculo — aí o Gian vira validação exata também.

## 4. Checklist de aceite da Fase 1

- [ ] Upload do CNIS real da Dulcimara extrai vínculos e salários (conferir contra os TXT)
- [ ] Auditoria bate com §2.1
- [ ] Cenário art18/mínimo → RMI 1.621,00; art18/teto → RMI 4.077,96 (±0,02)
- [ ] Doc 1.0 impresso comparado lado a lado com o PDF real (mesmos quadros)
- [ ] Doc X.1 impresso: tabela de salários com "D" nos descartes + bloco RMI
- [ ] ROI.xlsx abre no Excel com blocos Comparativo A/B
- [ ] Correções do caso real Bruno: indicadores IREC-MEI/IREC-LC123 catalogados
      no dicionário (regra de complementação MEI 5%→20%) e alerta de
      "competências sem período correspondente" na conferência/auditoria

---

## RESULTADO DA VALIDAÇÃO FINAL (12/06/2026) — gabarito revisado

Fluxo completo executado no app (upload do PDF real → conferência → auditoria →
cenários com data-base 19/01/2026):

| Item | App | Doc real (3.2) | Status |
|---|---|---|---|
| Vínculos extraídos | 6 (datas exatas) | 6 | ✓ |
| Competências extraídas | 125 (fiel ao extrato) | — | ✓ |
| Carência automática | 131 | 131 | ✓ |
| TC em 12/11/2019 | 10a5m22d | 10a5m19d | ~ (3 dias; método de contagem) |
| DIB art. 18 | 15/02/2033 | 15/02/2033 | ✓ exato |
| Coeficiente | 60% | 60% | ✓ |
| Descartes | 31 | 33 | ~ |
| Carência na DIB | 216 | 217 | ~ (projeção inicia no mês seguinte) |
| **RMI art18/teto** | **4.046,09** | **4.077,96** | Δ R$ 31,87 (0,8%) |

**Por que a RMI não bate exato — e por que está certo assim:** o documento do
escritório (Prévius) usou remunerações que NÃO constam do extrato impresso
(35.950,83 em 11/2011 e 9.996,65 em 12/2011) e pareia os meses deslocados. O
extrato oficial pareia 11/2011 → 851,13, que é o pró-rata exato dos 24 dias da
admissão (07/11/2011) — pareamento consistente. O app reproduz fielmente o
extrato; o motor reproduz fielmente os documentos quando recebe os mesmos dados
(testes de regressão, Δ ≤ R$ 0,015). A diferença é de FONTE DE DADOS, não de
cálculo. **Pendência: arbitragem do Dr. Ailton** sobre qual fonte prevalece
(possível artefato de importação do Prévius — se confirmado, o sistema novo é
mais fiel que o fluxo atual).
