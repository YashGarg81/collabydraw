import { PrismaClient } from '../generated/client';

const prismaClientSingleton = () => {
    return new PrismaClient;
}

type PrismaClientSingleton = ReturnType<typeof prismaClientSingleton>;

const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClientSingleton | undefined;
};

const prisma = globalForPrisma.prisma ?? prismaClientSingleton();

export default prisma;
export * from "./permissions";

if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = prisma;
}