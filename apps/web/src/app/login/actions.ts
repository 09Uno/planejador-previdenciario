'use server';

import { redirect } from 'next/navigation';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { criarSessao } from '@/lib/auth';
import { registrarEvento } from '@/lib/auditoria';

export async function loginAction(_prev: unknown, formData: FormData) {
  const email = String(formData.get('email') || '').trim().toLowerCase();
  const senha = String(formData.get('senha') || '');

  if (!email || !senha) {
    return { erro: 'Preencha e-mail e senha.' };
  }

  const usuario = await prisma.usuario.findUnique({ where: { email } });
  if (!usuario || !(await bcrypt.compare(senha, usuario.senhaHash))) {
    return { erro: 'E-mail ou senha incorretos.' };
  }

  await criarSessao({
    usuarioId: usuario.id,
    email: usuario.email,
    nome: usuario.nome,
    papel: usuario.papel,
    deveTrocarSenha: usuario.deveTrocarSenha,
  });

  await registrarEvento(usuario.id, 'login', `Login via e-mail`);

  if (usuario.deveTrocarSenha) {
    redirect('/trocar-senha');
  }

  redirect('/');
}
