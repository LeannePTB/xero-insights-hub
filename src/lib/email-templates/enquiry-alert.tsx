import * as React from 'react'
import { Body, Button, Container, Head, Heading, Html, Preview, Text } from '@react-email/components'
import { presentation as theme } from '@/lib/presentation-tokens'
import type { TemplateEntry } from './registry'

// Internal operational notice to the configured inbox. Enquiry text only —
// never client figures or Xero data.
interface Props {
  isTest?: boolean
  organisation?: string
  submitterName?: string
  submitterEmail?: string
  modules?: string[]
  clients?: string[]
  message?: string
  submittedAt?: string
  enquiriesUrl?: string
}

const row = (label: string, value: string) => (
  <Text style={text}><strong>{label}:</strong> {value}</Text>
)

const EnquiryAlertEmail = ({
  isTest = false, organisation = 'Unknown organisation', submitterName = '—', submitterEmail = '—',
  modules = [], clients = [], message = '', submittedAt = '—',
  enquiriesUrl = 'https://tractionadvisory.com.au/system/enquiries',
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{`${isTest ? 'TEST — ' : ''}Advisory enquiry from ${organisation}`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>{isTest ? 'TEST — ' : ''}New Advisory enquiry</Heading>
        {isTest && <Text style={text}>This is a test of the enquiry alert. No enquiry was submitted.</Text>}
        {row('Name', submitterName)}
        {row('Email', submitterEmail)}
        {row('Organisation', organisation)}
        {row('Modules of interest', modules.length ? modules.join(', ') : 'Not specified')}
        {row('Clients of interest', clients.length ? clients.join(', ') : 'Not specified')}
        {row('Submitted', `${submittedAt} (Perth time)`)}
        <Text style={label}>Message</Text>
        <Text style={quote}>{message || '—'}</Text>
        <Button style={button} href={enquiriesUrl}>Open System Admin → Enquiries</Button>
        <Text style={small}>Reply to this email to respond to the submitter directly.</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: EnquiryAlertEmail,
  subject: (d: Record<string, any>) => `${d.isTest ? 'TEST — ' : ''}Advisory enquiry — ${d.organisation ?? 'Unknown organisation'}`,
  displayName: 'Advisory enquiry alert',
  previewData: {
    organisation: 'Demo Practice', submitterName: 'Jane Citizen', submitterEmail: 'jane@example.com',
    modules: ['Cash flow'], clients: ['Demo Company (AU)'], message: 'We would like to know more.',
    submittedAt: '14 Oct 2026, 3:00 pm',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '24px 28px', maxWidth: '560px' }
const h1 = { fontSize: '18px', fontWeight: 600, color: theme.text, margin: '0 0 16px' }
const text = { fontSize: '14px', color: theme.text, margin: '0 0 6px', lineHeight: '20px' }
const label = { ...text, fontWeight: 600, margin: '14px 0 4px' }
const quote = { ...text, whiteSpace: 'pre-wrap' as const, borderLeft: `3px solid ${theme.border}`, paddingLeft: '10px' }
const button = { backgroundColor: theme.primary, color: '#ffffff', fontSize: '14px', borderRadius: '6px', padding: '10px 16px', textDecoration: 'none', marginTop: '16px' }
const small = { fontSize: '12px', color: theme.muted, marginTop: '16px' }
