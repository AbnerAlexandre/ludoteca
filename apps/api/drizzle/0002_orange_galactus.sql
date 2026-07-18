CREATE TYPE "public"."group_member_status" AS ENUM('active', 'invited', 'requested');--> statement-breakpoint
CREATE TYPE "public"."group_role" AS ENUM('admin', 'member');--> statement-breakpoint
CREATE TYPE "public"."group_visibility" AS ENUM('open', 'closed');--> statement-breakpoint
ALTER TYPE "public"."game_type" ADD VALUE 'party' BEFORE 'other';--> statement-breakpoint
ALTER TYPE "public"."game_type" ADD VALUE 'dice' BEFORE 'other';--> statement-breakpoint
ALTER TYPE "public"."game_type" ADD VALUE 'abstract' BEFORE 'other';--> statement-breakpoint
ALTER TYPE "public"."game_type" ADD VALUE 'children' BEFORE 'other';--> statement-breakpoint
ALTER TABLE "friend_group_members" ADD COLUMN "role" "group_role" DEFAULT 'member' NOT NULL;--> statement-breakpoint
ALTER TABLE "friend_group_members" ADD COLUMN "status" "group_member_status" DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "friend_group_members" ADD COLUMN "invited_by_id" uuid;--> statement-breakpoint
ALTER TABLE "friend_groups" ADD COLUMN "visibility" "group_visibility" DEFAULT 'closed' NOT NULL;--> statement-breakpoint
ALTER TABLE "friend_group_members" ADD CONSTRAINT "friend_group_members_invited_by_id_users_id_fk" FOREIGN KEY ("invited_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "friend_group_members_status_idx" ON "friend_group_members" USING btree ("group_id","status");--> statement-breakpoint
CREATE INDEX "friend_groups_visibility_idx" ON "friend_groups" USING btree ("visibility");--> statement-breakpoint
-- Backfill: the group creator becomes an admin of their own group; existing
-- members stay regular members and active (the column defaults already set that).
UPDATE "friend_group_members" m SET "role" = 'admin'
  FROM "friend_groups" g WHERE m.group_id = g.id AND m.user_id = g.owner_id;--> statement-breakpoint
-- Re-infer game types with the richer set (party/dice/abstract/children). Rows
-- cached before this keep their old type until re-fetched; clearing `detailed`
-- forces one re-fetch per game the next time it's opened.
UPDATE "games" SET "detailed" = false;