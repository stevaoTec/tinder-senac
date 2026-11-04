import { prisma } from './prisma';

export async function ensureSeedUsers() {
  try {
    const demoUsers = await prisma.user.findMany({
      where: { email: { endsWith: '@demo.com' } },
      select: { id: true }
    });

    if (demoUsers.length === 0) return;

    const demoIds = demoUsers.map(u => u.id);

    const demoMatches = await prisma.match.findMany({
      where: {
        OR: [
          { user1Id: { in: demoIds } },
          { user2Id: { in: demoIds } }
        ]
      },
      select: { id: true }
    });
    const demoMatchIds = demoMatches.map(m => m.id);

    if (demoMatchIds.length > 0) {
      await prisma.message.deleteMany({
        where: { matchId: { in: demoMatchIds } }
      });
      await prisma.match.deleteMany({
        where: { id: { in: demoMatchIds } }
      });
    }

    await prisma.message.deleteMany({
      where: { senderId: { in: demoIds } }
    });

    await prisma.swipe.deleteMany({
      where: {
        OR: [
          { swiperId: { in: demoIds } },
          { swipedId: { in: demoIds } }
        ]
      }
    });

    await prisma.user.deleteMany({
      where: { id: { in: demoIds } }
    });

    console.log(`Removidos ${demoIds.length} perfis fictícios (@demo.com) do banco de dados.`);
  } catch (err) {
    console.error('Aviso ao limpar perfis fictícios:', err);
  }
}
