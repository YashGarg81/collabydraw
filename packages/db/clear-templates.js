const { PrismaClient } = require('./generated/client');
const prisma = new PrismaClient();

async function main() {
  await prisma.template.deleteMany({});
  console.log("Cleared templates");
}

main().catch(console.error).finally(() => prisma.$disconnect());
