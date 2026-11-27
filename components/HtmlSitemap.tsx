import React, { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Search, ExternalLink, Download, ArrowUpRight, FileText } from "lucide-react";

type SitemapCategory =
  | "all"
  | "core"
  | "ai"
  | "downloads"
  | "guides"
  | "cities";

interface SitemapLinkItem {
  label: string;
  href: string;
  meta: string;
  category: Exclude<SitemapCategory, "all">;
  external?: boolean;
  download?: boolean;
}

const CORE_PAGES: SitemapLinkItem[] = [
  { label: "Home — DukaanMitra OS", href: "/", meta: "Overview & WhatsApp Munim AI", category: "core" },
  { label: "Features", href: "/features", meta: "Billing, Khata, Inventory & UPI", category: "core" },
  { label: "Services", href: "/services", meta: "Digital Dukaan & Local Growth", category: "core" },
  { label: "How It Works", href: "/how-it-works", meta: "3-Step WhatsApp Workflow", category: "core" },
  { label: "Pricing (INR)", href: "/pricing", meta: "Starter ₹0 · Growth ₹299 · Enterprise ₹999", category: "core" },
  { label: "WhatsApp Shop Management", href: "/whatsapp-shop-management", meta: "WhatsApp Digital Dukaan", category: "core" },
  { label: "Udhaar & Hisaab Management", href: "/udhaar-management-app", meta: "Hisaab Mitra & UPI Reminders", category: "core" },
  { label: "Google Review Automation", href: "/get-more-google-reviews-for-shop", meta: "Rank Higher on Google Maps", category: "core" },
  { label: "WhatsApp AI Munim", href: "/whatsapp-ai", meta: "Voice & Chat Entry", category: "core" },
  { label: "AI Billing Software", href: "/billing", meta: "Instant GST & Retail Bills", category: "core" },
  { label: "Smart Inventory Tracking", href: "/inventory", meta: "Inventory Mitra Stock Alerts", category: "core" },
  { label: "Automated Udhaar Recovery", href: "/udhaar", meta: "3x Faster Credit Collection", category: "core" },
  { label: "Retail Sales Analytics", href: "/analytics", meta: "Daily Cash, UPI & Profit Reports", category: "core" },
  { label: "Customer CRM", href: "/crm", meta: "Repeat Buyer History", category: "core" },
  { label: "Retail AI OS", href: "/retail-ai", meta: "Unified Retail Platform", category: "core" },
  { label: "Free Retail Tools", href: "/free-tools", meta: "Margin Calculator & Invoice Maker", category: "core" },
  { label: "WhatsApp Templates", href: "/templates", meta: "Ready Hindi & English Scripts", category: "core" },
  { label: "Android & PC Web App", href: "/android-app", meta: "Mobile & Desktop Browser Access", category: "core" },
  { label: "Live Interactive Demo", href: "/demo", meta: "Try Store Dashboard Now", category: "core" },
  { label: "Case Studies", href: "/case-studies", meta: "Indian Shopkeeper ROI Stories", category: "core" },
  { label: "FAQ", href: "/faq", meta: "Common Shopkeeper Questions", category: "core" },
  { label: "About DukaanMitra", href: "/about", meta: "Company & Vision", category: "core" },
  { label: "Founder — Amit Sharma", href: "/founder", meta: "Kanpur, Uttar Pradesh", category: "core" },
  { label: "Contact & Support", href: "/contact", meta: "Reach the DukaanMitra Team", category: "core" },
  { label: "Security & Data Privacy", href: "/security", meta: "Isolated Cloud Ledgers", category: "core" },
  { label: "Privacy Policy", href: "/privacy", meta: "Legal", category: "core" },
  { label: "Terms of Service", href: "/terms", meta: "Legal", category: "core" },
];

const AI_AND_SEARCH_FILES: SitemapLinkItem[] = [
  { label: "robots.txt", href: "/robots.txt", meta: "Search & AI Crawler Rules", category: "ai", external: true },
  { label: "sitemap.xml", href: "/sitemap.xml", meta: "Canonical XML URL Index", category: "ai", external: true },
  { label: "sitemap.html", href: "/sitemap.html", meta: "Static Zero-JS HTML Sitemap", category: "ai", external: true },
  { label: "llms.txt", href: "/llms.txt", meta: "Concise AI & LLM Summary", category: "ai", external: true },
  { label: "llms-full.txt", href: "/llms-full.txt", meta: "Complete Full-Text LLM Knowledge Base", category: "ai", external: true },
  { label: "/md/index.md", href: "/md/index.md", meta: "Clean Markdown Index", category: "ai", external: true },
  { label: "/md/overview.md", href: "/md/overview.md", meta: "Platform Overview (Markdown)", category: "ai", external: true },
  { label: "/md/features.md", href: "/md/features.md", meta: "Core Features (Markdown)", category: "ai", external: true },
  { label: "/md/pricing.md", href: "/md/pricing.md", meta: "INR Pricing Plans (Markdown)", category: "ai", external: true },
  { label: "/md/how-it-works.md", href: "/md/how-it-works.md", meta: "3-Step Workflow (Markdown)", category: "ai", external: true },
  { label: "/md/compare.md", href: "/md/compare.md", meta: "Competitor Comparison (Markdown)", category: "ai", external: true },
  { label: "/md/faq.md", href: "/md/faq.md", meta: "Hindi & English FAQ (Markdown)", category: "ai", external: true },
  { label: "/md/founder.md", href: "/md/founder.md", meta: "Founder Profile (Markdown)", category: "ai", external: true },
  { label: "/md/downloads.md", href: "/md/downloads.md", meta: "Downloads Catalog (Markdown)", category: "ai", external: true },
];

