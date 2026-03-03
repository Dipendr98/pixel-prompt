import { useDraggable } from "@dnd-kit/core";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  LayoutTemplate, Heading, Type, MousePointer, ImageIcon, Minus,
  ArrowUpDown, Star, Square, Navigation, Footprints, ShoppingBag,
  DollarSign, Mail, Quote, GalleryHorizontal, Video, HelpCircle,
  BarChart3, Users, Share2, Flag, Timer, Newspaper, Building2, Megaphone,
  BookOpen, List, ShoppingCart, CreditCard, MapPin, CalendarDays, LogIn,
} from "lucide-react";

const COMPONENT_CATEGORIES = [
  {
    label: "Layout",
    items: [
      { type: "navbar", label: "Navigation Bar", icon: Navigation, description: "Site navigation header" },
      { type: "hero", label: "Hero Section", icon: LayoutTemplate, description: "Full-width hero banner" },
      { type: "section", label: "Section", icon: Square, description: "Container section" },
      { type: "footer", label: "Footer", icon: Footprints, description: "Site footer with links" },
      { type: "banner", label: "Banner", icon: Flag, description: "Announcement banner" },
    ],
  },
  {
    label: "Content",
    items: [
      { type: "heading", label: "Heading", icon: Heading, description: "Heading text element" },
      { type: "text", label: "Text", icon: Type, description: "Paragraph text" },
      { type: "image", label: "Image", icon: ImageIcon, description: "Image with caption" },
      { type: "video", label: "Video Embed", icon: Video, description: "YouTube/Vimeo video" },
      { type: "gallery", label: "Image Gallery", icon: GalleryHorizontal, description: "Photo grid gallery" },
      { type: "button", label: "Button", icon: MousePointer, description: "Call to action button" },
      { type: "cta", label: "CTA Section", icon: Megaphone, description: "Call to action block" },
      { type: "divider", label: "Divider", icon: Minus, description: "Horizontal divider" },
      { type: "spacer", label: "Spacer", icon: ArrowUpDown, description: "Vertical spacing" },
    ],
  },
  {
    label: "E-Commerce",
    items: [
      { type: "product-card", label: "Product Card", icon: ShoppingBag, description: "Product with price & cart" },
      { type: "pricing-table", label: "Pricing Table", icon: DollarSign, description: "Plan comparison table" },
      { type: "cart", label: "Shopping Cart", icon: ShoppingCart, description: "Cart with items & total" },
      { type: "checkout-form", label: "Checkout Form", icon: CreditCard, description: "Payment & shipping form" },
    ],
  },
  {
    label: "Blog",
    items: [
      { type: "blog-post", label: "Blog Post", icon: BookOpen, description: "Single blog post card" },
      { type: "blog-list", label: "Blog List", icon: List, description: "Grid of blog post cards" },
    ],
  },
  {
    label: "Sections",
    items: [
      { type: "features", label: "Features Grid", icon: Star, description: "Feature cards layout" },
      { type: "testimonials", label: "Testimonials", icon: Quote, description: "Customer reviews" },
      { type: "faq", label: "FAQ", icon: HelpCircle, description: "Questions & answers" },
      { type: "stats", label: "Statistics", icon: BarChart3, description: "Number counters" },
      { type: "team", label: "Team Members", icon: Users, description: "Team profiles grid" },
      { type: "logo-cloud", label: "Logo Cloud", icon: Building2, description: "Partner/client logos" },
      { type: "countdown", label: "Countdown", icon: Timer, description: "Event countdown timer" },
      { type: "map", label: "Map", icon: MapPin, description: "Location map embed" },
    ],
  },
  {
    label: "Forms & Auth",
    items: [
      { type: "contact-form", label: "Contact Form", icon: Mail, description: "Contact/inquiry form" },
      { type: "newsletter", label: "Newsletter", icon: Newspaper, description: "Email signup form" },
      { type: "booking-form", label: "Booking Form", icon: CalendarDays, description: "Appointment booking" },
      { type: "login-form", label: "Login Form", icon: LogIn, description: "User sign-in form" },
      { type: "social-links", label: "Social Links", icon: Share2, description: "Social media icons" },
    ],
  },
];

const ALL_TYPES = COMPONENT_CATEGORIES.flatMap((c) => c.items);

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
      className={`flex items-center gap-3 p-2.5 rounded-md cursor-grab active:cursor-grabbing hover-elevate transition-opacity ${isDragging ? "opacity-40" : ""}`}
      data-testid={`library-block-${type}`}
    >
      <div className="flex items-center justify-center w-8 h-8 rounded-md bg-muted shrink-0">
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
        <div className="p-2">
          {COMPONENT_CATEGORIES.map((cat) => (
            <div key={cat.label} className="mb-3">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-2.5 mb-1">{cat.label}</p>
              <div className="space-y-0.5">
                {cat.items.map((c) => (
                  <DraggableBlock key={c.type} {...c} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

export { COMPONENT_CATEGORIES, ALL_TYPES };
