ALTER TABLE "Notification"
  ADD COLUMN "entityType" TEXT,
  ADD COLUMN "entityId" UUID;

CREATE INDEX "Notification_firmId_userId_entityType_entityId_idx"
  ON "Notification"("firmId", "userId", "entityType", "entityId");
