/* global console */
import fs from 'fs';
import path from 'path';

const geoDataPath = path.resolve('./lib/geoData.json');
let geoData = { locations: [] };
if (fs.existsSync(geoDataPath)) {
  geoData = JSON.parse(fs.readFileSync(geoDataPath, 'utf8'));
}

const SITE_URL = 'https://dukaanmitra.in';

const coreRoutes = [
  { path: '', label: 'Home — DukaanMitra OS', changefreq: 'daily', priority: 1.0 },
  { path: 'features', label: 'Features', changefreq: 'weekly', priority: 0.9 },
  { path: 'services', label: 'Services', changefreq: 'weekly', priority: 0.9 },
  { path: 'how-it-works', label: 'How It Works', changefreq: 'weekly', priority: 0.9 },
  { path: 'pricing', label: 'Pricing (INR)', changefreq: 'monthly', priority: 0.8 },
  { path: 'udhaar-management-app', label: 'Udhaar & Hisaab Management App', changefreq: 'weekly', priority: 1.0 },
  { path: 'whatsapp-shop-management', label: 'WhatsApp Shop Management', changefreq: 'weekly', priority: 1.0 },
  { path: 'get-more-google-reviews-for-shop', label: 'Google Reviews Automation', changefreq: 'weekly', priority: 1.0 },
  { path: 'whatsapp-ai', label: 'WhatsApp AI Munim', changefreq: 'weekly', priority: 0.9 },
  { path: 'billing', label: 'AI Billing Software', changefreq: 'weekly', priority: 0.9 },
  { path: 'inventory', label: 'Smart Inventory Tracking', changefreq: 'weekly', priority: 0.9 },
  { path: 'udhaar', label: 'Automated Udhaar Recovery', changefreq: 'weekly', priority: 0.9 },
  { path: 'analytics', label: 'Retail Sales Analytics', changefreq: 'weekly', priority: 0.8 },
  { path: 'crm', label: 'Shop Customer CRM', changefreq: 'weekly', priority: 0.8 },
  { path: 'retail-ai', label: 'Retail AI OS', changefreq: 'weekly', priority: 0.9 },
  { path: 'free-tools', label: 'Free Retail Tools', changefreq: 'weekly', priority: 0.9 },
  { path: 'templates', label: 'WhatsApp Templates', changefreq: 'weekly', priority: 0.9 },
  { path: 'downloads', label: 'Downloads Hub (PDF, CSV, DOCX)', changefreq: 'weekly', priority: 0.9 },
  { path: 'sitemap', label: 'Interactive HTML Sitemap', changefreq: 'weekly', priority: 0.8 },
  { path: 'sitemap.html', label: 'Static HTML Sitemap', changefreq: 'weekly', priority: 0.8 },
  { path: 'android-app', label: 'Android & PC Web App', changefreq: 'weekly', priority: 0.8 },
  { path: 'case-studies', label: 'Case Studies', changefreq: 'weekly', priority: 0.8 },
  { path: 'blog', label: 'Retail Growth Blog', changefreq: 'daily', priority: 0.8 },
  { path: 'knowledge', label: 'Retail AI Wiki', changefreq: 'daily', priority: 0.9 },
  { path: 'keywords', label: 'Retail Keywords Directory', changefreq: 'weekly', priority: 0.7 },
  { path: 'coverage', label: 'Pan-India Coverage', changefreq: 'weekly', priority: 0.7 },
  { path: 'about', label: 'About DukaanMitra', changefreq: 'monthly', priority: 0.8 },
  { path: 'founder', label: 'Founder — Amit Sharma', changefreq: 'monthly', priority: 0.8 },
  { path: 'contact', label: 'Contact & WhatsApp Support', changefreq: 'weekly', priority: 0.8 },
  { path: 'faq', label: 'Frequently Asked Questions', changefreq: 'monthly', priority: 0.7 },
  { path: 'docs', label: 'Documentation', changefreq: 'weekly', priority: 0.8 },
  { path: 'changelog', label: 'Changelog', changefreq: 'weekly', priority: 0.7 },
  { path: 'roadmap', label: 'Product Roadmap', changefreq: 'weekly', priority: 0.7 },
  { path: 'security', label: 'Security & Data Isolation', changefreq: 'monthly', priority: 0.8 },
  { path: 'support', label: 'Support Center', changefreq: 'weekly', priority: 0.8 },
  { path: 'official-domain', label: 'Official Domain Verification', changefreq: 'monthly', priority: 0.6 },
  { path: 'privacy', label: 'Privacy Policy', changefreq: 'monthly', priority: 0.5 },
  { path: 'terms', label: 'Terms of Service', changefreq: 'monthly', priority: 0.5 },
];

const aiMarkdownFiles = [
  'llms.txt',
  'llms-full.txt',
  'md/index.md',
  'md/overview.md',
  'md/features.md',
  'md/pricing.md',
  'md/how-it-works.md',
  'md/compare.md',
  'md/faq.md',
  'md/founder.md',
  'md/downloads.md',
];

