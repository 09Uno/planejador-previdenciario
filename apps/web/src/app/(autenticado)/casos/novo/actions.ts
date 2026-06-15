'use server';

import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { lerSessao } from '@/lib/auth';
import { registrarEvento } from '@/lib/auditoria';

export async function criarCasoAction(_prev: unknown, formData: FormData) {
  const sessao = await lerSessao();
  if (!sessao) redirect('/login');

  const clienteNome = String(formData.get('clienteNome') || '').trim();
  const sexo = String(formData.get('sexo') || 'M');
  const nascimento = String(formData.get('nascimento') || '').trim();

  if (!clienteNome) return { erro: 'Informe o nome do cliente.' };
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(nascimento)) return { erro: 'Nascimento deve estar no formato dd/mm/aaaa.' };
  if (sexo !== 'M' && sexo !== 'F') return { erro: 'Sexo inválido.' };

  const caso = await prisma.caso.create({
    data: {
      clienteNome,
      sexo,
      nascimento,
      criadoPorId: sessao.usuarioId,
    },
  });

  await registrarEvento(sessao.usuarioId, 'criar_caso', `Caso criado: ${clienteNome}`, caso.id);

  redirect(`/casos/${caso.id}`);
}
