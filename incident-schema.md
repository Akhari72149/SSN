# Formal Incident Schema — Initial Synthetic Draft

Status: proposed field model for prototype only. This is not an approved case form or legal record policy.

## Record structure

| Group | Proposed fields | Notes |
|---|---|---|
| Identity | incident ID, event ID, created/updated/submitted times, author | Server IDs/times; UTC plus UK display |
| Classification | General/Restricted, classifier, time, reason | Separate permission for restrict/unrestrict |
| Categorisation | incident type, subtype(s), severity/priority | Controlled lists; final vocabulary requires Safer Spaces input |
| Occurrence | occurred date/time or approximate flag, event-local timezone, location/area | Avoid unnecessary precision; preserve uncertainty |
| Summary | concise factual summary, detailed account | Structured prompts preferred; warning against speculation/excess data |
| People | person supported, reporter, witness, alleged perpetrator/subject, staff author | Separate person roles; allow unknown/anonymised descriptors where appropriate |
| Welfare | immediate welfare status, observed/reported distinction, support offered/accepted/declined | May contain special-category data; controlled access |
| Contacts/actions | contact type, organisation/person, time, outcome/reference, next action | Police, medical, safeguarding, festival control etc. as approved |
| Status | draft, submitted, active, awaiting action, closed, purged | Purged is not an incident row; only content-free purge security event remains |
| Ownership | assigned users/team, next-review date | Drives offline case distribution where approved |
| Evidence/attachments | deferred | No uploads in initial prototype beyond synthetic placeholder |
| Retention | closed date, retention category/review date, hold state/reason | Final schedule requires advice |
| Revision | version, changed fields, actor, reason, occurrence/device/server times | Immutable revision history until purge |

## Person subrecord

Use role-specific links rather than a single `people` text box. Initial minimal fields: display/reference name or anonymous descriptor, role in incident, preferred contact only if necessary, age-band/minor indicator where approved, and organisation/reference. Do not collect home address, date of birth, health detail, or protected characteristics unless the formal field/purpose review approves them.

## Status transitions

`Draft → Submitted → Active/Awaiting action → Closed` with authorised reopening. Restrict/unrestrict is orthogonal to status. Hold can apply to any non-purged state. Purge is allowed only online, with permission and no hold, and permanently removes the record rather than retaining a `Purged` incident stub.

## Validation

- Type, event, occurrence time/approximation, location/unknown, factual summary, status and author are required at submission.
- Exact people/contact fields are conditional and purpose-limited.
- Server validates allowed transitions, classification permission, assignment and version.
- Narrative size limits, safe Unicode handling and output encoding apply.
- Offline-created records use client-generated UUID plus server receipt ID/time and clock-skew metadata.

## General vs Restricted

Both use the same protected schema. Restricted affects visibility, not underlying sensitivity. Unauthorised accounts receive no result or aggregate trace. Classification changes produce separate audited commands.

## Export

Export is server-generated from the authorised current/revision view, marked with incident ID, generation time, classification, exporter and purpose. Restricted export requires its additional permission. Downloads are encrypted where practical, short-lived and audited.

## Purge

The dedicated flow removes the entire incident graph, revisions, people links, contacts/actions, files/derivatives, exports in system control, indexes and device sync. It destroys the per-incident encryption key. Third-party copies remain outside system control.

## Questions for the later field workshop

- Final incident type/subtype vocabulary and mandatory combinations.
- Exact welfare/status choices and who can view/edit them.
- Required roles/person identifiers and when anonymity is appropriate.
- Contact/referral types and police/reference fields.
- Draft/submission/closure ownership and required sign-off.
- Retention categories, holds and disclosure workflow.
- Whether attachments, signatures or police-form formats are ever required.

