-- AlterTable
ALTER TABLE "Deal" ADD COLUMN "pricePerUnit" REAL;
ALTER TABLE "Deal" ADD COLUMN "volumeUnit" TEXT;
ALTER TABLE "Deal" ADD COLUMN "volumeValue" REAL;

-- CreateIndex
CREATE INDEX "Deal_pricePerUnit_idx" ON "Deal"("pricePerUnit");
