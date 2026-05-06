import { Grid } from "lucide-react";
import { Button } from "./ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";

export default function SnapToGridToggle({
    snapToGrid,
    setSnapToGrid
}: { snapToGrid: boolean; setSnapToGrid: (snap: boolean) => void }) {

    return (
        <div className="Mobile_View rounded-lg hidden md:flex items-center bg-white dark:bg-w-bg surface-box-shadow">
            <TooltipProvider delayDuration={0}>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => setSnapToGrid(!snapToGrid)} 
                            className={`w-9 h-9 rounded-lg select-none ${snapToGrid ? 'bg-selected-tool-bg-light text-[var(--color-on-primary-container)] dark:bg-selected-tool-bg-dark dark:text-white' : 'bg-light-btn-bg text-text-primary-color dark:bg-w-bg dark:hover:bg-d-btn-hover-bg dark:text-w-text'}`}
                        >
                            <Grid className="h-4 w-4" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent className="dark:bg-w-bg dark:text-white">
                        {snapToGrid ? "Disable Snap to Grid" : "Enable Snap to Grid"}
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        </div>
    );
};
