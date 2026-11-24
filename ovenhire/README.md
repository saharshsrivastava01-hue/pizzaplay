# OvenHire — pre-launch product build

A responsive, installable-web-app (PWA) front-end prototype for a hospitality hiring marketplace.

## Current preview
- Responsive landing page, job search and department/location filters.
- Browser-local demo job creation, candidate profile preview and demo application flow.
- LocalStorage only; sample/demo data is labelled and never presented as a verified vacancy.
- Web app manifest, icon and service worker for installability/offline shell caching.

## Not production yet
This build has no server API, real authentication, database connection, CV upload, employer verification, admin moderation, notifications, actual applications, payment gateway, refunds or audit logs. LocalStorage data exists only in the current browser/device and can be cleared. Do not collect money or sensitive candidate documents using this preview.

## Proposed commercial model
- ₹100 proposed single listing.
- ₹200 proposed two-listing pack.
- 30-day listing duration after moderation approval.
- Candidate browsing/applications planned to be free.
Prices are proposals only until merchant onboarding, taxes, terms and a verified checkout flow are complete.

## Backend foundation
`supabase/schema.sql` is an initial PostgreSQL schema proposal. It enables RLS but deliberately includes no permissive policies. Do not deploy it as a working backend until role-aware policies, server-side authorization, moderation and payment webhook logic have been implemented and tested. Never put service-role secrets in frontend code.

## Deploy on Render
Static site: repository `saharshsrivastava01-hue/pizzaplay`, branch `main`, publish directory `ovenhire`, build command `echo "OvenHire static build"`.

## Discovery and sharing
- Search-engine title/description, canonical URL and Open Graph metadata.
- Native device share action with clipboard fallback for the site and sample roles.
- These are distribution helpers only; they do not guarantee reach, ranking or virality.

## Privacy and terms pages
The preview includes plain-language demo disclosures. It does not collect accounts, payments or CVs. Review and replace the legal text with jurisdiction-specific advice before production launch.

## Chef Network prototype
- Skill passport fields for cuisine, station, oven/equipment, food safety, languages and location.
- Searchable fictional sample chef directory and employer contact-request drafts.
- Contact requests are local-only; no private contact details are published and no message is sent.
- Production contact requires authenticated users, participant-only database policies, consent controls, blocking/reporting, moderation, rate limits and secure notifications.

## Google Play path
This PWA is not an Android App Bundle (AAB). For Play Store, package the production web app with a maintained Android wrapper such as Capacitor, generate a signed AAB, test on physical devices, provide privacy policy/data-safety disclosures and complete Play Console testing/review. Do not submit this preview as a production recruitment service.