const downloadableFiles = [
  { path: 'downloads/dukaanmitra-brochure-2026.pdf', label: 'DukaanMitra Product Brochure 2026 (PDF)' },
  { path: 'downloads/retail-inventory-template.csv', label: 'Retail & Kirana Inventory Starter Sheet (CSV)' },
  { path: 'downloads/udhaar-khata-tracker.csv', label: 'Customer Udhaar & Khata Tracker (CSV)' },
  { path: 'downloads/dukaanmitra-whatsapp-setup-guide.docx', label: 'WhatsApp Digital Dukaan Setup Guide (DOCX)' },
  { path: 'downloads/local-shop-seo-checklist.csv', label: 'Local Shop SEO & Google Maps Checklist (CSV)' },
];

const programmaticComparisons = ['okcredit', 'khatabook', 'vyapar'];

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
  'dukaanmitra', 'mitraos', 'munim-ai', 'ai-retail-os', 'whatsapp-commerce',
  'ai-munim', 'retail-automation', 'digital-udhaar', 'retail-intelligence', 'bharat-commerce-os',
];

const blogPages = [
  'udhaar-ka-hisaab-kaise-rakhe', 'retail-shop-daily-sales-system', 'best-billing-software-for-small-shop',
  'kanpur-me-shop-ko-online-kaise-laaye', 'ai-sandboxing-secure-shop-data', 'google-business-profile-kaise-banaye',
  'gbp-suspend-kyun-hota-hai', 'whatsapp-se-order-kaise-le', 'local-business-ko-customer-kaise-mile',
  'manage-retail-store-digitally-india-2026', 'bahi-khata-ai-se-kaise-manage-karein', 'whatsapp-munim-vs-human-munim',
];

const cities = Array.from(new Set([
  'lucknow', 'kanpur', 'delhi', 'mumbai', 'bangalore', 'pune', 'ahmedabad', 'hyderabad', 'chennai', 'kolkata', 'jaipur', 'surat',
  'agra', 'aligarh', 'allahabad', 'amritsar', 'aurangabad', 'bareilly', 'bhavnagar', 'bhiwandi', 'bhopal', 'bhubaneswar',
  'bikaner', 'chandigarh', 'coimbatore', 'cuttack', 'dehradun', 'dhanbad', 'bhilai', 'durgapur', 'erode', 'faridabad',
  'firozabad', 'ghaziabad', 'gorakhpur', 'gulbarga', 'guntur', 'gwalior', 'guwahati', 'hubli', 'indore', 'jabalpur',
  'jalandhar', 'jalgaon', 'jamnagar', 'jamshedpur', 'jhansi', 'jodhpur', 'kakinada', 'kochi', 'kolhapur', 'kollam',
  'kota', 'kozhikode', 'kurnool', 'ludhiana', 'madurai', 'malegaon', 'mangalore', 'meerut', 'moradabad', 'mysore',
  'nagpur', 'nanded', 'nashik', 'nellore', 'noida', 'patna', 'pondicherry', 'raipur', 'rajkot', 'rajahmundry', 'ranchi',
  'rourkela', 'salem', 'sangli', 'siliguri', 'solapur', 'srinagar', 'thiruvananthapuram', 'thrissur', 'tiruchirappalli',
  'tirunelveli', 'tiruppur', 'ujjain', 'vadodara', 'varanasi', 'vasai-virar', 'vijayawada', 'visakhapatnam', 'warangal',
  'gurgaon', 'ajmer', 'akola', 'ulhasnagar', 'saharanpur', 'rohtak', 'mathura', 'gaya',
]));

const today = new Date().toISOString().split('T')[0];

function generateXmlEntry(url, changefreq, priority, lastmod = today) {
  return `  <url>
    <loc>${url}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority.toFixed(1)}</priority>
  </url>`;
}

const titleCase = (slug) =>
  slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

// 1. Build canonical sitemap.xml (no redirecting URLs, no robots.txt)
const seenUrls = new Set();
const xmlEntries = [];
const pushUrl = (url, changefreq, priority) => {
  if (!seenUrls.has(url)) {
    seenUrls.add(url);
    xmlEntries.push(generateXmlEntry(url, changefreq, priority));
  }
};

coreRoutes.forEach((r) => pushUrl(`${SITE_URL}${r.path ? '/' + r.path : '/'}`, r.changefreq, r.priority));
aiMarkdownFiles.forEach((f) => pushUrl(`${SITE_URL}/${f}`, 'weekly', 0.8));
programmaticComparisons.forEach((slug) => pushUrl(`${SITE_URL}/compare/${slug}`, 'monthly', 0.8));
programmaticPages.forEach((slug) => pushUrl(`${SITE_URL}/p/${slug}`, 'weekly', 0.8));
blogPages.forEach((slug) => pushUrl(`${SITE_URL}/blog/${slug}`, 'weekly', 0.8));
cities.forEach((city) => pushUrl(`${SITE_URL}/solutions/retail-ai-${city}`, 'weekly', 0.7));

