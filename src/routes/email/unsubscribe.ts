import { createClient } from '@supabase/supabase-js'
import { createFileRoute } from '@tanstack/react-router'
import { createHash } from 'crypto'
import { enforceRateLimit } from '@/lib/rate-limit.server'

function redactEmail(email: string | null | undefined): string {
  if (!email) return '***'
  const [localPart, domain] = email.split('@')
  if (!localPart || !domain) return '***'
  return `${localPart[0]}***@${domain}`
}

// The emailed link carries the plaintext token; only its SHA-256 hash is stored.
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

function callerIp(request: Request): string {
  return (
    request.headers.get('cf-connecting-ip') ??
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    'unknown'
  )
}

export const Route = createFileRoute("/email/unsubscribe")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

        if (!supabaseUrl || !supabaseServiceKey) {
          return Response.json({ error: 'Server configuration error' }, { status: 500 })
        }

        // Extract token from query params
        const url = new URL(request.url)
        const token = url.searchParams.get('token')

        if (!token) {
          return Response.json({ error: 'Token is required' }, { status: 400 })
        }

        try {
          await enforceRateLimit(`unsubscribe_get:${callerIp(request)}`, 30, 300)
        } catch {
          return Response.json({ error: 'Too many requests' }, { status: 429 })
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey)

        // Look up the token by its hash — the plaintext is never stored.
        const { data: tokenRecord, error: lookupError } = await supabase
          .from('email_unsubscribe_tokens')
          .select('used_at')
          .eq('token_hash', hashToken(token))
          .maybeSingle()

        if (lookupError || !tokenRecord) {
          return Response.json({ error: 'Invalid or expired token' }, { status: 404 })
        }

        if (tokenRecord.used_at) {
          return Response.json({ valid: false, reason: 'already_unsubscribed' })
        }

        return Response.json({ valid: true })
      },

      POST: async ({ request }) => {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

        if (!supabaseUrl || !supabaseServiceKey) {
          return Response.json({ error: 'Server configuration error' }, { status: 500 })
        }

        // Extract token from query params (always present for RFC 8058 one-click)
        const url = new URL(request.url)
        let token: string | null = url.searchParams.get('token')

        // Detect RFC 8058 one-click unsubscribe: POST with form-encoded body
        // containing "List-Unsubscribe=One-Click". Email clients (Gmail, Apple Mail,
        // etc.) send this when the user clicks "Unsubscribe" in the mail UI.
        const contentType = request.headers.get('content-type') ?? ''
        if (contentType.includes('application/x-www-form-urlencoded')) {
          const formText = await request.text()
          const params = new URLSearchParams(formText)
          // For one-click, token comes from query param (already set above).
          // Otherwise, token may be in the form body.
          if (!params.get('List-Unsubscribe')) {
            const formToken = params.get('token')
            if (formToken) {
              token = formToken
            }
          }
        } else {
          // JSON body (from the app's unsubscribe page)
          try {
            const body = await request.json()
            if (body.token) {
              token = body.token
            }
          } catch {
            // Fall through — token stays from query param
          }
        }

        if (!token) {
          return Response.json({ error: 'Token is required' }, { status: 400 })
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey)

        // Look up the token
        const { data: tokenRecord, error: lookupError } = await supabase
          .from('email_unsubscribe_tokens')
          .select('*')
          .eq('token', token)
          .maybeSingle()

        if (lookupError || !tokenRecord) {
          return Response.json({ error: 'Invalid or expired token' }, { status: 404 })
        }

        if (tokenRecord.used_at) {
          return Response.json({ success: false, reason: 'already_unsubscribed' })
        }

        // Atomic check-and-update to avoid TOCTOU race
        const { data: updated, error: updateError } = await supabase
          .from('email_unsubscribe_tokens')
          .update({ used_at: new Date().toISOString() })
          .eq('token', token)
          .is('used_at', null)
          .select()
          .maybeSingle()

        if (updateError) {
          console.error('Failed to mark token as used', { error: updateError, token })
          return Response.json({ error: 'Failed to process unsubscribe' }, { status: 500 })
        }

        if (!updated) {
          return Response.json({ success: false, reason: 'already_unsubscribed' })
        }

        // Add email to suppressed list (upsert to handle duplicates)
        const { error: suppressError } = await supabase
          .from('suppressed_emails')
          .upsert(
            { email: tokenRecord.email.toLowerCase(), reason: 'unsubscribe' },
            { onConflict: 'email' },
          )

        if (suppressError) {
          console.error('Failed to suppress email', {
            error: suppressError,
            email_redacted: redactEmail(tokenRecord.email),
          })
          return Response.json({ error: 'Failed to process unsubscribe' }, { status: 500 })
        }

        console.log('Email unsubscribed', {
          email_redacted: redactEmail(tokenRecord.email),
        })

        return Response.json({ success: true })
      },
    },
  },
})
