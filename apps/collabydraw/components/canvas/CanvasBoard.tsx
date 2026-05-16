"use client"

import React, { SetStateAction, useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useSession } from "next-auth/react";
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useTheme } from "next-themes";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { CanvasEngine } from "@/canvas-engine/CanvasEngine";
import { RoomParticipants } from "@repo/common/types";
import { getRoomParamsFromHash } from "@/utils/roomParams";
import { BgFill, canvasBgLight, FillStyle, FontFamily, FontSize, FontStyle, Mode, RoughStyle, StrokeEdge, StrokeFill, StrokeStyle, StrokeWidth, TextAlign, ToolType } from "@/types/canvas";
import { uint8ArrayToBase64, base64ToUint8Array } from "@/utils/binary";
import { MobileCommandBar } from "../MobileCommandBar";
import ScreenLoading from "../ScreenLoading";
import AppMenuButton from "../AppMenuButton";
import { AppSidebar } from "../AppSidebar";
import { StyleConfigurator } from "../StyleConfigurator";
import ToolSelector from "../ToolSelector";
import CollaborationToolbar from "../CollaborationToolbar";
import ZoomControl from "../ZoomControl";
import UndoRedoControl from "../UndoRedoControl";
import SnapToGridToggle from "../SnapToGridToggle";
import SelectionContextMenu from "../SelectionContextMenu";
import { HomeWelcome, MainMenuWelcome, ToolMenuWelcome } from "../welcome-screen";
import EncryptedWidget from "../EncryptedWidget";
import { AiDiagramPanel } from "../AiDiagramPanel";
import { CommandPalette, buildCommands } from "../CommandPalette";
import { ShortcutsOverlay } from "../ShortcutsOverlay";
import { Minimap } from "../Minimap";
import { AutoSaveIndicator, SaveStatus } from "../AutoSaveIndicator";
import { AiBoardActions } from "../AiBoardActions";
import { ShareModal } from "../ShareModal";
import { VersionHistory } from "../VersionHistory";
import { LiveCursors, useRemoteCursors } from "../LiveCursors";
import { LayersPanel } from "../LayersPanel";
import { Rulers } from "../Rulers";
import { CommentThread } from "./CommentThread";

