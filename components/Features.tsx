import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import {
  ArrowRight,
  Barcode,
  Building2,
  Check,
  CheckCircle2,
  ChevronRight,
  Cpu,
  Database,
  IndianRupee,
  Layers,
  Mic,
  Moon,
  Printer,
  QrCode,
  RefreshCw,
  ScanLine,
  ShieldCheck,
  Store,
  TrendingDown,
  TrendingUp,
  Volume2,
  WifiOff,
  X,
  Zap,
} from "lucide-react";
import parchiScanImg from "../src/assets/images/parchi_handwritten_scan_1795748117883.jpg";

type HardwareCategory = "all" | "printers" | "soundboxes" | "scanners";

interface HardwareItem {
  name: string;
  category: Exclude<HardwareCategory, "all">;
  protocol: string;
  spec: string;
  status: string;
}

const HARDWARE_ITEMS: HardwareItem[] = [
  {
    name: "58mm & 80mm Bluetooth Thermal Printers",
    category: "printers",
    protocol: "ESC/POS · BLE 5.0",
    spec: "Zero-driver pairing with Rugtek, TVS, Epson & generic Bharat thermal printers.",
    status: "Plug & Print",
  },
  {
    name: "USB OTG Counter Billing Printers",
    category: "printers",
    protocol: "USB-C / Direct Raw",
    spec: "Prints bilingual Hindi + English GST receipts with embedded dynamic UPI QR.",
    status: "Auto-Detect",
  },
  {
    name: "Paytm / PhonePe / BharatPe Soundboxes",
    category: "soundboxes",
    protocol: "Dynamic UPI Intent",
    spec: "Reconciles exact bill amount with payment confirmation in under 2 seconds.",
    status: "Verified Sync",
  },
  {
    name: "DukaanMitra Counter Audio Bridge",
    category: "soundboxes",
    protocol: "Local Bluetooth Speaker",
    spec: "Turns any ₹499 counter speaker into a Hindi/English payment & stock announcer.",
    status: "Zero Rental Fee",
  },
  {
    name: "2D Wireless & USB Barcode Guns",
    category: "scanners",
    protocol: "HID Keyboard · 2.4GHz",
    spec: "Scans FMCG EAN-13, pharmacy batch codes & custom loose-weight kirana stickers.",
    status: "Instant SKU Match",
  },
  {
    name: "Smartphone Camera Parchi & Barcode Lens",
    category: "scanners",
    protocol: "On-Device Edge Vision",
    spec: "Reads handwritten slips & damaged barcodes directly with your phone camera.",
    status: "14ms Local OCR",
  },
];

const ANCHOR_NAV = [
  { id: "all", label: "All Features", target: "ocr-voice" },
  { id: "ocr-voice", label: "Billing & OCR", target: "ocr-voice" },
  { id: "whatsapp-khata", label: "WhatsApp & Khata", target: "whatsapp-munim" },
  { id: "multi-godown", label: "Multi-Godown", target: "multi-godown" },
  { id: "mandi-arbitrage", label: "Mandi Arbitrage", target: "mandi-arbitrage" },
  { id: "offline-ai", label: "Offline SQLite Sync", target: "offline-ai" },
  { id: "matrix", label: "Platform Comparison", target: "matrix" },
];

const BRANCH_STOCK = [
  {
    id: "main",
    name: "Main Kirana Counter",
    location: "Johari Bazar",
    attaBags: 42,
    oilTins: 18,
    status: "Healthy",
  },
  {
    id: "station",
    name: "Station Road Branch",
    location: "Sindhi Camp",
    attaBags: 7,
    oilTins: 5,
    status: "Low Stock Alert",
  },
  {
    id: "godown",
    name: "APMC Central Godown",
    location: "Surajpol Mandi",
    attaBags: 310,
    oilTins: 124,
    status: "Dispatch Ready",
  },
];

