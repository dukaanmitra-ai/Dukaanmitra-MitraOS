/* global console */
import fs from 'fs';
import path from 'path';

const SITE_URL = 'https://dukaanmitra.in';
const PUBLIC_DIR = path.resolve('./public');
const MD_DIR = path.join(PUBLIC_DIR, 'md');

if (!fs.existsSync(PUBLIC_DIR)) fs.mkdirSync(PUBLIC_DIR, { recursive: true });
if (!fs.existsSync(MD_DIR)) fs.mkdirSync(MD_DIR, { recursive: true });

const coreRoutes = [
  { path: 'features', title: 'Features', desc: 'AI billing, voice khata, inventory tracking, and UPI udhaar automation.' },
  { path: 'services', title: 'Services', desc: 'WhatsApp digital dukaan setup, catalog automation, and local SEO growth.' },
  { path: 'how-it-works', title: 'How It Works', desc: '3-step walkthrough for running your retail store inside WhatsApp.' },
  { path: 'pricing', title: 'Pricing', desc: 'Transparent INR pricing plans starting at Rs. 0/month for Indian shopkeepers.' },
  { path: 'udhaar-management-app', title: 'Udhaar & Hisaab Management', desc: 'Digital bahi khata (Hisaab Mitra / Udhaar Mitra) with polite UPI reminders.' },
  { path: 'whatsapp-shop-management', title: 'WhatsApp Shop Management', desc: 'Accept WhatsApp orders, send digital bills, and track inventory via chat.' },
  { path: 'get-more-google-reviews-for-shop', title: 'Google Review Automation', desc: 'Boost Google Business Profile ratings automatically after every sale.' },
  { path: 'free-tools', title: 'Free Retail Tools', desc: 'Free profit margin calculator, GST invoice generator, and UPI link maker.' },
  { path: 'templates', title: 'WhatsApp Templates', desc: 'Ready-to-use Hindi and English catalog and udhaar reminder templates.' },
  { path: 'downloads', title: 'Downloads & Resource Hub', desc: 'Download PDF brochure, CSV inventory/udhaar templates, and DOCX setup guide.' },
  { path: 'sitemap', title: 'HTML Sitemap', desc: 'Human-friendly directory of all DukaanMitra pages, guides, and city hubs.' },
  { path: 'android-app', title: 'Android & PC Web Access', desc: 'Use DukaanMitra on Android phones, Windows PC browsers, and WhatsApp Web.' },
  { path: 'case-studies', title: 'Case Studies', desc: 'Real ROI stories from Indian kirana, hardware, medical, and garment retailers.' },
  { path: 'faq', title: 'FAQ', desc: 'Answers to common questions about billing, security, pricing, and founder.' },
  { path: 'knowledge', title: 'Retail AI Wiki', desc: 'Knowledge base for digitizing Indian local retail stores.' },
];

const comparisons = [
  { slug: 'okcredit', name: 'OkCredit' },
  { slug: 'khatabook', name: 'Khatabook' },
  { slug: 'vyapar', name: 'Vyapar' },
];

const programmaticPages = [
  'retail-store-software', 'bahi-khata-alternative', 'inventory-management-retail',
  'increase-google-business-rating', 'whatsapp-review-automation', 'dukaan-online-kaise-laye',
  'apni-dukan-ko-digital-kaise-banaye', 'retail-dukaan-ke-liye-ai-billing-software',
  'whatsapp-se-saman-kaise-beche', 'retail-store-ko-grow-kaise-kare', 'best-billing-software-for-mobile-shop',
  'garment-shop-software-free', 'hardware-shop-billing-app', 'medical-store-software-india',
  'supermarket-billing-software-free-download', 'jewellery-shop-management-software',
  'sweet-shop-billing-software', 'footwear-shop-software', 'electronics-shop-billing-app',
  'retail-khata-app-for-pc', 'bina-internet-ke-billing-machine', 'whatsapp-par-customer-ko-bill-kaise-bheje',
  'auto-parts-shop-free-billing', 'grocery-shop-inventory-excel', 'retail-shop-accounting-software',
  'free-gst-billing-software', 'mobile-accessories-shop-software', 'retail-shop-profit-calculator',
  'whatsapp-catalog-maker-app', 'digital-payment-tracker-for-shop',
];

