import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const urlParam = req.nextUrl.searchParams.get("url");
  if (!urlParam) return NextResponse.json({ error: "URL is required" }, { status: 400 });

  // Example URL: https://github.com/facebook/react/issues/28569
  const match = urlParam.match(/github\.com\/([^\/]+)\/([^\/]+)\/issues\/(\d+)/);
  if (!match) return NextResponse.json({ error: "Invalid GitHub Issue URL" }, { status: 400 });

  const [_, owner, repo, issueNumber] = match;

  try {
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}`, {
      headers: {
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "CollabyDraw-Integration",
      }
    });

    if (!res.ok) {
      return NextResponse.json({ error: "Failed to fetch from GitHub" }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json({
      title: data.title,
      status: data.state, // open, closed
      url: data.html_url,
    });
  } catch (error) {
    return NextResponse.json({ error: "Internal error fetching GitHub issue" }, { status: 500 });
  }
}
