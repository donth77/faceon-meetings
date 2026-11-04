ALTER TABLE "host_allowlist" ADD COLUMN "invited_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "host_allowlist" ADD COLUMN "invited_by" text;--> statement-breakpoint
ALTER TABLE "host_allowlist" ADD COLUMN "invite_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "host_allowlist" ADD CONSTRAINT "host_allowlist_invited_by_user_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;