const blogPages = [
  'udhaar-ka-hisaab-kaise-rakhe', 'retail-shop-daily-sales-system', 'best-billing-software-for-small-shop',
  'kanpur-me-shop-ko-online-kaise-laaye', 'ai-sandboxing-secure-shop-data', 'google-business-profile-kaise-banaye',
  'gbp-suspend-kyun-hota-hai', 'whatsapp-se-order-kaise-le', 'local-business-ko-customer-kaise-mile',
  'manage-retail-store-digitally-india-2026', 'bahi-khata-ai-se-kaise-manage-karein', 'whatsapp-munim-vs-human-munim',
];

const markdownDocs = [
  {
    slug: 'overview.md',
    title: 'DukaanMitra OS Overview (Hisaab, Udhaar & Inventory Mitra)',
    summary: 'Core identity, value proposition, target retail segments, and brand aliases.',
    body: `# DukaanMitra OS — Platform Overview

> **DukaanMitra OS** (powered by **Munim AI**) is India's WhatsApp-native AI Business Operating System for local shopkeepers, kirana stores, wholesalers, and inventory-driven retailers.

## Brand Names & Common Queries
Users across India search for DukaanMitra under several everyday retail terms, all referring to the same platform at \`https://dukaanmitra.in\`:
- **DukaanMitra / DukaanMitra OS / Dukan Mitra**: Official platform name.
- **Munim AI / AI Munim**: Built-in conversational Hinglish/Hindi/English WhatsApp assistant.
- **Hisaab Mitra / Udhaar Mitra**: Digital bahi-khata and automated UPI credit recovery module.
- **Inventory Mitra / Sales Mitra**: Real-time stock tracking, low-stock alerts, and daily sales reporting.
- **WhatsApp Digital Dukaan**: Zero-download storefront, catalog sharing, and WhatsApp ordering flow.

## Who Uses DukaanMitra?
- Kirana & General Stores
- Medical Stores & Pharmacies
- Hardware, Paint & Electrical Shops
- Mobile & Accessories Stores
- Garment, Footwear & Jewellery Shops
- Auto Parts, Electronics & Sweet Shops

## Access Across Devices (Mobile & PC)
DukaanMitra works natively inside **WhatsApp** (Android, iOS, and WhatsApp Web) as well as via browser at \`https://dukaanmitra.in/dashboard\` on Windows PC, Mac, and tablets—no heavy desktop ERP installation required.
`,
  },
  {
    slug: 'features.md',
    title: 'Core Features & Capabilities',
    summary: 'WhatsApp voice billing, smart inventory, automated udhaar recovery, and Google review growth.',
    body: `# DukaanMitra OS — Core Features

## 1. Voice & Chat Billing inside WhatsApp
- Log cash, UPI, or credit sales by typing or sending a voice note in Hindi, Hinglish, or English (e.g., *"Sharma ji 2kg chini 120 udhaar"*).
- Instantly generate shareable digital customer bills and GST-ready invoices.

## 2. Automated Udhaar (Khata) Recovery
- Track customer-wise pending balances and full transaction history.
- Dispatch polite, scheduled WhatsApp reminders with embedded **UPI payment links**—helping shopkeepers recover credit up to 3x faster without awkward phone calls.

## 3. Real-Time Inventory & Stock Alerts
- Every billed item automatically deducts from live stock counts.
- Receive proactive low-stock notifications before top-selling SKUs run out.
- Import starter product sheets using standard CSV files.

## 4. WhatsApp Digital Dukaan & Ordering
- Publish a clean product catalog and take direct customer orders over WhatsApp.
- Confirm orders, send invoices, and track repeat buyers from one chat thread.

## 5. Google Business Profile Review Automation
- Automatically follow up with happy customers on WhatsApp with a 1-tap Google review link to grow local map rankings and footfall.

## 6. Daily Profit & Sales Analytics
- Ask *"Aaj ka hisaab batao"* anytime for cash vs UPI totals, top items, and pending receivables.
`,
  },
  {
    slug: 'pricing.md',
    title: 'Pricing Plans (INR)',
    summary: 'Free forever starter tier, Rs. 299/month Growth plan, and Rs. 999/month Multi-Shop Enterprise plan.',
    body: `# DukaanMitra OS — Pricing Plans (INR)

All plans work on Mobile WhatsApp, Android, and Desktop/PC browsers with zero hardware lock-in.

| Plan | Price (INR) | Ideal For | Key Inclusions |
| :--- | :--- | :--- | :--- |
| **Starter** | ₹0 / month (Free Forever) | Small kirana & single-counter shops | Up to 100 monthly WhatsApp entries, digital khata, basic bills, free CSV templates |
| **Growth** | ₹299 / month | Growing retail & wholesale stores | Unlimited billing & udhaar, Voice Munim AI, automated UPI reminders, live inventory alerts, Google review booster |
| **Enterprise** | ₹999 / month | Multi-branch shops & distributors | Multi-store sync, staff access controls, GST export packs, priority WhatsApp support, ONDC catalog readiness |

Visit \`https://dukaanmitra.in/pricing\` to compare plans or start instantly at \`https://dukaanmitra.in/demo\`.
`,
  },
  {
    slug: 'how-it-works.md',
    title: 'How DukaanMitra Works (3 Steps)',
    summary: 'Step-by-step onboarding and real Hinglish WhatsApp command examples.',
    body: `# How DukaanMitra Works

## Step 1: Activate Your Shop
Open \`https://dukaanmitra.in/demo\` or sign in with Google/Phone to initialize your digital store workspace in under 2 minutes.

## Step 2: Talk to Munim AI on WhatsApp
Use natural everyday shopkeeper phrasing:
- **Cash Sale:** \`"Ramesh 5kg Atta 245 cash"\`
- **Credit / Udhaar:** \`"Suresh ko 850 ka udhaar diya"\`
- **Payment Received:** \`"Suresh ne 500 UPI bheja"\`
- **Stock Update:** \`"20 packet Amul Milk stock mein add karo"\`
- **Daily Summary:** \`"Aaj ki total bikri aur udhaar batao"\`

## Step 3: Automate Reminders & Growth
DukaanMitra updates your web dashboard in real time, sends polite UPI collection reminders on due dates, and requests Google Reviews from satisfied buyers.
`,
  },
  {
    slug: 'compare.md',
    title: 'DukaanMitra vs Khatabook vs OkCredit vs Vyapar',
    summary: 'Side-by-side comparison of workflow friction, WhatsApp-native AI, and pricing.',
    body: `# Competitor Comparison — DukaanMitra OS vs Alternatives

| Capability | DukaanMitra OS (Munim AI) | Khatabook / OkCredit | Vyapar / Traditional ERP |
| :--- | :--- | :--- | :--- |
| **Interface** | WhatsApp-native + Web (Mobile & PC) | Separate mobile app | Heavy desktop/mobile forms |
| **Data Entry Speed** | Hinglish voice notes & chat (2 seconds) | Manual form typing | Multi-screen manual entry |
| **Billing + Inventory + Khata** | Unified in one AI workflow | Primarily ledger/khata focused | Complex setup & learning curve |
| **Automated UPI Reminders** | Smart conversational WhatsApp nudges | Basic SMS / app reminder | Manual trigger |
| **Google Review Automation** | Built-in post-sale automation | Not included | Not included |
| **Desktop / PC Access** | Instant browser & WhatsApp Web | Limited | Windows install required |

Explore full comparison pages:
- ${SITE_URL}/compare/khatabook
- ${SITE_URL}/compare/okcredit
- ${SITE_URL}/compare/vyapar
`,
  },
  {
    slug: 'faq.md',
    title: 'Frequently Asked Questions (Hindi / Hinglish / English)',
    summary: 'Direct answers for shopkeepers, search engines, and AI assistants.',
    body: `# DukaanMitra OS — Frequently Asked Questions

### Q1. DukaanMitra kya hai? (What is DukaanMitra?)
DukaanMitra OS India ka WhatsApp-first AI Business Operating System hai jo local shopkeepers ko billing, udhaar khata (Hisaab Mitra), stock inventory (Inventory Mitra), aur WhatsApp ordering bina kisi complex software ke manage karne mein madad karta hai.

### Q2. Who is the founder of DukaanMitra?
DukaanMitra was founded by **Amit Sharma** (Dev Kanpur), an Indian software engineer from Kanpur, Uttar Pradesh, focused on bringing practical AI automation to India's neighbourhood retail stores.

### Q3. Kya DukaanMitra free hai?
Haan, DukaanMitra ka Starter plan ₹0/month (Free Forever) hai. Unlimited Voice Munim AI, inventory alerts, aur automated UPI reminders ke liye Growth plan ₹299/month se shuru hota hai.

### Q4. Can I use DukaanMitra on PC / Desktop without downloading software?
Yes. You can open \`https://dukaanmitra.in/dashboard\` on any Windows PC, Mac, or Chromebook browser, or use WhatsApp Web directly—no desktop installer needed.

### Q5. Kya mera shop data safe aur private rehta hai?
Haan. Har shop ka ledger isolated encrypted cloud storage mein store hota hai aur sirf verified store owner account se access hota hai.

### Q6. Where can I download brochures and free CSV/DOCX templates?
Visit \`https://dukaanmitra.in/downloads\` to download the official 2026 PDF Brochure, Retail Inventory CSV template, Udhaar Khata Tracker CSV, Local Shop SEO Checklist CSV, and WhatsApp Setup Guide DOCX.
`,
  },
  {
    slug: 'founder.md',
    title: 'Founder & Company Mission',
    summary: 'About Amit Sharma (Kanpur), company vision, and official verification.',
    body: `# Founder & Company — DukaanMitra

- **Brand / Company:** DukaanMitra (DukaanMitra OS & Munim AI)
- **Founder:** Amit Sharma (Kanpur, Uttar Pradesh, India)
- **Official Domain:** \`https://dukaanmitra.in\`
- **Mission:** Empower millions of Indian kirana, pharmacy, hardware, apparel, and local retail merchants to compete with quick-commerce through effortless WhatsApp-native AI accounting, inventory, and customer retention.
- **Official Links:**
  - LinkedIn: https://www.linkedin.com/company/dukaanmitra/
  - YouTube: https://youtube.com/@officialdukaanmitra
  - Founder Page: ${SITE_URL}/founder
  - Official Domain Verification: ${SITE_URL}/official-domain
`,
  },
  {
    slug: 'downloads.md',
    title: 'Downloadable Files & Starter Templates',
    summary: 'Direct links to official PDF brochures, CSV templates, and DOCX setup guides.',
    body: `# Official Downloadable Files (PDF, CSV, DOCX)

All resources are free to download from \`https://dukaanmitra.in/downloads\`:

1. **DukaanMitra Official Product Brochure (PDF):** \`${SITE_URL}/downloads/dukaanmitra-brochure-2026.pdf\`
2. **Indian Retail & Kirana Inventory Template (CSV):** \`${SITE_URL}/downloads/retail-inventory-template.csv\`
3. **Customer Udhaar & Khata Recovery Tracker (CSV):** \`${SITE_URL}/downloads/udhaar-khata-tracker.csv\`
4. **WhatsApp Digital Dukaan Onboarding Guide (DOCX):** \`${SITE_URL}/downloads/dukaanmitra-whatsapp-setup-guide.docx\`
5. **Local Shop SEO & Google Maps Checklist (CSV):** \`${SITE_URL}/downloads/local-shop-seo-checklist.csv\`
`,
  },
];

