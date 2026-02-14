import type { ComponentBlock } from "@shared/schema";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Settings, Plus, Trash2 } from "lucide-react";

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
    onChange({ ...block, props: { ...props, [key]: value } });
  };

  const updateArrayItem = (key: string, index: number, field: string, value: string) => {
    const arr = [...(props[key] || [])];
    arr[index] = { ...arr[index], [field]: value };
    updateProp(key, arr);
  };

  const addArrayItem = (key: string, template: any) => {
    updateProp(key, [...(props[key] || []), template]);
  };

  const removeArrayItem = (key: string, index: number) => {
    const arr = [...(props[key] || [])];
    arr.splice(index, 1);
    updateProp(key, arr);
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

      case "navbar":
        return (
          <>
            <Field label="Brand Name">
              <Input value={props.brand || ""} onChange={(e) => updateProp("brand", e.target.value)} data-testid="input-navbar-brand" />
            </Field>
            <Field label="CTA Button Text">
              <Input value={props.ctaText || ""} onChange={(e) => updateProp("ctaText", e.target.value)} placeholder="e.g. Sign Up" data-testid="input-navbar-cta" />
            </Field>
            <ArrayEditor
              label="Nav Links"
              items={props.links || []}
              fields={[{ key: "label", label: "Label" }, { key: "url", label: "URL" }]}
              template={{ label: "New Link", url: "#" }}
              onChange={(items) => updateProp("links", items)}
              testPrefix="navbar-link"
            />
          </>
        );

      case "footer":
        return (
          <>
            <Field label="Copyright Text">
              <Input value={props.copyright || ""} onChange={(e) => updateProp("copyright", e.target.value)} data-testid="input-footer-copyright" />
            </Field>
            {(props.columns || []).map((col: any, i: number) => (
              <div key={i} className="border border-border rounded-md p-2 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-[10px] text-muted-foreground font-medium">Column {i + 1}</Label>
                  <Button variant="ghost" size="sm" className="text-destructive text-xs h-6 px-2" onClick={() => {
                    const arr = [...(props.columns || [])];
                    arr.splice(i, 1);
                    updateProp("columns", arr);
                  }} data-testid={`button-remove-footer-col-${i}`}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">Title</Label>
                  <Input value={col.title || ""} onChange={(e) => { const arr = [...(props.columns || [])]; arr[i] = { ...arr[i], title: e.target.value }; updateProp("columns", arr); }} className="h-7 text-xs" data-testid={`input-footer-col-${i}-title`} />
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">Links (comma-separated)</Label>
                  <Input value={(col.links || []).join(", ")} onChange={(e) => { const arr = [...(props.columns || [])]; arr[i] = { ...arr[i], links: e.target.value.split(",").map((s: string) => s.trim()).filter(Boolean) }; updateProp("columns", arr); }} className="h-7 text-xs" data-testid={`input-footer-col-${i}-links`} />
                </div>
              </div>
            ))}
            <Button variant="ghost" size="sm" onClick={() => updateProp("columns", [...(props.columns || []), { title: "New Column", links: ["Link 1", "Link 2"] }])} className="w-full text-xs" data-testid="button-add-footer-col">
              <Plus className="w-3 h-3 mr-1" /> Add Column
            </Button>
          </>
        );

      case "product-card":
        return (
          <>
            <ArrayEditor
              label="Products"
              items={props.products || []}
              fields={[
                { key: "name", label: "Name" },
                { key: "price", label: "Price" },
                { key: "description", label: "Description" },
                { key: "image", label: "Image URL" },
              ]}
              template={{ name: "New Product", price: "$0.00", description: "Product description", image: "" }}
              onChange={(items) => updateProp("products", items)}
              testPrefix="product"
            />
          </>
        );

      case "pricing-table":
        return (
          <>
            {(props.plans || []).map((plan: any, i: number) => (
              <div key={i} className="border border-border rounded-md p-2 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-[10px] text-muted-foreground font-medium">Plan {i + 1}</Label>
                  <Button variant="ghost" size="sm" className="text-destructive text-xs h-6 px-2" onClick={() => {
                    const arr = [...(props.plans || [])];
                    arr.splice(i, 1);
                    updateProp("plans", arr);
                  }} data-testid={`button-remove-plan-${i}`}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">Name</Label>
                  <Input value={plan.name || ""} onChange={(e) => { const arr = [...(props.plans || [])]; arr[i] = { ...arr[i], name: e.target.value }; updateProp("plans", arr); }} className="h-7 text-xs" data-testid={`input-plan-${i}-name`} />
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">Price</Label>
                  <Input value={plan.price || ""} onChange={(e) => { const arr = [...(props.plans || [])]; arr[i] = { ...arr[i], price: e.target.value }; updateProp("plans", arr); }} className="h-7 text-xs" data-testid={`input-plan-${i}-price`} />
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">Features (comma-separated)</Label>
                  <Input value={(plan.features || []).join(", ")} onChange={(e) => { const arr = [...(props.plans || [])]; arr[i] = { ...arr[i], features: e.target.value.split(",").map((s: string) => s.trim()).filter(Boolean) }; updateProp("plans", arr); }} className="h-7 text-xs" data-testid={`input-plan-${i}-features`} />
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" checked={plan.highlighted || false} onChange={(e) => { const arr = [...(props.plans || [])]; arr[i] = { ...arr[i], highlighted: e.target.checked }; updateProp("plans", arr); }} data-testid={`checkbox-plan-${i}-highlighted`} />
                  <Label className="text-[10px] text-muted-foreground">Highlighted</Label>
                </div>
              </div>
            ))}
            <Button variant="ghost" size="sm" onClick={() => updateProp("plans", [...(props.plans || []), { name: "New Plan", price: "$0", features: ["Feature 1"], highlighted: false }])} className="w-full text-xs" data-testid="button-add-plan">
              <Plus className="w-3 h-3 mr-1" /> Add Plan
            </Button>
          </>
        );

      case "contact-form":
        return (
          <>
            <Field label="Title">
              <Input value={props.title || ""} onChange={(e) => updateProp("title", e.target.value)} data-testid="input-contact-title" />
            </Field>
            <Field label="Subtitle">
              <Input value={props.subtitle || ""} onChange={(e) => updateProp("subtitle", e.target.value)} data-testid="input-contact-subtitle" />
            </Field>
            <Field label="Button Text">
              <Input value={props.buttonText || ""} onChange={(e) => updateProp("buttonText", e.target.value)} data-testid="input-contact-button" />
            </Field>
          </>
        );

      case "testimonials":
        return (
          <ArrayEditor
            label="Testimonials"
            items={props.testimonials || []}
            fields={[
              { key: "name", label: "Name" },
              { key: "role", label: "Role" },
              { key: "quote", label: "Quote" },
            ]}
            template={{ name: "New Person", role: "Title", quote: "Great experience!" }}
            onChange={(items) => updateProp("testimonials", items)}
            testPrefix="testimonial"
          />
        );

      case "gallery":
        return (
          <Field label="Number of Images">
            <Input type="number" min="2" max="20" value={props.count || 8} onChange={(e) => updateProp("count", parseInt(e.target.value) || 8)} data-testid="input-gallery-count" />
          </Field>
        );

      case "video":
        return (
          <>
            <Field label="Video URL">
              <Input value={props.url || ""} onChange={(e) => updateProp("url", e.target.value)} placeholder="https://youtube.com/..." data-testid="input-video-url" />
            </Field>
            <Field label="Height">
              <Input value={props.height || "300px"} onChange={(e) => updateProp("height", e.target.value)} data-testid="input-video-height" />
            </Field>
          </>
        );

      case "faq":
        return (
          <>
            <Field label="Section Title">
              <Input value={props.title || ""} onChange={(e) => updateProp("title", e.target.value)} data-testid="input-faq-title" />
            </Field>
            <ArrayEditor
              label="FAQ Items"
              items={props.items || []}
              fields={[
                { key: "question", label: "Question" },
                { key: "answer", label: "Answer" },
              ]}
              template={{ question: "New question?", answer: "Answer here." }}
              onChange={(items) => updateProp("items", items)}
              testPrefix="faq"
            />
          </>
        );

      case "stats":
        return (
          <ArrayEditor
            label="Statistics"
            items={props.stats || []}
            fields={[
              { key: "value", label: "Value" },
              { key: "label", label: "Label" },
            ]}
            template={{ value: "100+", label: "New Stat" }}
            onChange={(items) => updateProp("stats", items)}
            testPrefix="stat"
          />
        );

      case "team":
        return (
          <ArrayEditor
            label="Team Members"
            items={props.members || []}
            fields={[
              { key: "name", label: "Name" },
              { key: "role", label: "Role" },
              { key: "bio", label: "Bio" },
            ]}
            template={{ name: "New Member", role: "Role", bio: "Bio" }}
            onChange={(items) => updateProp("members", items)}
            testPrefix="team"
          />
        );

      case "social-links":
        return (
          <ArrayEditor
            label="Social Links"
            items={props.links || []}
            fields={[
              { key: "platform", label: "Platform" },
              { key: "url", label: "URL" },
            ]}
            template={{ platform: "Twitter", url: "#" }}
            onChange={(items) => updateProp("links", items)}
            testPrefix="social"
          />
        );

      case "banner":
        return (
          <>
            <Field label="Banner Text">
              <Input value={props.text || ""} onChange={(e) => updateProp("text", e.target.value)} data-testid="input-banner-text" />
            </Field>
            <Field label="Link Text">
              <Input value={props.linkText || ""} onChange={(e) => updateProp("linkText", e.target.value)} placeholder="e.g. Learn More" data-testid="input-banner-link" />
            </Field>
            <Field label="Style">
              <Select value={props.variant || "info"} onValueChange={(v) => updateProp("variant", v)}>
                <SelectTrigger data-testid="select-banner-variant"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="info">Info</SelectItem>
                  <SelectItem value="warning">Warning</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </>
        );

      case "countdown":
        return (
          <>
            <Field label="Title">
              <Input value={props.title || ""} onChange={(e) => updateProp("title", e.target.value)} data-testid="input-countdown-title" />
            </Field>
            <Field label="Subtitle">
              <Input value={props.subtitle || ""} onChange={(e) => updateProp("subtitle", e.target.value)} data-testid="input-countdown-subtitle" />
            </Field>
            <Field label="Target Date">
              <Input type="date" value={props.targetDate || ""} onChange={(e) => updateProp("targetDate", e.target.value)} data-testid="input-countdown-date" />
            </Field>
          </>
        );

      case "newsletter":
        return (
          <>
            <Field label="Title">
              <Input value={props.title || ""} onChange={(e) => updateProp("title", e.target.value)} data-testid="input-newsletter-title" />
            </Field>
            <Field label="Subtitle">
              <Input value={props.subtitle || ""} onChange={(e) => updateProp("subtitle", e.target.value)} data-testid="input-newsletter-subtitle" />
            </Field>
            <Field label="Button Text">
              <Input value={props.buttonText || ""} onChange={(e) => updateProp("buttonText", e.target.value)} data-testid="input-newsletter-button" />
            </Field>
          </>
        );

      case "logo-cloud":
        return (
          <>
            <Field label="Title">
              <Input value={props.title || ""} onChange={(e) => updateProp("title", e.target.value)} data-testid="input-logocloud-title" />
            </Field>
            <p className="text-xs text-muted-foreground">Comma-separated company names:</p>
            <Textarea
              value={(props.logos || []).join(", ")}
              onChange={(e) => updateProp("logos", e.target.value.split(",").map((s: string) => s.trim()).filter(Boolean))}
              className="resize-none"
              data-testid="input-logocloud-logos"
            />
          </>
        );

      case "cta":
        return (
          <>
            <Field label="Title">
              <Input value={props.title || ""} onChange={(e) => updateProp("title", e.target.value)} data-testid="input-cta-title" />
            </Field>
            <Field label="Subtitle">
              <Input value={props.subtitle || ""} onChange={(e) => updateProp("subtitle", e.target.value)} data-testid="input-cta-subtitle" />
            </Field>
            <Field label="Primary Button">
              <Input value={props.primaryButton || ""} onChange={(e) => updateProp("primaryButton", e.target.value)} data-testid="input-cta-primary" />
            </Field>
            <Field label="Secondary Button">
              <Input value={props.secondaryButton || ""} onChange={(e) => updateProp("secondaryButton", e.target.value)} placeholder="Optional" data-testid="input-cta-secondary" />
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
          <ArrayEditor
            label="Features"
            items={props.features || []}
            fields={[
              { key: "title", label: "Title" },
              { key: "desc", label: "Description" },
            ]}
            template={{ title: "New Feature", desc: "Feature description" }}
            onChange={(items) => updateProp("features", items)}
            testPrefix="feature"
          />
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

function ArrayEditor({
  label,
  items,
  fields,
  template,
  onChange,
  testPrefix,
}: {
  label: string;
  items: any[];
  fields: { key: string; label: string }[];
  template: any;
  onChange: (items: any[]) => void;
  testPrefix: string;
}) {
  const updateItem = (index: number, field: string, value: string) => {
    const arr = [...items];
    arr[index] = { ...arr[index], [field]: value };
    onChange(arr);
  };

  const addItem = () => onChange([...items, { ...template }]);

  const removeItem = (index: number) => {
    const arr = [...items];
    arr.splice(index, 1);
    onChange(arr);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs">{label} ({items.length})</Label>
        <Button variant="ghost" size="icon" onClick={addItem} data-testid={`button-add-${testPrefix}`}>
          <Plus className="w-3.5 h-3.5" />
        </Button>
      </div>
      {items.map((item, i) => (
        <div key={i} className="border border-border rounded-md p-2 space-y-1.5">
          {fields.map((f) => (
            <div key={f.key}>
              <Label className="text-[10px] text-muted-foreground">{f.label}</Label>
              <Input
                value={item[f.key] || ""}
                onChange={(e) => updateItem(i, f.key, e.target.value)}
                className="h-7 text-xs"
                data-testid={`input-${testPrefix}-${i}-${f.key}`}
              />
            </div>
          ))}
          <Button variant="ghost" size="sm" className="text-destructive text-xs w-full" onClick={() => removeItem(i)} data-testid={`button-remove-${testPrefix}-${i}`}>
            <Trash2 className="w-3 h-3 mr-1" /> Remove
          </Button>
        </div>
      ))}
    </div>
  );
}
