import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const eventStatus = pgEnum("event_status", ["draft", "open", "closed", "archived"]);
export const staffType = pgEnum("staff_type", ["paid", "volunteer"]);
export const accountStatus = pgEnum("account_status", ["invited", "active", "locked", "disabled"]);
export const authChallengePurpose = pgEnum("auth_challenge_purpose", ["mfa", "first_login"]);
export const mfaMethod = pgEnum("mfa_method", ["totp", "webauthn"]);
export const recoveryStatus = pgEnum("account_recovery_status", ["pending", "approved", "executed", "cancelled", "expired"]);
export const recoveryDecision = pgEnum("account_recovery_decision", ["approve", "reject"]);
export const shiftStatus = pgEnum("shift_status", ["planned", "cancelled", "completed", "missed"]);
export const attendanceKind = pgEnum("attendance_event_kind", ["sign_on", "sign_off", "did_not_attend", "correction"]);
export const deploymentPriority = pgEnum("deployment_priority", ["routine", "priority", "urgent"]);
export const equipmentType = pgEnum("equipment_type", ["radio", "earpiece", "tshirt", "jumper", "tracker", "other"]);
export const equipmentColour = pgEnum("equipment_colour", ["black", "pink", "other"]);
export const clothingSize = pgEnum("clothing_size", ["S", "M", "L", "XL", "XXL"]);
export const equipmentCondition = pgEnum("equipment_condition", ["available", "issued", "damaged", "lost", "retired"]);
export const operationState = pgEnum("sync_operation_state", ["pending", "accepted", "conflict", "rejected", "expired"]);

export const userAccounts = pgTable("user_accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  username: text("username").notNull(),
  email: text("email"),
  displayName: text("display_name").notNull(),
  passwordHash: text("password_hash"),
  mustChangePassword: boolean("must_change_password").notNull().default(true),
  status: accountStatus("status").notNull().default("invited"),
  mfaEnrolledAt: timestamp("mfa_enrolled_at", { withTimezone: true }),
  failedSignInCount: integer("failed_sign_in_count").notNull().default(0),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("user_account_username_unique").on(table.username),
  uniqueIndex("user_account_email_unique").on(sql`lower(${table.email})`),
  check("user_account_username_format", sql`length(${table.username}) BETWEEN 3 AND 50 AND ${table.username} ~ '^[a-z][a-z0-9._-]*( [a-z0-9][a-z0-9._-]*)*$'`),
  check("user_account_email_lowercase", sql`${table.email} IS NULL OR ${table.email} = lower(${table.email})`),
  check("user_account_failed_sign_in_nonnegative", sql`${table.failedSignInCount} >= 0`),
]);

export const mfaCredentials = pgTable("mfa_credentials", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => userAccounts.id, { onDelete: "cascade" }),
  method: mfaMethod("method").notNull(),
  label: text("label"),
  secretCiphertext: text("secret_ciphertext"),
  keyVersion: integer("key_version"),
  credentialData: jsonb("credential_data").notNull().default({}),
  enabledAt: timestamp("enabled_at", { withTimezone: true }).notNull().defaultNow(),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
}, (table) => [
  index("mfa_credential_user_idx").on(table.userId),
  check("mfa_totp_secret_required", sql`${table.method} <> 'totp' OR (${table.secretCiphertext} IS NOT NULL AND ${table.keyVersion} IS NOT NULL)`),
]);

export const mfaRecoveryCodes = pgTable("mfa_recovery_codes", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => userAccounts.id, { onDelete: "cascade" }),
  codeHash: text("code_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  usedAt: timestamp("used_at", { withTimezone: true }),
}, (table) => [
  index("mfa_recovery_code_user_idx").on(table.userId),
  uniqueIndex("mfa_recovery_code_hash_unique").on(table.codeHash),
]);

export const permissionDefinitions = pgTable("permission_definitions", {
  key: text("key").primaryKey(),
  description: text("description").notNull(),
  sensitive: boolean("sensitive").notNull().default(false),
});

