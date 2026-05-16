import client from "./index";

export type SessionUser = {
  id: string;
  email: string;
  role: string;
  isBanned: boolean;
};

/**
 * Checks if a user has access to a specific board.
 * - Platform admins have full access.
 * - Board public roles can allow viewer/editor access.
 * - Workspace members have access based on their workspace role.
 */
export async function canAccessBoard(user: SessionUser | undefined, boardId: string, requiredAccess: "VIEWER" | "EDITOR"): Promise<boolean> {
  const board = await client.board.findUnique({
    where: { id: boardId },
    include: {
      workspace: {
        include: {
          members: true
        }
      }
    }
  });

  if (!board) return false;

  // Platform admin override
  if (user?.role === "ADMIN") return true;

  // Public board access
  if (board.isPublic) {
    if (requiredAccess === "VIEWER") return true;
    if (requiredAccess === "EDITOR" && board.publicRole === "EDITOR") return true;
  }

  // If no user is logged in and it's not public, deny
  if (!user) return false;
  if (user.isBanned) return false;

  // Legacy direct ownership fallback
  if (board.ownerId === user.id) return true;

  // Workspace-based access
  if (board.workspaceId) {
    const membership = board.workspace?.members.find(m => m.userId === user.id);
    if (!membership) return false;
    
    // Roles: OWNER, ADMIN, MEMBER, VIEWER
    if (membership.role === "OWNER" || membership.role === "ADMIN") return true;
    if (membership.role === "MEMBER") return true; // Members can generally view/edit workspace boards
    if (membership.role === "VIEWER" && requiredAccess === "VIEWER") return true;
  }

  return false;
}

/**
 * Checks if a user can manage a specific workspace (i.e. is OWNER or ADMIN).
 */
export async function canManageWorkspace(user: SessionUser, workspaceId: string): Promise<boolean> {
  if (user.role === "ADMIN") return true; // Platform Admin override
  if (user.isBanned) return false;

  const membership = await client.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId,
        userId: user.id
      }
    }
  });

  if (!membership) return false;
  return membership.role === "OWNER" || membership.role === "ADMIN";
}

/**
 * Checks if a user is a Platform Admin
 */
export function isPlatformAdmin(user: SessionUser | undefined): boolean {
  if (!user || user.isBanned) return false;
  return user.role === "ADMIN";
}
