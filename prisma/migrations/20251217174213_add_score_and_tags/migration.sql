-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Deal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "dealPrice" REAL NOT NULL,
    "originalPrice" REAL NOT NULL,
    "discountPercent" INTEGER NOT NULL,
    "discountAmount" REAL NOT NULL,
    "promoCode" TEXT,
    "volume" TEXT,
    "volumeValue" REAL,
    "volumeUnit" TEXT,
    "pricePerUnit" REAL,
    "brandTier" INTEGER NOT NULL DEFAULT 2,
    "score" REAL NOT NULL DEFAULT 0,
    "tags" TEXT,
    "startDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" DATETIME,
    "isHot" BOOLEAN NOT NULL DEFAULT false,
    "isExpired" BOOLEAN NOT NULL DEFAULT false,
    "isTrending" BOOLEAN NOT NULL DEFAULT false,
    "votes" INTEGER NOT NULL DEFAULT 0,
    "views" INTEGER NOT NULL DEFAULT 0,
    "authorId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Deal_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Deal_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Deal" ("authorId", "brandTier", "createdAt", "dealPrice", "description", "discountAmount", "discountPercent", "endDate", "id", "isExpired", "isHot", "isTrending", "originalPrice", "pricePerUnit", "productId", "promoCode", "startDate", "title", "updatedAt", "views", "volume", "volumeUnit", "volumeValue", "votes") SELECT "authorId", "brandTier", "createdAt", "dealPrice", "description", "discountAmount", "discountPercent", "endDate", "id", "isExpired", "isHot", "isTrending", "originalPrice", "pricePerUnit", "productId", "promoCode", "startDate", "title", "updatedAt", "views", "volume", "volumeUnit", "volumeValue", "votes" FROM "Deal";
DROP TABLE "Deal";
ALTER TABLE "new_Deal" RENAME TO "Deal";
CREATE INDEX "Deal_productId_idx" ON "Deal"("productId");
CREATE INDEX "Deal_isExpired_idx" ON "Deal"("isExpired");
CREATE INDEX "Deal_isHot_idx" ON "Deal"("isHot");
CREATE INDEX "Deal_brandTier_idx" ON "Deal"("brandTier");
CREATE INDEX "Deal_pricePerUnit_idx" ON "Deal"("pricePerUnit");
CREATE INDEX "Deal_score_idx" ON "Deal"("score");
CREATE INDEX "Deal_createdAt_idx" ON "Deal"("createdAt");
CREATE INDEX "Deal_authorId_idx" ON "Deal"("authorId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
