import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Cpu,
  Database,
  FileText,
  IndianRupee,
  Languages,
  Layers,
  Lock,
  MessageSquare,
  Mic,
  Play,
  QrCode,
  ScanLine,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Store,
  TrendingUp,
  Volume2,
  WifiOff,
  X,
  Zap,
} from "lucide-react";
import parchiScanImg from "../src/assets/images/parchi_handwritten_scan_1795748117883.jpg";
import storeDemoHeroImg from "../src/assets/images/kirana_store_demo_hero_1795748117036.jpg";
import merchantJaipurImg from "../src/assets/images/merchant_jaipur_portrait_1795748116743.jpg";
import merchantPuneImg from "../src/assets/images/merchant_pune_portrait_1795748119455.jpg";
import merchantIndoreImg from "../src/assets/images/merchant_indore_portrait_1795748119580.jpg";

type VoicePresetKey = "parchi" | "voice" | "udhar";

const VOICE_PRESETS: Record<
  VoicePresetKey,
  {
    label: string;
    promptTitle: string;
    promptSub: string;
    items: { name: string; qty: string; price: string }[];
    total: string;
    badge: string;
    soundboxText: string;
  }
> = {
  parchi: {
    label: "Parchi OCR",
    promptTitle: "Handwritten Parchi Scanned (14ms)",
    promptSub: "Sharma General Store · Bill #DM-4092",
    items: [
      { name: "Aashirvaad Atta", qty: "10 kg", price: "₹465.00" },
      { name: "Fortune Mustard Oil", qty: "2 L", price: "₹340.00" },
      { name: "Toor Dal Premium", qty: "3 kg", price: "₹495.00" },
      { name: "Tata Salt Lite", qty: "5 pkt", price: "₹135.00" },
    ],
    total: "₹1,435.00",
    badge: "GST Invoice + Dynamic UPI QR Ready",
    soundboxText: "₹1,435 prapt hue — Sharma General Store",
  },
  voice: {
    label: "Hinglish Voice",
    promptTitle: '"Ramesh ji ke 5 kilo chawal aur 2 tel bill karo"',
    promptSub: "Dual-Dialect Voice POS · Auto-Stock Deducted",
    items: [
      { name: "India Gate Basmati", qty: "5 kg", price: "₹620.00" },
      { name: "Saffola Gold Oil", qty: "2 L", price: "₹360.00" },
      { name: "MDH Haldi Powder", qty: "200 g", price: "₹68.00" },
    ],
    total: "₹1,048.00",
    badge: "WhatsApp Bill Sent to Ramesh Verma",
    soundboxText: "₹1,048 prapt hue — Instant UPI Cleared",
  },
  udhar: {
    label: "Udhar Follow-up",
    promptTitle: "Polite WhatsApp Khata Reminder Sent",
    promptSub: "0% Awkwardness · Auto UPI Collect Link",
    items: [
      { name: "Gupta Sweet House", qty: "Due 6 days", price: "₹4,620.00" },
      { name: "Ramesh Hardware", qty: "Due 3 days", price: "₹2,150.00" },
      { name: "Patel Medicals", qty: "Settled Today", price: "₹3,890.00" },
    ],
    total: "₹6,770.00",
    badge: "84.2% Recovery Velocity This Week",
    soundboxText: "₹3,890 udhar jama hua — Patel Medicals",
  },
};

const FAQ_ITEMS = [
  {
    q: "Do I need a desktop computer or barcode scanner to start using DukaanMitra?",
    a: "No. DukaanMitra runs directly inside WhatsApp and any Android smartphone. Snap a photo of a handwritten parchi or speak in Hindi/Hinglish—our 14ms local AI parses items, generates a GST bill, and updates your stock automatically.",
  },
  {
    q: "What happens if my shop internet goes down during peak evening rush?",
    a: "DukaanMitra uses a local-first SQLite CRDT engine. Every bill, udhaar entry, and stock deduction continues working at full speed offline and auto-syncs encrypted ledgers to the cloud the moment 4G/Wi-Fi returns.",
  },
  {
    q: "How does 0% awkwardness Udhar recovery work?",
    a: "Instead of you making uncomfortable reminder calls, Munim AI sends a polite, branded WhatsApp statement on your store's behalf with a direct 1-tap UPI payment button. Payments auto-reconcile with your Bahi-Khata.",
  },
  {
    q: "Can I migrate my existing stock list from Vyapar, Tally, Marg, or Excel?",
    a: "Yes. Upload any CSV/Excel catalog or snap photos of your distributor purchase invoices. DukaanMitra maps SKU codes, GST slabs, MRP, and opening balances in under 5 minutes—or download free starter templates from our Downloads Hub.",
  },
  {
    q: "Is my store's financial and customer data safe and private?",
    a: "100%. All ledgers are protected with 256-bit AES encryption, isolated per merchant under India's DPDP Act 2023 guidelines. We never share your customer list or margins with third-party aggregators.",
  },
];

const DEMO_STEPS = [
  {
    time: "00:00 – 00:30",
    title: "Snap Any Handwritten Parchi or Speak in Hinglish",
    detail:
      "Point your phone at a paper slip or send a 4-second WhatsApp voice note. Our on-device Small Language Model parses items, weights, and local pricing in 14ms.",
    metric: "14ms Local OCR",
  },
  {
    time: "00:30 – 01:00",
    title: "Auto-Generate GST Bill, Dynamic UPI QR & Soundbox Trigger",
    detail:
      "Customer receives a clean WhatsApp invoice with a 1-tap UPI payment link. When they pay, your counter Soundbox announces the exact amount and stock deducts automatically.",
    metric: "0 Manual Typing",
  },
  {
    time: "01:00 – 01:30",
    title: "9 PM Daily Hisab, Udhar Recovery & Mandi Price Alerts",
    detail:
      "At closing time, Munim AI delivers your exact cash vs. UPI profit summary, flags slow-moving stock, and alerts you when nearby APMC mandi wholesale rates dip.",
    metric: "+22% Faster Recovery",
  },
];

