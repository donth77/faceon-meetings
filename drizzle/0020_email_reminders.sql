CREATE TABLE "reminder_sent" (
	"user_id" text NOT NULL,
	"meeting_code" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reminder_sent_user_id_meeting_code_starts_at_pk" PRIMARY KEY("user_id","meeting_code","starts_at")
);
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "email_reminders" jsonb;--> statement-breakpoint
ALTER TABLE "reminder_sent" ADD CONSTRAINT "reminder_sent_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "reminder_sent_sent_at" ON "reminder_sent" USING btree ("sent_at");