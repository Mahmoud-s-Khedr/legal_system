CREATE TABLE "ClientCreditBalance" (
  "id" UUID NOT NULL,
  "firmId" UUID NOT NULL,
  "clientId" UUID NOT NULL,
  "availableAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ClientCreditBalance_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ClientCreditEntry" (
  "id" UUID NOT NULL,
  "firmId" UUID NOT NULL,
  "clientId" UUID NOT NULL,
  "invoiceId" UUID,
  "type" TEXT NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ClientCreditEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InvoiceCreditApplication" (
  "id" UUID NOT NULL,
  "firmId" UUID NOT NULL,
  "invoiceId" UUID NOT NULL,
  "clientId" UUID NOT NULL,
  "paymentId" UUID,
  "amount" DECIMAL(12,2) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "InvoiceCreditApplication_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ClientCreditBalance_firmId_clientId_key"
  ON "ClientCreditBalance"("firmId", "clientId");

CREATE INDEX "ClientCreditBalance_firmId_updatedAt_idx"
  ON "ClientCreditBalance"("firmId", "updatedAt");

CREATE INDEX "ClientCreditEntry_firmId_clientId_createdAt_idx"
  ON "ClientCreditEntry"("firmId", "clientId", "createdAt");

CREATE INDEX "ClientCreditEntry_invoiceId_createdAt_idx"
  ON "ClientCreditEntry"("invoiceId", "createdAt");

CREATE INDEX "InvoiceCreditApplication_firmId_invoiceId_createdAt_idx"
  ON "InvoiceCreditApplication"("firmId", "invoiceId", "createdAt");

CREATE INDEX "InvoiceCreditApplication_firmId_clientId_createdAt_idx"
  ON "InvoiceCreditApplication"("firmId", "clientId", "createdAt");

ALTER TABLE "ClientCreditBalance"
  ADD CONSTRAINT "ClientCreditBalance_firmId_fkey"
  FOREIGN KEY ("firmId") REFERENCES "Firm"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ClientCreditBalance"
  ADD CONSTRAINT "ClientCreditBalance_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "Client"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ClientCreditEntry"
  ADD CONSTRAINT "ClientCreditEntry_firmId_fkey"
  FOREIGN KEY ("firmId") REFERENCES "Firm"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ClientCreditEntry"
  ADD CONSTRAINT "ClientCreditEntry_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "Client"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ClientCreditEntry"
  ADD CONSTRAINT "ClientCreditEntry_invoiceId_fkey"
  FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InvoiceCreditApplication"
  ADD CONSTRAINT "InvoiceCreditApplication_firmId_fkey"
  FOREIGN KEY ("firmId") REFERENCES "Firm"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InvoiceCreditApplication"
  ADD CONSTRAINT "InvoiceCreditApplication_invoiceId_fkey"
  FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InvoiceCreditApplication"
  ADD CONSTRAINT "InvoiceCreditApplication_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "Client"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InvoiceCreditApplication"
  ADD CONSTRAINT "InvoiceCreditApplication_paymentId_fkey"
  FOREIGN KEY ("paymentId") REFERENCES "Payment"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

UPDATE "Invoice"
SET "issuedAt" = "createdAt"
WHERE "issuedAt" IS NULL
  AND "status" IN ('ISSUED', 'PARTIALLY_PAID', 'PAID');
