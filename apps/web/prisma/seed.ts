import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const senhaHash = await bcrypt.hash('mudar@123', 10);

  await prisma.usuario.upsert({
    where: { email: 'admin' },
    update: {},
    create: {
      nome: 'Administrador',
      email: 'admin',
      senhaHash,
      papel: 'admin',
      deveTrocarSenha: true,
    },
  });

  console.log('Seed concluído: usuário admin criado (admin / mudar@123).');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
