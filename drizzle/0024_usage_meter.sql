CREATE TABLE "email_day" (
	"day" date PRIMARY KEY NOT NULL,
	"sent" integer DEFAULT 0 NOT NULL,
	"resend_daily" integer,
	"resend_monthly" integer,
	"resend_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "usage_alert" (
	"meter" text NOT NULL,
	"period" text NOT NULL,
	"threshold" integer NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "usage_alert_meter_period_threshold_pk" PRIMARY KEY("meter","period","threshold")
);
