import { FirmLifecycleStatus, type EditionKey } from "@elms/shared";
import type { Prisma } from "@prisma/client";
import type { RepositoryTx } from "../types.js";

type FirmWithSettingsSelect = {
  settings: true;
};

type FirmSubscriptionSelect = {
  createdAt: true;
  trialStartedAt: true;
  editionKey: true;
  pendingEditionKey: true;
  lifecycleStatus: true;
  trialEndsAt: true;
  graceEndsAt: true;
  deletionDueAt: true;
};

const FIRM_WITH_SETTINGS_SELECT: FirmWithSettingsSelect = {
  settings: true
};

const FIRM_SUBSCRIPTION_SELECT: FirmSubscriptionSelect = {
  createdAt: true,
  trialStartedAt: true,
  editionKey: true,
  pendingEditionKey: true,
  lifecycleStatus: true,
  trialEndsAt: true,
  graceEndsAt: true,
  deletionDueAt: true
};

export type FirmWithSettingsRecord = Prisma.FirmGetPayload<{ include: typeof FIRM_WITH_SETTINGS_SELECT }>;
export type FirmSubscriptionRecord = Prisma.FirmGetPayload<{ select: typeof FIRM_SUBSCRIPTION_SELECT }>;

export async function getFirmWithSettingsByIdOrThrow(
  tx: RepositoryTx,
  firmId: string
): Promise<FirmWithSettingsRecord> {
  return tx.firm.findUniqueOrThrow({
    where: { id: firmId },
    include: FIRM_WITH_SETTINGS_SELECT
  });
}

export async function getFirmSubscriptionByIdOrThrow(
  tx: RepositoryTx,
  firmId: string
): Promise<FirmSubscriptionRecord> {
  return tx.firm.findUniqueOrThrow({
    where: { id: firmId },
    select: FIRM_SUBSCRIPTION_SELECT
  });
}

export async function upsertFirmSettingsForEditionChange(tx: RepositoryTx, firmId: string): Promise<void> {
  await tx.firmSettings.upsert({
    where: { firmId },
    create: {
      firmId,
      timezone: "Africa/Cairo",
      licenseKeyHash: null,
      licenseActivatedAt: null
    },
    update: {
      licenseKeyHash: null,
      licenseActivatedAt: null
    }
  });
}

export async function requestFirmEditionChange(
  tx: RepositoryTx,
  firmId: string,
  editionKey: EditionKey
): Promise<void> {
  await tx.firm.update({
    where: { id: firmId },
    data: {
      pendingEditionKey: editionKey,
      lifecycleStatus: FirmLifecycleStatus.ACTIVE,
      suspendedAt: null
    }
  });
}
