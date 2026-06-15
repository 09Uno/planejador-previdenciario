'use server';

import { redirect } from 'next/navigation';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { lerSessao, criarSessao } from '@/lib/auth';
import { registrarEvento } from '@/lib/auditoria';

export async function trocarSenhaAction(_prev: unknown, formData: FormData) {
  const sessao = await lerSessao();
  if (!sessao) redirect('/login');

  const nova = String(formData.get('nova') || '');
  const confirma = String(formData.get('confirma') || '');

  if (nova.length < 6) {
    return { erro: 'A nova senha deve ter ao menos 6 caracteres.' };
  }
  if (nova !== confirma) {
    return { erro: 'As senhas não coincidem.' };
  }

  const senhaHash = await bcrypt.hash(nova, 10);
  await prisma.usuario.update({
    where: { id: sessao.usuarioId },
    data: { senhaHash, deveTrocarSenha: false },
  });

  await registrarEvento(sessao.usuarioId, 'troca_senha', 'Senha alterada no primeiro acesso');

  // Recriar sessão sem flag de troca
  await criarSessao({ ...sessao, deveTrocarSenha: false });

  redirect('/');
}
