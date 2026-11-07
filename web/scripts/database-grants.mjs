export function applicationGrantSql(appName = "ssn_app") {
  if (!/^[a-z_][a-z0-9_]*$/.test(appName)) throw new Error("Invalid PostgreSQL application role name");
  return `
    grant usage on schema public to ${appName};
    grant select on all tables in schema public to ${appName};
    grant insert, update on table
      public.user_accounts,
      public.mfa_credentials,
      public.mfa_recovery_codes,
      public.user_permissions,
      public.auth_sessions,
      public.auth_challenges,
      public.account_recovery_requests,
      public.account_recovery_approvals,
      public.events,
      public.staff,
      public.positions,
      public.shifts,
      public.shift_assignments,
      public.attendance_events,
      public.deployments,
      public.equipment_items,
      public.equipment_allocations,
      public.audit_events,
      public.sync_operations
    to ${appName};
    grant delete on table public.auth_challenges, public.user_permissions to ${appName};
    revoke all on table public.ssn_schema_migrations from ${appName};
    grant usage, select on all sequences in schema public to ${appName};
  `;
}
