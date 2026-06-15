'use client';

import { useState, useRef, useCallback } from 'react';
import { parseCNISLinhas, itensParaLinhas } from '@mfaa/prev-engine';
import type { ResultadoCNIS } from '@mfaa/prev-engine';

interface Props {
  onParsed: (resultado: ResultadoCNIS) => void;
}

/**
 * Limiar: se a média de caracteres por página for menor que isso,
 * consideramos o PDF como digitalizado (imagem) e tentamos OCR.
 */
const CHARS_POR_PAGINA_MINIMO = 100;

/** Timeout por página de OCR (ms) */
const OCR_TIMEOUT_MS = 120_000;

export function UploadCNIS({ onParsed }: Props) {
  const [status, setStatus] = useState('');
  const [erro, setErro] = useState('');
  const [progresso, setProgresso] = useState<{ pagina: number; total: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const cancelRef = useRef(false);

  const cancelarOCR = useCallback(() => {
    cancelRef.current = true;
  }, []);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setErro('');
    setProgresso(null);
    cancelRef.current = false;
    setStatus(`Lendo ${file.name}...`);

    try {
      const pdfjsLib = await import('pdfjs-dist');

      // -----------------------------------------------------------
      // Configurar worker — usar arquivo copiado em public/ para
      // evitar problemas com Turbopack/webpack e import.meta.url.
      // Se falhar, pdfjs roda no main thread (funcional, só mais lento).
      // -----------------------------------------------------------
      if (typeof window !== 'undefined') {
        try {
          pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
        } catch (workerErr) {
          console.warn('[upload-cnis] Falha ao configurar worker do pdfjs:', workerErr);
        }
      }

      const data = new Uint8Array(await file.arrayBuffer());

      let doc: Awaited<ReturnType<typeof pdfjsLib.getDocument>>['promise'] extends Promise<infer T> ? T : never;
      try {
        doc = await pdfjsLib.getDocument({ data }).promise;
      } catch (docErr) {
        throw new Error(
          `Falha ao abrir o PDF: ${docErr instanceof Error ? docErr.message : String(docErr)}`,
        );
      }

      setStatus(`Extraindo texto de ${doc.numPages} página(s)...`);

      // =============================================================
      // Passo 1: extrair texto de TODAS as páginas e contar caracteres
      // =============================================================
      let totalChars = 0;
      let linhas: string[] = [];
      const errosPagina: string[] = [];

      for (let p = 1; p <= doc.numPages; p++) {
        try {
          const page = await doc.getPage(p);
          const tc = await page.getTextContent();
          const viewport = page.getViewport({ scale: 1 });

          const items = tc.items
            .filter(it => 'str' in it && typeof (it as Record<string, unknown>).str === 'string')
            .map(it => {
              const item = it as { str: string; transform: number[] };
              return { str: item.str, transform: item.transform };
            });

          // Contagem bruta de caracteres desta página
          const paginaChars = items.reduce((sum, it) => sum + it.str.trim().length, 0);
          totalChars += paginaChars;

          // Reproduz exatamente o Util.transform do pdf.js (src/shared/util.js)
          // Composição de matrizes afins 2D [a,b,c,d,e,f]:
          //   | a  b |           | m1·m2 |
          //   | c  d |   →  M = | ...   |   com translação (e,f)
          const Util = {
            transform: (m1: number[], m2: number[]) => [
              m1[0] * m2[0] + m1[2] * m2[1],
              m1[1] * m2[0] + m1[3] * m2[1],
              m1[0] * m2[2] + m1[2] * m2[3],
              m1[1] * m2[2] + m1[3] * m2[3],
              m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
              m1[1] * m2[4] + m1[3] * m2[5] + m1[5],
            ],
          };

          linhas = linhas.concat(
            itensParaLinhas(items, { transform: viewport.transform }, Util),
          );
        } catch (pageErr) {
          // Erro real de extração — registrar, NÃO assumir "sem texto"
          const msg = pageErr instanceof Error ? pageErr.message : String(pageErr);
          errosPagina.push(`Página ${p}: ${msg}`);
          console.error(`[upload-cnis] Erro na página ${p}:`, pageErr);
        }
      }

      // =============================================================
      // Passo 2: decidir texto vs. digitalizado pela contagem real
      // =============================================================
      const mediaPorPagina = doc.numPages > 0 ? totalChars / doc.numPages : 0;

      // Se TODAS as páginas falharam, é erro real — não é PDF escaneado
      if (errosPagina.length === doc.numPages && doc.numPages > 0) {
        throw new Error(
          `Erro ao extrair texto de todas as ${doc.numPages} página(s). ` +
          `Isso indica um problema no carregamento do PDF, não um PDF escaneado.\n\n` +
          errosPagina.join('\n'),
        );
      }

      if (mediaPorPagina >= CHARS_POR_PAGINA_MINIMO) {
        // ---- Tem camada de texto → analisar ----
        setStatus('Analisando dados do CNIS...');
        const resultado = parseCNISLinhas(linhas);

        if (!resultado.vinculos.length && !resultado.competencias.length) {
          resultado.avisos.unshift(
            '⚠ Texto extraído do PDF mas nenhum vínculo/competência reconhecido. ' +
            'Verifique se é um CNIS no formato esperado ou use a entrada manual.',
          );
        }

        if (errosPagina.length > 0) {
          resultado.avisos.unshift(
            `⚠ Erro ao ler ${errosPagina.length} página(s) — dados podem estar incompletos.`,
          );
        }

        setStatus(
          `Encontrados: ${resultado.vinculos.length} vínculo(s), ` +
          `${resultado.competencias.length} competência(s).`,
        );
        onParsed(resultado);
        if (inputRef.current) inputRef.current.value = '';
        return;
      }

      // =============================================================
      // Passo 3: pouco texto → tentar OCR com progresso e cancelamento
      // =============================================================
      setStatus(
        `PDF com pouco texto (${Math.round(mediaPorPagina)} caracteres/página em média) — ` +
        `tentando OCR...`,
      );

      try {
        const ocrLinhas = await ocrPdfRobusto(
          file,
          doc.numPages,
          setProgresso,
          cancelRef,
        );

        if (cancelRef.current) {
          setStatus('OCR cancelado.');
          setErro('');
          setProgresso(null);
          if (inputRef.current) inputRef.current.value = '';
          return;
        }

        const resultadoOCR = parseCNISLinhas(ocrLinhas);
        resultadoOCR.avisos.unshift(
          '⚠ EXTRAÇÃO POR OCR — conferência obrigatória reforçada. Verifique cada campo.',
        );

        if (resultadoOCR.vinculos.length || resultadoOCR.competencias.length) {
          setStatus(
            `OCR: ${resultadoOCR.vinculos.length} vínculo(s), ` +
            `${resultadoOCR.competencias.length} competência(s).`,
          );
          setProgresso(null);
          onParsed(resultadoOCR);
          if (inputRef.current) inputRef.current.value = '';
          return;
        }
      } catch (ocrErr) {
        if (cancelRef.current) {
          setStatus('OCR cancelado.');
          setProgresso(null);
          if (inputRef.current) inputRef.current.value = '';
          return;
        }
        const msg = ocrErr instanceof Error ? ocrErr.message : String(ocrErr);
        setErro(`OCR falhou: ${msg}. Use a entrada manual.`);
        setStatus('');
        setProgresso(null);
        if (inputRef.current) inputRef.current.value = '';
        return;
      }

      setErro(
        'Não encontrei dados no PDF — pode ser CNIS digitalizado com qualidade ' +
        'insuficiente para OCR. Use a entrada manual.',
      );
      setStatus('');
      setProgresso(null);
    } catch (err) {
      setErro(`Erro ao ler o PDF: ${err instanceof Error ? err.message : String(err)}`);
      setStatus('');
      setProgresso(null);
    }

    if (inputRef.current) inputRef.current.value = '';
  }

  return (
    <div className="card">
      <h4 style={{ marginBottom: 8, color: 'var(--azul-marinho)' }}>Upload do CNIS (PDF)</h4>
      <p className="text-muted" style={{ marginBottom: 16 }}>
        Selecione o PDF do Extrato Previdenciário (tipo &quot;Vínculos, contribuições e
        remunerações&quot;). O arquivo é processado localmente no seu navegador — nenhum dado é
        enviado a servidores externos.
      </p>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button className="btn btn-primario" onClick={() => inputRef.current?.click()}>
          Selecionar PDF
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf"
          style={{ display: 'none' }}
          onChange={handleFile}
        />
      </div>

      {status && <p className="text-muted mt-4">{status}</p>}

      {progresso && (
        <div className="mt-4" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <progress value={progresso.pagina} max={progresso.total} style={{ flex: 1 }} />
          <span className="text-muted">
            OCR: página {progresso.pagina}/{progresso.total}
          </span>
          <button
            className="btn btn-secundario"
            onClick={cancelarOCR}
            style={{ padding: '4px 12px' }}
          >
            Cancelar
          </button>
        </div>
      )}

      {erro && <div className="msg msg-erro mt-4">{erro}</div>}
    </div>
  );
}

