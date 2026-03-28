import { FirmLifecycleStatus, type EditionKey } from "@elms/shared";
import { prisma } from "../../db/prisma.js";
import { isTrialEnabled } from "./editionPolicy.js";
import { resolveTrialDates } from "./trialDates.js";

export interface LifecycleSweepResult {
  scanned: number;
  updated: number;
  movedToGrace: number;
  movedToSuspended: number;
  movedToPendingDeletion: number;
  movedToDataDeletionPending: number;
  markedDeleted: number;
}

export async function runFirmLifecycleSweep(now = new Date()): Promise<LifecycleSweepResult> {
  const firms = await prisma.firm.findMany({
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

  const result: LifecycleSweepResult = {
    scanned: firms.length,
    updated: 0,
    movedToGrace: 0,
    movedToSuspended: 0,
    movedToPendingDeletion: 0,
    movedToDataDeletionPending: 0,
    markedDeleted: 0
  };

  for (const firm of firms) {
    // Skip firms that are already licensed — they are not subject to the trial sweep
    const status = firm.lifecycleStatus as FirmLifecycleStatus;
    if (status === FirmLifecycleStatus.LICENSED) {
      continue;
    }

    if (!isTrialEnabled(firm.editionKey as EditionKey)) {
      continue;
    }

    const patch: Record<string, Date | FirmLifecycleStatus | null> = {};

    const { trialStartedAt, trialEndsAt, graceEndsAt, deletionDueAt } = resolveTrialDates({
      createdAt: firm.createdAt,
      trialStartedAt: firm.trialStartedAt,
      trialEndsAt: firm.trialEndsAt,
      graceEndsAt: firm.graceEndsAt,
      deletionDueAt: firm.deletionDueAt
    });

    if (!firm.trialStartedAt) {
      patch.trialStartedAt = trialStartedAt;
    }
    if (!firm.trialEndsAt) {
      patch.trialEndsAt = trialEndsAt;
    }
    if (!firm.graceEndsAt) {
      patch.graceEndsAt = graceEndsAt;
    }
    if (!firm.deletionDueAt) {
      patch.deletionDueAt = deletionDueAt;
    }

    let lifecycleStatus = status;

    if (lifecycleStatus === FirmLifecycleStatus.ACTIVE && now >= trialEndsAt) {
      lifecycleStatus = FirmLifecycleStatus.GRACE;
      patch.lifecycleStatus = lifecycleStatus;
      result.movedToGrace += 1;
    }

    if (lifecycleStatus === FirmLifecycleStatus.GRACE && now >= graceEndsAt) {
      lifecycleStatus = FirmLifecycleStatus.SUSPENDED;
      patch.lifecycleStatus = lifecycleStatus;
      if (!firm.suspendedAt) {
        patch.suspendedAt = now;
      }
      result.movedToSuspended += 1;
    }

    if (lifecycleStatus === FirmLifecycleStatus.SUSPENDED && now >= deletionDueAt) {
      lifecycleStatus = FirmLifecycleStatus.DATA_DELETION_PENDING;
      patch.lifecycleStatus = lifecycleStatus;
      result.movedToPendingDeletion += 1;
    }

    // DATA_DELETION_PENDING: The Tauri shell / frontend has had 24h to export data.
    // On the next sweep after deletionDueAt, mark as deleted (soft delete).
    if (
      lifecycleStatus === FirmLifecycleStatus.DATA_DELETION_PENDING &&
      now >= deletionDueAt &&
      !firm.deletedAt
    ) {
      patch.deletedAt = now;
      patch.lifecycleStatus = FirmLifecycleStatus.PENDING_DELETION;
      result.movedToDataDeletionPending += 1;
      result.markedDeleted += 1;
    }

    if (Object.keys(patch).length > 0) {
      await prisma.firm.update({
        where: { id: firm.id },
        data: patch as Parameters<typeof prisma.firm.update>[0]["data"]
      });
      result.updated += 1;
    }
  }

  return result;
}
