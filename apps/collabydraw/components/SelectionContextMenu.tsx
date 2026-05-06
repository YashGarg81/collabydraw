import { 
    Copy, Trash, ArrowUpToLine, ArrowUp, ArrowDown, ArrowDownToLine, 
    AlignStartHorizontal, AlignCenterHorizontal, AlignEndHorizontal, 
    AlignStartVertical, AlignCenterVertical, AlignEndVertical,
    Group, Ungroup
} from "lucide-react";
import { Button } from "./ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";

export default function SelectionContextMenu({
    onDuplicate,
    onDelete,
    onBringForward,
    onSendBackward,
    onBringToFront,
    onSendToBack,
    onAlignLeft,
    onAlignCenterHorizontal,
    onAlignRight,
    onAlignTop,
    onAlignCenterVertical,
    onAlignBottom,
    onGroup,
    onUngroup,
    isGrouped
}: { 
    onDuplicate: () => void;
    onDelete: () => void;
    onBringForward: () => void;
    onSendBackward: () => void;
    onBringToFront: () => void;
    onSendToBack: () => void;
    onAlignLeft?: () => void;
    onAlignCenterHorizontal?: () => void;
    onAlignRight?: () => void;
    onAlignTop?: () => void;
    onAlignCenterVertical?: () => void;
    onAlignBottom?: () => void;
    onGroup?: () => void;
    onUngroup?: () => void;
    isGrouped?: boolean;
}) {

    return (
        <div className="Mobile_View rounded-lg flex items-center bg-white dark:bg-w-bg surface-box-shadow absolute top-24 left-1/2 transform -translate-x-1/2 z-50">
            {/* Group Tools */}
            {onGroup && !isGrouped && (
                <>
                    <TooltipProvider delayDuration={0}>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" onClick={onGroup} className="w-9 h-9 rounded-l-lg rounded-r-none bg-light-btn-bg text-text-primary-color dark:bg-w-bg dark:hover:bg-d-btn-hover-bg dark:text-w-text border-r border-gray-200 dark:border-gray-800">
                                    <Group className="h-4 w-4" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent className="dark:bg-w-bg dark:text-white">Group</TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                    <div className="w-px h-6 bg-gray-200 dark:bg-gray-800 mx-1"></div>
                </>
            )}

            {onUngroup && isGrouped && (
                <>
                    <TooltipProvider delayDuration={0}>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" onClick={onUngroup} className="w-9 h-9 rounded-l-lg rounded-r-none bg-light-btn-bg text-text-primary-color dark:bg-w-bg dark:hover:bg-d-btn-hover-bg dark:text-w-text border-r border-gray-200 dark:border-gray-800">
                                    <Ungroup className="h-4 w-4" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent className="dark:bg-w-bg dark:text-white">Ungroup</TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                    <div className="w-px h-6 bg-gray-200 dark:bg-gray-800 mx-1"></div>
                </>
            )}

            {/* Alignment Tools */}
            {onAlignLeft && (
                <>
                    <TooltipProvider delayDuration={0}>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" onClick={onAlignLeft} className="w-9 h-9 rounded-l-lg rounded-r-none bg-light-btn-bg text-text-primary-color dark:bg-w-bg dark:hover:bg-d-btn-hover-bg dark:text-w-text border-r border-gray-200 dark:border-gray-800">
                                    <AlignStartHorizontal className="h-4 w-4" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent className="dark:bg-w-bg dark:text-white">Align Left</TooltipContent>
                        </Tooltip>
                    </TooltipProvider>

                    <TooltipProvider delayDuration={0}>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" onClick={onAlignCenterHorizontal} className="w-9 h-9 rounded-none bg-light-btn-bg text-text-primary-color dark:bg-w-bg dark:hover:bg-d-btn-hover-bg dark:text-w-text border-r border-gray-200 dark:border-gray-800">
                                    <AlignCenterHorizontal className="h-4 w-4" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent className="dark:bg-w-bg dark:text-white">Align Center Horizontal</TooltipContent>
                        </Tooltip>
                    </TooltipProvider>

                    <TooltipProvider delayDuration={0}>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" onClick={onAlignRight} className="w-9 h-9 rounded-none bg-light-btn-bg text-text-primary-color dark:bg-w-bg dark:hover:bg-d-btn-hover-bg dark:text-w-text border-r border-gray-200 dark:border-gray-800">
                                    <AlignEndHorizontal className="h-4 w-4" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent className="dark:bg-w-bg dark:text-white">Align Right</TooltipContent>
                        </Tooltip>
                    </TooltipProvider>

                    <div className="w-px h-6 bg-gray-200 dark:bg-gray-800 mx-1"></div>

                    <TooltipProvider delayDuration={0}>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" onClick={onAlignTop} className="w-9 h-9 rounded-none bg-light-btn-bg text-text-primary-color dark:bg-w-bg dark:hover:bg-d-btn-hover-bg dark:text-w-text border-r border-gray-200 dark:border-gray-800">
                                    <AlignStartVertical className="h-4 w-4" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent className="dark:bg-w-bg dark:text-white">Align Top</TooltipContent>
                        </Tooltip>
                    </TooltipProvider>

                    <TooltipProvider delayDuration={0}>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" onClick={onAlignCenterVertical} className="w-9 h-9 rounded-none bg-light-btn-bg text-text-primary-color dark:bg-w-bg dark:hover:bg-d-btn-hover-bg dark:text-w-text border-r border-gray-200 dark:border-gray-800">
                                    <AlignCenterVertical className="h-4 w-4" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent className="dark:bg-w-bg dark:text-white">Align Center Vertical</TooltipContent>
                        </Tooltip>
                    </TooltipProvider>

                    <TooltipProvider delayDuration={0}>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" onClick={onAlignBottom} className="w-9 h-9 rounded-none bg-light-btn-bg text-text-primary-color dark:bg-w-bg dark:hover:bg-d-btn-hover-bg dark:text-w-text border-r border-gray-200 dark:border-gray-800">
                                    <AlignEndVertical className="h-4 w-4" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent className="dark:bg-w-bg dark:text-white">Align Bottom</TooltipContent>
                        </Tooltip>
                    </TooltipProvider>

                    <div className="w-px h-6 bg-gray-200 dark:bg-gray-800 mx-1"></div>
                </>
            )}

            {/* Existing Tools */}
            <TooltipProvider delayDuration={0}>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" onClick={onDuplicate} className={`w-9 h-9 rounded-none ${!onAlignLeft ? 'rounded-l-lg' : ''} bg-light-btn-bg text-text-primary-color dark:bg-w-bg dark:hover:bg-d-btn-hover-bg dark:text-w-text border-r border-gray-200 dark:border-gray-800`}>
                            <Copy className="h-4 w-4" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent className="dark:bg-w-bg dark:text-white">Duplicate</TooltipContent>
                </Tooltip>
            </TooltipProvider>

            <TooltipProvider delayDuration={0}>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" onClick={onBringToFront} className="w-9 h-9 rounded-none bg-light-btn-bg text-text-primary-color dark:bg-w-bg dark:hover:bg-d-btn-hover-bg dark:text-w-text border-r border-gray-200 dark:border-gray-800">
                            <ArrowUpToLine className="h-4 w-4" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent className="dark:bg-w-bg dark:text-white">Bring to Front</TooltipContent>
                </Tooltip>
            </TooltipProvider>

            <TooltipProvider delayDuration={0}>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" onClick={onBringForward} className="w-9 h-9 rounded-none bg-light-btn-bg text-text-primary-color dark:bg-w-bg dark:hover:bg-d-btn-hover-bg dark:text-w-text border-r border-gray-200 dark:border-gray-800">
                            <ArrowUp className="h-4 w-4" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent className="dark:bg-w-bg dark:text-white">Bring Forward</TooltipContent>
                </Tooltip>
            </TooltipProvider>

            <TooltipProvider delayDuration={0}>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" onClick={onSendBackward} className="w-9 h-9 rounded-none bg-light-btn-bg text-text-primary-color dark:bg-w-bg dark:hover:bg-d-btn-hover-bg dark:text-w-text border-r border-gray-200 dark:border-gray-800">
                            <ArrowDown className="h-4 w-4" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent className="dark:bg-w-bg dark:text-white">Send Backward</TooltipContent>
                </Tooltip>
            </TooltipProvider>

            <TooltipProvider delayDuration={0}>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" onClick={onSendToBack} className="w-9 h-9 rounded-none bg-light-btn-bg text-text-primary-color dark:bg-w-bg dark:hover:bg-d-btn-hover-bg dark:text-w-text border-r border-gray-200 dark:border-gray-800">
                            <ArrowDownToLine className="h-4 w-4" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent className="dark:bg-w-bg dark:text-white">Send to Back</TooltipContent>
                </Tooltip>
            </TooltipProvider>

            <TooltipProvider delayDuration={0}>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" onClick={onDelete} className="w-9 h-9 rounded-r-lg rounded-l-none bg-light-btn-bg text-text-primary-color dark:bg-w-bg dark:hover:bg-d-btn-hover-bg dark:text-w-text text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20">
                            <Trash className="h-4 w-4" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent className="dark:bg-w-bg dark:text-white">Delete</TooltipContent>
                </Tooltip>
            </TooltipProvider>
        </div>
    );
};
