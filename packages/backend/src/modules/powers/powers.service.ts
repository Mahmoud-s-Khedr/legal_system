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
import { prisma } from "../../db/prisma.js";
import { withTenant } from "../../db/tenant.js";
import { writeAuditLog, writeReadAuditLog, type AuditContext } from "../../services/audit.service.js";

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

const poaSelect = {
  id: true,
  firmId: true,
  clientId: true,
  caseId: true,
  number: true,
  type: true,
  status: true,
  issuedAt: true,
  expiresAt: true,
  revokedAt: true,
  revocationReason: true,
  scopeTextAr: true,
  hasSelfContractClause: true,
  commercialRegisterId: true,
  agentCertExpiry: true,
  agentResidencyStatus: true,
  createdAt: true,
  updatedAt: true,
  client: { select: { name: true } }
} as const;

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
  const poa = await prisma.powerOfAttorney.findUnique({
    where: { id: poaId },
    select: { status: true }
  });
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
  const where = {
    firmId: actor.firmId,
    ...(filters.clientId ? { clientId: filters.clientId } : {}),
    ...(filters.caseId ? { caseId: filters.caseId } : {}),
    ...(filters.status ? { status: filters.status as unknown as PrismaPoaStatus } : {})
  };

  const [items, total] = await Promise.all([
    prisma.powerOfAttorney.findMany({
      where,
      select: poaSelect,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit
    }),
    prisma.powerOfAttorney.count({ where })
  ]);

  return { items: items.map(mapPoa), total, page, pageSize: limit };
}

export async function getPower(
  actor: SessionUser,
  id: string,
  audit: AuditContext
): Promise<PowerOfAttorneyDto> {
  const poa = await prisma.powerOfAttorney.findFirst({
    where: { id, firmId: actor.firmId },
    select: poaSelect
  });
  if (!poa) throw httpError("Power of attorney not found", 404);

  // READ audit (Law 151/2020)
  await writeReadAuditLog(prisma, audit, "PowerOfAttorney", id);

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

  await withTenant(prisma, actor.firmId, async (tx) => {
    const created = await tx.powerOfAttorney.create({
      data: {
        firmId: actor.firmId,
        clientId: dto.clientId,
        caseId: dto.caseId ?? null,
        number: dto.number ?? null,
        type: dto.type as unknown as PrismaPoaType,
        status: PoaStatus.ACTIVE as unknown as PrismaPoaStatus,
        issuedAt: dto.issuedAt ? new Date(dto.issuedAt) : null,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        scopeTextAr: dto.scopeTextAr ?? null,
        hasSelfContractClause: dto.hasSelfContractClause ?? false,
        commercialRegisterId: dto.commercialRegisterId ?? null,
        agentCertExpiry: dto.agentCertExpiry ? new Date(dto.agentCertExpiry) : null,
        agentResidencyStatus: dto.agentResidencyStatus ?? null
      },
      select: poaSelect
    });

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
  const existing = await prisma.powerOfAttorney.findFirst({
    where: { id, firmId: actor.firmId },
    select: { id: true, status: true }
  });
  if (!existing) throw httpError("Power of attorney not found", 404);
  if (existing.status === (PoaStatus.REVOKED as unknown as PrismaPoaStatus)) {
    throw httpError("Cannot edit a revoked power of attorney", 422);
  }

  let poa!: PowerOfAttorneyDto;

  await withTenant(prisma, actor.firmId, async (tx) => {
    const updated = await tx.powerOfAttorney.update({
      where: { id },
      data: {
        number: dto.number ?? undefined,
        issuedAt: dto.issuedAt ? new Date(dto.issuedAt) : undefined,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
        scopeTextAr: dto.scopeTextAr ?? undefined,
        hasSelfContractClause: dto.hasSelfContractClause ?? undefined,
        commercialRegisterId: dto.commercialRegisterId ?? undefined,
        agentCertExpiry: dto.agentCertExpiry ? new Date(dto.agentCertExpiry) : undefined,
        agentResidencyStatus: dto.agentResidencyStatus ?? undefined
      },
      select: poaSelect
    });

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
  const existing = await prisma.powerOfAttorney.findFirst({
    where: { id, firmId: actor.firmId },
    select: { id: true, status: true }
  });
  if (!existing) throw httpError("Power of attorney not found", 404);
  if (existing.status === (PoaStatus.REVOKED as unknown as PrismaPoaStatus)) {
    throw httpError("Power of attorney is already revoked", 422);
  }

  let poa!: PowerOfAttorneyDto;
  const now = new Date();

  await withTenant(prisma, actor.firmId, async (tx) => {
    const updated = await tx.powerOfAttorney.update({
      where: { id },
      data: {
        status: PoaStatus.REVOKED as unknown as PrismaPoaStatus,
        revokedAt: now,
        revocationReason: dto.reason ?? null
      },
      select: poaSelect
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
  const existing = await prisma.powerOfAttorney.findFirst({
    where: { id, firmId: actor.firmId },
    select: { id: true }
  });
  if (!existing) throw httpError("Power of attorney not found", 404);

  await withTenant(prisma, actor.firmId, async (tx) => {
    await tx.powerOfAttorney.delete({ where: { id } });
    await writeAuditLog(tx, audit, {
      action: "DELETE",
      entityType: "PowerOfAttorney",
      entityId: id
    });
  });
}
