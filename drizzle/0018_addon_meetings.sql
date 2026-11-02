CREATE TYPE "public"."meeting_origin" AS ENUM('faceon', 'google_addon');--> statement-breakpoint
ALTER TABLE "meeting" ADD COLUMN "origin" "meeting_origin" DEFAULT 'faceon' NOT NULL;--> statement-breakpoint
ALTER TABLE "meeting" ADD COLUMN "google_addon_event" jsonb;