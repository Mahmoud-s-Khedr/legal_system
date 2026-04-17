import {
  EditionKey,
  FirmLifecycleStatus,
  type FirmMeResponseDto,
  type RequestEditionChangeDto,
  type FirmSubscriptionDto,
  type FirmType,
  type Language,
  type SessionUser
} from "@elms/shared";
import { prisma } from "../../db/prisma.js";
import { withTenant } from "../../db/tenant.js";
import { isTrialEnabled } from "../editions/editionPolicy.js";
import { resolveTrialDates } from "../editions/trialDates.js";
import { appError } from "../../errors/appError.js";

const SELF_SERVE_EDITION_CHANGE_TARGETS = new Set<EditionKey>([
  EditionKey.SOLO_OFFLINE,
  EditionKey.SOLO_ONLINE,
  EditionKey.LOCAL_FIRM_OFFLINE,
  EditionKey.LOCAL_FIRM_ONLINE
]);

export async function getCurrentFirm(actor: SessionUser): Promise<FirmMeResponseDto> {
  return withTenant(prisma, actor.firmId, async (tx) => {
    const firm = await tx.firm.findUniqueOrThrow({
      where: { id: actor.firmId },
      include: {
        settings: true
      }
    });

    const trialEndsAt = getTrialEndsAtIsoOrNull({
      trialEnabled: isTrialEnabled(firm.editionKey),
      createdAt: firm.createdAt,
      trialStartedAt: firm.trialStartedAt,
      trialEndsAt: firm.trialEndsAt
    });

    return {
      firm: {
        id: firm.id,
        name: firm.name,
        slug: firm.slug,
        type: firm.type as FirmType,
        editionKey: firm.editionKey as FirmMeResponseDto["firm"]["editionKey"],
        pendingEditionKey: firm.pendingEditionKey as FirmMeResponseDto["firm"]["pendingEditionKey"],
        trialEnabled: isTrialEnabled(firm.editionKey),
        lifecycleStatus: firm.lifecycleStatus as FirmMeResponseDto["firm"]["lifecycleStatus"],
        isLicensed: firm.lifecycleStatus === FirmLifecycleStatus.LICENSED,
        licenseRequired:
          !isTrialEnabled(firm.editionKey) &&
          firm.lifecycleStatus !== FirmLifecycleStatus.LICENSED,
        trialEndsAt,
        graceEndsAt: firm.graceEndsAt?.toISOString() ?? null,
        dataDeletionDueAt: firm.deletionDueAt?.toISOString() ?? null,
        defaultLanguage: firm.defaultLanguage as Language
      },
      settings: firm.settings
        ? {
            preferredLanguage: firm.settings.preferredLanguage as Language,
            timezone: firm.settings.timezone,
            currency: firm.settings.currency
          }
        : null
    };
  });
}

export async function getCurrentFirmSubscription(actor: SessionUser): Promise<FirmSubscriptionDto> {
  return withTenant(prisma, actor.firmId, async (tx) => {
    const firm = await tx.firm.findUniqueOrThrow({
      where: { id: actor.firmId },
      select: {
        createdAt: true,
        trialStartedAt: true,
        editionKey: true,
        pendingEditionKey: true,
        lifecycleStatus: true,
        trialEndsAt: true,
        graceEndsAt: true,
        deletionDueAt: true
      }
    });

    const trialEndsAt = getTrialEndsAtIsoOrNull({
      trialEnabled: isTrialEnabled(firm.editionKey),
      createdAt: firm.createdAt,
      trialStartedAt: firm.trialStartedAt,
      trialEndsAt: firm.trialEndsAt
    });

    return {
      editionKey: firm.editionKey as FirmSubscriptionDto["editionKey"],
      pendingEditionKey: firm.pendingEditionKey as FirmSubscriptionDto["pendingEditionKey"],
      trialEnabled: isTrialEnabled(firm.editionKey),
      lifecycleStatus: firm.lifecycleStatus as FirmSubscriptionDto["lifecycleStatus"],
      isLicensed: firm.lifecycleStatus === FirmLifecycleStatus.LICENSED,
      licenseRequired:
        (firm.pendingEditionKey != null || !isTrialEnabled(firm.editionKey)) &&
        firm.lifecycleStatus !== FirmLifecycleStatus.LICENSED,
      trialEndsAt,
      graceEndsAt: firm.graceEndsAt?.toISOString() ?? null,
      dataDeletionDueAt: firm.deletionDueAt?.toISOString() ?? null
    };
  });
}

function makeHttpError(message: string, statusCode: number) {
  return appError(message, statusCode);
}

export async function requestEditionChange(
  actor: SessionUser,
  payload: RequestEditionChangeDto
): Promise<FirmSubscriptionDto> {
  if (!SELF_SERVE_EDITION_CHANGE_TARGETS.has(payload.editionKey)) {
    throw makeHttpError("Edition change target is not supported for self-serve", 400);
  }

  return withTenant(prisma, actor.firmId, async (tx) => {
    await tx.firmSettings.upsert({
      where: { firmId: actor.firmId },
      create: {
        firmId: actor.firmId,
        timezone: "Africa/Cairo",
        licenseKeyHash: null,
        licenseActivatedAt: null
      },
      update: {
        licenseKeyHash: null,
        licenseActivatedAt: null
      }
    });
    await tx.firm.update({
      where: { id: actor.firmId },
      data: {
        pendingEditionKey: payload.editionKey,
        lifecycleStatus: FirmLifecycleStatus.ACTIVE,
        suspendedAt: null
      }
    });

    const firm = await tx.firm.findUniqueOrThrow({
      where: { id: actor.firmId },
      select: {
        createdAt: true,
        trialStartedAt: true,
        editionKey: true,
        pendingEditionKey: true,
        lifecycleStatus: true,
        trialEndsAt: true,
        graceEndsAt: true,
        deletionDueAt: true
      }
    });

    const trialEndsAt = getTrialEndsAtIsoOrNull({
      trialEnabled: isTrialEnabled(firm.editionKey),
      createdAt: firm.createdAt,
      trialStartedAt: firm.trialStartedAt,
      trialEndsAt: firm.trialEndsAt
    });

    return {
      editionKey: firm.editionKey as FirmSubscriptionDto["editionKey"],
      pendingEditionKey: firm.pendingEditionKey as FirmSubscriptionDto["pendingEditionKey"],
      trialEnabled: isTrialEnabled(firm.editionKey),
      lifecycleStatus: firm.lifecycleStatus as FirmSubscriptionDto["lifecycleStatus"],
      isLicensed: firm.lifecycleStatus === FirmLifecycleStatus.LICENSED,
      licenseRequired:
        (firm.pendingEditionKey != null || !isTrialEnabled(firm.editionKey)) &&
        firm.lifecycleStatus !== FirmLifecycleStatus.LICENSED,
      trialEndsAt,
      graceEndsAt: firm.graceEndsAt?.toISOString() ?? null,
      dataDeletionDueAt: firm.deletionDueAt?.toISOString() ?? null
    };
  });
}

function getTrialEndsAtIsoOrNull(input: {
  trialEnabled: boolean;
  createdAt: Date;
  trialStartedAt: Date | null;
  trialEndsAt: Date | null;
}): string | null {
  if (!input.trialEnabled) {
    return input.trialEndsAt?.toISOString() ?? null;
  }

  return resolveTrialDates({
    createdAt: input.createdAt,
    trialStartedAt: input.trialStartedAt,
    trialEndsAt: input.trialEndsAt
  }).trialEndsAt.toISOString();
}
