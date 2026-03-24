import type { LookupOptionDto, LookupOptionListResponseDto, CreateLookupOptionDto, UpdateLookupOptionDto, SessionUser } from "@elms/shared";
import { prisma } from "../../db/prisma.js";
import { withTenant } from "../../db/tenant.js";
import { writeAuditLog, type AuditContext } from "../../services/audit.service.js";

export const LOOKUP_ENTITIES = [
  "CaseType",
  "CourtLevel",
  "PartyRole",
  "DocumentType",
  "PaymentMethod",
  "FeeType",
  "ExpenseCategory",
  "LibraryDocType"
] as const;

export type LookupEntity = (typeof LOOKUP_ENTITIES)[number];

function mapLookupOption(row: {
  id: string;
  firmId: string | null;
  entity: string;
  key: string;
  labelAr: string;
  labelEn: string;
  labelFr: string;
  isSystem: boolean;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}): LookupOptionDto {
  return {
    id: row.id,
    firmId: row.firmId,
    entity: row.entity,
    key: row.key,
    labelAr: row.labelAr,
    labelEn: row.labelEn,
    labelFr: row.labelFr,
    isSystem: row.isSystem,
    isActive: row.isActive,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

export async function listLookupOptions(
  actor: SessionUser,
  entity: LookupEntity
): Promise<LookupOptionListResponseDto> {
  return withTenant(prisma, actor.firmId, async (tx) => {
    const items = await tx.lookupOption.findMany({
      where: {
        entity,
        isActive: true,
        OR: [{ firmId: null }, { firmId: actor.firmId }]
      },
      orderBy: [{ isSystem: "desc" }, { sortOrder: "asc" }, { key: "asc" }]
    });

    return {
      items: items.map(mapLookupOption),
      total: items.length,
      page: 1,
      pageSize: items.length
    };
  });
}

export async function createLookupOption(
  actor: SessionUser,
  entity: LookupEntity,
  payload: CreateLookupOptionDto,
  audit: AuditContext
): Promise<LookupOptionDto> {
  return withTenant(prisma, actor.firmId, async (tx) => {
    const existing = await tx.lookupOption.findFirst({
      where: { firmId: actor.firmId, entity, key: payload.key }
    });
    if (existing) {
      const err = new Error(`A ${entity} option with key "${payload.key}" already exists`) as Error & { statusCode: number };
      err.statusCode = 409;
      throw err;
    }

    const option = await tx.lookupOption.create({
      data: {
        firmId: actor.firmId,
        entity,
        key: payload.key,
        labelAr: payload.labelAr,
        labelEn: payload.labelEn,
        labelFr: payload.labelFr,
        isSystem: false,
        isActive: true,
        sortOrder: payload.sortOrder ?? 99
      }
    });

    await writeAuditLog(tx, audit, {
      action: "lookups.create",
      entityType: "LookupOption",
      entityId: option.id,
      newData: { entity, key: payload.key }
    });

    return mapLookupOption(option);
  });
}

export async function updateLookupOption(
  actor: SessionUser,
  entity: LookupEntity,
  optionId: string,
  payload: UpdateLookupOptionDto,
  audit: AuditContext
): Promise<LookupOptionDto> {
  return withTenant(prisma, actor.firmId, async (tx) => {
    const existing = await tx.lookupOption.findFirstOrThrow({
      where: { id: optionId, entity, firmId: actor.firmId }
    });

    if (existing.isSystem) {
      const err = new Error("System lookup options cannot be modified") as Error & { statusCode: number };
      err.statusCode = 403;
      throw err;
    }

    const option = await tx.lookupOption.update({
      where: { id: optionId },
      data: {
        labelAr: payload.labelAr,
        labelEn: payload.labelEn,
        labelFr: payload.labelFr,
        isActive: payload.isActive,
        sortOrder: payload.sortOrder
      }
    });

    await writeAuditLog(tx, audit, {
      action: "lookups.update",
      entityType: "LookupOption",
      entityId: optionId,
      newData: { labelEn: payload.labelEn, isActive: payload.isActive }
    });

    return mapLookupOption(option);
  });
}

export async function deleteLookupOption(
  actor: SessionUser,
  entity: LookupEntity,
  optionId: string,
  audit: AuditContext
): Promise<{ success: true }> {
  return withTenant(prisma, actor.firmId, async (tx) => {
    const existing = await tx.lookupOption.findFirstOrThrow({
      where: { id: optionId, entity, firmId: actor.firmId }
    });

    if (existing.isSystem) {
      const err = new Error("System lookup options cannot be deleted") as Error & { statusCode: number };
      err.statusCode = 403;
      throw err;
    }

    await tx.lookupOption.delete({ where: { id: optionId } });

    await writeAuditLog(tx, audit, {
      action: "lookups.delete",
      entityType: "LookupOption",
      entityId: optionId,
      oldData: { entity, key: existing.key }
    });

    return { success: true as const };
  });
}
