import "dotenv/config";
import express from "express";
import fs from "fs";
import path from "path";
import { createServer as createViteServer } from "vite";
import Razorpay from "razorpay";
import crypto from "crypto";
import compression from "compression";
import { GoogleGenAI } from "@google/genai";

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

function loadLlmsKnowledge(): string {
  const candidates = [
    path.join(process.cwd(), "public", "llms-full.txt"),
    path.join(process.cwd(), "dist", "llms-full.txt"),
  ];
  for (const filePath of candidates) {
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, "utf8");
    }
  }
  return "DukaanMitra OS (Munim AI) is India's WhatsApp-native AI business operating system for local shopkeepers, offering voice billing, udhaar khata reminders with UPI links, smart inventory tracking, and Google review automation. Founded by Amit Sharma in Kanpur, India. Official site: https://dukaanmitra.in.";
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Gzip compression for all text-based assets (HTML, CSS, JS, MD, XML, CSV, etc.)
  app.use(compression());

  // JSON request body parser
  app.use(express.json());

  // Security headers and crawl optimization
  app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.setHeader("X-XSS-Protection", "1; mode=block");
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

  // API routes
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  // Interactive Munim AI Website Chat Widget endpoint (grounded on llms-full.txt)
  app.post("/api/munim-chat", async (req, res) => {
    try {
      const { message, history = [] } = req.body as {
        message?: string;
        history?: Array<{ role: "user" | "assistant"; text: string }>;
      };

      const trimmed = typeof message === "string" ? message.trim() : "";
      if (!trimmed || trimmed.length > 1000) {
        return res.status(400).json({ error: "Please enter a question under 1000 characters." });
      }

      const ai = getGeminiClient();
      if (!ai) {
        return res.status(503).json({
          error: "Munim AI chat service is currently unavailable. Please connect directly on WhatsApp or explore /downloads and /sitemap.",
        });
      }

      const knowledge = loadLlmsKnowledge();
      const conversationLines = Array.isArray(history)
        ? history
            .slice(-6)
            .map((h) => `${h.role === "assistant" ? "Munim AI" : "Visitor"}: ${String(h.text || "").slice(0, 400)}`)
            .join("\n")
        : "";

      const prompt = conversationLines
        ? `Previous conversation:\n${conversationLines}\n\nVisitor: ${trimmed}`
        : trimmed;

      const response = await ai.models.generateContent({
        model: "gemini-4-hydrogen",
        contents: prompt,
        config: {
          systemInstruction:
            "You are Munim AI, the friendly official website assistant for DukaanMitra OS (https://dukaanmitra.in). " +
            "Reply concisely in 2 to 4 crisp sentences matching the user's language (Hindi, Hinglish, or English). " +
            "Use ONLY verified facts from the official DukaanMitra knowledge base below. Never invent prices, phone numbers, or features. " +
            "When helpful, mention exact site paths like /downloads, /sitemap, /pricing, /demo, or /llms.txt.\n\n" +
            "OFFICIAL KNOWLEDGE BASE:\n" +
            knowledge.slice(0, 12000),
        },
      });

      const reply = response.text?.trim();
      if (!reply) {
        return res.status(502).json({ error: "No response returned from Munim AI. Please try again." });
      }

      return res.json({ reply });
    } catch (error) {
      console.error("Munim chat API error:", error);
      return res.status(500).json({
        error: "Could not reach Munim AI right now. Please try again in a moment or message us on WhatsApp.",
      });
    }
  });

  app.post("/api/create-order", async (req, res) => {
    try {
      const { amount, currency = "INR", receipt } = req.body;
      if (!amount || amount < 100) {
        return res.status(400).json({ error: "Amount must be at least 100 paise" });
      }

      const instance = new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID || "",
        key_secret: process.env.RAZORPAY_KEY_SECRET || "",
      });

      const options = {
        amount,
        currency,
        receipt: receipt || `receipt_${Date.now()}`,
      };

      const order = await instance.orders.create(options);
      res.json({
        order_id: order.id,
        amount: order.amount,
        currency: order.currency,
      });
    } catch (error) {
      console.error("Razorpay create-order error:", error);
      res.status(500).json({ error: "Failed to create order" });
    }
  });

  app.post("/api/verify-payment", (req, res) => {
    try {
      const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
      if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const secret = process.env.RAZORPAY_KEY_SECRET || "";
      const generated_signature = crypto
        .createHmac("sha256", secret)
        .update(razorpay_order_id + "|" + razorpay_payment_id)
        .digest("hex");

      if (generated_signature === razorpay_signature) {
        res.json({ success: true, message: "Payment verified successfully" });
      } else {
        res.status(400).json({ success: false, error: "Invalid signature" });
      }
    } catch (error) {
      console.error("Razorpay verify-payment error:", error);
      res.status(500).json({ error: "Verification failed" });
    }
  });

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
      })
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
