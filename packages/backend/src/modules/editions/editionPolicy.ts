import {
  EditionKey,
  type SessionUser
} from "@elms/shared";
import {
  InvitationStatus,
  UserStatus,
  type Prisma,
  type PrismaClient
} from "@prisma/client";

export type EditionFeature =
  | "multi_user"
  | "email_reminders"
  | "sms_reminders"
  | "whatsapp_notifications"
  | "google_calendar_sync"
  | "google_vision_ocr"
  | "ai_research"
  | "cloud_backup_sync"
  | "payments_online"
  | "pwa_browser_access";

type EditionCapability = {
  features: ReadonlySet<EditionFeature>;
  seatLimit: number | null;
  aiMonthlyLimit: number | null;
  trialEnabled: boolean;
};

const ONLINE_FEATURES: ReadonlySet<EditionFeature> = new Set<EditionFeature>([
  "email_reminders",
  "sms_reminders",
  "whatsapp_notifications",
  "google_calendar_sync",
  "google_vision_ocr",
  "ai_research",
  "cloud_backup_sync",
  "payments_online"
]);

const EDITION_CAPABILITIES: Record<EditionKey, EditionCapability> = {
  [EditionKey.SOLO_OFFLINE]: {
    features: new Set<EditionFeature>(),
    seatLimit: 1,
    aiMonthlyLimit: null,
    trialEnabled: true
  },
  [EditionKey.SOLO_ONLINE]: {
    features: ONLINE_FEATURES,
    seatLimit: 1,
    aiMonthlyLimit: 500,
    trialEnabled: true
  },
  [EditionKey.LOCAL_FIRM_OFFLINE]: {
    features: new Set<EditionFeature>(["multi_user"]),
    seatLimit: null,
    aiMonthlyLimit: null,
    trialEnabled: true
  },
  [EditionKey.LOCAL_FIRM_ONLINE]: {
    features: new Set<EditionFeature>(["multi_user", ...ONLINE_FEATURES]),
    seatLimit: null,
    aiMonthlyLimit: 2_000,
    trialEnabled: true
  },
  [EditionKey.ENTERPRISE]: {
    features: new Set<EditionFeature>([
      "multi_user",
      ...ONLINE_FEATURES,
      "pwa_browser_access"
    ]),
    seatLimit: null,
    aiMonthlyLimit: 0,
    trialEnabled: false
  }
};

function resolveEditionKey(editionKey: EditionKey | string): EditionKey {
  if (Object.values(EditionKey).includes(editionKey as EditionKey)) {
    return editionKey as EditionKey;
  }
  return EditionKey.SOLO_ONLINE;
}

export function getEditionCapability(editionKey: EditionKey | string): EditionCapability {
  return EDITION_CAPABILITIES[resolveEditionKey(editionKey)];
}

export function hasEditionFeature(editionKey: EditionKey | string, feature: EditionFeature): boolean {
  return getEditionCapability(editionKey).features.has(feature);
}

export function isTrialEnabled(editionKey: EditionKey | string): boolean {
  return getEditionCapability(editionKey).trialEnabled;
}

export function getSeatLimit(editionKey: EditionKey | string): number | null {
  return getEditionCapability(editionKey).seatLimit;
}

export function getAiMonthlyLimit(editionKey: EditionKey | string): number | null {
  return getEditionCapability(editionKey).aiMonthlyLimit;
}

function httpError(message: string, statusCode: number) {
  const error = new Error(message) as Error & { statusCode: number };
  error.statusCode = statusCode;
  return error;
}

type DbClient = PrismaClient | Prisma.TransactionClient;

export async function assertCanCreateLocalUser(
  db: DbClient,
  actor: SessionUser
): Promise<void> {
  const seatLimit = getSeatLimit(actor.editionKey);
  if (seatLimit == null) {
    return;
  }

  const activeUsers = await db.user.count({
    where: {
      firmId: actor.firmId,
      deletedAt: null,
      status: {
        in: [UserStatus.ACTIVE, UserStatus.INVITED]
      }
    }
  });

  if (activeUsers >= seatLimit) {
    throw httpError("Seat limit reached for current edition", 403);
  }
}

export async function assertCanCreateInvitation(
  db: DbClient,
  actor: SessionUser
): Promise<void> {
  const seatLimit = getSeatLimit(actor.editionKey);
  if (seatLimit == null) {
    return;
  }

  const [activeUsers, pendingInvites] = await Promise.all([
    db.user.count({
      where: {
        firmId: actor.firmId,
        deletedAt: null,
        status: {
          in: [UserStatus.ACTIVE, UserStatus.INVITED]
        }
      }
    }),
    db.invitation.count({
      where: {
        firmId: actor.firmId,
        status: InvitationStatus.PENDING,
        expiresAt: {
          gt: new Date()
        }
      }
    })
  ]);

  if (activeUsers + pendingInvites >= seatLimit) {
    throw httpError("Seat limit reached for current edition", 403);
  }
}
