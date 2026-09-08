# Data Classification, Minimisation and Lifecycle

Status: proposed policy baseline, not legal advice. Retention periods below are decision prompts, not approved legal limits. The organisation must document purpose, lawful basis, necessity, contractual/statutory obligations, and any relevant limitation periods with its DPO/privacy lead or qualified adviser.

## Guiding policy

Collect only data necessary for a named operational purpose. Do not add free-text welfare, medical, safeguarding, disciplinary, or criminal-allegation content to general notes. Separate higher-risk records, restrict access, and consider whether they belong in a different specialist system.

ICO guidance states that personal data must be used for specified purposes, minimised, kept accurate, protected, and retained only as long as justified; UK GDPR does not prescribe one universal retention period. See [ICO data protection principles](https://ico.org.uk/for-organisations/advice-for-small-organisations/getting-started-with-gdpr/data-protection-principles-definitions-and-key-terms/), [purpose limitation](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/data-protection-principles/a-guide-to-the-data-protection-principles/purpose-limitation/), and [storage limitation](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/data-protection-principles/a-guide-to-the-data-protection-principles/storage-limitation/). Some ICO guidance is under review following the Data (Use and Access) Act 2025, so obtain current advice before production.

## Classification levels

| Level | Examples in this system | Default handling |
|---|---|---|
| C1 Internal | equipment type catalogue, non-sensitive setup values | Authenticated users; no public sharing |
| C2 Personal/operational | name, staff ID, contact detail if necessary, shift assignment, attendance times, asset custody | Need-to-know role access; encrypted; logged exports |
| C3 Sensitive operational | live deployment, detailed operational notes, incident/radio entries, tracker allocation/location if used | Narrow scoped roles; short retention where possible; no general dashboard display; no broad offline cache |
| C4 Special/restricted | health or welfare information, equality data, allegations/offence data, safeguarding information | Do not collect in MVP; separate purpose, system/partition, policy, lawful basis/condition, DPIA and specialist advice required |
| Security metadata | account IDs, IP/device/session signals, audit events | Security/admin access only; proportionate collection and retention |

The organisation’s public description confirms that its services address disclosures and immediate specialist support relating to domestic abuse, sexual violence, harassment, and people at risk of harm. Formal incident forms could therefore contain highly sensitive special-category data, alleged-offence information, safeguarding material, and data about third parties. This does not prove that every case contains those categories; it means the incident module must be treated as C4 unless a field-level assessment establishes otherwise. It must be segregated from routine operations, excluded from general offline storage and dashboards, and reviewed with an appropriate privacy/safeguarding adviser before implementation.

Operational visibility (`General` or `Restricted`) is separate from legal/data sensitivity. A `General` incident is not low-sensitivity or suitable for broad disclosure. Both receive C4-grade storage, audit, retention, export, backup, and response controls; `Restricted` adds narrower content access and redacted ordinary views.

Classification is contextual: a roster plus location and time can become more sensitive in combination. Pseudonymised data remains personal data if re-identification is possible.

## Minimum data proposal

| Record | Minimum fields proposed | Avoid by default |
|---|---|---|
| Staff | opaque ID, display name, active/inactive, operational team/role if needed | Home address, personal phone/email, DOB, emergency contact, health data |
| Shift | ID, site/team, start/end, status | Unstructured personal notes |
| Assignment | shift ID, staff ID, operational function | Performance commentary |
| Attendance event | staff/shift IDs, event type, server time, actor, correction link/reason | GPS, device fingerprint, narrative excuses |
| Asset | opaque ID, human label, type, status | Unneeded purchase/user history |
| Custody event | asset, recipient, issue/return time, issuer/receiver, condition code | Free-text personal commentary |
| Deployment | operational label, assigned staff, start/end/status, minimal note | Continuous location trail unless separately justified |
| Incident/radio entry | time, author, category, concise factual text, related operational IDs | Medical detail, speculative allegations, excessive third-party data |

## Retention decision matrix

No row becomes policy until an owner approves the purpose and evidence for the period.

| Data set | Starting proposal | Trigger | Disposal | Decision owner/question |
|---|---|---|---|---|
| Active staff directory | Employment/engagement plus short closure window | Person becomes inactive | Delete or retain a minimal suppression/reference record | HR/privacy lead: what obligations require residual data? |
| Shift plan & attendance | Short operational period, then policy-defined archive | Shift closes | Delete identifiers or aggregate/anonymise where possible | Finance/HR/legal: payroll, contract, dispute, H&S needs? |
| Asset custody | Asset lifecycle or shorter if person-level history is unnecessary | Return/retirement/claim closure | Remove personal linkage; retain non-personal asset history | Operations/finance: insurance and asset-control needs? |
| Live deployment/tasks | Very short operational window by default | Operation closes | Delete/anonymise routine detail; preserve only justified records | Operations/privacy: post-event review purpose? |
| Routine radio log | Short, fixed review window | Log closes | Secure deletion or authorised incident extraction | Operations/legal: evidential or licensing obligations? |
| Incident records | Case/category-specific schedule | Case closes | Secure deletion, anonymisation, or legal hold | DPO/legal/safeguarding: classify before setting period |
| Audit/security logs | Typically months, calibrated to detection and investigation need | Event time | Automated deletion; protected legal hold | Security/privacy: what detection window is proportionate? |
| Exports | Hours/days, not permanent shared copies | Export created | Auto-expire and delete; revoke links | Data owner: approved export purposes? |
| Backups | Short rotating schedule plus tested recovery points | Backup time | Cryptographic/managed expiry | Service owner: RPO/RTO and provider deletion behaviour? |

## Lifecycle controls

- Maintain a record of processing activities/data inventory and named owners.
- Encode retention by record type and closure trigger, not one global “archive forever” rule.
- Run automated expiry with preview, approval for exceptions, immutable deletion evidence, and legal-hold support.
- Deletion covers production, replicas, search indexes, caches, export staging, analytics, and—through documented expiry—backups. Taking data offline is not deletion.
- Prefer irreversible aggregation/anonymisation for long-term metrics. Test whether re-identification remains reasonably possible.
- Review schedules at least annually and after purpose, law, contract, or system changes.
- Handle access, correction, restriction, objection, portability, and erasure requests through a documented identity-verified process; do not promise deletion where a valid exception may apply.

## Backups

- Encrypt with provider-managed keys initially; separate access from application administration.
- Use automated, versioned backups with at least one logically isolated/immutable recovery copy where proportionate.
- Define and test RPO/RTO; conduct restoration exercises at least twice yearly and after material changes.
- Never restore expired data into normal service without rerunning retention jobs.
- Document provider regions, sub-processors, recovery access, retention, and verified deletion behaviour.

## Incident response

Maintain named incident lead/deputy, out-of-band contact list, evidence-preservation steps, containment playbooks, processor contacts, communications templates, and a breach register. Every suspected personal-data breach gets a recorded risk assessment. ICO guidance says notifiable breaches must be reported without undue delay and, where feasible, within 72 hours of awareness; high-risk cases may also require notifying affected people. Record all breaches whether reported or not. See [ICO breach guide](https://ico.org.uk/for-organisations/report-a-breach/personal-data-breach/personal-data-breaches-a-guide/) and [NCSC response and recovery guidance](https://www.ncsc.gov.uk/collection/small-business-guidance--response-and-recovery).

## Formal advice gates

Obtain DPO/privacy/legal advice before deciding:

- controller/processor roles, Article 6 lawful bases, privacy notices, and employee consultation;
- any Article 9 special-category or criminal-offence processing and DPA 2018 conditions/policy documents;
- worker monitoring, location tracking, automated attendance flags used for employment decisions;
- DPIA necessity and residual high-risk consultation;
- incident/safeguarding record obligations, disclosure, legal holds, and retention;
- international transfers, processor terms, subject-right handling, and breach notification decisions.

ICO guidance confirms special-category processing requires both an Article 6 basis and an Article 9 condition, with DPA 2018 Schedule 1 requirements in some cases; health data deserves additional protection. See [ICO special-category rules](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/lawful-basis/special-category-data/what-are-the-rules-on-special-category-data/) and [workers’ health information](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/employment/information-about-workers-health/data-protection-and-workers-health-information/).

## Police/evidential retention decision

The current reason proposed for retaining incident records is “in case required by police”. Treat this as a need to investigate, not a final retention rule. Indefinite retention “just in case” is not defensible by itself. Before production, document which case categories may be requested, the lawful basis/conditions, standard period and closure trigger, preservation/legal holds for active requests, disclosure approval and chain of custody, and deletion/anonymisation after expiry. This requires qualified UK privacy/legal and safeguarding advice; possible police interest does not automatically justify collecting or indefinitely retaining every case.

The system will support authorised per-incident full purge. A preservation hold overrides purge eligibility until separately released. Full purge combines cryptographic erasure of the incident key with deletion from live/derived stores. Physical backup blocks expire later under the backup schedule but cannot reveal the purged ciphertext after key destruction. Already downloaded exports, screenshots, police disclosures, and third-party copies remain outside application deletion control.
