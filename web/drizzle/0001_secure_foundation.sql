-- Pre-production migration: the existing database must contain no live records.
-- This deliberately fails instead of inventing event/staff identifiers for existing rows.
CREATE TYPE account_status AS ENUM ('invited','active','locked','disabled');
CREATE TYPE mfa_method AS ENUM ('totp','webauthn');
CREATE TYPE account_recovery_status AS ENUM ('pending','approved','executed','cancelled','expired');
CREATE TYPE account_recovery_decision AS ENUM ('approve','reject');
CREATE TYPE staff_type AS ENUM ('paid','volunteer');
CREATE TYPE shift_status AS ENUM ('planned','cancelled','completed','missed');
CREATE TYPE deployment_priority AS ENUM ('routine','priority','urgent');
CREATE TYPE equipment_type AS ENUM ('radio','earpiece','tshirt','jumper','tracker','other');
CREATE TYPE equipment_colour AS ENUM ('black','pink','other');
CREATE TYPE clothing_size AS ENUM ('S','M','L','XL','XXL');
CREATE TYPE equipment_condition AS ENUM ('available','issued','damaged','lost','retired');
ALTER TYPE attendance_event_kind ADD VALUE IF NOT EXISTS 'did_not_attend' BEFORE 'correction';

CREATE TABLE user_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  display_name text NOT NULL,
  password_hash text,
  status account_status NOT NULL DEFAULT 'invited',
  mfa_enrolled_at timestamptz,
  failed_sign_in_count integer NOT NULL DEFAULT 0,
  locked_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_account_email_lowercase CHECK (email=lower(email)),
  CONSTRAINT user_account_failed_sign_in_nonnegative CHECK (failed_sign_in_count>=0)
);
CREATE UNIQUE INDEX user_account_email_unique ON user_accounts(lower(email));

CREATE TABLE permission_definitions (
  key text PRIMARY KEY,
  description text NOT NULL,
  sensitive boolean NOT NULL DEFAULT false
);

CREATE TABLE user_permissions (
  user_id uuid NOT NULL REFERENCES user_accounts(id) ON DELETE CASCADE,
  permission_key text NOT NULL REFERENCES permission_definitions(key) ON DELETE RESTRICT,
  granted_by_user_id uuid NOT NULL REFERENCES user_accounts(id) ON DELETE RESTRICT,
  granted_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_permission_pk PRIMARY KEY(user_id,permission_key)
);
CREATE INDEX user_permission_permission_idx ON user_permissions(permission_key);
CREATE INDEX user_permission_granted_by_idx ON user_permissions(granted_by_user_id);

CREATE TABLE mfa_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES user_accounts(id) ON DELETE CASCADE,
  method mfa_method NOT NULL,
  label text,
  secret_ciphertext text,
  key_version integer,
  credential_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  enabled_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  revoked_at timestamptz,
  CONSTRAINT mfa_totp_secret_required CHECK (method<>'totp' OR (secret_ciphertext IS NOT NULL AND key_version IS NOT NULL))
);
CREATE INDEX mfa_credential_user_idx ON mfa_credentials(user_id);

CREATE TABLE mfa_recovery_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES user_accounts(id) ON DELETE CASCADE,
  code_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  used_at timestamptz
);
CREATE INDEX mfa_recovery_code_user_idx ON mfa_recovery_codes(user_id);
CREATE UNIQUE INDEX mfa_recovery_code_hash_unique ON mfa_recovery_codes(code_hash);

CREATE TABLE auth_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES user_accounts(id) ON DELETE CASCADE,
  token_hash text NOT NULL,
  mfa_verified_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  CONSTRAINT auth_session_expiry_after_creation CHECK (expires_at>created_at)
);
CREATE UNIQUE INDEX auth_session_token_hash_unique ON auth_sessions(token_hash);
CREATE INDEX auth_session_active_user_idx ON auth_sessions(user_id,expires_at) WHERE revoked_at IS NULL;

