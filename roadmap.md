# Roadmap

## Domain migration to tractionadvisory.app
- [ ] Shared site-origin constant module (SITE_URL / VITE_SITE_URL, fallback https://tractionadvisory.app)
- [ ] Wire Xero callback URL from it in 3 call sites
- [ ] Update ALLOWED_RETURN_HOSTS / ALLOWED_CUSTOM_HOSTS
- [ ] Replace hardcoded links (invites, advisors, admin, auth, settings clipboard, email templates, clients redirect)
- [ ] siteOrigin() in report-delivery.server.ts uses shared module
- [ ] Cron job URL + secret + schedule (propose first)
- [ ] Update security_contact_details / xero_assessment_contact website rows
