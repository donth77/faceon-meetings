ALTER TABLE "meeting_session" ADD COLUMN "hands" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "meeting_session" ADD COLUMN "rev" integer DEFAULT 0 NOT NULL;