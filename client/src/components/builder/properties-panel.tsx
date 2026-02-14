import type { ComponentBlock } from "@shared/schema";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Settings } from "lucide-react";

interface PropertiesPanelProps {
  block: ComponentBlock | null;
  onChange: (block: ComponentBlock) => void;
}

export function PropertiesPanel({ block, onChange }: PropertiesPanelProps) {
  if (!block) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-6">
        <Settings className="w-10 h-10 text-muted-foreground mb-3" />
        <p className="text-sm font-medium">No block selected</p>
        <p className="text-xs text-muted-foreground mt-1">Click a block on the canvas to edit its properties</p>
      </div>
    );
  }

  const props = block.props || {};

  const updateProp = (key: string, value: any) => {
    onChange({
      ...block,
      props: { ...props, [key]: value },
    });
  };

  const renderFields = () => {
    switch (block.type) {
      case "hero":
        return (
          <>
            <Field label="Title">
              <Input value={props.title || ""} onChange={(e) => updateProp("title", e.target.value)} data-testid="input-hero-title" />
            </Field>
            <Field label="Subtitle">
              <Textarea value={props.subtitle || ""} onChange={(e) => updateProp("subtitle", e.target.value)} className="resize-none" data-testid="input-hero-subtitle" />
            </Field>
            <Field label="Button Text">
              <Input value={props.buttonText || ""} onChange={(e) => updateProp("buttonText", e.target.value)} data-testid="input-hero-button" />
            </Field>
          </>
        );
      case "heading":
        return (
          <>
            <Field label="Text">
              <Input value={props.text || ""} onChange={(e) => updateProp("text", e.target.value)} data-testid="input-heading-text" />
            </Field>
            <Field label="Alignment">
              <Select value={props.align || "left"} onValueChange={(v) => updateProp("align", v)}>
                <SelectTrigger data-testid="select-heading-align"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="left">Left</SelectItem>
                  <SelectItem value="center">Center</SelectItem>
                  <SelectItem value="right">Right</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </>
        );
      case "text":
        return (
          <>
            <Field label="Content">
              <Textarea value={props.text || ""} onChange={(e) => updateProp("text", e.target.value)} className="resize-none min-h-[100px]" data-testid="input-text-content" />
            </Field>
            <Field label="Alignment">
              <Select value={props.align || "left"} onValueChange={(v) => updateProp("align", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="left">Left</SelectItem>
                  <SelectItem value="center">Center</SelectItem>
                  <SelectItem value="right">Right</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </>
        );
      case "button":
        return (
          <>
            <Field label="Label">
              <Input value={props.text || ""} onChange={(e) => updateProp("text", e.target.value)} data-testid="input-button-label" />
            </Field>
            <Field label="URL">
              <Input value={props.url || ""} onChange={(e) => updateProp("url", e.target.value)} placeholder="https://" data-testid="input-button-url" />
            </Field>
            <Field label="Alignment">
              <Select value={props.align || "left"} onValueChange={(v) => updateProp("align", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="left">Left</SelectItem>
                  <SelectItem value="center">Center</SelectItem>
                  <SelectItem value="right">Right</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </>
        );
      case "image":
        return (
          <>
            <Field label="Image URL">
              <Input value={props.src || ""} onChange={(e) => updateProp("src", e.target.value)} placeholder="https://..." data-testid="input-image-src" />
            </Field>
            <Field label="Alt Text">
              <Input value={props.alt || ""} onChange={(e) => updateProp("alt", e.target.value)} data-testid="input-image-alt" />
            </Field>
            <Field label="Height">
              <Input value={props.height || "200px"} onChange={(e) => updateProp("height", e.target.value)} data-testid="input-image-height" />
            </Field>
          </>
        );
      case "spacer":
        return (
          <Field label="Height">
            <Input value={props.height || "40px"} onChange={(e) => updateProp("height", e.target.value)} data-testid="input-spacer-height" />
          </Field>
        );
      case "section":
        return (
          <Field label="Title">
            <Input value={props.title || ""} onChange={(e) => updateProp("title", e.target.value)} data-testid="input-section-title" />
          </Field>
        );
      case "features":
        return (
          <Field label="Number of features">
            <p className="text-xs text-muted-foreground">Edit feature items via AI chat for best results</p>
          </Field>
        );
      default:
        return <p className="text-sm text-muted-foreground">No properties available</p>;
    }
  };

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-4">
        <div>
          <h3 className="text-sm font-semibold capitalize" data-testid="text-props-type">{block.type} Properties</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Edit the selected block</p>
        </div>
        {renderFields()}
      </div>
    </ScrollArea>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