export const userPermissions = pgTable("user_permissions", {
  userId: uuid("user_id").notNull().references(() => userAccounts.id, { onDelete: "cascade" }),
  permissionKey: text("permission_key").notNull().references(() => permissionDefinitions.key, { onDelete: "restrict" }),
  grantedByUserId: uuid("granted_by_user_id").notNull().references(() => userAccounts.id, { onDelete: "restrict" }),
  grantedAt: timestamp("granted_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  primaryKey({ name: "user_permission_pk", columns: [table.userId, table.permissionKey] }),
  index("user_permission_permission_idx").on(table.permissionKey),
  index("user_permission_granted_by_idx").on(table.grantedByUserId),
]);

export const authSessions = pgTable("auth_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => userAccounts.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull(),
  csrfTokenHash: text("csrf_token_hash").notNull(),
  mfaVerifiedAt: timestamp("mfa_verified_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
}, (table) => [
  uniqueIndex("auth_session_token_hash_unique").on(table.tokenHash),
  index("auth_session_active_user_idx").on(table.userId, table.expiresAt).where(sql`${table.revokedAt} IS NULL`),
  check("auth_session_expiry_after_creation", sql`${table.expiresAt} > ${table.createdAt}`),
]);

export const authChallenges = pgTable("auth_challenges", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => userAccounts.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull(),
  purpose: authChallengePurpose("purpose").notNull().default("mfa"),
  attempts: integer("attempts").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
}, (table) => [
  uniqueIndex("auth_challenge_token_hash_unique").on(table.tokenHash),
  index("auth_challenge_active_user_idx").on(table.userId, table.expiresAt).where(sql`${table.usedAt} IS NULL`),
  check("auth_challenge_attempt_range", sql`${table.attempts} BETWEEN 0 AND 5`),
  check("auth_challenge_expiry_after_creation", sql`${table.expiresAt} > ${table.createdAt}`),
]);

export const accountRecoveryRequests = pgTable("account_recovery_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  targetUserId: uuid("target_user_id").notNull().references(() => userAccounts.id, { onDelete: "restrict" }),
  requestedByUserId: uuid("requested_by_user_id").notNull().references(() => userAccounts.id, { onDelete: "restrict" }),
  status: recoveryStatus("status").notNull().default("pending"),
  reason: text("reason").notNull(),
  requestedAt: timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  executedAt: timestamp("executed_at", { withTimezone: true }),
}, (table) => [
  index("account_recovery_target_status_idx").on(table.targetUserId, table.status),
  index("account_recovery_requester_idx").on(table.requestedByUserId),
  check("account_recovery_no_self_reset", sql`${table.targetUserId} <> ${table.requestedByUserId}`),
  check("account_recovery_expiry_after_request", sql`${table.expiresAt} > ${table.requestedAt}`),
]);

