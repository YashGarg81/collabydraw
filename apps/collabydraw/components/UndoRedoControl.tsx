import { Undo2, Redo2 } from "lucide-react";
import { Button } from "./ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";

export default function UndoRedoControl({
    undo,
    redo
}: { undo: () => void; redo: () => void }) {

    return (
        <div className="UndoRedoBar Mobile_View rounded-lg hidden md:flex items-center bg-white dark:bg-w-bg surface-box-shadow">
            <TooltipProvider delayDuration={0}>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" onClick={undo} className="w-9 h-9 rounded-l-lg rounded-r-none bg-light-btn-bg text-text-primary-color dark:bg-w-bg dark:hover:bg-d-btn-hover-bg dark:text-w-text select-none border-r border-gray-200 dark:border-gray-800">
                            <Undo2 className="h-4 w-4" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent className="dark:bg-w-bg dark:text-white">Undo</TooltipContent>
                </Tooltip>
            </TooltipProvider>

            <TooltipProvider delayDuration={0}>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" onClick={redo} className="w-9 h-9 rounded-r-lg rounded-l-none bg-light-btn-bg text-text-primary-color dark:bg-w-bg dark:hover:bg-d-btn-hover-bg dark:text-w-text select-none">
                            <Redo2 className="h-4 w-4" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent className="dark:bg-w-bg dark:text-white">Redo</TooltipContent>
                </Tooltip>
            </TooltipProvider>
        </div>
    );
};