const DOWNLOAD_FILES: SitemapLinkItem[] = [
  { label: "Downloads & Discovery Hub", href: "/downloads", meta: "Browse, Preview & Download All Files", category: "downloads" },
  { label: "DukaanMitra Brochure 2026 (PDF)", href: "/downloads/dukaanmitra-brochure-2026.pdf", meta: "PDF · Product Overview & Pricing", category: "downloads", external: true, download: true },
  { label: "Retail Inventory Template (CSV)", href: "/downloads/retail-inventory-template.csv", meta: "CSV · 20 Kirana SKUs with GST & Margin", category: "downloads", external: true, download: true },
  { label: "Udhaar & Khata Tracker (CSV)", href: "/downloads/udhaar-khata-tracker.csv", meta: "CSV · Customer Credit Ledger Sheet", category: "downloads", external: true, download: true },
  { label: "WhatsApp Setup Guide (DOCX)", href: "/downloads/dukaanmitra-whatsapp-setup-guide.docx", meta: "DOCX · Step-by-Step Shop Onboarding", category: "downloads", external: true, download: true },
  { label: "Local Shop SEO Checklist (CSV)", href: "/downloads/local-shop-seo-checklist.csv", meta: "CSV · Google Maps & Digital Dukaan Audit", category: "downloads", external: true, download: true },
];

const GUIDES_AND_COMPARISONS: SitemapLinkItem[] = [
  { label: "DukaanMitra vs Khatabook", href: "/compare/khatabook", meta: "Comparison", category: "guides" },
  { label: "DukaanMitra vs OkCredit", href: "/compare/okcredit", meta: "Comparison", category: "guides" },
  { label: "DukaanMitra vs Vyapar", href: "/compare/vyapar", meta: "Comparison", category: "guides" },
  { label: "Retail Growth Blog", href: "/blog", meta: "All Articles", category: "guides" },
  { label: "Retail AI Wiki", href: "/knowledge", meta: "Knowledge Base", category: "guides" },
  { label: "WhatsApp Se Order Kaise Le", href: "/blog/whatsapp-se-order-kaise-le", meta: "Hinglish Guide", category: "guides" },
  { label: "Udhaar Ka Hisaab Kaise Rakhe", href: "/blog/udhaar-ka-hisaab-kaise-rakhe", meta: "Hinglish Guide", category: "guides" },
  { label: "Bahi Khata AI Se Kaise Manage Karein", href: "/blog/bahi-khata-ai-se-kaise-manage-karein", meta: "Hinglish Guide", category: "guides" },
  { label: "Dukaan Online Kaise Laye", href: "/p/dukaan-online-kaise-laye", meta: "Solution Hub", category: "guides" },
  { label: "Auto Parts Shop Free Billing", href: "/p/auto-parts-shop-free-billing", meta: "Solution Hub", category: "guides" },
  { label: "Medical Store Software India", href: "/p/medical-store-software-india", meta: "Solution Hub", category: "guides" },
  { label: "Hardware Shop Billing App", href: "/p/hardware-shop-billing-app", meta: "Solution Hub", category: "guides" },
  { label: "Garment Shop Software Free", href: "/p/garment-shop-software-free", meta: "Solution Hub", category: "guides" },
  { label: "Retail Khata App For PC", href: "/p/retail-khata-app-for-pc", meta: "Solution Hub", category: "guides" },
  { label: "Free GST Billing Software", href: "/p/free-gst-billing-software", meta: "Solution Hub", category: "guides" },
  { label: "WhatsApp Catalog Maker App", href: "/p/whatsapp-catalog-maker-app", meta: "Solution Hub", category: "guides" },
  { label: "Retail Keywords Directory", href: "/keywords", meta: "Search Index", category: "guides" },
];