export const accountRecoveryApprovals = pgTable("account_recovery_approvals", {
  requestId: uuid("request_id").notNull().references(() => accountRecoveryRequests.id, { onDelete: "cascade" }),
  approverUserId: uuid("approver_user_id").notNull().references(() => userAccounts.id, { onDelete: "restrict" }),
  decision: recoveryDecision("decision").notNull(),
  decidedAt: timestamp("decided_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  primaryKey({ name: "account_recovery_approval_pk", columns: [table.requestId, table.approverUserId] }),
  index("account_recovery_approver_idx").on(table.approverUserId),
]);

export const events = pgTable("events", {
  id: uuid("id").primaryKey().defaultRandom(),
  eventCode: text("event_code").notNull(),
  name: text("name").notNull(),
  timezone: text("timezone").notNull().default("Europe/London"),
  status: eventStatus("status").notNull().default("draft"),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
  createdByUserId: uuid("created_by_user_id").references(() => userAccounts.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("event_code_unique").on(table.eventCode),
  index("event_status_starts_idx").on(table.status, table.startsAt),
  index("event_created_by_idx").on(table.createdByUserId),
  check("event_time_order", sql`${table.endsAt} > ${table.startsAt}`),
  check("event_code_format", sql`${table.eventCode} ~ '^[A-Za-z][A-Za-z0-9]{1,19}$'`),
]);

export const staff = pgTable("staff", {
  id: uuid("id").primaryKey().defaultRandom(),
  eventId: uuid("event_id").notNull().references(() => events.id, { onDelete: "restrict" }),
  eventStaffNumber: integer("event_staff_number").notNull(),
  staffCode: text("staff_code").notNull(),
  legalName: text("legal_name").notNull(),
  preferredName: text("preferred_name").notNull(),
  displayName: text("display_name").notNull(),
  type: staffType("staff_type").notNull(),
  roleLabel: text("role_label"),
  active: boolean("active").notNull().default(true),
  rowVersion: integer("row_version").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("staff_event_number_unique").on(table.eventId, table.eventStaffNumber),
  uniqueIndex("staff_code_unique").on(table.staffCode),
  index("staff_event_active_name_idx").on(table.eventId, table.active, table.preferredName),
  check("staff_event_number_range", sql`${table.eventStaffNumber} BETWEEN 1 AND 9999`),
  check("staff_row_version_positive", sql`${table.rowVersion} > 0`),
]);

export const positions = pgTable("positions", {
  id: uuid("id").primaryKey().defaultRandom(),
  eventId: uuid("event_id").notNull().references(() => events.id, { onDelete: "restrict" }),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("position_event_name_unique").on(table.eventId, sql`lower(${table.name})`),
  index("position_event_idx").on(table.eventId),
  check("position_name_length", sql`length(trim(${table.name})) BETWEEN 1 AND 120`),
]);

export const shifts = pgTable("shifts", {
  id: uuid("id").primaryKey().defaultRandom(),
  eventId: uuid("event_id").notNull().references(() => events.id, { onDelete: "restrict" }),
  positionId: uuid("position_id").references(() => positions.id, { onDelete: "restrict" }),
  name: text("name").notNull(),
  status: shiftStatus("status").notNull().default("planned"),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
  flaggedAt: timestamp("flagged_at", { withTimezone: true }),
  flagReason: text("flag_reason"),
}, (table) => [
  index("shift_event_starts_idx").on(table.eventId, table.startsAt),
  index("shift_position_starts_idx").on(table.positionId, table.startsAt),
  index("shift_event_range_idx").on(table.eventId, table.startsAt, table.endsAt),
  check("shift_time_order", sql`${table.endsAt} > ${table.startsAt}`),
  check("shift_flag_consistency", sql`(${table.flaggedAt} IS NULL) = (${table.flagReason} IS NULL)`),
]);

export const shiftAssignments = pgTable("shift_assignments", {
  id: uuid("id").primaryKey().defaultRandom(),
  shiftId: uuid("shift_id").notNull().references(() => shifts.id, { onDelete: "restrict" }),
  staffId: uuid("staff_id").notNull().references(() => staff.id, { onDelete: "restrict" }),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  rowVersion: integer("row_version").notNull().default(1),
}, (table) => [
  uniqueIndex("shift_assignment_once").on(table.shiftId, table.staffId),
  index("shift_assignment_staff_idx").on(table.staffId),
  check("shift_assignment_row_version_positive", sql`${table.rowVersion} > 0`),
]);

export const attendanceEvents = pgTable("attendance_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  eventId: uuid("event_id").notNull().references(() => events.id, { onDelete: "restrict" }),
  assignmentId: uuid("assignment_id").references(() => shiftAssignments.id, { onDelete: "restrict" }),
  staffId: uuid("staff_id").notNull().references(() => staff.id, { onDelete: "restrict" }),
  kind: attendanceKind("kind").notNull(),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
  recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
  actorUserId: uuid("actor_user_id").notNull().references(() => userAccounts.id, { onDelete: "restrict" }),
  correctionOfId: uuid("correction_of_id"),
  correctionReason: text("correction_reason"),
}, (table) => [
  index("attendance_event_staff_time_idx").on(table.eventId, table.staffId, table.occurredAt),
  index("attendance_event_assignment_idx").on(table.assignmentId),
  index("attendance_event_actor_idx").on(table.actorUserId),
  index("attendance_event_correction_idx").on(table.correctionOfId),
  check("attendance_correction_consistency", sql`(${table.kind} = 'correction') = (${table.correctionOfId} IS NOT NULL AND ${table.correctionReason} IS NOT NULL)`),
]);

export const deployments = pgTable("deployments", {
  id: uuid("id").primaryKey().defaultRandom(),
  eventId: uuid("event_id").notNull().references(() => events.id, { onDelete: "restrict" }),
  staffId: uuid("staff_id").notNull().references(() => staff.id, { onDelete: "restrict" }),
  label: text("label").notNull(),
  notes: text("notes"),
  priority: deploymentPriority("priority").notNull().default("routine"),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull().defaultNow(),
  endsAt: timestamp("ends_at", { withTimezone: true }),
  changedByUserId: uuid("changed_by_user_id").notNull().references(() => userAccounts.id, { onDelete: "restrict" }),
  rowVersion: integer("row_version").notNull().default(1),
}, (table) => [
  index("deployment_active_event_staff_idx").on(table.eventId, table.staffId, table.startsAt).where(sql`${table.endsAt} IS NULL`),
  index("deployment_changed_by_idx").on(table.changedByUserId),
  check("deployment_time_order", sql`${table.endsAt} IS NULL OR ${table.endsAt} >= ${table.startsAt}`),
  check("deployment_row_version_positive", sql`${table.rowVersion} > 0`),
]);

export const equipmentItems = pgTable("equipment_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  eventId: uuid("event_id").notNull().references(() => events.id, { onDelete: "restrict" }),
  itemCode: text("item_code").notNull(),
  type: equipmentType("equipment_type").notNull(),
  colour: equipmentColour("colour"),
  size: clothingSize("size"),
  condition: equipmentCondition("condition").notNull().default("available"),
  notes: text("notes"),
  rowVersion: integer("row_version").notNull().default(1),
}, (table) => [
  uniqueIndex("equipment_event_code_unique").on(table.eventId, table.itemCode),
  index("equipment_event_type_condition_idx").on(table.eventId, table.type, table.condition),
  check("equipment_clothing_size", sql`${table.type} NOT IN ('tshirt', 'jumper') OR ${table.size} IS NOT NULL`),
  check("equipment_tshirt_colour", sql`${table.type} <> 'tshirt' OR ${table.colour} IN ('black', 'pink')`),
  check("equipment_row_version_positive", sql`${table.rowVersion} > 0`),
]);

