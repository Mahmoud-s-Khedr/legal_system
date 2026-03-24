import { FirmLifecycleStatus, type EditionKey } from "@elms/shared";
import { prisma } from "../../db/prisma.js";
import { isTrialEnabled } from "./editionPolicy.js";

const TRIAL_DAYS = 30;
const GRACE_DAYS = 14;
// After grace ends the firm has 24 hours (DATA_DELETION_PENDING) before
// the actual data wipe occurs on the next sweep cycle.
const DATA_DELETION_DELAY_HOURS = 24;

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
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

    const trialStartedAt = firm.trialStartedAt ?? firm.createdAt;
    const trialEndsAt = firm.trialEndsAt ?? addDays(trialStartedAt, TRIAL_DAYS);
    const graceEndsAt = firm.graceEndsAt ?? addDays(trialEndsAt, GRACE_DAYS);
    // deletionDueAt = 24h after grace ends (DATA_DELETION_PENDING window)
    const deletionDueAt = firm.deletionDueAt ?? addHours(graceEndsAt, DATA_DELETION_DELAY_HOURS);

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
