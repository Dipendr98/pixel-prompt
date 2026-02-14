import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { ComponentBlock } from "@shared/schema";
import {
  GripVertical, Trash2, LayoutTemplate, Heading, Type, MousePointer, ImageIcon, Minus,
  ArrowUpDown, Star, Square, Navigation, Footprints, ShoppingBag, DollarSign, Mail,
  Quote, GalleryHorizontal, Video, HelpCircle, BarChart3, Users, Share2, Flag,
  Timer, Newspaper, Building2, Megaphone, ShoppingCart, ChevronDown, Check,
  Play, Globe, MapPin, Phone, Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const iconMap: Record<string, any> = {
  hero: LayoutTemplate, section: Square, heading: Heading, text: Type, button: MousePointer,
  image: ImageIcon, divider: Minus, spacer: ArrowUpDown, features: Star, navbar: Navigation,
  footer: Footprints, "product-card": ShoppingBag, "pricing-table": DollarSign,
  "contact-form": Mail, testimonials: Quote, gallery: GalleryHorizontal, video: Video,
  faq: HelpCircle, stats: BarChart3, team: Users, "social-links": Share2, banner: Flag,
  countdown: Timer, newsletter: Newspaper, "logo-cloud": Building2, cta: Megaphone,
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

    case "navbar":
      return (
        <div className="flex items-center justify-between p-4 bg-card rounded-md border border-border">
          <span className="font-bold text-sm">{props.brand || "Brand"}</span>
          <div className="flex items-center gap-4">
            {(props.links || [{ label: "Home" }, { label: "Products" }, { label: "About" }, { label: "Contact" }]).map((l: any, i: number) => (
              <span key={i} className="text-xs text-muted-foreground">{l.label}</span>
            ))}
            {props.ctaText && (
              <span className="text-xs bg-primary text-primary-foreground px-3 py-1 rounded-md">{props.ctaText}</span>
            )}
          </div>
        </div>
      );

    case "footer":
      return (
        <div className="bg-muted/50 rounded-md p-6">
          <div className="grid grid-cols-3 gap-4 mb-4">
            {(props.columns || [
              { title: "Company", links: ["About", "Careers", "Blog"] },
              { title: "Support", links: ["Help Center", "Contact", "FAQ"] },
              { title: "Legal", links: ["Privacy", "Terms", "Cookies"] },
            ]).map((col: any, i: number) => (
              <div key={i}>
                <p className="text-xs font-semibold mb-2">{col.title}</p>
                {(col.links || []).map((link: string, j: number) => (
                  <p key={j} className="text-xs text-muted-foreground">{link}</p>
                ))}
              </div>
            ))}
          </div>
          <hr className="border-border mb-3" />
          <p className="text-xs text-muted-foreground text-center">{props.copyright || "2025 Your Company. All rights reserved."}</p>
        </div>
      );

    case "product-card":
      return (
        <div className="grid grid-cols-3 gap-4">
          {(props.products || [
            { name: "Product 1", price: "$29.99", description: "Amazing product for you", image: "" },
            { name: "Product 2", price: "$49.99", description: "Premium quality item", image: "" },
            { name: "Product 3", price: "$19.99", description: "Best seller this month", image: "" },
          ]).map((p: any, i: number) => (
            <div key={i} className="bg-card rounded-md border border-border overflow-hidden">
              <div className="h-28 bg-muted flex items-center justify-center">
                <ShoppingBag className="w-8 h-8 text-muted-foreground" />
              </div>
              <div className="p-3">
                <p className="text-sm font-medium">{p.name}</p>
                <p className="text-xs text-muted-foreground mt-1">{p.description}</p>
                <div className="flex items-center justify-between mt-3">
                  <span className="text-sm font-bold text-primary">{p.price}</span>
                  <span className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded-md flex items-center gap-1">
                    <ShoppingCart className="w-3 h-3" /> Add
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      );

    case "pricing-table":
      return (
        <div className="grid grid-cols-3 gap-4">
          {(props.plans || [
            { name: "Basic", price: "$9/mo", features: ["5 Products", "Basic Analytics", "Email Support"], highlighted: false },
            { name: "Pro", price: "$29/mo", features: ["Unlimited Products", "Advanced Analytics", "Priority Support", "Custom Domain"], highlighted: true },
            { name: "Enterprise", price: "$99/mo", features: ["Everything in Pro", "Dedicated Manager", "SLA", "API Access"], highlighted: false },
          ]).map((plan: any, i: number) => (
            <div key={i} className={`rounded-md border p-4 text-center ${plan.highlighted ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border"}`}>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{plan.name}</p>
              <p className="text-2xl font-bold mt-2">{plan.price}</p>
              <div className="mt-3 space-y-1.5">
                {(plan.features || []).map((f: string, j: number) => (
                  <p key={j} className="text-xs text-muted-foreground flex items-center gap-1.5 justify-center">
                    <Check className="w-3 h-3 text-primary shrink-0" /> {f}
                  </p>
                ))}
              </div>
              <div className={`mt-4 text-xs px-3 py-2 rounded-md font-medium ${plan.highlighted ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                Choose Plan
              </div>
            </div>
          ))}
        </div>
      );

    case "contact-form":
      return (
        <div className="max-w-md mx-auto bg-card rounded-md border border-border p-6">
          <h3 className="text-lg font-semibold mb-1">{props.title || "Get in Touch"}</h3>
          <p className="text-xs text-muted-foreground mb-4">{props.subtitle || "We'd love to hear from you"}</p>
          <div className="space-y-3">
            <div className="h-9 rounded-md border border-border bg-muted/30 flex items-center px-3">
              <span className="text-xs text-muted-foreground">Your Name</span>
            </div>
            <div className="h-9 rounded-md border border-border bg-muted/30 flex items-center px-3">
              <span className="text-xs text-muted-foreground">Email Address</span>
            </div>
            <div className="h-20 rounded-md border border-border bg-muted/30 flex items-start p-3">
              <span className="text-xs text-muted-foreground">Your Message</span>
            </div>
            <div className="bg-primary text-primary-foreground text-center text-sm py-2 rounded-md font-medium">
              {props.buttonText || "Send Message"}
            </div>
          </div>
        </div>
      );

    case "testimonials":
      return (
        <div className="grid grid-cols-3 gap-4">
          {(props.testimonials || [
            { name: "Sarah J.", role: "CEO", quote: "This product changed our business completely. Highly recommended!" },
            { name: "Mike R.", role: "Designer", quote: "The best tool I've used in my career. Simple yet powerful." },
            { name: "Lisa K.", role: "Developer", quote: "Incredible experience from start to finish. 5 stars!" },
          ]).map((t: any, i: number) => (
            <div key={i} className="bg-card rounded-md border border-border p-4">
              <Quote className="w-5 h-5 text-primary/40 mb-2" />
              <p className="text-xs text-muted-foreground italic mb-3">"{t.quote}"</p>
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                  {(t.name || "A")[0]}
                </div>
                <div>
                  <p className="text-xs font-medium">{t.name}</p>
                  <p className="text-[10px] text-muted-foreground">{t.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      );

    case "gallery":
      return (
        <div className="grid grid-cols-4 gap-2">
          {Array.from({ length: props.count || 8 }).map((_, i) => (
            <div key={i} className="aspect-square bg-muted rounded-md flex items-center justify-center">
              <ImageIcon className="w-5 h-5 text-muted-foreground" />
            </div>
          ))}
        </div>
      );

    case "video":
      return (
        <div className="bg-muted rounded-md flex items-center justify-center" style={{ height: props.height || "300px" }}>
          <div className="text-center">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-2">
              <Play className="w-6 h-6 text-primary ml-1" />
            </div>
            <p className="text-xs text-muted-foreground">{props.url || "Video Embed"}</p>
          </div>
        </div>
      );

    case "faq":
      return (
        <div className="max-w-2xl mx-auto space-y-2">
          <h3 className="text-lg font-semibold text-center mb-4">{props.title || "Frequently Asked Questions"}</h3>
          {(props.items || [
            { question: "What is your return policy?", answer: "We offer a 30-day money-back guarantee on all products." },
            { question: "How long does shipping take?", answer: "Standard shipping takes 3-5 business days." },
            { question: "Do you offer customer support?", answer: "Yes, 24/7 support via chat and email." },
          ]).map((item: any, i: number) => (
            <div key={i} className="border border-border rounded-md p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">{item.question}</p>
                <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
              </div>
              <p className="text-xs text-muted-foreground mt-2">{item.answer}</p>
            </div>
          ))}
        </div>
      );

    case "stats":
      return (
        <div className="grid grid-cols-4 gap-4 text-center">
          {(props.stats || [
            { value: "10K+", label: "Customers" },
            { value: "99.9%", label: "Uptime" },
            { value: "50+", label: "Countries" },
            { value: "24/7", label: "Support" },
          ]).map((s: any, i: number) => (
            <div key={i} className="p-4">
              <p className="text-2xl font-bold text-primary">{s.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      );

    case "team":
      return (
        <div className="grid grid-cols-4 gap-4">
          {(props.members || [
            { name: "John Doe", role: "CEO", bio: "Visionary leader" },
            { name: "Jane Smith", role: "CTO", bio: "Tech innovator" },
            { name: "Alex Chen", role: "Designer", bio: "Creative mind" },
            { name: "Sam Wilson", role: "Marketing", bio: "Growth expert" },
          ]).map((m: any, i: number) => (
            <div key={i} className="text-center p-4">
              <div className="w-14 h-14 rounded-full bg-primary/10 mx-auto mb-2 flex items-center justify-center">
                <Users className="w-6 h-6 text-primary" />
              </div>
              <p className="text-sm font-medium">{m.name}</p>
              <p className="text-xs text-primary">{m.role}</p>
              <p className="text-xs text-muted-foreground mt-1">{m.bio}</p>
            </div>
          ))}
        </div>
      );

    case "social-links":
      return (
        <div className="flex items-center justify-center gap-3 py-4">
          {(props.links || [
            { platform: "Twitter", url: "#" },
            { platform: "Facebook", url: "#" },
            { platform: "Instagram", url: "#" },
            { platform: "LinkedIn", url: "#" },
            { platform: "YouTube", url: "#" },
          ]).map((s: any, i: number) => (
            <div key={i} className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
              <Globe className="w-4 h-4 text-muted-foreground" />
            </div>
          ))}
        </div>
      );

    case "banner":
      return (
        <div className={`rounded-md p-4 text-center ${props.variant === "warning" ? "bg-yellow-500/10 border border-yellow-500/30" : props.variant === "error" ? "bg-destructive/10 border border-destructive/30" : "bg-primary/10 border border-primary/30"}`}>
          <p className="text-sm font-medium">{props.text || "Special offer: Get 20% off today!"}</p>
          {props.linkText && <p className="text-xs text-primary mt-1">{props.linkText}</p>}
        </div>
      );

    case "countdown":
      return (
        <div className="text-center py-6">
          <h3 className="text-lg font-semibold mb-4">{props.title || "Coming Soon"}</h3>
          <div className="flex items-center justify-center gap-4">
            {["Days", "Hours", "Min", "Sec"].map((unit) => (
              <div key={unit} className="bg-muted rounded-md p-3 min-w-[60px]">
                <p className="text-xl font-bold">00</p>
                <p className="text-[10px] text-muted-foreground">{unit}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-3">{props.subtitle || "Something amazing is on the way"}</p>
        </div>
      );

    case "newsletter":
      return (
        <div className="bg-primary/5 rounded-md p-6 text-center max-w-lg mx-auto">
          <h3 className="text-lg font-semibold">{props.title || "Stay Updated"}</h3>
          <p className="text-xs text-muted-foreground mt-1 mb-4">{props.subtitle || "Subscribe to our newsletter for the latest updates"}</p>
          <div className="flex gap-2">
            <div className="flex-1 h-9 rounded-md border border-border bg-background flex items-center px-3">
              <span className="text-xs text-muted-foreground">Enter your email</span>
            </div>
            <div className="bg-primary text-primary-foreground text-sm px-4 py-2 rounded-md font-medium">
              {props.buttonText || "Subscribe"}
            </div>
          </div>
        </div>
      );

    case "logo-cloud":
      return (
        <div className="text-center py-4">
          <p className="text-xs text-muted-foreground mb-4">{props.title || "Trusted by leading companies"}</p>
          <div className="flex items-center justify-center gap-6 flex-wrap">
            {(props.logos || ["Company A", "Company B", "Company C", "Company D", "Company E"]).map((name: string, i: number) => (
              <div key={i} className="bg-muted rounded-md px-4 py-2">
                <span className="text-xs font-medium text-muted-foreground">{name}</span>
              </div>
            ))}
          </div>
        </div>
      );

    case "cta":
      return (
        <div className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-md p-8 text-center">
          <h3 className="text-xl font-bold">{props.title || "Ready to Get Started?"}</h3>
          <p className="text-sm text-muted-foreground mt-2 mb-4">{props.subtitle || "Join thousands of satisfied customers today"}</p>
          <div className="flex items-center justify-center gap-3">
            <span className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium">
              {props.primaryButton || "Get Started"}
            </span>
            {props.secondaryButton && (
              <span className="border border-border px-4 py-2 rounded-md text-sm">
                {props.secondaryButton}
              </span>
            )}
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
          {props.text || "Lorem ipsum dolor sit amet, consectetur adipiscing elit."}
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
