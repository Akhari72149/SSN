export const permissions = {
  accountManage: "account.manage",
  accountReset: "account.reset",
  permissionManage: "permission.manage",
  eventManage: "event.manage",
  staffRead: "staff.read",
  staffManage: "staff.manage",
  shiftManage: "shift.manage",
  attendanceRecord: "attendance.record",
  attendanceCorrect: "attendance.correct",
  deploymentManage: "deployment.manage",
  equipmentManage: "equipment.manage",
  reportPayroll: "report.payroll",
  reportDeployment: "report.deployment",
  auditRead: "audit.read",
  incidentRead: "incident.read",
  incidentRestrictedRead: "incident.restricted.read",
  incidentClassificationRestrict: "incident.classification.restrict",
  incidentClassificationUnrestrict: "incident.classification.unrestrict",
  incidentPurge: "incident.purge",
} as const;

export type Permission = (typeof permissions)[keyof typeof permissions];

export const staffRoles = [
  "Volunteer",
  "Volunteer Champion",
  "Supervisor",
  "Deputy",
  "Manager",
] as const;

export type StaffRole = (typeof staffRoles)[number];

export function isStaffRole(value: unknown): value is StaffRole {
  return typeof value === "string" && staffRoles.some((role) => role === value);
}

export const permissionCatalog: ReadonlyArray<{
  key: Permission;
  description: string;
  sensitive: boolean;
}> = [
  { key: permissions.accountManage, description: "Invite, disable and unlock user accounts", sensitive: true },
  { key: permissions.accountReset, description: "Request and approve another user's account recovery", sensitive: true },
  { key: permissions.permissionManage, description: "Grant and revoke individual permissions", sensitive: true },
  { key: permissions.eventManage, description: "Create, open, close and archive events", sensitive: false },
  { key: permissions.staffRead, description: "View the staff register", sensitive: true },
  { key: permissions.staffManage, description: "Create and update staff records", sensitive: true },
  { key: permissions.shiftManage, description: "Create, assign, cancel and flag shifts", sensitive: false },
  { key: permissions.attendanceRecord, description: "Record sign-on, sign-off and non-attendance", sensitive: false },
  { key: permissions.attendanceCorrect, description: "Correct attendance while preserving its audit history", sensitive: true },
  { key: permissions.deploymentManage, description: "Assign and complete staff deployments", sensitive: false },
  { key: permissions.equipmentManage, description: "Issue, return and change the condition of equipment", sensitive: false },
  { key: permissions.reportPayroll, description: "Export paid-staff attendance for payroll", sensitive: true },
  { key: permissions.reportDeployment, description: "Export deployment records", sensitive: true },
  { key: permissions.auditRead, description: "View security and operational audit history", sensitive: true },
  { key: permissions.incidentRead, description: "View general incident records when the later module is enabled", sensitive: true },
  { key: permissions.incidentRestrictedRead, description: "View restricted incident records when enabled", sensitive: true },
  { key: permissions.incidentClassificationRestrict, description: "Classify an incident as restricted", sensitive: true },
  { key: permissions.incidentClassificationUnrestrict, description: "Return a restricted incident to general", sensitive: true },
  { key: permissions.incidentPurge, description: "Irreversibly purge an incident when enabled", sensitive: true },
];

const EVENT_CODE_PATTERN = /^[A-Za-z][A-Za-z0-9]{1,19}$/;

export function validateEventCode(value: string): string {
  const eventCode = value.trim();
  if (!EVENT_CODE_PATTERN.test(eventCode)) {
    throw new Error("Event code must be 2–20 letters or numbers and start with a letter");
  }
  return eventCode;
}

export function formatStaffCode(eventCodeInput: string, eventStaffNumber: number): string {
  const eventCode = validateEventCode(eventCodeInput);
  if (!Number.isInteger(eventStaffNumber) || eventStaffNumber < 1 || eventStaffNumber > 9999) {
    throw new Error("Event staff number must be an integer from 1 to 9999");
  }
  return `SSN-${eventCode}-${String(eventStaffNumber).padStart(4, "0")}`;
}

export function canExecutePrivilegedRecovery(input: {
  targetUserId: string;
  requesterUserId: string;
  approvingUserIds: readonly string[];
}): boolean {
  if (input.targetUserId === input.requesterUserId) return false;
  const distinctApprovers = new Set(input.approvingUserIds.filter((id) => id !== input.targetUserId));
  return distinctApprovers.size >= 2;
}
