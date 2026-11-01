CREATE TYPE "public"."meeting_status" AS ENUM('active', 'ended', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."meeting_type" AS ENUM('instant', 'scheduled', 'personal');--> statement-breakpoint
CREATE TYPE "public"."member_role" AS ENUM('host', 'cohost', 'participant', 'guest');--> statement-breakpoint
CREATE TYPE "public"."session_status" AS ENUM('open', 'ended');--> statement-breakpoint
CREATE TABLE "meeting" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"host_id" text NOT NULL,
	"type" "meeting_type" NOT NULL,
	"status" "meeting_status" DEFAULT 'active' NOT NULL,
	"title" text,
	"passcode" text,
	"settings" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	CONSTRAINT "meeting_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "meeting_member" (
	"session_id" uuid NOT NULL,
	"media_user_id" text NOT NULL,
	"user_id" text,
	"display_name" text NOT NULL,
	"role" "member_role" NOT NULL,
	"admitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"banned_at" timestamp with time zone,
	CONSTRAINT "meeting_member_session_id_media_user_id_pk" PRIMARY KEY("session_id","media_user_id")
);
--> statement-breakpoint
CREATE TABLE "meeting_session" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meeting_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"status" "session_status" DEFAULT 'open' NOT NULL,
	"limits" jsonb NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "meeting" ADD CONSTRAINT "meeting_host_id_user_id_fk" FOREIGN KEY ("host_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_member" ADD CONSTRAINT "meeting_member_session_id_meeting_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."meeting_session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_member" ADD CONSTRAINT "meeting_member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_session" ADD CONSTRAINT "meeting_session_meeting_id_meeting_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meeting"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "meeting_host_idx" ON "meeting" USING btree ("host_id");--> statement-breakpoint
CREATE UNIQUE INDEX "meeting_one_personal_room" ON "meeting" USING btree ("host_id") WHERE "meeting"."type" = 'personal';--> statement-breakpoint
CREATE UNIQUE INDEX "meeting_session_one_open" ON "meeting_session" USING btree ("meeting_id") WHERE "meeting_session"."status" = 'open';