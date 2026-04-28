-- CreateTable
CREATE TABLE "Service" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "defaultProcessingHours" INTEGER NOT NULL DEFAULT 72,
    "expressOptionAllowed" BOOLEAN NOT NULL DEFAULT true,
    "surgePricingAllowed" BOOLEAN NOT NULL DEFAULT true,
    "defaultCommissionPercent" DOUBLE PRECISION NOT NULL DEFAULT 18,
    "createdByAdminId" TEXT,
    "createdByAdminName" TEXT,
    "updatedByAdminId" TEXT,
    "updatedByAdminName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "color" TEXT,

    CONSTRAINT "Service_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdByAdminId" TEXT,
    "createdByAdminName" TEXT,
    "updatedByAdminId" TEXT,
    "updatedByAdminName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubCategory" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdByAdminId" TEXT,
    "createdByAdminName" TEXT,
    "updatedByAdminId" TEXT,
    "updatedByAdminName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Item" (
    "id" TEXT NOT NULL,
    "subCategoryId" TEXT NOT NULL,
    "skuCode" TEXT,
    "name" TEXT NOT NULL,
    "imageUrl" TEXT,
    "customerPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "vendorShare" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "gstPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "availableFrom" TIMESTAMP(3),
    "availableUntil" TIMESTAMP(3),
    "createdByAdminId" TEXT,
    "createdByAdminName" TEXT,
    "updatedByAdminId" TEXT,
    "updatedByAdminName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CatalogAvailabilityRule" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "cityCode" TEXT,
    "vendorId" TEXT,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "availableFrom" TIMESTAMP(3),
    "availableUntil" TIMESTAMP(3),
    "createdByAdminId" TEXT,
    "createdByAdminName" TEXT,
    "updatedByAdminId" TEXT,
    "updatedByAdminName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CatalogAvailabilityRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemPriceOverride" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "cityCode" TEXT,
    "vendorId" TEXT,
    "customerPrice" DOUBLE PRECISION NOT NULL,
    "vendorShare" DOUBLE PRECISION NOT NULL,
    "gstPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "effectiveFrom" TIMESTAMP(3),
    "effectiveTo" TIMESTAMP(3),
    "priority" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdByAdminId" TEXT,
    "createdByAdminName" TEXT,
    "updatedByAdminId" TEXT,
    "updatedByAdminName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ItemPriceOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaAsset" (
    "id" TEXT NOT NULL,
    "assetType" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "mimeType" TEXT,
    "fileSize" INTEGER,
    "width" INTEGER,
    "height" INTEGER,
    "createdByAdminId" TEXT,
    "createdByAdminName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HomeBanner" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "ctaLabel" TEXT,
    "ctaType" TEXT,
    "ctaTargetId" TEXT,
    "ctaUrl" TEXT,
    "mediaAssetId" TEXT,
    "imageUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "startAt" TIMESTAMP(3),
    "endAt" TIMESTAMP(3),
    "priorityRank" INTEGER NOT NULL DEFAULT 0,
    "targetCityCodes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "targetVendorIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "targetUserSegments" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdByAdminId" TEXT,
    "createdByAdminName" TEXT,
    "updatedByAdminId" TEXT,
    "updatedByAdminName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HomeBanner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HomeVideo" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "videoUrl" TEXT NOT NULL,
    "thumbnailAssetId" TEXT,
    "thumbnailUrl" TEXT,
    "durationSeconds" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "startAt" TIMESTAMP(3),
    "endAt" TIMESTAMP(3),
    "targetCityCodes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "targetVendorIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "targetUserSegments" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdByAdminId" TEXT,
    "createdByAdminName" TEXT,
    "updatedByAdminId" TEXT,
    "updatedByAdminName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HomeVideo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "code" TEXT,
    "description" TEXT,
    "campaignType" TEXT NOT NULL,
    "discountType" TEXT NOT NULL,
    "discountValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "minCartValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "firstOrderOnly" BOOLEAN NOT NULL DEFAULT false,
    "sponsorVendorId" TEXT,
    "fundingSource" TEXT,
    "usageLimitPerUser" INTEGER,
    "totalUsageLimit" INTEGER,
    "targetCityCodes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "targetVendorIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "targetServiceIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "targetUserSegments" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "bannerAssetId" TEXT,
    "bannerUrl" TEXT,
    "priorityRank" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "startAt" TIMESTAMP(3),
    "endAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdByAdminId" TEXT,
    "createdByAdminName" TEXT,
    "updatedByAdminId" TEXT,
    "updatedByAdminName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CityConfig" (
    "id" TEXT NOT NULL,
    "cityCode" TEXT NOT NULL,
    "cityName" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "createdByAdminId" TEXT,
    "createdByAdminName" TEXT,
    "updatedByAdminId" TEXT,
    "updatedByAdminName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CityConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AreaConfig" (
    "id" TEXT NOT NULL,
    "cityCode" TEXT NOT NULL,
    "areaCode" TEXT NOT NULL,
    "areaName" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "surgePercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdByAdminId" TEXT,
    "createdByAdminName" TEXT,
    "updatedByAdminId" TEXT,
    "updatedByAdminName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AreaConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimeSlotConfig" (
    "id" TEXT NOT NULL,
    "cityCode" TEXT NOT NULL,
    "slotType" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "capacityLimit" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdByAdminId" TEXT,
    "createdByAdminName" TEXT,
    "updatedByAdminId" TEXT,
    "updatedByAdminName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimeSlotConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Service_name_key" ON "Service"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Service_slug_key" ON "Service"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Item_skuCode_key" ON "Item"("skuCode");

-- CreateIndex
CREATE INDEX "CatalogAvailabilityRule_entityType_entityId_idx" ON "CatalogAvailabilityRule"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "CatalogAvailabilityRule_cityCode_idx" ON "CatalogAvailabilityRule"("cityCode");

-- CreateIndex
CREATE INDEX "ItemPriceOverride_itemId_idx" ON "ItemPriceOverride"("itemId");

-- CreateIndex
CREATE INDEX "ItemPriceOverride_cityCode_idx" ON "ItemPriceOverride"("cityCode");

-- CreateIndex
CREATE UNIQUE INDEX "Campaign_code_key" ON "Campaign"("code");

-- CreateIndex
CREATE UNIQUE INDEX "CityConfig_cityCode_key" ON "CityConfig"("cityCode");

-- CreateIndex
CREATE UNIQUE INDEX "AreaConfig_areaCode_key" ON "AreaConfig"("areaCode");

-- CreateIndex
CREATE INDEX "AreaConfig_cityCode_idx" ON "AreaConfig"("cityCode");

-- CreateIndex
CREATE INDEX "TimeSlotConfig_cityCode_slotType_idx" ON "TimeSlotConfig"("cityCode", "slotType");

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubCategory" ADD CONSTRAINT "SubCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Item" ADD CONSTRAINT "Item_subCategoryId_fkey" FOREIGN KEY ("subCategoryId") REFERENCES "SubCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemPriceOverride" ADD CONSTRAINT "ItemPriceOverride_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
