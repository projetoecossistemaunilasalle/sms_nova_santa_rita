CREATE TABLE "request_rate_limits" (
  "key" CHAR(64) NOT NULL,
  "window_start" TIMESTAMPTZ(3) NOT NULL,
  "count" INTEGER NOT NULL,
  "expires_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "request_rate_limits_pkey" PRIMARY KEY ("key")
);
CREATE INDEX "request_rate_limits_expires_at_idx" ON "request_rate_limits"("expires_at");
