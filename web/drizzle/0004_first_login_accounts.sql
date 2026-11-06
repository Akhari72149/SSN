CREATE TYPE "public"."auth_challenge_purpose" AS ENUM('mfa', 'first_login');--> statement-breakpoint
ALTER TABLE "user_accounts" DROP CONSTRAINT "user_account_username_format";--> statement-breakpoint
ALTER TABLE "auth_challenges" ADD COLUMN "purpose" "auth_challenge_purpose" DEFAULT 'mfa' NOT NULL;--> statement-breakpoint
-- Existing accounts have already established their passwords. Only accounts
-- created after this migration should be forced through the first-login flow.
ALTER TABLE "user_accounts" ADD COLUMN "must_change_password" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "user_accounts" ALTER COLUMN "must_change_password" SET DEFAULT true;--> statement-breakpoint
ALTER TABLE "user_accounts" ADD CONSTRAINT "user_account_username_format" CHECK (length("user_accounts"."username") BETWEEN 3 AND 50 AND "user_accounts"."username" ~ '^[a-z][a-z0-9._-]*( [a-z0-9][a-z0-9._-]*)*$');
