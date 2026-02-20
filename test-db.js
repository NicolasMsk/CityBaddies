const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  try {
    const count = await p.deal.count();
    console.log('✅ Connexion OK — Deals en base:', count);
  } catch (e) {
    console.error('❌ ERREUR:', e.message);
  } finally {
    await p.$disconnect();
  }
}

main();
