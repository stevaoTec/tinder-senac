const fs = require('fs');
const path = require('path');

const schemaPath = path.join(__dirname, 'schema.prisma');
let schema = fs.readFileSync(schemaPath, 'utf8');

const dbUrl = process.env.DATABASE_URL || '';

if (dbUrl.startsWith('postgres://') || dbUrl.startsWith('postgresql://')) {
  console.log('[Prisma] Detectado DATABASE_URL PostgreSQL (Neon/Supabase). Configurando provider = "postgresql"...');
  schema = schema.replace(
    /datasource\s+db\s*\{[\s\S]*?\}/,
    `datasource db {\n  provider = "postgresql"\n  url      = env("DATABASE_URL")\n}`
  );
} else {
  console.log('[Prisma] Usando banco local SQLite (file:../data/matchvibe.db)...');
  schema = schema.replace(
    /datasource\s+db\s*\{[\s\S]*?\}/,
    `datasource db {\n  provider = "sqlite"\n  url      = "file:../data/matchvibe.db"\n}`
  );
}

fs.writeFileSync(schemaPath, schema, 'utf8');

