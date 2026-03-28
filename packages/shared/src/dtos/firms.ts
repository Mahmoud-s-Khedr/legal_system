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
  pendingEditionKey: EditionKey | null;
  trialEnabled: boolean;
  lifecycleStatus: FirmLifecycleStatus;
  isLicensed: boolean;
  licenseRequired: boolean;
  trialEndsAt: string | null;
  graceEndsAt: string | null;
  dataDeletionDueAt: string | null;
  defaultLanguage: string;
}

export interface FirmSubscriptionDto {
  editionKey: EditionKey;
  pendingEditionKey: EditionKey | null;
  trialEnabled: boolean;
  lifecycleStatus: FirmLifecycleStatus;
  isLicensed: boolean;
  licenseRequired: boolean;
  trialEndsAt: string | null;
  graceEndsAt: string | null;
  dataDeletionDueAt: string | null;
}

export interface ActivateLicenseDto {
  activationKey: string;
}

export interface LicenseActivationResponseDto {
  editionKey: EditionKey;
  expiresAt: string;
  firmName: string;
  status: "activated" | "already_activated";
}

export interface RequestEditionChangeDto {
  editionKey: EditionKey;
}

export interface FirmMeResponseDto {
  firm: FirmSummaryDto;
  settings: FirmSettingsDto | null;
}
