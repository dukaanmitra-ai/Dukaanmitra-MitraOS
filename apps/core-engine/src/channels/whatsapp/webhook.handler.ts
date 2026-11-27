import crypto from 'crypto';
import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { EventRouter } from '../../core/events/event-router';
import { EventType, EventSource } from '../../core/events/types';
import { CoreAuthenticatedRequest, timingSafeEqualStr } from '../../api/middleware/auth.middleware';

export class WhatsAppWebhookHandler {
  private prisma: PrismaClient;
  private eventRouter: EventRouter;
  private verifyToken: string;
  private appSecret: string;

  constructor(
    prisma: PrismaClient,
    eventRouter: EventRouter,
    verifyToken: string,
    appSecret = process.env.WHATSAPP_APP_SECRET || '',
  ) {
    this.prisma = prisma;
    this.eventRouter = eventRouter;
    this.verifyToken = verifyToken.trim();
    this.appSecret = appSecret.trim();
  }

  async handleVerification(req: Request, res: Response): Promise<void> {
    if (!this.verifyToken) {
      res.status(503).send('Webhook verify token not configured');
      return;
    }
    const mode = String(req.query['hub.mode'] || '');
    const token = String(req.query['hub.verify_token'] || '');
    const challenge = String(req.query['hub.challenge'] || '');

    if (mode === 'subscribe' && timingSafeEqualStr(token, this.verifyToken)) {
      res.status(200).send(challenge);
    } else {
      res.sendStatus(403);
    }
  }

  private verifySignature(req: Request): boolean {
    if (!this.appSecret) {
      return false;
    }
    const signatureHeader = (req.header('x-hub-signature-256') || '').trim();
    if (!signatureHeader.startsWith('sha256=')) {
      return false;
    }
    const rawBody =
      (req as CoreAuthenticatedRequest).rawBody ??
      Buffer.from(JSON.stringify(req.body ?? {}), 'utf8');
    const expected = `sha256=${crypto
      .createHmac('sha256', this.appSecret)
      .update(rawBody)
      .digest('hex')}`;
    return timingSafeEqualStr(signatureHeader, expected);
  }

  async handleIncoming(req: Request, res: Response): Promise<void> {
    if (!this.appSecret) {
      res.status(503).json({ error: 'WhatsApp webhook secret not configured.' });
      return;
    }

    if (!this.verifySignature(req)) {
      res.status(401).json({ error: 'Invalid webhook signature.' });
      return;
    }

    const body = req.body;

    if (body?.object !== 'whatsapp_business_account') {
      res.sendStatus(404);
      return;
    }

    try {
      for (const entry of body.entry || []) {
        for (const change of entry.changes || []) {
          if (change.field !== 'messages') continue;

          const value = change.value;

          for (const message of value.messages || []) {
            await this.processMessage(message, value);
          }
        }
      }

      res.sendStatus(200);
    } catch {
      console.error('Error processing WhatsApp webhook');
      res.sendStatus(500);
    }
  }

  private async processMessage(message: any, _value: any): Promise<void> {
    const messageId = message.id;
    const phone = message.from;
    const messageType = message.type;

    const existing = await this.prisma.whatsAppMessage.findUnique({
      where: { messageId },
    });

    if (existing) {
      return;
    }

    await this.prisma.whatsAppMessage.create({
      data: {
        messageId,
        phone,
        direction: 'INBOUND',
        content: this.extractContent(message, messageType),
        contentType: messageType,
        status: 'RECEIVED',
      },
    });

    if (messageType === 'image' || messageType === 'audio' || messageType === 'video') {
      const mediaObj = message[messageType] ?? {};
      await this.eventRouter.route({
        type: EventType.MEDIA_RECEIVED,
        source: EventSource.WHATSAPP,
        payload: {
          phone,
          kind: messageType === 'audio' ? 'audio' : 'image',
          url: mediaObj.id ?? '',
          mimeType: mediaObj.mime_type,
          message_id: messageId,
        },
      });
      return;
    }

    await this.eventRouter.route({
      type: EventType.WHATSAPP_MESSAGE_RECEIVED,
      source: EventSource.WHATSAPP,
      payload: {
        phone,
        message: this.extractContent(message, messageType),
        image: messageType === 'image' ? message.image?.id : undefined,
        message_id: messageId,
      },
    });
  }

  private extractContent(message: any, type: string): string {
    switch (type) {
      case 'text':
        return message.text?.body || '';
      case 'image':
        return message.image?.caption || '[Image]';
      case 'audio':
        return message.audio?.voice ? '[Voice note]' : '[Audio]';
      case 'document':
        return message.document?.filename || '[Document]';
      default:
        return `[${type}]`;
    }
  }
}
