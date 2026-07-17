ALTER TABLE "games" ADD COLUMN "owned_count" integer;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "wanted_count" integer;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "favorite_count" integer;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "played_count" integer;--> statement-breakpoint
-- Rows cached before these columns existed are still flagged `detailed`, so
-- ensureGame() would keep serving them straight from cache and the new counters
-- would stay null forever. Drop the flag to force one re-fetch of the full
-- sheet per game, the next time each is actually asked for.
UPDATE "games" SET "detailed" = false;
