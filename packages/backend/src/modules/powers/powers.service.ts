import type {
  CreatePowerOfAttorneyDto,
  PowerOfAttorneyDto,
  PowerOfAttorneyListResponseDto,
  RevokePowerOfAttorneyDto,
  SessionUser,
  UpdatePowerOfAttorneyDto
} from "@elms/shared";
import { PoaStatus, PoaType } from "@elms/shared";
import type { PoaStatus as PrismaPoaStatus, PoaType as PrismaPoaType } from "@prisma/client";
import { writeAuditLog, writeReadAuditLog, type AuditContext } from "../../services/audit.service.js";
import { inTenantTransaction } from "../../repositories/unitOfWork.js";
import {
  createFirmPower,
  deleteFirmPower,
  findFirmPowerById,
  findFirmPowerMinimalById,
  findPowerStatusById,
  listFirmPowers,
  poaSelect,
  revokeFirmPower,
  updateFirmPower
} from "../../repositories/powers/powers.repository.js";

// ── Mapper ────────────────────────────────────────────────────────────────────

function mapPoa(p: {
  id: string;
  firmId: string;
  clientId: string;
  caseId: string | null;
  number: string | null;
  type: PrismaPoaType;
  status: PrismaPoaStatus;
  issuedAt: Date | null;
  expiresAt: Date | null;
  revokedAt: Date | null;
  revocationReason: string | null;
  scopeTextAr: string | null;
  hasSelfContractClause: boolean;
  commercialRegisterId: string | null;
  agentCertExpiry: Date | null;
  agentResidencyStatus: string | null;
  createdAt: Date;
  updatedAt: Date;
  client: { name: string };
}): PowerOfAttorneyDto {
  return {
    id: p.id,
    firmId: p.firmId,
    clientId: p.clientId,
    clientName: p.client.name,
    caseId: p.caseId,
    number: p.number,
    type: p.type as PoaType,
    status: p.status as PoaStatus,
    issuedAt: p.issuedAt?.toISOString() ?? null,
    expiresAt: p.expiresAt?.toISOString() ?? null,
    revokedAt: p.revokedAt?.toISOString() ?? null,
    revocationReason: p.revocationReason,
    scopeTextAr: p.scopeTextAr,
    hasSelfContractClause: p.hasSelfContractClause,
    commercialRegisterId: p.commercialRegisterId,
    agentCertExpiry: p.agentCertExpiry?.toISOString() ?? null,
    agentResidencyStatus: p.agentResidencyStatus,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString()
  };
}

// ── Guards ────────────────────────────────────────────────────────────────────

function httpError(msg: string, code: number) {
  return Object.assign(new Error(msg), { statusCode: code });
}

/**
 * Assert that the given POA is not in REVOKED status.
 * Called by documents, billing, and hearings services before write operations
 * that require an active power of attorney.
 */
