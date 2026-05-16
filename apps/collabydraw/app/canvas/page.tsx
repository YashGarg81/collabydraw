import { Suspense } from "react";
import CanvasBoard from "@/components/canvas/CanvasBoard";
import ScreenLoading from "@/components/ScreenLoading";
import type { Metadata } from "next";
import { baseMetadata } from "@/utils/metadata";

export const metadata: Metadata = {
  ...baseMetadata,
  title: "Canvas | CollabyDraw — Hand-drawn • Collaborative • Secure",
  description:
    "Create beautiful hand-drawn sketches and diagrams with real-time collaboration. End-to-end encrypted, privacy-focused collaborative whiteboard.",
  openGraph: {
    ...baseMetadata.openGraph,
    title: "Canvas | CollabyDraw",
    description: "Collaborative whiteboard with AI superpowers.",
    url: "https://collabydraw.xyz/canvas",
  },
  alternates: { canonical: "https://collabydraw.xyz/canvas" },
};

export default async function CanvasPage() {
  return (
    <Suspense fallback={<ScreenLoading />}>
      <CanvasBoard />
    </Suspense>
  );
}

