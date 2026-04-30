ALTER TABLE "CityConfig" ADD COLUMN IF NOT EXISTS "stateCode" TEXT;
ALTER TABLE "CityConfig" ADD COLUMN IF NOT EXISTS "stateName" TEXT;

CREATE INDEX IF NOT EXISTS "CityConfig_stateCode_idx" ON "CityConfig"("stateCode");
