import express, { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import crypto from 'crypto';
import qrcode from 'qrcode';
import axios from 'axios';

const app = express();
const PORT = process.env.OPENWA_PORT || 2785;
const CORE_ENGINE_WEBHOOK =
  process.env.CORE_WEBHOOK_URL || 'http://localhost:3000/whatsapp/openwa/webhook';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

const ALLOWED_ORIGINS = new Set(
  (process.env.ALLOWED_ORIGINS || 'https://dukaanmitra.in,http://localhost:3000')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || ALLOWED_ORIGINS.has(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error('CORS_ORIGIN_FORBIDDEN'));
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Gateway-Secret'],
  }),
);
app.use(express.json({ limit: '64kb' }));

function timingSafeEqualStr(a: string, b: string): boolean {
  if (!a || !b) return false;
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Fail-closed shared-secret authentication for internal gateway routes.
 */
function requireGatewaySecret(req: Request, res: Response, next: NextFunction): void {
  const configuredSecret = (process.env.GATEWAY_API_SECRET || '').trim();
  if (!configuredSecret) {
    res.status(503).json({
      error: 'Gateway authentication secret (GATEWAY_API_SECRET) is not configured.',
    });
    return;
  }

  const provided =
    req.header('x-gateway-secret')?.trim() ||
    (req.header('authorization')?.startsWith('Bearer ')
      ? req.header('authorization')!.slice('Bearer '.length).trim()
      : '');

  if (!timingSafeEqualStr(provided, configuredSecret)) {
    res.status(401).json({ error: 'Unauthorized gateway request.' });
    return;
  }

  next();
}

interface SessionState {
  id: string;
  status: 'CONNECTED' | 'SCAN_QR_CODE' | 'STARTING' | 'STOPPED';
  qrCode?: string;
  phone?: string;
}

const sessions = new Map<string, SessionState>();

sessions.set('default', {
  id: 'default',
  status: 'SCAN_QR_CODE',
});

if (!IS_PRODUCTION) {
  (async () => {
    try {
      const defaultQr = await qrcode.toDataURL('DUKAANMITRA_WHATSAPP_CONNECT_DEV_QR');
      const def = sessions.get('default');
      if (def) def.qrCode = defaultQr;
    } catch {
      // ignore dev QR startup error
    }
  })();
}

app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'online',
    gateway: 'DukaanMitra OpenWA Gateway',
    version: '1.0.0',
  });
});

app.get('/api/sessions/:sessionId', requireGatewaySecret, (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const session = sessions.get(sessionId) || {
    id: sessionId,
    status: 'STOPPED',
  };
  res.json(session);
});

app.get('/api/:sessionId/auth/qr', requireGatewaySecret, async (req: Request, res: Response) => {
  const { sessionId } = req.params;
  let session = sessions.get(sessionId);
  if (!session) {
    session = { id: sessionId, status: 'SCAN_QR_CODE' };
    sessions.set(sessionId, session);
  }

  try {
    const rawQr = `dukaanmitra:session:${sessionId}:${Date.now()}`;
    const qrDataUrl = await qrcode.toDataURL(rawQr);
    session.qrCode = qrDataUrl;

    if (req.query.format === 'image') {
      const base64Data = qrDataUrl.replace(/^data:image\/png;base64,/, '');
      const img = Buffer.from(base64Data, 'base64');
      res.writeHead(200, {
        'Content-Type': 'image/png',
        'Content-Length': img.length,
      });
      return res.end(img);
    }

    res.json({ qr: qrDataUrl });
  } catch {
    res.status(500).json({ error: 'Failed to generate QR code' });
  }
});

app.post('/api/sessions/:sessionId/pair-success', requireGatewaySecret, (req: Request, res: Response) => {
  if (IS_PRODUCTION) {
    return res.status(403).json({ error: 'Simulated pairing is disabled in production.' });
  }
  const { sessionId } = req.params;
  const phone = typeof req.body?.phone === 'string' ? req.body.phone.trim() : '';
  if (!/^[0-9]{10,15}$/.test(phone)) {
    return res.status(400).json({ error: 'Valid numeric phone is required.' });
  }
  const session = sessions.get(sessionId) || { id: sessionId, status: 'CONNECTED' };
  session.status = 'CONNECTED';
  session.phone = phone;
  session.qrCode = undefined;
  sessions.set(sessionId, session);

  res.json({ success: true, session });
});

app.post('/api/sendText', requireGatewaySecret, (req: Request, res: Response) => {
  const { chatId, text, session: sessionId = 'default' } = req.body ?? {};
  if (
    typeof chatId !== 'string' ||
    typeof text !== 'string' ||
    !chatId.trim() ||
    !text.trim() ||
    text.length > 4096
  ) {
    return res.status(400).json({ error: 'Valid chatId and text (<= 4096 chars) are required.' });
  }

  console.info(`[OpenWA Gateway] Outbound message queued (session=${sessionId})`);
  res.json({
    id: `wamid_DM_${Date.now()}`,
    status: 'SENT',
    to: chatId,
    timestamp: Date.now(),
  });
});

app.post('/api/simulate/inbound', requireGatewaySecret, async (req: Request, res: Response) => {
  if (IS_PRODUCTION) {
    return res.status(403).json({ error: 'Inbound simulation is disabled in production.' });
  }

  const {
    from = '919876543210@c.us',
    body,
    type = 'chat',
    pushname = 'Demo Customer',
    mediaUrl,
  } = req.body ?? {};

  const webhookPayload = {
    event: 'message',
    session: 'default',
    payload: {
      id: `wamid_IN_${Date.now()}`,
      timestamp: Math.floor(Date.now() / 1000),
      from,
      to: '918888888888@c.us',
      body,
      type,
      hasMedia: type !== 'chat',
      mediaUrl,
      sender: { pushname },
    },
  };

  try {
    const headers: Record<string, string> = {};
    if (process.env.GATEWAY_API_SECRET) {
      headers['X-Gateway-Secret'] = process.env.GATEWAY_API_SECRET;
    }
    const coreRes = await axios.post(CORE_ENGINE_WEBHOOK, webhookPayload, {
      timeout: 10_000,
      headers,
    });
    res.json({ success: true, deliveredToCore: true, coreResponse: coreRes.data });
  } catch {
    res.status(502).json({
      success: false,
      error: 'Core engine webhook forwarding failed.',
    });
  }
});

app.listen(PORT, () => {
  console.log(`🟢 DukaanMitra OpenWA Gateway listening on port ${PORT}`);
});
