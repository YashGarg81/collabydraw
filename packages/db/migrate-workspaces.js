const { PrismaClient } = require("./generated/client");
const prisma = new PrismaClient();

async function main() {
  console.log("🚀 Starting Workspace Migration...");

  // 1. Get all users
  const users = await prisma.user.findMany({
    include: {
      workspaces: true,
      boards: true,
      folders: true,
    }
  });

  console.log(`Found ${users.length} users to migrate.`);

  let migratedCount = 0;

  for (const user of users) {
    // Check if user already has a workspace
    let defaultWorkspace = await prisma.workspace.findFirst({
      where: {
        members: {
          some: {
            userId: user.id,
            role: "OWNER"
          }
        }
      }
    });

    if (!defaultWorkspace) {
      // Create Default Workspace
      defaultWorkspace = await prisma.workspace.create({
        data: {
          name: `${user.name || 'User'}'s Workspace`,
          slug: `workspace-${user.id.substring(0, 8)}`,
          members: {
            create: {
              userId: user.id,
              role: "OWNER",
            }
          }
        }
      });
      console.log(`✅ Created workspace for user ${user.email}`);
    }

    // Move all boards to the new workspace
    const boardsWithoutWorkspace = user.boards.filter(b => !b.workspaceId);
    if (boardsWithoutWorkspace.length > 0) {
      await prisma.board.updateMany({
        where: { ownerId: user.id, workspaceId: null },
        data: { workspaceId: defaultWorkspace.id }
      });
      console.log(`  -> Moved ${boardsWithoutWorkspace.length} boards.`);
    }

    // Move all folders to the new workspace
    const foldersWithoutWorkspace = user.folders.filter(f => !f.workspaceId);
    if (foldersWithoutWorkspace.length > 0) {
      await prisma.folder.updateMany({
        where: { ownerId: user.id, workspaceId: null },
        data: { workspaceId: defaultWorkspace.id }
      });
      console.log(`  -> Moved ${foldersWithoutWorkspace.length} folders.`);
    }

    migratedCount++;
  }

  console.log(`🎉 Migration complete! Processed ${migratedCount} users.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
