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

interface RecoveryEmailProps {
  logoSrc?: string | null
  siteName: string
  confirmationUrl: string
}

export const RecoveryEmail = ({
  logoSrc,
  siteName,
  confirmationUrl,
}: RecoveryEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Reset your password for {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <EmailLogo logoSrc={logoSrc} siteName={siteName} />
        <Heading style={h1}>Reset your password</Heading>
        <Text style={text}>
          We received a request to reset your password for {siteName}. Click
          the button below to choose a new password.
        </Text>
        <Button style={button} href={confirmationUrl}>
          Reset Password
        </Button>
        <Text style={footer}>
          If you didn't request a password reset, you can safely ignore this
          email. Your password will not be changed.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default RecoveryEmail

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
