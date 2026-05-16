"use client";

const COLLABORATOR_COLORS = [
  "#f08c00", // Orange
  "#2f9e44", // Green
  "#1971c2", // Blue
  "#e64980", // Pink
  "#7950f2", // Violet
  "#e03131", // Red
  "#0b7285", // Cyan
  "#5f3dc4", // Grape
  "#66a80f", // Lime
  "#d9480f", // Vermilion
];

/**
 * Returns a deterministic color for a given ID (userId or connectionId)
 */
export function getCollaboratorColor(id: string): string {
  if (!id) return COLLABORATOR_COLORS[0];
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  return COLLABORATOR_COLORS[Math.abs(hash) % COLLABORATOR_COLORS.length];
}

export interface CursorState {
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
  viewport?: { x: number, y: number, w: number, h: number };
}
