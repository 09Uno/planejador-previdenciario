'use server';

import { redirect } from 'next/navigation';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { criarSessao } from '@/lib/auth';
import { registrarEvento } from '@/lib/auditoria';

export async function loginAction(_prev: unknown, formData: FormData) {
  const usuario = String(formData.get('usuario') || '').trim().toLowerCase();
  const senha = String(formData.get('senha') || '');

  if (!usuario || !senha) {
    return { erro: 'Preencha usuário e senha.' };
  }

  // Busca por email (retrocompat) ou pelo campo email usado como username
  const user = await prisma.usuario.findUnique({ where: { email: usuario } });
  if (!user || !(await bcrypt.compare(senha, user.senhaHash))) {
    return { erro: 'Usuário ou senha incorretos.' };
  }

  await criarSessao({
    usuarioId: user.id,
    email: user.email,
    nome: user.nome,
    papel: user.papel,
    deveTrocarSenha: user.deveTrocarSenha,
  });

  await registrarEvento(user.id, 'login', `Login: ${usuario}`);

  if (user.deveTrocarSenha) {
    redirect('/trocar-senha');
  }

  redirect('/');
}
