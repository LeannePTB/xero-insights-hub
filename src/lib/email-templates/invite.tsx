import { EmailLogo } from "./EmailLogo";
import { presentation as theme } from "@/lib/presentation-tokens";
import * as React from 'react'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Text,
} from '@react-email/components'

interface InviteEmailProps {
  logoSrc?: string | null
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
}

export const InviteEmail = ({
  logoSrc,
  siteName,
  siteUrl,
  recipient,
  confirmationUrl,
}: InviteEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>You've been invited to {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <EmailLogo logoSrc={logoSrc} siteName={siteName} />
        <Heading style={h1}>You're invited</Heading>
        <Text style={text}>
          You've been invited to join{' '}
          <Link href={siteUrl} style={link}>
            <strong>{siteName}</strong>
          </Link>
          .
        </Text>
        <Text style={text}>
          Accept the invite for{' '}
          <Link href={`mailto:${recipient}`} style={link}>
            {recipient}
          </Link>{' '}
          by clicking the button below:
        </Text>
        <Button style={button} href={confirmationUrl}>
          Accept invite
        </Button>
        <Text style={footer}>
          If you weren't expecting this invite, you can safely ignore this email.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default InviteEmail

const main = { backgroundColor: theme.surface, fontFamily: 'Arial, sans-serif' }
const container = { padding: '20px 25px' }
const h1 = { fontSize: '18px', fontWeight: '600' as const, color: theme.primary, margin: '0 0 20px' }
const text = { fontSize: '12px', color: theme.text, lineHeight: '1.5', margin: '0 0 25px' }
const link = { color: 'inherit', textDecoration: 'underline' }
const button = {
  backgroundColor: theme.primary,
  color: theme.surface,
  fontSize: '12px',
  borderRadius: '8px',
  padding: '12px 20px',
  textDecoration: 'none',
}
const footer = { fontSize: '12px', color: theme.muted, margin: '30px 0 0' }
