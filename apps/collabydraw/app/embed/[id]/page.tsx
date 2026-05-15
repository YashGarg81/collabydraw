import { redirect } from "next/navigation";
import client from "@repo/db/client";

// Simplified read-only embed view
export default async function EmbedPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  
  // Try to find public board first
  let board = await client.board.findUnique({
    where: { id },
  });

  if (!board) {
    return <div className="p-8 text-white text-center font-mono bg-zinc-900 h-screen flex flex-col items-center justify-center">Board not found.</div>;
  }

  if (!board.isPublic) {
    return (
      <div className="p-8 text-white text-center font-sans bg-zinc-900 h-screen flex flex-col items-center justify-center">
        <h2 className="text-xl font-bold mb-2">Private Board</h2>
        <p className="text-white/50 text-sm">This board requires authentication to view.</p>
        <a href={`/canvas?board=${id}`} target="_blank" rel="noreferrer" className="mt-4 px-4 py-2 bg-violet-600 rounded-lg text-sm font-semibold hover:bg-violet-500 transition-colors">
          Open in CollabyDraw
        </a>
      </div>
    );
  }

  // If public, we redirect to the canvas with a read-only param
  redirect(`/canvas?board=${id}&view=embed`);
}
