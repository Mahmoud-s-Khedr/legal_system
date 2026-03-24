import {
  type FirmMeResponseDto,
  type FirmSubscriptionDto,
  type FirmType,
  type Language,
  type SessionUser
} from "@elms/shared";
import { prisma } from "../../db/prisma.js";
import { withTenant } from "../../db/tenant.js";
import { isTrialEnabled } from "../editions/editionPolicy.js";

export async function getCurrentFirm(actor: SessionUser): Promise<FirmMeResponseDto> {
  return withTenant(prisma, actor.firmId, async (tx) => {
    const firm = await tx.firm.findUniqueOrThrow({
      where: { id: actor.firmId },
      include: {
        settings: true
      }
    });

    return {
      firm: {
        id: firm.id,
        name: firm.name,
        slug: firm.slug,
        type: firm.type as FirmType,
        editionKey: firm.editionKey as FirmMeResponseDto["firm"]["editionKey"],
        trialEnabled: isTrialEnabled(firm.editionKey),
        lifecycleStatus: firm.lifecycleStatus as FirmMeResponseDto["firm"]["lifecycleStatus"],
        trialEndsAt: firm.trialEndsAt?.toISOString() ?? null,
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
        editionKey: true,
        lifecycleStatus: true,
        trialEndsAt: true,
        graceEndsAt: true,
        deletionDueAt: true
      }
    });

    return {
      editionKey: firm.editionKey as FirmSubscriptionDto["editionKey"],
      trialEnabled: isTrialEnabled(firm.editionKey),
      lifecycleStatus: firm.lifecycleStatus as FirmSubscriptionDto["lifecycleStatus"],
      trialEndsAt: firm.trialEndsAt?.toISOString() ?? null,
      graceEndsAt: firm.graceEndsAt?.toISOString() ?? null,
      dataDeletionDueAt: firm.deletionDueAt?.toISOString() ?? null
    };
  });
}
