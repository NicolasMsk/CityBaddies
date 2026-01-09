-- CreateIndex
CREATE INDEX "Deal_isExpired_score_idx" ON "Deal"("isExpired", "score");

-- CreateIndex
CREATE INDEX "Deal_isExpired_brandTier_score_idx" ON "Deal"("isExpired", "brandTier", "score");

-- CreateIndex
CREATE INDEX "Deal_isExpired_pricePerUnit_idx" ON "Deal"("isExpired", "pricePerUnit");

-- CreateIndex
CREATE INDEX "Deal_productId_isExpired_idx" ON "Deal"("productId", "isExpired");

-- CreateIndex
CREATE INDEX "Product_brandId_categoryId_idx" ON "Product"("brandId", "categoryId");

-- CreateIndex
CREATE INDEX "Product_isActive_categoryId_idx" ON "Product"("isActive", "categoryId");
