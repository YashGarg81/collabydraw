import { NextResponse } from "next/server";
import { TEMPLATES, TEMPLATE_CATEGORIES } from "@/data/templates";

// GET /api/templates — list all templates (grouped by category)
export async function GET() {
  const grouped = Object.entries(TEMPLATE_CATEGORIES).map(([cat, meta]) => ({
    category: cat,
    label: meta.label,
    emoji: meta.emoji,
    templates: TEMPLATES.filter(t => t.category === cat).map(t => ({
      id: t.id,
      name: t.name,
      description: t.description,
      category: t.category,
      tags: t.tags,
      previewColor: t.previewColor,
      shapeCount: t.shapes.length,
    })),
  }));

  return NextResponse.json({ categories: grouped, total: TEMPLATES.length });
}
