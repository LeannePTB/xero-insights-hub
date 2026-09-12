ALTER POLICY "Service role can insert send log" ON public.email_send_log TO service_role;
ALTER POLICY "Service role can read send log" ON public.email_send_log TO service_role;
ALTER POLICY "Service role can update send log" ON public.email_send_log TO service_role;
ALTER POLICY "Service role can manage send state" ON public.email_send_state TO service_role;
ALTER POLICY "Service role can insert tokens" ON public.email_unsubscribe_tokens TO service_role;
ALTER POLICY "Service role can mark tokens as used" ON public.email_unsubscribe_tokens TO service_role;
ALTER POLICY "Service role can read tokens" ON public.email_unsubscribe_tokens TO service_role;
ALTER POLICY "Service role can insert suppressed emails" ON public.suppressed_emails TO service_role;
ALTER POLICY "Service role can read suppressed emails" ON public.suppressed_emails TO service_role;