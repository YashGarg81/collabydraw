const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const templates = [
  {
    name: "Software Architecture",
    description: "Map out system components, APIs, and data flow.",
    category: "diagram",
    shapes: JSON.stringify([
      { id: "1", type: "rectangle", x: 100, y: 100, width: 150, height: 80, strokeFill: "#8b5cf6", bgFill: "rgba(139,92,246,0.1)", text: "API Gateway" },
      { id: "2", type: "rectangle", x: 350, y: 100, width: 150, height: 80, strokeFill: "#3b82f6", bgFill: "rgba(59,130,246,0.1)", text: "Auth Service" },
      { id: "3", type: "rectangle", x: 600, y: 100, width: 150, height: 80, strokeFill: "#10b981", bgFill: "rgba(16,185,129,0.1)", text: "User Service" }
    ])
  },
  {
    name: "Landing Page Wireframe",
    description: "Lo-fi wireframe for a modern SaaS landing page.",
    category: "wireframe",
    shapes: JSON.stringify([
      { id: "1", type: "rectangle", x: 0, y: 0, width: 800, height: 60, strokeFill: "#64748b", text: "Navbar" },
      { id: "2", type: "rectangle", x: 100, y: 150, width: 600, height: 200, strokeFill: "#64748b", text: "Hero Section" }
    ])
  },
  {
    name: "Brainstorming Mindmap",
    description: "Central theme with radiating ideas for creative sessions.",
    category: "mindmap",
    shapes: JSON.stringify([
      { id: "1", type: "ellipse", x: 350, y: 250, width: 150, height: 80, strokeFill: "#ec4899", text: "Main Goal" }
    ])
  },
  {
    name: "Kanban Board",
    description: "Manage tasks across To Do, In Progress, and Done columns.",
    category: "kanban",
    shapes: JSON.stringify([
      { id: "1", type: "rectangle", x: 50, y: 50, width: 250, height: 500, strokeFill: "#64748b", text: "To Do" },
      { id: "2", type: "rectangle", x: 320, y: 50, width: 250, height: 500, strokeFill: "#64748b", text: "In Progress" },
      { id: "3", type: "rectangle", x: 590, y: 50, width: 250, height: 500, strokeFill: "#64748b", text: "Done" }
    ])
  }
];

async function main() {
  console.log("Seeding templates...");
  for (const t of templates) {
    await prisma.template.upsert({
      where: { id: t.name.toLowerCase().replace(/\s+/g, "-") },
      update: t,
      create: {
        id: t.name.toLowerCase().replace(/\s+/g, "-"),
        ...t
      }
    });
  }
  console.log("Seeding complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
