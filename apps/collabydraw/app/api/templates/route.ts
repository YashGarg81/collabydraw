import { NextRequest, NextResponse } from "next/server";
import client from "@repo/db/client";

// Mapping of category IDs to display labels and emojis
const CATEGORY_META: Record<string, { label: string; emoji: string }> = {
  general: { label: "General", emoji: "📋" },
  flowchart: { label: "Flowcharts", emoji: "🔀" },
  wireframe: { label: "Wireframes", emoji: "📐" },
  mindmap: { label: "Mind Maps", emoji: "🧠" },
  kanban: { label: "Kanban", emoji: "📋" },
  diagram: { label: "Diagrams", emoji: "🗂️" },
  retro: { label: "Retrospective", emoji: "🔄" },
};

export async function GET(req: NextRequest) {
  const category = req.nextUrl.searchParams.get("category") ?? "";
  const q = req.nextUrl.searchParams.get("q") ?? "";

  const templates = await client.template.findMany({
    where: {
      isPublic: true,
      ...(category && category !== "all" ? { category } : {}),
      ...(q ? { name: { contains: q } } : {}),
    },
    orderBy: [{ usageCount: "desc" }, { createdAt: "desc" }],
  });

  // Group by category for the gallery UI
  const groupedCategories = Array.from(new Set(templates.map(t => t.category))).map(catId => ({
    category: catId,
    label: CATEGORY_META[catId]?.label || catId,
    emoji: CATEGORY_META[catId]?.emoji || "📄",
    templates: templates.filter(t => t.category === catId).map(t => {
      let shapeCount = 0;
      try {
        shapeCount = t.shapes ? JSON.parse(t.shapes).length : 0;
      } catch (e) {
        shapeCount = 0;
      }
      return {
        id: t.id,
        name: t.name,
        description: t.description,
        category: t.category,
        tags: [], // Tags currently not in DB but can be added if needed
        previewColor: "from-violet-600/30 to-indigo-600/20", // Default color
        shapeCount,
      };
    }),
  }));

  return NextResponse.json({ categories: groupedCategories, total: templates.length });
}
