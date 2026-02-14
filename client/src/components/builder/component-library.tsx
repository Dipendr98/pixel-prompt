import { useDraggable } from "@dnd-kit/core";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  LayoutTemplate,
  Heading,
  Type,
  MousePointer,
  ImageIcon,
  Minus,
  ArrowUpDown,
  Star,
  Square,
} from "lucide-react";

const COMPONENT_TYPES = [
  { type: "hero", label: "Hero Block", icon: LayoutTemplate, description: "Full-width hero section" },
  { type: "section", label: "Section", icon: Square, description: "Container section" },
  { type: "heading", label: "Heading", icon: Heading, description: "Heading text element" },
  { type: "text", label: "Text", icon: Type, description: "Paragraph text" },
  { type: "button", label: "Button", icon: MousePointer, description: "Call to action button" },
  { type: "image", label: "Image", icon: ImageIcon, description: "Image placeholder" },
  { type: "divider", label: "Divider", icon: Minus, description: "Horizontal divider" },
  { type: "spacer", label: "Spacer", icon: ArrowUpDown, description: "Vertical spacing" },
  { type: "features", label: "Feature Block", icon: Star, description: "Feature grid layout" },
] as const;

function DraggableBlock({ type, label, icon: Icon, description }: { type: string; label: string; icon: any; description: string }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `library-${type}`,
    data: { type, fromLibrary: true },
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`flex items-center gap-3 p-3 rounded-md cursor-grab active:cursor-grabbing hover-elevate transition-opacity ${isDragging ? "opacity-40" : ""}`}
      data-testid={`library-block-${type}`}
    >
      <div className="flex items-center justify-center w-9 h-9 rounded-md bg-muted shrink-0">
        <Icon className="w-4 h-4 text-muted-foreground" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium leading-tight">{label}</p>
        <p className="text-xs text-muted-foreground leading-tight mt-0.5">{description}</p>
      </div>
    </div>
  );
}

export function ComponentLibrary() {
  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b">
        <h2 className="text-sm font-semibold" data-testid="text-components-title">Components</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Drag blocks to the canvas</p>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-0.5">
          {COMPONENT_TYPES.map((c) => (
            <DraggableBlock key={c.type} {...c} />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

export { COMPONENT_TYPES };
