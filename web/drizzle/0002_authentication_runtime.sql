-- Pre-production migration: auth_sessions must be empty before the required CSRF hash is added.
CREATE TABLE "auth_challenges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	CONSTRAINT "auth_challenge_attempt_range" CHECK ("auth_challenges"."attempts" BETWEEN 0 AND 5),
	CONSTRAINT "auth_challenge_expiry_after_creation" CHECK ("auth_challenges"."expires_at" > "auth_challenges"."created_at")
);
--> statement-breakpoint
ALTER TABLE "auth_sessions" ADD COLUMN "csrf_token_hash" text NOT NULL;--> statement-breakpoint
ALTER TABLE "auth_challenges" ADD CONSTRAINT "auth_challenges_user_id_user_accounts_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "auth_challenge_token_hash_unique" ON "auth_challenges" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "auth_challenge_active_user_idx" ON "auth_challenges" USING btree ("user_id","expires_at") WHERE "auth_challenges"."used_at" IS NULL;
