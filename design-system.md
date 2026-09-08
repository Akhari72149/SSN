# Safer Spaces Application Design System

Status: initial brand direction derived from the rendered public website on 15 August 2026. Confirm brand ownership, logo source files, and font licences before production.

## Design objective

The application should visibly belong to Safer Spaces: use the same logo, colour family, typography, calm editorial character, and direct inclusive tone. It must remain an operational tool, so clarity, accessibility, speed, status recognition, and privacy take precedence over copying decorative website layouts literally.

## Observed brand tokens

| Token | Website value | Application use |
|---|---:|---|
| Coral | `#EE8274` | Primary brand accent, selected controls, highlights; verify contrast before text/background use |
| Warm off-white | `#EEEDEB` | Main canvas and low-emphasis surfaces |
| Charcoal | `#333333` | Default body text and high-contrast controls |
| Black | `#000000` | Primary headings and strongest emphasis |
| White | `#FFFFFF` | Cards, inverted text, clean operational surfaces |
| Display typeface | `orpheus-pro` | Page titles and selected section headings |
| Body typeface | `adobe-garamond-pro` | Brand-led prose and secondary content |

The observed website uses regular-weight Orpheus Pro headings with slight positive tracking and Adobe Garamond Pro body text. The public logo asset is displayed at an intrinsic 268 × 90 proportion.

## Application typography

- Use Orpheus Pro for brand/page headings where licensing and legibility permit.
- Use Adobe Garamond Pro for descriptive/editorial content where licensing permits.
- For dense tables, forms, timestamps, radio IDs, status labels, and small mobile controls, use an approved high-legibility system sans-serif stack unless testing proves the brand serif equally clear. Brand matching must not make operational information slower to read.
- Minimum normal text target: 16 px; do not reproduce the website’s large desktop heading sizes directly on phones.
- Use tabular numerals for times, quantities, radio numbers, case IDs, and dashboard counts.
- If the Adobe fonts are not licensed for application/web embedding, obtain the appropriate licence or approve metrically/visually compatible alternatives. Do not download or redistribute website font files without permission.
- Adobe licensing is currently unknown. Prototype with a safe fallback stack while matching scale, weight, spacing, and tone; do not extract the website’s font files.

## Logo

- Obtain the official master logo from Safer Spaces, preferably SVG plus approved light/dark raster variants. Do not rely on the Squarespace CDN URL in production.
- Preserve its aspect ratio, clear space, colours, and minimum size; never stretch, recolour, crop, add effects, or place it over low-contrast imagery.
- Use the full logo on login, navigation drawer, and desktop header; use an approved compact mark only if Safer Spaces supplies/approves one.
- Provide useful alt text (`Safer Spaces`) and treat the logo as decoration when adjacent visible text already names the service.

For the synthetic prototype, a provisional copy extracted from the public website is stored at `assets/brand/safer-spaces-logo-provisional.webp`. The app will not depend on the live Squarespace URL. Safer Spaces should confirm reuse permission and ideally replace it with the original SVG/master before production.

## Component direction

- Warm off-white application background, white content cards, black/charcoal text, coral accents.
- Calm, generous spacing with clear grouping; avoid the spreadsheet’s dense grid presentation.
- Roundedness and shadows should be restrained because the website is predominantly editorial and flat.
- Large touch targets (minimum 44 × 44 CSS px), visible keyboard focus, persistent labels, plain validation messages, and clear offline/sync status.
- Use shapes/icons plus text for statuses; never rely on colour alone.
- Restricted incidents do not appear at all to unauthorised users—no placeholder component or count.
- Operational danger/warning/success colours must be distinct from the coral brand accent and meet contrast requirements.

## Accessibility and privacy constraints

- Target WCAG 2.2 AA. Test every text/background pairing; coral on white or off-white may be unsuitable for small text and should not be assumed compliant.
- Support 200% zoom, reflow, keyboard navigation, screen readers, reduced motion, high contrast, and meaningful focus order.
- Dashboards remain aggregate-only. Avoid personal information in notification previews, page titles, browser history titles, and lock-screen content.
- Avoid sensitive imagery or case narratives as decorative content.

## Prototype screens

The first synthetic design prototype should cover:

1. Login and MFA enrolment/recovery.
2. Event selector and aggregate dashboard.
3. Staff list/lookup, including offline availability.
4. Staff detail with shift, attendance, deployment, and outstanding equipment.
5. Sign-on/off and break workflow.
6. Equipment issue/return/update.
7. Deployment board.
8. General incident list and form.
9. Restricted incident form for an authorised account, plus permission-denied/non-disclosure tests.
10. Offline queue, sync conflict, expired permission, and recovery states.
11. User/capability administration.
12. Dedicated full-purge confirmation page showing permission, hold, typed-reference, MFA, irreversible-action acknowledgement, cancel, timeout, and success/failure states.

## Verification

- Obtain director approval of logo, colours, type, tone, and representative mobile/desktop screens.
- Verify font and logo licensing.
- Run automated and manual contrast/accessibility checks.
- Compare implementation tokens against this file; do not scatter raw brand values through components.
- Test on representative phones, tablets, laptops, sunlight/low-light conditions, and slow/offline connections.
