ALTER TABLE "user_accounts" DROP CONSTRAINT "user_account_email_lowercase";--> statement-breakpoint
ALTER TABLE "user_accounts" ALTER COLUMN "email" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "user_accounts" ADD COLUMN "username" text;--> statement-breakpoint
-- Existing accounts receive a unique temporary username. An administrator can
-- replace it with a friendly username before handing the account to its owner.
UPDATE "user_accounts" SET "username" = 'user_' || replace("id"::text, '-', '') WHERE "username" IS NULL;--> statement-breakpoint
ALTER TABLE "user_accounts" ALTER COLUMN "username" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "user_account_username_unique" ON "user_accounts" USING btree ("username");--> statement-breakpoint
ALTER TABLE "user_accounts" ADD CONSTRAINT "user_account_username_format" CHECK ("user_accounts"."username" ~ '^[a-z][a-z0-9._-]{2,49}$');--> statement-breakpoint
ALTER TABLE "user_accounts" ADD CONSTRAINT "user_account_email_lowercase" CHECK ("user_accounts"."email" IS NULL OR "user_accounts"."email" = lower("user_accounts"."email"));
