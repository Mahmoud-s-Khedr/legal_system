import { FirmLifecycleStatus, type EditionKey } from "@elms/shared";
import { listLifecycleSweepFirms, updateFirmLifecycleById } from "../../repositories/editions/editions.repository.js";
import { prisma } from "../../db/prisma.js";
import { appError } from "../../errors/appError.js";
import { isTrialEnabled } from "./editionPolicy.js";
import { resolveTrialDates } from "./trialDates.js";

const NON_REINSTATABLE_STATUSES = new Set<FirmLifecycleStatus>([
  FirmLifecycleStatus.DATA_DELETION_PENDING,
  FirmLifecycleStatus.PENDING_DELETION
]);

// Manual, operator-driven counterparts to the automated sweep above. Both
// funnel through updateFirmLifecycleById so cron- and operator-driven
// transitions stay consistent with the same state-machine invariants.

export async function manuallySuspendFirm(firmId: string, now = new Date()): Promise<void> {
  const firm = await prisma.firm.findUniqueOrThrow({
    where: { id: firmId },
    select: { lifecycleStatus: true }
  });

  if (NON_REINSTATABLE_STATUSES.has(firm.lifecycleStatus as FirmLifecycleStatus)) {
    throw appError("Cannot suspend a firm that is already pending deletion", 409);
  }

  await updateFirmLifecycleById(firmId, {
    lifecycleStatus: FirmLifecycleStatus.SUSPENDED,
    suspendedAt: now
  });
}

export async function manuallyReinstateFirm(firmId: string): Promise<void> {
  const firm = await prisma.firm.findUniqueOrThrow({
    where: { id: firmId },
    select: { lifecycleStatus: true }
  });

  if (NON_REINSTATABLE_STATUSES.has(firm.lifecycleStatus as FirmLifecycleStatus)) {
    throw appError(
      "Cannot reinstate a firm that is pending data deletion",
      409
    );
  }

  await updateFirmLifecycleById(firmId, {
    lifecycleStatus: FirmLifecycleStatus.ACTIVE,
    suspendedAt: null
  });
}

export async function manuallyExtendFirmTrial(firmId: string, days: number): Promise<void> {
  if (!Number.isFinite(days) || days <= 0) {
    throw appError("Extension days must be a positive number", 400);
  }

  const firm = await prisma.firm.findUniqueOrThrow({
    where: { id: firmId },
    select: { lifecycleStatus: true, trialEndsAt: true, graceEndsAt: true, deletionDueAt: true }
  });

  if (NON_REINSTATABLE_STATUSES.has(firm.lifecycleStatus as FirmLifecycleStatus)) {
    throw appError("Cannot extend the trial of a firm pending data deletion", 409);
  }

  const millisPerDay = 24 * 60 * 60 * 1000;
  const extendBy = days * millisPerDay;
  const baseTrialEndsAt = firm.trialEndsAt ?? new Date();
  const trialEndsAt = new Date(baseTrialEndsAt.getTime() + extendBy);
  const graceEndsAt = firm.graceEndsAt ? new Date(firm.graceEndsAt.getTime() + extendBy) : undefined;
  const deletionDueAt = firm.deletionDueAt ? new Date(firm.deletionDueAt.getTime() + extendBy) : undefined;

  await updateFirmLifecycleById(firmId, {
    lifecycleStatus: FirmLifecycleStatus.ACTIVE,
    trialEndsAt,
    ...(graceEndsAt ? { graceEndsAt } : {}),
    ...(deletionDueAt ? { deletionDueAt } : {})
  });
}

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
  const firms = await listLifecycleSweepFirms();

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
      await updateFirmLifecycleById(firm.id, patch as Record<string, unknown>);
      result.updated += 1;
    }
  }

  return result;
}