function buildMarkdownPagesAndLlms() {
  // 1. Write individual clean .md pages in /public/md/
  for (const doc of markdownDocs) {
    fs.writeFileSync(path.join(MD_DIR, doc.slug), doc.body.trim() + '\n', 'utf8');
  }

  // Write /public/md/index.md
  const mdIndex = `# DukaanMitra OS — Clean Markdown Documentation Index

> Machine-readable, zero-clutter Markdown pages for AI agents, LLMs, and developers.

## Clean Markdown Pages
${markdownDocs.map((d) => `- [${d.title}](${SITE_URL}/md/${d.slug}): ${d.summary}`).join('\n')}

## Discovery Files
- [llms.txt (Concise AI Index)](${SITE_URL}/llms.txt)
- [llms-full.txt (Complete Full-Text Knowledge Base)](${SITE_URL}/llms-full.txt)
- [sitemap.xml (XML Sitemap)](${SITE_URL}/sitemap.xml)
- [sitemap.html (HTML Sitemap)](${SITE_URL}/sitemap.html)
- [robots.txt (Crawler Rules)](${SITE_URL}/robots.txt)
`;
  fs.writeFileSync(path.join(MD_DIR, 'index.md'), mdIndex, 'utf8');

  // 2. Build concise, standard llms.txt (clean, zero clutter, zero broken links)
  const llmsShort = `# DukaanMitra OS (Munim AI)

> DukaanMitra OS is India's WhatsApp-native AI Business Operating System for local shopkeepers and retail stores—combining voice billing, digital bahi-khata (Hisaab Mitra / Udhaar Mitra), real-time stock inventory (Inventory Mitra), automated UPI payment reminders, and Google Review growth. Founded by Amit Sharma in Kanpur, India.

## Clean Markdown Knowledge Pages (Recommended for LLMs)
${markdownDocs.map((d) => `- [${d.title}](${SITE_URL}/md/${d.slug}): ${d.summary}`).join('\n')}
- [Markdown Directory Index](${SITE_URL}/md/index.md): Master list of all clean Markdown files.
- [Full-Text Context (llms-full.txt)](${SITE_URL}/llms-full.txt): Single-file complete knowledge base combining all product docs, pricing, comparisons, and FAQs.

## Core Website Pages
${coreRoutes.map((r) => `- [${r.title}](${SITE_URL}/${r.path}): ${r.desc}`).join('\n')}

## Downloadable Resources (PDF, CSV, DOCX)
- [Product Brochure 2026 (PDF)](${SITE_URL}/downloads/dukaanmitra-brochure-2026.pdf)
- [Retail Inventory Template (CSV)](${SITE_URL}/downloads/retail-inventory-template.csv)
- [Udhaar & Khata Tracker (CSV)](${SITE_URL}/downloads/udhaar-khata-tracker.csv)
- [WhatsApp Digital Dukaan Setup Guide (DOCX)](${SITE_URL}/downloads/dukaanmitra-whatsapp-setup-guide.docx)
- [Local Shop SEO Checklist (CSV)](${SITE_URL}/downloads/local-shop-seo-checklist.csv)

## Competitor Comparisons
${comparisons.map((c) => `- [DukaanMitra vs ${c.name}](${SITE_URL}/compare/${c.slug})`).join('\n')}

## Sitemaps & Crawler Discovery
- [XML Sitemap](${SITE_URL}/sitemap.xml)
- [HTML Sitemap (Static)](${SITE_URL}/sitemap.html)
- [Interactive HTML Sitemap](${SITE_URL}/sitemap)
- [Robots Directives](${SITE_URL}/robots.txt)

## Optional System Context
- Official canonical domain: \`https://dukaanmitra.in\` (non-www HTTPS).
- Supports Hindi, Hinglish, and English retail workflows across 100+ Indian cities including Kanpur, Lucknow, Jaipur, Meerut, Hyderabad, Gaya, Bhavnagar, Kakinada, Mysore, Nagpur, Mumbai, Delhi, and Bengaluru.
`;

  // 3. Build rich, full-text llms-full.txt (complete self-contained reference)
  let llmsFull = `# DukaanMitra OS — Complete Full-Text Context for AI & LLMs

> Official full-text knowledge document for **DukaanMitra OS** and **Munim AI** (\`https://dukaanmitra.in\`).
> Last updated: ${new Date().toISOString().split('T')[0]}

---

${markdownDocs.map((d) => d.body.trim()).join('\n\n---\n\n')}

---

## Programmatic Retail Solution Guides
${programmaticPages
  .map((slug) => {
    const title = slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    return `- [${title}](${SITE_URL}/p/${slug})`;
  })
  .join('\n')}

## Retail Growth Blog & Hindi/Hinglish Guides
${blogPages
  .map((slug) => {
    const title = slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    return `- [${title}](${SITE_URL}/blog/${slug})`;
  })
  .join('\n')}

## Backend API Endpoints
- \`GET /api/health\` -> \`{ "status": "ok" }\`
- \`POST /api/munim-chat\` -> Interactive Munim AI website assistant endpoint
- \`POST /api/create-order\` -> Initializes Razorpay checkout order in INR
- \`POST /api/verify-payment\` -> Verifies Razorpay HMAC-SHA256 payment signature
`;

  fs.writeFileSync(path.join(PUBLIC_DIR, 'llms.txt'), llmsShort.trim() + '\n', 'utf8');
  fs.writeFileSync(path.join(PUBLIC_DIR, 'llms-full.txt'), llmsFull.trim() + '\n', 'utf8');
  console.log(`Successfully generated /public/llms.txt, /public/llms-full.txt, and ${markdownDocs.length + 1} clean Markdown files in /public/md/.`);
}

buildMarkdownPagesAndLlms();
