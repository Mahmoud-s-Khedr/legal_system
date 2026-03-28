const MILLIS_PER_DAY = 24 * 60 * 60 * 1000;
const MILLIS_PER_HOUR = 60 * 60 * 1000;

export const TRIAL_DAYS = 30;
export const GRACE_DAYS = 14;
export const DATA_DELETION_DELAY_HOURS = 24;

export type TrialDateInput = {
  createdAt: Date;
  trialStartedAt?: Date | null;
  trialEndsAt?: Date | null;
  graceEndsAt?: Date | null;
  deletionDueAt?: Date | null;
};

export type TrialDates = {
  trialStartedAt: Date;
  trialEndsAt: Date;
  graceEndsAt: Date;
  deletionDueAt: Date;
};

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MILLIS_PER_DAY);
}

function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * MILLIS_PER_HOUR);
}

export function resolveTrialDates(input: TrialDateInput): TrialDates {
  const trialStartedAt = input.trialStartedAt ?? input.createdAt;
  const trialEndsAt = input.trialEndsAt ?? addDays(trialStartedAt, TRIAL_DAYS);
  const graceEndsAt = input.graceEndsAt ?? addDays(trialEndsAt, GRACE_DAYS);
  const deletionDueAt = input.deletionDueAt ?? addHours(graceEndsAt, DATA_DELETION_DELAY_HOURS);

  return {
    trialStartedAt,
    trialEndsAt,
    graceEndsAt,
    deletionDueAt
  };
}
