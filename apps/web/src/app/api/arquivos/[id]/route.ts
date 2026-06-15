import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { prisma } from '@/lib/prisma';
import { lerSessao } from '@/lib/auth';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const sessao = await lerSessao();
  if (!sessao) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

  const { id } = await params;
  const arq = await prisma.arquivo.findUnique({ where: { id } });
  if (!arq) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 });

  const abs = join(process.cwd(), arq.caminho);
  const buffer = await readFile(abs);

  const inline = arq.tipo.startsWith('image/') || arq.tipo === 'application/pdf';
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': arq.tipo,
      'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="${arq.nome}"`,
      'Content-Length': String(buffer.length),
    },
  });
}
