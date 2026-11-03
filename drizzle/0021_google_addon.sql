CREATE TABLE "google_addon" (
	"user_id" text PRIMARY KEY NOT NULL,
	"script_id" text NOT NULL,
	"google_sub" text NOT NULL,
	"client_id" text,
	"connect_token_hash" text,
	"version" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"connected_at" timestamp with time zone,
	"update_tried_at" timestamp with time zone,
	"update_refused_at" timestamp with time zone,
	CONSTRAINT "google_addon_client_id_unique" UNIQUE("client_id"),
	CONSTRAINT "google_addon_connect_token_hash_unique" UNIQUE("connect_token_hash")
);
--> statement-breakpoint
ALTER TABLE "google_addon" ADD CONSTRAINT "google_addon_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;