export async function assertPoaNotRevoked(poaId: string): Promise<void> {
  const poa = await findPowerStatusById(poaId);
  if (!poa) {
    throw httpError("Power of attorney not found", 404);
  }
  if (poa.status === (PoaStatus.REVOKED as unknown as PrismaPoaStatus)) {
    throw httpError(
      "توكيل ملغى — لا يمكن إتمام هذه العملية",
      422
    );
  }
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

export async function listPowers(
  actor: SessionUser,
  filters: { clientId?: string; caseId?: string; status?: PoaStatus },
  pagination: { page: number; limit: number } = { page: 1, limit: 50 }
): Promise<PowerOfAttorneyListResponseDto> {
  const { page, limit } = pagination;
  const { items, total } = await inTenantTransaction(actor.firmId, async (tx) =>
    listFirmPowers(tx, {
      firmId: actor.firmId,
      clientId: filters.clientId,
      caseId: filters.caseId,
      status: filters.status as unknown as PrismaPoaStatus,
      page,
      limit
    })
  );

  return { items: items.map(mapPoa), total, page, pageSize: limit };
}

export async function getPower(
  actor: SessionUser,
  id: string,
  audit: AuditContext
): Promise<PowerOfAttorneyDto> {
  const poa = await inTenantTransaction(actor.firmId, async (tx) =>
    findFirmPowerById(tx, actor.firmId, id)
  );
  if (!poa) throw httpError("Power of attorney not found", 404);

  // READ audit (Law 151/2020)
  await inTenantTransaction(actor.firmId, async (tx) =>
    writeReadAuditLog(tx, audit, "PowerOfAttorney", id)
  );

  return mapPoa(poa);
}

export async function createPower(
  actor: SessionUser,
  dto: CreatePowerOfAttorneyDto,
  audit: AuditContext
): Promise<PowerOfAttorneyDto> {
  // Validate SPECIAL type requires scopeTextAr
  if (dto.type === PoaType.SPECIAL && !dto.scopeTextAr) {
    throw httpError("scopeTextAr is required for SPECIAL power of attorney type", 400);
  }

  let poa!: PowerOfAttorneyDto;

  await inTenantTransaction(actor.firmId, async (tx) => {
    const created = await createFirmPower(tx, { firmId: actor.firmId, dto });

    await writeAuditLog(tx, audit, {
      action: "CREATE",
      entityType: "PowerOfAttorney",
      entityId: created.id,
      newData: { type: created.type, status: created.status, clientId: created.clientId }
    });

    poa = mapPoa(created);
  });

  return poa;
}

export async function updatePower(
  actor: SessionUser,
  id: string,
  dto: UpdatePowerOfAttorneyDto,
  audit: AuditContext
): Promise<PowerOfAttorneyDto> {
  const existing = await inTenantTransaction(actor.firmId, async (tx) =>
    findFirmPowerMinimalById(tx, actor.firmId, id)
  );
  if (!existing) throw httpError("Power of attorney not found", 404);
  if (existing.status === (PoaStatus.REVOKED as unknown as PrismaPoaStatus)) {
    throw httpError("Cannot edit a revoked power of attorney", 422);
  }

  let poa!: PowerOfAttorneyDto;

  await inTenantTransaction(actor.firmId, async (tx) => {
    const updated = await updateFirmPower(tx, { firmId: actor.firmId, id, dto });

    await writeAuditLog(tx, audit, {
      action: "UPDATE",
      entityType: "PowerOfAttorney",
      entityId: id,
      oldData: { status: existing.status },
      newData: { number: updated.number, expiresAt: updated.expiresAt }
    });

    poa = mapPoa(updated);
  });

  return poa;
}

export async function revokePower(
  actor: SessionUser,
  id: string,
  dto: RevokePowerOfAttorneyDto,
  audit: AuditContext
): Promise<PowerOfAttorneyDto> {
  const existing = await inTenantTransaction(actor.firmId, async (tx) =>
    findFirmPowerMinimalById(tx, actor.firmId, id)
  );
  if (!existing) throw httpError("Power of attorney not found", 404);
  if (existing.status === (PoaStatus.REVOKED as unknown as PrismaPoaStatus)) {
    throw httpError("Power of attorney is already revoked", 422);
  }

  let poa!: PowerOfAttorneyDto;
  const now = new Date();

  await inTenantTransaction(actor.firmId, async (tx) => {
    const updated = await revokeFirmPower(tx, {
      firmId: actor.firmId,
      id,
      reason: dto.reason ?? null,
      revokedAt: now
    });

    await writeAuditLog(tx, audit, {
      action: "REVOKE",
      entityType: "PowerOfAttorney",
      entityId: id,
      oldData: { status: existing.status },
      newData: { status: PoaStatus.REVOKED, revokedAt: now.toISOString(), reason: dto.reason }
    });

    poa = mapPoa(updated);
  });

  return poa;
}

export async function deletePower(
  actor: SessionUser,
  id: string,
  audit: AuditContext
): Promise<void> {
  const existing = await inTenantTransaction(actor.firmId, async (tx) =>
    findFirmPowerMinimalById(tx, actor.firmId, id)
  );
  if (!existing) throw httpError("Power of attorney not found", 404);

  await inTenantTransaction(actor.firmId, async (tx) => {
    await deleteFirmPower(tx, actor.firmId, id);
    await writeAuditLog(tx, audit, {
      action: "DELETE",
      entityType: "PowerOfAttorney",
      entityId: id
    });
  });
}
