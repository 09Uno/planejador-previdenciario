'use client';

/**
 * Extrai o texto de um PDF no navegador via pdfjs-dist (todas as páginas).
 * Se o PDF for escaneado (texto esparso), faz fallback de OCR com tesseract.js
 * em português. Usado para a leitura automática de PPP/CTC/CTSM.
 */
export async function extrairTextoPDF(data: Uint8Array): Promise<{ texto: string; ocr: boolean }> {
  const pdfjsLib = await import('pdfjs-dist');
  if (typeof window !== 'undefined') {
    try { pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'; } catch { /* roda no main thread */ }
  }

  const doc = await pdfjsLib.getDocument({ data }).promise;

  // 1) tentativa digital (texto selecionável)
  let texto = '';
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const tc = await page.getTextContent();
    texto += ' ' + tc.items
      .filter(it => 'str' in it)
      .map(it => (it as { str: string }).str)
      .join(' ');
  }

  // 2) fallback OCR se o texto saiu vazio/esparso (PDF escaneado/imagem)
  if (texto.replace(/\s+/g, '').length < 40) {
    try {
      const Tesseract = await import('tesseract.js');
      let ocrTxt = '';
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        const viewport = page.getViewport({ scale: 2 });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) continue;
        await page.render({ canvasContext: ctx, viewport, canvas } as never).promise;
        const res = await Tesseract.recognize(canvas, 'por');
        ocrTxt += ' ' + res.data.text;
      }
      if (ocrTxt.replace(/\s+/g, '').length > texto.replace(/\s+/g, '').length) {
        return { texto: ocrTxt, ocr: true };
      }
    } catch {
      // OCR indisponível — segue com o texto digital (mesmo que pobre)
    }
  }

  return { texto, ocr: false };
}

/** Converte dd/mm/aaaa → timestamp (para comparar períodos). */
function ts(d: string): number | null {
  const m = d.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!m) return null;
  return Date.UTC(+m[3], +m[2] - 1, +m[1]);
}

/**
 * Acha o índice do período do caso que melhor casa com um período extraído
 * (maior sobreposição de datas). Retorna -1 se não houver sobreposição.
 */
export function acharPeriodoIndex(
  extraido: { ini: string; fim: string } | undefined,
  periodos: { ini: string; fim: string }[],
): number {
  if (!extraido) return -1;
  const ei = ts(extraido.ini), ef = ts(extraido.fim);
  if (ei == null || ef == null) return -1;
  let melhor = -1, maiorSobrep = 0;
  periodos.forEach((p, i) => {
    const pi = ts(p.ini), pf = ts(p.fim);
    if (pi == null || pf == null) return;
    const sobrep = Math.min(ef, pf) - Math.max(ei, pi);
    if (sobrep > maiorSobrep) { maiorSobrep = sobrep; melhor = i; }
  });
  return melhor;
}
