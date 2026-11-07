import postgres from "postgres";
import { hashPassword } from "../lib/auth/crypto.ts";
import { isValidUsername, normalizeUsername } from "../lib/auth/username.ts";

const databaseUrl = process.env.DATABASE_URL;
const username = normalizeUsername(process.env.BOOTSTRAP_ADMIN_USERNAME ?? "");
const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase() || null;
const displayName = process.env.BOOTSTRAP_ADMIN_NAME?.trim();
const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;

if (!databaseUrl || !username || !displayName || !password) {
  throw new Error("DATABASE_URL, BOOTSTRAP_ADMIN_USERNAME, BOOTSTRAP_ADMIN_NAME and BOOTSTRAP_ADMIN_PASSWORD are required");
}
if (!isValidUsername(username)) throw new Error("BOOTSTRAP_ADMIN_USERNAME must be 3–50 characters, start with a letter, and use letters, numbers, spaces, dots, underscores or hyphens");
if (!process.env.AUTH_ENCRYPTION_KEY) throw new Error("AUTH_ENCRYPTION_KEY is required");

const sql = postgres(databaseUrl, { max: 1, prepare: false, connect_timeout: 10 });

try {
  const result = await sql.begin(async (transaction) => {
    const [{ count }] = await transaction`select count(*)::integer as count from user_accounts`;
    if (count !== 0) throw new Error("Bootstrap is disabled because an account already exists");
    const [{ permission_count: permissionCount }] = await transaction`
      select count(*)::integer as permission_count from permission_definitions
    `;
    if (permissionCount === 0) throw new Error("Seed permission definitions before bootstrapping the administrator");

    const passwordHash = await hashPassword(password);
    const [account] = await transaction`
      insert into user_accounts(username,email,display_name,password_hash,status,mfa_enrolled_at,must_change_password)
      values(${username},${email},${displayName},${passwordHash},'active',null,false)
      returning id,username
    `;
    await transaction`
      insert into user_permissions(user_id,permission_key,granted_by_user_id)
      select ${account.id},key,${account.id} from permission_definitions
    `;
    return account;
  });

  console.log(`Created initial administrator: ${result.username}`);
  console.log("MFA will be connected by QR code when this administrator signs in for the first time.");
} finally {
  await sql.end({ timeout: 5 });
}
