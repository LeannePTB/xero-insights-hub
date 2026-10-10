import { presentation as theme } from "@/lib/presentation-tokens";
import * as React from 'react'
import {
  Body, Button, Container, Head, Heading, Html, Link, Preview, Text,
} from '@react-email/components'
import type { TemplateEntry } from './registry'

interface ReportReadyProps {
  reportUrl?: string
  reportTitle?: string
  clientName?: string | null
  recipientEmail?: string | null
  expiresInDays?: number
  siteName?: string
}

const ReportReadyEmail = ({
  reportUrl = 'https://tractionadvisory.com.au',
  reportTitle = 'Monthly management report',
  clientName = null,
  recipientEmail = null,
  expiresInDays = 30,
  siteName = 'Traction Advisory',
}: ReportReadyProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{reportTitle} is ready to view</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Your report is ready</Heading>
        <Text style={text}>
          {reportTitle}
          {clientName ? ` for ${clientName}` : ''} is ready to view.
        </Text>
        <Button style={button} href={reportUrl}>View the report</Button>
        <Text style={small}>
          Or copy this link: <Link href={reportUrl} style={link}>{reportUrl}</Link>
        </Text>
        <Text style={text}>
          This link is personal to you. You will be asked to confirm
          {recipientEmail ? ` ${recipientEmail}` : ' the email address it was sent to'} before the
          report opens, so forwarding it will not give anyone else access. It expires in{' '}
          {expiresInDays} days and can be withdrawn at any time.
        </Text>
        <Text style={footer}>
          Sent by {siteName}. If you weren&rsquo;t expecting this, you can safely ignore this email.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: ReportReadyEmail,
  subject: (d: Record<string, any>) => d.reportTitle ?? 'Your management report is ready',
  displayName: 'Management report ready',
  previewData: {
    reportUrl: 'https://tractionadvisory.com.au/report/example-token',
    reportTitle: 'Monthly Management Report — Example Pty Ltd — July 2026',
    clientName: 'Example Pty Ltd',
    recipientEmail: 'owner@example.com',
    expiresInDays: 30,
  },
} satisfies TemplateEntry

const main = { backgroundColor: theme.surface, fontFamily: 'Arial, Helvetica, sans-serif' }
const container = { padding: '32px 28px', maxWidth: '560px' }
const h1 = { fontSize: '18px', color: theme.text, margin: '0 0 16px' }
const text = { fontSize: '12px', lineHeight: '18px', color: theme.text }
const small = { fontSize: '13px', lineHeight: '20px', color: theme.muted, wordBreak: 'break-all' as const }
const link = { color: theme.primary }
const button = {
  backgroundColor: theme.primary,
  color: theme.surface,
  borderRadius: '10px',
  padding: '12px 20px',
  fontSize: '12px',
  textDecoration: 'none',
  display: 'inline-block',
  margin: '8px 0 16px',
}
const footer = { fontSize: '12px', color: theme.muted, marginTop: '24px' }
