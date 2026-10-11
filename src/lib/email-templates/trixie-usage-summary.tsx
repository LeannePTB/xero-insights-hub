import { EmailLogo } from "./EmailLogo";
import { presentation as theme } from "@/lib/presentation-tokens";
import * as React from 'react'
import { Body, Button, Container, Head, Heading, Html, Preview, Section, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'

type Row = { label: string; questions: number; spend: number }
interface SummaryProps {
  logoSrc?: string | null
  siteName?: string
  monthLabel?: string
  organisations?: Row[]
  models?: Row[]
  totalSpend?: number
  totalQuestions?: number
  adminUrl?: string
}

const usd = (n: number) => `US$${(Number(n) || 0).toFixed(2)}`

const Table = ({ title, rows }: { title: string; rows: Row[] }) => (
  <Section style={{ margin: '16px 0' }}>
    <Text style={h2}>{title}</Text>
    <table width="100%" cellPadding={4} style={{ borderCollapse: 'collapse', fontSize: '12px', color: theme.text }}>
      <thead><tr><th align="left">Name</th><th align="right">Questions</th><th align="right">Spend</th></tr></thead>
      <tbody>
        {rows.length === 0 ? <tr><td colSpan={3}>No usage.</td></tr> : rows.map((r) => (
          <tr key={r.label}><td>{r.label}</td><td align="right">{r.questions}</td><td align="right">{usd(r.spend)}</td></tr>
        ))}
      </tbody>
    </table>
  </Section>
)

const TrixieSummaryEmail = ({
  logoSrc, siteName = 'Traction Advisory', monthLabel = 'last month', organisations = [], models = [],
  totalSpend = 0, totalQuestions = 0, adminUrl = 'https://www.tractionadvisory.com.au/system/trixie',
}: SummaryProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Trixie usage for {monthLabel}</Preview>
    <Body style={main}>
      <Container style={container}>
        <EmailLogo logoSrc={logoSrc} siteName={siteName} />
        <Heading style={h1}>Trixie usage — {monthLabel}</Heading>
        <Text style={text}>{totalQuestions} questions answered, {usd(totalSpend)} estimated spend.</Text>
        <Table title="By organisation" rows={organisations} />
        <Table title="By model" rows={models} />
        <Button style={button} href={adminUrl}>Open System Admin → Trixie</Button>
        <Text style={footer}>Usage counts only — no questions, answers or client figures are included.</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: TrixieSummaryEmail,
  subject: (d: Record<string, any>) => `Trixie usage summary — ${d.monthLabel ?? 'last month'}`,
  displayName: 'Trixie monthly usage summary',
  previewData: { monthLabel: 'September 2026', totalQuestions: 42, totalSpend: 3.1, organisations: [{ label: 'Example Organisation', questions: 42, spend: 3.1 }], models: [{ label: 'openai/gpt-6-astra', questions: 42, spend: 3.1 }] },
} satisfies TemplateEntry

const main = { backgroundColor: theme.surface, fontFamily: 'Arial, Helvetica, sans-serif' }
const container = { padding: '32px 28px', maxWidth: '560px' }
const h1 = { fontSize: '18px', color: theme.text, margin: '0 0 16px' }
const h2 = { fontSize: '13px', fontWeight: 'bold' as const, color: theme.text, margin: '0 0 4px' }
const text = { fontSize: '12px', lineHeight: '18px', color: theme.text }
const button = { backgroundColor: theme.primary, color: theme.surface, borderRadius: '10px', padding: '12px 20px', fontSize: '12px', textDecoration: 'none' }
const footer = { fontSize: '11px', color: theme.muted, margin: '24px 0 0' }
