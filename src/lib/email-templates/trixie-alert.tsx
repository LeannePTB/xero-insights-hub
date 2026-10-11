import { EmailLogo } from "./EmailLogo";
import { presentation as theme } from "@/lib/presentation-tokens";
import * as React from 'react'
import { Body, Button, Container, Head, Heading, Html, Preview, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'

// Usage metadata only: never a prompt, an answer or a client financial figure.
interface TrixieAlertProps {
  logoSrc?: string | null
  siteName?: string
  alertTitle?: string
  alertDetail?: string
  organisationName?: string | null
  adminUrl?: string
}

const TrixieAlertEmail = ({
  logoSrc, siteName = 'Traction Advisory', alertTitle = 'Trixie usage alert',
  alertDetail = '', organisationName = null, adminUrl = 'https://www.tractionadvisory.com.au/system/trixie',
}: TrixieAlertProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{alertTitle}</Preview>
    <Body style={main}>
      <Container style={container}>
        <EmailLogo logoSrc={logoSrc} siteName={siteName} />
        <Heading style={h1}>{alertTitle}</Heading>
        {organisationName ? <Text style={text}>Organisation: {organisationName}</Text> : null}
        <Text style={text}>{alertDetail}</Text>
        <Button style={button} href={adminUrl}>Open System Admin → Trixie</Button>
        <Text style={footer}>You receive this because you are a {siteName} platform administrator.</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: TrixieAlertEmail,
  subject: (d: Record<string, any>) => `Trixie alert: ${d.alertTitle ?? 'usage'}`,
  displayName: 'Trixie usage alert',
  previewData: { alertTitle: 'Trixie spend passed US$25.00', alertDetail: 'Month-to-date Trixie spend is US$25.40 for 2026-10.' },
} satisfies TemplateEntry

const main = { backgroundColor: theme.surface, fontFamily: 'Arial, Helvetica, sans-serif' }
const container = { padding: '32px 28px', maxWidth: '560px' }
const h1 = { fontSize: '18px', color: theme.text, margin: '0 0 16px' }
const text = { fontSize: '12px', lineHeight: '18px', color: theme.text }
const button = { backgroundColor: theme.primary, color: theme.surface, borderRadius: '10px', padding: '12px 20px', fontSize: '12px', textDecoration: 'none' }
const footer = { fontSize: '11px', color: theme.muted, margin: '24px 0 0' }
