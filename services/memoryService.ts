import type { MemoryNode } from "../types";

/**
 * Legacy prototype graph memory service (`memory_nodes`, `memory_relations`).
 *
 * Those collections do not exist in authoritative Firebase project `mvp1-aafa3`
 * and are denied by default in `apps/dukaan-in-next/firestore.rules`.
 *
 * Direct browser writes to unapproved root collections are disabled to prevent
 * divergent production data creation. Customer context should be served via
 * `shops/{shopId}/customers` and `apps/core-engine` `KnowledgeDoc` APIs.
 */
export const memoryService = {
  async remember(
    _storeId: string,
    _entityName: string,
    _type: MemoryNode["type"],
    _relationship: string,
    _targetEntityName: string,
    _properties: Record<string, unknown> = {},
  ): Promise<boolean> {
    return false;
  },

  async getOrCreateNode(
    storeId: string,
    entity: string,
    type: MemoryNode["type"],
  ): Promise<MemoryNode> {
    return {
      id: `disabled_${entity.toLowerCase()}`,
      storeId,
      entity: entity.toLowerCase(),
      type,
      properties: {},
      lastUpdated: new Date().toISOString(),
    };
  },

  async getContext(_storeId: string, _entityName: string): Promise<string[]> {
    return [];
  },
};
