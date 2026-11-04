CREATE TABLE "host_invitation" (
	"email" text PRIMARY KEY NOT NULL,
	"invited_at" timestamp with time zone NOT NULL,
	"invited_by" text,
	"invite_count" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "host_allowlist" DROP CONSTRAINT "host_allowlist_invited_by_user_id_fk";
--> statement-breakpoint
ALTER TABLE "host_invitation" ADD CONSTRAINT "host_invitation_invited_by_user_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
-- Invitations move to a table of their own, which also holds those of addresses approved in
-- the operator's settings.
INSERT INTO "host_invitation" ("email", "invited_at", "invited_by", "invite_count")
SELECT "email", "invited_at", "invited_by", greatest("invite_count", 1)
FROM "host_allowlist"
WHERE "invited_at" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "host_allowlist" DROP COLUMN "invited_at";--> statement-breakpoint
ALTER TABLE "host_allowlist" DROP COLUMN "invited_by";--> statement-breakpoint
ALTER TABLE "host_allowlist" DROP COLUMN "invite_count";