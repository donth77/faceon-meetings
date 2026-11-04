ALTER TABLE "account" ADD COLUMN "provider_email" text;--> statement-breakpoint
-- ID tokens aren't kept any more: of those kept so far, only the email stays, read from
-- each token's claims (base64url JSON). One that doesn't read keeps no email.
DO $$
DECLARE
  item record;
  claims text;
BEGIN
  FOR item IN SELECT "id", "id_token" FROM "account" WHERE "id_token" IS NOT NULL LOOP
    BEGIN
      claims := split_part(item."id_token", '.', 2);
      UPDATE "account"
      SET "provider_email" = convert_from(
        decode(rpad(translate(claims, '-_', '+/'), (length(claims) + 3) / 4 * 4, '='), 'base64'),
        'UTF8'
      )::jsonb ->> 'email'
      WHERE "id" = item."id";
    EXCEPTION WHEN others THEN
      NULL;
    END;
  END LOOP;
END $$;--> statement-breakpoint
UPDATE "account" SET "id_token" = NULL WHERE "id_token" IS NOT NULL;
