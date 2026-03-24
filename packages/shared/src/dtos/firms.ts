import { EditionKey, FirmLifecycleStatus, FirmType } from "../enums/index";

export interface FirmSettingsDto {
  preferredLanguage: string;
  timezone: string;
  currency: string;
}

export interface FirmSummaryDto {
  id: string;
  name: string;
  slug: string;
  type: FirmType;
  editionKey: EditionKey;
  trialEnabled: boolean;
  lifecycleStatus: FirmLifecycleStatus;
  trialEndsAt: string | null;
  graceEndsAt: string | null;
  dataDeletionDueAt: string | null;
  defaultLanguage: string;
}

export interface FirmSubscriptionDto {
  editionKey: EditionKey;
  trialEnabled: boolean;
  lifecycleStatus: FirmLifecycleStatus;
  trialEndsAt: string | null;
  graceEndsAt: string | null;
  dataDeletionDueAt: string | null;
}

export interface FirmMeResponseDto {
  firm: FirmSummaryDto;
  settings: FirmSettingsDto | null;
}
