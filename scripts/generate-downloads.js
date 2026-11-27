/* global console, Buffer */
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

const DOWNLOADS_DIR = path.resolve('./public/downloads');

if (!fs.existsSync(DOWNLOADS_DIR)) {
  fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });
}

// ---------------------------------------------------------------------------
// 1. Minimal valid PDF 1.4 generator (multi-page capable, clean Helvetica text)
// ---------------------------------------------------------------------------
function escapePdfText(text) {
  return String(text)
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function createPdfBuffer(pages) {
  const objects = [];
  const addObject = (body) => {
    objects.push(body);
    return objects.length;
  };

  // Reserve 1: Catalog, 2: Pages, 3: Helvetica, 4: Helvetica-Bold
  const catalogId = addObject('');
  const pagesId = addObject('');
  const fontRegularId = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  const fontBoldId = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');

  const pageIds = [];

  for (const lines of pages) {
    const streamLines = [
      'BT',
      '0.08 0.11 0.18 rg',
    ];

    let y = 780;
    for (const line of lines) {
      if (line.type === 'spacer') {
        y -= line.height || 14;
        continue;
      }
      const font = line.bold ? 'F2' : 'F1';
      const size = line.size || 11;
      const color = line.color || '0.12 0.16 0.24';
      const x = line.x || 54;
      streamLines.push(`${color} rg`);
      streamLines.push(`/${font} ${size} Tf`);
      streamLines.push(`1 0 0 1 ${x} ${y} Tm`);
      streamLines.push(`(${escapePdfText(line.text)}) Tj`);
      y -= line.leading || Math.round(size * 1.55);
    }

    streamLines.push('ET');
    const streamContent = streamLines.join('\n');
    const contentId = addObject(
      `<< /Length ${Buffer.byteLength(streamContent, 'utf8')} >>\nstream\n${streamContent}\nendstream`
    );
    const pageId = addObject(
      `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R >> >> /Contents ${contentId} 0 R >>`
    );
    pageIds.push(pageId);
  }

  objects[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
  objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (let i = 0; i < objects.length; i++) {
    offsets.push(Buffer.byteLength(pdf, 'utf8'));
    pdf += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }

  const xrefOffset = Buffer.byteLength(pdf, 'utf8');
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let i = 1; i <= objects.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(pdf, 'utf8');
}

// ---------------------------------------------------------------------------
// 2. Minimal valid ZIP / OOXML (.docx) generator using pure Node zlib
// ---------------------------------------------------------------------------
const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function buildZip(entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBuf = Buffer.from(entry.name, 'utf8');
    const dataBuf = Buffer.isBuffer(entry.content) ? entry.content : Buffer.from(entry.content, 'utf8');
    const compressed = zlib.deflateRawSync(dataBuf);
    const checksum = crc32(dataBuf);

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(8, 8); // deflate
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(0, 12);
    localHeader.writeUInt32LE(checksum, 14);
    localHeader.writeUInt32LE(compressed.length, 18);
    localHeader.writeUInt32LE(dataBuf.length, 22);
    localHeader.writeUInt16LE(nameBuf.length, 26);
    localHeader.writeUInt16LE(0, 28);

    localParts.push(localHeader, nameBuf, compressed);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(8, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(0, 14);
    centralHeader.writeUInt32LE(checksum, 16);
    centralHeader.writeUInt32LE(compressed.length, 20);
    centralHeader.writeUInt32LE(dataBuf.length, 24);
    centralHeader.writeUInt16LE(nameBuf.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);

    centralParts.push(centralHeader, nameBuf);
    offset += localHeader.length + nameBuf.length + compressed.length;
  }

  const centralDir = Buffer.concat(centralParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralDir.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralDir, eocd]);
}

function escapeXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function createDocxBuffer(sections) {
  const paragraphs = sections
    .map((sec) => {
      if (sec.heading) {
        return `<w:p><w:pPr><w:spacing w:before="220" w:after="80"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="${sec.level === 1 ? 32 : 24}"/><w:color w:val="${sec.level === 1 ? '1E3A8A' : '0F172A'}"/></w:rPr><w:t>${escapeXml(sec.heading)}</w:t></w:r></w:p>`;
      }
      return `<w:p><w:pPr><w:spacing w:after="100"/></w:pPr><w:r><w:rPr><w:sz w:val="22"/><w:color w:val="334155"/></w:rPr><w:t>${escapeXml(sec.text)}</w:t></w:r></w:p>`;
    })
    .join('');

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

  const docRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`;

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${paragraphs}
    <w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr>
  </w:body>
</w:document>`;

  return buildZip([
    { name: '[Content_Types].xml', content: contentTypes },
    { name: '_rels/.rels', content: rootRels },
    { name: 'word/_rels/document.xml.rels', content: docRels },
    { name: 'word/document.xml', content: documentXml },
  ]);
}

function generateAllDownloads() {
  // 1. Product Brochure PDF
  const brochurePdf = createPdfBuffer([
    [
      { text: 'DUKAANMITRA OS  |  OFFICIAL PRODUCT BROCHURE (2026)', bold: true, size: 10, color: '0.26 0.22 0.79', leading: 22 },
      { text: 'India\'s WhatsApp-Native AI Munim for Local Shops', bold: true, size: 20, color: '0.06 0.09 0.16', leading: 28 },
      { text: 'Billing, Udhaar Khata, Stock Inventory & Google Reviews directly inside WhatsApp.', size: 11, color: '0.28 0.33 0.41', leading: 20 },
      { type: 'spacer', height: 12 },
      { text: '1. Why Indian Shopkeepers Choose DukaanMitra OS', bold: true, size: 14, color: '0.06 0.09 0.16', leading: 22 },
      { text: '- Zero App Fatigue: Works directly inside WhatsApp on Mobile and Desktop/PC Web.', size: 10.5, leading: 17 },
      { text: '- Voice-First Hinglish Entry: Speak "Sharma ji 2kg chini 120 udhaar" to update ledger.', size: 10.5, leading: 17 },
      { text: '- 3x Faster Udhaar Recovery: Polite automated WhatsApp reminders with UPI payment links.', size: 10.5, leading: 17 },
      { text: '- Smart Stock Alerts: Real-time inventory tracking with low-stock warnings before stockouts.', size: 10.5, leading: 17 },
      { text: '- Google Review Booster: Send automated review links post-sale to rank #1 locally.', size: 10.5, leading: 17 },
      { type: 'spacer', height: 12 },
      { text: '2. Everyday WhatsApp Commands (Munim AI)', bold: true, size: 14, color: '0.06 0.09 0.16', leading: 22 },
      { text: '- Sale Entry:    "Ramesh 5kg Atta 220 cash" -> Generates instant bill & updates stock.', size: 10.5, leading: 17 },
      { text: '- Udhaar Entry:  "Suresh ko 850 ka udhaar diya" -> Logs credit & schedules reminder.', size: 10.5, leading: 17 },
      { text: '- Payment In:    "Suresh ne 500 UPI bheja" -> Updates pending balance automatically.', size: 10.5, leading: 17 },
      { text: '- Daily Report:  "Aaj ka hisaab batao" -> Instant sales, cash, UPI & udhaar summary.', size: 10.5, leading: 17 },
      { type: 'spacer', height: 12 },
      { text: '3. Simple, Transparent Pricing (INR)', bold: true, size: 14, color: '0.06 0.09 0.16', leading: 22 },
      { text: '- Starter Plan (Free Forever): Daily WhatsApp billing, basic khata, 100 entries/month.', size: 10.5, leading: 17 },
      { text: '- Growth Plan (Rs. 299/month): Unlimited billing, voice Munim AI, UPI reminders, inventory.', size: 10.5, leading: 17 },
      { text: '- Enterprise / Multi-Shop (Rs. 999/month): Multi-branch sync, GST reports, ONDC catalog.', size: 10.5, leading: 17 },
      { type: 'spacer', height: 12 },
      { text: '4. Built for Every Indian Retail Category', bold: true, size: 14, color: '0.06 0.09 0.16', leading: 22 },
      { text: 'Kirana & General Stores, Medical & Pharmacy, Hardware & Electrical, Garments,', size: 10.5, leading: 16 },
      { text: 'Mobile & Accessories, Auto Parts, Footwear, Electronics, Jewellery & Sweet Shops.', size: 10.5, leading: 18 },
      { type: 'spacer', height: 14 },
      { text: 'Founder: Amit Sharma (Kanpur, India)  |  Website: https://dukaanmitra.in', bold: true, size: 10, color: '0.26 0.22 0.79', leading: 16 },
      { text: 'Live Demo: https://dukaanmitra.in/demo  |  HTML Sitemap: https://dukaanmitra.in/sitemap', size: 10, color: '0.28 0.33 0.41', leading: 16 },
    ],
  ]);
  fs.writeFileSync(path.join(DOWNLOADS_DIR, 'dukaanmitra-brochure-2026.pdf'), brochurePdf);

  // 2. Retail Inventory & Billing Starter CSV
  const inventoryCsv = [
    'SKU,Item Name,Category,Unit,Cost Price (INR),Selling Price MRP (INR),GST (%),Margin (%),Current Stock,Reorder Level',
    'DM-1001,Aashirvaad Shudh Chakki Atta 5kg,Staples,Pack,215,245,0,13.95,42,10',
    'DM-1002,India Gate Basmati Rice 5kg,Staples,Bag,440,510,5,15.91,28,8',
    'DM-1003,Tata Sampann Toor Dal 1kg,Pulses,Pack,162,190,0,17.28,35,10',
    'DM-1004,Fortune Kachi Ghani Mustard Oil 1L,Edible Oil,Bottle,138,162,5,17.39,60,15',
    'DM-1005,Amul Taaza Toned Milk 1L,Dairy,Pack,50,56,0,12.00,48,12',
    'DM-1006,Refined Sugar Loose 1kg,Staples,Kg,40,46,5,15.00,90,20',
    'DM-1007,Tata Tea Gold 500g,Beverages,Pack,265,305,5,15.09,24,8',
    'DM-1008,Parle-G Gold Biscuits 1kg,Snacks,Pack,78,95,18,21.79,55,15',
    'DM-1009,Surf Excel Quick Wash 1kg,Home Care,Pack,185,220,18,18.92,30,10',
    'DM-1010,Dettol Original Soap 4x125g,Personal Care,Bundle,158,192,18,21.52,40,12',
    'DM-1011,Maggi 2-Minute Noodles 12-Pack,Instant Food,Pack,142,168,12,18.31,34,10',
    'DM-1012,MDH Garam Masala 100g,Spices,Box,74,92,5,24.32,45,10',
    'DM-1013,Colgate Strong Teeth 200g,Personal Care,Tube,96,118,18,22.92,38,10',
    'DM-1014,Haldiram Aloo Bhujia 400g,Snacks,Pack,82,100,12,21.95,29,8',
    'DM-1015,Amul Butter 500g,Dairy,Pack,262,285,12,8.78,18,6',
    'DM-1016,Vim Dishwash Liquid Gel 750ml,Home Care,Bottle,146,179,18,22.60,26,8',
    'DM-1017,Tata Salt Vacuum Evaporated 1kg,Staples,Pack,23,28,0,21.74,110,25',
    'DM-1018,Kissan Fresh Tomato Ketchup 850g,Condiments,Pouch,105,130,12,23.81,22,6',
    'DM-1019,Parachute Coconut Oil 500ml,Personal Care,Bottle,172,208,18,20.93,31,8',
    'DM-1020,Red Label Natural Care Tea 500g,Beverages,Pack,278,320,5,15.11,19,6',
  ].join('\n') + '\n';
  fs.writeFileSync(path.join(DOWNLOADS_DIR, 'retail-inventory-template.csv'), inventoryCsv, 'utf8');

  // 3. Udhaar & Customer Khata Tracker CSV
  const udhaarCsv = [
    'Customer ID,Customer Name,WhatsApp Number,Last Bill Date,Recent Items,Total Billed (INR),Amount Paid (INR),Pending Udhaar (INR),Due Date,Reminder Status',
    'CUST-001,Ramesh Singh,+919876543210,2026-11-20,"Atta 10kg, Mustard Oil 2L",4500,2000,2500,2026-11-30,Scheduled via WhatsApp',
    'CUST-002,Suresh Kumar,+919876543211,2026-11-22,"Toor Dal 2kg, Tea 500g, Sugar 3kg",1500,0,1500,2026-11-29,Pending Reminder',
    'CUST-003,Manoj Tiwari,+919876543212,2026-11-18,"Basmati Rice 5kg, Spices",3200,2000,1200,2026-11-28,Sent UPI Link',
    'CUST-004,Anita Devi,+919876543213,2026-11-24,"Daily Milk, Butter, Biscuits",5400,4600,800,2026-12-02,Auto-Reminder Active',
    'CUST-005,Vikram Verma,+919876543214,2026-11-15,"Detergent, Soap, Home Care Pack",2750,2750,0,2026-11-25,Cleared',
    'CUST-006,Pooja Gupta,+919876543215,2026-11-23,"Monthly Kirana Basket",6120,4000,2120,2026-12-01,Scheduled via WhatsApp',
  ].join('\n') + '\n';
  fs.writeFileSync(path.join(DOWNLOADS_DIR, 'udhaar-khata-tracker.csv'), udhaarCsv, 'utf8');

  // 4. Local Shop SEO & Digital Dukaan Checklist CSV
  const seoChecklistCsv = [
    'Step,Category,Action Item,Target Impact,Priority',
    '1,Google Business Profile,Claim & verify shop listing with exact NAP (Name Address Phone),Rank in local Google Maps 3-pack,Critical',
    '2,Google Reviews,Send automated WhatsApp review link after every fulfilled order,Boost star rating from 3.8 to 4.7+,High',
    '3,WhatsApp Catalog,Upload top 30 fast-moving products with clear INR pricing,Enable zero-friction WhatsApp ordering,High',
    '4,Canonical Domain,Redirect www to non-www HTTPS canonical domain cleanly,Consolidate clicks & avoid split rankings,Critical',
    '5,Robots & Sitemap,Publish robots.txt and clean canonical sitemap.xml without redirects,Fast Googlebot indexing of new pages,Critical',
    '6,Structured Data,Embed Organization LocalBusiness SoftwareApplication and FAQPage JSON-LD,Win Google rich snippets & AI citations,High',
    '7,AI Discovery,Publish /llms.txt /llms-full.txt and clean /md/*.md Markdown summaries,Improve ChatGPT Perplexity and Gemini answers,High',
    '8,HTML Sitemap,Publish human-friendly /sitemap and /sitemap.html directory page,Help visitors & crawlers discover all hubs,Medium',
    '9,Regional Hindi/Hinglish,Include Hindi & Hinglish headings and FAQs (Hisaab Udhaar Billing),Capture Translated Results impressions,High',
    '10,Downloadable Assets,Offer free PDF brochure CSV templates and DOCX setup guides,Increase engagement & natural backlinks,Medium',
  ].join('\n') + '\n';
  fs.writeFileSync(path.join(DOWNLOADS_DIR, 'local-shop-seo-checklist.csv'), seoChecklistCsv, 'utf8');

  // 5. WhatsApp Shop Setup & Onboarding Guide DOCX
  const setupDocx = createDocxBuffer([
    { heading: 'DukaanMitra OS - WhatsApp Digital Dukaan Setup Guide (2026)', level: 1 },
    { text: 'Welcome to DukaanMitra OS (Hisaab Mitra & Munim AI). This step-by-step guide helps Indian shopkeepers digitize billing, udhaar khata, inventory, and Google reviews directly from WhatsApp in under 5 minutes.' },
    { heading: 'Step 1: Connect Your Shop WhatsApp Number', level: 2 },
    { text: 'Visit https://dukaanmitra.in/demo or sign in on desktop/mobile web. Link your business WhatsApp number so Munim AI can sync every sale, credit entry, and customer invoice automatically.' },
    { heading: 'Step 2: Log Your First Sale or Udhaar Using Voice or Text', level: 2 },
    { text: 'Send a simple Hinglish message or voice note such as: "Ramesh ji 2kg Atta 120 udhaar" or "Cash sale 450 Mustard Oil 2L". Munim AI parses items, updates stock, and stores a timestamped ledger entry.' },
    { heading: 'Step 3: Turn On Polite Automated UPI Udhaar Reminders', level: 2 },
    { text: 'Enable scheduled WhatsApp reminders with your UPI ID so pending credit customers receive respectful payment nudges with a one-tap payment link, accelerating recovery up to 3x.' },
    { heading: 'Step 4: Import Inventory & Share Your WhatsApp Catalog', level: 2 },
    { text: 'Download retail-inventory-template.csv from https://dukaanmitra.in/downloads, add your top 30 SKUs, and upload them to enable instant stock tracking and customer WhatsApp ordering.' },
    { heading: 'Step 5: Automate Google Reviews to Grow Local Footfall', level: 2 },
    { text: 'Paste your Google Business Profile review link inside DukaanMitra settings. Happy buyers automatically receive a thank-you bill with a 1-tap Google review button.' },
    { heading: 'Support & Official Links', level: 2 },
    { text: 'Website: https://dukaanmitra.in  |  Downloads: https://dukaanmitra.in/downloads  |  HTML Sitemap: https://dukaanmitra.in/sitemap  |  Founder: Amit Sharma (Kanpur, India).' },
  ]);
  fs.writeFileSync(path.join(DOWNLOADS_DIR, 'dukaanmitra-whatsapp-setup-guide.docx'), setupDocx);

  console.log('Successfully generated downloadable PDF, CSV, and DOCX files in /public/downloads.');
}

generateAllDownloads();