const stateSet = new Set();
geoData.locations.forEach((loc) => {
  const stateKey = `${loc.country}/${loc.state}`;
  if (!stateSet.has(stateKey)) {
    stateSet.add(stateKey);
    pushUrl(`${SITE_URL}/solutions/${loc.country}/${loc.state}`, 'weekly', 0.8);
  }
  pushUrl(`${SITE_URL}/solutions/${loc.country}/${loc.state}/${loc.city}`, 'weekly', 0.7);
});

const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${xmlEntries.join('\n')}\n</urlset>\n`;
fs.writeFileSync(path.resolve('./public/sitemap.xml'), xmlContent, 'utf8');

// 2. Build static HTML Sitemap (/public/sitemap.html) for visitors & bots without JS
const htmlSitemap = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>HTML Sitemap — DukaanMitra OS</title>
  <meta name="description" content="Complete human-readable HTML sitemap of DukaanMitra OS: core features, retail guides, AI Markdown docs, downloadable templates, and pan-India city pages." />
  <link rel="canonical" href="${SITE_URL}/sitemap.html" />
  <style>
    body { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #0f172a; background: #ffffff; margin: 0; line-height: 1.6; }
    .wrap { max-width: 1120px; margin: 0 auto; padding: 48px 24px 72px; }
    header { border-bottom: 1px solid #e2e8f0; padding-bottom: 24px; margin-bottom: 36px; }
    h1 { font-size: 2rem; margin: 0 0 8px; letter-spacing: -0.02em; }
    p.sub { color: #475569; margin: 0 0 16px; max-width: 68ch; }
    .top-links { display: flex; flex-wrap: wrap; gap: 16px; font-size: 0.9rem; }
    .top-links a { color: #1d4ed8; font-weight: 600; text-decoration: none; }
    .top-links a:hover { text-decoration: underline; }
    h2 { font-size: 1.25rem; margin: 36px 0 14px; padding-bottom: 8px; border-bottom: 1px solid #e2e8f0; }
    ul { list-style: none; padding: 0; margin: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 10px 20px; }
    li a { color: #0f172a; text-decoration: none; font-size: 0.95rem; }
    li a:hover { color: #1d4ed8; text-decoration: underline; }
    footer { margin-top: 56px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 0.85rem; color: #64748b; }
  </style>
</head>
<body>
  <div class="wrap">
    <header>
      <h1>DukaanMitra OS — HTML Sitemap</h1>
      <p class="sub">Complete site overview for visitors, search engines, and AI systems. Updated ${today}.</p>
      <div class="top-links">
        <a href="/">Home</a>
        <a href="/sitemap">Interactive Sitemap</a>
        <a href="/downloads">Downloads Hub</a>
        <a href="/sitemap.xml">XML Sitemap</a>
        <a href="/robots.txt">robots.txt</a>
        <a href="/llms.txt">llms.txt</a>
        <a href="/llms-full.txt">llms-full.txt</a>
      </div>
    </header>

    <section>
      <h2>1. Core Application &amp; Feature Pages</h2>
      <ul>
        ${coreRoutes.map((r) => `<li><a href="/${r.path}">${r.label}</a></li>`).join('\n        ')}
      </ul>
    </section>

    <section>
      <h2>2. AI, LLM &amp; Clean Markdown (.md) Files</h2>
      <ul>
        ${aiMarkdownFiles.map((f) => `<li><a href="/${f}">/${f}</a></li>`).join('\n        ')}
      </ul>
    </section>

    <section>
      <h2>3. Downloadable Files (PDF, CSV, DOCX)</h2>
      <ul>
        ${downloadableFiles.map((d) => `<li><a href="/${d.path}" download>${d.label}</a></li>`).join('\n        ')}
      </ul>
    </section>

    <section>
      <h2>4. Competitor Comparisons</h2>
      <ul>
        ${programmaticComparisons.map((slug) => `<li><a href="/compare/${slug}">DukaanMitra vs ${titleCase(slug)}</a></li>`).join('\n        ')}
      </ul>
    </section>

    <section>
      <h2>5. Retail Solution Hubs</h2>
      <ul>
        ${programmaticPages.map((slug) => `<li><a href="/p/${slug}">${titleCase(slug)}</a></li>`).join('\n        ')}
      </ul>
    </section>

    <section>
      <h2>6. Knowledge Blog &amp; Hinglish Guides</h2>
      <ul>
        ${blogPages.map((slug) => `<li><a href="/blog/${slug}">${titleCase(slug)}</a></li>`).join('\n        ')}
      </ul>
    </section>

    <section>
      <h2>7. Top Indian Cities Covered (${cities.length} Cities)</h2>
      <ul>
        ${cities.map((city) => `<li><a href="/solutions/retail-ai-${city}">Retail AI in ${titleCase(city)}</a></li>`).join('\n        ')}
      </ul>
    </section>

    <footer>
      &copy; ${new Date().getFullYear()} DukaanMitra OS. Founded by Amit Sharma (Kanpur, India). Canonical: ${SITE_URL}
    </footer>
  </div>
</body>
</html>
`;

fs.writeFileSync(path.resolve('./public/sitemap.html'), htmlSitemap, 'utf8');
console.log(`Successfully generated canonical /public/sitemap.xml (${seenUrls.size} URLs) and static /public/sitemap.html.`);
