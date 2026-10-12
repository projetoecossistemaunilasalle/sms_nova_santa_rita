-- Existing hash-only credentials remain valid, but cannot be recovered.
ALTER TABLE "player_credentials" ADD COLUMN "encrypted_token" TEXT;
