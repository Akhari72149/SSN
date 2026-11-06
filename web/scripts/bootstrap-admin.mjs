import postgres from "postgres";
import { encryptSecret, hashPassword, hashRecoveryCode, randomToken } from "../lib/auth/crypto.ts";
import { generateTotpSecret, totpUri } from "../lib/auth/totp.ts";
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
const secret = generateTotpSecret();
const recoveryCodes = Array.from({ length: 10 }, () => {
  const value = randomToken(9).toUpperCase();
  return `${value.slice(0, 6)}-${value.slice(6, 12)}`;
});

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
      values(${username},${email},${displayName},${passwordHash},'active',now(),false)
      returning id,username
    `;
    await transaction`
      insert into mfa_credentials(user_id,method,label,secret_ciphertext,key_version)
      values(${account.id},'totp','Primary authenticator',${encryptSecret(secret)},1)
    `;
    const codeRows = recoveryCodes.map((code) => ({ user_id: account.id, code_hash: hashRecoveryCode(code) }));
    await transaction`insert into mfa_recovery_codes ${transaction(codeRows, "user_id", "code_hash")}`;
    await transaction`
      insert into user_permissions(user_id,permission_key,granted_by_user_id)
      select ${account.id},key,${account.id} from permission_definitions
    `;
    return account;
  });

  console.log(`Created initial administrator: ${result.username}`);
  console.log(`Authenticator setup key: ${secret}`);
  console.log(`Authenticator URI: ${totpUri({ secret, accountName: username })}`);
  console.log("Recovery codes (store once in a secure password manager):");
  for (const code of recoveryCodes) console.log(code);
} finally {
  await sql.end({ timeout: 5 });
}
