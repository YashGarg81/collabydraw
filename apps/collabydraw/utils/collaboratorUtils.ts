"use client";

export type CursorState = {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  userId: string;
  userName: string;
  color: string;
  lastUpdate: number;
  isLaser?: boolean;
  isEditing?: boolean;
  selectionIds?: string[];
  viewport?: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
};

export function getCollaboratorColor(id: string): string {
  const colors = [
    "#E91E63", "#9C27B0", "#673AB7", "#3F51B5", "#2196F3",
    "#03A9F4", "#00BCD4", "#009688", "#4CAF50", "#8BC34A",
    "#CDDC39", "#FFEB3B", "#FFC107", "#FF9800", "#FF5722",
  ];
  if (!id) return colors[0];
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}
