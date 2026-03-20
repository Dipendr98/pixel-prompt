/**
 * Client-side preview HTML generator.
 * Mirrors server/routes.ts generatePageHtml + generateCSS
 * so preview works without any server call.
 */

import type { ComponentBlock, ProjectSettings } from "@shared/schema";

function escHtml(str: unknown): string {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function generatePreviewCSS(settings: ProjectSettings = {}): string {
  const primary = settings.primaryColor || "#3b82f6";
  const font = settings.fontFamily || "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  return `
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: ${font}; color: #1a1a1a; line-height: 1.6; overflow-x: hidden; }
a { color: inherit; text-decoration: none; }
img { max-width: 100%; height: auto; }
[data-animate] { opacity: 0; animation-fill-mode: forwards; }
@keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes slide-up { from { opacity: 0; transform: translateY(40px); } to { opacity: 1; transform: translateY(0); } }
@keyframes slide-down { from { opacity: 0; transform: translateY(-40px); } to { opacity: 1; transform: translateY(0); } }
@keyframes slide-left { from { opacity: 0; transform: translateX(40px); } to { opacity: 1; transform: translateX(0); } }
@keyframes slide-right { from { opacity: 0; transform: translateX(-40px); } to { opacity: 1; transform: translateX(0); } }
@keyframes zoom-in { from { opacity: 0; transform: scale(0.8); } to { opacity: 1; transform: scale(1); } }
@keyframes zoom-out { from { opacity: 0; transform: scale(1.2); } to { opacity: 1; transform: scale(1); } }
@keyframes flip { from { opacity: 0; transform: perspective(400px) rotateX(90deg); } to { opacity: 1; transform: perspective(400px) rotateX(0deg); } }
@keyframes bounce { 0% { opacity: 0; transform: translateY(60px); } 60% { opacity: 1; transform: translateY(-10px); } 80% { transform: translateY(5px); } 100% { opacity: 1; transform: translateY(0); } }
.animate-fade-in { animation-name: fade-in; }
.animate-slide-up { animation-name: slide-up; }
.animate-slide-down { animation-name: slide-down; }
.animate-slide-left { animation-name: slide-left; }
.animate-slide-right { animation-name: slide-right; }
.animate-zoom-in { animation-name: zoom-in; }
.animate-zoom-out { animation-name: zoom-out; }
.animate-flip { animation-name: flip; }
.animate-bounce { animation-name: bounce; }
.navbar { display: flex; align-items: center; justify-content: space-between; padding: 16px 40px; border-bottom: 1px solid #e5e5e5; position: sticky; top: 0; background: white; z-index: 100; }
.nav-brand { font-weight: 700; font-size: 1.25rem; }
.nav-links { display: flex; align-items: center; gap: 24px; }
.nav-links a { font-size: 0.9rem; color: #555; transition: color 0.2s; }
.nav-links a:hover { color: #1a1a1a; }
.hero { background: linear-gradient(135deg, ${primary} 0%, #764ba2 100%); color: white; padding: 80px 40px; text-align: center; }
.hero h1 { font-size: 2.5rem; margin-bottom: 16px; max-width: 700px; margin-left: auto; margin-right: auto; }
.hero p { font-size: 1.1rem; opacity: 0.9; max-width: 600px; margin: 0 auto 24px; }
.btn { display: inline-block; background: ${primary}; color: white; padding: 12px 24px; border-radius: 6px; font-weight: 500; border: none; cursor: pointer; font-size: 0.95rem; transition: background 0.2s; }
.btn:hover { opacity: 0.9; }
.btn-sm { padding: 8px 16px; font-size: 0.85rem; }
.btn-outline { background: transparent; border: 2px solid ${primary}; color: ${primary}; }
.btn-outline:hover { background: ${primary}; color: white; }
.heading { font-size: 1.75rem; padding: 20px 40px; }
.text-block { padding: 10px 40px; color: #4a4a4a; max-width: 800px; }
.button-wrap { padding: 10px 40px; }
.image-block { padding: 20px 40px; }
.image-block img { border-radius: 8px; }
.divider { border: none; border-top: 1px solid #e5e5e5; margin: 20px 40px; }
.content-section { padding: 40px; background: #f8f8f8; }
.features-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 24px; padding: 40px; }
.feature-card { background: white; border: 1px solid #e5e5e5; border-radius: 8px; padding: 24px; }
.feature-card h4 { margin-bottom: 8px; }
.feature-card p { color: #666; font-size: 0.9rem; }
.products-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 24px; padding: 40px; }
.product-card { border: 1px solid #e5e5e5; border-radius: 8px; overflow: hidden; background: white; }
.product-img img { width: 100%; height: 200px; object-fit: cover; }
.product-info { padding: 16px; }
.product-info h4 { margin-bottom: 4px; }
.product-info p { color: #666; font-size: 0.85rem; margin-bottom: 12px; }
.product-footer { display: flex; align-items: center; justify-content: space-between; }
.price { font-weight: 700; color: ${primary}; font-size: 1.1rem; }
.pricing-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 24px; padding: 40px; }
.pricing-card { border: 1px solid #e5e5e5; border-radius: 8px; padding: 32px; text-align: center; background: white; }
.pricing-card.highlighted { border-color: ${primary}; box-shadow: 0 0 0 2px ${primary}; }
.plan-name { text-transform: uppercase; letter-spacing: 1px; font-size: 0.85rem; color: #888; margin-bottom: 8px; }
.plan-price { font-size: 2rem; font-weight: 700; margin-bottom: 16px; }
.plan-features { list-style: none; text-align: left; margin-bottom: 24px; }
.plan-features li { padding: 6px 0; font-size: 0.9rem; color: #555; border-bottom: 1px solid #f3f4f6; }
.plan-features li::before { content: "✓ "; color: ${primary}; font-weight: 700; margin-right: 8px; }
.contact-form-wrap { max-width: 500px; margin: 0 auto; padding: 40px; }
.contact-form-wrap h3 { font-size: 1.5rem; margin-bottom: 4px; }
.contact-form-wrap .subtitle { color: #666; margin-bottom: 24px; font-size: 0.9rem; }
.contact-form { display: flex; flex-direction: column; gap: 12px; }
.contact-form input, .contact-form textarea, .contact-form select { padding: 12px; border: 1px solid #ddd; border-radius: 6px; font-size: 0.9rem; font-family: inherit; }
.testimonials-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 24px; padding: 40px; }
.testimonial-card { border: 1px solid #e5e5e5; border-radius: 8px; padding: 24px; background: white; }
.testimonial-card blockquote { font-style: italic; color: #555; margin-bottom: 16px; font-size: 0.95rem; }
.testimonial-author strong { display: block; }
.testimonial-author span { font-size: 0.85rem; color: #888; }
.gallery-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 8px; padding: 20px 40px; }
.gallery-item img { width: 100%; height: 200px; object-fit: cover; border-radius: 6px; }
.faq-section { max-width: 700px; margin: 0 auto; padding: 40px; }
.faq-section h3 { text-align: center; margin-bottom: 24px; font-size: 1.5rem; }
.faq-item { border: 1px solid #e5e5e5; border-radius: 6px; margin-bottom: 8px; }
.faq-item summary { padding: 14px 16px; font-weight: 500; cursor: pointer; font-size: 0.95rem; }
.faq-item p { padding: 0 16px 14px; color: #666; font-size: 0.9rem; }
.stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 24px; padding: 40px; text-align: center; }
.stat-value { font-size: 2rem; font-weight: 700; color: ${primary}; }
.stat-label { font-size: 0.85rem; color: #888; margin-top: 4px; }
.team-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 24px; padding: 40px; text-align: center; }
.team-avatar { width: 60px; height: 60px; border-radius: 50%; background: #e0e7ff; color: ${primary}; display: flex; align-items: center; justify-content: center; margin: 0 auto 12px; font-size: 1.25rem; font-weight: 700; }
.team-role { font-size: 0.85rem; color: #888; }
.social-links { display: flex; gap: 16px; padding: 20px 40px; flex-wrap: wrap; }
.social-link { padding: 8px 16px; border: 1px solid #e5e5e5; border-radius: 6px; font-size: 0.9rem; }
.banner { padding: 12px 40px; text-align: center; font-size: 0.9rem; }
.banner-info { background: #eff6ff; color: #1d4ed8; }
.banner-warning { background: #fffbeb; color: #92400e; }
.banner-success { background: #f0fdf4; color: #166534; }
.countdown-section { text-align: center; padding: 40px; }
.countdown-timer { display: flex; gap: 16px; justify-content: center; margin: 20px 0; }
.countdown-unit { text-align: center; }
.countdown-unit span { display: block; font-size: 2rem; font-weight: 700; color: ${primary}; }
.countdown-unit small { font-size: 0.75rem; color: #888; }
.newsletter-section { text-align: center; padding: 40px; background: #f8f8f8; }
.newsletter-section h3 { font-size: 1.5rem; margin-bottom: 8px; }
.newsletter-form { display: flex; gap: 8px; max-width: 400px; margin: 16px auto 0; }
.newsletter-form input { flex: 1; padding: 10px 14px; border: 1px solid #ddd; border-radius: 6px; font-size: 0.9rem; }
.logo-cloud { padding: 40px; text-align: center; }
.logo-title { color: #888; font-size: 0.85rem; margin-bottom: 20px; }
.logo-grid { display: flex; flex-wrap: wrap; gap: 24px; justify-content: center; }
.logo-item { padding: 10px 20px; border: 1px solid #e5e5e5; border-radius: 6px; font-weight: 500; color: #555; }
.cta-section { text-align: center; padding: 60px 40px; background: ${primary}; color: white; }
.cta-section h3 { font-size: 2rem; margin-bottom: 8px; }
.cta-section p { opacity: 0.9; margin-bottom: 24px; }
.cta-buttons { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }
.blog-section { padding: 40px; }
.section-title { font-size: 1.75rem; margin-bottom: 24px; }
.blog-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 24px; }
.blog-post-card { border: 1px solid #e5e5e5; border-radius: 8px; overflow: hidden; background: white; }
.blog-img img { width: 100%; height: 200px; object-fit: cover; }
.blog-body { padding: 16px; }
.blog-cat { font-size: 0.75rem; background: ${primary}; color: white; padding: 2px 8px; border-radius: 4px; }
.blog-body h3, .blog-body h4 { margin: 8px 0 4px; }
.blog-body p { color: #666; font-size: 0.85rem; margin-bottom: 8px; }
.blog-meta { display: flex; gap: 12px; font-size: 0.8rem; color: #888; }
.cart-section { max-width: 600px; margin: 0 auto; padding: 40px; }
.cart-item { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #f0f0f0; }
.cart-total { display: flex; justify-content: space-between; padding: 16px 0; font-weight: 700; }
.map-section { display: flex; align-items: center; justify-content: center; background: #e5e7eb; border-radius: 8px; margin: 20px 40px; }
.site-footer { background: #1a1a1a; color: #ccc; padding: 40px; }
.footer-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 32px; margin-bottom: 24px; }
.footer-col h4 { color: white; margin-bottom: 12px; font-size: 0.9rem; }
.footer-col a { display: block; color: #999; font-size: 0.85rem; margin-bottom: 6px; transition: color 0.2s; }
.footer-col a:hover { color: white; }
.footer-bottom { border-top: 1px solid #333; padding-top: 20px; font-size: 0.8rem; color: #666; text-align: center; }
.experience-timeline { padding: 40px; }
.timeline-item { display: flex; gap: 20px; margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid #f0f0f0; }
.timeline-dot { width: 12px; height: 12px; border-radius: 50%; background: ${primary}; margin-top: 6px; flex-shrink: 0; }
.timeline-content h4 { font-weight: 600; margin-bottom: 4px; }
.timeline-meta { font-size: 0.85rem; color: #888; margin-bottom: 6px; }
.skills-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; padding: 40px; }
.skill-item { background: white; border: 1px solid #e5e5e5; border-radius: 8px; padding: 16px; }
.skill-name { font-weight: 500; margin-bottom: 8px; font-size: 0.9rem; }
.skill-bar { height: 6px; background: #f0f0f0; border-radius: 3px; }
.skill-fill { height: 100%; background: ${primary}; border-radius: 3px; }
.project-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 24px; padding: 40px; }
.project-card { border: 1px solid #e5e5e5; border-radius: 8px; overflow: hidden; background: white; }
.project-img { height: 180px; background: linear-gradient(135deg, ${primary}20, #764ba220); display: flex; align-items: center; justify-content: center; color: ${primary}; font-weight: 700; }
.project-body { padding: 16px; }
.project-body h4 { margin-bottom: 6px; }
.project-body p { color: #666; font-size: 0.85rem; margin-bottom: 10px; }
.project-tags { display: flex; flex-wrap: wrap; gap: 6px; }
.project-tag { font-size: 0.7rem; padding: 2px 8px; border-radius: 4px; background: ${primary}15; color: ${primary}; }
.process-steps { padding: 40px; }
.steps-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 24px; margin-top: 24px; }
.step-card { text-align: center; padding: 24px; }
.step-num { width: 48px; height: 48px; border-radius: 50%; background: ${primary}; color: white; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 1.1rem; margin: 0 auto 12px; }
.step-card h4 { margin-bottom: 6px; }
.step-card p { color: #666; font-size: 0.85rem; }
.service-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 24px; padding: 40px; }
.service-card { border: 1px solid #e5e5e5; border-radius: 8px; padding: 28px; background: white; }
.service-icon { font-size: 2rem; margin-bottom: 12px; }
.service-card h4 { margin-bottom: 8px; }
.service-card p { color: #666; font-size: 0.9rem; }
.menu-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 20px; padding: 40px; }
.menu-item { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px dashed #e5e5e5; padding-bottom: 16px; }
.menu-item-info h4 { margin-bottom: 4px; }
.menu-item-info p { color: #888; font-size: 0.85rem; }
.menu-price { font-weight: 700; color: ${primary}; white-space: nowrap; margin-left: 16px; }
.comparison-table { padding: 40px; overflow-x: auto; }
.comparison-table table { width: 100%; border-collapse: collapse; }
.comparison-table th, .comparison-table td { padding: 12px 16px; text-align: left; border-bottom: 1px solid #e5e5e5; font-size: 0.9rem; }
.comparison-table th { background: ${primary}; color: white; }
.comparison-table tr:hover td { background: #f8f8f8; }
`;
}

export function generatePreviewBlockHtml(block: ComponentBlock): string {
  const props = block.props || {};
  const s = block.style || {};

  const styleStr = Object.entries(s)
    .filter(([k, v]) => v && !k.startsWith("animation") && k !== "customCss")
    .map(([k, v]) => `${k.replace(/([A-Z])/g, "-$1").toLowerCase()}:${v}`)
    .join(";") + (s.customCss ? ";" + s.customCss : "");

  const animType = s.animation && s.animation !== "none" ? s.animation : "";
  const animDur = s.animationDuration || "0.6s";
  const animDelay = s.animationDelay || "0s";

  let inner = "";
  switch (block.type) {
    case "navbar": {
      const links = (props.links || []).map((l: any) => `<a href="${escHtml(l.url || "#")}">${escHtml(l.label)}</a>`).join("");
      inner = `<nav class="navbar"><div class="nav-brand">${escHtml(props.brand || "Brand")}</div><div class="nav-links">${links}${props.ctaText ? `<a href="#" class="btn btn-sm">${escHtml(props.ctaText)}</a>` : ""}</div></nav>`;
      break;
    }
    case "hero":
      inner = `<section class="hero"><h1>${escHtml(props.title || "Hero")}</h1><p>${escHtml(props.subtitle || "")}</p>${props.buttonText ? `<a href="#" class="btn">${escHtml(props.buttonText)}</a>` : ""}</section>`;
      break;
    case "heading":
      inner = `<h2 class="heading" style="text-align:${props.align || "left"}">${escHtml(props.text || "Heading")}</h2>`;
      break;
    case "text":
      inner = `<p class="text-block" style="text-align:${props.align || "left"}">${escHtml(props.text || "")}</p>`;
      break;
    case "button":
      inner = `<div class="button-wrap" style="text-align:${props.align || "left"}"><a href="${escHtml(props.url || "#")}" class="btn">${escHtml(props.text || "Button")}</a></div>`;
      break;
    case "image":
      inner = `<div class="image-block"><img src="${escHtml(props.src || "https://placehold.co/800x400")}" alt="${escHtml(props.alt || "")}" style="height:${props.height || "200px"};width:100%;object-fit:cover;" /></div>`;
      break;
    case "divider":
      inner = `<hr class="divider" />`;
      break;
    case "spacer":
      inner = `<div style="height:${props.height || "40px"}"></div>`;
      break;
    case "section":
      inner = `<section class="content-section"><h3>${escHtml(props.title || "Section")}</h3></section>`;
      break;
    case "features": {
      const feats = (props.features || []).map((f: any) => `<div class="feature-card"><h4>${escHtml(f.title || "")}</h4><p>${escHtml(f.desc || "")}</p></div>`).join("");
      inner = `<div class="features-grid">${feats}</div>`;
      break;
    }
    case "footer": {
      const cols = (props.columns || []).map((col: any) => `<div class="footer-col"><h4>${escHtml(col.title || "")}</h4>${(col.links || []).map((l: string) => `<a href="#">${escHtml(l)}</a>`).join("")}</div>`).join("");
      inner = `<footer class="site-footer"><div class="footer-grid">${cols}</div><div class="footer-bottom">${escHtml(props.copyright || "")}</div></footer>`;
      break;
    }
    case "product-card": {
      const prods = (props.products || []).map((p: any) => `<div class="product-card"><div class="product-img"><img src="${escHtml(p.image || "https://placehold.co/300x200")}" alt="${escHtml(p.name || "")}" /></div><div class="product-info"><h4>${escHtml(p.name || "")}</h4><p>${escHtml(p.description || "")}</p><div class="product-footer"><span class="price">${escHtml(p.price || "")}</span><a href="#" class="btn btn-sm">Add to Cart</a></div></div></div>`).join("");
      inner = `<div class="products-grid">${prods}</div>`;
      break;
    }
    case "pricing-table": {
      const plans = (props.plans || []).map((p: any) => `<div class="pricing-card${p.highlighted ? " highlighted" : ""}"><h4 class="plan-name">${escHtml(p.name || "")}</h4><div class="plan-price">${escHtml(p.price || "")}</div><ul class="plan-features">${(p.features || []).map((f: string) => `<li>${escHtml(f)}</li>`).join("")}</ul><a href="#" class="btn${p.highlighted ? "" : " btn-outline"}">${escHtml(p.cta || "Choose Plan")}</a></div>`).join("");
      inner = `<div class="pricing-grid">${plans}</div>`;
      break;
    }
    case "contact-form":
      inner = `<div class="contact-form-wrap"><h3>${escHtml(props.title || "Contact Us")}</h3><p class="subtitle">${escHtml(props.subtitle || "")}</p><form class="contact-form"><input type="text" placeholder="Your Name" /><input type="email" placeholder="Email Address" /><textarea placeholder="Your Message" rows="4"></textarea><button type="submit" class="btn">${escHtml(props.buttonText || "Send")}</button></form></div>`;
      break;
    case "testimonials": {
      const tms = (props.testimonials || []).map((t: any) => `<div class="testimonial-card"><blockquote>"${escHtml(t.quote || "")}"</blockquote><div class="testimonial-author"><strong>${escHtml(t.name || "")}</strong><span>${escHtml(t.role || "")}</span></div></div>`).join("");
      inner = `<div class="testimonials-grid">${tms}</div>`;
      break;
    }
    case "gallery": {
      const count = props.count || 8;
      const imgs = Array.from({ length: count }).map((_, i) => `<div class="gallery-item"><img src="https://placehold.co/300x300?text=Image+${i + 1}" alt="Gallery ${i + 1}" /></div>`).join("");
      inner = `<div class="gallery-grid">${imgs}</div>`;
      break;
    }
    case "video":
      if (props.url && (props.url.includes("youtube") || props.url.includes("youtu.be"))) {
        const vid = props.url.match(/(?:v=|youtu\.be\/)([\w-]+)/)?.[1] || "";
        inner = `<div class="video-embed"><iframe src="https://www.youtube.com/embed/${vid}" frameborder="0" allowfullscreen style="width:100%;height:${props.height || "400px"}"></iframe></div>`;
      } else {
        inner = `<div style="height:${props.height || "400px"};display:flex;align-items:center;justify-content:center;background:#f3f4f6;border-radius:8px;margin:20px 40px"><p>Video placeholder</p></div>`;
      }
      break;
    case "faq": {
      const items = (props.items || []).map((it: any) => `<details class="faq-item"><summary>${escHtml(it.question || "")}</summary><p>${escHtml(it.answer || "")}</p></details>`).join("");
      inner = `<div class="faq-section"><h3>${escHtml(props.title || "FAQ")}</h3>${items}</div>`;
      break;
    }
    case "stats": {
      const stats = (props.stats || []).map((s: any) => `<div class="stat-item"><div class="stat-value">${escHtml(s.value || "")}</div><div class="stat-label">${escHtml(s.label || "")}</div></div>`).join("");
      inner = `<div class="stats-grid">${stats}</div>`;
      break;
    }
    case "team": {
      const members = (props.members || []).map((m: any) => `<div class="team-card"><div class="team-avatar">${escHtml((m.name || "A")[0])}</div><h4>${escHtml(m.name || "")}</h4><span class="team-role">${escHtml(m.role || "")}</span><p>${escHtml(m.bio || "")}</p></div>`).join("");
      inner = `<div class="team-grid">${members}</div>`;
      break;
    }
    case "social-links": {
      const links = (props.links || []).map((l: any) => `<a href="${escHtml(l.url || "#")}" class="social-link">${escHtml(l.platform || "")}</a>`).join("");
      inner = `<div class="social-links">${links}</div>`;
      break;
    }
    case "banner":
      inner = `<div class="banner banner-${props.variant || "info"}"><p>${escHtml(props.text || "")}${props.linkText ? ` <a href="#">${escHtml(props.linkText)}</a>` : ""}</p></div>`;
      break;
    case "countdown":
      inner = `<div class="countdown-section"><h3>${escHtml(props.title || "")}</h3><div class="countdown-timer"><div class="countdown-unit"><span>00</span><small>Days</small></div><div class="countdown-unit"><span>00</span><small>Hours</small></div><div class="countdown-unit"><span>00</span><small>Min</small></div><div class="countdown-unit"><span>00</span><small>Sec</small></div></div><p>${escHtml(props.subtitle || "")}</p></div>`;
      break;
    case "newsletter":
      inner = `<div class="newsletter-section"><h3>${escHtml(props.title || "")}</h3><p>${escHtml(props.subtitle || "")}</p><form class="newsletter-form"><input type="email" placeholder="Enter your email" /><button type="submit" class="btn">${escHtml(props.buttonText || "Subscribe")}</button></form></div>`;
      break;
    case "logo-cloud": {
      const logos = (props.logos || []).map((l: string) => `<div class="logo-item">${escHtml(l)}</div>`).join("");
      inner = `<div class="logo-cloud"><p class="logo-title">${escHtml(props.title || "")}</p><div class="logo-grid">${logos}</div></div>`;
      break;
    }
    case "cta":
      inner = `<div class="cta-section"><h3>${escHtml(props.title || "")}</h3><p>${escHtml(props.subtitle || "")}</p><div class="cta-buttons"><a href="#" class="btn" style="background:white;color:#333">${escHtml(props.primaryButton || "Get Started")}</a>${props.secondaryButton ? `<a href="#" class="btn btn-outline" style="border-color:white;color:white">${escHtml(props.secondaryButton)}</a>` : ""}</div></div>`;
      break;
    case "blog-post":
      inner = `<article class="blog-post-card"><div class="blog-img"><img src="${escHtml(props.image || "https://placehold.co/600x300")}" alt="${escHtml(props.title || "")}" /></div><div class="blog-body"><span class="blog-cat">${escHtml(props.category || "General")}</span><h3>${escHtml(props.title || "")}</h3><p>${escHtml(props.excerpt || "")}</p><div class="blog-meta"><span>${escHtml(props.author || "")}</span><span>${escHtml(props.date || "")}</span></div></div></article>`;
      break;
    case "blog-list": {
      const posts = (props.posts || []).map((p: any) => `<div class="blog-post-card"><div class="blog-img"><img src="https://placehold.co/400x200" alt="${escHtml(p.title || "")}" /></div><div class="blog-body"><span class="blog-cat">${escHtml(p.category || "")}</span><h4>${escHtml(p.title || "")}</h4><p>${escHtml(p.excerpt || "")}</p><div class="blog-meta"><span>${escHtml(p.author || "")}</span><span>${escHtml(p.date || "")}</span></div></div></div>`).join("");
      inner = `<div class="blog-section">${props.title ? `<h3 class="section-title">${escHtml(props.title)}</h3>` : ""}<div class="blog-grid">${posts}</div></div>`;
      break;
    }
    case "experience-timeline": {
      const items = (props.items || []).map((it: any) => `<div class="timeline-item"><div class="timeline-dot"></div><div class="timeline-content"><h4>${escHtml(it.title || "")}</h4><div class="timeline-meta">${escHtml(it.company || "")} · ${escHtml(it.period || "")}</div><p style="color:#666;font-size:0.9rem">${escHtml(it.description || "")}</p></div></div>`).join("");
      inner = `<div class="experience-timeline"><h3 style="padding:0 0 24px">${escHtml(props.title || "Experience")}</h3>${items}</div>`;
      break;
    }
    case "skills-grid": {
      const skills = (props.skills || []).map((sk: any) => `<div class="skill-item"><div class="skill-name">${escHtml(sk.name || "")}</div><div class="skill-bar"><div class="skill-fill" style="width:${sk.level || 80}%"></div></div></div>`).join("");
      inner = `<div class="skills-grid">${skills}</div>`;
      break;
    }
    case "project-card": {
      const projects = (props.projects || []).map((p: any) => `<div class="project-card"><div class="project-img">${escHtml(p.title || "Project")}</div><div class="project-body"><h4>${escHtml(p.title || "")}</h4><p>${escHtml(p.description || "")}</p><div class="project-tags">${(p.tags || []).map((t: string) => `<span class="project-tag">${escHtml(t)}</span>`).join("")}</div></div></div>`).join("");
      inner = `<div class="project-grid">${projects}</div>`;
      break;
    }
    case "process-steps": {
      const steps = (props.steps || []).map((st: any, i: number) => `<div class="step-card"><div class="step-num">${i + 1}</div><h4>${escHtml(st.title || "")}</h4><p>${escHtml(st.description || "")}</p></div>`).join("");
      inner = `<div class="process-steps"><h3 style="text-align:center;margin-bottom:8px">${escHtml(props.title || "")}</h3><div class="steps-grid">${steps}</div></div>`;
      break;
    }
    case "service-card": {
      const services = (props.services || []).map((sv: any) => `<div class="service-card"><div class="service-icon">${escHtml(sv.icon || "⚡")}</div><h4>${escHtml(sv.title || "")}</h4><p>${escHtml(sv.description || "")}</p></div>`).join("");
      inner = `<div class="service-grid">${services}</div>`;
      break;
    }
    case "menu-grid": {
      const items = (props.items || []).map((it: any) => `<div class="menu-item"><div class="menu-item-info"><h4>${escHtml(it.name || "")}</h4><p>${escHtml(it.description || "")}</p></div><span class="menu-price">${escHtml(it.price || "")}</span></div>`).join("");
      inner = `<div class="menu-grid"><h3 style="grid-column:1/-1;margin-bottom:8px">${escHtml(props.title || "Menu")}</h3>${items}</div>`;
      break;
    }
    case "comparison-table": {
      const headers = props.headers || [];
      const rows = props.rows || [];
      const thead = `<thead><tr>${headers.map((h: string) => `<th>${escHtml(h)}</th>`).join("")}</tr></thead>`;
      const tbody = `<tbody>${rows.map((row: string[]) => `<tr>${row.map((cell: string) => `<td>${escHtml(cell)}</td>`).join("")}</tr>`).join("")}</tbody>`;
      inner = `<div class="comparison-table"><h3 style="margin-bottom:16px">${escHtml(props.title || "")}</h3><table>${thead}${tbody}</table></div>`;
      break;
    }
    case "map":
      inner = `<div class="map-section" style="height:${props.height || "300px"}"><p>📍 ${escHtml(props.address || "Location")}</p></div>`;
      break;
    case "booking-form":
      inner = `<div class="contact-form-wrap"><h3>${escHtml(props.title || "Book Now")}</h3><p class="subtitle">${escHtml(props.subtitle || "")}</p><form class="contact-form"><input type="text" placeholder="Your Name" /><input type="email" placeholder="Email" /><input type="date" /><select>${(props.services || ["Service"]).map((s: string) => `<option>${escHtml(s)}</option>`).join("")}</select><button type="submit" class="btn">${escHtml(props.buttonText || "Book")}</button></form></div>`;
      break;
    case "login-form":
      inner = `<div class="contact-form-wrap"><h3>${escHtml(props.title || "Sign In")}</h3><p class="subtitle">${escHtml(props.subtitle || "")}</p><form class="contact-form"><input type="email" placeholder="Email" /><input type="password" placeholder="Password" /><button type="submit" class="btn">${escHtml(props.buttonText || "Sign In")}</button></form></div>`;
      break;
    case "cart": {
      const cartItems = (props.items || []).map((it: any) => `<div class="cart-item"><span>${escHtml(it.name || "")}</span><span>x${it.quantity || 1}</span><span>${escHtml(it.price || "")}</span></div>`).join("");
      inner = `<div class="cart-section"><h3>Shopping Cart</h3>${cartItems}<div class="cart-total"><strong>Total</strong></div>${props.showCheckout !== false ? `<a href="#" class="btn">Checkout</a>` : ""}</div>`;
      break;
    }
    case "checkout-form":
      inner = `<div class="contact-form-wrap"><h3>${escHtml(props.title || "Checkout")}</h3><form class="contact-form"><input type="text" placeholder="Full Name" /><input type="email" placeholder="Email" /><input type="text" placeholder="Address" /><input type="text" placeholder="Card Number" /><button type="submit" class="btn">${escHtml(props.buttonText || "Place Order")}</button></form></div>`;
      break;
    default:
      inner = `<div style="padding:20px 40px;color:#888;font-size:0.85rem;font-style:italic">[${block.type} block]</div>`;
  }

  const styleAttr = styleStr ? ` style="${styleStr}"` : "";
  let html = `<div${styleAttr}>\n${inner}\n</div>\n`;
  if (animType) {
    html = `<div data-animate="${animType}" style="animation-duration:${animDur};animation-delay:${animDelay};opacity:0">\n${html}</div>\n`;
  }
  return html;
}

export function buildPreviewHtml(
  blocks: ComponentBlock[],
  settings: ProjectSettings = {},
  title = "Preview"
): string {
  const css = generatePreviewCSS(settings);
  const body = blocks.length > 0
    ? blocks.map(generatePreviewBlockHtml).join("\n")
    : `<div style="min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;background:#f8f9fa;font-family:system-ui,sans-serif;color:#6b7280;text-align:center;padding:40px">
        <div style="font-size:48px">🏗️</div>
        <h2 style="font-size:1.5rem;font-weight:600;color:#374151;margin:0">No blocks yet</h2>
        <p style="margin:0;max-width:360px">Use the AI Agent or drag components from the sidebar to start building.</p>
      </div>`;

  const script = `
    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          const a = e.target.getAttribute('data-animate');
          if (a) e.target.classList.add('animate-' + a);
          obs.unobserve(e.target);
        }
      });
    }, { threshold: 0.1 });
    document.querySelectorAll('[data-animate]').forEach(el => obs.observe(el));
  `;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escHtml(title)}</title>
  <style>${css}</style>
</head>
<body>
${body}
<script>${script}</script>
</body>
</html>`;
}
