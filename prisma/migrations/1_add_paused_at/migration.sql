-- AddColumn: temporary pause state for access links. Pausing keeps the same
-- token (and therefore URL); revocation stays terminal.
ALTER TABLE "access_links" ADD COLUMN "paused_at" TIMESTAMPTZ(3);
