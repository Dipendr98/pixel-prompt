import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { ComponentBlock } from "@shared/schema";
import { GripVertical, Trash2, LayoutTemplate, Heading, Type, MousePointer, ImageIcon, Minus, ArrowUpDown, Star, Square } from "lucide-react";
import { Button } from "@/components/ui/button";

const iconMap: Record<string, any> = {
  hero: LayoutTemplate,
  section: Square,
  heading: Heading,
  text: Type,
  button: MousePointer,
  image: ImageIcon,
  divider: Minus,
  spacer: ArrowUpDown,
  features: Star,
};

interface CanvasBlockProps {
  block: ComponentBlock;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}

function renderBlockPreview(block: ComponentBlock) {
  const props = block.props || {};

  switch (block.type) {
    case "hero":
      return (
        <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-md p-8 text-center">
          <h2 className="text-2xl font-bold mb-2">{props.title || "Hero Title"}</h2>
          <p className="text-muted-foreground mb-4">{props.subtitle || "Your subtitle text goes here"}</p>
          <div className="inline-block bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium">
            {props.buttonText || "Get Started"}
          </div>
        </div>
      );
    case "heading":
      return (
        <h2 className="text-xl font-bold" style={{ textAlign: props.align || "left", color: props.color }}>
          {props.text || "Heading Text"}
        </h2>
      );
    case "text":
      return (
        <p className="text-sm text-muted-foreground" style={{ textAlign: props.align || "left" }}>
          {props.text || "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore."}
        </p>
      );
    case "button":
      return (
        <div style={{ textAlign: props.align || "left" }}>
          <div className="inline-block bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium">
            {props.text || "Click Me"}
          </div>
        </div>
      );
    case "image":
      return (
        <div className="bg-muted rounded-md flex items-center justify-center" style={{ height: props.height || "200px" }}>
          <ImageIcon className="w-8 h-8 text-muted-foreground" />
          <span className="text-sm text-muted-foreground ml-2">{props.alt || "Image placeholder"}</span>
        </div>
      );
    case "divider":
      return <hr className="border-border" />;
    case "spacer":
      return <div style={{ height: props.height || "40px" }} className="bg-muted/30 rounded-md flex items-center justify-center">
        <span className="text-xs text-muted-foreground">Spacer ({props.height || "40px"})</span>
      </div>;
    case "section":
      return (
        <div className="bg-muted/20 rounded-md p-6 border border-dashed border-border">
          <p className="text-sm text-muted-foreground text-center">{props.title || "Section Container"}</p>
        </div>
      );
    case "features":
      return (
        <div className="grid grid-cols-3 gap-4">
          {(props.features || [
            { title: "Feature 1", desc: "Description of feature one" },
            { title: "Feature 2", desc: "Description of feature two" },
            { title: "Feature 3", desc: "Description of feature three" },
          ]).map((f: any, i: number) => (
            <div key={i} className="bg-muted/30 rounded-md p-4 text-center">
              <Star className="w-6 h-6 text-primary mx-auto mb-2" />
              <h4 className="text-sm font-medium">{f.title}</h4>
              <p className="text-xs text-muted-foreground mt-1">{f.desc}</p>
            </div>
          ))}
        </div>
      );
    default:
      return <div className="text-sm text-muted-foreground">Unknown block type: {block.type}</div>;
  }
}

export function CanvasBlock({ block, isSelected, onSelect, onDelete }: CanvasBlockProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: block.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const Icon = iconMap[block.type] || Square;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative group rounded-md border-2 transition-colors ${
        isSelected ? "border-primary" : "border-transparent hover:border-border"
      } ${isDragging ? "opacity-40 z-50" : ""}`}
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
      data-testid={`canvas-block-${block.id}`}
    >
      <div className="absolute -top-3 left-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" style={{ visibility: isDragging ? "hidden" : "visible" }}>
        <div
          className="flex items-center gap-1 bg-card border rounded-md px-1.5 py-0.5 text-xs text-muted-foreground cursor-grab active:cursor-grabbing"
          {...listeners}
          {...attributes}
        >
          <GripVertical className="w-3 h-3" />
          <Icon className="w-3 h-3" />
          <span className="capitalize">{block.type}</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 bg-card border"
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          data-testid={`button-delete-block-${block.id}`}
        >
          <Trash2 className="w-3 h-3 text-destructive" />
        </Button>
      </div>
      <div className="p-4">
        {renderBlockPreview(block)}
      </div>
    </div>
  );
}