CREATE TABLE account_recovery_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_user_id uuid NOT NULL REFERENCES user_accounts(id) ON DELETE RESTRICT,
  requested_by_user_id uuid NOT NULL REFERENCES user_accounts(id) ON DELETE RESTRICT,
  status account_recovery_status NOT NULL DEFAULT 'pending',
  reason text NOT NULL,
  requested_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  executed_at timestamptz,
  CONSTRAINT account_recovery_no_self_reset CHECK (target_user_id<>requested_by_user_id),
  CONSTRAINT account_recovery_expiry_after_request CHECK (expires_at>requested_at)
);
CREATE INDEX account_recovery_target_status_idx ON account_recovery_requests(target_user_id,status);
CREATE INDEX account_recovery_requester_idx ON account_recovery_requests(requested_by_user_id);

CREATE TABLE account_recovery_approvals (
  request_id uuid NOT NULL REFERENCES account_recovery_requests(id) ON DELETE CASCADE,
  approver_user_id uuid NOT NULL REFERENCES user_accounts(id) ON DELETE RESTRICT,
  decision account_recovery_decision NOT NULL,
  decided_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT account_recovery_approval_pk PRIMARY KEY(request_id,approver_user_id)
);
CREATE INDEX account_recovery_approver_idx ON account_recovery_approvals(approver_user_id);

ALTER TABLE events ADD COLUMN event_code text NOT NULL;
ALTER TABLE events ADD COLUMN created_by_user_id uuid REFERENCES user_accounts(id) ON DELETE RESTRICT;
ALTER TABLE events ADD CONSTRAINT event_code_format CHECK (event_code~'^[A-Za-z][A-Za-z0-9]{1,19}$');
CREATE UNIQUE INDEX event_code_unique ON events(event_code);
CREATE INDEX event_status_starts_idx ON events(status,starts_at);
CREATE INDEX event_created_by_idx ON events(created_by_user_id);

ALTER TABLE staff ADD COLUMN event_id uuid NOT NULL REFERENCES events(id) ON DELETE RESTRICT;
ALTER TABLE staff ADD COLUMN event_staff_number integer NOT NULL;
ALTER TABLE staff ADD COLUMN staff_code text NOT NULL;
ALTER TABLE staff ADD COLUMN legal_name text NOT NULL;
ALTER TABLE staff ADD COLUMN preferred_name text NOT NULL;
ALTER TABLE staff ADD COLUMN staff_type staff_type NOT NULL;
ALTER TABLE staff ADD CONSTRAINT staff_event_number_range CHECK (event_staff_number BETWEEN 1 AND 9999);
CREATE UNIQUE INDEX staff_event_number_unique ON staff(event_id,event_staff_number);
CREATE UNIQUE INDEX staff_code_unique ON staff(staff_code);
CREATE INDEX staff_event_active_name_idx ON staff(event_id,active,preferred_name);

ALTER TABLE shifts ADD COLUMN status shift_status NOT NULL DEFAULT 'planned';
ALTER TABLE shifts ADD COLUMN flagged_at timestamptz;
ALTER TABLE shifts ADD COLUMN flag_reason text;
ALTER TABLE shifts ADD CONSTRAINT shift_flag_consistency CHECK ((flagged_at IS NULL)=(flag_reason IS NULL));
CREATE INDEX shift_event_starts_idx ON shifts(event_id,starts_at);

CREATE INDEX shift_assignment_staff_idx ON shift_assignments(staff_id);

ALTER TABLE attendance_events ADD CONSTRAINT attendance_actor_user_fk FOREIGN KEY(actor_user_id) REFERENCES user_accounts(id) ON DELETE RESTRICT;
CREATE INDEX attendance_event_assignment_idx ON attendance_events(assignment_id);
CREATE INDEX attendance_event_actor_idx ON attendance_events(actor_user_id);
CREATE INDEX attendance_event_correction_idx ON attendance_events(correction_of_id);
ALTER INDEX attendance_event_staff_time RENAME TO attendance_event_staff_time_idx;

