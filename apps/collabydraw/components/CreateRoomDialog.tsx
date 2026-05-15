'use client'

import { Button } from "./ui/button";
import { Play, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "./ui/dialog";
import { useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export default function CreateRoomDialog({ open, onOpenChange }: { open: boolean, onOpenChange: (open: boolean) => void }) {
    const [isPending, setIsPending] = useState(false);
    const router = useRouter();

    const handleCreateRoom = async () => {
        setIsPending(true);
        try {
            const savedShapes = localStorage.getItem("shapes");
            let initialShapes = [];
            try {
                if (savedShapes) initialShapes = JSON.parse(savedShapes);
            } catch (e) {
                console.error("Failed to parse saved shapes", e);
            }

            const res = await fetch("/api/boards", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: "Live Session",
                    description: "Created from standalone canvas",
                    isPublic: true,
                })
            });
            const result = await res.json();
            
            if (res.ok && result.board?.id) {
                // If there are shapes to transfer, update the board
                if (initialShapes.length > 0) {
                    await fetch(`/api/boards/${result.board.id}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ shapes: initialShapes })
                    });
                }
                toast.success("Live session started!");
                router.push(`/canvas?board=${result.board.id}`);
                onOpenChange(false);
            } else {
                toast.error('Error: ' + (result.error || result.message || "Failed to create session"));
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to create session. Please try again.';
            toast.error(errorMessage);
        } finally {
            setIsPending(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="glass-panel gap-6 max-w-lg bg-island-bg-color border border-dialog-border-color shadow-modal-shadow rounded-lg p-10" overlayClassName="bg-[#12121233]">
                <DialogHeader className="gap-6">
                    <DialogTitle className="flex items-center justify-center w-full font-bold text-xl text-color-primary tracking-[0.75px]">Start Live Session</DialogTitle>
                    <div className="text-text-primary-color text-center text-[.875rem] leading-[150%] font-normal">
                        <div className="mb-4">Convert your current drawing into a live collaborative board.</div>
                        This will create a new board in your dashboard and sync your shapes to the cloud. You can then share the URL with others.
                    </div>
                </DialogHeader>
                <DialogFooter className="flex items-center justify-center sm:justify-center">
                    <Button onClick={handleCreateRoom} type="button" size={"lg"} disabled={isPending} className="py-2 px-6 min-h-12 rounded-md text-[.875rem] font-semibold shadow-none bg-color-primary hover:bg-brand-hover active:bg-brand-active active:scale-[.98]">
                        <div className="flex items-center justify-center gap-3 shrink-0 flex-nowrap">
                            {isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5" />}
                        </div>
                        {isPending ? 'Starting Session...' : 'Start Session'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};