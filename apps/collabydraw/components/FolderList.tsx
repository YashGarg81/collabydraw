"use client";

import React, { useState, useCallback } from "react";
import { FolderOpen, FolderPlus, Folder, ChevronRight, ChevronDown, MoreHorizontal, Pencil, Trash2, X, Plus } from "lucide-react";

interface BoardStub { id: string; name: string; }
export interface FolderItem {
  id: string;
  name: string;
  boards: { board: BoardStub }[];
}

interface FolderListProps {
  folders: FolderItem[];
  allBoards: BoardStub[];
  onFolderCreated: (folder: FolderItem) => void;
  onFolderRenamed: (id: string, name: string) => void;
  onFolderDeleted: (id: string) => void;
  onBoardAddedToFolder: (folderId: string, boardId: string) => void;
  onBoardRemovedFromFolder: (folderId: string, boardId: string) => void;
}

export function FolderList({
  folders,
  allBoards,
  onFolderCreated,
  onFolderRenamed,
  onFolderDeleted,
  onBoardAddedToFolder,
  onBoardRemovedFromFolder,
}: FolderListProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [menuId, setMenuId] = useState<string | null>(null);
  const [addBoardFolderId, setAddBoardFolderId] = useState<string | null>(null);

  const toggle = (id: string) => setExpandedIds(prev => {
    const next = new Set(prev);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    return next;
  });

  const handleCreate = useCallback(async () => {
    const name = newFolderName.trim() || "New Folder";
    const res = await fetch("/api/folders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (res.ok) {
      const data = await res.json();
      onFolderCreated({ ...data.folder, boards: [] });
    }
    setCreatingFolder(false);
    setNewFolderName("");
  }, [newFolderName, onFolderCreated]);

  const handleRename = useCallback(async (id: string) => {
    const name = renameValue.trim();
    if (!name) { setRenamingId(null); return; }
    await fetch(`/api/folders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    onFolderRenamed(id, name);
    setRenamingId(null);
  }, [renameValue, onFolderRenamed]);

  const handleDelete = useCallback(async (id: string) => {
    await fetch(`/api/folders/${id}`, { method: "DELETE" });
    onFolderDeleted(id);
    setMenuId(null);
  }, [onFolderDeleted]);

  const handleAddBoard = useCallback(async (folderId: string, boardId: string) => {
    await fetch(`/api/folders/${folderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ addBoardId: boardId }),
    });
    onBoardAddedToFolder(folderId, boardId);
    setAddBoardFolderId(null);
  }, [onBoardAddedToFolder]);

  const handleRemoveBoard = useCallback(async (folderId: string, boardId: string) => {
    await fetch(`/api/folders/${folderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ removeBoardId: boardId }),
    });
    onBoardRemovedFromFolder(folderId, boardId);
  }, [onBoardRemovedFromFolder]);

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between px-3 mb-1">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-white/25">Folders</span>
        <button
          onClick={() => setCreatingFolder(true)}
          className="p-0.5 rounded text-white/30 hover:text-white/60 hover:bg-white/8 transition-colors"
          title="New folder"
        >
          <FolderPlus className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* New folder input */}
      {creatingFolder && (
        <div className="px-3 mb-1 flex items-center gap-1">
          <input
            autoFocus
            className="flex-1 bg-white/8 border border-violet-500/40 rounded px-2 py-1 text-xs text-white outline-none"
            placeholder="Folder name…"
            value={newFolderName}
            onChange={e => setNewFolderName(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter") handleCreate();
              if (e.key === "Escape") { setCreatingFolder(false); setNewFolderName(""); }
            }}
            suppressHydrationWarning
          />
          <button onClick={handleCreate} className="p-1 text-violet-400 hover:text-violet-300">
            <Plus className="w-3 h-3" />
          </button>
          <button onClick={() => { setCreatingFolder(false); setNewFolderName(""); }} className="p-1 text-white/30 hover:text-white/60">
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {folders.length === 0 && !creatingFolder && (
        <p className="px-3 text-xs text-white/20 py-1">No folders yet</p>
      )}

      {folders.map(folder => {
        const isOpen = expandedIds.has(folder.id);
        return (
          <div key={folder.id} className="select-none">
            <div
              className="group flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white/45 hover:text-white/70 hover:bg-white/5 text-sm cursor-pointer transition-colors"
              onClick={() => toggle(folder.id)}
            >
              <span className="text-white/20">{isOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}</span>
              {isOpen ? <FolderOpen className="w-3.5 h-3.5 text-violet-400" /> : <Folder className="w-3.5 h-3.5 text-white/30" />}

              {renamingId === folder.id ? (
                <input
                  autoFocus
                  className="flex-1 bg-transparent border-b border-violet-500/60 text-xs text-white outline-none min-w-0"
                  value={renameValue}
                  onClick={e => e.stopPropagation()}
                  onChange={e => setRenameValue(e.target.value)}
                  onKeyDown={e => {
                    e.stopPropagation();
                    if (e.key === "Enter") handleRename(folder.id);
                    if (e.key === "Escape") setRenamingId(null);
                  }}
                  suppressHydrationWarning
                />
              ) : (
                <span className="flex-1 truncate text-xs">{folder.name}</span>
              )}

              <span className="text-[10px] text-white/20">{folder.boards.length}</span>

              <div className="relative" onClick={e => e.stopPropagation()}>
                <button
                  className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-white/10 text-white/30 hover:text-white/60 transition"
                  onClick={() => setMenuId(menuId === folder.id ? null : folder.id)}
                >
                  <MoreHorizontal className="w-3.5 h-3.5" />
                </button>
                {menuId === folder.id && (
                  <div className="absolute right-0 top-6 z-50 w-36 rounded-xl border border-white/10 bg-[#13131a] shadow-2xl p-1 text-xs">
                    <button
                      className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/5 rounded-lg text-white/70 hover:text-white"
                      onClick={() => { setRenamingId(folder.id); setRenameValue(folder.name); setMenuId(null); }}
                    >
                      <Pencil className="w-3 h-3" /> Rename
                    </button>
                    <button
                      className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/5 rounded-lg text-white/70 hover:text-white"
                      onClick={() => { setAddBoardFolderId(folder.id); setMenuId(null); }}
                    >
                      <Plus className="w-3 h-3" /> Add board
                    </button>
                    <button
                      className="w-full flex items-center gap-2 px-3 py-2 hover:bg-red-500/10 rounded-lg text-red-400"
                      onClick={() => handleDelete(folder.id)}
                    >
                      <Trash2 className="w-3 h-3" /> Delete
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Add board picker */}
            {addBoardFolderId === folder.id && (
              <div className="mx-3 mb-1 rounded-lg border border-white/10 bg-[#13131a] shadow-xl p-2">
                <div className="text-[10px] text-white/30 px-1 pb-1">Add board to folder</div>
                {allBoards
                  .filter(b => !folder.boards.some(fb => fb.board.id === b.id))
                  .map(b => (
                    <button
                      key={b.id}
                      className="w-full text-left px-2 py-1.5 rounded hover:bg-white/5 text-xs text-white/70 hover:text-white truncate"
                      onClick={() => handleAddBoard(folder.id, b.id)}
                    >
                      {b.name}
                    </button>
                  ))}
                <button
                  className="w-full text-center text-[10px] text-white/20 hover:text-white/40 mt-1 py-1"
                  onClick={() => setAddBoardFolderId(null)}
                >Cancel</button>
              </div>
            )}

            {/* Boards inside folder */}
            {isOpen && folder.boards.length > 0 && (
              <div className="ml-6 border-l border-white/6 pl-2 py-0.5 space-y-0.5">
                {folder.boards.map(({ board }) => (
                  <div key={board.id} className="group flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-white/5 cursor-pointer text-white/40 hover:text-white/70 text-xs">
                    <span className="flex-1 truncate">{board.name}</span>
                    <button
                      className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-white/10 text-red-400/60 hover:text-red-400"
                      onClick={(e) => { e.stopPropagation(); handleRemoveBoard(folder.id, board.id); }}
                      title="Remove from folder"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
