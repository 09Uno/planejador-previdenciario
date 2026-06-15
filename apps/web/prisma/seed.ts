import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const senhaHash = await bcrypt.hash('mudar@123', 10);

  await prisma.usuario.upsert({
    where: { email: 'laura@metodoadvdigital.com.br' },
    update: {},
    create: {
      nome: 'Laura (Admin)',
      email: 'laura@metodoadvdigital.com.br',
      senhaHash,
      papel: 'admin',
      deveTrocarSenha: true,
    },
  });

  console.log('Seed concluído: usuária admin criada.');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
