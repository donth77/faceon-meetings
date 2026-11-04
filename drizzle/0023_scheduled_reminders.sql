ALTER TABLE "reminder_sent" ADD COLUMN "send_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "reminder_sent" ADD COLUMN "email_id" text;--> statement-breakpoint
ALTER TABLE "reminder_sent" ADD COLUMN "fingerprint" text;--> statement-breakpoint
ALTER TABLE "reminder_sent" ADD COLUMN "nonce" text;--> statement-breakpoint
CREATE INDEX "reminder_sent_send_at" ON "reminder_sent" USING btree ("send_at");