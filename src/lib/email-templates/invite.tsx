import * as React from 'react'
import {
  Body, Button, Container, Head, Heading, Html, Link, Preview, Text,
} from '@react-email/components'
import type { TemplateEntry } from './registry'

interface InviteEmailProps {
  inviteUrl?: string
  role?: 'owner' | 'staff'
  firmName?: string | null
  inviterName?: string | null
}

const InviteEmail = ({
  inviteUrl = 'https://tractionadvisory.app',
  role = 'owner',
  firmName = null,
  inviterName = null,
}: InviteEmailProps) => {
  const isOwner = role === 'owner'
  const headline = isOwner
    ? "You've been invited to Traction Advisory"
    : `You've been invited to join ${firmName ?? 'a business'}`
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>{headline}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>{headline}</Heading>
          <Text style={text}>
            {inviterName ? `${inviterName} has invited` : "You've been invited"} you to set up{' '}
            {isOwner ? 'your business account' : `access as ${role}`} on Traction Advisory — clean Xero dashboards built around the metrics that matter.
          </Text>
          <Text style={text}>
            Click below to accept and create your account. This link is single-use and expires in 14 days.
          </Text>
          <Button style={button} href={inviteUrl}>Accept invite</Button>
          <Text style={small}>
            Or copy this link: <Link href={inviteUrl} style={link}>{inviteUrl}</Link>
          </Text>
          <Text style={footer}>
            If you weren't expecting this, you can safely ignore this email.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: InviteEmail,
  subject: (d: Record<string, any>) =>
    d.role === 'staff'
      ? `You've been invited to ${d.firmName ?? 'a business'} on Traction Advisory`
      : "You've been invited to Traction Advisory",
  displayName: 'Account invite',
  previewData: {
    inviteUrl: 'https://tractionadvisory.app/signup/example-token',
    role: 'owner',
    firmName: 'Smith Advisory',
    inviterName: 'Admin',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '32px 28px', maxWidth: '560px' }
const h1 = { color: '#0f172a', fontSize: '22px', fontWeight: '600', margin: '0 0 16px' }
const text = { color: '#334155', fontSize: '14px', lineHeight: '22px', margin: '0 0 12px' }
const small = { color: '#64748b', fontSize: '12px', lineHeight: '18px', margin: '16px 0 0' }
const footer = { color: '#94a3b8', fontSize: '12px', marginTop: '32px' }
const link = { color: '#1d4ed8', textDecoration: 'underline' }
const button = {
  backgroundColor: '#0f172a', color: '#ffffff', borderRadius: '6px',
  padding: '10px 18px', fontSize: '14px', fontWeight: '600',
  textDecoration: 'none', display: 'inline-block', margin: '12px 0',
}
