-- CreateTable
CREATE TABLE "ScrapingSource" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "merchantId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'promo',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "maxProducts" INTEGER NOT NULL DEFAULT 50,
    "lastScraped" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ScrapingSource_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "ScrapingSource_url_key" ON "ScrapingSource"("url");

-- CreateIndex
CREATE INDEX "ScrapingSource_merchantId_idx" ON "ScrapingSource"("merchantId");

-- CreateIndex
CREATE INDEX "ScrapingSource_isActive_idx" ON "ScrapingSource"("isActive");

-- CreateIndex
CREATE INDEX "ScrapingSource_type_idx" ON "ScrapingSource"("type");
