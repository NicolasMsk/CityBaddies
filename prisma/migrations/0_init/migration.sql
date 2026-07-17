-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "DealStatus" AS ENUM ('PENDING', 'ACTIVE', 'EXPIRED');

-- CreateEnum
CREATE TYPE "GuideStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "PromoCodeStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'UNVERIFIED');

-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('PERCENTAGE', 'FIXED_AMOUNT', 'FREE_SHIPPING', 'GIFT', 'CASHBACK');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT,
    "displayName" TEXT,
    "avatarUrl" TEXT,
    "bio" TEXT,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "reputation" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Favorite" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Favorite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vote" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Vote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Comment" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "icon" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Merchant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logoUrl" TEXT,
    "website" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Merchant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Brand" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logoUrl" TEXT,
    "description" TEXT,
    "seoDescription" TEXT,
    "aliases" TEXT,
    "tier" INTEGER NOT NULL DEFAULT 2,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Brand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "seoDescription" TEXT,
    "availableSizes" TEXT,
    "imageUrl" TEXT,
    "brand" TEXT,
    "brandId" TEXT,
    "categoryId" TEXT NOT NULL,
    "subcategory" TEXT,
    "subsubcategory" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "ingredients" TEXT,
    "application" TEXT,
    "labels" TEXT,
    "classifications" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductImage" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "alt" TEXT,
    "type" TEXT NOT NULL DEFAULT 'unknown',
    "position" INTEGER NOT NULL DEFAULT 0,
    "width" INTEGER,
    "height" INTEGER,
    "merchantId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductVariant" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "volumeValue" DOUBLE PRECISION NOT NULL,
    "volumeUnit" TEXT NOT NULL,
    "volumeRaw" TEXT,
    "ean" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceHistory" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "variantId" TEXT,
    "volumeValue" DOUBLE PRECISION,
    "volumeUnit" TEXT,
    "volumeRaw" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriceHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Deal" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT,
    "merchantId" TEXT NOT NULL,
    "imageUrl" TEXT,
    "productUrl" TEXT,
    "title" TEXT NOT NULL,
    "refinedTitle" TEXT,
    "description" TEXT,
    "whyGoodDeal" TEXT,
    "type" TEXT NOT NULL DEFAULT 'scraped',
    "dealPrice" DOUBLE PRECISION NOT NULL,
    "originalPrice" DOUBLE PRECISION NOT NULL,
    "discountPercent" INTEGER NOT NULL,
    "discountAmount" DOUBLE PRECISION NOT NULL,
    "promoCode" TEXT,
    "priceConditions" TEXT,
    "sourceUrl" TEXT,
    "volume" TEXT,
    "volumeValue" DOUBLE PRECISION,
    "volumeUnit" TEXT,
    "pricePerUnit" DOUBLE PRECISION,
    "brandTier" INTEGER NOT NULL DEFAULT 2,
    "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tags" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3),
    "isHot" BOOLEAN NOT NULL DEFAULT false,
    "status" "DealStatus" NOT NULL DEFAULT 'PENDING',
    "isTrending" BOOLEAN NOT NULL DEFAULT false,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "votes" INTEGER NOT NULL DEFAULT 0,
    "views" INTEGER NOT NULL DEFAULT 0,
    "authorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Deal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceAlert" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "productSlug" TEXT NOT NULL,
    "targetPrice" DOUBLE PRECISION NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriceAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScrapingSource" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'promo',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "maxProducts" INTEGER NOT NULL DEFAULT 50,
    "lastScraped" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScrapingSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuyingGuide" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "metaTitle" TEXT,
    "metaDescription" TEXT,
    "heroImageUrl" TEXT,
    "introduction" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "conclusion" TEXT,
    "faq" JSONB,
    "criteria" JSONB,
    "category" TEXT NOT NULL,
    "tags" TEXT,
    "season" TEXT,
    "targetKeywords" TEXT,
    "status" "GuideStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BuyingGuide_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuyingGuideProduct" (
    "id" TEXT NOT NULL,
    "guideId" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "badge" TEXT,
    "miniReview" TEXT NOT NULL,
    "pros" TEXT,
    "cons" TEXT,
    "verdict" TEXT,
    "rating" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BuyingGuideProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MerchantPromoPage" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "metaTitle" TEXT,
    "metaDescription" TEXT,
    "canonicalSlug" TEXT NOT NULL,
    "heroTitle" TEXT,
    "heroSubtitle" TEXT,
    "introduction" TEXT,
    "merchantDescription" TEXT,
    "merchantAdvantages" JSONB,
    "shippingInfo" TEXT,
    "returnPolicy" TEXT,
    "loyaltyProgram" TEXT,
    "howToUse" JSONB,
    "howToUseHtml" TEXT,
    "tips" JSONB,
    "bestTimeToShop" TEXT,
    "faq" JSONB,
    "averageDiscount" DOUBLE PRECISION,
    "totalActiveOffers" INTEGER NOT NULL DEFAULT 0,
    "bestCurrentDiscount" DOUBLE PRECISION,
    "lastVerifiedAt" TIMESTAMP(3),
    "conclusion" TEXT,
    "relatedMerchants" TEXT,
    "targetKeywords" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MerchantPromoPage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromoCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "merchantId" TEXT NOT NULL,
    "discountType" "DiscountType" NOT NULL DEFAULT 'PERCENTAGE',
    "discountValue" DOUBLE PRECISION,
    "minimumPurchase" DOUBLE PRECISION,
    "maximumDiscount" DOUBLE PRECISION,
    "applicableTo" TEXT,
    "conditions" TEXT,
    "isNewCustomerOnly" BOOLEAN NOT NULL DEFAULT false,
    "isStackable" BOOLEAN NOT NULL DEFAULT false,
    "status" "PromoCodeStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "isExclusive" BOOLEAN NOT NULL DEFAULT false,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "successRate" INTEGER,
    "usesCount" INTEGER NOT NULL DEFAULT 0,
    "views" INTEGER NOT NULL DEFAULT 0,
    "votes" INTEGER NOT NULL DEFAULT 0,
    "sourceUrl" TEXT,
    "sourceType" TEXT,
    "authorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PromoCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromoCodeVote" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "promoCodeId" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PromoCodeVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NewsletterSubscription" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "firstName" TEXT,
    "isConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "confirmToken" TEXT,
    "subscribedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" TIMESTAMP(3),
    "unsubscribedAt" TIMESTAMP(3),
    "source" TEXT NOT NULL DEFAULT 'website',

    CONSTRAINT "NewsletterSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScrapingQueue" (
    "id" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "merchantSlug" TEXT NOT NULL,
    "productUrl" TEXT NOT NULL,
    "searchUrl" TEXT NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "method" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "scrapedAt" TIMESTAMP(3),
    "productId" TEXT,
    "completeness" INTEGER,
    "verdict" TEXT,
    "verdictReason" TEXT,
    "verdictConfidence" INTEGER,
    "missingFields" TEXT,
    "variantsFound" INTEGER,
    "variantsPushed" INTEGER,
    "dealsPushed" INTEGER,
    "priceFixes" TEXT,
    "matchMethod" TEXT,
    "durationMs" INTEGER,
    "errorMessage" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScrapingQueue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_username_idx" ON "User"("username");

-- CreateIndex
CREATE INDEX "Favorite_userId_idx" ON "Favorite"("userId");

-- CreateIndex
CREATE INDEX "Favorite_dealId_idx" ON "Favorite"("dealId");

-- CreateIndex
CREATE UNIQUE INDEX "Favorite_userId_dealId_key" ON "Favorite"("userId", "dealId");

-- CreateIndex
CREATE INDEX "Vote_userId_idx" ON "Vote"("userId");

-- CreateIndex
CREATE INDEX "Vote_dealId_idx" ON "Vote"("dealId");

-- CreateIndex
CREATE UNIQUE INDEX "Vote_userId_dealId_key" ON "Vote"("userId", "dealId");

-- CreateIndex
CREATE INDEX "Comment_userId_idx" ON "Comment"("userId");

-- CreateIndex
CREATE INDEX "Comment_dealId_idx" ON "Comment"("dealId");

-- CreateIndex
CREATE INDEX "Comment_parentId_idx" ON "Comment"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "Category_name_key" ON "Category"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Merchant_name_key" ON "Merchant"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Merchant_slug_key" ON "Merchant"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Brand_name_key" ON "Brand"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Brand_slug_key" ON "Brand"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Product_slug_key" ON "Product"("slug");

-- CreateIndex
CREATE INDEX "Product_categoryId_idx" ON "Product"("categoryId");

-- CreateIndex
CREATE INDEX "Product_brandId_idx" ON "Product"("brandId");

-- CreateIndex
CREATE INDEX "Product_subcategory_idx" ON "Product"("subcategory");

-- CreateIndex
CREATE INDEX "Product_subsubcategory_idx" ON "Product"("subsubcategory");

-- CreateIndex
CREATE INDEX "Product_brandId_categoryId_idx" ON "Product"("brandId", "categoryId");

-- CreateIndex
CREATE INDEX "Product_isActive_categoryId_idx" ON "Product"("isActive", "categoryId");

-- CreateIndex
CREATE INDEX "ProductImage_productId_idx" ON "ProductImage"("productId");

-- CreateIndex
CREATE INDEX "ProductImage_productId_position_idx" ON "ProductImage"("productId", "position");

-- CreateIndex
CREATE INDEX "ProductImage_type_idx" ON "ProductImage"("type");

-- CreateIndex
CREATE UNIQUE INDEX "ProductImage_productId_url_key" ON "ProductImage"("productId", "url");

-- CreateIndex
CREATE INDEX "ProductVariant_productId_idx" ON "ProductVariant"("productId");

-- CreateIndex
CREATE INDEX "ProductVariant_ean_idx" ON "ProductVariant"("ean");

-- CreateIndex
CREATE INDEX "ProductVariant_volumeValue_volumeUnit_idx" ON "ProductVariant"("volumeValue", "volumeUnit");

-- CreateIndex
CREATE UNIQUE INDEX "ProductVariant_productId_volumeValue_volumeUnit_key" ON "ProductVariant"("productId", "volumeValue", "volumeUnit");

-- CreateIndex
CREATE INDEX "PriceHistory_productId_idx" ON "PriceHistory"("productId");

-- CreateIndex
CREATE INDEX "PriceHistory_variantId_idx" ON "PriceHistory"("variantId");

-- CreateIndex
CREATE INDEX "PriceHistory_date_idx" ON "PriceHistory"("date");

-- CreateIndex
CREATE INDEX "PriceHistory_productId_volumeValue_volumeUnit_idx" ON "PriceHistory"("productId", "volumeValue", "volumeUnit");

-- CreateIndex
CREATE INDEX "Deal_productId_idx" ON "Deal"("productId");

-- CreateIndex
CREATE INDEX "Deal_variantId_idx" ON "Deal"("variantId");

-- CreateIndex
CREATE INDEX "Deal_merchantId_idx" ON "Deal"("merchantId");

-- CreateIndex
CREATE INDEX "Deal_status_idx" ON "Deal"("status");

-- CreateIndex
CREATE INDEX "Deal_isHot_idx" ON "Deal"("isHot");

-- CreateIndex
CREATE INDEX "Deal_brandTier_idx" ON "Deal"("brandTier");

-- CreateIndex
CREATE INDEX "Deal_pricePerUnit_idx" ON "Deal"("pricePerUnit");

-- CreateIndex
CREATE INDEX "Deal_score_idx" ON "Deal"("score");

-- CreateIndex
CREATE INDEX "Deal_type_idx" ON "Deal"("type");

-- CreateIndex
CREATE INDEX "Deal_createdAt_idx" ON "Deal"("createdAt");

-- CreateIndex
CREATE INDEX "Deal_authorId_idx" ON "Deal"("authorId");

-- CreateIndex
CREATE INDEX "Deal_lastSeenAt_idx" ON "Deal"("lastSeenAt");

-- CreateIndex
CREATE INDEX "Deal_status_score_idx" ON "Deal"("status", "score");

-- CreateIndex
CREATE INDEX "Deal_status_brandTier_score_idx" ON "Deal"("status", "brandTier", "score");

-- CreateIndex
CREATE INDEX "Deal_status_pricePerUnit_idx" ON "Deal"("status", "pricePerUnit");

-- CreateIndex
CREATE INDEX "Deal_productId_status_idx" ON "Deal"("productId", "status");

-- CreateIndex
CREATE INDEX "Deal_status_lastSeenAt_idx" ON "Deal"("status", "lastSeenAt");

-- CreateIndex
CREATE INDEX "Deal_status_type_dealPrice_idx" ON "Deal"("status", "type", "dealPrice");

-- CreateIndex
CREATE UNIQUE INDEX "Deal_variantId_merchantId_key" ON "Deal"("variantId", "merchantId");

-- CreateIndex
CREATE INDEX "PriceAlert_email_idx" ON "PriceAlert"("email");

-- CreateIndex
CREATE INDEX "PriceAlert_productSlug_idx" ON "PriceAlert"("productSlug");

-- CreateIndex
CREATE UNIQUE INDEX "ScrapingSource_url_key" ON "ScrapingSource"("url");

-- CreateIndex
CREATE INDEX "ScrapingSource_merchantId_idx" ON "ScrapingSource"("merchantId");

-- CreateIndex
CREATE INDEX "ScrapingSource_isActive_idx" ON "ScrapingSource"("isActive");

-- CreateIndex
CREATE INDEX "ScrapingSource_type_idx" ON "ScrapingSource"("type");

-- CreateIndex
CREATE UNIQUE INDEX "BuyingGuide_slug_key" ON "BuyingGuide"("slug");

-- CreateIndex
CREATE INDEX "BuyingGuide_status_idx" ON "BuyingGuide"("status");

-- CreateIndex
CREATE INDEX "BuyingGuide_category_idx" ON "BuyingGuide"("category");

-- CreateIndex
CREATE INDEX "BuyingGuide_publishedAt_idx" ON "BuyingGuide"("publishedAt");

-- CreateIndex
CREATE INDEX "BuyingGuide_status_publishedAt_idx" ON "BuyingGuide"("status", "publishedAt");

-- CreateIndex
CREATE INDEX "BuyingGuide_slug_idx" ON "BuyingGuide"("slug");

-- CreateIndex
CREATE INDEX "BuyingGuideProduct_guideId_idx" ON "BuyingGuideProduct"("guideId");

-- CreateIndex
CREATE INDEX "BuyingGuideProduct_dealId_idx" ON "BuyingGuideProduct"("dealId");

-- CreateIndex
CREATE UNIQUE INDEX "BuyingGuideProduct_guideId_dealId_key" ON "BuyingGuideProduct"("guideId", "dealId");

-- CreateIndex
CREATE UNIQUE INDEX "BuyingGuideProduct_guideId_rank_key" ON "BuyingGuideProduct"("guideId", "rank");

-- CreateIndex
CREATE UNIQUE INDEX "MerchantPromoPage_merchantId_key" ON "MerchantPromoPage"("merchantId");

-- CreateIndex
CREATE UNIQUE INDEX "MerchantPromoPage_canonicalSlug_key" ON "MerchantPromoPage"("canonicalSlug");

-- CreateIndex
CREATE INDEX "MerchantPromoPage_canonicalSlug_idx" ON "MerchantPromoPage"("canonicalSlug");

-- CreateIndex
CREATE INDEX "MerchantPromoPage_merchantId_idx" ON "MerchantPromoPage"("merchantId");

-- CreateIndex
CREATE UNIQUE INDEX "PromoCode_slug_key" ON "PromoCode"("slug");

-- CreateIndex
CREATE INDEX "PromoCode_merchantId_idx" ON "PromoCode"("merchantId");

-- CreateIndex
CREATE INDEX "PromoCode_status_idx" ON "PromoCode"("status");

-- CreateIndex
CREATE INDEX "PromoCode_status_expiresAt_idx" ON "PromoCode"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "PromoCode_merchantId_status_idx" ON "PromoCode"("merchantId", "status");

-- CreateIndex
CREATE INDEX "PromoCode_isVerified_idx" ON "PromoCode"("isVerified");

-- CreateIndex
CREATE INDEX "PromoCode_isFeatured_idx" ON "PromoCode"("isFeatured");

-- CreateIndex
CREATE INDEX "PromoCode_discountType_idx" ON "PromoCode"("discountType");

-- CreateIndex
CREATE INDEX "PromoCode_votes_idx" ON "PromoCode"("votes");

-- CreateIndex
CREATE INDEX "PromoCode_createdAt_idx" ON "PromoCode"("createdAt");

-- CreateIndex
CREATE INDEX "PromoCode_authorId_idx" ON "PromoCode"("authorId");

-- CreateIndex
CREATE INDEX "PromoCode_slug_idx" ON "PromoCode"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "PromoCode_code_merchantId_key" ON "PromoCode"("code", "merchantId");

-- CreateIndex
CREATE INDEX "PromoCodeVote_userId_idx" ON "PromoCodeVote"("userId");

-- CreateIndex
CREATE INDEX "PromoCodeVote_promoCodeId_idx" ON "PromoCodeVote"("promoCodeId");

-- CreateIndex
CREATE UNIQUE INDEX "PromoCodeVote_userId_promoCodeId_key" ON "PromoCodeVote"("userId", "promoCodeId");

-- CreateIndex
CREATE UNIQUE INDEX "NewsletterSubscription_email_key" ON "NewsletterSubscription"("email");

-- CreateIndex
CREATE UNIQUE INDEX "NewsletterSubscription_confirmToken_key" ON "NewsletterSubscription"("confirmToken");

-- CreateIndex
CREATE INDEX "NewsletterSubscription_email_idx" ON "NewsletterSubscription"("email");

-- CreateIndex
CREATE INDEX "NewsletterSubscription_confirmToken_idx" ON "NewsletterSubscription"("confirmToken");

-- CreateIndex
CREATE INDEX "ScrapingQueue_status_idx" ON "ScrapingQueue"("status");

-- CreateIndex
CREATE INDEX "ScrapingQueue_merchantSlug_idx" ON "ScrapingQueue"("merchantSlug");

-- CreateIndex
CREATE INDEX "ScrapingQueue_productId_idx" ON "ScrapingQueue"("productId");

-- CreateIndex
CREATE INDEX "ScrapingQueue_verdict_idx" ON "ScrapingQueue"("verdict");

-- CreateIndex
CREATE INDEX "ScrapingQueue_completeness_idx" ON "ScrapingQueue"("completeness");

-- CreateIndex
CREATE UNIQUE INDEX "ScrapingQueue_productName_merchantSlug_key" ON "ScrapingQueue"("productName", "merchantSlug");

-- AddForeignKey
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Comment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductImage" ADD CONSTRAINT "ProductImage_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceHistory" ADD CONSTRAINT "PriceHistory_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceHistory" ADD CONSTRAINT "PriceHistory_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScrapingSource" ADD CONSTRAINT "ScrapingSource_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuyingGuideProduct" ADD CONSTRAINT "BuyingGuideProduct_guideId_fkey" FOREIGN KEY ("guideId") REFERENCES "BuyingGuide"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuyingGuideProduct" ADD CONSTRAINT "BuyingGuideProduct_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MerchantPromoPage" ADD CONSTRAINT "MerchantPromoPage_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromoCode" ADD CONSTRAINT "PromoCode_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromoCode" ADD CONSTRAINT "PromoCode_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromoCodeVote" ADD CONSTRAINT "PromoCodeVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromoCodeVote" ADD CONSTRAINT "PromoCodeVote_promoCodeId_fkey" FOREIGN KEY ("promoCodeId") REFERENCES "PromoCode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

