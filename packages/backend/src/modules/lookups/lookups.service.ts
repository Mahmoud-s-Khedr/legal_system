import type { LookupOptionDto, LookupOptionListResponseDto, CreateLookupOptionDto, UpdateLookupOptionDto, SessionUser } from "@elms/shared";
import { writeAuditLog, type AuditContext } from "../../services/audit.service.js";
import { appError } from "../../errors/appError.js";
import { inTenantTransaction } from "../../repositories/unitOfWork.js";
import type { LookupEntity } from "./lookups.types.js";
import {
  createFirmLookupOption,
  deleteLookupOptionById,
  findFirmLookupOptionByKey,
  getFirmLookupOptionByIdOrThrow,
  listActiveLookupOptionsByEntity,
  type LookupOptionRecord,
  updateLookupOptionById
} from "../../repositories/lookups/lookups.repository.js";

function mapLookupOption(row: LookupOptionRecord): LookupOptionDto {
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
  return inTenantTransaction(actor.firmId, async (tx) => {
    const items = await listActiveLookupOptionsByEntity(tx, actor.firmId, entity);

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
  return inTenantTransaction(actor.firmId, async (tx) => {
    const existing = await findFirmLookupOptionByKey(tx, actor.firmId, entity, payload.key);
    if (existing) {
      throw appError(`A ${entity} option with key "${payload.key}" already exists`, 409);
    }

    const option = await createFirmLookupOption(tx, actor.firmId, entity, payload);

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
  return inTenantTransaction(actor.firmId, async (tx) => {
    const existing = await getFirmLookupOptionByIdOrThrow(tx, actor.firmId, entity, optionId);

    if (existing.isSystem) {
      throw appError("System lookup options cannot be modified", 403);
    }

    const option = await updateLookupOptionById(tx, optionId, payload);

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
  return inTenantTransaction(actor.firmId, async (tx) => {
    const existing = await getFirmLookupOptionByIdOrThrow(tx, actor.firmId, entity, optionId);

    if (existing.isSystem) {
      throw appError("System lookup options cannot be deleted", 403);
    }

    await deleteLookupOptionById(tx, optionId);

    await writeAuditLog(tx, audit, {
      action: "lookups.delete",
      entityType: "LookupOption",
      entityId: optionId,
      oldData: { entity, key: existing.key }
    });

    return { success: true as const };
  });
}
