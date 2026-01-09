/*
  Warnings:

  - You are about to drop the column `ean` on the `Product` table. All the data in the column will be lost.

*/
-- CreateTable
CREATE TABLE "ProductVariant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "volumeValue" REAL NOT NULL,
    "volumeUnit" TEXT NOT NULL,
    "volumeRaw" TEXT,
    "ean" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProductVariant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Deal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "variantId" TEXT,
    "title" TEXT NOT NULL,
    "refinedTitle" TEXT,
    "description" TEXT,
    "type" TEXT NOT NULL DEFAULT 'scraped',
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
    CONSTRAINT "Deal_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Deal_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Deal" ("authorId", "brandTier", "createdAt", "dealPrice", "description", "discountAmount", "discountPercent", "endDate", "id", "isExpired", "isHot", "isTrending", "originalPrice", "pricePerUnit", "productId", "promoCode", "refinedTitle", "score", "startDate", "tags", "title", "type", "updatedAt", "views", "volume", "volumeUnit", "volumeValue", "votes") SELECT "authorId", "brandTier", "createdAt", "dealPrice", "description", "discountAmount", "discountPercent", "endDate", "id", "isExpired", "isHot", "isTrending", "originalPrice", "pricePerUnit", "productId", "promoCode", "refinedTitle", "score", "startDate", "tags", "title", "type", "updatedAt", "views", "volume", "volumeUnit", "volumeValue", "votes" FROM "Deal";
DROP TABLE "Deal";
ALTER TABLE "new_Deal" RENAME TO "Deal";
CREATE INDEX "Deal_productId_idx" ON "Deal"("productId");
CREATE INDEX "Deal_variantId_idx" ON "Deal"("variantId");
CREATE INDEX "Deal_isExpired_idx" ON "Deal"("isExpired");
CREATE INDEX "Deal_isHot_idx" ON "Deal"("isHot");
CREATE INDEX "Deal_brandTier_idx" ON "Deal"("brandTier");
CREATE INDEX "Deal_pricePerUnit_idx" ON "Deal"("pricePerUnit");
CREATE INDEX "Deal_score_idx" ON "Deal"("score");
CREATE INDEX "Deal_type_idx" ON "Deal"("type");
CREATE INDEX "Deal_createdAt_idx" ON "Deal"("createdAt");
CREATE INDEX "Deal_authorId_idx" ON "Deal"("authorId");
CREATE INDEX "Deal_isExpired_score_idx" ON "Deal"("isExpired", "score");
CREATE INDEX "Deal_isExpired_brandTier_score_idx" ON "Deal"("isExpired", "brandTier", "score");
CREATE INDEX "Deal_isExpired_pricePerUnit_idx" ON "Deal"("isExpired", "pricePerUnit");
CREATE INDEX "Deal_productId_isExpired_idx" ON "Deal"("productId", "isExpired");
CREATE TABLE "new_Product" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "brand" TEXT,
    "brandId" TEXT,
    "categoryId" TEXT NOT NULL,
    "subcategory" TEXT,
    "subsubcategory" TEXT,
    "merchantId" TEXT NOT NULL,
    "productUrl" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Product_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Product_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Product" ("brand", "brandId", "categoryId", "createdAt", "description", "id", "imageUrl", "isActive", "merchantId", "name", "productUrl", "slug", "subcategory", "subsubcategory", "updatedAt") SELECT "brand", "brandId", "categoryId", "createdAt", "description", "id", "imageUrl", "isActive", "merchantId", "name", "productUrl", "slug", "subcategory", "subsubcategory", "updatedAt" FROM "Product";
DROP TABLE "Product";
ALTER TABLE "new_Product" RENAME TO "Product";
CREATE UNIQUE INDEX "Product_slug_key" ON "Product"("slug");
CREATE INDEX "Product_categoryId_idx" ON "Product"("categoryId");
CREATE INDEX "Product_merchantId_idx" ON "Product"("merchantId");
CREATE INDEX "Product_brandId_idx" ON "Product"("brandId");
CREATE INDEX "Product_subcategory_idx" ON "Product"("subcategory");
CREATE INDEX "Product_subsubcategory_idx" ON "Product"("subsubcategory");
CREATE INDEX "Product_brandId_categoryId_idx" ON "Product"("brandId", "categoryId");
CREATE INDEX "Product_isActive_categoryId_idx" ON "Product"("isActive", "categoryId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "ProductVariant_productId_idx" ON "ProductVariant"("productId");

-- CreateIndex
CREATE INDEX "ProductVariant_ean_idx" ON "ProductVariant"("ean");

-- CreateIndex
CREATE INDEX "ProductVariant_volumeValue_volumeUnit_idx" ON "ProductVariant"("volumeValue", "volumeUnit");

-- CreateIndex
CREATE UNIQUE INDEX "ProductVariant_productId_volumeValue_volumeUnit_key" ON "ProductVariant"("productId", "volumeValue", "volumeUnit");
