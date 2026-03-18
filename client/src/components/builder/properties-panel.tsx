import { useRef } from "react";
import type { ComponentBlock } from "@shared/schema";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Settings, Plus, Trash2, Upload, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

interface PropertiesPanelProps {
  block: ComponentBlock | null;
  onChange: (block: ComponentBlock) => void;
}

// Image upload helper
function ImageUploadField({ value, onChange, label, testId }: { value: string; onChange: (url: string) => void; label?: string; testId: string }) {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData, credentials: "include" });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      onChange(data.url);
      toast({ title: "Image uploaded" });
    } catch (err) {
      toast({ title: "Upload failed", variant: "destructive" });
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className="space-y-1.5 w-full">
      {label && <Label className="text-xs">{label}</Label>}
      <div className="flex gap-2">
        <Input value={value || ""} onChange={(e) => onChange(e.target.value)} placeholder="https://... or upload" className="flex-1 text-xs" data-testid={testId} />
        <Button variant="outline" size="icon" className="shrink-0 h-9 w-9" onClick={() => fileRef.current?.click()} disabled={uploading}>
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
        </Button>
      </div>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
    </div>
  );
}

// Per-block style editor
function BlockStyleEditor({ block, onChange }: { block: ComponentBlock; onChange: (block: ComponentBlock) => void }) {
  const style = block.style || {};
  const updateStyle = (key: string, value: string) => {
    onChange({ ...block, style: { ...style, [key]: value || undefined } });
  };

  return (
    <div className="border-t border-border pt-4 mt-4 space-y-3">
      <p className="text-xs font-semibold text-muted-foreground">Block Styling</p>
      <div className="space-y-1.5">
        <Label className="text-[10px]">Background Color</Label>
        <div className="flex gap-2">
          <input type="color" value={style.backgroundColor || "#ffffff"} onChange={(e) => updateStyle("backgroundColor", e.target.value)} className="w-8 h-8 rounded border cursor-pointer" />
          <Input value={style.backgroundColor || ""} onChange={(e) => updateStyle("backgroundColor", e.target.value)} placeholder="transparent" className="flex-1 text-xs" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="text-[10px]">Text Color</Label>
        <div className="flex gap-2">
          <input type="color" value={style.textColor || "#000000"} onChange={(e) => updateStyle("textColor", e.target.value)} className="w-8 h-8 rounded border cursor-pointer" />
          <Input value={style.textColor || ""} onChange={(e) => updateStyle("textColor", e.target.value)} placeholder="inherit" className="flex-1 text-xs" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="text-[10px]">Padding</Label>
        <Input value={style.padding || ""} onChange={(e) => updateStyle("padding", e.target.value)} placeholder="e.g. 16px, 1rem" className="text-xs" />
      </div>
      <div className="space-y-1.5">
        <Label className="text-[10px]">Margin</Label>
        <Input value={style.margin || ""} onChange={(e) => updateStyle("margin", e.target.value)} placeholder="e.g. 8px, 0 auto" className="text-xs" />
      </div>
      <div className="space-y-1.5">
        <Label className="text-[10px]">Border Radius</Label>
        <Input value={style.borderRadius || ""} onChange={(e) => updateStyle("borderRadius", e.target.value)} placeholder="e.g. 8px, 50%" className="text-xs" />
      </div>

      {/* Animation Controls */}
      <div className="border-t border-border pt-3 mt-3 space-y-3">
        <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">✨ Animation</p>
        <div className="space-y-1.5">
          <Label className="text-[10px]">Animation Type</Label>
          <Select value={style.animation || "none"} onValueChange={(v) => updateStyle("animation", v)}>
            <SelectTrigger className="text-xs h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              <SelectItem value="fade-in">Fade In</SelectItem>
              <SelectItem value="slide-up">Slide Up</SelectItem>
              <SelectItem value="slide-down">Slide Down</SelectItem>
              <SelectItem value="slide-left">Slide Left</SelectItem>
              <SelectItem value="slide-right">Slide Right</SelectItem>
              <SelectItem value="zoom-in">Zoom In</SelectItem>
              <SelectItem value="zoom-out">Zoom Out</SelectItem>
              <SelectItem value="flip">Flip</SelectItem>
              <SelectItem value="bounce">Bounce</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <Label className="text-[10px]">Duration</Label>
            <Input value={style.animationDuration || ""} onChange={(e) => updateStyle("animationDuration", e.target.value)} placeholder="0.6s" className="text-xs" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px]">Delay</Label>
            <Input value={style.animationDelay || ""} onChange={(e) => updateStyle("animationDelay", e.target.value)} placeholder="0s" className="text-xs" />
          </div>
        </div>
      </div>
    </div>
  );
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

  const renderFields = () => {
    switch (block.type) {
      case "hero":
        return (
          <>
            <Field label="Title"><Input value={props.title || ""} onChange={(e) => updateProp("title", e.target.value)} /></Field>
            <Field label="Subtitle"><Textarea value={props.subtitle || ""} onChange={(e) => updateProp("subtitle", e.target.value)} className="resize-none" /></Field>
            <Field label="Button Text"><Input value={props.buttonText || ""} onChange={(e) => updateProp("buttonText", e.target.value)} /></Field>
          </>
        );

      case "navbar":
        return (
          <>
            <Field label="Brand Name"><Input value={props.brand || ""} onChange={(e) => updateProp("brand", e.target.value)} /></Field>
            <Field label="CTA Button"><Input value={props.ctaText || ""} onChange={(e) => updateProp("ctaText", e.target.value)} placeholder="e.g. Sign Up" /></Field>
            <ArrayEditor label="Nav Links" items={props.links || []} fields={[{ key: "label", label: "Label" }, { key: "url", label: "URL" }]} template={{ label: "New Link", url: "#" }} onChange={(items) => updateProp("links", items)} testPrefix="navbar-link" />
          </>
        );

      case "footer":
        return (
          <>
            <Field label="Copyright"><Input value={props.copyright || ""} onChange={(e) => updateProp("copyright", e.target.value)} /></Field>
            {(props.columns || []).map((col: any, i: number) => (
              <div key={i} className="border border-border rounded-md p-2 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-[10px] text-muted-foreground font-medium">Column {i + 1}</Label>
                  <Button variant="ghost" size="sm" className="text-destructive text-xs h-6 px-2" onClick={() => { const arr = [...(props.columns || [])]; arr.splice(i, 1); updateProp("columns", arr); }}><Trash2 className="w-3 h-3" /></Button>
                </div>
                <div><Label className="text-[10px] text-muted-foreground">Title</Label><Input value={col.title || ""} onChange={(e) => { const arr = [...(props.columns || [])]; arr[i] = { ...arr[i], title: e.target.value }; updateProp("columns", arr); }} className="h-7 text-xs" /></div>
                <div><Label className="text-[10px] text-muted-foreground">Links (comma-separated)</Label><Input value={(col.links || []).join(", ")} onChange={(e) => { const arr = [...(props.columns || [])]; arr[i] = { ...arr[i], links: e.target.value.split(",").map((s: string) => s.trim()).filter(Boolean) }; updateProp("columns", arr); }} className="h-7 text-xs" /></div>
              </div>
            ))}
            <Button variant="ghost" size="sm" onClick={() => updateProp("columns", [...(props.columns || []), { title: "New Column", links: ["Link 1"] }])} className="w-full text-xs"><Plus className="w-3 h-3 mr-1" /> Add Column</Button>
          </>
        );

      case "product-card":
        return (
          <ArrayEditor label="Products" items={props.products || []} fields={[{ key: "name", label: "Name" }, { key: "price", label: "Price" }, { key: "description", label: "Description", type: "textarea" }, { key: "image", label: "Image", type: "image" }]} template={{ name: "New Product", price: "$0.00", description: "Description", image: "" }} onChange={(items) => updateProp("products", items)} testPrefix="product" />
        );

      case "pricing-table":
        return (
          <>
            {(props.plans || []).map((plan: any, i: number) => (
              <div key={i} className="border border-border rounded-md p-2 space-y-1.5">
                <div className="flex items-center justify-between gap-2"><Label className="text-[10px] font-medium">Plan {i + 1}</Label><Button variant="ghost" size="sm" className="text-destructive text-xs h-6 px-2" onClick={() => { const arr = [...(props.plans || [])]; arr.splice(i, 1); updateProp("plans", arr); }}><Trash2 className="w-3 h-3" /></Button></div>
                <div><Label className="text-[10px] text-muted-foreground">Name</Label><Input value={plan.name || ""} onChange={(e) => { const arr = [...(props.plans || [])]; arr[i] = { ...arr[i], name: e.target.value }; updateProp("plans", arr); }} className="h-7 text-xs" /></div>
                <div><Label className="text-[10px] text-muted-foreground">Price</Label><Input value={plan.price || ""} onChange={(e) => { const arr = [...(props.plans || [])]; arr[i] = { ...arr[i], price: e.target.value }; updateProp("plans", arr); }} className="h-7 text-xs" /></div>
                <div><Label className="text-[10px] text-muted-foreground">Features (comma-separated)</Label><Input value={(plan.features || []).join(", ")} onChange={(e) => { const arr = [...(props.plans || [])]; arr[i] = { ...arr[i], features: e.target.value.split(",").map((s: string) => s.trim()).filter(Boolean) }; updateProp("plans", arr); }} className="h-7 text-xs" /></div>
                <div className="flex items-center gap-2"><input type="checkbox" checked={plan.highlighted || false} onChange={(e) => { const arr = [...(props.plans || [])]; arr[i] = { ...arr[i], highlighted: e.target.checked }; updateProp("plans", arr); }} /><Label className="text-[10px] text-muted-foreground">Highlighted</Label></div>
              </div>
            ))}
            <Button variant="ghost" size="sm" onClick={() => updateProp("plans", [...(props.plans || []), { name: "New Plan", price: "$0", features: ["Feature 1"], highlighted: false }])} className="w-full text-xs"><Plus className="w-3 h-3 mr-1" /> Add Plan</Button>
          </>
        );

      case "contact-form":
        return (
          <>
            <Field label="Title"><Input value={props.title || ""} onChange={(e) => updateProp("title", e.target.value)} /></Field>
            <Field label="Subtitle"><Input value={props.subtitle || ""} onChange={(e) => updateProp("subtitle", e.target.value)} /></Field>
            <Field label="Button Text"><Input value={props.buttonText || ""} onChange={(e) => updateProp("buttonText", e.target.value)} /></Field>
          </>
        );

      case "testimonials":
        return <ArrayEditor label="Testimonials" items={props.testimonials || []} fields={[{ key: "name", label: "Name" }, { key: "role", label: "Role" }, { key: "quote", label: "Quote" }]} template={{ name: "New Person", role: "Title", quote: "Great experience!" }} onChange={(items) => updateProp("testimonials", items)} testPrefix="testimonial" />;

      case "gallery":
        return (
          <ArrayEditor label="Gallery Images" items={props.images?.length ? props.images : Array.from({ length: props.count || 8 }).map(() => ({ src: "" }))} fields={[{ key: "src", label: "Image", type: "image" }]} template={{ src: "" }} onChange={(items) => updateProp("images", items)} testPrefix="gallery" />
        );

      case "video":
        return (
          <>
            <Field label="Video URL"><Input value={props.url || ""} onChange={(e) => updateProp("url", e.target.value)} placeholder="https://youtube.com/..." /></Field>
            <Field label="Height"><Input value={props.height || "300px"} onChange={(e) => updateProp("height", e.target.value)} /></Field>
          </>
        );

      case "faq":
        return (
          <>
            <Field label="Section Title"><Input value={props.title || ""} onChange={(e) => updateProp("title", e.target.value)} /></Field>
            <ArrayEditor label="FAQ Items" items={props.items || []} fields={[{ key: "question", label: "Question" }, { key: "answer", label: "Answer" }]} template={{ question: "New question?", answer: "Answer here." }} onChange={(items) => updateProp("items", items)} testPrefix="faq" />
          </>
        );

      case "stats":
        return <ArrayEditor label="Statistics" items={props.stats || []} fields={[{ key: "value", label: "Value" }, { key: "label", label: "Label" }]} template={{ value: "100+", label: "New Stat" }} onChange={(items) => updateProp("stats", items)} testPrefix="stat" />;

      case "team":
        return <ArrayEditor label="Team Members" items={props.members || []} fields={[{ key: "name", label: "Name" }, { key: "role", label: "Role" }, { key: "bio", label: "Bio", type: "textarea" }, { key: "image", label: "Image", type: "image" }]} template={{ name: "New Member", role: "Role", bio: "Bio", image: "" }} onChange={(items) => updateProp("members", items)} testPrefix="team" />;

      case "social-links":
        return <ArrayEditor label="Social Links" items={props.links || []} fields={[{ key: "platform", label: "Platform" }, { key: "url", label: "URL" }]} template={{ platform: "Twitter", url: "#" }} onChange={(items) => updateProp("links", items)} testPrefix="social" />;

      case "banner":
        return (
          <>
            <Field label="Banner Text"><Input value={props.text || ""} onChange={(e) => updateProp("text", e.target.value)} /></Field>
            <Field label="Link Text"><Input value={props.linkText || ""} onChange={(e) => updateProp("linkText", e.target.value)} placeholder="e.g. Learn More" /></Field>
            <Field label="Style">
              <Select value={props.variant || "info"} onValueChange={(v) => updateProp("variant", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="info">Info</SelectItem><SelectItem value="warning">Warning</SelectItem><SelectItem value="error">Error</SelectItem></SelectContent>
              </Select>
            </Field>
          </>
        );

      case "countdown":
        return (
          <>
            <Field label="Title"><Input value={props.title || ""} onChange={(e) => updateProp("title", e.target.value)} /></Field>
            <Field label="Subtitle"><Input value={props.subtitle || ""} onChange={(e) => updateProp("subtitle", e.target.value)} /></Field>
            <Field label="Target Date"><Input type="date" value={props.targetDate || ""} onChange={(e) => updateProp("targetDate", e.target.value)} /></Field>
          </>
        );

      case "newsletter":
        return (
          <>
            <Field label="Title"><Input value={props.title || ""} onChange={(e) => updateProp("title", e.target.value)} /></Field>
            <Field label="Subtitle"><Input value={props.subtitle || ""} onChange={(e) => updateProp("subtitle", e.target.value)} /></Field>
            <Field label="Button Text"><Input value={props.buttonText || ""} onChange={(e) => updateProp("buttonText", e.target.value)} /></Field>
          </>
        );

      case "logo-cloud":
        return (
          <>
            <Field label="Title"><Input value={props.title || ""} onChange={(e) => updateProp("title", e.target.value)} /></Field>
            <Field label="Logos (comma-separated)"><Textarea value={(props.logos || []).join(", ")} onChange={(e) => updateProp("logos", e.target.value.split(",").map((s: string) => s.trim()).filter(Boolean))} className="resize-none" /></Field>
          </>
        );

      case "cta":
        return (
          <>
            <Field label="Title"><Input value={props.title || ""} onChange={(e) => updateProp("title", e.target.value)} /></Field>
            <Field label="Subtitle"><Input value={props.subtitle || ""} onChange={(e) => updateProp("subtitle", e.target.value)} /></Field>
            <Field label="Primary Button"><Input value={props.primaryButton || ""} onChange={(e) => updateProp("primaryButton", e.target.value)} /></Field>
            <Field label="Secondary Button"><Input value={props.secondaryButton || ""} onChange={(e) => updateProp("secondaryButton", e.target.value)} placeholder="Optional" /></Field>
          </>
        );

      case "heading":
        return (
          <>
            <Field label="Text"><Input value={props.text || ""} onChange={(e) => updateProp("text", e.target.value)} /></Field>
            <AlignField value={props.align} onChange={(v) => updateProp("align", v)} />
          </>
        );

      case "text":
        return (
          <>
            <Field label="Content"><Textarea value={props.text || ""} onChange={(e) => updateProp("text", e.target.value)} className="resize-none min-h-[100px]" /></Field>
            <AlignField value={props.align} onChange={(v) => updateProp("align", v)} />
          </>
        );

      case "button":
        return (
          <>
            <Field label="Label"><Input value={props.text || ""} onChange={(e) => updateProp("text", e.target.value)} /></Field>
            <Field label="URL"><Input value={props.url || ""} onChange={(e) => updateProp("url", e.target.value)} placeholder="https://" /></Field>
            <AlignField value={props.align} onChange={(v) => updateProp("align", v)} />
          </>
        );

      case "image":
        return (
          <>
            <ImageUploadField value={props.src || ""} onChange={(url) => updateProp("src", url)} label="Image" testId="input-image-src" />
            <Field label="Alt Text"><Input value={props.alt || ""} onChange={(e) => updateProp("alt", e.target.value)} /></Field>
            <Field label="Height"><Input value={props.height || "200px"} onChange={(e) => updateProp("height", e.target.value)} /></Field>
          </>
        );

      case "spacer":
        return <Field label="Height"><Input value={props.height || "40px"} onChange={(e) => updateProp("height", e.target.value)} /></Field>;

      case "section":
        return <Field label="Title"><Input value={props.title || ""} onChange={(e) => updateProp("title", e.target.value)} /></Field>;

      case "features":
        return <ArrayEditor label="Features" items={props.features || []} fields={[{ key: "title", label: "Title" }, { key: "desc", label: "Description" }]} template={{ title: "New Feature", desc: "Feature description" }} onChange={(items) => updateProp("features", items)} testPrefix="feature" />;

      // --- NEW COMPONENTS ---

      case "blog-post":
        return (
          <>
            <Field label="Title"><Input value={props.title || ""} onChange={(e) => updateProp("title", e.target.value)} /></Field>
            <Field label="Excerpt"><Textarea value={props.excerpt || ""} onChange={(e) => updateProp("excerpt", e.target.value)} className="resize-none" /></Field>
            <Field label="Author"><Input value={props.author || ""} onChange={(e) => updateProp("author", e.target.value)} /></Field>
            <Field label="Date"><Input type="date" value={props.date || ""} onChange={(e) => updateProp("date", e.target.value)} /></Field>
            <Field label="Category"><Input value={props.category || ""} onChange={(e) => updateProp("category", e.target.value)} /></Field>
            <ImageUploadField value={props.image || ""} onChange={(url) => updateProp("image", url)} label="Cover Image" testId="input-blog-image" />
          </>
        );

      case "blog-list":
        return (
          <>
            <Field label="Section Title"><Input value={props.title || ""} onChange={(e) => updateProp("title", e.target.value)} /></Field>
            <ArrayEditor label="Posts" items={props.posts || []} fields={[{ key: "title", label: "Title" }, { key: "excerpt", label: "Excerpt" }, { key: "author", label: "Author" }, { key: "date", label: "Date" }, { key: "category", label: "Category" }]} template={{ title: "New Post", excerpt: "Post excerpt...", author: "Author", date: "2025-01-01", category: "General" }} onChange={(items) => updateProp("posts", items)} testPrefix="blog-post" />
          </>
        );

      case "cart":
        return (
          <>
            <ArrayEditor label="Cart Items" items={props.items || []} fields={[{ key: "name", label: "Name" }, { key: "price", label: "Price" }, { key: "quantity", label: "Qty" }]} template={{ name: "New Item", price: "$0.00", quantity: 1 }} onChange={(items) => updateProp("items", items)} testPrefix="cart-item" />
            <div className="flex items-center gap-2 mt-2">
              <input type="checkbox" checked={props.showCheckout !== false} onChange={(e) => updateProp("showCheckout", e.target.checked)} />
              <Label className="text-xs">Show Checkout Button</Label>
            </div>
          </>
        );

      case "checkout-form":
        return (
          <>
            <Field label="Title"><Input value={props.title || ""} onChange={(e) => updateProp("title", e.target.value)} /></Field>
            <Field label="Subtitle"><Input value={props.subtitle || ""} onChange={(e) => updateProp("subtitle", e.target.value)} /></Field>
            <Field label="Button Text"><Input value={props.buttonText || ""} onChange={(e) => updateProp("buttonText", e.target.value)} /></Field>
          </>
        );

      case "map":
        return (
          <>
            <Field label="Address"><Input value={props.address || ""} onChange={(e) => updateProp("address", e.target.value)} placeholder="New York, NY" /></Field>
            <Field label="Zoom Level"><Input type="number" min="1" max="20" value={props.zoom || 13} onChange={(e) => updateProp("zoom", parseInt(e.target.value) || 13)} /></Field>
            <Field label="Height"><Input value={props.height || "300px"} onChange={(e) => updateProp("height", e.target.value)} /></Field>
          </>
        );

      case "booking-form":
        return (
          <>
            <Field label="Title"><Input value={props.title || ""} onChange={(e) => updateProp("title", e.target.value)} /></Field>
            <Field label="Subtitle"><Input value={props.subtitle || ""} onChange={(e) => updateProp("subtitle", e.target.value)} /></Field>
            <Field label="Button Text"><Input value={props.buttonText || ""} onChange={(e) => updateProp("buttonText", e.target.value)} /></Field>
            <Field label="Services (comma-separated)"><Input value={(props.services || []).join(", ")} onChange={(e) => updateProp("services", e.target.value.split(",").map((s: string) => s.trim()).filter(Boolean))} /></Field>
          </>
        );

      case "login-form":
        return (
          <>
            <Field label="Title"><Input value={props.title || ""} onChange={(e) => updateProp("title", e.target.value)} /></Field>
            <Field label="Subtitle"><Input value={props.subtitle || ""} onChange={(e) => updateProp("subtitle", e.target.value)} /></Field>
            <Field label="Button Text"><Input value={props.buttonText || ""} onChange={(e) => updateProp("buttonText", e.target.value)} /></Field>
            <div className="flex items-center gap-2">
              <input type="checkbox" checked={props.showSignup !== false} onChange={(e) => updateProp("showSignup", e.target.checked)} />
              <Label className="text-xs">Show Sign Up Link</Label>
            </div>
          </>
        );

      case "project-card":
        return (
          <>
            <Field label="Section Title"><Input value={props.title || ""} onChange={(e) => updateProp("title", e.target.value)} placeholder="Featured Projects" /></Field>
            <ArrayEditor
              label="Projects" testPrefix="project"
              items={props.projects || []}
              template={{ title: "New Project", description: "Project description", image: "", techStack: ["React", "Node.js"], liveUrl: "#", repoUrl: "#" }}
              fields={[
                { key: "title", label: "Title" },
                { key: "description", label: "Description", type: "textarea" },
                { key: "image", label: "Image", type: "image" },
                { key: "techStack", label: "Tech Stack (comma-separated)", type: "comma-array", placeholder: "React, Node.js, PostgreSQL" },
                { key: "liveUrl", label: "Live URL", placeholder: "https://myproject.com" },
                { key: "repoUrl", label: "Repo URL", placeholder: "https://github.com/..." },
              ]}
              onChange={(v) => updateProp("projects", v)}
            />
          </>
        );

      case "experience-timeline":
        return (
          <>
            <Field label="Section Title"><Input value={props.title || ""} onChange={(e) => updateProp("title", e.target.value)} placeholder="Work Experience" /></Field>
            <ArrayEditor
              label="Timeline Items" testPrefix="experience"
              items={props.items || []}
              template={{ title: "Job Title", company: "Company Name", period: "Jan 2023 – Present", description: "Describe your role and key achievements here." }}
              fields={[
                { key: "title", label: "Job Title" },
                { key: "company", label: "Company" },
                { key: "period", label: "Period", placeholder: "Jan 2022 – Present" },
                { key: "description", label: "Description", type: "textarea" },
              ]}
              onChange={(v) => updateProp("items", v)}
            />
          </>
        );

      case "skills-grid":
        return (
          <>
            <Field label="Section Title"><Input value={props.title || ""} onChange={(e) => updateProp("title", e.target.value)} placeholder="Skills & Technologies" /></Field>
            <ArrayEditor
              label="Skills" testPrefix="skill"
              items={props.skills || []}
              template={{ name: "New Skill", level: 75, icon: "code" }}
              fields={[
                { key: "name", label: "Skill Name" },
                { key: "level", label: "Proficiency", type: "range", min: 0, max: 100 },
                { key: "icon", label: "Icon Type", type: "select", options: [
                  { value: "code", label: "Code (Languages/Frameworks)" },
                  { value: "design", label: "Design (UI/UX tools)" },
                  { value: "cloud", label: "Cloud (AWS/GCP/Azure)" },
                  { value: "data", label: "Data (DB/ML/Analytics)" },
                  { value: "mobile", label: "Mobile (iOS/Android)" },
                  { value: "devops", label: "DevOps (CI/CD/Docker)" },
                ]},
              ]}
              onChange={(v) => updateProp("skills", v)}
            />
          </>
        );

      default:
        return <p className="text-sm text-muted-foreground">No properties available for this block type.</p>;
    }
  };

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-4">
        <div>
          <h3 className="text-sm font-semibold capitalize">{block.type} Properties</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Edit the selected block</p>
        </div>
        {renderFields()}
        <BlockStyleEditor block={block} onChange={onChange} />
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

function AlignField({ value, onChange }: { value?: string; onChange: (v: string) => void }) {
  return (
    <Field label="Alignment">
      <Select value={value || "left"} onValueChange={onChange}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="left">Left</SelectItem>
          <SelectItem value="center">Center</SelectItem>
          <SelectItem value="right">Right</SelectItem>
        </SelectContent>
      </Select>
    </Field>
  );
}

function ArrayEditor({
  label, items, fields, template, onChange, testPrefix,
}: {
  label: string;
  items: any[];
  fields: {
    key: string; label: string;
    type?: "text" | "image" | "textarea" | "range" | "select" | "comma-array";
    min?: number; max?: number;
    placeholder?: string;
    options?: { value: string; label: string }[];
  }[];
  template: any;
  onChange: (items: any[]) => void;
  testPrefix: string;
}) {
  const updateItem = (index: number, field: string, value: any) => {
    const arr = [...items]; arr[index] = { ...arr[index], [field]: value }; onChange(arr);
  };
  const addItem = () => onChange([...items, { ...template }]);
  const removeItem = (index: number) => { const arr = [...items]; arr.splice(index, 1); onChange(arr); };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs">{label} ({items.length})</Label>
        <Button variant="ghost" size="icon" onClick={addItem} data-testid={`button-add-${testPrefix}`}><Plus className="w-3.5 h-3.5" /></Button>
      </div>
      {items.map((item, i) => (
        <div key={i} className="border border-border rounded-md p-2 space-y-1.5">
          {fields.map((f) => (
            <div key={f.key}>
              <Label className="text-[10px] text-muted-foreground">
                {f.label}{f.type === "range" ? `: ${item[f.key] ?? f.min ?? 0}%` : ""}
              </Label>
              {f.type === "image" ? (
                <ImageUploadField value={item[f.key] || ""} onChange={(v) => updateItem(i, f.key, v)} testId={`input-${testPrefix}-${i}-${f.key}`} />
              ) : f.type === "textarea" ? (
                <Textarea value={item[f.key] || ""} onChange={(e) => updateItem(i, f.key, e.target.value)} className="min-h-[60px] text-xs resize-none" placeholder={f.placeholder} />
              ) : f.type === "range" ? (
                <input type="range" min={f.min ?? 0} max={f.max ?? 100} value={item[f.key] ?? 75}
                  onChange={(e) => updateItem(i, f.key, parseInt(e.target.value))} className="w-full mt-1" />
              ) : f.type === "select" && f.options ? (
                <Select value={item[f.key] || f.options[0]?.value} onValueChange={(v) => updateItem(i, f.key, v)}>
                  <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {f.options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : f.type === "comma-array" ? (
                <Input value={(item[f.key] || []).join(", ")} placeholder={f.placeholder}
                  onChange={(e) => updateItem(i, f.key, e.target.value.split(",").map((s: string) => s.trim()).filter(Boolean))}
                  className="h-7 text-xs" data-testid={`input-${testPrefix}-${i}-${f.key}`} />
              ) : (
                <Input value={item[f.key] || ""} onChange={(e) => updateItem(i, f.key, e.target.value)} className="h-7 text-xs" placeholder={f.placeholder} data-testid={`input-${testPrefix}-${i}-${f.key}`} />
              )}
            </div>
          ))}
          <Button variant="ghost" size="sm" className="text-destructive text-xs w-full" onClick={() => removeItem(i)} data-testid={`button-remove-${testPrefix}-${i}`}><Trash2 className="w-3 h-3 mr-1" /> Remove</Button>
        </div>
      ))}
    </div>
  );
}