export default function CanvasBoard() {
    const { data: session, status } = useSession();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const router = useRouter();
    const { theme } = useTheme()
    const { matches, isLoading } = useMediaQuery(670);
    const [mode, setMode] = useState<Mode>("standalone");
    const [participants, setParticipants] = useState<RoomParticipants[]>([]);
    const [isConnected, setIsConnected] = useState(false);
    const [isCanvasReady, setIsCanvasReady] = useState(false);
    const [followingUserId, setFollowingUserId] = useState<string | null>(null);
    const initializedWithMode = useRef<Mode | null>(null);

    // ── Phase 2: Command Palette + Shortcuts + Autosave ────────────────────
    const [cmdOpen, setCmdOpen] = useState(false);
    const [shortcutsOpen, setShortcutsOpen] = useState(false);
    const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
    const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
    const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [canvasShapes, setCanvasShapes] = useState<import("@/types/canvas").Shape[]>([]);
    const [viewportOffset, setViewportOffset] = useState({ x: 0, y: 0 });
    const [windowSize, setWindowSize] = useState({ w: 0, h: 0 });
    // ── Phase 4: Share modal ─────────────────────────────────────────────────
    const [shareOpen, setShareOpen] = useState(false);
    const [boardId, setBoardId] = useState<string | null>(null);
    const [boardIsPublic, setBoardIsPublic] = useState(false);
    const [boardPublicRole, setBoardPublicRole] = useState("NONE");
    const [userRole, setUserRole] = useState<string>("VIEWER");
    const [boardName, setBoardName] = useState("Untitled Board");
    // ── Phase 5: Version history + live cursors ─────────────────────────────
    const [versionHistoryOpen, setVersionHistoryOpen] = useState(false);
    // ── Phase 2: Layers + Rulers ─────────────────────────────────────────────
    const [layersOpen, setLayersOpen] = useState(false);
    const [showRulers, setShowRulers] = useState(false);
    const [viewport, setViewport] = useState({ panX: 0, panY: 0, scale: 1 });
    const [canvasSize, setCanvasSize] = useState({ w: 0, h: 0 });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [remoteCursors, setRemoteCursors] = useState<Map<string, any>>(new Map());
    const { cursorsRef, updateCursor, renderRef } = useRemoteCursors();
    const autosaveCountRef = useRef(0);
    renderRef.current = () => setRemoteCursors(new Map(cursorsRef.current));
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const importJsonInputRef = useRef<HTMLInputElement>(null);
    const currentHashRef = useRef<string>('');
    const [canvasEngineState, setCanvasEngineState] = useState({
        engine: null as CanvasEngine | null,
        scale: 1,
        activeTool: "grab" as ToolType,
        strokeFill: "#f08c00" as StrokeFill,
        strokeWidth: 1 as StrokeWidth,
        bgFill: "#00000000" as BgFill,
        strokeEdge: "round" as StrokeEdge,
        strokeStyle: "solid" as StrokeStyle,
        roughStyle: 1 as RoughStyle,
        fillStyle: 'solid' as FillStyle,
        fontFamily: 'hand-drawn' as FontFamily,
        fontSize: 'Medium' as FontSize,
        textAlign: 'left' as TextAlign,
        fontStyle: 'normal' as FontStyle,
        grabbing: false,
        sidebarOpen: false,
        canvasColor: canvasBgLight[0],
        isCanvasEmpty: true,
        snapToGrid: false,
        isShapeSelected: false,
        selectedShapeCount: 0,
        isGroupedSelection: false,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        embedData: { embeds: [] as any[], panX: 0, panY: 0 }
    });
    const userRef = useRef({
        roomId: null as string | null,
        userId: null as string | null,
        userName: null as string | null,
        token: null as string | null,
        encryptionKey: null as string | null,
    });

    useEffect(() => {
        const getHash = () => {
            if (typeof window === 'undefined') return '';
            return window.location.hash;
        };

        const updateRoomParams = () => {
            if (status === 'loading') return;
            const hash = getHash();
            currentHashRef.current = hash;
            const currentRoomParams = getRoomParamsFromHash(hash);

            if (status === "authenticated" && currentRoomParams) {
                setMode("room");
                userRef.current = {
                    roomId: currentRoomParams.roomId,
                    encryptionKey: currentRoomParams.encryptionKey,
                    userId: session?.user?.id ?? null,
                    userName: session?.user?.name ?? null,
                    token: session?.accessToken ?? null,
                };
            } else if (status === "unauthenticated" && currentRoomParams) {
                window.alert(
                    "You need to be logged in to join this collaborative room.\n\n" +
                    "Please sign up or log in to your account to continue. " +
                    "Collaborative features require authentication to ensure secure access and proper identification of participants."
                );
                setMode("standalone");
                router.push(`/auth/signin?callbackUrl=${hash}`);
            } else {
                setMode("standalone");
            }
        };

        updateRoomParams();

        const handleHashChange = () => {
            updateRoomParams();
        };

        if (typeof window !== 'undefined') {
            window.addEventListener('hashchange', handleHashChange);
        }

        return () => {
            if (typeof window !== 'undefined') {
                window.removeEventListener('hashchange', handleHashChange);
            }
        };
    }, [pathname, searchParams, status, session, router]);

    useEffect(() => {
        setCanvasEngineState(prev => ({ ...prev, canvasColor: canvasBgLight[0] }));
        console.log('Theme = ', theme)
    }, [theme])

    useEffect(() => {
        if (canvasEngineState.engine && theme) {
            canvasEngineState.engine.setTheme(theme === 'light' ? "light" : "dark");
        }
    }, [theme, canvasEngineState.engine]);

    const [canUndo, setCanUndo] = useState(false);
    const [canRedo, setCanRedo] = useState(false);

    useEffect(() => {
        const { engine, scale } = canvasEngineState;
        if (engine) {
            engine.setScale(scale);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [canvasEngineState.engine, canvasEngineState.scale]);

    useEffect(() => {
        const { engine, activeTool, strokeWidth, strokeFill, bgFill, canvasColor, strokeEdge, strokeStyle, roughStyle, fillStyle, fontFamily, fontSize, textAlign, fontStyle } = canvasEngineState;

        if (engine) {
            engine.setTool(activeTool);
            engine.setStrokeWidth(strokeWidth);
            engine.setStrokeFill(strokeFill);
            engine.setBgFill(bgFill);
            engine.setCanvasBgColor(canvasColor);
            engine.setStrokeEdge(strokeEdge);
            engine.setStrokeStyle(strokeStyle);
            engine.setRoughStyle(roughStyle);
            engine.setFillStyle(fillStyle);
            engine.setFontFamily(fontFamily);
            engine.setFontSize(fontSize);
            engine.setTextAlign(textAlign);
            engine.setFontStyle(fontStyle);
            engine.setSnapToGrid(canvasEngineState.snapToGrid);
        }
    }, [
        canvasEngineState.engine,
        canvasEngineState.activeTool,
        canvasEngineState.strokeWidth,
        canvasEngineState.strokeFill,
        canvasEngineState.bgFill,
        canvasEngineState.canvasColor,
        canvasEngineState.strokeEdge,
        canvasEngineState.strokeStyle,
        canvasEngineState.roughStyle,
        canvasEngineState.fillStyle,
        canvasEngineState.fontFamily,
        canvasEngineState.fontSize,
        canvasEngineState.textAlign,
        canvasEngineState.fontStyle,
        canvasEngineState.snapToGrid
    ]);

    // Ctrl+K → command palette; ? → shortcuts (only when not typing)
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
            const isTyping = tag === 'input' || tag === 'textarea' || (e.target as HTMLElement)?.isContentEditable;
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                setCmdOpen(prev => !prev);
            }
            if (e.key === '?' && !isTyping && !cmdOpen) {
                setShortcutsOpen(prev => !prev);
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [cmdOpen]);

    // Track window size for minimap
    useEffect(() => {
        const update = () => setWindowSize({ w: window.innerWidth, h: window.innerHeight });
        update();
        window.addEventListener('resize', update);
        return () => window.removeEventListener('resize', update);
    }, []);

    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        const toolKeyMap: Record<string, ToolType> = {
            "1": "selection",
            "2": "grab",
            "3": "rectangle",
            "4": "ellipse",
            "5": "diamond",
            "6": "line",
            "7": "free-draw",
            "8": "arrow",
            "9": "text",
            "0": "eraser",
            "k": "laser",
            "l": "lasso",
            "f": "frame",
            "w": "embed"
        };

        const newTool = toolKeyMap[e.key];
        if (newTool) {
            setCanvasEngineState(prev => ({ ...prev, activeTool: newTool }));
        }
    }, []);

    useEffect(() => {
        const checkCanvasInterval = setInterval(() => {
            if (canvasRef.current) {
                setIsCanvasReady(true);
                clearInterval(checkCanvasInterval);
            }
        }, 100);

        return () => clearInterval(checkCanvasInterval);
    }, []);

    const initializeCanvasEngine = useCallback(() => {
        if (!canvasRef.current) return null;

        const engine = new CanvasEngine(
            canvasRef.current,
            mode === 'room' ? userRef.current.roomId : null,
            mode === 'room' ? userRef.current.userId : null,
            mode === 'room' ? userRef.current.userName : null,
            mode === 'room' ? userRef.current.token : null,
            canvasEngineState.canvasColor,
            (newScale) => setCanvasEngineState(prev => ({ ...prev, scale: newScale })),
            mode === 'room' ? false : true,
            mode === 'room' ? (updatedParticipants) => {
                setParticipants(updatedParticipants);
            } : null,
            mode === 'room' ? (connectionStatus) => setIsConnected(connectionStatus) : null,
            userRef.current.encryptionKey,
            theme === 'light' ? "light" : "dark"
        );
        
        engine.onHistoryChange = (undoable, redoable) => {
            setCanUndo(undoable);
            setCanRedo(redoable);
        };
        engine.setOnShapeCountChange((count: number) => {
            setCanvasEngineState(prev => ({
                ...prev,
                isCanvasEmpty: count === 0
            }));
            // Sync shapes for minimap
            setCanvasShapes(engine.getShapes());
            // Trigger autosave
            if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
            autosaveTimerRef.current = setTimeout(async () => {
                const bid = new URLSearchParams(window.location.search).get('board');
                if (!bid) return;
                const shapes = engine.getShapes();
                const encryptedData = uint8ArrayToBase64(engine.getEncodedState());
                setSaveStatus('saving');
                try {
                    const res = await fetch(`/api/boards/${bid}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ 
                            shapes,
                            encryptedData 
                        }),
                    });
                    if (res.ok) {
                        setSaveStatus('saved');
                        setLastSavedAt(new Date());
                        // Phase 5: auto-snapshot every 20 saves
                        autosaveCountRef.current += 1;
                        if (autosaveCountRef.current % 20 === 0) {
                            fetch(`/api/boards/${bid}/snapshots`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) }).catch(() => {});
                        }
                    }
                    else setSaveStatus('error');
                } catch { setSaveStatus('error'); }
            }, 2000);
        });
        engine.setOnSelectionChange((isSelected: boolean, count?: number, isGrouped?: boolean) => {
            setCanvasEngineState(prev => ({
                ...prev,
                isShapeSelected: isSelected,
                selectedShapeCount: count || 0,
                isGroupedSelection: isGrouped || false
            }));
        });
        engine.onViewChange = (embeds, panX, panY, scale) => {
            // Update viewport offset for minimap indicator
            setViewportOffset({ x: panX, y: panY });
            // Update viewport for Rulers
            setViewport({ panX, panY, scale });
            setCanvasSize({ w: window.innerWidth, h: window.innerHeight });
            // Sync shapes on every view change (pan/zoom can reveal moved shapes)
            setCanvasShapes(engine.getShapes());
            setCanvasEngineState(prev => {
                if (
                    prev.embedData.panX === panX &&
                    prev.embedData.panY === panY &&
                    prev.scale === scale &&
                    prev.embedData.embeds.length === embeds.length &&
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    prev.embedData.embeds.every((e: any, i) => e.id === embeds[i].id && e.x === (embeds[i] as any).x && e.y === (embeds[i] as any).y && e.width === (embeds[i] as any).width && e.height === (embeds[i] as any).height)
                ) {
                    return prev;
                }
                return {
                    ...prev,
                    embedData: { embeds, panX, panY },
                    scale
                };
            });
        };
        engine.onToolChangeCallback = (tool: ToolType) => {
            setCanvasEngineState(prev => ({
                ...prev,
                activeTool: tool
            }));
        };
        // Phase 5: live cursor overlay
        engine.onCursorUpdate = (userId, userName, x, y) => {
            updateCursor(userId, userName, x, y);
        };
        return engine;
    }, [canvasEngineState.canvasColor, mode, theme, updateCursor]);

    useEffect(() => {
        if (!isCanvasReady) return;
        if (initializedWithMode.current !== mode) {
            if (canvasEngineState.engine) {
                canvasEngineState.engine.destroy();
            }
            const waitReaddy = setTimeout(() => {
                if (!canvasRef.current) return;
                const engine = initializeCanvasEngine();

                if (engine) {
                    initializedWithMode.current = mode;
                    setCanvasEngineState(prev => ({ ...prev, engine }));
                    // Sync shapes that were loaded from localStorage on init
                    setCanvasShapes(engine.getShapes());

                    const handleResize = () => {
                        if (canvasRef.current) {
                            const canvas = canvasRef.current;
                            canvas.width = window.innerWidth || document.documentElement.clientWidth;
                            canvas.height = window.innerHeight || document.documentElement.clientHeight;
                            engine.handleResize(window.innerWidth, window.innerHeight);
                        }
                    };

                    handleResize();
                    window.addEventListener('resize', handleResize);

                    document.addEventListener("keydown", handleKeyDown);

                    return () => {
                        window.removeEventListener('resize', handleResize);
                        document.removeEventListener("keydown", handleKeyDown);
                        engine.destroy();
                    };
                }
            }, 1000)
            return () => clearTimeout(waitReaddy);
        }
    }, [handleKeyDown, initializeCanvasEngine, isCanvasReady, isConnected, mode, canvasEngineState.engine]);

    // Load board data (shapes + meta) on initial mount
    useEffect(() => {
        const bid = new URLSearchParams(window.location.search).get('board');
        if (!bid || !canvasEngineState.engine) return;
        setBoardId(bid);
        fetch(`/api/boards/${bid}`).then(async res => {
            if (res.ok) {
                const data = await res.json();
                if (data.board?.name) setBoardName(data.board.name);
                if (data.board?.isPublic !== undefined) setBoardIsPublic(data.board.isPublic);
                if (data.board?.publicRole !== undefined) setBoardPublicRole(data.board.publicRole);
                
                // Phase 4: Persistence - Load from binary blob (Yjs) or legacy JSON
                if (data.board?.encryptedData && canvasEngineState.engine) {
                    try {
                        const binary = base64ToUint8Array(data.board.encryptedData);
                        canvasEngineState.engine.applyEncodedState(binary);
                    } catch (e) {
                        console.error("Error loading encrypted document blob:", e);
                    }
                } else if (data.board?.shapes && canvasEngineState.engine) {
                    try {
                        const shapes = JSON.parse(data.board.shapes);
                        canvasEngineState.engine.addShapes(shapes);
                    } catch (e) {
                        console.error("Error loading legacy board shapes:", e);
                    }
                }

                if (data.role) {
                    setUserRole(data.role);
                    if (data.role === "VIEWER" && canvasEngineState.engine) {
                        canvasEngineState.engine.isReadOnly = true;
                    }
                }
            }
        });
    }, [boardId, canvasEngineState.engine, pathname]);

    const clearCanvas = useCallback(() => {
        canvasEngineState.engine?.clearAllShapes();
    }, [canvasEngineState.engine]);

    const toggleSidebar = useCallback(() => {
        setCanvasEngineState(prev => ({ ...prev, sidebarOpen: !prev.sidebarOpen }));
    }, []);

    const handleScaleUpdate = useCallback((newScale: number | ((prev: number) => number)) => {
        setCanvasEngineState(prev => {
            const finalScale = typeof newScale === 'function' ? newScale(prev.scale) : newScale;

            if (prev.engine) {
                prev.engine.setScale(finalScale); // 🔥 this handles panX, panY, canvas.clear
            }

            return {
                ...prev,
                scale: finalScale
            };
        });
    }, []);

    if (isLoading) {
        return <ScreenLoading />
    }

    return (
        <div className={cn("collabydraw relative h-screen overflow-hidden",
            canvasEngineState.activeTool === "eraser"
                ? "cursor-[url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAAAXNSR0IArs4c6QAAAOBJREFUOE9jZKAyYKSyeQzDwMD////7MDAw6EGD5hIjI+MWfMGE08sggz5+/Dj71q1bHPv27eMFGeLk5PRZTU3tBz8/fyoug7EaCDLs58+fa0NDQ9k2b96M4iBfX1+G1atX/2JnZw/GZihWAz98+PA8NjZWAt0wmMkgQxcvXvxCQEBAEt37GAaCXHf69OnFZmZmAvjC6tSpUx9MTU1j0V2JzcCqzs7OpoqKCmZ8BnZ0dPwtLy+vY2RkbENWRxcDqetlkPOpGikgA6mebGCGUi1hI8ca1bIeucXaMCi+SPU6AHRTjhWg+vuGAAAAAElFTkSuQmCC')_10_10,auto]"
                : canvasEngineState.activeTool === "grab" && !canvasEngineState.sidebarOpen
                    ? canvasEngineState.grabbing ? "cursor-grabbing" : "cursor-grab"
                    : "cursor-crosshair")}>
            <div className="App_Menu App_Menu_Top fixed z-[4] top-4 right-4 left-4 flex items-start pointer-events-none gap-2">
                <div className="flex-1 flex justify-start pointer-events-none">
                    {matches && (
                        <div className="pointer-events-auto Main_Menu_Stack Sidebar_Trigger_Button xs670:grid xs670:gap-[calc(.25rem*6)] grid-cols-[auto] grid-flow-row grid-rows auto-rows-min">
                            <div className="relative flex items-center gap-1.5">
                                <Link
                                    href="/dashboard"
                                    title="Go to Dashboard"
                                    className="flex items-center justify-center w-8 h-8 rounded-lg border border-white/10 bg-[#232329] hover:bg-violet-600/20 hover:border-violet-500/30 text-white/50 hover:text-violet-400 transition-all duration-200 group"
                                >
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H5a1 1 0 01-1-1V9.5z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 21V12h6v9" />
                                    </svg>
                                </Link>
                                <AppMenuButton onClick={toggleSidebar} />

                                {canvasEngineState.sidebarOpen && (
                                    <AppSidebar
                                        isOpen={canvasEngineState.sidebarOpen}
                                        onClose={() => setCanvasEngineState(prev => ({ ...prev, sidebarOpen: false }))}
                                        canvasColor={canvasEngineState.canvasColor}
                                        setCanvasColor={(newCanvasColor: SetStateAction<string>) =>
                                        setCanvasEngineState(prev => ({ ...prev, canvasColor: typeof newCanvasColor === 'function' ? newCanvasColor(prev.canvasColor) : newCanvasColor }))
                                        }
                                        isStandalone={mode === 'room' || !!boardId ? false : true}
                                        onClearCanvas={clearCanvas}
                                        onExportCanvas={() => canvasEngineState.engine?.exportToPNG()}
                                        onImportCanvas={() => importJsonInputRef.current?.click()}
                                    />
                                )}
                                {/* Phase 6: hidden file input for JSON import */}
                                <input
                                    ref={importJsonInputRef}
                                    type="file"
                                    accept=".json"
                                    className="hidden"
                                    onChange={async (e) => {
                                        const file = e.target.files?.[0];
                                        if (!file || !canvasEngineState.engine) return;
                                        try {
                                            const text = await file.text();
                                            const parsed = JSON.parse(text);
                                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                            const shapes: any[] = Array.isArray(parsed) ? parsed : parsed.shapes ?? [];
                                            if (!Array.isArray(shapes) || shapes.length === 0) throw new Error("empty");
                                            canvasEngineState.engine.addShapes(shapes);
                                        } catch {
                                            alert("Could not import: invalid JSON file. Must be exported from CollabyDraw.");
                                        }
                                        if (importJsonInputRef.current) importJsonInputRef.current.value = "";
                                    }}
                                />

                                {canvasEngineState.activeTool === "grab" && canvasEngineState.isCanvasEmpty && (
                                    <MainMenuWelcome />
                                )}

                            </div>


                            <StyleConfigurator
                                activeTool={canvasEngineState.activeTool}
                                strokeFill={canvasEngineState.strokeFill}
                                setStrokeFill={(newStrokeFill: SetStateAction<StrokeFill>) =>
                                    setCanvasEngineState(prev => ({ ...prev, strokeFill: typeof newStrokeFill === 'function' ? newStrokeFill(prev.strokeFill) : newStrokeFill }))
                                }
                                strokeWidth={canvasEngineState.strokeWidth}
                                setStrokeWidth={(newStrokeWidth: SetStateAction<StrokeWidth>) =>
                                    setCanvasEngineState(prev => ({ ...prev, strokeWidth: typeof newStrokeWidth === 'function' ? newStrokeWidth(prev.strokeWidth) : newStrokeWidth }))
                                }
                                bgFill={canvasEngineState.bgFill}
                                setBgFill={(newBgFill: SetStateAction<BgFill>) =>
                                    setCanvasEngineState(prev => ({ ...prev, bgFill: typeof newBgFill === 'function' ? newBgFill(prev.bgFill) : newBgFill }))
                                }
                                strokeEdge={canvasEngineState.strokeEdge}
                                setStrokeEdge={(newStrokeEdge: SetStateAction<StrokeEdge>) =>
                                    setCanvasEngineState(prev => ({ ...prev, strokeEdge: typeof newStrokeEdge === 'function' ? newStrokeEdge(prev.strokeEdge) : newStrokeEdge }))
                                }
                                strokeStyle={canvasEngineState.strokeStyle}
                                setStrokeStyle={(newStrokeStyle: SetStateAction<StrokeStyle>) =>
                                    setCanvasEngineState(prev => ({ ...prev, strokeStyle: typeof newStrokeStyle === 'function' ? newStrokeStyle(prev.strokeStyle) : newStrokeStyle }))
                                }

                                roughStyle={canvasEngineState.roughStyle}
                                setRoughStyle={(newRoughStyle: SetStateAction<RoughStyle>) =>
                                    setCanvasEngineState(prev => ({ ...prev, roughStyle: typeof newRoughStyle === 'function' ? newRoughStyle(prev.roughStyle) : newRoughStyle }))
                                }

                                fillStyle={canvasEngineState.fillStyle}
                                setFillStyle={(newFillStyle: SetStateAction<FillStyle>) =>
                                    setCanvasEngineState(prev => ({ ...prev, fillStyle: typeof newFillStyle === 'function' ? newFillStyle(prev.fillStyle) : newFillStyle }))
                                }

                                fontFamily={canvasEngineState.fontFamily}
                                setFontFamily={(newFontFamily: SetStateAction<FontFamily>) =>
                                    setCanvasEngineState(prev => ({ ...prev, fontFamily: typeof newFontFamily === 'function' ? newFontFamily(prev.fontFamily) : newFontFamily }))
                                }

                                fontSize={canvasEngineState.fontSize}
                                setFontSize={(newFontSize: SetStateAction<FontSize>) =>
                                    setCanvasEngineState(prev => ({ ...prev, fontSize: typeof newFontSize === 'function' ? newFontSize(prev.fontSize) : newFontSize }))
                                }

                                textAlign={canvasEngineState.textAlign}
                                setTextAlign={(newTextAlign: SetStateAction<TextAlign>) =>
                                    setCanvasEngineState(prev => ({ ...prev, textAlign: typeof newTextAlign === 'function' ? newTextAlign(prev.textAlign) : newTextAlign }))
                                }
                                fontStyle={canvasEngineState.fontStyle}
                                setFontStyle={(newFontStyle: SetStateAction<FontStyle>) =>
                                    setCanvasEngineState(prev => ({ ...prev, fontStyle: typeof newFontStyle === 'function' ? newFontStyle(prev.fontStyle) : newFontStyle }))
                                }
                            />

                        </div>
                    )}
                </div>
                <div className="shrink-0 pointer-events-auto">
                    <ToolSelector
                        selectedTool={canvasEngineState.activeTool}
                        onToolSelect={(newTool) =>
                            setCanvasEngineState(prev => ({ ...prev, activeTool: newTool }))
                        }
                    />
                </div>

                <div className="flex-1 flex justify-end pointer-events-none">
                    {matches && (
                        <div className="pointer-events-auto flex items-start gap-1.5 flex-wrap justify-end">
                        <CollaborationToolbar 
                            participants={participants} 
                            hash={currentHashRef.current} 
                            followingUserId={followingUserId}
                            onFollowUser={(id) => {
                                const next = followingUserId === id ? null : id;
                                setFollowingUserId(next);
                                if (canvasEngineState?.engine) {
                                    canvasEngineState.engine.follow(next);
                                }
                            }}
                        />
                        {/* Rulers toggle */}
                        <button
                            onClick={() => setShowRulers(p => !p)}
                            title="Toggle Rulers"
                            className={cn(
                                "flex items-center gap-1.5 h-8 px-2 md:px-3 rounded-lg border text-xs font-medium transition-all",
                                showRulers
                                    ? "border-violet-500/40 bg-violet-600/20 text-violet-300"
                                    : "border-white/10 bg-[#232329] hover:bg-[#31303b] text-white/60 hover:text-white/90"
                            )}
                        >
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 7h18M3 7v10M3 7l3-3M7 7v3M11 7v3M15 7v3M19 7v3" />
                            </svg>
                            <span className="hidden xl:inline">Rulers</span>
                        </button>
                        {/* Layers button */}
                        <button
                            onClick={() => setLayersOpen(p => !p)}
                            title="Layers Panel"
                            className={cn(
                                "flex items-center gap-1.5 h-8 px-2 md:px-3 rounded-lg border text-xs font-medium transition-all",
                                layersOpen
                                    ? "border-violet-500/40 bg-violet-600/20 text-violet-300"
                                    : "border-white/10 bg-[#232329] hover:bg-[#31303b] text-white/60 hover:text-white/90"
                            )}
                        >
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                            </svg>
                            <span className="hidden xl:inline">Layers</span>
                        </button>
                        {/* Version History button */}
                        {boardId && (
                            <button
                                onClick={() => setVersionHistoryOpen(true)}
                                title="Version History"
                                className="flex items-center gap-1.5 h-8 px-2 md:px-3 rounded-lg border border-white/10 bg-[#232329] hover:bg-[#31303b] text-white/60 hover:text-white/90 text-xs font-medium transition-all"
                            >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <span className="hidden xl:inline">History</span>
                            </button>
                        )}
                        {/* Share button */}
                        {boardId && (
                            <button
                                onClick={() => setShareOpen(true)}
                                title="Share board"
                                className="flex items-center gap-1.5 h-8 px-2 md:px-3 rounded-lg border border-white/10 bg-[#232329] hover:bg-[#31303b] text-white/60 hover:text-white/90 text-xs font-medium transition-all"
                            >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                                </svg>
                                <span className="hidden xl:inline">Share</span>
                            </button>
                        )}
                    </div>
                )}
                </div>
            </div>

            {canvasEngineState.activeTool === "grab" && canvasEngineState.isCanvasEmpty && !isLoading && (
                <div className="relative">
                    <ToolMenuWelcome />
                </div>
            )}

            {matches && (
                <div className="fixed z-[4] bottom-4 left-4 flex items-center gap-2">
                    <UndoRedoControl 
                        undo={() => canvasEngineState.engine?.undo()} 
                        redo={() => canvasEngineState.engine?.redo()} 
                        canUndo={canUndo}
                        canRedo={canRedo}
                    />
                    <ZoomControl
                        scale={canvasEngineState.scale}
                        setScale={handleScaleUpdate}
                    />
                    <SnapToGridToggle 
                        snapToGrid={canvasEngineState.snapToGrid}
                        setSnapToGrid={(snap: boolean) => setCanvasEngineState(prev => ({ ...prev, snapToGrid: snap }))}
                    />
                    <AiDiagramPanel engine={canvasEngineState.engine} />
                    <AiBoardActions engine={canvasEngineState.engine} />
                    {/* Autosave indicator */}
                    <AutoSaveIndicator status={saveStatus} lastSavedAt={lastSavedAt} />
                    {/* Shortcuts hint */}
                    <button
                        onClick={() => setShortcutsOpen(true)}
                        title="Keyboard shortcuts (?)"
                        className="w-7 h-7 rounded-lg border border-white/10 bg-[#232329] hover:bg-[#31303b] text-white/40 hover:text-white/80 flex items-center justify-center text-xs font-bold transition-colors"
                    >
                        ?
                    </button>
                </div>
            )}

            {/* Minimap — bottom right */}
            {matches && (
                <div className="fixed z-[4] bottom-4 right-4">
                    <Minimap
                        shapes={canvasShapes}
                        scale={canvasEngineState.scale}
                        offsetX={viewportOffset.x}
                        offsetY={viewportOffset.y}
                        canvasWidth={windowSize.w}
                        canvasHeight={windowSize.h}
                    />
                </div>
            )}

            {/* Command Palette */}
            <CommandPalette
                open={cmdOpen}
                onClose={() => setCmdOpen(false)}
                commands={buildCommands({
                    setTool: (t) => setCanvasEngineState(prev => ({ ...prev, activeTool: t as ToolType })),
                    undo: () => canvasEngineState.engine?.undo(),
                    redo: () => canvasEngineState.engine?.redo(),
                    exportPNG: () => canvasEngineState.engine?.exportToPNG(),
                    clearCanvas,
                    setScale: (s) => handleScaleUpdate((prev) => prev * s),
                    toggleGrid: () => setCanvasEngineState(prev => ({ ...prev, snapToGrid: !prev.snapToGrid })),
                    openShortcuts: () => { setCmdOpen(false); setShortcutsOpen(true); },
                    openAI: () => { /* trigger AI panel */ },
                })}
            />

            {/* Keyboard Shortcuts Overlay */}
            <ShortcutsOverlay open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />

            {canvasEngineState.isShapeSelected && matches && (
                <SelectionContextMenu
                    onDuplicate={() => canvasEngineState.engine?.duplicateSelected()}
                    onDelete={() => canvasEngineState.engine?.deleteSelected()}
                    onBringForward={() => canvasEngineState.engine?.bringForward()}
                    onSendBackward={() => canvasEngineState.engine?.sendBackward()}
                    onBringToFront={() => canvasEngineState.engine?.bringToFront()}
                    onSendToBack={() => canvasEngineState.engine?.sendToBack()}
                    {...(canvasEngineState.selectedShapeCount > 1 ? {
                        onAlignLeft: () => canvasEngineState.engine?.alignSelectedLeft(),
                        onAlignCenterHorizontal: () => canvasEngineState.engine?.alignSelectedCenterHorizontal(),
                        onAlignRight: () => canvasEngineState.engine?.alignSelectedRight(),
                        onAlignTop: () => canvasEngineState.engine?.alignSelectedTop(),
                        onAlignCenterVertical: () => canvasEngineState.engine?.alignSelectedCenterVertical(),
                        onAlignBottom: () => canvasEngineState.engine?.alignSelectedBottom()
                    } : {})}
                    {...(canvasEngineState.selectedShapeCount > 1 && !canvasEngineState.isGroupedSelection ? {
                        onGroup: () => canvasEngineState.engine?.groupSelected()
                    } : {})}
                    {...(canvasEngineState.isGroupedSelection ? {
                        onUngroup: () => canvasEngineState.engine?.ungroupSelected(),
                        isGrouped: true
                    } : {})}
                />
            )}

            {!isLoading && matches && (
                <EncryptedWidget />
            )}

            <div className="collabydraw-textEditorContainer"></div>

            {!matches && (
                <MobileCommandBar
                    sidebarOpen={canvasEngineState.sidebarOpen}
                    setSidebarOpen={() => setCanvasEngineState(prev => ({ ...prev, sidebarOpen: !prev.sidebarOpen }))}
                    canvasColor={canvasEngineState.canvasColor}
                    setCanvasColor={(newCanvasColor: SetStateAction<string>) =>
                        setCanvasEngineState(prev => ({ ...prev, canvasColor: typeof newCanvasColor === 'function' ? newCanvasColor(prev.canvasColor) : newCanvasColor }))
                    }
                    scale={canvasEngineState.scale}
                    setScale={(newScale: SetStateAction<number>) =>
                        setCanvasEngineState(prev => ({ ...prev, scale: typeof newScale === 'function' ? newScale(prev.scale) : newScale }))
                    }
                    activeTool={canvasEngineState.activeTool}
                    setStrokeFill={(newStrokeFill: SetStateAction<StrokeFill>) =>
                        setCanvasEngineState(prev => ({ ...prev, strokeFill: typeof newStrokeFill === 'function' ? newStrokeFill(prev.strokeFill) : newStrokeFill }))
                    }
                    strokeFill={canvasEngineState.strokeFill}
                    strokeWidth={canvasEngineState.strokeWidth}
                    setStrokeWidth={(newStrokeWidth: SetStateAction<StrokeWidth>) =>
                        setCanvasEngineState(prev => ({ ...prev, strokeWidth: typeof newStrokeWidth === 'function' ? newStrokeWidth(prev.strokeWidth) : newStrokeWidth }))
                    }
                    bgFill={canvasEngineState.bgFill}
                    setBgFill={(newBgFill: SetStateAction<BgFill>) =>
                        setCanvasEngineState(prev => ({ ...prev, bgFill: typeof newBgFill === 'function' ? newBgFill(prev.bgFill) : newBgFill }))
                    }
                    strokeEdge={canvasEngineState.strokeEdge}
                    setStrokeEdge={(newStrokeEdge: SetStateAction<StrokeEdge>) =>
                        setCanvasEngineState(prev => ({ ...prev, strokeEdge: typeof newStrokeEdge === 'function' ? newStrokeEdge(prev.strokeEdge) : newStrokeEdge }))
                    }
                    strokeStyle={canvasEngineState.strokeStyle}
                    setStrokeStyle={(newStrokeStyle: SetStateAction<StrokeStyle>) =>
                        setCanvasEngineState(prev => ({ ...prev, strokeStyle: typeof newStrokeStyle === 'function' ? newStrokeStyle(prev.strokeStyle) : newStrokeStyle }))
                    }
                    roughStyle={canvasEngineState.roughStyle}
                    setRoughStyle={(newRoughStyle: SetStateAction<RoughStyle>) =>
                        setCanvasEngineState(prev => ({ ...prev, roughStyle: typeof newRoughStyle === 'function' ? newRoughStyle(prev.roughStyle) : newRoughStyle }))
                    }

                    fillStyle={canvasEngineState.fillStyle}
                    setFillStyle={(newFillStyle: SetStateAction<FillStyle>) =>
                        setCanvasEngineState(prev => ({ ...prev, fillStyle: typeof newFillStyle === 'function' ? newFillStyle(prev.fillStyle) : newFillStyle }))
                    }

                    fontFamily={canvasEngineState.fontFamily}
                    setFontFamily={(newFontFamily: SetStateAction<FontFamily>) =>
                        setCanvasEngineState(prev => ({ ...prev, fontFamily: typeof newFontFamily === 'function' ? newFontFamily(prev.fontFamily) : newFontFamily }))
                    }

                    fontSize={canvasEngineState.fontSize}
                    setFontSize={(newFontSize: SetStateAction<FontSize>) =>
                        setCanvasEngineState(prev => ({ ...prev, fontSize: typeof newFontSize === 'function' ? newFontSize(prev.fontSize) : newFontSize }))
                    }

                    textAlign={canvasEngineState.textAlign}
                    setTextAlign={(newTextAlign: SetStateAction<TextAlign>) =>
                        setCanvasEngineState(prev => ({ ...prev, textAlign: typeof newTextAlign === 'function' ? newTextAlign(prev.textAlign) : newTextAlign }))
                    }
                    fontStyle={canvasEngineState.fontStyle}
                    setFontStyle={(newFontStyle: SetStateAction<FontStyle>) =>
                        setCanvasEngineState(prev => ({ ...prev, fontStyle: typeof newFontStyle === 'function' ? newFontStyle(prev.fontStyle) : newFontStyle }))
                    }
                    isStandalone={mode === 'room' || !!boardId ? false : true}
                    onClearCanvas={clearCanvas}
                    onExportCanvas={() => canvasEngineState.engine?.exportToPNG()}
                />

            )}

            {!isLoading && canvasEngineState.activeTool === "grab" && canvasEngineState.isCanvasEmpty && (
                <HomeWelcome />
            )}

            {isLoading && (
                <ScreenLoading />
            )}

            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {canvasEngineState.embedData.embeds.map((embed: any) => {
                const isPanning = canvasEngineState.activeTool === "grab" || canvasEngineState.grabbing || canvasEngineState.isShapeSelected;
                return (
                    <div
                        key={embed.id}
                        className="absolute"
                        style={{
                            left: embed.x * canvasEngineState.scale + canvasEngineState.embedData.panX,
                            top: embed.y * canvasEngineState.scale + canvasEngineState.embedData.panY,
                            width: embed.width * canvasEngineState.scale,
                            height: embed.height * canvasEngineState.scale,
                            pointerEvents: isPanning ? 'none' : 'auto',
                            zIndex: 1
                        }}
                    >
                        <iframe
                            src={embed.url}
                            className="w-full h-full border border-gray-300 rounded shadow-sm bg-white"
                            sandbox="allow-scripts allow-same-origin allow-popups"
                        />
                    </div>
                )
            })}

            <canvas className={cn("collabydraw collabydraw-canvas touch-none", theme === 'dark' ? 'collabydraw-canvas-dark' : '')} ref={canvasRef} />

            {/* Phase 5: Live remote cursor overlay (room mode only) */}
            {mode === 'room' && (
                <LiveCursors
                    cursors={remoteCursors}
                    panX={canvasEngineState.embedData.panX}
                    panY={canvasEngineState.embedData.panY}
                    scale={canvasEngineState.scale}
                />
            )}

            {/* Comments Overlay */}
            {canvasShapes.filter(s => s.type === "comment").map(comment => (
                <CommentThread
                    key={comment.id}
                    comment={comment as unknown as Parameters<typeof CommentThread>[0]["comment"]}
                    panX={canvasEngineState.embedData.panX}
                    panY={canvasEngineState.embedData.panY}
                    scale={canvasEngineState.scale}
                    currentUserId={session?.user?.id || "guest"}
                    currentUserName={session?.user?.name || "Guest"}
                    onUpdate={(updated) => canvasEngineState.engine?.updateShape(updated)}
                    onDelete={(id) => canvasEngineState.engine?.removeShape(id)}
                />
            ))}

            {/* Share Modal — Phase 4 + enhanced in Phase 5 */}
            {shareOpen && boardId && (
                <ShareModal
                    boardId={boardId}
                    boardName={boardName}
                    isPublic={boardIsPublic}
                    publicRole={boardPublicRole}
                    onClose={() => setShareOpen(false)}
                    onTogglePublic={(val) => setBoardIsPublic(val)}
                    onUpdateRole={(val) => setBoardPublicRole(val)}
                    onExport={() => canvasEngineState.engine?.exportToPNG()}
                    onExportSVG={() => canvasEngineState.engine?.exportToSVG()}
                    onExportJSON={() => canvasEngineState.engine?.exportToJSON()}
                    onCopyClipboard={() => canvasEngineState.engine?.copyPNGToClipboard() ?? Promise.resolve(false)}
                />
            )}

            {/* Version History — Phase 5 */}
            {versionHistoryOpen && boardId && (
                <VersionHistory
                    boardId={boardId}
                    onClose={() => setVersionHistoryOpen(false)}
                    onRestore={(shapes) => {
                        canvasEngineState.engine?.clearAllShapes();
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        canvasEngineState.engine?.addShapes(shapes as any[]);
                        setVersionHistoryOpen(false);
                    }}
                />
            )}

            {/* Phase 2: Layers Panel */}
            <LayersPanel
                engine={canvasEngineState.engine}
                isOpen={layersOpen}
                onClose={() => setLayersOpen(false)}
            />

            {/* Phase 2: Rulers */}
            {showRulers && canvasSize.w > 0 && (
                <Rulers
                    panX={viewport.panX}
                    panY={viewport.panY}
                    scale={viewport.scale}
                    width={canvasSize.w}
                    height={canvasSize.h}
                />
            )}
        </div>
    )
};