const LandingPage: React.FC = () => {
  const [lang, setLang] = useState<"en" | "hi">("en");
  const [activePreset, setActivePreset] = useState<VoicePresetKey>("parchi");
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">(
    "annual",
  );
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [demoModalOpen, setDemoModalOpen] = useState(false);
  const [demoStep, setDemoStep] = useState(0);

  // Onboarding lead form state
  const [storeName, setStoreName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [formError, setFormError] = useState("");
  const [formSubmitted, setFormSubmitted] = useState(false);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDemoModalOpen(false);
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, []);

  const handleOnboardingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanedPhone = phone.replace(/\D/g, "");
    if (!storeName.trim()) {
      setFormError("Please enter your shop or business name.");
      return;
    }
    if (cleanedPhone.length < 10) {
      setFormError("Please enter a valid 10-digit WhatsApp mobile number.");
      return;
    }
    if (!city.trim()) {
      setFormError("Please enter your city or APMC mandi hub.");
      return;
    }
    setFormError("");
    setFormSubmitted(true);
  };

  const preset = VOICE_PRESETS[activePreset];

  const webPageSchema = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "DukaanMitra OS — India's AI WhatsApp Business OS for Retail",
    description:
      "WhatsApp-native AI billing, 14ms handwritten parchi OCR, automated udhaar khata recovery, multi-godown inventory, and mandi intelligence for Indian shopkeepers.",
    url: "https://dukaanmitra.in/",
  };

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ_ITEMS.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.a,
      },
    })),
  };

  return (
    <div className="bg-surface text-on-surface">
      <Helmet>
        <title>
          DukaanMitra — India&apos;s AI WhatsApp Business OS for Retail
        </title>
        <meta
          name="description"
          content="Manage 14ms handwritten parchi OCR billing, WhatsApp Munim AI, digital Bahi-Khata udhaar recovery, multi-godown inventory, and mandi price intelligence offline or online."
        />
        <link rel="canonical" href="https://dukaanmitra.in/" />
        <script type="application/ld+json">
          {JSON.stringify(webPageSchema)}
        </script>
        <script type="application/ld+json">{JSON.stringify(faqSchema)}</script>
      </Helmet>

      {/* 1. HERO SECTION — Blue Gradient + Interactive WhatsApp Raju Munim AI Phone */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#2563eb] via-[#1d4ed8] to-[#1e3a8a] text-white">
        {/* Subtle Architectural Grid Accent */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, #ffffff 1px, transparent 0)",
            backgroundSize: "28px 28px",
          }}
        />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-16 lg:pt-16 lg:pb-24">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
            {/* Hero Left Copy */}
            <div className="lg:col-span-6 space-y-6">
              {/* Eyebrow + Interactive A/अ Language Switcher */}
              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-white/15 backdrop-blur-sm border border-white/20 text-xs font-bold tracking-wide text-white">
                  <Sparkles className="w-3.5 h-3.5 text-tertiary-fixed-dim" />
                  BHARAT FIRST · 14MS LOCAL AI ENGINE
                </span>
                <div
                  role="group"
                  aria-label="Language toggle"
                  className="inline-flex rounded-lg bg-black/25 p-0.5 border border-white/15"
                >
                  <button
                    type="button"
                    onClick={() => setLang("en")}
                    className={`px-2.5 py-1 rounded-md text-xs font-bold transition-colors cursor-pointer ${
                      lang === "en"
                        ? "bg-white text-[#1d4ed8]"
                        : "text-white/80 hover:text-white"
                    }`}
                  >
                    EN
                  </button>
                  <button
                    type="button"
                    onClick={() => setLang("hi")}
                    className={`px-2.5 py-1 rounded-md text-xs font-bold transition-colors cursor-pointer ${
                      lang === "hi"
                        ? "bg-white text-[#1d4ed8]"
                        : "text-white/80 hover:text-white"
                    }`}
                  >
                    हिंग्लिश
                  </button>
                </div>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-[3.35rem] font-extrabold tracking-tight leading-[1.08] text-white">
                {lang === "en"
                  ? "Your Dukaan's AI Munim — Right Inside WhatsApp."
                  : "Aapki Dukaan Ka Smart AI Munim — Seedhe WhatsApp Par."}
              </h1>

              <p className="text-base sm:text-lg text-blue-100 leading-relaxed max-w-xl">
                {lang === "en"
                  ? "Snap a handwritten parchi or speak in Hinglish. DukaanMitra builds GST bills, triggers UPI Soundbox alerts, tracks multi-godown stock, and recovers udhaar—even with zero internet."
                  : "Haath se likhi parchi ki photo kheecho ya Hindi mein bolo. DukaanMitra 14ms mein GST bill, dynamic UPI QR, udhaar reminder aur godown stock sab khud sambhalta hai—bina internet ke bhi."}
              </p>

              {/* Primary & Secondary CTAs */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3.5 pt-1">
                <Link
                  to="/demo"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-tertiary-fixed-dim hover:bg-tertiary-fixed text-on-tertiary-fixed font-extrabold text-sm sm:text-base shadow-lg transition-colors whitespace-nowrap"
                >
                  {lang === "en" ? "Start Free Trial" : "Muft Trial Shuru Karein"}
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setDemoStep(0);
                    setDemoModalOpen(true);
                  }}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-white/12 hover:bg-white/20 border border-white/25 text-white font-bold text-sm sm:text-base backdrop-blur-sm transition-colors whitespace-nowrap cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-current" />
                  Watch 90s Live Demo
                </button>
              </div>

              {/* 4-Item Merchant Trust Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-white/15">
                {[
                  { icon: Zap, label: "14ms Local OCR" },
                  { icon: WifiOff, label: "100% Offline SQLite" },
                  { icon: Languages, label: "12 Indian Dialects" },
                  { icon: ShieldCheck, label: "DPDP Encrypted" },
                ].map(({ icon: Icon, label }) => (
                  <div
                    key={label}
                    className="flex items-center gap-2 text-xs font-semibold text-blue-100"
                  >
                    <Icon className="w-4 h-4 text-tertiary-fixed-dim shrink-0" />
                    <span>{label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Hero Right — Interactive "Raju Munim AI" WhatsApp Phone Frame */}
            <div className="lg:col-span-6 flex flex-col items-center lg:items-end">
              <div className="w-full max-w-md rounded-3xl bg-[#0d131f] p-3 shadow-2xl border border-white/15">
                {/* WhatsApp Top Bar */}
                <div className="rounded-t-2xl bg-[#075E54] px-4 py-3 flex items-center justify-between text-white">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-tertiary-container flex items-center justify-center font-extrabold text-sm">
                      RM
                    </div>
                    <div>
                      <p className="text-sm font-bold leading-tight">
                        Raju Munim AI
                      </p>
                      <p className="text-[11px] text-emerald-200 font-medium">
                        Official Business OS · Online
                      </p>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-md bg-white/15 font-grotesk text-[11px] font-bold tabular-nums">
                    14ms
                  </span>
                </div>

                {/* Chat Body */}
                <div className="bg-[#efe7de] text-on-surface p-3.5 space-y-3 rounded-b-2xl">
                  {/* Handwritten Parchi Bubble */}
                  {activePreset === "parchi" && (
                    <div className="ml-auto max-w-[82%] bg-[#dcf8c6] rounded-2xl rounded-tr-sm p-2 shadow-xs border border-black/5">
                      <div className="relative rounded-xl overflow-hidden aspect-[16/10] bg-slate-200">
                        <img
                          src={parchiScanImg}
                          alt="Handwritten Hindi kirana parchi scanned by DukaanMitra OCR"
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute bottom-1.5 right-1.5 px-2 py-0.5 rounded-md bg-black/75 text-white text-[10px] font-bold flex items-center gap-1">
                          <ScanLine className="w-3 h-3 text-tertiary-fixed-dim" />
                          OCR Parsed
                        </div>
                      </div>
                      <p className="text-[11px] text-slate-700 font-medium mt-1.5 px-1">
                        Iska pakka bill aur UPI QR bana do Raju.
                      </p>
                    </div>
                  )}

                  {/* Voice or Udhar incoming bubble */}
                  {activePreset !== "parchi" && (
                    <div className="ml-auto max-w-[85%] bg-[#dcf8c6] rounded-2xl rounded-tr-sm px-3.5 py-2.5 shadow-xs border border-black/5">
                      <div className="flex items-center gap-2 text-primary font-bold text-xs">
                        {activePreset === "voice" ? (
                          <Mic className="w-3.5 h-3.5" />
                        ) : (
                          <MessageSquare className="w-3.5 h-3.5" />
                        )}
                        <span>{preset.promptTitle}</span>
                      </div>
                    </div>
                  )}

                  {/* Munim AI Structured Invoice / Ledger Card */}
                  <div className="bg-white rounded-2xl rounded-tl-sm p-3.5 shadow-sm border border-outline-variant/30 space-y-2.5">
                    <div className="flex items-start justify-between gap-2 pb-2 border-b border-slate-100">
                      <div>
                        <p className="text-xs font-extrabold text-on-surface">
                          {preset.promptTitle}
                        </p>
                        <p className="text-[11px] text-on-surface-variant">
                          {preset.promptSub}
                        </p>
                      </div>
                      <QrCode className="w-5 h-5 text-primary shrink-0" />
                    </div>

                    <div className="space-y-1.5">
                      {preset.items.map((item) => (
                        <div
                          key={item.name}
                          className="flex items-center justify-between text-xs"
                        >
                          <span className="font-semibold text-on-surface">
                            {item.name}{" "}
                            <span className="text-on-surface-variant font-normal">
                              ({item.qty})
                            </span>
                          </span>
                          <span className="font-grotesk font-bold tabular-nums text-on-surface">
                            {item.price}
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="pt-2 border-t border-dashed border-slate-200 flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                        Total Amount
                      </span>
                      <span className="font-grotesk text-lg font-extrabold text-primary tabular-nums">
                        {preset.total}
                      </span>
                    </div>

                    {/* Soundbox Confirmation Strip */}
                    <div className="rounded-xl bg-surface-container-low px-3 py-2 flex items-center justify-between gap-2 border border-outline-variant/25">
                      <div className="flex items-center gap-2 min-w-0">
                        <Volume2 className="w-4 h-4 text-tertiary shrink-0" />
                        <p className="text-[11px] font-bold text-on-surface truncate">
                          {preset.soundboxText}
                        </p>
                      </div>
                      <CheckCircle2 className="w-4 h-4 text-tertiary shrink-0" />
                    </div>
                  </div>

                  {/* Interactive Preset Switcher Inside Frame */}
                  <div className="pt-1">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1.5 px-1">
                      Try live counter action:
                    </p>
                    <div className="grid grid-cols-3 gap-1.5">
                      {(Object.keys(VOICE_PRESETS) as VoicePresetKey[]).map(
                        (key) => (
                          <button
                            key={key}
                            type="button"
                            onClick={() => setActivePreset(key)}
                            className={`py-2 px-2 rounded-xl text-[11px] font-bold transition-all cursor-pointer ${
                              activePreset === key
                                ? "bg-primary text-white shadow-sm"
                                : "bg-white text-on-surface border border-outline-variant/30 hover:bg-surface-container-low"
                            }`}
                          >
                            {VOICE_PRESETS[key].label}
                          </button>
                        ),
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. SEE HOW IT WORKS — 90s DEMO VIDEO TEASER */}
      <section className="py-16 lg:py-24 bg-surface-container-lowest border-b border-outline-variant/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mx-auto text-center mb-10">
            <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-primary mb-2">
              90-Second Counter Walkthrough
            </p>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-on-surface">
              See How Kirana Owners Cut Billing Time by 70%
            </h2>
            <p className="mt-3 text-base text-on-surface-variant">
              Watch Sharma General Store run morning rush billing, UPI Soundbox
              sync, and automated WhatsApp udhaar reminders from a single phone.
            </p>
          </div>

          <div className="relative rounded-3xl overflow-hidden border border-outline-variant/30 shadow-xl max-w-5xl mx-auto group">
            <div className="aspect-[16/9] w-full bg-slate-900 relative">
              <img
                src={storeDemoHeroImg}
                alt="Indian kirana store owner using DukaanMitra on smartphone at counter"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
              {/* Clean Editorial Scrim */}
              <div className="absolute inset-0 bg-gradient-to-t from-[#0d131f]/85 via-[#0d131f]/35 to-transparent" />

              {/* Center Play Button */}
              <button
                type="button"
                onClick={() => {
                  setDemoStep(0);
                  setDemoModalOpen(true);
                }}
                aria-label="Play 90-second interactive demo"
                className="absolute inset-0 flex flex-col items-center justify-center gap-4 cursor-pointer"
              >
                <span className="w-20 h-20 rounded-full bg-white text-primary flex items-center justify-center shadow-2xl group-hover:scale-105 transition-transform">
                  <Play className="w-8 h-8 fill-current ml-1" />
                </span>
                <span className="px-4 py-1.5 rounded-xl bg-[#0d131f]/80 text-white text-xs sm:text-sm font-bold backdrop-blur-sm border border-white/15">
                  Interactive Counter Walkthrough · 1 min 30 sec
                </span>
              </button>

              {/* Bottom 3-Chapter Strip */}
              <div className="hidden sm:grid absolute bottom-5 inset-x-6 grid-cols-3 gap-3">
                {DEMO_STEPS.map((step, idx) => (
                  <button
                    key={step.time}
                    type="button"
                    onClick={() => {
                      setDemoStep(idx);
                      setDemoModalOpen(true);
                    }}
                    className="text-left p-3.5 rounded-2xl bg-[#0d131f]/75 hover:bg-[#0d131f]/90 backdrop-blur-md border border-white/15 text-white transition-colors cursor-pointer"
                  >
                    <p className="font-grotesk text-[11px] font-bold text-tertiary-fixed-dim tabular-nums">
                      {step.time}
                    </p>
                    <p className="text-xs font-bold mt-0.5 line-clamp-1">
                      {step.title}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. WHY DUKAANMITRA — 4-STEP STORY + LEGACY PC COMPARISON */}
      <section className="py-16 lg:py-24 bg-surface">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mb-12">
            <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-primary mb-2">
              Why DukaanMitra?
            </p>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-on-surface">
              Built for Real Indian Counters — Not Desktop Accountants
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              {
                step: "01 · PROBLEM",
                title: "Lost Parchis & Awkward Udhar",
                body: "Handwritten slips pile up during rush hours, stock vanishes untracked, and asking neighbors for pending udhaar feels uncomfortable.",
                icon: FileText,
              },
              {
                step: "02 · SOLUTION",
                title: "WhatsApp-Native AI Munim",
                body: "Zero software training. Snap any paper parchi or speak in Hinglish—DukaanMitra extracts items, taxes, and customer ledgers automatically.",
                icon: MessageSquare,
              },
              {
                step: "03 · HOW IT WORKS",
                title: "14ms Offline-First Counter Sync",
                body: "Local SQLite engine keeps billing uninterrupted without Wi-Fi, announcing verified UPI payments over your Soundbox immediately.",
                icon: Cpu,
              },
              {
                step: "04 · GROWTH",
                title: "Higher Margin & Faster Cashflow",
                body: "Recover credit 3× faster via polite UPI links and save 4–8% on wholesale replenishment with daily APMC mandi arbitrage alerts.",
                icon: TrendingUp,
              },
            ].map(({ step, title, body, icon: Icon }) => (
              <div
                key={step}
                className="rounded-2xl bg-surface-container-lowest p-6 border border-outline-variant/30 shadow-xs flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="font-grotesk text-xs font-bold tracking-wider text-primary">
                      {step}
                    </span>
                    <div className="w-9 h-9 rounded-xl bg-surface-container-low text-primary flex items-center justify-center">
                      <Icon className="w-4 h-4" />
                    </div>
                  </div>
                  <h3 className="text-lg font-extrabold text-on-surface">
                    {title}
                  </h3>
                  <p className="mt-2.5 text-sm text-on-surface-variant leading-relaxed">
                    {body}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Concise Old PC Software vs DukaanMitra Strip */}
          <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="rounded-2xl bg-surface-container-low p-6 border border-outline-variant/30">
              <p className="text-xs font-extrabold uppercase tracking-wider text-error mb-3">
                Legacy Desktop Billing (Tally / Busy / Marg)
              </p>
              <ul className="space-y-2.5 text-sm text-on-surface-variant">
                <li className="flex items-start gap-2.5">
                  <X className="w-4 h-4 text-error shrink-0 mt-0.5" />
                  <span>
                    Requires ₹35,000+ Windows PC, UPS battery &amp; trained typing
                    operator
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <X className="w-4 h-4 text-error shrink-0 mt-0.5" />
                  <span>
                    Hard-disk crash or ransomware wipes out entire year&apos;s
                    ledger
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <X className="w-4 h-4 text-error shrink-0 mt-0.5" />
                  <span>
                    Zero handwritten parchi reading or 24×7 WhatsApp customer
                    ordering
                  </span>
                </li>
              </ul>
            </div>

            <div className="rounded-2xl bg-surface-container-lowest p-6 border border-primary/30 shadow-xs">
              <p className="text-xs font-extrabold uppercase tracking-wider text-primary mb-3">
                DukaanMitra AI Business OS
              </p>
              <ul className="space-y-2.5 text-sm text-on-surface">
                <li className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-tertiary shrink-0 mt-0.5" />
                  <span>
                    Runs on any ₹7,000 Android phone + WhatsApp with zero setup
                    cost
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-tertiary shrink-0 mt-0.5" />
                  <span>
                    Local SQLite offline engine + encrypted real-time cloud
                    disaster backup
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-tertiary shrink-0 mt-0.5" />
                  <span>
                    14ms handwritten parchi OCR, Soundbox UPI sync &amp;
                    autonomous night runner
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* 4. 6-FEATURE BENTO GRID */}
      <section className="py-16 lg:py-24 bg-surface-container-lowest border-y border-outline-variant/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-12">
            <div className="max-w-2xl">
              <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-primary mb-2">
                6 Pocket Super-Powers
              </p>
              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-on-surface">
                Everything Your Retail Counter Needs in One OS
              </h2>
            </div>
            <Link
              to="/features"
              className="inline-flex items-center gap-1.5 text-sm font-bold text-primary hover:text-primary-container whitespace-nowrap shrink-0"
            >
              Explore Deep Technical Specs
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: ScanLine,
                tag: "14ms Edge Vision",
                title: "Handwritten Parchi OCR & Voice POS",
                desc: "Reads messy Hindi, Marathi, Gujarati & English grocery lists in milliseconds and outputs GST-ready thermal or WhatsApp bills.",
                href: "/features#ocr-voice",
              },
              {
                icon: MessageSquare,
                tag: "24×7 Night Runner",
                title: "Autonomous WhatsApp Munim",
                desc: "Accepts late-night neighborhood orders on WhatsApp, checks live godown stock, and collects advance UPI while your shutter is down.",
                href: "/features#whatsapp-munim",
              },
              {
                icon: IndianRupee,
                tag: "84.2% Recovery Rate",
                title: "0% Awkwardness Udhar Khata",
                desc: "Sends scheduled, polite WhatsApp ledger statements with 1-tap UPI links and reconciles payments into your Bahi-Khata automatically.",
                href: "/features#whatsapp-khata",
              },
              {
                icon: Layers,
                tag: "Real-Time Stock",
                title: "Multi-Store & Central Godown Hub",
                desc: "Track shelf inventory across multiple retail counters and wholesale godowns with instant low-stock reorder triggers.",
                href: "/features#multi-godown",
              },
              {
                icon: Clock,
                tag: "Closing Digest",
                title: "Daily 9 PM Owner Hisab Summary",
                desc: "Get one crisp WhatsApp report every night: Cash in Gala, UPI settlements, GST liability, top sellers, and net daily profit.",
                href: "/analytics",
              },
              {
                icon: TrendingUp,
                tag: "Live APMC Rates",
                title: "Retail Mandi Arbitrage Intelligence",
                desc: "Spot wholesale price drops on Jeera, Mustard Oil, Atta & Dal across nearby APMC mandis before distributors raise margins.",
                href: "/features#mandi-arbitrage",
              },
            ].map(({ icon: Icon, tag, title, desc, href }) => (
              <Link
                key={title}
                to={href}
                className="group rounded-2xl bg-surface p-6 border border-outline-variant/30 hover:border-primary/45 hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-5">
                    <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-colors">
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="font-grotesk text-[11px] font-bold px-2.5 py-1 rounded-md bg-surface-container-low text-on-surface-variant">
                      {tag}
                    </span>
                  </div>
                  <h3 className="text-lg font-extrabold text-on-surface group-hover:text-primary transition-colors">
                    {title}
                  </h3>
                  <p className="mt-2 text-sm text-on-surface-variant leading-relaxed">
                    {desc}
                  </p>
                </div>
                <div className="mt-5 pt-4 border-t border-outline-variant/20 inline-flex items-center gap-1.5 text-xs font-bold text-primary">
                  See how it works
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* 5. WHAT PROBLEM CAN I SOLVE FOR YOU TODAY? */}
      <section className="py-16 lg:py-20 bg-surface">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-on-surface">
              What Problem Can Munim AI Solve for You Today?
            </h2>
            <p className="mt-2 text-sm sm:text-base text-on-surface-variant">
              Pick your biggest counter bottleneck and jump directly into a
              guided workflow.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              {
                title: "Recover Stuck Udhaar Faster",
                desc: "Automate polite WhatsApp UPI payment reminders and cut overdue credit cycles by 60%.",
                cta: "Open Udhaar Engine",
                to: "/udhaar",
                accent: "text-tertiary",
              },
              {
                title: "Stop Stock Pilferage & Expiry Loss",
                desc: "Monitor real-time margin leaks, near-expiry batches, and fast-moving SKUs every night.",
                cta: "Explore Retail Analytics",
                to: "/analytics",
                accent: "text-primary",
              },
              {
                title: "Take Orders on WhatsApp 24×7",
                desc: "Turn your regular WhatsApp number into an automated catalog, billing & delivery desk.",
                cta: "Launch WhatsApp Store",
                to: "/whatsapp-shop-management",
                accent: "text-secondary",
              },
            ].map((card) => (
              <Link
                key={card.title}
                to={card.to}
                className="group rounded-2xl bg-surface-container-lowest p-6 border border-outline-variant/30 hover:border-primary/40 transition-all shadow-xs flex flex-col justify-between"
              >
                <div>
                  <h3 className="text-lg font-extrabold text-on-surface">
                    {card.title}
                  </h3>
                  <p className="mt-2 text-sm text-on-surface-variant leading-relaxed">
                    {card.desc}
                  </p>
                </div>
                <span
                  className={`mt-5 inline-flex items-center gap-1.5 text-sm font-bold ${card.accent}`}
                >
                  {card.cta}
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* 6. JOIN THE FUTURE — FAST-TRACK ONBOARDING FORM */}
      <section id="waitlist" className="py-16 lg:py-20 bg-surface-container-lowest">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="rounded-3xl bg-gradient-to-br from-primary via-primary to-primary-container text-white p-8 sm:p-12 shadow-xl">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              <div className="lg:col-span-6 space-y-4">
                <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-primary-fixed">
                  Fast-Track Merchant Onboarding
                </p>
                <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight leading-tight">
                  Get Your Store Live on WhatsApp in 5 Minutes
                </h2>
                <p className="text-sm sm:text-base text-on-primary-container/90 leading-relaxed">
                  Our local onboarding specialist will import your starter stock
                  list, configure your GST header, and send a live demo parchi
                  to your WhatsApp.
                </p>
                <div className="flex flex-wrap gap-4 pt-2 text-xs font-bold text-primary-fixed">
                  <span className="inline-flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" /> Zero Setup Fee
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" /> Free Stock Migration
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" /> Cancel Anytime
                  </span>
                </div>
              </div>

              <div className="lg:col-span-6">
                {formSubmitted ? (
                  <div className="rounded-2xl bg-white text-on-surface p-6 sm:p-8 shadow-lg space-y-4">
                    <div className="w-12 h-12 rounded-2xl bg-tertiary/10 text-tertiary flex items-center justify-center">
                      <CheckCircle2 className="w-7 h-7" />
                    </div>
                    <h3 className="text-xl font-extrabold">
                      Onboarding Reserved for {storeName}
                    </h3>
                    <p className="text-sm text-on-surface-variant leading-relaxed">
                      We&apos;ve queued your WhatsApp setup for{" "}
                      <strong className="font-grotesk tabular-nums">
                        +91 {phone.replace(/\D/g, "").slice(-10)}
                      </strong>{" "}
                      in <strong>{city}</strong>. You can also try the
                      interactive counter simulator right now.
                    </p>
                    <div className="flex flex-wrap gap-3 pt-2">
                      <Link
                        to="/demo"
                        className="px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary-container transition-colors"
                      >
                        Launch Live Simulator
                      </Link>
                      <button
                        type="button"
                        onClick={() => {
                          setFormSubmitted(false);
                          setStoreName("");
                          setPhone("");
                          setCity("");
                        }}
                        className="px-4 py-2.5 rounded-xl border border-outline-variant/40 text-on-surface text-sm font-semibold hover:bg-surface-container-low cursor-pointer"
                      >
                        Register Another Branch
                      </button>
                    </div>
                  </div>
                ) : (
                  <form
                    onSubmit={handleOnboardingSubmit}
                    noValidate
                    className="rounded-2xl bg-white text-on-surface p-6 sm:p-7 shadow-lg space-y-4"
                  >
                    <div>
                      <label
                        htmlFor="onboard-store"
                        className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5"
                      >
                        Shop / Business Name
                      </label>
                      <input
                        id="onboard-store"
                        type="text"
                        value={storeName}
                        onChange={(e) => setStoreName(e.target.value)}
                        placeholder="e.g. Sharma General & Kirana Store"
                        className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/40 text-sm font-medium focus:outline-none focus:border-primary"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="onboard-phone"
                        className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5"
                      >
                        WhatsApp Mobile Number
                      </label>
                      <div className="flex">
                        <span className="inline-flex items-center px-3.5 rounded-l-xl bg-surface-container border border-r-0 border-outline-variant/40 font-grotesk text-sm font-bold text-on-surface-variant">
                          +91
                        </span>
                        <input
                          id="onboard-phone"
                          type="tel"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="98765 43210"
                          className="w-full px-4 py-3 rounded-r-xl bg-surface-container-low border border-outline-variant/40 font-grotesk text-sm font-medium focus:outline-none focus:border-primary"
                        />
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor="onboard-city"
                        className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5"
                      >
                        City / APMC Mandi Hub
                      </label>
                      <input
                        id="onboard-city"
                        type="text"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        placeholder="e.g. Jaipur, Pune, Indore, Kanpur"
                        className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/40 text-sm font-medium focus:outline-none focus:border-primary"
                      />
                    </div>

                    {formError && (
                      <p
                        role="alert"
                        className="text-xs font-bold text-error bg-error-container/60 px-3 py-2 rounded-lg"
                      >
                        {formError}
                      </p>
                    )}

                    <button
                      type="submit"
                      className="w-full py-3.5 px-5 rounded-xl bg-primary hover:bg-primary-container text-white font-extrabold text-sm shadow-sm transition-colors cursor-pointer flex items-center justify-center gap-2"
                    >
                      Get Instant WhatsApp Setup
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 7. DARK "THE MUNIM FLOW" 4-STEP ARCHITECTURE */}
      <section className="py-16 lg:py-24 bg-[#0d131f] text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mb-12">
            <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-tertiary-fixed-dim mb-2">
              The Munim Flow
            </p>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
              From Paper Parchi to Settled Bank Balance in 4 Automatic Steps
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              {
                num: "01",
                title: "Speak or Snap Parchi",
                desc: "Capture handwritten lists, barcode packs, or Hindi voice notes directly in WhatsApp.",
              },
              {
                num: "02",
                title: "14ms Local SLM Parse",
                desc: "On-device retail model matches SKUs, units, local pricing & GST slabs with 99.2% accuracy.",
              },
              {
                num: "03",
                title: "Bill + Soundbox UPI",
                desc: "Instant WhatsApp receipt + dynamic UPI QR triggers live payment audio on your counter.",
              },
              {
                num: "04",
                title: "Auto-Sync Khata & Stock",
                desc: "Deducts godown stock, updates Bahi-Khata, and queues encrypted SQLite cloud sync.",
              },
            ].map((step) => (
              <div
                key={step.num}
                className="rounded-2xl bg-white/[0.04] border border-white/10 p-6 flex flex-col justify-between"
              >
                <div>
                  <span className="font-grotesk text-3xl font-extrabold text-tertiary-fixed-dim tabular-nums">
                    {step.num}
                  </span>
                  <h3 className="mt-4 text-lg font-extrabold text-white">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-sm text-slate-300 leading-relaxed">
                    {step.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-10 pt-8 border-t border-white/10 grid grid-cols-2 lg:grid-cols-4 gap-6 text-center sm:text-left">
            {[
              { val: "14ms", label: "Local Parchi OCR Latency" },
              { val: "99.98%", label: "Offline Ledger Durability" },
              { val: "84.2%", label: "7-Day Udhar Recovery Rate" },
              { val: "₹0", label: "Extra Hardware Required" },
            ].map((stat) => (
              <div key={stat.label}>
                <p className="font-grotesk text-2xl sm:text-3xl font-extrabold text-white tabular-nums">
                  {stat.val}
                </p>
                <p className="text-xs text-slate-400 font-medium mt-1">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 8. TRANSPARENT PRICING (MONTHLY / ANNUAL SAVE 20%) */}
      <section className="py-16 lg:py-24 bg-surface">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-primary mb-2">
              Honest Bharat Pricing
            </p>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-on-surface">
              Start Free Forever. Scale When Your Counter Grows.
            </h2>

            {/* Billing Cycle Switcher */}
            <div className="mt-6 inline-flex items-center p-1 rounded-xl bg-surface-container border border-outline-variant/30">
              <button
                type="button"
                onClick={() => setBillingCycle("monthly")}
                className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-colors cursor-pointer ${
                  billingCycle === "monthly"
                    ? "bg-surface-container-lowest text-on-surface shadow-xs"
                    : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => setBillingCycle("annual")}
                className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-colors flex items-center gap-2 cursor-pointer ${
                  billingCycle === "annual"
                    ? "bg-primary text-white shadow-xs"
                    : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                Annual
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold ${
                    billingCycle === "annual"
                      ? "bg-white/20 text-white"
                      : "bg-tertiary/15 text-tertiary"
                  }`}
                >
                  Save 20%
                </span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
            {/* Tier 1: Free Forever */}
            <div className="rounded-3xl bg-surface-container-lowest p-7 border border-outline-variant/30 flex flex-col justify-between">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-wider text-on-surface-variant">
                  Starter Counter
                </p>
                <h3 className="text-xl font-extrabold text-on-surface mt-1">
                  Free Forever
                </h3>
                <div className="mt-5 flex items-baseline gap-1">
                  <span className="font-grotesk text-4xl font-extrabold text-on-surface tabular-nums">
                    ₹0
                  </span>
                  <span className="text-sm text-on-surface-variant font-medium">
                    / month
                  </span>
                </div>
                <p className="mt-2 text-xs text-on-surface-variant">
                  Ideal for neighborhood kiranas digitizing daily bills &amp;
                  khata.
                </p>
                <ul className="mt-6 space-y-3 text-sm text-on-surface">
                  {[
                    "Up to 150 WhatsApp bills / month",
                    "Digital Bahi-Khata & UPI links",
                    "Basic handwritten parchi OCR",
                    "100% offline SQLite backup",
                  ].map((feat) => (
                    <li key={feat} className="flex items-center gap-2.5">
                      <Check className="w-4 h-4 text-tertiary shrink-0" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <Link
                to="/demo"
                className="mt-8 block w-full text-center py-3 px-4 rounded-xl border border-primary/40 text-primary hover:bg-primary/5 font-bold text-sm transition-colors"
              >
                Start Free Now
              </Link>
            </div>

            {/* Tier 2: Dukaan Pro (Popular) */}
            <div className="rounded-3xl bg-surface-container-lowest p-7 border-2 border-primary shadow-lg relative flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-extrabold uppercase tracking-wider text-primary">
                    Most Popular
                  </p>
                  <span className="px-2.5 py-0.5 rounded-md bg-primary/10 text-primary text-[11px] font-extrabold">
                    Best Value
                  </span>
                </div>
                <h3 className="text-xl font-extrabold text-on-surface mt-1">
                  Dukaan Pro
                </h3>
                <div className="mt-5 flex items-baseline gap-1.5">
                  <span className="font-grotesk text-4xl font-extrabold text-on-surface tabular-nums">
                    {billingCycle === "annual" ? "₹239" : "₹299"}
                  </span>
                  <span className="text-sm text-on-surface-variant font-medium">
                    / month
                  </span>
                  {billingCycle === "annual" && (
                    <span className="text-xs text-on-surface-variant line-through font-grotesk tabular-nums ml-1">
                      ₹299
                    </span>
                  )}
                </div>
                <p className="mt-2 text-xs text-on-surface-variant">
                  Full AI Munim automation for busy kiranas, pharmacies &amp;
                  supermarts.
                </p>
                <ul className="mt-6 space-y-3 text-sm text-on-surface">
                  {[
                    "Unlimited 14ms Parchi OCR & Voice POS",
                    "24×7 Autonomous WhatsApp Night Runner",
                    "Automated Udhar UPI recovery reminders",
                    "GST GSTR-1 & GSTR-3B export ready",
                    "Dynamic UPI QR + Soundbox audio sync",
                  ].map((feat) => (
                    <li key={feat} className="flex items-center gap-2.5">
                      <Check className="w-4 h-4 text-primary shrink-0" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <Link
                to="/pricing"
                className="mt-8 block w-full text-center py-3.5 px-4 rounded-xl bg-primary hover:bg-primary-container text-white font-extrabold text-sm shadow-sm transition-colors"
              >
                Activate Dukaan Pro
              </Link>
            </div>

            {/* Tier 3: Omni Enterprise */}
            <div className="rounded-3xl bg-surface-container-lowest p-7 border border-outline-variant/30 flex flex-col justify-between">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-wider text-on-surface-variant">
                  Wholesalers &amp; Chains
                </p>
                <h3 className="text-xl font-extrabold text-on-surface mt-1">
                  Omni Enterprise
                </h3>
                <div className="mt-5 flex items-baseline gap-1.5">
                  <span className="font-grotesk text-4xl font-extrabold text-on-surface tabular-nums">
                    {billingCycle === "annual" ? "₹719" : "₹899"}
                  </span>
                  <span className="text-sm text-on-surface-variant font-medium">
                    / month
                  </span>
                  {billingCycle === "annual" && (
                    <span className="text-xs text-on-surface-variant line-through font-grotesk tabular-nums ml-1">
                      ₹899
                    </span>
                  )}
                </div>
                <p className="mt-2 text-xs text-on-surface-variant">
                  For multi-branch retail chains, APMC traders &amp; central
                  godowns.
                </p>
                <ul className="mt-6 space-y-3 text-sm text-on-surface">
                  {[
                    "Everything in Dukaan Pro",
                    "Unlimited branches & central godown sync",
                    "Live APMC Mandi Arbitrage price feed",
                    "Staff roles, cash drawer audits & API",
                    "Dedicated Hindi/English phone onboarding",
                  ].map((feat) => (
                    <li key={feat} className="flex items-center gap-2.5">
                      <Check className="w-4 h-4 text-tertiary shrink-0" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <Link
                to="/contact"
                className="mt-8 block w-full text-center py-3 px-4 rounded-xl bg-on-surface hover:bg-inverse-surface text-white font-bold text-sm transition-colors"
              >
                Talk to Enterprise Team
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 9. REAL STORIES FROM NEIGHBORHOOD KIRANAS */}
      <section className="py-16 lg:py-24 bg-surface-container-lowest border-y border-outline-variant/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mb-12">
            <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-primary mb-2">
              Merchant Voices Across India
            </p>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-on-surface">
              Real Stories from Neighborhood Kiranas
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                img: merchantJaipurImg,
                name: "Rajesh Sharma",
                shop: "Sharma General Store · Jaipur",
                metric: "₹1.4L Udhar Recovered in 18 Days",
                quote:
                  "Pehle shaam ko 2 ghante parchi jodne mein lagte the. Ab customer ke saamne hi photo kheechta hoon, bill WhatsApp par chala jata hai aur Soundbox bol deta hai.",
              },
              {
                img: merchantPuneImg,
                name: "Sunita Deshmukh",
                shop: "Mahalaxmi Supermart · Pune",
                metric: "3× Faster Evening Rush Billing",
                quote:
                  "My staff didn't need computer training at all. Even when our broadband drops during monsoon, DukaanMitra keeps billing offline and syncs my 9 PM hisab automatically.",
              },
              {
                img: merchantIndoreImg,
                name: "Ankit Agrawal",
                shop: "Agrawal Kirana & Wholesale · Indore",
                metric: "+5.8% Margin via Mandi Alerts",
                quote:
                  "Tracking our main shop and godown stock used to mean constant phone calls. Now I see exact bags of atta and oil live, plus APMC rate alerts save us thousands every week.",
              },
            ].map((story) => (
              <article
                key={story.name}
                className="rounded-2xl bg-surface p-6 border border-outline-variant/30 flex flex-col justify-between"
              >
                <div>
                  <span className="inline-block font-grotesk text-xs font-bold px-2.5 py-1 rounded-md bg-tertiary/10 text-tertiary mb-4">
                    {story.metric}
                  </span>
                  <p className="text-sm text-on-surface leading-relaxed">
                    &ldquo;{story.quote}&rdquo;
                  </p>
                </div>

                <div className="mt-6 pt-5 border-t border-outline-variant/20 flex items-center gap-3.5">
                  <img
                    src={story.img}
                    alt={`${story.name} — ${story.shop}`}
                    referrerPolicy="no-referrer"
                    className="w-12 h-12 rounded-full object-cover object-top border border-outline-variant/40 shrink-0"
                  />
                  <div>
                    <p className="text-sm font-extrabold text-on-surface">
                      {story.name}
                    </p>
                    <p className="text-xs text-on-surface-variant">
                      {story.shop}
                    </p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* 10. NATIVE ANDROID / OFFLINE SQLITE DARK BANNER */}
      <section className="py-16 lg:py-20 bg-surface">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="rounded-3xl bg-[#0d131f] text-white p-8 sm:p-12 border border-white/10">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              <div className="lg:col-span-7 space-y-4">
                <span className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-tertiary-fixed-dim">
                  <Smartphone className="w-4 h-4" />
                  Android App &amp; Desktop PWA
                </span>
                <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
                  Zero-Internet Counter Continuity with Local SQLite Engine
                </h2>
                <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-2xl">
                  Install DukaanMitra on your counter phone or Windows browser.
                  All bills, GST slabs, and stock ledgers are cached locally in
                  an encrypted SQLite database and reconciled automatically via
                  CRDT sync.
                </p>
                <div className="flex flex-wrap gap-3 pt-2">
                  <Link
                    to="/android-app"
                    className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-tertiary-fixed-dim hover:bg-tertiary-fixed text-on-tertiary-fixed font-extrabold text-sm transition-colors"
                  >
                    Get Android &amp; PWA App
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                  <Link
                    to="/downloads"
                    className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white font-bold text-sm transition-colors"
                  >
                    Download Brochures &amp; CSVs
                  </Link>
                </div>
              </div>

              <div className="lg:col-span-5">
                <div className="rounded-2xl bg-white/[0.05] border border-white/10 p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <Database className="w-5 h-5 text-tertiary-fixed-dim" />
                      <span className="text-sm font-bold">
                        Local SQLite Vault
                      </span>
                    </div>
                    <span className="font-grotesk text-xs font-bold text-tertiary-fixed-dim">
                      AES-256
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-black/30 p-3.5 border border-white/5">
                      <p className="text-[11px] text-slate-400">
                        Offline Queue
                      </p>
                      <p className="font-grotesk text-lg font-extrabold text-white tabular-nums mt-0.5">
                        0 Pending
                      </p>
                    </div>
                    <div className="rounded-xl bg-black/30 p-3.5 border border-white/5">
                      <p className="text-[11px] text-slate-400">
                        Recovery Point
                      </p>
                      <p className="font-grotesk text-lg font-extrabold text-tertiary-fixed-dim tabular-nums mt-0.5">
                        Instant
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-300">
                    <Lock className="w-4 h-4 text-primary-fixed-dim shrink-0" />
                    <span>
                      Phone lost or broken? Log in on a new phone and restore
                      100% of your Bahi-Khata in 8 seconds.
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 11. INTERACTIVE FAQ ACCORDION */}
      <section className="py-16 lg:py-24 bg-surface-container-lowest border-t border-outline-variant/20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-primary mb-2">
              Common Questions
            </p>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-on-surface">
              Everything Merchants Ask Before Switching
            </h2>
          </div>

          <div className="space-y-3">
            {FAQ_ITEMS.map((item, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div
                  key={item.q}
                  className="rounded-2xl bg-surface border border-outline-variant/30 overflow-hidden"
                >
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    className="w-full px-6 py-4.5 text-left flex items-center justify-between gap-4 font-bold text-sm sm:text-base text-on-surface hover:text-primary transition-colors cursor-pointer"
                  >
                    <span>{item.q}</span>
                    <ChevronDown
                      className={`w-5 h-5 text-on-surface-variant shrink-0 transition-transform duration-200 ${
                        isOpen ? "rotate-180 text-primary" : ""
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-6 pb-5 text-sm text-on-surface-variant leading-relaxed border-t border-outline-variant/15 pt-3.5">
                      {item.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 12. BOTTOM CONVERSION CTA BANNER */}
      <section className="py-16 lg:py-20 bg-gradient-to-r from-[#1e3a8a] via-[#1d4ed8] to-primary text-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-5">
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-primary-fixed">
            Jahan Inventory, Wahan DukaanMitra.
          </p>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight">
            Ready to Run Your Shop Like a Modern Retail OS?
          </h2>
          <p className="text-base text-blue-100 max-w-2xl mx-auto">
            Join Indian kiranas, pharmacies, and wholesale counters saving 2+
            hours daily on billing, udhaar recovery, and stock tallying.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 pt-3">
            <Link
              to="/demo"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl bg-tertiary-fixed-dim hover:bg-tertiary-fixed text-on-tertiary-fixed font-extrabold text-sm sm:text-base shadow-lg transition-colors"
            >
              <Store className="w-4 h-4" />
              Start Free Counter Trial
            </Link>
            <Link
              to="/features"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl bg-white/12 hover:bg-white/20 border border-white/25 text-white font-bold text-sm sm:text-base transition-colors"
            >
              Explore All 12+ Features
            </Link>
          </div>
        </div>
      </section>

      {/* 13. INTERACTIVE 90-SECOND DEMO WALKTHROUGH MODAL */}
      {demoModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="90-second interactive DukaanMitra walkthrough"
          className="fixed inset-0 z-[250] flex items-center justify-center p-4"
        >
          <div
            className="absolute inset-0 bg-[#0d131f]/75 backdrop-blur-xs"
            onClick={() => setDemoModalOpen(false)}
          />
          <div className="relative z-10 w-full max-w-2xl rounded-3xl bg-surface-container-lowest text-on-surface shadow-2xl border border-outline-variant/30 overflow-hidden">
            <div className="px-6 py-4 bg-[#0d131f] text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Play className="w-4 h-4 text-tertiary-fixed-dim fill-current" />
                <span className="text-sm font-extrabold">
                  90-Second Counter Walkthrough
                </span>
              </div>
              <button
                type="button"
                aria-label="Close demo modal"
                onClick={() => setDemoModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Step selector tabs */}
              <div className="grid grid-cols-3 gap-2">
                {DEMO_STEPS.map((step, idx) => (
                  <button
                    key={step.time}
                    type="button"
                    onClick={() => setDemoStep(idx)}
                    className={`p-3 rounded-xl text-left border transition-colors cursor-pointer ${
                      demoStep === idx
                        ? "bg-primary/10 border-primary text-primary"
                        : "bg-surface-container-low border-outline-variant/25 text-on-surface-variant hover:text-on-surface"
                    }`}
                  >
                    <p className="font-grotesk text-[11px] font-bold tabular-nums">
                      {step.time}
                    </p>
                    <p className="text-xs font-extrabold mt-0.5 line-clamp-1">
                      Step {idx + 1}
                    </p>
                  </button>
                ))}
              </div>

              {/* Active step visual + details */}
              <div className="rounded-2xl bg-surface p-5 border border-outline-variant/25 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-grotesk text-xs font-bold px-2.5 py-1 rounded-md bg-tertiary/10 text-tertiary">
                    {DEMO_STEPS[demoStep].metric}
                  </span>
                  <span className="font-grotesk text-xs text-on-surface-variant tabular-nums">
                    Chapter {demoStep + 1} of {DEMO_STEPS.length}
                  </span>
                </div>
                <h3 className="text-xl font-extrabold text-on-surface">
                  {DEMO_STEPS[demoStep].title}
                </h3>
                <p className="text-sm text-on-surface-variant leading-relaxed">
                  {DEMO_STEPS[demoStep].detail}
                </p>
                <div className="rounded-xl overflow-hidden aspect-[16/9] bg-slate-900 border border-outline-variant/25">
                  <img
                    src={demoStep === 0 ? parchiScanImg : storeDemoHeroImg}
                    alt={DEMO_STEPS[demoStep].title}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={demoStep === 0}
                    onClick={() => setDemoStep((s) => Math.max(0, s - 1))}
                    className="px-4 py-2 rounded-xl border border-outline-variant/40 text-xs font-bold text-on-surface disabled:opacity-40 cursor-pointer"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setDemoStep((s) =>
                        s < DEMO_STEPS.length - 1 ? s + 1 : 0,
                      )
                    }
                    className="px-4 py-2 rounded-xl bg-surface-container-low text-xs font-bold text-primary hover:bg-surface-container cursor-pointer"
                  >
                    {demoStep < DEMO_STEPS.length - 1
                      ? "Next Chapter"
                      : "Replay from Start"}
                  </button>
                </div>

                <Link
                  to="/demo"
                  onClick={() => setDemoModalOpen(false)}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-container text-white text-xs sm:text-sm font-extrabold transition-colors"
                >
                  Try Live WhatsApp Simulator
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LandingPage;
