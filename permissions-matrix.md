# Capability and Permission Matrix

Status: proposed server-authoritative access model. Job roles are reusable templates; each account receives explicit grants/revocations.

## Principles

- Deny by default; no shared accounts.
- Permissions are organisation-wide unless the grant is explicitly event-limited in future.
- General operations access never implies incident access.
- Restricted incident existence is itself protected.
- Sensitive/destructive permissions require fresh authentication at use time.
- Every permission change records actor, target, before/after, reason and timestamp and revokes affected sessions/offline leases.

## Capability catalogue

| Domain | Capability | Allows |
|---|---|---|
| Dashboard | `dashboard.view` | View permitted aggregate operational dashboard |
| Staff | `staff.read` | Search/view operational staff register |
| Staff | `staff.manage` | Add/edit/activate/deactivate staff |
| Staff | `staff.import` | Preview and approve roster import |
| Shifts | `shift.read` | View plans |
| Shifts | `shift.manage` | Create/change/cancel assignments |
| Attendance | `attendance.read` | View attendance/current state |
| Attendance | `attendance.record` | Sign on/off and record breaks |
| Attendance | `attendance.correct` | Correct events with reason |
| Equipment | `equipment.read` | View custody and availability |
| Equipment | `equipment.record` | Issue/return/update condition |
| Equipment | `equipment.manage` | Maintain numbered assets/types |
| Deployment | `deployment.read` | View current deployment |
| Deployment | `deployment.manage` | Assign/change tasks and notes |
| Radio log | `radio_log.read` | View informal operational log |
| Radio log | `radio_log.write` | Add/correct entries with history |
| Incidents | `incident.general.read` | List/view General incidents |
| Incidents | `incident.create` | Create incident drafts; classification limited by other grants |
| Incidents | `incident.general.update` | Update General incidents |
| Incidents | `incident.restricted.read` | Discover/list/view Restricted incidents |
| Incidents | `incident.restricted.update` | Update Restricted incidents |
| Incidents | `incident.classification.restrict` | Change General to Restricted |
| Incidents | `incident.classification.unrestrict` | Change Restricted to General |
| Incidents | `incident.offline` | Pin authorised incident content offline |
| Incidents | `incident.export` | Export General incidents |
| Incidents | `incident.restricted.export` | Export Restricted incidents |
| Incidents | `incident.hold.manage` | Apply/release preservation holds |
| Incidents | `incident.purge` | Execute confirmed full purge |
| Reports | `reports.aggregate` | View/export permitted aggregate reports |
| Events | `event.read` | View event configuration/lifecycle |
| Events | `event.manage` | Create/open/close/archive events |
| Setup | `setup.manage` | Manage controlled lists/settings |
| Access | `access.read` | View accounts and grants |
| Access | `access.manage` | Create/disable accounts and change ordinary grants |
| Access | `access.privileged` | Grant/revoke restricted, export, hold and purge capabilities |
| Audit | `audit.read.operations` | Read operational audit metadata |
| Audit | `audit.read.security` | Read security/access audit metadata |
| System | `sessions.revoke` | Revoke sessions/offline leases |
| System | `exports.manage` | Revoke/expire generated exports |

## Suggested templates

Templates accelerate setup but never override individual grants.

| Template | Typical baseline |
|---|---|
| Supervisor | Dashboard, staff/shift/attendance/equipment/deployment read and operational record actions |
| Manager | Supervisor plus planning, corrections, radio log and General incident access/update |
| Administrator | Account/setup/event administration without incident content by default |
| Director | Broad operations, reports and access management; Restricted/purge still explicitly granted |

No template automatically receives `incident.restricted.read`, restricted export, hold management, purge, or privileged access delegation. Those must be deliberately assigned per account.

## Enforcement tests

- Test every capability as allow and deny through UI and direct API.
- Test combinations: read without update, update without classification, restricted read without export, purge without restricted read, and stale/offline permission.
- Restricted IDs return indistinguishable not-found results to unauthorised users.
- Counts, search suggestions, relationships, exports, notifications and logs follow the same permission filter.
- Privilege changes take effect online immediately and offline within the approved lease window.

