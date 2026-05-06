import {
    Square,
    Circle,
    Minus,
    Pencil,
    Eraser,
    Diamond,
    Hand,
    MousePointer,
    MoveRight,
    StickyNote,
    Image as ImageIcon,
    Wand2,
    LassoSelect,
    Frame,
    PanelTop
} from "lucide-react"
import { Tool } from "./canvas";
import { TextIcon } from "@/components/SvgIcons";

export const tools: Tool[] = [
    {
        type: "selection",
        icon: <MousePointer />,
        shortcut: 1,
        label: 'Select'
    },
    {
        type: "grab",
        icon: <Hand />,
        shortcut: 2,
        label: 'Grab'
    },
    {
        type: "rectangle",
        icon: <Square />,
        shortcut: 3,
        label: 'Rectangle'
    },
    {
        type: "ellipse",
        icon: <Circle />,
        shortcut: 4,
        label: 'Ellipse'
    },
    {
        type: "diamond",
        icon: <Diamond />,
        shortcut: 5,
        label: 'Diamond'
    },
    {
        type: "line",
        icon: <Minus />,
        shortcut: 6,
        label: 'Line'
    },
    {
        type: "free-draw",
        icon: <Pencil />,
        shortcut: 7,
        label: 'Free Draw'
    },
    {
        type: "arrow",
        icon: <MoveRight />,
        shortcut: 8,
        label: 'Arrow'
    },
    {
        type: "text",
        icon: <TextIcon className="" />,
        shortcut: 9,
        label: 'Text'
    },
    {
        type: "eraser",
        icon: <Eraser />,
        shortcut: 10,
        label: 'Eraser'
    },
    {
        type: "sticky",
        icon: <StickyNote />,
        shortcut: 11,
        label: 'Sticky Note'
    },
    {
        type: "image",
        icon: <ImageIcon />,
        shortcut: 12,
        label: 'Image'
    },
    {
        type: "laser",
        icon: <Wand2 />,
        shortcut: "k",
        label: 'Laser Pointer'
    },
    {
        type: "lasso",
        icon: <LassoSelect />,
        shortcut: "l",
        label: 'Lasso Selection'
    },
    {
        type: "frame",
        icon: <Frame />,
        shortcut: "f",
        label: 'Frame'
    },
    {
        type: "embed",
        icon: <PanelTop />,
        shortcut: "w",
        label: 'Web Embed'
    }
]