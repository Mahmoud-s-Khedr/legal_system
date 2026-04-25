import { prisma } from "../../db/prisma.js";
import type { FirmLifecycleStatus } from "@elms/shared";

export async function findFirmForLicenseActivation(firmId: string) {
  return prisma.firm.findUnique({
    where: { id: firmId },
    select: {
      id: true,
      editionKey: true,
      pendingEditionKey: true,
      lifecycleStatus: true,
      settings: {
        select: {
          licenseKeyHash: true
        }
      }
    }
  });
}

export async function applyLicenseActivation(
  input: {
    firmId: string;
    keyHash: string;
    activatedAt: Date;
    editionKey: string;
    lifecycleStatus: FirmLifecycleStatus;
  }
): Promise<void> {
  await prisma.$transaction([
    prisma.firmSettings.upsert({
      where: { firmId: input.firmId },
      create: {
        firmId: input.firmId,
        timezone: "Africa/Cairo",
        licenseKeyHash: input.keyHash,
        licenseActivatedAt: input.activatedAt
      },
      update: {
        licenseKeyHash: input.keyHash,
        licenseActivatedAt: input.activatedAt
      }
    }),
    prisma.firm.update({
      where: { id: input.firmId },
      data: {
        lifecycleStatus: input.lifecycleStatus as never,
        editionKey: input.editionKey as never,
        pendingEditionKey: null
      }
    })
  ]);
}

export async function listLifecycleSweepFirms() {
  return prisma.firm.findMany({
    where: {
      deletedAt: null
    },
    select: {
      id: true,
      editionKey: true,
      lifecycleStatus: true,
      createdAt: true,
      trialStartedAt: true,
      trialEndsAt: true,
      graceEndsAt: true,
      suspendedAt: true,
      deletionDueAt: true,
      deletedAt: true
    }
  });
}

export async function updateFirmLifecycleById(
  firmId: string,
  data: Record<string, unknown>
): Promise<void> {
  await prisma.firm.update({
    where: { id: firmId },
    data: data as Parameters<typeof prisma.firm.update>[0]["data"]
  });
}
