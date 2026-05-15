import React, { useState } from "react";
import { MessageCircle, Send, X, Check } from "lucide-react";
import { Shape } from "@/types/canvas";

export interface CommentThreadProps {
    comment: Shape & { type: "comment" };
    panX: number;
    panY: number;
    scale: number;
    currentUserId: string;
    currentUserName: string;
    onUpdate: (updatedComment: Shape) => void;
    onDelete: (id: string) => void;
}

export function CommentThread({ comment, panX, panY, scale, currentUserId, currentUserName, onUpdate, onDelete }: CommentThreadProps) {
    const [isOpen, setIsOpen] = useState(comment.text === "");
    const [replyText, setReplyText] = useState("");

    const handleSend = () => {
        if (!replyText.trim()) return;
        
        if (comment.text === "") {
            // First time setting the text
            onUpdate({ ...comment, text: replyText });
        } else {
            // Adding a reply
            const newReply = {
                id: crypto.randomUUID(),
                userId: currentUserId,
                userName: currentUserName,
                text: replyText,
                createdAt: new Date().toISOString()
            };
            onUpdate({ 
                ...comment, 
                replies: [...(comment.replies || []), newReply] 
            });
        }
        setReplyText("");
    };

    const handleResolve = () => {
        onUpdate({ ...comment, resolved: true });
        setIsOpen(false);
    };

    if (comment.resolved) return null;

    return (
        <div
            className="absolute z-50 pointer-events-auto"
            style={{
                left: comment.x * scale + panX,
                top: comment.y * scale + panY,
            }}
        >
            <button 
                onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
                onPointerDown={(e) => e.stopPropagation()}
                className="w-8 h-8 rounded-full bg-brand-color text-white flex items-center justify-center shadow-md border-2 border-white hover:scale-110 transition-transform"
            >
                <MessageCircle size={16} />
            </button>

            {isOpen && (
                <div 
                  className="absolute top-10 left-0 w-64 bg-white dark:bg-[#1e1e2d] rounded-lg shadow-xl border border-gray-200 dark:border-white/10 flex flex-col overflow-hidden"
                  onPointerDown={(e) => e.stopPropagation()}
                >
                    <div className="flex items-center justify-between p-2 bg-gray-50 dark:bg-white/5 border-b border-gray-100 dark:border-white/10">
                        <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">Comment Thread</span>
                        <div className="flex items-center gap-1">
                            <button onClick={handleResolve} className="p-1 hover:bg-gray-200 dark:hover:bg-white/10 rounded text-emerald-600 dark:text-emerald-400" title="Resolve">
                                <Check size={14} />
                            </button>
                            <button onClick={() => {
                                if (comment.text === "") onDelete(comment.id!);
                                setIsOpen(false);
                            }} className="p-1 hover:bg-gray-200 dark:hover:bg-white/10 rounded text-gray-500" title="Close">
                                <X size={14} />
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 max-h-48 overflow-y-auto p-3 flex flex-col gap-3">
                        {comment.text && (
                            <div className="flex flex-col gap-1">
                                <span className="text-[10px] font-semibold text-brand-color px-1">{comment.userName}</span>
                                <div className="text-sm bg-gray-100 dark:bg-white/10 p-2 rounded-md">
                                    {comment.text}
                                </div>
                            </div>
                        )}
                        {comment.replies?.map(r => (
                            <div key={r.id} className="text-xs flex flex-col gap-1">
                                <span className="font-semibold text-brand-color">{r.userName}</span>
                                <span className="text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-white/5 p-2 rounded-md">{r.text}</span>
                            </div>
                        ))}
                    </div>

                    <div className="p-2 border-t border-gray-100 dark:border-white/10 flex items-center gap-2">
                        <input 
                            type="text"
                            placeholder={comment.text === "" ? "Type a comment..." : "Type a reply..."}
                            className="flex-1 bg-transparent text-sm outline-none px-2 py-1 placeholder:text-gray-400"
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    e.stopPropagation();
                                    handleSend();
                                }
                            }}
                            autoFocus
                            suppressHydrationWarning
                        />
                        <button onClick={handleSend} className="p-1.5 bg-brand-color text-white rounded-md hover:bg-brand-hover">
                            <Send size={14} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
