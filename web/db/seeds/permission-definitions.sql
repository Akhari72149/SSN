INSERT INTO permission_definitions(key,description,sensitive) VALUES
  ('account.manage','Invite, disable and unlock user accounts',true),
  ('account.reset','Request and approve another user''s account recovery',true),
  ('permission.manage','Grant and revoke individual permissions',true),
  ('event.manage','Create, open, close and archive events',false),
  ('staff.read','View the staff register',true),
  ('staff.manage','Create and update staff records',true),
  ('shift.manage','Create, assign, cancel and flag shifts',false),
  ('attendance.record','Record sign-on, sign-off and non-attendance',false),
  ('attendance.correct','Correct attendance while preserving its audit history',true),
  ('deployment.manage','Assign and complete staff deployments',false),
  ('equipment.manage','Issue, return and change the condition of equipment',false),
  ('report.payroll','Export paid-staff attendance for payroll',true),
  ('report.deployment','Export deployment records',true),
  ('audit.read','View security and operational audit history',true),
  ('incident.read','View general incident records when the later module is enabled',true),
  ('incident.restricted.read','View restricted incident records when enabled',true),
  ('incident.classification.restrict','Classify an incident as restricted',true),
  ('incident.classification.unrestrict','Return a restricted incident to general',true),
  ('incident.purge','Irreversibly purge an incident when enabled',true)
ON CONFLICT(key) DO UPDATE SET
  description=excluded.description,
  sensitive=excluded.sensitive;