const FEATURED_CITIES = [
  "kanpur", "lucknow", "jaipur", "meerut", "hyderabad", "gaya", "bhavnagar", "kakinada",
  "mysore", "nagpur", "delhi", "mumbai", "bangalore", "pune", "ahmedabad", "surat",
  "indore", "patna", "varanasi", "agra", "noida", "ghaziabad", "bhopal", "ludhiana",
  "chennai", "kolkata", "coimbatore", "kochi", "nashik", "rajkot", "jodhpur", "ranchi",
].map<SitemapLinkItem>((city) => ({
  label: `Retail AI in ${city.charAt(0).toUpperCase() + city.slice(1)}`,
  href: `/solutions/retail-ai-${city}`,
  meta: "City Solution Hub",
  category: "cities",
}));

const ALL_ITEMS: SitemapLinkItem[] = [
  ...CORE_PAGES,
  ...AI_AND_SEARCH_FILES,
  ...DOWNLOAD_FILES,
  ...GUIDES_AND_COMPARISONS,
  ...FEATURED_CITIES,
];

const CATEGORY_TABS: Array<{ id: SitemapCategory; label: string }> = [
  { id: "all", label: "All Sections" },
  { id: "core", label: "Core Pages" },
  { id: "ai", label: "Search & AI Files" },
  { id: "downloads", label: "Downloads" },
  { id: "guides", label: "Guides & Comparisons" },
  { id: "cities", label: "Indian Cities" },
];

const SECTION_META: Array<{ id: Exclude<SitemapCategory, "all">; title: string; subtitle: string }> = [
  {
    id: "core",
    title: "01. Core Application & Feature Pages",
    subtitle: "Primary product modules, pricing, free retail calculators, and company pages.",
  },
  {
    id: "ai",
    title: "02. Search Engine & AI Discovery Files",
    subtitle: "Direct crawler rules, XML/HTML sitemaps, llms.txt summaries, and clean Markdown (.md) pages.",
  },
  {
    id: "downloads",
    title: "03. Downloadable Brochures & Templates",
    subtitle: "Official PDF brochure, ready-to-use CSV shop ledgers, and DOCX onboarding guides.",
  },
  {
    id: "guides",
    title: "04. Comparisons, Blog & Solution Guides",
    subtitle: "Side-by-side comparisons and Hindi/Hinglish guides for retail store digitization.",
  },
  {
    id: "cities",
    title: "05. Regional City Hubs",
    subtitle: "Localized WhatsApp billing and udhaar automation guides across major Indian retail hubs.",
  },
];

