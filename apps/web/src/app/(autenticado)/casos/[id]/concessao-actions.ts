'use server';

import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { lerSessao } from '@/lib/auth';
import { registrarEvento } from '@/lib/auditoria';

export interface DadosConcessao {
  dib?: string;
  rmiConcedida?: number;
  especie?: string;
  ddb?: string;
  cartaJson?: string;
}

export async function salvarConcessaoAction(casoId: string, dados: DadosConcessao) {
  const sessao = await lerSessao();
  if (!sessao) redirect('/login');

  await prisma.concessao.upsert({
    where: { casoId },
    update: {
      dib: dados.dib,
      rmiConcedida: dados.rmiConcedida,
      especie: dados.especie,
      ddb: dados.ddb,
      cartaJson: dados.cartaJson,
    },
    create: {
      casoId,
      dib: dados.dib,
      rmiConcedida: dados.rmiConcedida,
      especie: dados.especie,
      ddb: dados.ddb,
      cartaJson: dados.cartaJson,
    },
  });

  // Verificar divergências com cenário selecionado
  const caso = await prisma.caso.findUnique({
    where: { id: casoId },
    include: { cenarios: true },
  });

  const divergencias: string[] = [];
  if (caso && dados.rmiConcedida) {
    const cenarioSelecionado = caso.cenarios.find(c => {
      const p = JSON.parse(c.premissasJson);
      return p.selecionado;
    });
    if (cenarioSelecionado) {
      const resultado = JSON.parse(cenarioSelecionado.resultadoJson);
      if (resultado.rmi?.rmi) {
        const diff = Math.abs(dados.rmiConcedida - resultado.rmi.rmi);
        const pct = diff / resultado.rmi.rmi;
        if (pct > 0.05) {
          divergencias.push(`RMI divergente: concedida R$ ${dados.rmiConcedida.toFixed(2)} vs planejada R$ ${resultado.rmi.rmi.toFixed(2)} (diferença de ${(pct * 100).toFixed(1)}% > 5%). Possível revisão.`);
        }
      }
      if (dados.dib && resultado.dib && dados.dib !== resultado.dib) {
        divergencias.push(`DIB divergente: concedida ${dados.dib} vs planejada ${resultado.dib}. Verificar.`);
      }
    }
  }

  if (divergencias.length > 0) {
    await prisma.concessao.update({
      where: { casoId },
      data: { divergencias: JSON.stringify(divergencias) },
    });
  }

  await registrarEvento(
    sessao.usuarioId,
    'registrar_concessao',
    `Concessão registrada: RMI ${dados.rmiConcedida?.toFixed(2) ?? '?'}, DIB ${dados.dib ?? '?'}${divergencias.length ? ` — ${divergencias.length} divergência(s)` : ''}`,
    casoId,
  );

  return { ok: true, divergencias };
}

export async function carregarConcessaoAction(casoId: string) {
  return prisma.concessao.findUnique({ where: { casoId } });
}
