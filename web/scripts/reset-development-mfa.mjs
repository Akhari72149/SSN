import { randomUUID } from "node:crypto";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import postgres from "postgres";
import { isValidUsername, normalizeUsername } from "../lib/auth/username.ts";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl || process.env.APP_DATA_MODE !== "live") {
  throw new Error("Live local development settings were not found. Run setup-development.cmd first.");
}

const parsedUrl = new URL(databaseUrl);
const localHosts = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);
if (!localHosts.has(parsedUrl.hostname) || parsedUrl.pathname !== "/safer_spaces_dev") {
  throw new Error("This recovery tool is restricted to the local safer_spaces_dev database.");
}

const prompt = createInterface({ input: stdin, output: stdout });
const enteredUsername = await prompt.question("Administrator username to reconnect MFA: ");
prompt.close();
const username = normalizeUsername(enteredUsername);
if (!isValidUsername(username)) throw new Error("Enter a valid Safer Spaces username.");

const sql = postgres(databaseUrl, { max: 1, prepare: false, connect_timeout: 10 });
try {
  const result = await sql.begin(async (transaction) => {
    const [database] = await transaction`select current_database() as name`;
    if (database.name !== "safer_spaces_dev") throw new Error("Refusing to modify a non-development database.");
    const [account] = await transaction`
      select id,username,display_name from user_accounts where username = ${username} for update
    `;
    if (!account) throw new Error(`No account was found for ${username}.`);

    const now = new Date();
    await transaction`update mfa_credentials set revoked_at = coalesce(revoked_at, ${now}) where user_id = ${account.id}`;
    await transaction`delete from mfa_recovery_codes where user_id = ${account.id}`;
    await transaction`delete from auth_challenges where user_id = ${account.id}`;
    await transaction`update auth_sessions set revoked_at = coalesce(revoked_at, ${now}) where user_id = ${account.id}`;
    await transaction`
      update user_accounts
      set mfa_enrolled_at = null, failed_sign_in_count = 0, locked_until = null, updated_at = ${now}
      where id = ${account.id}
    `;
    await transaction`
      insert into audit_events(actor_user_id,action,target_type,target_opaque_id,permitted,request_id,reason,metadata)
      values(null,'auth.development_mfa_reset','user_account',${account.id},true,${randomUUID()},'local_development_recovery',${transaction.json({ username: account.username })})
    `;
    return account;
  });
  console.log(`\nMFA is ready to reconnect for ${result.display_name} (${result.username}).`);
  console.log("Start Safer Spaces and sign in with the existing password. A QR code will be shown.");
} finally {
  await sql.end({ timeout: 5 });
}
