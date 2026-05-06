"use client"

import React, { SetStateAction, useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useSession } from "next-auth/react";
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTheme } from "next-themes";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { CanvasEngine } from "@/canvas-engine/CanvasEngine";
import { RoomParticipants } from "@repo/common/types";
import { getRoomParamsFromHash } from "@/utils/roomParams";
import { BgFill, canvasBgLight, FillStyle, FontFamily, FontSize, FontStyle, LOCALSTORAGE_CANVAS_KEY, Mode, RoughStyle, StrokeEdge, StrokeFill, StrokeStyle, StrokeWidth, TextAlign, ToolType } from "@/types/canvas";
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
    const initializedWithMode = useRef<Mode | null>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
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
    }, [pathname, searchParams, status, session]);

    useEffect(() => {
        setCanvasEngineState(prev => ({ ...prev, canvasColor: canvasBgLight[0] }));
        console.log('Theme = ', theme)
    }, [theme])

    useEffect(() => {
        if (canvasEngineState.engine && theme) {
            canvasEngineState.engine.setTheme(theme === 'light' ? "light" : "dark");
        }
    }, [theme, canvasEngineState.engine]);

    useEffect(() => {
        const storedShapes = localStorage.getItem(LOCALSTORAGE_CANVAS_KEY);
        const isEmpty = !storedShapes || JSON.parse(storedShapes).length === 0;

        setCanvasEngineState(prev => ({
            ...prev,
            isCanvasEmpty: isEmpty
        }));
    }, []);

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
        engine.setOnShapeCountChange((count: number) => {
            setCanvasEngineState(prev => ({
                ...prev,
                isCanvasEmpty: count === 0
            }));
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
        return engine;
    }, [canvasEngineState.canvasColor, mode, theme]);

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
            <div className="App_Menu App_Menu_Top fixed z-[4] top-4 right-4 left-4 flex justify-center items-center xs670:grid xs670:grid-cols-[1fr_auto_1fr] xs670:gap-4 md:gap-8 xs670:items-start">
                {matches && (
                    <div className="Main_Menu_Stack Sidebar_Trigger_Button xs670:grid xs670:gap-[calc(.25rem*6)] grid-cols-[auto] grid-flow-row grid-rows auto-rows-min justify-self-start">
                        <div className="relative">
                            <AppMenuButton onClick={toggleSidebar} />

                            {canvasEngineState.sidebarOpen && (
                                <AppSidebar
                                    isOpen={canvasEngineState.sidebarOpen}
                                    onClose={() => setCanvasEngineState(prev => ({ ...prev, sidebarOpen: false }))}
                                    canvasColor={canvasEngineState.canvasColor}
                                    setCanvasColor={(newCanvasColor: SetStateAction<string>) =>
                                        setCanvasEngineState(prev => ({ ...prev, canvasColor: typeof newCanvasColor === 'function' ? newCanvasColor(prev.canvasColor) : newCanvasColor }))
                                    }
                                    isStandalone={mode === 'room' ? false : true}
                                    onClearCanvas={clearCanvas}
                                    onExportCanvas={() => canvasEngineState.engine?.exportToPNG()}
                                />
                            )}

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
                <ToolSelector
                    selectedTool={canvasEngineState.activeTool}
                    onToolSelect={(newTool: SetStateAction<ToolType>) =>
                        setCanvasEngineState(prev => ({ ...prev, activeTool: typeof newTool === 'function' ? newTool(prev.activeTool) : newTool }))
                    }
                />

                {matches && (
                    <CollaborationToolbar participants={participants} hash={currentHashRef.current} />
                )}
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
                </div>
            )}

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
                    isStandalone={mode === 'room' ? false : true}
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
        </div >
    )
};