// ===================================================================
// OCR robusto: progresso por página, timeout, cancelamento,
// yield entre páginas para não travar a UI
// ===================================================================
async function ocrPdfRobusto(
  file: File,
  numPages: number,
  onProgresso: (p: { pagina: number; total: number }) => void,
  cancelRef: React.RefObject<boolean>,
): Promise<string[]> {
  const Tesseract = await import('tesseract.js');
  const pdfjsLib = await import('pdfjs-dist');

  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjsLib.getDocument({ data }).promise;
  const linhas: string[] = [];

  for (let p = 1; p <= numPages; p++) {
    if (cancelRef.current) return linhas;

    onProgresso({ pagina: p, total: numPages });

    // Yield para a UI entre páginas
    await new Promise(r => setTimeout(r, 0));

    const page = await doc.getPage(p);
    const viewport = page.getViewport({ scale: 2 }); // 2x para melhor OCR
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d')!;
    await page.render({ canvasContext: ctx, viewport, canvas } as never).promise;

    // Timeout por página
    const resultado = await Promise.race([
      Tesseract.recognize(canvas, 'por'),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error(`OCR: timeout na página ${p} (>${Math.round(OCR_TIMEOUT_MS / 1000)}s)`)),
          OCR_TIMEOUT_MS,
        ),
      ),
    ]);

    linhas.push(...resultado.data.text.split('\n').filter((l: string) => l.trim()));
  }

  return linhas;
}
