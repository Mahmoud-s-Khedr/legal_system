import type { CreatePowerOfAttorneyDto, UpdatePowerOfAttorneyDto } from "@elms/shared";
import { PoaStatus, type PoaStatus as PrismaPoaStatus, type PoaType as PrismaPoaType } from "@prisma/client";
import { prisma } from "../../db/prisma.js";
import type { RepositoryTx } from "../types.js";

export const poaSelect = {
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

export async function findPowerStatusById(id: string) {
  return prisma.powerOfAttorney.findUnique({ where: { id }, select: { status: true } });
}

export async function listFirmPowers(
  tx: RepositoryTx,
  input: {
    firmId: string;
    clientId?: string;
    caseId?: string;
    status?: PrismaPoaStatus;
    page: number;
    limit: number;
  }
) {
  const where = {
    firmId: input.firmId,
    ...(input.clientId ? { clientId: input.clientId } : {}),
    ...(input.caseId ? { caseId: input.caseId } : {}),
    ...(input.status ? { status: input.status } : {})
  };

  const [items, total] = await Promise.all([
    tx.powerOfAttorney.findMany({
      where,
      select: poaSelect,
      orderBy: { createdAt: "desc" },
      skip: (input.page - 1) * input.limit,
      take: input.limit
    }),
    tx.powerOfAttorney.count({ where })
  ]);

  return { items, total };
}

export async function findFirmPowerById(tx: RepositoryTx, firmId: string, id: string) {
  return tx.powerOfAttorney.findFirst({
    where: { id, firmId },
    select: poaSelect
  });
}

export async function findFirmPowerMinimalById(tx: RepositoryTx, firmId: string, id: string) {
  return tx.powerOfAttorney.findFirst({
    where: { id, firmId },
    select: { id: true, status: true }
  });
}

export async function createFirmPower(
  tx: RepositoryTx,
  input: { firmId: string; dto: CreatePowerOfAttorneyDto }
) {
  return tx.powerOfAttorney.create({
    data: {
      firmId: input.firmId,
      clientId: input.dto.clientId,
      caseId: input.dto.caseId ?? null,
      number: input.dto.number ?? null,
      type: input.dto.type as unknown as PrismaPoaType,
      status: PoaStatus.ACTIVE,
      issuedAt: input.dto.issuedAt ? new Date(input.dto.issuedAt) : null,
      expiresAt: input.dto.expiresAt ? new Date(input.dto.expiresAt) : null,
      scopeTextAr: input.dto.scopeTextAr ?? null,
      hasSelfContractClause: input.dto.hasSelfContractClause ?? false,
      commercialRegisterId: input.dto.commercialRegisterId ?? null,
      agentCertExpiry: input.dto.agentCertExpiry ? new Date(input.dto.agentCertExpiry) : null,
      agentResidencyStatus: input.dto.agentResidencyStatus ?? null
    },
    select: poaSelect
  });
}

export async function updateFirmPower(
  tx: RepositoryTx,
  input: { firmId: string; id: string; dto: UpdatePowerOfAttorneyDto }
) {
  return tx.powerOfAttorney.update({
    where: { id: input.id, firmId: input.firmId },
    data: {
      number: input.dto.number ?? undefined,
      issuedAt: input.dto.issuedAt ? new Date(input.dto.issuedAt) : undefined,
      expiresAt: input.dto.expiresAt ? new Date(input.dto.expiresAt) : undefined,
      scopeTextAr: input.dto.scopeTextAr ?? undefined,
      hasSelfContractClause: input.dto.hasSelfContractClause ?? undefined,
      commercialRegisterId: input.dto.commercialRegisterId ?? undefined,
      agentCertExpiry: input.dto.agentCertExpiry ? new Date(input.dto.agentCertExpiry) : undefined,
      agentResidencyStatus: input.dto.agentResidencyStatus ?? undefined
    },
    select: poaSelect
  });
}

export async function revokeFirmPower(
  tx: RepositoryTx,
  input: { firmId: string; id: string; reason: string | null; revokedAt: Date }
) {
  return tx.powerOfAttorney.update({
    where: { id: input.id, firmId: input.firmId },
    data: {
      status: PoaStatus.REVOKED,
      revokedAt: input.revokedAt,
      revocationReason: input.reason
    },
    select: poaSelect
  });
}

export async function deleteFirmPower(tx: RepositoryTx, firmId: string, id: string): Promise<void> {
  await tx.powerOfAttorney.delete({ where: { id, firmId } });
}
