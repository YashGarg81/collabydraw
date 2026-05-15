import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const urlParam = req.nextUrl.searchParams.get("url");
  if (!urlParam) return NextResponse.json({ error: "URL is required" }, { status: 400 });

  // Example URL: https://domain.atlassian.net/browse/PROJ-123
  const match = urlParam.match(/([a-zA-Z0-9-]+)\.atlassian\.net\/browse\/([A-Z0-9]+-\d+)/);
  if (!match) return NextResponse.json({ error: "Invalid Jira Issue URL" }, { status: 400 });

  const [_, domain, issueKey] = match;

  // In a real application, we would use an OAuth token or stored API token from the Integration model.
  // For this mock implementation, we return a simulated response since we don't have user tokens.
  
  return NextResponse.json({
    title: `[${issueKey}] Simulated Jira Task`,
    status: "IN PROGRESS",
    url: urlParam,
  });
}
