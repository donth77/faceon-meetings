CREATE TABLE "participant_session" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"connection_id" text NOT NULL,
	"media_user_id" text NOT NULL,
	"user_id" text,
	"display_name" text NOT NULL,
	"image" text,
	"joined_at" timestamp with time zone NOT NULL,
	"left_at" timestamp with time zone,
	CONSTRAINT "participant_session_connection_id_unique" UNIQUE("connection_id")
);
--> statement-breakpoint
CREATE TABLE "webhook_event" (
	"id" text PRIMARY KEY NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "participant_session" ADD CONSTRAINT "participant_session_session_id_meeting_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."meeting_session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participant_session" ADD CONSTRAINT "participant_session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "participant_session_session" ON "participant_session" USING btree ("session_id");