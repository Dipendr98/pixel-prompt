import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Project, ProjectData } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus, Layers, MoreVertical, Pencil, Trash2, CreditCard, LifeBuoy, Send, ShieldCheck,
  Loader2, FolderOpen, ShoppingBag, Rocket, Briefcase, UtensilsCrossed, Building2,
  BookOpen, Calendar, GraduationCap, User, FileText, Sparkles,
} from "lucide-react";

// ---- Multi-page Templates ----

const TEMPLATES: {
  id: string; name: string; description: string; icon: any; schema: ProjectData;
}[] = [
    {
      id: "blank",
      name: "Blank",
      description: "Start from scratch",
      icon: FileText,
      schema: {
        pages: [{ id: "home", name: "Home", path: "/", blocks: [], seo: {} }],
        settings: { primaryColor: "#3b82f6", fontFamily: "Inter" },
      },
    },
    {
      id: "ecommerce",
      name: "E-Commerce",
      description: "Online store with products & cart",
      icon: ShoppingBag,
      schema: {
        pages: [
          {
            id: "home", name: "Home", path: "/",
            blocks: [
              { id: "ec1", type: "navbar", props: { brand: "MyShop", links: [{ label: "Home", url: "/" }, { label: "Products", url: "/products" }, { label: "About", url: "/about" }, { label: "Contact", url: "/contact" }], ctaText: "Cart" } },
              { id: "ec2", type: "hero", props: { title: "Welcome to MyShop", subtitle: "Discover our amazing products at great prices", buttonText: "Shop Now" } },
              { id: "ec3", type: "product-card", props: { products: [{ name: "Wireless Headphones", price: "$79.99", description: "Premium sound quality", image: "" }, { name: "Smart Watch", price: "$199.99", description: "Track your fitness", image: "" }, { name: "Laptop Stand", price: "$49.99", description: "Ergonomic design", image: "" }] } },
              { id: "ec4", type: "banner", props: { text: "Free shipping on orders over $50!", linkText: "Shop Now", variant: "info" } },
              { id: "ec5", type: "testimonials", props: { testimonials: [{ name: "Sarah J.", role: "Verified Buyer", quote: "Amazing quality products!" }, { name: "Mike R.", role: "Loyal Customer", quote: "Best online store experience" }] } },
              { id: "ec6", type: "newsletter", props: { title: "Join Our Newsletter", subtitle: "Get 10% off your first order", buttonText: "Subscribe" } },
              { id: "ec7", type: "footer", props: { columns: [{ title: "Shop", links: ["New Arrivals", "Best Sellers", "Sale"] }, { title: "Help", links: ["Shipping", "Returns", "FAQ"] }, { title: "Company", links: ["About", "Contact", "Blog"] }], copyright: "2025 MyShop. All rights reserved." } },
            ],
            seo: { title: "MyShop - Premium Products", description: "Shop the best products online" },
          },
          {
            id: "products", name: "Products", path: "/products",
            blocks: [
              { id: "ep1", type: "navbar", props: { brand: "MyShop", links: [{ label: "Home", url: "/" }, { label: "Products", url: "/products" }, { label: "About", url: "/about" }, { label: "Contact", url: "/contact" }], ctaText: "Cart" } },
              { id: "ep2", type: "heading", props: { text: "All Products", align: "center" } },
              { id: "ep3", type: "product-card", props: { products: [{ name: "Wireless Headphones", price: "$79.99", description: "Premium sound", image: "" }, { name: "Smart Watch", price: "$199.99", description: "Fitness tracker", image: "" }, { name: "Laptop Stand", price: "$49.99", description: "Ergonomic", image: "" }, { name: "USB-C Hub", price: "$39.99", description: "Multi-port", image: "" }, { name: "Mechanical Keyboard", price: "$129.99", description: "RGB backlit", image: "" }, { name: "Webcam HD", price: "$59.99", description: "1080p streaming", image: "" }] } },
              { id: "ep4", type: "footer", props: { columns: [{ title: "Shop", links: ["New Arrivals", "Sale"] }, { title: "Help", links: ["FAQ", "Contact"] }], copyright: "2025 MyShop" } },
            ],
            seo: { title: "Products - MyShop" },
          },
          {
            id: "about", name: "About", path: "/about",
            blocks: [
              { id: "ea1", type: "navbar", props: { brand: "MyShop", links: [{ label: "Home", url: "/" }, { label: "Products", url: "/products" }, { label: "About", url: "/about" }, { label: "Contact", url: "/contact" }] } },
              { id: "ea2", type: "hero", props: { title: "About MyShop", subtitle: "We're passionate about bringing you the best products", buttonText: "Our Story" } },
              { id: "ea3", type: "stats", props: { stats: [{ value: "10K+", label: "Happy Customers" }, { value: "500+", label: "Products" }, { value: "50+", label: "Countries" }, { value: "24/7", label: "Support" }] } },
              { id: "ea4", type: "team", props: { members: [{ name: "John Doe", role: "CEO", bio: "Founder & Visionary" }, { name: "Jane Smith", role: "CTO", bio: "Tech Leader" }] } },
              { id: "ea5", type: "footer", props: { columns: [{ title: "Company", links: ["About", "Careers"] }], copyright: "2025 MyShop" } },
            ],
            seo: { title: "About - MyShop" },
          },
          {
            id: "contact", name: "Contact", path: "/contact",
            blocks: [
              { id: "econ1", type: "navbar", props: { brand: "MyShop", links: [{ label: "Home", url: "/" }, { label: "Products", url: "/products" }, { label: "About", url: "/about" }, { label: "Contact", url: "/contact" }] } },
              { id: "econ2", type: "contact-form", props: { title: "Contact Us", subtitle: "We'd love to hear from you", buttonText: "Send Message" } },
              { id: "econ3", type: "map", props: { address: "New York, NY", zoom: 13, height: "300px" } },
              { id: "econ4", type: "footer", props: { columns: [{ title: "Company", links: ["About", "Contact"] }], copyright: "2025 MyShop" } },
            ],
            seo: { title: "Contact - MyShop" },
          },
        ],
        settings: { primaryColor: "#3b82f6", secondaryColor: "#10b981", fontFamily: "Inter" },
      },
    },
    {
      id: "saas",
      name: "SaaS Landing",
      description: "Software product landing page",
      icon: Rocket,
      schema: {
        pages: [
          {
            id: "home", name: "Home", path: "/",
            blocks: [
              { id: "s1", type: "navbar", props: { brand: "AppName", links: [{ label: "Features", url: "#" }, { label: "Pricing", url: "/pricing" }, { label: "Blog", url: "/blog" }, { label: "Contact", url: "/contact" }], ctaText: "Start Free" } },
              { id: "s2", type: "hero", props: { title: "The Modern Tool for Modern Teams", subtitle: "Streamline your workflow and boost productivity with our all-in-one platform", buttonText: "Start Free Trial" } },
              { id: "s3", type: "logo-cloud", props: { title: "Trusted by 10,000+ companies", logos: ["Acme Corp", "TechStart", "CloudBase", "DataFlow", "NetScale"] } },
              { id: "s4", type: "features", props: { features: [{ title: "Fast & Reliable", desc: "99.9% uptime guarantee" }, { title: "Secure by Default", desc: "Enterprise-grade security" }, { title: "Easy Integration", desc: "Connect with 100+ tools" }] } },
              { id: "s5", type: "stats", props: { stats: [{ value: "10K+", label: "Customers" }, { value: "99.9%", label: "Uptime" }, { value: "50M+", label: "Data Points" }, { value: "24/7", label: "Support" }] } },
              { id: "s6", type: "testimonials", props: { testimonials: [{ name: "Sarah J.", role: "CEO, TechCo", quote: "This tool transformed how our team works" }, { name: "Mike R.", role: "CTO, StartupXYZ", quote: "Best investment we've made this year" }] } },
              { id: "s7", type: "cta", props: { title: "Ready to Get Started?", subtitle: "Join 10,000+ teams already using our platform", primaryButton: "Start Free Trial", secondaryButton: "Book Demo" } },
              { id: "s8", type: "footer", props: { columns: [{ title: "Product", links: ["Features", "Pricing", "Integrations"] }, { title: "Company", links: ["About", "Blog", "Careers"] }, { title: "Support", links: ["Help Center", "Status", "Contact"] }], copyright: "2025 AppName. All rights reserved." } },
            ],
            seo: { title: "AppName - The Modern Platform for Teams" },
          },
          {
            id: "pricing", name: "Pricing", path: "/pricing",
            blocks: [
              { id: "sp1", type: "navbar", props: { brand: "AppName", links: [{ label: "Home", url: "/" }, { label: "Pricing", url: "/pricing" }, { label: "Blog", url: "/blog" }], ctaText: "Start Free" } },
              { id: "sp2", type: "heading", props: { text: "Simple, Transparent Pricing", align: "center" } },
              { id: "sp3", type: "pricing-table", props: { plans: [{ name: "Starter", price: "$9/mo", features: ["5 Users", "10GB Storage", "Email Support"], highlighted: false }, { name: "Pro", price: "$29/mo", features: ["Unlimited Users", "100GB Storage", "Priority Support", "API Access"], highlighted: true }, { name: "Enterprise", price: "Custom", features: ["Everything in Pro", "Dedicated Manager", "SLA", "Custom Integrations"], highlighted: false }] } },
              { id: "sp4", type: "faq", props: { title: "Pricing FAQ", items: [{ question: "Can I cancel anytime?", answer: "Yes, you can cancel your subscription at any time." }, { question: "Is there a free trial?", answer: "Yes, all plans come with a 14-day free trial." }] } },
              { id: "sp5", type: "footer", props: { columns: [{ title: "Product", links: ["Features", "Pricing"] }], copyright: "2025 AppName" } },
            ],
            seo: { title: "Pricing - AppName" },
          },
        ],
        settings: { primaryColor: "#6366f1", fontFamily: "Inter" },
      },
    },
    {
      id: "portfolio",
      name: "Portfolio",
      description: "Creative portfolio showcase",
      icon: Briefcase,
      schema: {
        pages: [
          {
            id: "home", name: "Home", path: "/",
            blocks: [
              { id: "p1", type: "navbar", props: { brand: "Jane Designer", links: [{ label: "Home", url: "/" }, { label: "Work", url: "/work" }, { label: "About", url: "/about" }, { label: "Contact", url: "/contact" }] } },
              { id: "p2", type: "hero", props: { title: "Hi, I'm Jane", subtitle: "I design beautiful digital experiences that make a difference", buttonText: "View My Work" } },
              { id: "p3", type: "gallery", props: { count: 6 } },
              { id: "p4", type: "stats", props: { stats: [{ value: "50+", label: "Projects" }, { value: "30+", label: "Clients" }, { value: "5", label: "Awards" }, { value: "8+", label: "Years" }] } },
              { id: "p5", type: "cta", props: { title: "Let's Work Together", subtitle: "Have a project in mind? I'd love to help bring it to life.", primaryButton: "Get in Touch" } },
              { id: "p6", type: "footer", props: { columns: [{ title: "Connect", links: ["Twitter", "Dribbble", "LinkedIn", "GitHub"] }], copyright: "2025 Jane Designer." } },
            ],
            seo: { title: "Jane Designer - Portfolio" },
          },
          {
            id: "work", name: "Work", path: "/work",
            blocks: [
              { id: "pw1", type: "navbar", props: { brand: "Jane Designer", links: [{ label: "Home", url: "/" }, { label: "Work", url: "/work" }, { label: "About", url: "/about" }, { label: "Contact", url: "/contact" }] } },
              { id: "pw2", type: "heading", props: { text: "Selected Work", align: "center" } },
              { id: "pw3", type: "gallery", props: { count: 12 } },
              { id: "pw4", type: "footer", props: { columns: [{ title: "Connect", links: ["Twitter", "LinkedIn"] }], copyright: "2025 Jane Designer" } },
            ],
            seo: { title: "Work - Jane Designer" },
          },
          {
            id: "about", name: "About", path: "/about",
            blocks: [
              { id: "pa1", type: "navbar", props: { brand: "Jane Designer", links: [{ label: "Home", url: "/" }, { label: "Work", url: "/work" }, { label: "About", url: "/about" }, { label: "Contact", url: "/contact" }] } },
              { id: "pa2", type: "hero", props: { title: "About Me", subtitle: "Passionate designer with 8+ years of experience creating digital products", buttonText: "Download Resume" } },
              { id: "pa3", type: "features", props: { features: [{ title: "UI/UX Design", desc: "User-centered design" }, { title: "Branding", desc: "Visual identity systems" }, { title: "Web Development", desc: "Frontend implementation" }] } },
              { id: "pa4", type: "footer", props: { columns: [{ title: "Connect", links: ["Twitter", "LinkedIn"] }], copyright: "2025 Jane Designer" } },
            ],
            seo: { title: "About - Jane Designer" },
          },
          {
            id: "contact", name: "Contact", path: "/contact",
            blocks: [
              { id: "pc1", type: "navbar", props: { brand: "Jane Designer", links: [{ label: "Home", url: "/" }, { label: "Work", url: "/work" }, { label: "About", url: "/about" }, { label: "Contact", url: "/contact" }] } },
              { id: "pc2", type: "contact-form", props: { title: "Let's Chat", subtitle: "Tell me about your project", buttonText: "Send Message" } },
              { id: "pc3", type: "social-links", props: { links: [{ platform: "Twitter", url: "#" }, { platform: "Dribbble", url: "#" }, { platform: "LinkedIn", url: "#" }] } },
              { id: "pc4", type: "footer", props: { columns: [{ title: "Connect", links: ["Twitter", "LinkedIn"] }], copyright: "2025 Jane Designer" } },
            ],
            seo: { title: "Contact - Jane Designer" },
          },
        ],
        settings: { primaryColor: "#ec4899", fontFamily: "Playfair Display" },
      },
    },
    {
      id: "restaurant",
      name: "Restaurant",
      description: "Restaurant with menu & booking",
      icon: UtensilsCrossed,
      schema: {
        pages: [
          {
            id: "home", name: "Home", path: "/",
            blocks: [
              { id: "r1", type: "navbar", props: { brand: "La Cucina", links: [{ label: "Home", url: "/" }, { label: "Menu", url: "/menu" }, { label: "Book a Table", url: "/book" }, { label: "Contact", url: "/contact" }], ctaText: "Reserve" } },
              { id: "r2", type: "hero", props: { title: "La Cucina Restaurant", subtitle: "Experience authentic Italian cuisine in the heart of the city", buttonText: "Book a Table" } },
              { id: "r3", type: "features", props: { features: [{ title: "Fresh Ingredients", desc: "Locally sourced daily" }, { title: "Expert Chefs", desc: "Michelin-trained team" }, { title: "Cozy Ambiance", desc: "Perfect for any occasion" }] } },
              { id: "r4", type: "gallery", props: { count: 6 } },
              { id: "r5", type: "testimonials", props: { testimonials: [{ name: "Emma L.", role: "Food Critic", quote: "Best Italian restaurant in the city!" }, { name: "David M.", role: "Regular", quote: "Our family's favorite dinner spot" }] } },
              { id: "r6", type: "map", props: { address: "123 Main St, New York, NY", zoom: 15, height: "300px" } },
              { id: "r7", type: "footer", props: { columns: [{ title: "Hours", links: ["Mon-Fri: 11am-10pm", "Sat-Sun: 10am-11pm"] }, { title: "Contact", links: ["(555) 123-4567", "info@lacucina.com"] }], copyright: "2025 La Cucina." } },
            ],
            seo: { title: "La Cucina - Authentic Italian Restaurant" },
          },
          {
            id: "menu", name: "Menu", path: "/menu",
            blocks: [
              { id: "rm1", type: "navbar", props: { brand: "La Cucina", links: [{ label: "Home", url: "/" }, { label: "Menu", url: "/menu" }, { label: "Book a Table", url: "/book" }, { label: "Contact", url: "/contact" }] } },
              { id: "rm2", type: "heading", props: { text: "Our Menu", align: "center" } },
              { id: "rm3", type: "product-card", props: { products: [{ name: "Margherita Pizza", price: "$14.99", description: "Classic Italian pizza", image: "" }, { name: "Pasta Carbonara", price: "$16.99", description: "Creamy pasta with bacon", image: "" }, { name: "Tiramisu", price: "$9.99", description: "Classic Italian dessert", image: "" }] } },
              { id: "rm4", type: "footer", props: { columns: [{ title: "Contact", links: ["(555) 123-4567"] }], copyright: "2025 La Cucina" } },
            ],
            seo: { title: "Menu - La Cucina" },
          },
          {
            id: "book", name: "Book a Table", path: "/book",
            blocks: [
              { id: "rb1", type: "navbar", props: { brand: "La Cucina", links: [{ label: "Home", url: "/" }, { label: "Menu", url: "/menu" }, { label: "Book a Table", url: "/book" }, { label: "Contact", url: "/contact" }] } },
              { id: "rb2", type: "booking-form", props: { title: "Reserve a Table", subtitle: "Choose your preferred date and party size", buttonText: "Book Now", services: ["Lunch", "Dinner", "Private Event", "Catering"] } },
              { id: "rb3", type: "footer", props: { columns: [{ title: "Contact", links: ["(555) 123-4567"] }], copyright: "2025 La Cucina" } },
            ],
            seo: { title: "Book a Table - La Cucina" },
          },
        ],
        settings: { primaryColor: "#dc2626", fontFamily: "Playfair Display" },
      },
    },
    {
      id: "agency",
      name: "Agency",
      description: "Creative agency landing",
      icon: Building2,
      schema: {
        pages: [
          {
            id: "home", name: "Home", path: "/",
            blocks: [
              { id: "a1", type: "navbar", props: { brand: "PixelForge", links: [{ label: "Home", url: "/" }, { label: "Services", url: "/services" }, { label: "Portfolio", url: "/portfolio" }, { label: "Contact", url: "/contact" }], ctaText: "Get a Quote" } },
              { id: "a2", type: "hero", props: { title: "We Build Digital Experiences", subtitle: "Award-winning design & development agency helping brands grow", buttonText: "See Our Work" } },
              { id: "a3", type: "stats", props: { stats: [{ value: "200+", label: "Projects" }, { value: "50+", label: "Clients" }, { value: "12", label: "Awards" }, { value: "8", label: "Years" }] } },
              { id: "a4", type: "features", props: { features: [{ title: "Strategy", desc: "Data-driven digital strategy" }, { title: "Design", desc: "Beautiful visual experiences" }, { title: "Development", desc: "Scalable web solutions" }] } },
              { id: "a5", type: "logo-cloud", props: { title: "Clients we've worked with", logos: ["Google", "Meta", "Amazon", "Microsoft", "Apple"] } },
              { id: "a6", type: "cta", props: { title: "Let's Build Something Great", subtitle: "Ready to start your next project?", primaryButton: "Get a Quote", secondaryButton: "View Portfolio" } },
              { id: "a7", type: "footer", props: { columns: [{ title: "Services", links: ["Design", "Development", "Strategy"] }, { title: "Company", links: ["About", "Careers", "Blog"] }], copyright: "2025 PixelForge Agency." } },
            ],
            seo: { title: "PixelForge - Digital Agency" },
          },
          {
            id: "services", name: "Services", path: "/services",
            blocks: [
              { id: "as1", type: "navbar", props: { brand: "PixelForge", links: [{ label: "Home", url: "/" }, { label: "Services", url: "/services" }, { label: "Portfolio", url: "/portfolio" }, { label: "Contact", url: "/contact" }] } },
              { id: "as2", type: "heading", props: { text: "Our Services", align: "center" } },
              { id: "as3", type: "pricing-table", props: { plans: [{ name: "Starter", price: "$2,500", features: ["Landing Page", "Basic SEO", "Mobile Responsive"], highlighted: false }, { name: "Professional", price: "$7,500", features: ["Multi-page Website", "Advanced SEO", "CMS Integration", "Analytics"], highlighted: true }, { name: "Enterprise", price: "Custom", features: ["Custom Web App", "API Development", "Dedicated Team", "Ongoing Support"], highlighted: false }] } },
              { id: "as4", type: "footer", props: { columns: [{ title: "Company", links: ["About", "Contact"] }], copyright: "2025 PixelForge" } },
            ],
            seo: { title: "Services - PixelForge" },
          },
        ],
        settings: { primaryColor: "#8b5cf6", fontFamily: "Montserrat" },
      },
    },
    // --- NEW TEMPLATES ---
    {
      id: "blog",
      name: "Blog",
      description: "Personal or company blog",
      icon: BookOpen,
      schema: {
        pages: [
          {
            id: "home", name: "Home", path: "/",
            blocks: [
              { id: "bl1", type: "navbar", props: { brand: "My Blog", links: [{ label: "Home", url: "/" }, { label: "Articles", url: "/articles" }, { label: "About", url: "/about" }, { label: "Contact", url: "/contact" }] } },
              { id: "bl2", type: "hero", props: { title: "Welcome to My Blog", subtitle: "Thoughts on design, development, and technology", buttonText: "Read Latest" } },
              { id: "bl3", type: "blog-list", props: { title: "Latest Posts", posts: [{ title: "Getting Started with Web Design", excerpt: "Learn the fundamentals of modern web design...", author: "Sarah", date: "2025-01-15", category: "Design" }, { title: "Top 10 SEO Tips", excerpt: "Boost your search engine rankings...", author: "Mike", date: "2025-01-10", category: "SEO" }, { title: "Building Responsive Layouts", excerpt: "Master CSS Grid and Flexbox...", author: "Lisa", date: "2025-01-05", category: "Development" }] } },
              { id: "bl4", type: "newsletter", props: { title: "Subscribe", subtitle: "Never miss a post", buttonText: "Subscribe" } },
              { id: "bl5", type: "footer", props: { columns: [{ title: "Blog", links: ["Articles", "Categories", "Archive"] }, { title: "Connect", links: ["Twitter", "GitHub", "LinkedIn"] }], copyright: "2025 My Blog." } },
            ],
            seo: { title: "My Blog - Design & Development" },
          },
          {
            id: "articles", name: "Articles", path: "/articles",
            blocks: [
              { id: "ba1", type: "navbar", props: { brand: "My Blog", links: [{ label: "Home", url: "/" }, { label: "Articles", url: "/articles" }, { label: "About", url: "/about" }] } },
              { id: "ba2", type: "heading", props: { text: "All Articles", align: "center" } },
              { id: "ba3", type: "blog-list", props: { title: "", posts: [{ title: "Getting Started with Web Design", excerpt: "Learn the fundamentals...", author: "Sarah", date: "2025-01-15", category: "Design" }, { title: "Top 10 SEO Tips", excerpt: "Boost rankings...", author: "Mike", date: "2025-01-10", category: "SEO" }, { title: "Building Responsive Layouts", excerpt: "Master CSS...", author: "Lisa", date: "2025-01-05", category: "Dev" }, { title: "Color Theory for Designers", excerpt: "Understanding color...", author: "Sarah", date: "2025-01-01", category: "Design" }, { title: "JavaScript Best Practices", excerpt: "Write clean code...", author: "Mike", date: "2024-12-28", category: "Dev" }, { title: "Accessibility Guide", excerpt: "Build inclusive websites...", author: "Lisa", date: "2024-12-20", category: "UX" }] } },
              { id: "ba4", type: "footer", props: { columns: [{ title: "Connect", links: ["Twitter", "GitHub"] }], copyright: "2025 My Blog" } },
            ],
            seo: { title: "Articles - My Blog" },
          },
        ],
        settings: { primaryColor: "#059669", fontFamily: "Merriweather" },
      },
    },
    {
      id: "event",
      name: "Event",
      description: "Conference or event landing",
      icon: Calendar,
      schema: {
        pages: [
          {
            id: "home", name: "Home", path: "/",
            blocks: [
              { id: "ev1", type: "navbar", props: { brand: "TechConf 2025", links: [{ label: "Home", url: "/" }, { label: "Speakers", url: "/speakers" }, { label: "Schedule", url: "/schedule" }, { label: "Register", url: "/register" }], ctaText: "Get Tickets" } },
              { id: "ev2", type: "hero", props: { title: "TechConf 2025", subtitle: "The biggest tech conference of the year — March 15-17, San Francisco", buttonText: "Get Tickets" } },
              { id: "ev3", type: "countdown", props: { title: "Event Starts In", subtitle: "March 15, 2025", targetDate: "2025-03-15" } },
              { id: "ev4", type: "features", props: { features: [{ title: "50+ Speakers", desc: "Industry leaders" }, { title: "3 Days", desc: "Of content" }, { title: "2000+ Attendees", desc: "From 30 countries" }] } },
              { id: "ev5", type: "team", props: { members: [{ name: "Dr. Sarah Lee", role: "Keynote Speaker", bio: "AI Research Lead" }, { name: "Mike Chen", role: "Workshop Host", bio: "Full-stack Expert" }] } },
              { id: "ev6", type: "pricing-table", props: { plans: [{ name: "Early Bird", price: "$199", features: ["All Sessions", "Lunch Included", "Networking"], highlighted: false }, { name: "VIP", price: "$499", features: ["All Sessions", "VIP Lounge", "1-on-1 Mentoring", "After Party"], highlighted: true }] } },
              { id: "ev7", type: "footer", props: { columns: [{ title: "Event", links: ["Schedule", "Speakers", "Venue"] }, { title: "Contact", links: ["Email", "Twitter"] }], copyright: "2025 TechConf." } },
            ],
            seo: { title: "TechConf 2025 - The Premier Tech Conference" },
          },
          {
            id: "register", name: "Register", path: "/register",
            blocks: [
              { id: "er1", type: "navbar", props: { brand: "TechConf 2025", links: [{ label: "Home", url: "/" }, { label: "Schedule", url: "/schedule" }, { label: "Register", url: "/register" }] } },
              { id: "er2", type: "booking-form", props: { title: "Register for TechConf 2025", subtitle: "Secure your spot today", buttonText: "Register Now", services: ["Early Bird ($199)", "VIP ($499)", "Group (5+ people)"] } },
              { id: "er3", type: "footer", props: { columns: [{ title: "Contact", links: ["info@techconf.com"] }], copyright: "2025 TechConf" } },
            ],
            seo: { title: "Register - TechConf 2025" },
          },
        ],
        settings: { primaryColor: "#f97316", fontFamily: "Montserrat" },
      },
    },
    {
      id: "education",
      name: "Education",
      description: "Online courses & learning",
      icon: GraduationCap,
      schema: {
        pages: [
          {
            id: "home", name: "Home", path: "/",
            blocks: [
              { id: "ed1", type: "navbar", props: { brand: "LearnHub", links: [{ label: "Home", url: "/" }, { label: "Courses", url: "/courses" }, { label: "About", url: "/about" }, { label: "Contact", url: "/contact" }], ctaText: "Sign Up" } },
              { id: "ed2", type: "hero", props: { title: "Learn New Skills Online", subtitle: "Access world-class courses from expert instructors", buttonText: "Explore Courses" } },
              { id: "ed3", type: "features", props: { features: [{ title: "100+ Courses", desc: "Covering all subjects" }, { title: "Expert Instructors", desc: "Industry professionals" }, { title: "Certificates", desc: "Earn upon completion" }] } },
              { id: "ed4", type: "stats", props: { stats: [{ value: "50K+", label: "Students" }, { value: "100+", label: "Courses" }, { value: "95%", label: "Satisfaction" }, { value: "30+", label: "Instructors" }] } },
              { id: "ed5", type: "testimonials", props: { testimonials: [{ name: "Alex P.", role: "Student", quote: "Changed my career completely!" }, { name: "Maria S.", role: "Graduate", quote: "Best learning platform I've used" }] } },
              { id: "ed6", type: "cta", props: { title: "Start Learning Today", subtitle: "Join thousands of learners worldwide", primaryButton: "Sign Up Free", secondaryButton: "Browse Courses" } },
              { id: "ed7", type: "footer", props: { columns: [{ title: "Courses", links: ["Web Dev", "Design", "Business", "Marketing"] }, { title: "Company", links: ["About", "Careers", "Blog"] }], copyright: "2025 LearnHub." } },
            ],
            seo: { title: "LearnHub - Online Learning Platform" },
          },
        ],
        settings: { primaryColor: "#0ea5e9", fontFamily: "Poppins" },
      },
    },
    {
      id: "personal",
      name: "Personal / Resume",
      description: "Personal website or resume",
      icon: User,
      schema: {
        pages: [
          {
            id: "home", name: "Home", path: "/",
            blocks: [
              { id: "pe1", type: "navbar", props: { brand: "Alex Johnson", links: [{ label: "Home", url: "/" }, { label: "About", url: "/about" }, { label: "Contact", url: "/contact" }] } },
              { id: "pe2", type: "hero", props: { title: "Alex Johnson", subtitle: "Full-Stack Developer & Tech Enthusiast", buttonText: "Download Resume" } },
              { id: "pe3", type: "features", props: { features: [{ title: "Frontend", desc: "React, Vue, Angular" }, { title: "Backend", desc: "Node.js, Python, Go" }, { title: "DevOps", desc: "AWS, Docker, K8s" }] } },
              { id: "pe4", type: "stats", props: { stats: [{ value: "5+", label: "Years Experience" }, { value: "30+", label: "Projects" }, { value: "15+", label: "Happy Clients" }] } },
              { id: "pe5", type: "social-links", props: { links: [{ platform: "GitHub", url: "#" }, { platform: "LinkedIn", url: "#" }, { platform: "Twitter", url: "#" }] } },
              { id: "pe6", type: "footer", props: { columns: [], copyright: "2025 Alex Johnson." } },
            ],
            seo: { title: "Alex Johnson - Full-Stack Developer" },
          },
          {
            id: "about", name: "About", path: "/about",
            blocks: [
              { id: "pea1", type: "navbar", props: { brand: "Alex Johnson", links: [{ label: "Home", url: "/" }, { label: "About", url: "/about" }, { label: "Contact", url: "/contact" }] } },
              { id: "pea2", type: "hero", props: { title: "About Me", subtitle: "Passionate developer with 5+ years building web applications", buttonText: "View Projects" } },
              { id: "pea3", type: "blog-list", props: { title: "Recent Projects", posts: [{ title: "E-Commerce Platform", excerpt: "Built a full-stack store with React & Node", author: "Alex", date: "2025-01", category: "Web" }, { title: "Mobile App", excerpt: "Cross-platform app with React Native", author: "Alex", date: "2024-11", category: "Mobile" }] } },
              { id: "pea4", type: "footer", props: { columns: [], copyright: "2025 Alex Johnson" } },
            ],
            seo: { title: "About - Alex Johnson" },
          },
        ],
        settings: { primaryColor: "#14b8a6", fontFamily: "Outfit" },
      },
    },
  ];

