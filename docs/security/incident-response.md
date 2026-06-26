# Incident response

## Definition

A security incident is any of:

- Unauthorised access to a Xero connection.
- Suspected leak of `TOKEN_ENC_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `XERO_CLIENT_SECRET`, or any other server secret.
- Unauthorised access to client accounting records.
- Loss of MFA factors leading to account takeover.

## Response

| Step | Owner | Timeline |
| --- | --- | --- |
| Contain (disable affected user, revoke Xero connection, rotate suspected secret) | Practice principal | Within 4 business hours of detection |
| Assess scope (review `audit_log`, identify affected firms and tenants) | Practice principal | Within 1 business day |
| Notify affected customers and Xero (if Xero data involved) | Practice principal | Within 72 hours, per Xero requirement |
| Remediate (patch root cause, rotate keys, add detection) | Practice principal | Within 7 business days |
| Post-incident review | Practice principal | Within 14 business days |

## Reporting

Suspected vulnerabilities or incidents can be reported to the practice principal. We acknowledge within 2 business days.
