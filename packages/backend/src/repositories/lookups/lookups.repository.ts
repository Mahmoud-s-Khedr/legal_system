import type { LookupOption } from "@prisma/client";
import type { CreateLookupOptionDto, UpdateLookupOptionDto } from "@elms/shared";
import type { LookupEntity } from "../../modules/lookups/lookups.types.js";
import type { RepositoryTx } from "../types.js";

type ActiveLookupOrderBy =
  | { isSystem: "asc" | "desc" }
  | { sortOrder: "asc" | "desc" }
  | { key: "asc" | "desc" };

const ACTIVE_LOOKUP_ORDER: ActiveLookupOrderBy[] = [{ isSystem: "desc" }, { sortOrder: "asc" }, { key: "asc" }];

export type LookupOptionRecord = LookupOption;

export async function listActiveLookupOptionsByEntity(
  tx: RepositoryTx,
  firmId: string,
  entity: LookupEntity
): Promise<LookupOptionRecord[]> {
  return tx.lookupOption.findMany({
    where: {
      entity,
      isActive: true,
      OR: [{ firmId: null }, { firmId }]
    },
    orderBy: ACTIVE_LOOKUP_ORDER
  });
}

export async function findFirmLookupOptionByKey(
  tx: RepositoryTx,
  firmId: string,
  entity: LookupEntity,
  key: string
): Promise<LookupOptionRecord | null> {
  return tx.lookupOption.findFirst({
    where: { firmId, entity, key }
  });
}

export async function createFirmLookupOption(
  tx: RepositoryTx,
  firmId: string,
  entity: LookupEntity,
  payload: CreateLookupOptionDto
): Promise<LookupOptionRecord> {
  return tx.lookupOption.create({
    data: {
      firmId,
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
}

export async function getFirmLookupOptionByIdOrThrow(
  tx: RepositoryTx,
  firmId: string,
  entity: LookupEntity,
  optionId: string
): Promise<LookupOptionRecord> {
  return tx.lookupOption.findFirstOrThrow({
    where: { id: optionId, entity, firmId }
  });
}

export async function updateLookupOptionById(
  tx: RepositoryTx,
  optionId: string,
  payload: UpdateLookupOptionDto
): Promise<LookupOptionRecord> {
  return tx.lookupOption.update({
    where: { id: optionId },
    data: {
      labelAr: payload.labelAr,
      labelEn: payload.labelEn,
      labelFr: payload.labelFr,
      isActive: payload.isActive,
      sortOrder: payload.sortOrder
    }
  });
}

export async function deleteLookupOptionById(tx: RepositoryTx, optionId: string): Promise<void> {
  await tx.lookupOption.delete({ where: { id: optionId } });
}
