import { Metadata } from "next";
import client from "@repo/db/client";
import { notFound } from "next/navigation";
import PublicBoardViewer from "./PublicBoardViewer";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const board = await client.board.findUnique({ where: { id }, select: { name: true, description: true } });
  return {
    title: board ? `${board.name} — CollabyDraw` : "Board — CollabyDraw",
    description: board?.description ?? "View this collaborative whiteboard on CollabyDraw",
  };
}

export default async function PublicBoardPage({ params }: Props) {
  const { id } = await params;
  const board = await client.board.findUnique({
    where: { id },
    select: { id: true, name: true, description: true, isPublic: true, shapes: true, ownerId: true },
  });

  if (!board || !board.isPublic) notFound();

  return <PublicBoardViewer board={board} />;
}