ALTER TABLE audit_events ADD CONSTRAINT audit_actor_user_fk FOREIGN KEY(actor_user_id) REFERENCES user_accounts(id) ON DELETE RESTRICT;
ALTER INDEX audit_event_time RENAME TO audit_event_time_idx;
CREATE INDEX audit_event_actor_time_idx ON audit_events(actor_user_id,occurred_at);
CREATE INDEX audit_event_target_idx ON audit_events(target_type,target_opaque_id,occurred_at);

ALTER INDEX sync_operation_queue RENAME TO sync_operation_device_state_created_idx;
CREATE INDEX sync_operation_event_state_created_idx ON sync_operations(event_id,state,created_at);

CREATE TABLE deployments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE RESTRICT,
  staff_id uuid NOT NULL REFERENCES staff(id) ON DELETE RESTRICT,
  label text NOT NULL,
  notes text,
  priority deployment_priority NOT NULL DEFAULT 'routine',
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  changed_by_user_id uuid NOT NULL REFERENCES user_accounts(id) ON DELETE RESTRICT,
  row_version integer NOT NULL DEFAULT 1,
  CONSTRAINT deployment_time_order CHECK (ends_at IS NULL OR ends_at>=starts_at),
  CONSTRAINT deployment_row_version_positive CHECK (row_version>0)
);
CREATE INDEX deployment_active_event_staff_idx ON deployments(event_id,staff_id,starts_at) WHERE ends_at IS NULL;
CREATE INDEX deployment_changed_by_idx ON deployments(changed_by_user_id);

CREATE TABLE equipment_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE RESTRICT,
  item_code text NOT NULL,
  equipment_type equipment_type NOT NULL,
  colour equipment_colour,
  size clothing_size,
  condition equipment_condition NOT NULL DEFAULT 'available',
  notes text,
  row_version integer NOT NULL DEFAULT 1,
  CONSTRAINT equipment_clothing_size CHECK (equipment_type NOT IN ('tshirt','jumper') OR size IS NOT NULL),
  CONSTRAINT equipment_tshirt_colour CHECK (equipment_type<>'tshirt' OR (colour IS NOT NULL AND colour IN ('black','pink'))),
  CONSTRAINT equipment_row_version_positive CHECK (row_version>0)
);
CREATE UNIQUE INDEX equipment_event_code_unique ON equipment_items(event_id,item_code);
CREATE INDEX equipment_event_type_condition_idx ON equipment_items(event_id,equipment_type,condition);

CREATE TABLE equipment_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE RESTRICT,
  equipment_item_id uuid NOT NULL REFERENCES equipment_items(id) ON DELETE RESTRICT,
  staff_id uuid NOT NULL REFERENCES staff(id) ON DELETE RESTRICT,
  issued_by_user_id uuid NOT NULL REFERENCES user_accounts(id) ON DELETE RESTRICT,
  issued_at timestamptz NOT NULL DEFAULT now(),
  returned_at timestamptz,
  returned_by_user_id uuid REFERENCES user_accounts(id) ON DELETE RESTRICT,
  return_condition equipment_condition,
  return_notes text,
  CONSTRAINT equipment_return_consistency CHECK ((returned_at IS NULL AND returned_by_user_id IS NULL AND return_condition IS NULL) OR (returned_at IS NOT NULL AND returned_by_user_id IS NOT NULL AND return_condition IS NOT NULL)),
  CONSTRAINT equipment_return_after_issue CHECK (returned_at IS NULL OR returned_at>=issued_at)
);
CREATE UNIQUE INDEX equipment_active_allocation_unique ON equipment_allocations(equipment_item_id) WHERE returned_at IS NULL;
CREATE INDEX equipment_allocation_event_staff_idx ON equipment_allocations(event_id,staff_id,issued_at);
CREATE INDEX equipment_allocation_issued_by_idx ON equipment_allocations(issued_by_user_id);
CREATE INDEX equipment_allocation_returned_by_idx ON equipment_allocations(returned_by_user_id);
