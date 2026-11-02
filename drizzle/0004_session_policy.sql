ALTER TABLE "meeting_session" ADD COLUMN "policy" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "meeting_session" ADD COLUMN "spotlight" text;