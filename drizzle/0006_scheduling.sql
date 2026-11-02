CREATE TABLE "meeting_exception" (
	"meeting_id" uuid NOT NULL,
	"original_start" timestamp with time zone NOT NULL,
	"cancelled" boolean DEFAULT false NOT NULL,
	"starts_at" timestamp with time zone,
	"duration_min" integer,
	"title" text,
	CONSTRAINT "meeting_exception_meeting_id_original_start_pk" PRIMARY KEY("meeting_id","original_start")
);
--> statement-breakpoint
CREATE TABLE "meeting_invitee" (
	"meeting_id" uuid NOT NULL,
	"email" text NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "meeting_invitee_meeting_id_email_pk" PRIMARY KEY("meeting_id","email")
);
--> statement-breakpoint
CREATE TABLE "meeting_rule" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meeting_id" uuid NOT NULL,
	"rrule" text NOT NULL,
	"first_start" timestamp with time zone NOT NULL,
	"last_start" timestamp with time zone,
	"duration_min" integer NOT NULL,
	"time_zone" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "meeting" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "meeting" ADD COLUMN "starts_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "meeting" ADD COLUMN "duration_min" integer;--> statement-breakpoint
ALTER TABLE "meeting" ADD COLUMN "time_zone" text;--> statement-breakpoint
ALTER TABLE "meeting" ADD COLUMN "google_event_id" text;--> statement-breakpoint
ALTER TABLE "meeting_session" ADD COLUMN "occurrence_start" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "meeting_exception" ADD CONSTRAINT "meeting_exception_meeting_id_meeting_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meeting"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_invitee" ADD CONSTRAINT "meeting_invitee_meeting_id_meeting_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meeting"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_rule" ADD CONSTRAINT "meeting_rule_meeting_id_meeting_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meeting"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "meeting_invitee_email" ON "meeting_invitee" USING btree ("email");--> statement-breakpoint
CREATE INDEX "meeting_rule_meeting" ON "meeting_rule" USING btree ("meeting_id");