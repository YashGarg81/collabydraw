import CanvasBoard from "@/components/canvas/CanvasBoard";
import type { Metadata } from "next";
import { baseMetadata } from "@/utils/metadata";

export const metadata: Metadata = {
  ...baseMetadata,
  title: "Collabydraw | Hand-drawn look & feel • Collaborative • Secure",
  description:
    "Create beautiful hand-drawn sketches and diagrams with real-time collaboration. End-to-end encrypted, privacy-focused collaborative whiteboard. No account required to start drawing.",
  openGraph: {
    ...baseMetadata.openGraph,
    title: "Collabydraw | Hand-drawn look & feel • Collaborative • Secure",
    description:
      "Create beautiful hand-drawn sketches and diagrams with real-time collaboration. End-to-end encrypted, privacy-focused collaborative whiteboard.",
    url: "https://collabydraw.xyz",
  },
  twitter: {
    ...baseMetadata.twitter,
    title: "Collabydraw | Hand-drawn look & feel • Collaborative • Secure",
    description:
      "Create beautiful hand-drawn sketches and diagrams with real-time collaboration. End-to-end encrypted, privacy-focused collaborative whiteboard.",
  },
  alternates: {
    canonical: "https://collabydraw.xyz",
  },
};

export default async function Home() {
  return (
    <CanvasBoard />
  )
}