const Features: React.FC = () => {
  const [activeAnchor, setActiveAnchor] = useState("all");
  const [hardwareTab, setHardwareTab] = useState<HardwareCategory>("all");
  const [dispatched, setDispatched] = useState(false);

  const filteredHardware =
    hardwareTab === "all"
      ? HARDWARE_ITEMS
      : HARDWARE_ITEMS.filter((item) => item.category === hardwareTab);

  const handleAnchorClick = (id: string, target: string) => {
    setActiveAnchor(id);
    const el = document.getElementById(target);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: "https://dukaanmitra.in/",
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Features & Capabilities",
        item: "https://dukaanmitra.in/features",
      },
    ],
  };

  return (
    <div className="bg-surface text-on-surface">
      <Helmet>
        <title>
          DukaanMitra Features — 14ms Parchi OCR, WhatsApp Munim &amp; Offline
          Retail OS
        </title>
        <meta
          name="description"
          content="Explore DukaanMitra's 14ms handwritten parchi OCR, 24x7 autonomous WhatsApp Munim, 0% awkwardness Udhaar recovery, multi-godown inventory, APMC mandi arbitrage, and local SQLite offline sync."
        />
        <link rel="canonical" href="https://dukaanmitra.in/features" />
        <script type="application/ld+json">
          {JSON.stringify(breadcrumbSchema)}
        </script>
      </Helmet>

      {/* BREADCRUMB STRIP */}
      <div className="bg-surface-container-lowest border-b border-outline-variant/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center gap-2 text-xs font-semibold text-on-surface-variant">
          <Link to="/" className="hover:text-primary transition-colors">
            Home
          </Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-on-surface font-bold">
            Capabilities &amp; Engine Architecture
          </span>
        </div>
      </div>

      {/* HERO SECTION + LIVE COUNTER HUD */}
      <section className="py-14 lg:py-20 bg-gradient-to-b from-surface-container-low to-surface border-b border-outline-variant/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            <div className="lg:col-span-7 space-y-5">
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-primary/10 text-primary text-xs font-extrabold uppercase tracking-wider">
                <Cpu className="w-3.5 h-3.5" />
                MitraOS v4 · Retail Intelligence Engine
              </span>
              <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight leading-[1.08] text-on-surface">
                Engineered for 12 Million Indian Counters
              </h1>
              <p className="text-base sm:text-lg text-on-surface-variant leading-relaxed max-w-2xl">
                Built from the ground up for noisy kirana counters, handwritten
                Hindi parchis, intermittent 4G networks, and multi-godown
                wholesale cashflows—without forcing shopkeepers onto legacy PC
                accounting forms.
              </p>
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <Link
                  to="/demo"
                  className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-primary hover:bg-primary-container text-white text-sm font-extrabold shadow-sm transition-colors"
                >
                  Launch Interactive Counter Demo
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  to="/pricing"
                  className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-surface-container-lowest hover:bg-surface-container-low border border-outline-variant/40 text-on-surface text-sm font-bold transition-colors"
                >
                  Compare Plans
                </Link>
              </div>
            </div>

            {/* Live Counter HUD Card */}
            <div className="lg:col-span-5">
              <div className="rounded-3xl bg-[#0d131f] text-white p-6 shadow-xl border border-white/10 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-white/10">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-slate-300">
                    Live Counter Telemetry
                  </span>
                  <span className="font-grotesk text-xs font-bold px-2.5 py-0.5 rounded-md bg-tertiary/25 text-tertiary-fixed-dim">
                    OFFLINE-READY
                  </span>
                </div>

                <div className="space-y-3">
                  <div className="rounded-2xl bg-white/[0.05] p-4 border border-white/10 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-primary/30 text-primary-fixed flex items-center justify-center shrink-0">
                        <ScanLine className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-white">
                          Parchi Scan #8902
                        </p>
                        <p className="text-[11px] text-slate-400">
                          4 SKUs · Hindi + English parsed
                        </p>
                      </div>
                    </div>
                    <span className="font-grotesk text-sm font-extrabold text-tertiary-fixed-dim tabular-nums">
                      14ms
                    </span>
                  </div>

                  <div className="rounded-2xl bg-white/[0.05] p-4 border border-white/10 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-tertiary/30 text-tertiary-fixed-dim flex items-center justify-center shrink-0">
                        <Volume2 className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-white">
                          Soundbox Dynamic UPI
                        </p>
                        <p className="text-[11px] text-slate-400">
                          Auto-reconciled to Cashbook
                        </p>
                      </div>
                    </div>
                    <span className="font-grotesk text-sm font-extrabold text-white tabular-nums">
                      ₹1,435.00
                    </span>
                  </div>

                  <div className="rounded-2xl bg-white/[0.05] p-4 border border-white/10 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-secondary-container/25 text-secondary-fixed-dim flex items-center justify-center shrink-0">
                        <TrendingDown className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-white">
                          Surajpol Mandi Arbitrage
                        </p>
                        <p className="text-[11px] text-slate-400">
                          Jeera wholesale dip detected
                        </p>
                      </div>
                    </div>
                    <span className="font-grotesk text-sm font-extrabold text-secondary-fixed-dim tabular-nums">
                      -3.4%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* STICKY SECTION ANCHOR NAVIGATION */}
      <div className="sticky top-20 z-40 bg-surface-container-lowest/95 backdrop-blur-md border-b border-outline-variant/25">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-2 min-w-max">
            {ANCHOR_NAV.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleAnchorClick(item.id, item.target)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                  activeAnchor === item.id
                    ? "bg-primary text-white shadow-xs"
                    : "bg-surface-container-low text-on-surface-variant hover:text-primary"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* FEATURE 1: 14MS HANDWRITTEN PARCHI OCR & DUAL-DIALECT VOICE POS */}
      <section
        id="ocr-voice"
        className="scroll-mt-36 py-16 lg:py-24 bg-surface-container-lowest border-b border-outline-variant/20"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            <div className="lg:col-span-6 space-y-5">
              <span className="font-grotesk text-xs font-bold uppercase tracking-wider text-primary">
                01 · Edge Vision &amp; Speech Engine
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-on-surface">
                14ms Handwritten Parchi OCR &amp; Dual-Dialect Voice POS
              </h2>
              <p className="text-base text-on-surface-variant leading-relaxed">
                Customers hand over crumpled Hindi/English lists during morning
                rush. Instead of typing 18 SKU codes on a keyboard, snap one
                photo or speak naturally—our on-device Small Language Model
                matches local units (pau, dhai-so gram, peti) directly to your
                shelf rates.
              </p>

              {/* Voice Snippet Callout */}
              <div className="rounded-2xl bg-surface-container-low p-4 border border-outline-variant/30 flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center shrink-0">
                  <Mic className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-extrabold uppercase tracking-wider text-primary">
                    Natural Hinglish Voice Command
                  </p>
                  <p className="text-sm font-bold text-on-surface mt-0.5">
                    &ldquo;Verma ji ke 10 kilo Aashirvaad atta, 2 liter Fortune
                    sarso tel aur 3 kilo toor dal bill banao&rdquo;
                  </p>
                </div>
              </div>

              {/* Legacy vs SLM Micro-Comparison */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2">
                <div className="rounded-xl bg-surface p-4 border border-outline-variant/30">
                  <p className="text-xs font-bold text-error uppercase">
                    Manual PC Typing
                  </p>
                  <p className="font-grotesk text-2xl font-extrabold text-on-surface tabular-nums mt-1">
                    2 min 45 sec
                  </p>
                  <p className="text-xs text-on-surface-variant mt-0.5">
                    Per 12-item handwritten kirana slip
                  </p>
                </div>
                <div className="rounded-xl bg-primary/5 p-4 border border-primary/30">
                  <p className="text-xs font-bold text-primary uppercase">
                    DukaanMitra Local SLM
                  </p>
                  <p className="font-grotesk text-2xl font-extrabold text-primary tabular-nums mt-1">
                    14ms Parse
                  </p>
                  <p className="text-xs text-on-surface-variant mt-0.5">
                    99.2% accuracy · Works offline
                  </p>
                </div>
              </div>
            </div>

            {/* Right: Parchi Parsing Pipeline Visual */}
            <div className="lg:col-span-6">
              <div className="rounded-3xl bg-surface p-5 sm:p-6 border border-outline-variant/30 shadow-md space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                  <div className="rounded-2xl overflow-hidden border border-outline-variant/30 bg-slate-100 aspect-[4/3] relative">
                    <img
                      src={parchiScanImg}
                      alt="Handwritten Hindi kirana grocery parchi ready for OCR parsing"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                    <span className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-lg bg-[#0d131f]/80 text-white text-[11px] font-bold">
                      Raw Paper Input
                    </span>
                  </div>

                  <div className="rounded-2xl bg-surface-container-lowest p-4 border border-primary/25 space-y-2.5">
                    <div className="flex items-center justify-between pb-2 border-b border-outline-variant/20">
                      <span className="text-xs font-extrabold text-primary">
                        Structured GST Bill
                      </span>
                      <QrCode className="w-4 h-4 text-primary" />
                    </div>
                    {[
                      ["Aashirvaad Atta 10kg", "₹465"],
                      ["Fortune Oil 2L", "₹340"],
                      ["Toor Dal 3kg", "₹495"],
                      ["Tata Salt ×5", "₹135"],
                    ].map(([item, price]) => (
                      <div
                        key={item}
                        className="flex items-center justify-between text-xs"
                      >
                        <span className="font-semibold text-on-surface">
                          {item}
                        </span>
                        <span className="font-grotesk font-bold tabular-nums text-on-surface">
                          {price}
                        </span>
                      </div>
                    ))}
                    <div className="pt-2 border-t border-dashed border-outline-variant/40 flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase text-on-surface-variant">
                        Total + GST
                      </span>
                      <span className="font-grotesk text-base font-extrabold text-primary tabular-nums">
                        ₹1,435.00
                      </span>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl bg-surface-container-low px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-on-surface-variant">
                  <span>Supports Hindi, Marathi, Gujarati, Tamil &amp; English</span>
                  <span className="font-grotesk font-bold text-tertiary">
                    Auto-Stock Deducted
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURE 2: AUTONOMOUS WHATSAPP MUNIM & 24x7 NIGHT RUNNER */}
      <section
        id="whatsapp-munim"
        className="scroll-mt-36 py-16 lg:py-24 bg-surface border-b border-outline-variant/20"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            {/* Left: Night Runner Chat Simulation */}
            <div className="lg:col-span-6 order-2 lg:order-1">
              <div className="rounded-3xl bg-[#0d131f] p-5 sm:p-6 text-white shadow-xl border border-white/10 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-white/10">
                  <div className="flex items-center gap-2.5">
                    <Moon className="w-4 h-4 text-secondary-fixed-dim" />
                    <span className="text-xs font-extrabold uppercase tracking-wider">
                      24×7 Night Runner Active
                    </span>
                  </div>
                  <span className="font-grotesk text-xs text-slate-400 tabular-nums">
                    11:42 PM IST
                  </span>
                </div>

                <div className="space-y-3 text-xs sm:text-sm">
                  <div className="bg-white/10 rounded-2xl rounded-tl-sm p-3.5 max-w-[85%]">
                    <p className="text-[11px] font-bold text-secondary-fixed-dim mb-1">
                      Neha Sharma (Flat 402 · Regular Customer)
                    </p>
                    <p className="text-slate-100">
                      Bhaiya kal subah 8 baje 2L Amul Gold doodh, 1 brown bread
                      aur 500g paneer bhej dena.
                    </p>
                  </div>

                  <div className="ml-auto bg-primary-container rounded-2xl rounded-tr-sm p-3.5 max-w-[88%] space-y-2">
                    <p className="text-[11px] font-bold text-primary-fixed">
                      Munim AI · Auto-Replied in 1.2s
                    </p>
                    <p className="text-white">
                      Namaste Neha ji! Order confirm kar diya hai (Morning 8 AM
                      slot). Total bill:{" "}
                      <strong className="font-grotesk tabular-nums">
                        ₹364.00
                      </strong>
                      . Advance UPI link neeche hai:
                    </p>
                    <div className="rounded-xl bg-black/25 px-3 py-2 flex items-center justify-between">
                      <span className="font-grotesk text-xs font-bold text-tertiary-fixed-dim">
                        UPI Paid · ₹364.00
                      </span>
                      <CheckCircle2 className="w-4 h-4 text-tertiary-fixed-dim" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Copy */}
            <div className="lg:col-span-6 order-1 lg:order-2 space-y-5">
              <span className="font-grotesk text-xs font-bold uppercase tracking-wider text-primary">
                02 · Autonomous WhatsApp Storefront
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-on-surface">
                Autonomous WhatsApp Munim &amp; 24×7 Night Runner
              </h2>
              <p className="text-base text-on-surface-variant leading-relaxed">
                Your store shutter closes at 10 PM, but neighborhood families
                order groceries until midnight. Munim AI answers regular
                customers in polite Hindi/English, verifies real-time shelf
                stock, collects UPI payment upfront, and hands you a ready
                packing list at 7 AM.
              </p>
              <ul className="space-y-3 text-sm text-on-surface font-medium">
                {[
                  "Checks live inventory before confirming any item to avoid apologies",
                  "Remembers each family's preferred brands & recurring monthly basket",
                  "Queues morning delivery slips automatically on your counter printer",
                ].map((point) => (
                  <li key={point} className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-tertiary shrink-0 mt-0.5" />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURE 3: DIGITAL BAHI-KHATA & 0% AWKWARDNESS UDHAR RECOVERY */}
      <section
        id="whatsapp-khata"
        className="scroll-mt-36 py-16 lg:py-24 bg-surface-container-lowest border-b border-outline-variant/20"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mb-12">
            <span className="font-grotesk text-xs font-bold uppercase tracking-wider text-primary">
              03 · Automated Credit Ledger
            </span>
            <h2 className="mt-2 text-3xl sm:text-4xl font-extrabold tracking-tight text-on-surface">
              Digital Bahi-Khata &amp; 0% Awkwardness Udhar Recovery
            </h2>
            <p className="mt-3 text-base text-on-surface-variant">
              Keep neighborhood goodwill intact while recovering stuck capital
              3× faster with polite, branded WhatsApp statements and 1-tap UPI
              settlements.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="rounded-2xl bg-surface p-6 border border-outline-variant/30 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold uppercase tracking-wider text-tertiary">
                  Aapko Milenge (Receivable)
                </span>
                <IndianRupee className="w-4 h-4 text-tertiary" />
              </div>
              <p className="font-grotesk text-3xl font-extrabold text-on-surface tabular-nums">
                ₹4,620.00
              </p>
              <p className="text-xs text-on-surface-variant leading-relaxed">
                Gupta Sweet House · Polite reminder scheduled for Friday 10 AM
                with 1-tap PhonePe/GPay collect link.
              </p>
              <div className="pt-3 border-t border-outline-variant/20 text-xs font-bold text-tertiary">
                Auto-Reconciles on UPI Credit
              </div>
            </div>

            <div className="rounded-2xl bg-surface p-6 border border-outline-variant/30 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold uppercase tracking-wider text-secondary">
                  Aapko Dene Hain (Payable)
                </span>
                <Building2 className="w-4 h-4 text-secondary" />
              </div>
              <p className="font-grotesk text-3xl font-extrabold text-on-surface tabular-nums">
                ₹38,500.00
              </p>
              <p className="text-xs text-on-surface-variant leading-relaxed">
                Mahavir FMCG Distributors · 14-day distributor credit window
                tracked with early-payment cash discount alerts.
              </p>
              <div className="pt-3 border-t border-outline-variant/20 text-xs font-bold text-secondary">
                2% Cash Discount Eligible Today
              </div>
            </div>

            <div className="rounded-2xl bg-primary text-white p-6 space-y-4 shadow-md">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold uppercase tracking-wider text-primary-fixed">
                  Credit Recovery Velocity
                </span>
                <TrendingUp className="w-4 h-4 text-primary-fixed" />
              </div>
              <p className="font-grotesk text-3xl font-extrabold text-white tabular-nums">
                84.2%
              </p>
              <p className="text-xs text-on-primary-container/90 leading-relaxed">
                Average share of overdue udhaar recovered within 7 days of
                activating automated WhatsApp Munim follow-ups.
              </p>
              <div className="pt-3 border-t border-white/15 text-xs font-bold text-primary-fixed">
                Zero Awkward Phone Calls
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURE 4: MULTI-STORE SYNC & CENTRAL GODOWN LOGISTICS */}
      <section
        id="multi-godown"
        className="scroll-mt-36 py-16 lg:py-24 bg-surface border-b border-outline-variant/20"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            <div className="lg:col-span-5 space-y-5">
              <span className="font-grotesk text-xs font-bold uppercase tracking-wider text-primary">
                04 · Multi-Location Inventory
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-on-surface">
                Multi-Store Sync &amp; Central Godown Logistics
              </h2>
              <p className="text-base text-on-surface-variant leading-relaxed">
                Monitor every retail counter and back-office godown from one
                screen. When your Station Road counter dips below safety stock,
                trigger a 1-tap godown dispatch challan directly to your
                warehouse helper&apos;s WhatsApp.
              </p>
              <button
                type="button"
                onClick={() => setDispatched((prev) => !prev)}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-primary hover:bg-primary-container text-white text-sm font-bold shadow-sm transition-colors cursor-pointer"
              >
                <Layers className="w-4 h-4" />
                {dispatched
                  ? "Reset Sample Dispatch Transfer"
                  : "Simulate 25-Bag Godown Transfer"}
              </button>
            </div>

            <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-4">
              {BRANCH_STOCK.map((branch) => {
                const attaCount =
                  branch.id === "station" && dispatched
                    ? branch.attaBags + 25
                    : branch.id === "godown" && dispatched
                      ? branch.attaBags - 25
                      : branch.attaBags;
                const statusLabel =
                  branch.id === "station" && dispatched
                    ? "Replenished"
                    : branch.status;
                const isLow = statusLabel === "Low Stock Alert";

                return (
                  <div
                    key={branch.id}
                    className="rounded-2xl bg-surface-container-lowest p-5 border border-outline-variant/30 space-y-4"
                  >
                    <div>
                      <span
                        className={`inline-block text-[11px] font-bold px-2 py-0.5 rounded-md ${
                          isLow
                            ? "bg-error-container text-on-error-container"
                            : "bg-tertiary/10 text-tertiary"
                        }`}
                      >
                        {statusLabel}
                      </span>
                      <h3 className="mt-2.5 text-base font-extrabold text-on-surface">
                        {branch.name}
                      </h3>
                      <p className="text-xs text-on-surface-variant">
                        {branch.location}
                      </p>
                    </div>

                    <div className="space-y-2 pt-3 border-t border-outline-variant/20 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-on-surface-variant">
                          Atta (10kg)
                        </span>
                        <span className="font-grotesk font-extrabold text-on-surface tabular-nums">
                          {attaCount} bags
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-on-surface-variant">
                          Mustard Oil
                        </span>
                        <span className="font-grotesk font-extrabold text-on-surface tabular-nums">
                          {branch.oilTins} tins
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* FEATURE 5: RETAIL MANDI INTELLIGENCE & LIVE ARBITRAGE FEED */}
      <section
        id="mandi-arbitrage"
        className="scroll-mt-36 py-16 lg:py-24 bg-surface-container-lowest border-b border-outline-variant/20"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            <div className="lg:col-span-6 space-y-5">
              <span className="font-grotesk text-xs font-bold uppercase tracking-wider text-primary">
                05 · APMC Wholesale Intelligence
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-on-surface">
                Retail Mandi Intelligence &amp; Live Arbitrage Feed
              </h2>
              <p className="text-base text-on-surface-variant leading-relaxed">
                Don&apos;t buy blind from a single distributor. DukaanMitra
                tracks daily wholesale spot arrivals across major APMC mandis
                and alerts you when commodity staples dip below your 30-day
                purchase average.
              </p>

              <div className="space-y-3">
                {[
                  {
                    commodity: "Unjha Jeera (Bold Grade)",
                    mandi: "Surajpol / Unjha Spot",
                    rate: "₹264 / kg",
                    delta: "-3.4%",
                    buy: true,
                  },
                  {
                    commodity: "Kachi Ghani Mustard Oil (15L Tin)",
                    mandi: "Alwar / Jaipur Mandi",
                    rate: "₹2,185 / tin",
                    delta: "-2.1%",
                    buy: true,
                  },
                  {
                    commodity: "M-30 Refined Sugar (50kg)",
                    mandi: "Kolhapur / Indore Spot",
                    rate: "₹1,990 / bag",
                    delta: "+1.2%",
                    buy: false,
                  },
                ].map((row) => (
                  <div
                    key={row.commodity}
                    className="rounded-xl bg-surface p-4 border border-outline-variant/30 flex items-center justify-between gap-3"
                  >
                    <div>
                      <p className="text-sm font-extrabold text-on-surface">
                        {row.commodity}
                      </p>
                      <p className="text-xs text-on-surface-variant">
                        {row.mandi}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-grotesk text-sm font-extrabold text-on-surface tabular-nums">
                        {row.rate}
                      </p>
                      <span
                        className={`font-grotesk text-xs font-bold tabular-nums ${
                          row.buy ? "text-tertiary" : "text-error"
                        }`}
                      >
                        {row.delta} {row.buy ? "· Buy Window" : "· Hold"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 30-Day Margin Optimization SVG Chart */}
            <div className="lg:col-span-6">
              <div className="rounded-3xl bg-surface p-6 border border-outline-variant/30 shadow-sm space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                      30-Day Gross Margin Optimization
                    </p>
                    <p className="font-grotesk text-2xl font-extrabold text-primary tabular-nums mt-0.5">
                      +5.8% Net Margin Lift
                    </p>
                  </div>
                  <span className="px-2.5 py-1 rounded-md bg-tertiary/10 text-tertiary text-xs font-bold">
                    Live Benchmark
                  </span>
                </div>

                <svg
                  viewBox="0 0 420 180"
                  className="w-full h-auto"
                  role="img"
                  aria-label="30-day retail margin growth chart showing improvement from 11.4% to 17.2%"
                >
                  <defs>
                    <linearGradient
                      id="marginFill"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="0%" stopColor="#00685d" stopOpacity="0.28" />
                      <stop offset="100%" stopColor="#00685d" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  {[35, 75, 115, 155].map((y) => (
                    <line
                      key={y}
                      x1="12"
                      y1={y}
                      x2="408"
                      y2={y}
                      stroke="#bdc9c5"
                      strokeOpacity="0.4"
                      strokeDasharray="4 4"
                    />
                  ))}
                  <path
                    d="M 16 142 L 78 134 L 140 118 L 202 106 L 264 82 L 326 64 L 404 34 L 404 160 L 16 160 Z"
                    fill="url(#marginFill)"
                  />
                  <path
                    d="M 16 142 L 78 134 L 140 118 L 202 106 L 264 82 L 326 64 L 404 34"
                    fill="none"
                    stroke="#00685d"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {[
                    [16, 142],
                    [140, 118],
                    [264, 82],
                    [404, 34],
                  ].map(([cx, cy]) => (
                    <circle
                      key={`${cx}-${cy}`}
                      cx={cx}
                      cy={cy}
                      r="5"
                      fill="#ffffff"
                      stroke="#00685d"
                      strokeWidth="3"
                    />
                  ))}
                </svg>

                <div className="flex items-center justify-between text-xs font-grotesk font-semibold text-on-surface-variant tabular-nums">
                  <span>Day 1 (11.4%)</span>
                  <span>Day 10 (13.6%)</span>
                  <span>Day 20 (15.4%)</span>
                  <span className="text-primary font-bold">Day 30 (17.2%)</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURE 6: ZERO-LOSS LOCAL SQLITE & CLOUD LEDGER RECOVERY */}
      <section
        id="offline-ai"
        className="scroll-mt-36 py-16 lg:py-24 bg-[#0d131f] text-white"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mb-12">
            <span className="font-grotesk text-xs font-bold uppercase tracking-wider text-tertiary-fixed-dim">
              06 · Local-First CRDT Architecture
            </span>
            <h2 className="mt-2 text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
              Zero-Loss Local SQLite &amp; Instant Cloud Recovery
            </h2>
            <p className="mt-3 text-base text-slate-300">
              Never stall a billing queue because of weak shop Wi-Fi or tower
              outages. Every transaction writes locally first and merges
              conflict-free across devices.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                icon: WifiOff,
                title: "1. Instant Local SQLite Write",
                desc: "Invoices, udhaar entries, and inventory deductions commit directly to encrypted on-device SQLite storage in <5ms.",
              },
              {
                icon: RefreshCw,
                title: "2. Conflict-Free CRDT Merge",
                desc: "When 4G returns, background delta sync reconciles multiple billing phones and godown tablets with zero duplicate bills.",
              },
              {
                icon: ShieldCheck,
                title: "3. 8-Second Disaster Recovery",
                desc: "Dropped or lost your counter phone? Verify your OTP on any new Android phone to restore your complete Bahi-Khata.",
              },
            ].map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="rounded-2xl bg-white/[0.04] border border-white/10 p-6 space-y-3"
              >
                <div className="w-11 h-11 rounded-xl bg-primary/30 text-primary-fixed flex items-center justify-center">
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-extrabold text-white">{title}</h3>
                <p className="text-sm text-slate-300 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PLATFORM COMPARISON MATRIX */}
      <section
        id="matrix"
        className="scroll-mt-36 py-16 lg:py-24 bg-surface-container-lowest border-b border-outline-variant/20"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mb-10">
            <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-primary mb-2">
              Honest Platform Comparison
            </p>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-on-surface">
              How DukaanMitra Compares to Legacy Billing &amp; Khata Apps
            </h2>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-outline-variant/30 bg-surface">
            <table className="w-full text-left border-collapse min-w-[680px]">
              <thead>
                <tr className="border-b border-outline-variant/30 bg-surface-container-low text-xs font-extrabold uppercase tracking-wider text-on-surface">
                  <th className="py-4 px-5">Capability</th>
                  <th className="py-4 px-5 text-primary bg-primary/8">
                    DukaanMitra AI OS
                  </th>
                  <th className="py-4 px-5 text-on-surface-variant">
                    Busy / Marg / Tally
                  </th>
                  <th className="py-4 px-5 text-on-surface-variant">
                    KhataBook / OKCredit
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/20 text-sm">
                {[
                  [
                    "14ms Handwritten Parchi OCR",
                    true,
                    false,
                    false,
                  ],
                  [
                    "24×7 Autonomous WhatsApp Order Bot",
                    true,
                    false,
                    false,
                  ],
                  [
                    "Offline-First SQLite + Cloud CRDT Sync",
                    true,
                    "PC Local Only",
                    "Basic Ledger Only",
                  ],
                  [
                    "Multi-Godown Stock & Dispatch Challans",
                    true,
                    true,
                    false,
                  ],
                  [
                    "0% Awkwardness UPI Udhar Recovery",
                    true,
                    false,
                    true,
                  ],
                  [
                    "APMC Live Mandi Arbitrage Alerts",
                    true,
                    false,
                    false,
                  ],
                  [
                    "Zero PC Hardware Required",
                    true,
                    false,
                    true,
                  ],
                ].map(([label, _dm, erp, khata]) => (
                  <tr
                    key={String(label)}
                    className="hover:bg-surface-container-low/50 transition-colors"
                  >
                    <td className="py-4 px-5 font-bold text-on-surface">
                      {label}
                    </td>
                    <td className="py-4 px-5 bg-primary/[0.04]">
                      <span className="inline-flex items-center gap-1.5 font-bold text-primary">
                        <Check className="w-4 h-4" /> Included
                      </span>
                    </td>
                    <td className="py-4 px-5 text-on-surface-variant">
                      {typeof erp === "boolean" ? (
                        erp ? (
                          <Check className="w-4 h-4 text-tertiary" />
                        ) : (
                          <X className="w-4 h-4 text-error/70" />
                        )
                      ) : (
                        <span className="text-xs font-semibold">{erp}</span>
                      )}
                    </td>
                    <td className="py-4 px-5 text-on-surface-variant">
                      {typeof khata === "boolean" ? (
                        khata ? (
                          <Check className="w-4 h-4 text-tertiary" />
                        ) : (
                          <X className="w-4 h-4 text-error/70" />
                        )
                      ) : (
                        <span className="text-xs font-semibold">{khata}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* INTERACTIVE HARDWARE & SOUNDBOX COMPATIBILITY EXPLORER */}
      <section className="py-16 lg:py-24 bg-surface">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10">
            <div className="max-w-2xl">
              <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-primary mb-2">
                Plug &amp; Play Counter Ecosystem
              </p>
              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-on-surface">
                Works With Your Existing Printers, Soundboxes &amp; Scanners
              </h2>
            </div>

            {/* Working Filter Tabs */}
            <div className="inline-flex flex-wrap gap-1.5 p-1 rounded-xl bg-surface-container border border-outline-variant/30">
              {(
                [
                  { id: "all", label: "All Hardware", icon: Zap },
                  { id: "printers", label: "Printers", icon: Printer },
                  { id: "soundboxes", label: "Soundboxes", icon: Volume2 },
                  { id: "scanners", label: "Barcode Guns", icon: Barcode },
                ] as const
              ).map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setHardwareTab(id)}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                    hardwareTab === id
                      ? "bg-primary text-white shadow-xs"
                      : "text-on-surface-variant hover:text-on-surface"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredHardware.map((hw) => (
              <div
                key={hw.name}
                className="rounded-2xl bg-surface-container-lowest p-6 border border-outline-variant/30 flex flex-col justify-between space-y-4"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="font-grotesk text-[11px] font-bold px-2.5 py-1 rounded-md bg-surface-container-low text-on-surface-variant">
                      {hw.protocol}
                    </span>
                    <span className="text-[11px] font-extrabold text-tertiary">
                      {hw.status}
                    </span>
                  </div>
                  <h3 className="text-base font-extrabold text-on-surface">
                    {hw.name}
                  </h3>
                  <p className="mt-2 text-sm text-on-surface-variant leading-relaxed">
                    {hw.spec}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* BOTTOM CONVERSION CTA */}
      <section className="py-16 lg:py-20 bg-gradient-to-r from-primary to-primary-container text-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-5">
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            Ready to Give Your Dukaan Super-Powers?
          </h2>
          <p className="text-base text-on-primary-container/90 max-w-2xl mx-auto">
            Try the interactive WhatsApp Munim simulator with zero login, or
            download our starter GST &amp; inventory CSV templates today.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 pt-2">
            <Link
              to="/demo"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl bg-white text-primary hover:bg-surface-container-low font-extrabold text-sm shadow-lg transition-colors"
            >
              <Store className="w-4 h-4" />
              Launch Free Simulator
            </Link>
            <Link
              to="/downloads"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl bg-white/12 hover:bg-white/20 border border-white/25 text-white font-bold text-sm transition-colors"
            >
              <Database className="w-4 h-4" />
              Browse Free Downloads
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Features;
