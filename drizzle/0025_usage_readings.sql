CREATE TABLE "usage_reading" (
	"source" text PRIMARY KEY NOT NULL,
	"data" jsonb NOT NULL,
	"read_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "email_day" ADD COLUMN "resend_via" text;