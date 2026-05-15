import { NextRequest, NextResponse } from "next/server";
import { BASE_URL } from "@/config/constants";

export async function GET(req: NextRequest) {
  const urlParam = req.nextUrl.searchParams.get("url");
  if (!urlParam) {
    return NextResponse.json({ error: "URL is required" }, { status: 400 });
  }

  // Expect URL format: https://collabydraw.xyz/embed/abc12345
  const match = urlParam.match(/\/embed\/([a-zA-Z0-9_-]+)/);
  if (!match) {
    return NextResponse.json({ error: "Invalid board URL" }, { status: 400 });
  }

  const boardId = match[1];

  const oembed = {
    version: "1.0",
    type: "rich",
    title: "CollabyDraw Board",
    provider_name: "CollabyDraw",
    provider_url: BASE_URL,
    html: `<iframe src="${BASE_URL}/embed/${boardId}" width="100%" height="600" style="border:none;border-radius:12px;" allowfullscreen></iframe>`,
    width: 800,
    height: 600,
  };

  return NextResponse.json(oembed);
}
