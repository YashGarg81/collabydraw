"use client";

/**
 * Wave 8: AI Diagramming Panel
 *
 * Floating glassmorphism panel with two tabs:
 *  - Mermaid: parse Mermaid syntax → canvas shapes
 *  - AI Prompt: natural language → Gemini API → canvas shapes
 */

import React, { useState, useRef, useCallback } from "react";
import { Sparkles, GitFork, X, ChevronDown, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { CanvasEngine } from "@/canvas-engine/CanvasEngine";
import { mermaidToShapes } from "@/utils/mermaidToShapes";

// ─── Types ─────────────────────────────────────────────────────────────────────

type Tab = "mermaid" | "ai";
type Status = "idle" | "loading" | "success" | "error";

interface AiDiagramPanelProps {
    engine: CanvasEngine | null;
}

// ─── Example Mermaid diagram ───────────────────────────────────────────────────

const MERMAID_PLACEHOLDER = `graph TD
  A[Start] --> B{Is user logged in?}
  B -->|Yes| C[Show Dashboard]
  B -->|No| D[Show Login]
  D --> E[Submit Credentials]
  E --> B`;

const AI_PLACEHOLDER = `Draw a simple login flow with a start node, a login form box, a decision diamond for authentication, and two end states: success dashboard and error message.`;

// ─── Component ─────────────────────────────────────────────────────────────────

export function AiDiagramPanel({ engine }: AiDiagramPanelProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<Tab>("mermaid");
    const [mermaidCode, setMermaidCode] = useState("");
    const [aiPrompt, setAiPrompt] = useState("");
    const [status, setStatus] = useState<Status>("idle");
    const [statusMessage, setStatusMessage] = useState("");
    const abortRef = useRef<AbortController | null>(null);

    const handleClose = useCallback(() => {
        setIsOpen(false);
        setStatus("idle");
        setStatusMessage("");
    }, []);

    // ── Mermaid generate ──────────────────────────────────────────────────────

    const handleMermaidGenerate = useCallback(async () => {
        const code = mermaidCode.trim();
        if (!code) {
            setStatus("error");
            setStatusMessage("Please enter a Mermaid diagram.");
            return;
        }
        if (!engine) {
            setStatus("error");
            setStatusMessage("Canvas is not ready.");
            return;
        }

        setStatus("loading");
        setStatusMessage("Parsing diagram…");

        try {
            const shapes = mermaidToShapes(code);
            engine.addShapes(shapes);
            setStatus("success");
            setStatusMessage(`Added ${shapes.length} shapes to canvas.`);
            setTimeout(() => { setStatus("idle"); setStatusMessage(""); }, 3000);
        } catch (err) {
            console.error("Mermaid parse error:", err);
            setStatus("error");
            setStatusMessage(
                err instanceof Error ? err.message : "Failed to parse Mermaid diagram."
            );
        }
    }, [mermaidCode, engine]);

    // ── AI prompt generate ────────────────────────────────────────────────────

    const handleAiGenerate = useCallback(async () => {
        const prompt = aiPrompt.trim();
        if (!prompt) {
            setStatus("error");
            setStatusMessage("Please describe the diagram you want.");
            return;
        }
        if (!engine) {
            setStatus("error");
            setStatusMessage("Canvas is not ready.");
            return;
        }

        // Cancel any in-flight request
        abortRef.current?.abort();
        abortRef.current = new AbortController();

        setStatus("loading");
        setStatusMessage("Generating with AI…");

        try {
            const res = await fetch("/api/ai/diagram", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ prompt }),
                signal: abortRef.current.signal,
            });

            const data = await res.json();

            if (!res.ok || data.error) {
                throw new Error(data.error ?? "Unknown error");
            }

            const shapes = data.shapes;
            if (!Array.isArray(shapes) || shapes.length === 0) {
                throw new Error("AI returned no shapes. Try a more specific prompt.");
            }

            engine.addShapes(shapes);
            setStatus("success");
            setStatusMessage(`Added ${shapes.length} shapes to canvas.`);
            setTimeout(() => { setStatus("idle"); setStatusMessage(""); }, 3000);
        } catch (err) {
            if ((err as Error)?.name === "AbortError") return;
            console.error("AI generation error:", err);
            setStatus("error");
            setStatusMessage(
                err instanceof Error ? err.message : "AI generation failed. Try again."
            );
        }
    }, [aiPrompt, engine]);

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <div className="ai-panel-wrapper">
            {/* Trigger button */}
            <button
                id="ai-diagram-panel-toggle"
                className={cn("ai-panel-trigger", isOpen && "ai-panel-trigger--active")}
                onClick={() => setIsOpen((p) => !p)}
                title="AI Diagramming Tools (Wave 8)"
                aria-label="Toggle AI diagram panel"
            >
                <Sparkles className="ai-panel-trigger__icon" />
                <span className="ai-panel-trigger__label">AI Diagram</span>
                <ChevronDown
                    className={cn("ai-panel-trigger__chevron", isOpen && "ai-panel-trigger__chevron--open")}
                />
            </button>

            {/* Panel */}
            {isOpen && (
                <div className="ai-panel Island" role="dialog" aria-label="AI Diagram Generator">
                    {/* Header */}
                    <div className="ai-panel__header">
                        <div className="ai-panel__header-title">
                            <Sparkles className="ai-panel__header-icon" />
                            <span>AI Diagram Generator</span>
                        </div>
                        <button
                            id="ai-diagram-panel-close"
                            className="ai-panel__close-btn"
                            onClick={handleClose}
                            aria-label="Close AI panel"
                        >
                            <X size={14} />
                        </button>
                    </div>

                    {/* Tabs */}
                    <div className="ai-panel__tabs" role="tablist">
                        <button
                            id="ai-tab-mermaid"
                            role="tab"
                            aria-selected={activeTab === "mermaid"}
                            className={cn("ai-panel__tab", activeTab === "mermaid" && "ai-panel__tab--active")}
                            onClick={() => { setActiveTab("mermaid"); setStatus("idle"); setStatusMessage(""); }}
                        >
                            <GitFork size={13} />
                            Mermaid
                        </button>
                        <button
                            id="ai-tab-prompt"
                            role="tab"
                            aria-selected={activeTab === "ai"}
                            className={cn("ai-panel__tab", activeTab === "ai" && "ai-panel__tab--active")}
                            onClick={() => { setActiveTab("ai"); setStatus("idle"); setStatusMessage(""); }}
                        >
                            <Sparkles size={13} />
                            AI Prompt
                        </button>
                    </div>

                    {/* Tab content */}
                    <div className="ai-panel__body">
                        {activeTab === "mermaid" ? (
                            <>
                                <p className="ai-panel__hint">
                                    Paste Mermaid{" "}
                                    <code>graph TD</code> / <code>LR</code> or{" "}
                                    <code>sequenceDiagram</code> syntax below.
                                </p>
                                <textarea
                                    id="ai-mermaid-input"
                                    className="ai-panel__textarea"
                                    value={mermaidCode}
                                    onChange={(e) => setMermaidCode(e.target.value)}
                                    placeholder={MERMAID_PLACEHOLDER}
                                    rows={9}
                                    spellCheck={false}
                                    aria-label="Mermaid diagram code input"
                                />
                                <button
                                    id="ai-mermaid-generate-btn"
                                    className="ai-panel__btn"
                                    onClick={handleMermaidGenerate}
                                    disabled={status === "loading"}
                                >
                                    {status === "loading" ? (
                                        <Loader2 size={14} className="ai-panel__btn-icon animate-spin" />
                                    ) : (
                                        <GitFork size={14} className="ai-panel__btn-icon" />
                                    )}
                                    {status === "loading" ? "Parsing…" : "Generate Shapes"}
                                </button>
                            </>
                        ) : (
                            <>
                                <p className="ai-panel__hint">
                                    Describe your diagram in plain English. Gemini AI will generate
                                    shapes directly on the canvas.
                                </p>
                                <textarea
                                    id="ai-prompt-input"
                                    className="ai-panel__textarea"
                                    value={aiPrompt}
                                    onChange={(e) => setAiPrompt(e.target.value)}
                                    placeholder={AI_PLACEHOLDER}
                                    rows={7}
                                    spellCheck={false}
                                    aria-label="AI prompt input"
                                />
                                <button
                                    id="ai-prompt-generate-btn"
                                    className="ai-panel__btn ai-panel__btn--ai"
                                    onClick={handleAiGenerate}
                                    disabled={status === "loading"}
                                >
                                    {status === "loading" ? (
                                        <Loader2 size={14} className="ai-panel__btn-icon animate-spin" />
                                    ) : (
                                        <Sparkles size={14} className="ai-panel__btn-icon" />
                                    )}
                                    {status === "loading" ? "Generating…" : "Generate with AI"}
                                </button>
                            </>
                        )}

                        {/* Status feedback */}
                        {statusMessage && (
                            <div
                                className={cn(
                                    "ai-panel__status",
                                    status === "success" && "ai-panel__status--success",
                                    status === "error" && "ai-panel__status--error",
                                    status === "loading" && "ai-panel__status--loading"
                                )}
                                role="status"
                                aria-live="polite"
                            >
                                {status === "success" && <CheckCircle2 size={13} />}
                                {status === "error" && <AlertCircle size={13} />}
                                {status === "loading" && <Loader2 size={13} className="animate-spin" />}
                                <span>{statusMessage}</span>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
