CREATE TYPE "public"."admission_status" AS ENUM('pending', 'admitted', 'denied', 'cancelled', 'expired');--> statement-breakpoint
CREATE TABLE "admission_request" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"media_user_id" text NOT NULL,
	"user_id" text,
	"display_name" text NOT NULL,
	"image" text,
	"status" "admission_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "admission_request" ADD CONSTRAINT "admission_request_session_id_meeting_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."meeting_session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admission_request" ADD CONSTRAINT "admission_request_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "admission_request_session" ON "admission_request" USING btree ("session_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "admission_request_one_pending" ON "admission_request" USING btree ("session_id","media_user_id") WHERE "admission_request"."status" = 'pending';