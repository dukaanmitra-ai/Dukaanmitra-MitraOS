/* global console, fetch, process */
import fs from 'fs';
import path from 'path';

const geoDataPath = path.resolve('./lib/geoData.json');
let geoData = { locations: [] };

if (fs.existsSync(geoDataPath)) {
  geoData = JSON.parse(fs.readFileSync(geoDataPath, 'utf8'));
}

const SITE_URL = 'https://dukaanmitra.in';

async function syncSeo() {
  console.log('Starting SEO Sync Step (robots.txt, city-map.json, IndexNow)...');

  try {
    // 1. Write city-map.json for fast client lookups
    const cityMapPath = path.resolve('./public/city-map.json');
    const compactMap = geoData.locations.map((loc) => ({
      c: loc.city,
      s: loc.state,
      n: loc.country,
    }));
    fs.writeFileSync(cityMapPath, JSON.stringify(compactMap));

    // 2. Write comprehensive robots.txt for Search Engines + AI Crawlers
    const robotsTxt = `# DukaanMitra OS — Crawler & AI Discovery Directives
# Official Canonical Host: ${SITE_URL}

User-agent: *
Allow: /
Allow: /md/
Allow: /downloads/
Allow: /llms.txt
Allow: /llms-full.txt
Allow: /sitemap.html
Disallow: /admin
Disallow: /dashboard
Disallow: /whatsapp
Disallow: /seo-dashboard
Disallow: /bible
Disallow: /engineering-bible
Disallow: /__/auth/
Disallow: /api/

# Explicit Welcome for AI Search & LLM Assistants
User-agent: GPTBot
Allow: /
Disallow: /admin
Disallow: /dashboard
Disallow: /api/

User-agent: OAI-SearchBot
Allow: /
Disallow: /admin
Disallow: /dashboard
Disallow: /api/

User-agent: ChatGPT-User
Allow: /

User-agent: ClaudeBot
Allow: /
Disallow: /admin
Disallow: /dashboard
Disallow: /api/

User-agent: PerplexityBot
Allow: /
Disallow: /admin
Disallow: /dashboard
Disallow: /api/

User-agent: Google-Extended
Allow: /
Disallow: /admin
Disallow: /dashboard
Disallow: /api/

User-agent: Applebot-Extended
Allow: /
Disallow: /admin
Disallow: /dashboard
Disallow: /api/

# Sitemaps & AI Context Discovery
Sitemap: ${SITE_URL}/sitemap.xml
# HTML Sitemap: ${SITE_URL}/sitemap.html
# LLM Summary: ${SITE_URL}/llms.txt
# LLM Full Context: ${SITE_URL}/llms-full.txt
`;

    fs.writeFileSync(path.resolve('./public/robots.txt'), robotsTxt, 'utf8');
    if (fs.existsSync(path.resolve('./dist'))) {
      fs.writeFileSync(path.resolve('./dist/robots.txt'), robotsTxt, 'utf8');
      fs.writeFileSync(path.resolve('./dist/city-map.json'), JSON.stringify(compactMap));
    }
    console.log('Successfully wrote robots.txt and city-map.json');

    // 3. IndexNow verification persistence
    const indexNowKey = 'd527d930d68d45eba6b0472148d9be46';
    fs.writeFileSync(path.resolve(`./public/${indexNowKey}.txt`), indexNowKey);
    if (fs.existsSync(path.resolve('./dist'))) {
      fs.writeFileSync(path.resolve(`./dist/${indexNowKey}.txt`), indexNowKey);
    }

    // Read generated sitemap URLs if available for IndexNow ping
    const sitemapPath = path.resolve('./public/sitemap.xml');
    if (fs.existsSync(sitemapPath)) {
      const xml = fs.readFileSync(sitemapPath, 'utf8');
      const matches = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]);
      if (matches.length > 0 && process.env.ENABLE_INDEXNOW_PING === 'true') {
        const payload = {
          host: 'dukaanmitra.in',
          key: indexNowKey,
          keyLocation: `${SITE_URL}/${indexNowKey}.txt`,
          urlList: matches.slice(0, 500),
        };
        try {
          const response = await fetch('https://api.indexnow.org/indexnow', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json; charset=utf-8' },
            body: JSON.stringify(payload),
          });
          console.log(`IndexNow ping status: ${response.status}`);
        } catch (networkError) {
          console.log(`IndexNow external network skip: ${networkError.message}`);
        }
      }
    }
  } catch (error) {
    console.error('Error syncing SEO files:', error);
    process.exit(1);
  }
}

syncSeo();
