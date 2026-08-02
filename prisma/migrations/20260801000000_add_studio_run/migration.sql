-- CreateTable
CREATE TABLE "StudioRun" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'cron',
    "productSlug" TEXT,
    "productName" TEXT,
    "oldPrice" DOUBLE PRECISION,
    "newPrice" DOUBLE PRECISION,
    "gap" DOUBLE PRECISION,
    "merchant" TEXT,
    "emailId" TEXT,
    "videoBytes" INTEGER,
    "durationMs" INTEGER,
    "errorMessage" TEXT,

    CONSTRAINT "StudioRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StudioRun_createdAt_idx" ON "StudioRun"("createdAt");

-- CreateIndex
CREATE INDEX "StudioRun_productSlug_idx" ON "StudioRun"("productSlug");

-- CreateIndex
CREATE INDEX "StudioRun_status_idx" ON "StudioRun"("status");

