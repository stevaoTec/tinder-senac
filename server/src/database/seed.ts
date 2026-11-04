import bcrypt from 'bcryptjs';
import { prisma } from './prisma';

export async function ensureSeedUsers() {
  try {
    const userCount = await prisma.user.count();
    if (userCount > 0) return;

    const hashedPassword = bcrypt.hashSync('123456', 10);
    const seedUsers = [
      {
        email: 'ana@demo.com', name: 'Ana Silva', bio: 'Amo viajar e conhecer pessoas novas', age: 23, gender: 'F', verified: 1,
        interests: ['Viagens', 'Fotografia', 'Cafe', 'Vinho'],
        photos: ['https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&q=80', 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=500&q=80']
      },
      {
        email: 'lucas@demo.com', name: 'Lucas Santos', bio: 'Musico e amante de cafe', age: 25, gender: 'M', verified: 1,
        interests: ['Musica', 'Rock', 'Cafe', 'Academia'],
        photos: ['https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=500&q=80', 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=500&q=80']
      },
      {
        email: 'maria@demo.com', name: 'Maria Oliveira', bio: 'Fotografa e aventureira', age: 22, gender: 'F', verified: 0,
        interests: ['Aventura', 'Natureza', 'Animais'],
        photos: ['https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=500&q=80']
      },
      {
        email: 'pedro@demo.com', name: 'Pedro Costa', bio: 'Dev por dia, chef por noite', age: 27, gender: 'M', verified: 1,
        interests: ['Tecnologia', 'Culinaria', 'Games', 'Animes'],
        photos: ['https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=500&q=80']
      },
      {
        email: 'julia@demo.com', name: 'Julia Ferreira', bio: 'Amo praia, sol e boas risadas', age: 24, gender: 'F', verified: 1,
        interests: ['Praia', 'Festas', 'Danca'],
        photos: ['https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=500&q=80', 'https://images.unsplash.com/photo-1517365830460-955ce3ccd263?w=500&q=80']
      },
      {
        email: 'rafael@demo.com', name: 'Rafael Almeida', bio: 'Esportista e nerd nas horas vagas', age: 26, gender: 'M', verified: 0,
        interests: ['Esportes', 'Futebol', 'Games'],
        photos: ['https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=500&q=80']
      },
      {
        email: 'camila@demo.com', name: 'Camila Rodrigues', bio: 'Artista e sonhadora', age: 21, gender: 'F', verified: 1,
        interests: ['Arte', 'Pintura', 'Museus', 'Moda'],
        photos: ['https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=500&q=80']
      },
      {
        email: 'bruno@demo.com', name: 'Bruno Martins', bio: 'Surfista e amante da natureza', age: 28, gender: 'M', verified: 1,
        interests: ['Surf', 'Trilhas', 'Meditacao'],
        photos: ['https://images.unsplash.com/photo-1488161628813-04466f872528?w=500&q=80']
      }
    ];

    for (const user of seedUsers) {
      const avatarUrl = user.photos[0];
      const lat = -23.5505 + (Math.random() - 0.5) * 0.1;
      const lng = -46.6333 + (Math.random() - 0.5) * 0.1;

      await prisma.user.create({
        data: {
          email: user.email,
          password: hashedPassword,
          name: user.name,
          bio: user.bio,
          age: user.age,
          gender: user.gender,
          profilePhoto: avatarUrl,
          photos: JSON.stringify(user.photos),
          interests: JSON.stringify(user.interests),
          verified: user.verified,
          latitude: lat,
          longitude: lng
        }
      });
    }

    console.log('8 perfis iniciais criados automaticamente (senha: 123456)');
  } catch (err) {
    console.error('Aviso ao verificar seed inicial:', err);
  }
}