export const equipmentAllocations = pgTable("equipment_allocations", {
  id: uuid("id").primaryKey().defaultRandom(),
  eventId: uuid("event_id").notNull().references(() => events.id, { onDelete: "restrict" }),
  equipmentItemId: uuid("equipment_item_id").notNull().references(() => equipmentItems.id, { onDelete: "restrict" }),
  staffId: uuid("staff_id").notNull().references(() => staff.id, { onDelete: "restrict" }),
  issuedByUserId: uuid("issued_by_user_id").notNull().references(() => userAccounts.id, { onDelete: "restrict" }),
  issuedAt: timestamp("issued_at", { withTimezone: true }).notNull().defaultNow(),
  returnedAt: timestamp("returned_at", { withTimezone: true }),
  returnedByUserId: uuid("returned_by_user_id").references(() => userAccounts.id, { onDelete: "restrict" }),
  returnCondition: equipmentCondition("return_condition"),
  returnNotes: text("return_notes"),
}, (table) => [
  uniqueIndex("equipment_active_allocation_unique").on(table.equipmentItemId).where(sql`${table.returnedAt} IS NULL`),
  index("equipment_allocation_event_staff_idx").on(table.eventId, table.staffId, table.issuedAt),
  index("equipment_allocation_issued_by_idx").on(table.issuedByUserId),
  index("equipment_allocation_returned_by_idx").on(table.returnedByUserId),
  check("equipment_return_consistency", sql`(${table.returnedAt} IS NULL AND ${table.returnedByUserId} IS NULL AND ${table.returnCondition} IS NULL) OR (${table.returnedAt} IS NOT NULL AND ${table.returnedByUserId} IS NOT NULL AND ${table.returnCondition} IS NOT NULL)`),
  check("equipment_return_after_issue", sql`${table.returnedAt} IS NULL OR ${table.returnedAt} >= ${table.issuedAt}`),
]);

export const auditEvents = pgTable("audit_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  actorUserId: uuid("actor_user_id").references(() => userAccounts.id, { onDelete: "restrict" }),
  action: text("action").notNull(),
  targetType: text("target_type").notNull(),
  targetOpaqueId: uuid("target_opaque_id"),
  permitted: boolean("permitted").notNull(),
  requestId: uuid("request_id").notNull(),
  reason: text("reason"),
  metadata: jsonb("metadata").notNull().default({}),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("audit_event_time_idx").on(table.occurredAt),
  index("audit_event_actor_time_idx").on(table.actorUserId, table.occurredAt),
  index("audit_event_target_idx").on(table.targetType, table.targetOpaqueId, table.occurredAt),
]);

export const syncOperations = pgTable("sync_operations", {
  id: uuid("id").primaryKey(),
  deviceId: uuid("device_id").notNull(),
  eventId: uuid("event_id").notNull().references(() => events.id, { onDelete: "restrict" }),
  operationType: text("operation_type").notNull(),
  payload: jsonb("payload").notNull(),
  expectedVersion: integer("expected_version"),
  state: operationState("state").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  processedAt: timestamp("processed_at", { withTimezone: true }),
}, (table) => [
  index("sync_operation_device_state_created_idx").on(table.deviceId, table.state, table.createdAt),
  index("sync_operation_event_state_created_idx").on(table.eventId, table.state, table.createdAt),
]);