export default function Dashboard() {
  const { user, logout, isPro } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameName, setRenameName] = useState("");

  const { data: userProjects = [], isLoading } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const createMutation = useMutation({
    mutationFn: async (template: typeof TEMPLATES[number]) => {
      const res = await apiRequest("POST", "/api/projects", {
        name: template.name + " Site",
        schema: template.schema,
      });
      return res.json();
    },
    onSuccess: (project: Project) => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      setShowCreate(false);
      navigate(`/builder/${project.id}`);
    },
    onError: (err: any) => toast({ title: "Failed to create project", description: err.message, variant: "destructive" }),
  });

  const renameMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      await apiRequest("PATCH", `/api/projects/${id}`, { name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      setRenameId(null);
      toast({ title: "Project renamed" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/projects/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({ title: "Project deleted" });
    },
  });

  const migrateProjectSchema = (schema: any) => {
    if (!schema) return { pageCount: 0 };
    if (schema.pages && Array.isArray(schema.pages)) return { pageCount: schema.pages.length };
    if (Array.isArray(schema)) return { pageCount: 1 };
    return { pageCount: 0 };
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <Link href="/">
              <div className="flex items-center gap-2 cursor-pointer hover:opacity-80">
                <img src="/logo.png" className="w-8 h-8 rounded-md" alt="PixelPrompt Logo" />
                <span className="font-bold text-lg">PixelPrompt</span>
              </div>
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground mr-2">{user?.email}</span>
            {isPro && (
              <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> Pro
              </span>
            )}
            <Button variant="ghost" size="sm" onClick={() => navigate("/billing")}>
              <CreditCard className="w-4 h-4 mr-1" /> Billing
            </Button>
            <Button variant="ghost" size="sm" onClick={() => navigate("/support")}>
              <LifeBuoy className="w-4 h-4 mr-1" /> Support
            </Button>
            <Button variant="ghost" size="sm" onClick={() => navigate("/submissions")}>
              <Send className="w-4 h-4 mr-1" /> Submissions
            </Button>
            {user?.role === "admin" && (
              <Button variant="ghost" size="sm" onClick={() => navigate("/admin/submissions")}>
                <ShieldCheck className="w-4 h-4 mr-1" /> Admin
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => logout()}>
              Log out
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">My Projects</h1>
            <p className="text-sm text-muted-foreground mt-1">{userProjects.length} project{userProjects.length !== 1 ? "s" : ""}</p>
          </div>
          <Button onClick={() => setShowCreate(true)} data-testid="button-new-project">
            <Plus className="w-4 h-4 mr-1" /> New Project
          </Button>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="border rounded-md p-4 animate-pulse"><div className="h-6 bg-muted rounded w-2/3 mb-2" /><div className="h-4 bg-muted rounded w-1/3" /></div>
            ))}
          </div>
        ) : userProjects.length === 0 ? (
          <div className="text-center py-16">
            <FolderOpen className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-1">No projects yet</h2>
            <p className="text-sm text-muted-foreground mb-4">Create your first project to get started</p>
            <Button onClick={() => setShowCreate(true)}>
              <Plus className="w-4 h-4 mr-1" /> Create Project
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {userProjects.map((project) => {
              const { pageCount } = migrateProjectSchema(project.schema);
              return (
                <div
                  key={project.id}
                  className="border rounded-md p-4 hover:border-primary/50 transition-colors cursor-pointer group"
                  onClick={() => navigate(`/builder/${project.id}`)}
                  data-testid={`project-card-${project.id}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-medium text-sm truncate">{project.name}</h3>
                      <p className="text-xs text-muted-foreground mt-1">{pageCount} page{pageCount !== 1 ? "s" : ""}</p>
                      <p className="text-xs text-muted-foreground">
                        Updated {new Date(project.updatedAt || "").toLocaleDateString()}
                      </p>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 h-8 w-8 shrink-0" onClick={(e) => e.stopPropagation()}>
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigate(`/agent/${project.id}`); }}>
                          <Sparkles className="w-4 h-4 mr-2" /> Open in AI Agent
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setRenameId(project.id); setRenameName(project.name); }}>
                          <Pencil className="w-4 h-4 mr-2" /> Rename
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(project.id); }}>
                          <Trash2 className="w-4 h-4 mr-2" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Create Project Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Create New Project</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] pr-4">
            <div className="grid grid-cols-2 gap-3">
              {TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => createMutation.mutate(t)}
                  disabled={createMutation.isPending}
                  className="flex items-start gap-3 p-4 rounded-md border border-border hover:border-primary/50 hover:bg-muted/30 transition-colors text-left"
                  data-testid={`template-${t.id}`}
                >
                  <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                    <t.icon className="w-5 h-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{t.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{t.description}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">{t.schema.pages.length} page{t.schema.pages.length !== 1 ? "s" : ""}</p>
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Rename Dialog */}
      <Dialog open={!!renameId} onOpenChange={() => setRenameId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Rename Project</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); if (renameId) renameMutation.mutate({ id: renameId, name: renameName }); }}>
            <Input value={renameName} onChange={(e) => setRenameName(e.target.value)} autoFocus />
            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={() => setRenameId(null)}>Cancel</Button>
              <Button type="submit" disabled={!renameName.trim()}>Rename</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
