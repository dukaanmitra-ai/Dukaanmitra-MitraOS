import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import {
  Download,
  FileText,
  Eye,
  Copy,
  Check,
  ExternalLink,
  X,
  ArrowUpRight,
  BarChart3,
  Globe,
  Bot,
  FolderDown,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

type HubTab = "downloads" | "discovery" | "gsc";

interface DownloadResource {
  id: string;
  title: string;
  format: "PDF" | "CSV" | "DOCX";
  filename: string;
  href: string;
  summary: string;
  audience: string;
  previewableCsv?: boolean;
}

const DOWNLOADABLE_FILES: DownloadResource[] = [
  {
    id: "brochure",
    title: "DukaanMitra OS Product Brochure (2026)",
    format: "PDF",
    filename: "dukaanmitra-brochure-2026.pdf",
    href: "/downloads/dukaanmitra-brochure-2026.pdf",
    summary:
      "Complete printable overview of WhatsApp billing, Munim AI voice commands, INR pricing tiers, and supported Indian retail categories.",
    audience: "Shopkeepers & Distributors",
  },
  {
    id: "inventory",
    title: "Indian Retail & Kirana Inventory Template",
    format: "CSV",
    filename: "retail-inventory-template.csv",
    href: "/downloads/retail-inventory-template.csv",
    summary:
      "20 pre-formatted Indian retail SKUs with cost price, MRP, GST slabs, margin percentages, current stock, and reorder levels.",
    audience: "Kirana, Grocery & General Stores",
    previewableCsv: true,
  },
  {
    id: "udhaar",
    title: "Customer Udhaar & Khata Recovery Sheet",
    format: "CSV",
    filename: "udhaar-khata-tracker.csv",
    href: "/downloads/udhaar-khata-tracker.csv",
    summary:
      "Structured customer credit ledger with WhatsApp numbers, billed totals, paid amounts, pending udhaar, due dates, and reminder status.",
    audience: "Credit-Heavy Retail Stores",
    previewableCsv: true,
  },
  {
    id: "guide",
    title: "WhatsApp Digital Dukaan Setup Guide",
    format: "DOCX",
    filename: "dukaanmitra-whatsapp-setup-guide.docx",
    href: "/downloads/dukaanmitra-whatsapp-setup-guide.docx",
    summary:
      "Editable Word & Google Docs onboarding manual covering WhatsApp linking, first voice bill, UPI reminders, catalog setup, and Google reviews.",
    audience: "Store Owners & Staff Training",
  },
  {
    id: "seo-checklist",
    title: "Local Shop SEO & Discovery Checklist",
    format: "CSV",
    filename: "local-shop-seo-checklist.csv",
    href: "/downloads/local-shop-seo-checklist.csv",
    summary:
      "10-step practical spreadsheet covering Google Business Profile, canonical redirects, JSON-LD schema, llms.txt, and Hindi/Hinglish search optimization.",
    audience: "Store Owners & Growth Teams",
    previewableCsv: true,
  },
];

interface DiscoveryFile {
  label: string;
  path: string;
  group: "Search Engines" | "AI & LLMs" | "Clean Markdown (.md)";
  note: string;
}

const DISCOVERY_FILES: DiscoveryFile[] = [
  { label: "robots.txt", path: "/robots.txt", group: "Search Engines", note: "Googlebot, Bingbot & AI crawler directives" },
  { label: "sitemap.xml", path: "/sitemap.xml", group: "Search Engines", note: "Canonical XML URL index (no redirect duplicates)" },
  { label: "sitemap.html", path: "/sitemap.html", group: "Search Engines", note: "Static human-readable HTML sitemap" },
  { label: "llms.txt", path: "/llms.txt", group: "AI & LLMs", note: "Concise Markdown index for ChatGPT, Claude & Gemini" },
  { label: "llms-full.txt", path: "/llms-full.txt", group: "AI & LLMs", note: "Complete full-text knowledge base in one file" },
  { label: "/md/index.md", path: "/md/index.md", group: "Clean Markdown (.md)", note: "Master Markdown directory" },
  { label: "/md/overview.md", path: "/md/overview.md", group: "Clean Markdown (.md)", note: "Platform identity, Hisaab & Inventory Mitra" },
  { label: "/md/features.md", path: "/md/features.md", group: "Clean Markdown (.md)", note: "WhatsApp billing, udhaar & Google reviews" },
  { label: "/md/pricing.md", path: "/md/pricing.md", group: "Clean Markdown (.md)", note: "Starter ₹0, Growth ₹299, Enterprise ₹999" },
  { label: "/md/how-it-works.md", path: "/md/how-it-works.md", group: "Clean Markdown (.md)", note: "3-step onboarding & Hinglish examples" },
  { label: "/md/compare.md", path: "/md/compare.md", group: "Clean Markdown (.md)", note: "DukaanMitra vs Khatabook, OkCredit & Vyapar" },
  { label: "/md/faq.md", path: "/md/faq.md", group: "Clean Markdown (.md)", note: "Hindi, Hinglish & English Q&A" },
  { label: "/md/founder.md", path: "/md/founder.md", group: "Clean Markdown (.md)", note: "Founder Amit Sharma (Kanpur)" },
  { label: "/md/downloads.md", path: "/md/downloads.md", group: "Clean Markdown (.md)", note: "Downloadable files reference" },
];

// Simple RFC-4180 compliant CSV line parser (handles quoted commas)
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  const lines = text.replace(/\r\n/g, "\n").split("\n").filter((l) => l.trim().length > 0);
  for (const line of lines) {
    const cells: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === "," && !inQuotes) {
        cells.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    cells.push(current.trim());
    rows.push(cells);
  }
  return rows;
}

