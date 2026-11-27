import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { EventRouter } from '../../core/events/event-router';
import { InventoryService } from '../../core/services/inventory.service';
import { listTemplates, getTemplate } from '../../core/templates/business-templates';
import {
  EventType, EventSource, SaleAddSchema, InventoryIntentSchema, OnboardStartSchema, KnowledgeCapturedSchema,
} from '../../core/events/types';
import {
  CoreAuthenticatedRequest,
  requireCoreAuth,
  requireProductStoreAccess,
  requireStoreAccess,
} from '../middleware/auth.middleware';

export function createAppRoutes(eventRouter: EventRouter, prisma: PrismaClient): Router {
  const router = Router();
  const inventory = new InventoryService(prisma);

  router.post(
    '/sales',
    requireCoreAuth,
    requireStoreAccess((req) => req.body?.storeId || (req as CoreAuthenticatedRequest).coreAuth?.storeId || undefined),
    async (req: Request, res: Response) => {
      try {
        const verifiedStoreId =
          (req as CoreAuthenticatedRequest).coreAuth?.role === 'super_admin'
            ? req.body?.storeId
            : (req as CoreAuthenticatedRequest).coreAuth?.storeId;
        const eventData = SaleAddSchema.parse({
          type: EventType.SALE_ADD,
          source: EventSource.APP,
          payload: { ...req.body, storeId: verifiedStoreId },
        });

        await eventRouter.route(eventData);

        res.status(201).json({
          success: true,
          message: 'Sale recorded successfully',
        });
      } catch {
        res.status(400).json({
          success: false,
          error: 'Invalid sale payload.',
        });
      }
    },
  );

  // Public template metadata (read-only)
  router.get('/templates', (_req: Request, res: Response) => {
    res.json({ success: true, templates: listTemplates() });
  });

  router.get('/templates/:key', (req: Request, res: Response) => {
    const template = getTemplate(req.params.key);
    if (!template) return res.status(404).json({ success: false, error: 'Unknown template' });
    res.json({ success: true, template });
  });

  router.post('/onboard', requireCoreAuth, async (req: Request, res: Response) => {
    try {
      const event = OnboardStartSchema.parse({
        type: EventType.ONBOARD_START,
        source: EventSource.APP,
        payload: req.body,
      });
      await eventRouter.route(event);
      res.status(202).json({ success: true, message: 'Onboarding started' });
    } catch {
      res.status(400).json({ success: false, error: 'Invalid onboarding request.' });
    }
  });

  // Inventory (strictly tenant-scoped)
  router.get(
    '/stores/:storeId/inventory',
    requireCoreAuth,
    requireStoreAccess((req) => req.params.storeId, { allowFranchiseRead: true }),
    async (req: Request, res: Response) => {
      const snapshot = await inventory.stockSnapshot(req.params.storeId);
      res.json({ success: true, inventory: snapshot });
    },
  );

  router.get(
    '/stores/:storeId/low-stock',
    requireCoreAuth,
    requireStoreAccess((req) => req.params.storeId, { allowFranchiseRead: true }),
    async (req: Request, res: Response) => {
      const items = await inventory.lowStockProducts(req.params.storeId);
      res.json({ success: true, items });
    },
  );

  router.post(
    '/inventory/intent',
    requireCoreAuth,
    requireStoreAccess((req) => req.body?.storeId || (req as CoreAuthenticatedRequest).coreAuth?.storeId || undefined),
    async (req: Request, res: Response) => {
      try {
        const verifiedStoreId =
          (req as CoreAuthenticatedRequest).coreAuth?.role === 'super_admin'
            ? req.body?.storeId
            : (req as CoreAuthenticatedRequest).coreAuth?.storeId;
        const event = InventoryIntentSchema.parse({
          type: EventType.INVENTORY_INTENT,
          source: EventSource.APP,
          payload: { source: 'APP', confidence: 1, ...req.body, storeId: verifiedStoreId },
        });
        await eventRouter.route(event);
        res.status(202).json({ success: true, message: 'Inventory intent queued' });
      } catch {
        res.status(400).json({ success: false, error: 'Invalid inventory intent.' });
      }
    },
  );

  router.patch(
    '/products/:id',
    requireCoreAuth,
    requireProductStoreAccess(prisma),
    async (req: Request, res: Response) => {
      try {
        const product = await inventory.editProduct(req.params.id, req.body);
        res.json({ success: true, product });
      } catch {
        res.status(400).json({ success: false, error: 'Invalid product update.' });
      }
    },
  );

  router.post(
    '/products/:id/archive',
    requireCoreAuth,
    requireProductStoreAccess(prisma, { requireOwner: true }),
    async (req: Request, res: Response) => {
      await inventory.archiveProduct(req.params.id);
      res.json({ success: true });
    },
  );

  router.post(
    '/stores/:storeId/seed',
    requireCoreAuth,
    requireStoreAccess((req) => req.params.storeId, { requireOwner: true }),
    async (req: Request, res: Response) => {
      try {
        const result = await inventory.seedFromTemplate(req.params.storeId, req.body.templateKey);
        res.json({ success: true, ...result });
      } catch {
        res.status(400).json({ success: false, error: 'Failed to seed catalog template.' });
      }
    },
  );

  // Multi-modal capture (strictly tenant-scoped)
  router.post(
    '/media',
    requireCoreAuth,
    requireStoreAccess((req) => req.body?.storeId || (req as CoreAuthenticatedRequest).coreAuth?.storeId || undefined),
    async (req: Request, res: Response) => {
      try {
        const verifiedStoreId =
          (req as CoreAuthenticatedRequest).coreAuth?.role === 'super_admin'
            ? req.body?.storeId
            : (req as CoreAuthenticatedRequest).coreAuth?.storeId;
        const { kind, url, mimeType } = req.body;
        await eventRouter.route({
          type: EventType.MEDIA_RECEIVED,
          source: EventSource.APP,
          payload: { storeId: verifiedStoreId, kind, url, mimeType },
        });
        res.status(202).json({ success: true, message: 'Media queued for processing' });
      } catch {
        res.status(400).json({ success: false, error: 'Invalid media submission.' });
      }
    },
  );

  router.post(
    '/stores/:storeId/annotations',
    requireCoreAuth,
    requireStoreAccess((req) => req.params.storeId),
    async (req: Request, res: Response) => {
      try {
        const { assetId, label, box, note, target = 'MEDIA', targetId } = req.body;
        const annotation = await prisma.annotation.create({
          data: {
            storeId: req.params.storeId,
            assetId,
            target,
            targetId,
            label,
            box,
            note,
            createdBy: 'MERCHANT' as never,
          },
        });
        res.status(201).json({ success: true, annotation });
      } catch {
        res.status(400).json({ success: false, error: 'Invalid annotation payload.' });
      }
    },
  );

  // Store knowledge base (strictly tenant-scoped)
  router.post(
    '/knowledge',
    requireCoreAuth,
    requireStoreAccess((req) => req.body?.storeId || (req as CoreAuthenticatedRequest).coreAuth?.storeId || undefined, {
      requireOwner: true,
    }),
    async (req: Request, res: Response) => {
      try {
        const verifiedStoreId =
          (req as CoreAuthenticatedRequest).coreAuth?.role === 'super_admin'
            ? req.body?.storeId
            : (req as CoreAuthenticatedRequest).coreAuth?.storeId;
        const event = KnowledgeCapturedSchema.parse({
          type: EventType.KNOWLEDGE_CAPTURED,
          source: EventSource.APP,
          payload: { source: 'MANUAL', ...req.body, storeId: verifiedStoreId },
        });
        await eventRouter.route(event);
        res.status(202).json({ success: true, message: 'Knowledge capture queued' });
      } catch {
        res.status(400).json({ success: false, error: 'Invalid knowledge payload.' });
      }
    },
  );

  router.get(
    '/stores/:storeId/knowledge',
    requireCoreAuth,
    requireStoreAccess((req) => req.params.storeId, { allowFranchiseRead: true }),
    async (req: Request, res: Response) => {
      const docs = await prisma.knowledgeDoc.findMany({
        where: { storeId: req.params.storeId },
        orderBy: { createdAt: 'desc' },
      });
      res.json({ success: true, docs });
    },
  );

  router.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  return router;
}
