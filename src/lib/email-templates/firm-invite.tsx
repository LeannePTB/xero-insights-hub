import { EmailLogo } from "./EmailLogo";
import { presentation as theme } from "@/lib/presentation-tokens";
import * as React from 'react'
import {
  Body, Button, Container, Head, Heading, Html, Link, Preview, Text,
} from '@react-email/components'
import type { TemplateEntry } from './registry'

interface InviteEmailProps {
  logoSrc?: string | null
  inviteUrl?: string
  role?: 'owner' | 'staff'
  firmName?: string | null
  inviterName?: string | null
  siteName?: string
}

const InviteEmail = ({
  logoSrc,
  inviteUrl = 'https://tractionadvisory.com.au',
  role = 'owner',
  firmName = null,
  inviterName = null,
  siteName = 'Traction Advisory',
}: InviteEmailProps) => {
  const isOwner = role === 'owner'
  const headline = isOwner
    ? `You've been invited to ${siteName}`
    : `You've been invited to join ${firmName ?? 'an organisation'}`
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>{headline}</Preview>
      <Body style={main}>
        <Container style={container}>
        <EmailLogo logoSrc={logoSrc} siteName={siteName} />
          <Heading style={h1}>{headline}</Heading>
          <Text style={text}>
            {inviterName ? `${inviterName} has invited` : "You've been invited"} you to set up{' '}
            {isOwner ? 'your organisation account' : `access as ${role}`} on {siteName} — clean Xero dashboards built around the metrics that matter.
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
      ? `You've been invited to ${d.firmName ?? 'an organisation'} on ${d.siteName ?? 'Traction Advisory'}`
      : `You've been invited to ${d.siteName ?? 'Traction Advisory'}`,
  displayName: 'Account invite',
  previewData: {
    inviteUrl: 'https://tractionadvisory.com.au/signup/example-token',
    role: 'owner',
    firmName: 'Smith Advisory',
    inviterName: 'Admin',
  },
} satisfies TemplateEntry

const main = { backgroundColor: theme.surface, fontFamily: 'Arial, sans-serif' }
const container = { padding: '32px 28px', maxWidth: '560px' }
const h1 = { color: theme.text, fontSize: '18px', fontWeight: '600', margin: '0 0 16px' }
const text = { color: theme.text, fontSize: '12px', lineHeight: '18px', margin: '0 0 12px' }
const small = { color: theme.muted, fontSize: '12px', lineHeight: '18px', margin: '16px 0 0' }
const footer = { color: theme.muted, fontSize: '12px', marginTop: '32px' }
const link = { color: theme.link, textDecoration: 'underline' }
const button = {
  backgroundColor: theme.text, color: theme.surface, borderRadius: '6px',
  padding: '10px 18px', fontSize: '12px', fontWeight: '600',
  textDecoration: 'none', display: 'inline-block', margin: '12px 0',
}