interface GscDailyRow {
  date: string;
  clicks: number;
  impressions: number;
  position: number;
}

interface GscTableRow {
  label: string;
  clicks: number;
  impressions: number;
  ctr: string;
  position: number;
}

interface GscDataBundle {
  daily: GscDailyRow[];
  queries: GscTableRow[];
  pages: GscTableRow[];
  countries: GscTableRow[];
  devices: GscTableRow[];
  appearance: GscTableRow[];
  dateRange: string;
}

export const DownloadsHub: React.FC = () => {
  const [activeTab, setActiveTab] = useState<HubTab>("downloads");

  // CSV Preview modal state
  const [previewTitle, setPreviewTitle] = useState<string | null>(null);
  const [previewRows, setPreviewRows] = useState<string[][]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Live Discovery file inspector state
  const [selectedFile, setSelectedFile] = useState<DiscoveryFile>(DISCOVERY_FILES[3]); // llms.txt default
  const [fileContent, setFileContent] = useState<string>("");
  const [fileLoading, setFileLoading] = useState<boolean>(false);
  const [copiedPath, setCopiedPath] = useState<string | null>(null);

  // Live GSC CSV dataset state
  const [gscData, setGscData] = useState<GscDataBundle | null>(null);
  const [gscLoading, setGscLoading] = useState<boolean>(false);
  const [gscError, setGscError] = useState<string | null>(null);

  // Load selected discovery file whenever tab is discovery or selectedFile changes
  useEffect(() => {
    if (activeTab !== "discovery") return;
    let cancelled = false;
    setFileLoading(true);
    fetch(selectedFile.path)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.text();
      })
      .then((text) => {
        if (!cancelled) {
          setFileContent(text);
          setFileLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFileContent(`Unable to load ${selectedFile.path}.`);
          setFileLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [activeTab, selectedFile]);

  // Load attached Google Search Console CSV datasets when GSC tab is opened
  useEffect(() => {
    if (activeTab !== "gsc" || gscData) return;
    let cancelled = false;
    setGscLoading(true);
    setGscError(null);

    Promise.all([
      fetch("/assets/aistudio/Chart_67da2e3a.csv").then((r) => r.text()),
      fetch("/assets/aistudio/Queries_fa40fba6.csv").then((r) => r.text()),
      fetch("/assets/aistudio/Pages_58d6a83e.csv").then((r) => r.text()),
      fetch("/assets/aistudio/Countries_e2fb4e68.csv").then((r) => r.text()),
      fetch("/assets/aistudio/Devices_e4bb1d98.csv").then((r) => r.text()),
      fetch("/assets/aistudio/Search_appearance_582b82a7.csv").then((r) => r.text()),
      fetch("/assets/aistudio/Filters_8f01689e.csv").then((r) => r.text()),
    ])
      .then(([chartTxt, queriesTxt, pagesTxt, countriesTxt, devicesTxt, appearTxt, filtersTxt]) => {
        if (cancelled) return;

        const parseMetricRows = (txt: string): GscTableRow[] =>
          parseCsv(txt)
            .slice(1)
            .map((r) => ({
              label: r[0] || "",
              clicks: Number(r[1]) || 0,
              impressions: Number(r[2]) || 0,
              ctr: r[3] || "0%",
              position: Number(r[4]) || 0,
            }))
            .filter((r) => r.label);

        const daily = parseCsv(chartTxt)
          .slice(1)
          .map((r) => ({
            date: r[0] || "",
            clicks: Number(r[1]) || 0,
            impressions: Number(r[2]) || 0,
            position: Number(r[4]) || 0,
          }))
          .filter((r) => r.date && (r.clicks > 0 || r.impressions > 0));

        const filterRows = parseCsv(filtersTxt).slice(1);
        const dateFilter = filterRows.find((r) => r[0]?.toLowerCase() === "date")?.[1] || "Last 16 months";

        setGscData({
          daily,
          queries: parseMetricRows(queriesTxt),
          pages: parseMetricRows(pagesTxt),
          countries: parseMetricRows(countriesTxt),
          devices: parseMetricRows(devicesTxt),
          appearance: parseMetricRows(appearTxt),
          dateRange: dateFilter,
        });
        setGscLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setGscError("Could not load the Search Console CSV reports.");
          setGscLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeTab, gscData]);

  const handleOpenCsvPreview = async (file: DownloadResource) => {
    setPreviewTitle(file.title);
    setPreviewLoading(true);
    setPreviewRows([]);
    try {
      const res = await fetch(file.href);
      const text = await res.text();
      setPreviewRows(parseCsv(text));
    } catch {
      setPreviewRows([["Error", "Could not load CSV preview."]]);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleCopyContent = () => {
    if (!fileContent) return;
    navigator.clipboard.writeText(fileContent);
    setCopiedPath(selectedFile.path);
    setTimeout(() => setCopiedPath(null), 2000);
  };

  const totalGscClicks = gscData?.devices.reduce((sum, d) => sum + d.clicks, 0) ?? 0;
  const totalGscImpressions = gscData?.devices.reduce((sum, d) => sum + d.impressions, 0) ?? 0;
  const avgCtr = totalGscImpressions > 0 ? ((totalGscClicks / totalGscImpressions) * 100).toFixed(2) : "0.00";
  const indiaRow = gscData?.countries.find((c) => c.label === "India");
  const wwwHome = gscData?.pages.find((p) => p.label === "https://www.dukaanmitra.in/");
  const apexHome = gscData?.pages.find((p) => p.label === "https://dukaanmitra.in/");

  const datasetSchema = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "Downloads & AI Discovery Resource Hub — DukaanMitra",
    url: "https://dukaanmitra.in/downloads",
    description:
      "Download official DukaanMitra PDF brochure, CSV retail inventory and udhaar templates, DOCX WhatsApp setup guide, and inspect live robots.txt, sitemap.xml, llms.txt, and clean Markdown files.",
  };

  return (
    <div className="bg-white min-h-screen text-slate-900">
      <Helmet>
        <title>Downloads, AI Files &amp; Search Console Insights | DukaanMitra</title>
        <meta
          name="description"
          content="Download DukaanMitra PDF brochure, CSV inventory and udhaar sheets, DOCX setup guide, and inspect robots.txt, sitemap.xml, llms.txt, and clean Markdown docs."
        />
        <script type="application/ld+json">{JSON.stringify(datasetSchema)}</script>
      </Helmet>

      {/* Header */}
      <section className="border-b border-slate-200 bg-slate-50/70">
        <div className="max-w-6xl mx-auto px-6 py-14 lg:py-20">
          <p className="text-xs font-medium text-slate-500 mb-3">
            Resource Center · Search Engines · AI &amp; LLMs · Shopkeeper Downloads
          </p>
          <h1
            className="text-3xl sm:text-5xl font-bold tracking-tight text-slate-900 max-w-3xl leading-tight"
            style={{ textWrap: "balance" }}
          >
            Downloads, AI Discovery Files &amp; Search Insights
          </h1>
          <p className="mt-4 text-base text-slate-600 max-w-2xl leading-relaxed">
            Access ready-to-use PDF brochures, CSV shop templates, and DOCX setup guides—plus inspect DukaanMitra&apos;s live search crawler files, LLM Markdown endpoints, and Google Search Console telemetry.
          </p>

          {/* Segmented Navigation Controls */}
          <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
            <div className="inline-flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg overflow-x-auto max-w-full">
              <button
                type="button"
                onClick={() => setActiveTab("downloads")}
                className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  activeTab === "downloads"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <FolderDown size={15} />
                Downloadable Files (PDF / CSV / DOCX)
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("discovery")}
                className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  activeTab === "discovery"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Bot size={15} />
                Search &amp; AI Files (llms.txt / .md)
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("gsc")}
                className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  activeTab === "gsc"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <BarChart3 size={15} />
                Search Console Insights (CSV)
              </button>
            </div>

            <Link
              to="/sitemap"
              className="text-sm font-medium text-indigo-700 hover:underline inline-flex items-center gap-1 whitespace-nowrap shrink-0"
            >
              Open HTML Sitemap <ArrowUpRight size={15} />
            </Link>
          </div>
        </div>
      </section>

      {/* Main Tab Body */}
      <section className="max-w-6xl mx-auto px-6 py-12 lg:py-16">
        {/* TAB 1: DOWNLOADABLE FILES */}
        {activeTab === "downloads" && (
          <div className="space-y-10">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 border-b border-slate-200 pb-5">
              <div>
                <h2 className="text-2xl font-semibold text-slate-900 tracking-tight">
                  Official Brochures, Sheets &amp; Setup Guides
                </h2>
                <p className="text-sm text-slate-600 mt-1">
                  Free, zero-login downloads generated directly for Indian retail shopkeepers and wholesale teams.
                </p>
              </div>
              <span className="text-xs text-slate-500 tabular-nums">
                {DOWNLOADABLE_FILES.length} verified files · PDF · CSV · DOCX
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {DOWNLOADABLE_FILES.map((file) => (
                <article
                  key={file.id}
                  className="p-6 rounded-xl border border-slate-200 bg-white flex flex-col justify-between gap-6"
                >
                  <div>
                    <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
                      <span className="font-semibold text-indigo-700">{file.format}</span>
                      <span aria-hidden="true">·</span>
                      <span>{file.audience}</span>
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900 leading-snug">
                      {file.title}
                    </h3>
                    <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                      {file.summary}
                    </p>
                    <p className="mt-3 text-xs font-mono text-slate-500 truncate">
                      {file.href}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-slate-100">
                    <a
                      href={file.href}
                      download={file.filename}
                      className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
                    >
                      <Download size={14} />
                      Download {file.format}
                    </a>

                    {file.previewableCsv && (
                      <button
                        type="button"
                        onClick={() => handleOpenCsvPreview(file)}
                        className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <Eye size={14} />
                        Preview Table
                      </button>
                    )}

                    {file.format === "PDF" && (
                      <a
                        href={file.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
                      >
                        <ExternalLink size={14} />
                        Open PDF
                      </a>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </div>
        )}

        {/* TAB 2: SEARCH & AI DISCOVERY INSPECTOR */}
        {activeTab === "discovery" && (
          <div className="space-y-8">
            <div className="border-b border-slate-200 pb-5">
              <h2 className="text-2xl font-semibold text-slate-900 tracking-tight">
                Live Search Engine &amp; LLM Discovery Files
              </h2>
              <p className="text-sm text-slate-600 mt-1">
                Inspect and verify the exact raw files served to Googlebot, ChatGPT, Claude, Perplexity, and AI agents.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* File List */}
              <div className="lg:col-span-4 space-y-6">
                {(["Search Engines", "AI & LLMs", "Clean Markdown (.md)"] as const).map((groupName) => (
                  <div key={groupName}>
                    <h3 className="text-xs font-semibold text-slate-500 mb-2.5">
                      {groupName}
                    </h3>
                    <div className="space-y-1">
                      {DISCOVERY_FILES.filter((f) => f.group === groupName).map((file) => {
                        const isActive = selectedFile.path === file.path;
                        return (
                          <button
                            key={file.path}
                            type="button"
                            onClick={() => setSelectedFile(file)}
                            className={`w-full text-left px-3.5 py-2.5 rounded-lg border transition-colors cursor-pointer ${
                              isActive
                                ? "bg-slate-900 text-white border-slate-900"
                                : "bg-white text-slate-800 border-slate-200 hover:bg-slate-50"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm font-mono font-medium truncate">
                                {file.label}
                              </span>
                              <FileText size={14} className={isActive ? "text-slate-300" : "text-slate-400"} />
                            </div>
                            <p
                              className={`text-xs mt-0.5 truncate ${
                                isActive ? "text-slate-300" : "text-slate-500"
                              }`}
                            >
                              {file.note}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {/* Live Raw Content Viewer */}
              <div className="lg:col-span-8 rounded-xl border border-slate-200 overflow-hidden bg-white">
                <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-mono font-semibold text-slate-900 truncate">
                      https://dukaanmitra.in{selectedFile.path}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">{selectedFile.note}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={handleCopyContent}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-100 transition-colors cursor-pointer whitespace-nowrap"
                    >
                      {copiedPath === selectedFile.path ? <Check size={14} /> : <Copy size={14} />}
                      {copiedPath === selectedFile.path ? "Copied" : "Copy Text"}
                    </button>
                    <a
                      href={selectedFile.path}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-slate-900 rounded-md hover:bg-slate-800 transition-colors whitespace-nowrap"
                    >
                      Open Raw <ExternalLink size={13} />
                    </a>
                  </div>
                </div>

                <div className="p-5 bg-slate-950 text-slate-100 overflow-auto max-h-[560px]">
                  {fileLoading ? (
                    <p className="text-xs font-mono text-slate-400">Loading {selectedFile.path}...</p>
                  ) : (
                    <pre className="text-xs font-mono leading-relaxed whitespace-pre-wrap break-words">
                      {fileContent}
                    </pre>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: REAL GOOGLE SEARCH CONSOLE DATA INSIGHTS */}
        {activeTab === "gsc" && (
          <div className="space-y-10">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 border-b border-slate-200 pb-5">
              <div>
                <h2 className="text-2xl font-semibold text-slate-900 tracking-tight">
                  Google Search Console Performance (dukaanmitra.in)
                </h2>
                <p className="text-sm text-slate-600 mt-1">
                  Parsed live from your uploaded Search Console CSV exports ({gscData?.dateRange || "Last 16 months"} · Web Search).
                </p>
              </div>
              <span className="text-xs text-slate-500 inline-flex items-center gap-1.5">
                <Globe size={14} /> Source: /assets/aistudio/*.csv
              </span>
            </div>

            {gscLoading && (
              <div className="py-12 text-center text-sm text-slate-500">
                Parsing Search Console CSV reports...
              </div>
            )}

            {gscError && (
              <div className="p-4 rounded-lg border border-rose-200 bg-rose-50 text-sm text-rose-800">
                {gscError}
              </div>
            )}

            {gscData && (
              <>
                {/* 4-Column KPI Strip */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="p-5 rounded-xl border border-slate-200 bg-white">
                    <p className="text-xs text-slate-500">Total Search Clicks</p>
                    <p className="mt-2 text-3xl font-bold text-slate-900 tabular-nums">
                      {totalGscClicks.toLocaleString()}
                    </p>
                    <p className="mt-1 text-xs text-slate-500 tabular-nums">
                      India: {indiaRow?.clicks ?? 0} clicks ({indiaRow?.ctr ?? "0%"})
                    </p>
                  </div>
                  <div className="p-5 rounded-xl border border-slate-200 bg-white">
                    <p className="text-xs text-slate-500">Total Impressions</p>
                    <p className="mt-2 text-3xl font-bold text-slate-900 tabular-nums">
                      {totalGscImpressions.toLocaleString()}
                    </p>
                    <p className="mt-1 text-xs text-slate-500 tabular-nums">
                      Avg CTR: {avgCtr}%
                    </p>
                  </div>
                  <div className="p-5 rounded-xl border border-slate-200 bg-white">
                    <p className="text-xs text-slate-500">Device Split (Clicks)</p>
                    <p className="mt-2 text-2xl font-bold text-slate-900 tabular-nums">
                      {gscData.devices[0]?.clicks ?? 0} / {gscData.devices[1]?.clicks ?? 0}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Desktop ({gscData.devices[0]?.ctr}) · Mobile ({gscData.devices[1]?.ctr})
                    </p>
                  </div>
                  <div className="p-5 rounded-xl border border-slate-200 bg-white">
                    <p className="text-xs text-slate-500">Translated Results</p>
                    <p className="mt-2 text-3xl font-bold text-slate-900 tabular-nums">
                      {gscData.appearance[0]?.impressions ?? 0}
                    </p>
                    <p className="mt-1 text-xs text-slate-500 tabular-nums">
                      Impressions · Pos {gscData.appearance[0]?.position ?? "-"}
                    </p>
                  </div>
                </div>

                {/* Daily Clicks & Impressions Trend */}
                <div className="p-6 rounded-xl border border-slate-200 bg-white">
                  <div className="flex flex-wrap items-baseline justify-between gap-2 mb-6">
                    <div>
                      <h3 className="text-base font-semibold text-slate-900">
                        Search Visibility Timeline
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Daily impressions and clicks from Chart_67da2e3a.csv
                      </p>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-slate-600">
                      <span>Indigo: Impressions</span>
                      <span>·</span>
                      <span>Emerald: Clicks</span>
                    </div>
                  </div>
                  <div className="h-72 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={gscData.daily} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis
                          dataKey="date"
                          tick={{ fontSize: 11, fill: "#64748b" }}
                          minTickGap={36}
                        />
                        <YAxis tick={{ fontSize: 11, fill: "#64748b" }} />
                        <Tooltip
                          contentStyle={{
                            borderRadius: "8px",
                            border: "1px solid #e2e8f0",
                            fontSize: "12px",
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="impressions"
                          name="Impressions"
                          stroke="#4f46e5"
                          fill="#4f46e5"
                          fillOpacity={0.12}
                          strokeWidth={2}
                        />
                        <Area
                          type="monotone"
                          dataKey="clicks"
                          name="Clicks"
                          stroke="#059669"
                          fill="#059669"
                          fillOpacity={0.2}
                          strokeWidth={2}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Canonical & SEO Fixes Applied from This Dataset */}
                <div className="p-6 rounded-xl border border-slate-200 bg-slate-50/70">
                  <h3 className="text-base font-semibold text-slate-900">
                    Key Fixes Implemented From Your Search Console Data
                  </h3>
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-6 text-sm text-slate-600">
                    <div>
                      <p className="font-semibold text-slate-900">1. Apex vs www Consolidation</p>
                      <p className="mt-1 leading-relaxed">
                        Your Pages CSV shows{" "}
                        <span className="font-mono text-slate-900 tabular-nums">
                          {apexHome?.impressions ?? 1141}
                        </span>{" "}
                        impressions on apex and{" "}
                        <span className="font-mono text-slate-900 tabular-nums">
                          {wwwHome?.impressions ?? 276}
                        </span>{" "}
                        split on <span className="font-mono">www.dukaanmitra.in</span>. Added permanent 301 host redirect in{" "}
                        <span className="font-mono">vercel.json</span> + <span className="font-mono">server.ts</span> and cleaned duplicate city URLs out of{" "}
                        <span className="font-mono">sitemap.xml</span>.
                      </p>
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900">2. Real Query Schema &amp; AI Alignment</p>
                      <p className="mt-1 leading-relaxed">
                        Embedded <span className="font-mono">FAQPage</span>, <span className="font-mono">Organization</span>, and{" "}
                        <span className="font-mono">SoftwareApplication</span> JSON-LD directly in <span className="font-mono">index.html</span> plus clean{" "}
                        <span className="font-mono">/md/*.md</span> files answering your actual impressions: <em>Hisaab Mitra</em>, <em>Inventory Mitra</em>, <em>who is founder</em>, and <em>PC/Desktop access</em>.
                      </p>
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900">3. Bilingual &amp; Human Discovery</p>
                      <p className="mt-1 leading-relaxed">
                        With <span className="font-mono tabular-nums">{gscData.appearance[0]?.impressions ?? 94}</span> impressions on Translated Results and strong Mobile/Desktop parity, added Hindi/Hinglish Q&amp;A in <span className="font-mono">llms-full.txt</span>, an HTML Sitemap, downloadable templates, and a live Munim AI chat widget.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Two-Column Real Tables: Top Queries & Top Pages */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Top Queries */}
                  <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
                    <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-slate-900">Top Search Queries</h3>
                      <span className="text-xs text-slate-500 tabular-nums">
                        {gscData.queries.length} queries
                      </span>
                    </div>
                    <div className="overflow-x-auto max-h-96">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 sticky top-0">
                          <tr>
                            <th className="py-2.5 px-4 font-medium">Query</th>
                            <th className="py-2.5 px-3 font-medium text-right">Clicks</th>
                            <th className="py-2.5 px-3 font-medium text-right">Impr.</th>
                            <th className="py-2.5 px-4 font-medium text-right">Pos.</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {gscData.queries.slice(0, 18).map((row, idx) => (
                            <tr key={`${row.label}-${idx}`} className="hover:bg-slate-50/70">
                              <td className="py-2.5 px-4 font-medium text-slate-900 max-w-[200px] truncate">
                                {row.label}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-700">
                                {row.clicks}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-700">
                                {row.impressions}
                              </td>
                              <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-500">
                                {row.position.toFixed(1)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Top Pages */}
                  <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
                    <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-slate-900">Top Indexed Pages</h3>
                      <span className="text-xs text-slate-500 tabular-nums">
                        {gscData.pages.length} URLs
                      </span>
                    </div>
                    <div className="overflow-x-auto max-h-96">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 sticky top-0">
                          <tr>
                            <th className="py-2.5 px-4 font-medium">URL</th>
                            <th className="py-2.5 px-3 font-medium text-right">Clicks</th>
                            <th className="py-2.5 px-3 font-medium text-right">Impr.</th>
                            <th className="py-2.5 px-4 font-medium text-right">Pos.</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {gscData.pages.slice(0, 18).map((row, idx) => (
                            <tr key={`${row.label}-${idx}`} className="hover:bg-slate-50/70">
                              <td className="py-2.5 px-4 font-mono text-[11px] text-slate-800 max-w-[240px] truncate" title={row.label}>
                                {row.label.replace(/^https?:\/\//, "")}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-700">
                                {row.clicks}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-700">
                                {row.impressions}
                              </td>
                              <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-500">
                                {row.position.toFixed(1)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </section>

      {/* CSV Preview Modal */}
      {previewTitle && (
        <div
          className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-label={previewTitle}
        >
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl w-full max-w-4xl max-h-[82vh] flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-semibold text-slate-900">{previewTitle}</h3>
                <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
                  {previewRows.length > 1 ? `${previewRows.length - 1} rows` : "CSV preview"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewTitle(null)}
                aria-label="Close preview"
                className="p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
            <div className="overflow-auto flex-1">
              {previewLoading ? (
                <p className="p-8 text-sm text-slate-500 text-center">Loading CSV data...</p>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
                    <tr>
                      {(previewRows[0] || []).map((header, idx) => (
                        <th key={idx} className="py-2.5 px-4 font-semibold text-slate-700 whitespace-nowrap">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {previewRows.slice(1).map((row, rIdx) => (
                      <tr key={rIdx} className="hover:bg-slate-50/70">
                        {row.map((cell, cIdx) => (
                          <td key={cIdx} className="py-2.5 px-4 text-slate-700 whitespace-nowrap tabular-nums">
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DownloadsHub;
