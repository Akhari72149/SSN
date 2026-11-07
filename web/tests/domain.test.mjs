import assert from "node:assert/strict";
import test from "node:test";
import {
  canExecutePrivilegedRecovery,
  formatStaffCode,
  isStaffRole,
  permissionCatalog,
  permissions,
  staffRoles,
  validateEventCode,
} from "../db/domain.ts";

test("formats event-specific staff IDs", () => {
  assert.equal(formatStaffCode("Btown", 1), "SSN-Btown-0001");
  assert.equal(formatStaffCode("Reading", 42), "SSN-Reading-0042");
  assert.throws(() => formatStaffCode("bad code", 1));
  assert.throws(() => formatStaffCode("Reading", 10000));
  assert.equal(validateEventCode("  Reading  "), "Reading");
});

test("requires two distinct approvers and prevents self-reset", () => {
  assert.equal(canExecutePrivilegedRecovery({ targetUserId: "anna", requesterUserId: "anna", approvingUserIds: ["madeline", "admin"] }), false);
  assert.equal(canExecutePrivilegedRecovery({ targetUserId: "anna", requesterUserId: "madeline", approvingUserIds: ["madeline"] }), false);
  assert.equal(canExecutePrivilegedRecovery({ targetUserId: "anna", requesterUserId: "madeline", approvingUserIds: ["madeline", "admin"] }), true);
  assert.equal(canExecutePrivilegedRecovery({ targetUserId: "anna", requesterUserId: "madeline", approvingUserIds: ["anna", "admin"] }), false);
});

test("permission catalog contains unique individual grants", () => {
  const keys = permissionCatalog.map((entry) => entry.key);
  assert.equal(new Set(keys).size, keys.length);
  assert.ok(keys.includes(permissions.accountReset));
  assert.ok(keys.includes(permissions.reportPayroll));
});

test("staff roles are limited to the agreed operational list", () => {
  assert.deepEqual(staffRoles, ["Volunteer", "Volunteer Champion", "Supervisor", "Deputy", "Manager"]);
  for (const role of staffRoles) assert.equal(isStaffRole(role), true);
  assert.equal(isStaffRole("Responder"), false);
  assert.equal(isStaffRole("manager"), false);
});
