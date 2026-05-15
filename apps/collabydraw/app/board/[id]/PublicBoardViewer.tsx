"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Eye, Download, ExternalLink, Globe } from "lucide-react";
import { CanvasEngine } from "@/canvas-engine/CanvasEngine";

interface Board {
  id: string;
  name: string;
  description: string | null;
  isPublic: boolean;
  shapes: string;
}

export default function PublicBoardViewer({ board }: { board: Board }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<CanvasEngine | null>(null);
  const [shapeCount, setShapeCount] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const engine = new CanvasEngine(
      canvas,
      null,          // roomId — read-only, no room
      null,          // userId
      null,          // userName
      null,          // token
      "#0a0a0f",     // canvasBgColor
      () => {},      // onScaleChangeCallback
      true,          // isStandalone
      null,          // onParticipantsUpdate
      null,          // onConnectionChange
      null,          // encryptionKey
      "dark"         // appTheme
    );
    engineRef.current = engine;

    // Load shapes
    let shapes: object[] = [];
    try { shapes = JSON.parse(board.shapes); } catch { shapes = []; }

    if (shapes.length > 0) {
      engine.addShapes(shapes as never[]);
      setShapeCount(shapes.length);
    }

    // Resize handler
    const onResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight - 64;
    };
    onResize();
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      engine.destroy?.();
    };
  }, [board.shapes]);

  const handleExport = () => engineRef.current?.exportToPNG();

  return (
    <div className="flex flex-col h-screen bg-[#0a0a0f] overflow-hidden">
      {/* Read-only banner */}
      <header className="h-14 shrink-0 border-b border-white/6 bg-[#0d0d14]/95 backdrop-blur-xl flex items-center px-5 gap-4 z-20">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="none" className="w-3 h-3 text-white" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <span className="font-bold text-white text-sm hidden sm:block">CollabyDraw</span>
        </Link>

        <div className="w-px h-4 bg-white/10" />

        <div className="flex items-center gap-2 min-w-0 flex-1">
          <h1 className="text-sm font-semibold text-white truncate">{board.name}</h1>
          {board.description && (
            <span className="text-xs text-white/30 truncate hidden md:block">— {board.description}</span>
          )}
        </div>

        {/* Read-only badge */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-emerald-500/25 bg-emerald-500/8 text-emerald-400 text-xs font-medium">
          <Globe className="w-3 h-3" />
          Public · Read-only
        </div>

        {/* Stats */}
        <div className="flex items-center gap-1.5 text-xs text-white/30">
          <Eye className="w-3.5 h-3.5" />
          {shapeCount} shapes
        </div>

        {/* Actions */}
        <button
          onClick={handleExport}
          title="Export as PNG"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 bg-white/4 hover:bg-white/8 text-white/60 hover:text-white text-xs transition-all"
        >
          <Download className="w-3.5 h-3.5" />
          <span className="hidden sm:block">Export PNG</span>
        </button>

        <Link
          href="/auth/signin"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium transition-all"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          <span className="hidden sm:block">Edit in CollabyDraw</span>
        </Link>
      </header>

      {/* Canvas */}
      <div className="flex-1 relative overflow-hidden">
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
      </div>
    </div>
  );
}
