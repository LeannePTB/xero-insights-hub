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
  Preview,
  Text,
} from '@react-email/components'

interface MagicLinkEmailProps {
  logoSrc?: string | null
  siteName: string
  confirmationUrl: string
}

export const MagicLinkEmail = ({
  logoSrc,
  siteName,
  confirmationUrl,
}: MagicLinkEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your login link for {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <EmailLogo logoSrc={logoSrc} siteName={siteName} />
        <Heading style={h1}>Your login link</Heading>
        <Text style={text}>
          Click the button below to log in to {siteName}. This link will expire
          shortly.
        </Text>
        <Button style={button} href={confirmationUrl}>
          Log In
        </Button>
        <Text style={footer}>
          If you didn't request this link, you can safely ignore this email.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default MagicLinkEmail

const main = { backgroundColor: theme.surface, fontFamily: 'Arial, sans-serif' }
const container = { padding: '20px 25px' }
const h1 = {
  fontSize: '18px',
  fontWeight: '600' as const,
  color: theme.primary,
  margin: '0 0 20px',
}
const text = {
  fontSize: '12px',
  color: theme.text,
  lineHeight: '1.5',
  margin: '0 0 25px',
}
const button = {
  backgroundColor: theme.primary,
  color: theme.surface,
  fontSize: '12px',
  borderRadius: '8px',
  padding: '12px 20px',
  textDecoration: 'none',
}
const footer = { fontSize: '12px', color: theme.muted, margin: '30px 0 0' }
