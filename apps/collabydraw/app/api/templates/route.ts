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
      ...(category && category !== "all" ? { category } : {}),
      ...(q ? { name: { contains: q } } : {}),
    },
    include: {
      author: {
        select: {
          id: true,
          name: true,
          image: true,
        }
      }
    },
    orderBy: [{ downloads: "desc" }, { createdAt: "desc" }],
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
        price: t.price,
        isPaid: t.isPaid,
        downloads: t.downloads,
        author: {
          name: t.author?.name || "Anonymous",
          id: t.authorId,
          image: t.author?.image
        }
      };
    }),
  }));

  // Add trending category (top 4 templates by downloads overall)
  const trendingTemplates = [...templates]
    .sort((a, b) => b.downloads - a.downloads)
    .slice(0, 4)
    .map(t => {
      let shapeCount = 0;
      try { shapeCount = t.shapes ? JSON.parse(t.shapes).length : 0; } catch (e) {}
      return {
        id: t.id,
        name: t.name,
        description: t.description,
        category: t.category,
        tags: [],
        previewColor: "from-fuchsia-600/30 to-pink-600/20",
        shapeCount,
        price: t.price,
        isPaid: t.isPaid,
        downloads: t.downloads,
        author: {
          name: t.author?.name || "Anonymous",
          id: t.authorId,
          image: t.author?.image
        }
      };
    });

  if (trendingTemplates.length > 0 && category === "all" && !q) {
    groupedCategories.unshift({
      category: "trending",
      label: "Trending",
      emoji: "🔥",
      templates: trendingTemplates
    });
  }

  return NextResponse.json({ categories: groupedCategories, total: templates.length });
}
