import "dotenv/config";
import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import compression from "compression";
import { mountHardenedApiRoutes } from "./server/apiRouter";

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // Respect reverse proxy headers (Cloud Run / Vercel / Nginx) for accurate rate limiting & HTTPS checks
  app.set("trust proxy", 1);

  // Gzip compression for all text-based assets (HTML, CSS, JS, MD, XML, CSV, etc.)
  app.use(compression());

  // Security headers and crawl optimization
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    next();
  });

  // WWW to non-WWW redirect & SSL enforcement (Canonical Host redirect)
  app.use((req, res, next) => {
    const host = req.headers.host || "";
    const isWww = host.startsWith("www.");
    const isHttp = req.headers["x-forwarded-proto"] === "http";

    if (isWww || isHttp) {
      const cleanHost = isWww ? host.slice(4) : host;
      if (host.includes("dukaanmitra.in")) {
        return res.redirect(301, `https://${cleanHost}${req.originalUrl}`);
      }
    }
    next();
  });

  // Mount Phase 3 hardened API routes (/api/*)
  mountHardenedApiRoutes(app);

  // Explicit UTF-8 headers for AI/SEO markdown and text files in both dev and prod
  app.use((req, res, next) => {
    if (req.path.endsWith(".md")) {
      res.setHeader("Content-Type", "text/markdown; charset=utf-8");
      res.setHeader("Cache-Control", "public, max-age=0, must-revalidate");
    } else if (
      req.path === "/llms.txt" ||
      req.path === "/llms-full.txt" ||
      req.path === "/robots.txt"
    ) {
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.setHeader("Cache-Control", "public, max-age=0, must-revalidate");
    }
    next();
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");

    // Serve static files with intelligent cache control
    app.use(
      express.static(distPath, {
        maxAge: "1y",
        immutable: true,
        setHeaders: (res, filePath) => {
          const ext = path.extname(filePath);
          if (
            ext === ".html" ||
            ext === ".xml" ||
            ext === ".md" ||
            filePath.endsWith("robots.txt") ||
            filePath.endsWith("llms.txt") ||
            filePath.endsWith("llms-full.txt")
          ) {
            res.setHeader("Cache-Control", "public, max-age=0, must-revalidate");
          } else {
            res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
          }
        },
      }),
    );

    // Handle SPA fallback. Prevent missing files with file extensions from returning 200 index.html
    app.get("*", (req, res) => {
      const ext = path.extname(req.path);
      if (ext && ext !== ".html") {
        return res.status(404).send("Not Found");
      }
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