export const HtmlSitemap: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") || "");
  const [activeCategory, setActiveCategory] = useState<SitemapCategory>("all");

  const handleSearchChange = (value: string) => {
    setQuery(value);
    if (value.trim()) {
      setSearchParams({ q: value }, { replace: true });
    } else {
      setSearchParams({}, { replace: true });
    }
  };

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ALL_ITEMS.filter((item) => {
      const matchesCat = activeCategory === "all" || item.category === activeCategory;
      const matchesQuery =
        !q ||
        item.label.toLowerCase().includes(q) ||
        item.meta.toLowerCase().includes(q) ||
        item.href.toLowerCase().includes(q);
      return matchesCat && matchesQuery;
    });
  }, [query, activeCategory]);

  const collectionSchema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "HTML Sitemap — DukaanMitra OS",
    url: "https://dukaanmitra.in/sitemap",
    description:
      "Complete human-readable HTML sitemap for DukaanMitra OS covering core pages, AI Markdown documentation, downloadable templates, and regional retail hubs.",
  };

  return (
    <div className="bg-white min-h-screen text-slate-900">
      <Helmet>
        <title>HTML Sitemap — Complete Site Directory | DukaanMitra</title>
        <meta
          name="description"
          content="Explore every page, AI Markdown file, downloadable PDF/CSV/DOCX template, retail guide, and city hub on DukaanMitra in one organized HTML sitemap."
        />
        <script type="application/ld+json">{JSON.stringify(collectionSchema)}</script>
      </Helmet>

      {/* Editorial Header */}
      <section className="border-b border-slate-200 bg-slate-50/70">
        <div className="max-w-6xl mx-auto px-6 py-14 lg:py-20">
          <p className="text-xs font-medium text-slate-500 mb-3">
            Site Directory · Updated 2026 · <span className="tabular-nums">{ALL_ITEMS.length}</span> Indexed Resources
          </p>
          <h1
            className="text-3xl sm:text-5xl font-bold tracking-tight text-slate-900 max-w-3xl leading-tight"
            style={{ textWrap: "balance" }}
          >
            DukaanMitra HTML Sitemap
          </h1>
          <p className="mt-4 text-base text-slate-600 max-w-2xl leading-relaxed">
            Browse every product page, search engine index, AI Markdown document, downloadable brochure, and regional shopkeeper guide from one clean directory.
          </p>

          {/* Direct raw discovery links */}
          <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-slate-600">
            <a href="/sitemap.html" className="font-medium text-indigo-700 hover:underline inline-flex items-center gap-1 whitespace-nowrap">
              Static sitemap.html <ExternalLink size={14} />
            </a>
            <a href="/sitemap.xml" className="font-medium text-indigo-700 hover:underline inline-flex items-center gap-1 whitespace-nowrap">
              sitemap.xml <ExternalLink size={14} />
            </a>
            <a href="/robots.txt" className="font-medium text-indigo-700 hover:underline inline-flex items-center gap-1 whitespace-nowrap">
              robots.txt <ExternalLink size={14} />
            </a>
            <a href="/llms.txt" className="font-medium text-indigo-700 hover:underline inline-flex items-center gap-1 whitespace-nowrap">
              llms.txt <ExternalLink size={14} />
            </a>
            <a href="/llms-full.txt" className="font-medium text-indigo-700 hover:underline inline-flex items-center gap-1 whitespace-nowrap">
              llms-full.txt <ExternalLink size={14} />
            </a>
            <Link to="/downloads" className="font-medium text-slate-900 hover:text-indigo-700 hover:underline inline-flex items-center gap-1 whitespace-nowrap">
              Downloads &amp; Search Insights <ArrowUpRight size={14} />
            </Link>
          </div>

          {/* Search & Category Filter Toolbar */}
          <div className="mt-8 flex flex-col lg:flex-row gap-4 lg:items-center lg:justify-between">
            <div className="relative flex-1 max-w-md">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="search"
                value={query}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Filter pages, cities, .md files, or templates..."
                aria-label="Filter sitemap links"
                className="w-full pl-10 pr-4 py-2.5 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600"
              />
            </div>

            <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg overflow-x-auto">
              {CATEGORY_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveCategory(tab.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    activeCategory === tab.id
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Categorized Directory Listing */}
      <section className="max-w-6xl mx-auto px-6 py-12 lg:py-16 space-y-14">
        {filteredItems.length === 0 ? (
          <div className="py-16 text-center border border-slate-200 rounded-xl bg-slate-50/50">
            <p className="text-base font-semibold text-slate-900">No matching links found for &ldquo;{query}&rdquo;</p>
            <p className="text-sm text-slate-500 mt-1">Try searching for billing, udhaar, llms.txt, CSV, Jaipur, or Kanpur.</p>
            <button
              type="button"
              onClick={() => {
                handleSearchChange("");
                setActiveCategory("all");
              }}
              className="mt-4 px-4 py-2 text-xs font-medium bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Reset Filter
            </button>
          </div>
        ) : (
          SECTION_META.map((sec) => {
            const items = filteredItems.filter((item) => item.category === sec.id);
            if (items.length === 0) return null;
            return (
              <div key={sec.id}>
                <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-2 pb-4 border-b border-slate-200">
                  <div>
                    <h2 className="text-xl font-semibold text-slate-900 tracking-tight">{sec.title}</h2>
                    <p className="text-sm text-slate-500 mt-1">{sec.subtitle}</p>
                  </div>
                  <span className="text-xs text-slate-500 tabular-nums shrink-0">
                    {items.length} {items.length === 1 ? "link" : "links"}
                  </span>
                </div>

                <ul className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
                  {items.map((item) => (
                    <li key={`${sec.id}-${item.href}`}>
                      {item.external ? (
                        <a
                          href={item.href}
                          download={item.download || undefined}
                          target={item.download ? undefined : "_blank"}
                          rel={item.download ? undefined : "noopener noreferrer"}
                          className="group flex items-start justify-between gap-3 p-3.5 rounded-lg border border-slate-200 hover:border-slate-300 hover:bg-slate-50/80 transition-colors"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-900 group-hover:text-indigo-700 truncate">
                              {item.label}
                            </p>
                            <p className="text-xs text-slate-500 mt-0.5 truncate">{item.meta}</p>
                          </div>
                          {item.download ? (
                            <Download size={15} className="text-slate-400 group-hover:text-indigo-700 shrink-0 mt-0.5" />
                          ) : (
                            <FileText size={15} className="text-slate-400 group-hover:text-indigo-700 shrink-0 mt-0.5" />
                          )}
                        </a>
                      ) : (
                        <Link
                          to={item.href}
                          className="group flex items-start justify-between gap-3 p-3.5 rounded-lg border border-slate-200 hover:border-slate-300 hover:bg-slate-50/80 transition-colors"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-900 group-hover:text-indigo-700 truncate">
                              {item.label}
                            </p>
                            <p className="text-xs text-slate-500 mt-0.5 truncate">{item.meta}</p>
                          </div>
                          <ArrowUpRight size={15} className="text-slate-400 group-hover:text-indigo-700 shrink-0 mt-0.5" />
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })
        )}
      </section>
    </div>
  );
};

export default HtmlSitemap;
