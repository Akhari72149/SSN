# Architecture Options

## Decision drivers

Security and low operational burden dominate. Other drivers are reliable mobile use, accessible task flows, auditability, UK-region hosting, controlled offline behaviour, straightforward backup/restore, export control, and the ability for a small team to support the service.

## Option comparison

| Option | Shape | Strengths | Risks/trade-offs | Fit |
|---|---|---|---|---|
| A. Managed TypeScript application | Next.js/React PWA, managed PostgreSQL, managed identity, managed hosting/observability | One language, strong ecosystem, responsive UI, relational integrity, portable data, easy event/audit model | Must implement authorisation carefully; offline sync is custom; avoid insecure framework defaults | **Recommended** |
| B. Microsoft low-code | Power Apps, Dataverse, Entra ID | Rapid delivery; strong fit if Microsoft 365 identities/governance already mature; reduced infrastructure work | Licensing and vendor coupling; complex fine-grained/offline behaviour; custom UX and audit semantics may become awkward | Viable if organisation is already governed around M365 |
| C. Google low-code/ecosystem | AppSheet or Apps Script around Sheets/managed data | Familiar source environment; fast prototype | Easy to preserve spreadsheet anti-patterns; access/offline/export controls and relational/event integrity need careful proof | Prototype-only contender, not default for sensitive production operations |
| D. Bespoke native mobile + API | Flutter/React Native plus web/admin and backend | Rich offline/device capability | Two clients or compromised admin UX; more code, testing, release, device, and security overhead | Only if robust offline is a proven hard requirement |
| E. Full custom cloud services | Separate SPA, API/services, PostgreSQL, queues, object store, IAM | Maximum control and scale | Highest operational/security complexity for a small team; premature service boundaries | Not justified initially |
| F. Self-hosted modular web app | Containerised Next.js/API and PostgreSQL on organisation-controlled supported server | Uses existing infrastructure and operator skills; direct control | Organisation owns patching, hardening, TLS, backups, monitoring, physical/network resilience and incident response | Viable only after host/security readiness assessment |

## Recommended shortlist validation

Run a short proof of capability between A and B if the organisation already has Microsoft 365 licensing and operational administration. Score with real workflows but synthetic data:

- 30% security/authorisation/audit and admin recovery;
- 20% mobile usability/accessibility;
- 15% support and operational burden;
- 15% offline/failure behaviour;
- 10% lifecycle/export controls;
- 10% five-year total cost and exitability.

## Hosting and vendor evaluation gates

- UK region where available and documented data-location/transfer position.
- Data processing agreement, sub-processor transparency, security certifications as evidence (not a substitute for assessment), breach notification terms, deletion/exit capability.
- Managed encryption, point-in-time recovery, isolated backups, audit/identity integration, WAF/rate limiting, and service health visibility.
- Separate production/non-production projects, credentials, databases, and telemetry.
- No production data in preview deployments; no live spreadsheet copied into developer tools.
- Exportable relational data and tested restore to reduce lock-in.

## Offline design alternatives

| Mode | Benefit | Risk | Recommendation |
|---|---|---|---|
| Online-first with read-only fallback instructions | Lowest device exposure and sync complexity | Does not satisfy the confirmed requirement | Rejected as the sole mode |
| Limited offline mutation queue | Supports attendance, break, custody, and deployment during dropouts | Device theft, replay, conflicts, stale permissions | **Recommended starting point; prototype and threat-test** |
| Full offline replica | Rich disconnected operation | Large sensitive cache and complex conflict/security model | Reject unless operational necessity clearly outweighs risk |

PWA installation and cached application shell do not require caching sensitive records. The user interface should disclose connectivity and sync state plainly and never imply an action is saved when it is only queued.
