CREATE TABLE "meeting_notes" (
	"session_id" uuid PRIMARY KEY NOT NULL,
	"saved_by" text NOT NULL,
	"notes" jsonb NOT NULL,
	"transcript" text,
	"engine" text NOT NULL,
	"provider" text,
	"made_at" timestamp with time zone NOT NULL,
	"shared" boolean DEFAULT false NOT NULL,
	"saved_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "meeting_notes" ADD CONSTRAINT "meeting_notes_session_id_meeting_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."meeting_session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_notes" ADD CONSTRAINT "meeting_notes_saved_by_user_id_fk" FOREIGN KEY ("saved_by") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;