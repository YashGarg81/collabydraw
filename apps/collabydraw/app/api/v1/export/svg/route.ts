import { NextRequest, NextResponse } from "next/server";

/**
 * Phase 4: Dynamic Asset Generation System
 * Generates a standalone SVG from canvas shapes.
 */

export async function POST(req: NextRequest) {
  try {
    const { shapes, width = 1200, height = 800, theme = 'dark' } = await req.json();

    if (!Array.isArray(shapes)) {
      return NextResponse.json({ error: "Invalid shapes" }, { status: 400 });
    }

    const bgColor = theme === 'dark' ? '#06060c' : '#ffffff';
    const textColor = theme === 'dark' ? '#ffffff' : '#000000';

    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <rect width="100%" height="100%" fill="${bgColor}" />
      <defs>
        <style>
          .shape-text { font-family: 'Inter', sans-serif; font-size: 14px; fill: ${textColor}; }
        </style>
      </defs>`;

    shapes.forEach((s: any) => {
      const stroke = s.strokeFill || (theme === 'dark' ? '#ffffff' : '#000000');
      const fill = s.bgFill || 'none';
      const strokeWidth = s.strokeWidth || 1;

      switch (s.type) {
        case 'rectangle':
          svg += `<rect x="${s.x}" y="${s.y}" width="${s.width}" height="${s.height}" stroke="${stroke}" stroke-width="${strokeWidth}" fill="${fill}" rx="${s.rounded === 'round' ? 8 : 0}" />`;
          break;
        case 'ellipse':
          svg += `<ellipse cx="${s.x}" cy="${s.y}" rx="${s.radX}" ry="${s.radY}" stroke="${stroke}" stroke-width="${strokeWidth}" fill="${fill}" />`;
          break;
        case 'line':
        case 'arrow':
          svg += `<line x1="${s.x}" y1="${s.y}" x2="${s.toX}" y2="${s.toY}" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
          if (s.type === 'arrow') {
            // Simple arrow head logic could go here
          }
          break;
        case 'text':
          svg += `<text x="${s.x}" y="${s.y + 20}" class="shape-text" text-anchor="${s.textAlign || 'left'}">${s.text}</text>`;
          break;
      }
    });

    svg += `</svg>`;

    return new Response(svg, {
      headers: {
        "Content-Type": "image/svg+xml",
        "Content-Disposition": `attachment; filename="export.svg"`,
      },
    });
  } catch (error) {
    console.error("[EXPORT_SVG]", error);
    return NextResponse.json({ error: "Failed to generate SVG" }, { status: 500 });
  }
}
