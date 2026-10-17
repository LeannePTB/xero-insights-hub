import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { getAlertAddressSuppression, getEnquiryAlertEmail, saveEnquiryAlertEmail, sendEnquiryAlertTest, unblockAlertAddress } from '@/lib/upgrade-enquiries.functions';
import { DEFAULT_MAIN_CONTACT, saveMainContactEmail } from '@/lib/platform-contact.functions';
import { MAIN_CONTACT_KEY, useMainContact } from '@/hooks/useMainContact';

const shortDate = (iso: string) => new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', timeZone: 'Australia/Perth' });

/** System Administrator setting; the server enforces AAL2 and the role. */
export function EnquiryAlertSettings() {
  const read = useServerFn(getEnquiryAlertEmail), save = useServerFn(saveEnquiryAlertEmail), test = useServerFn(sendEnquiryAlertTest);
  const q = useQuery({ queryKey: ['enquiry-alert-email'], queryFn: () => read(), retry: false });
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState<'save' | 'test' | 'unblock' | null>(null);
  const readSupp = useServerFn(getAlertAddressSuppression), unblock = useServerFn(unblockAlertAddress);
  const supp = useQuery({ queryKey: ['alert-address-suppression'], queryFn: () => readSupp(), retry: false });
  const blocked = supp.data?.suppressed === true;
  useEffect(() => { if (q.data) setEmail(q.data.email ?? ''); }, [q.data]);
  if (q.error) return null;
  return (
    <Card>
      <CardContent className="space-y-3 p-6">
        <div className="space-y-2">
          <Label htmlFor="enquiry-alert">Advisory enquiry alert address</Label>
          <p className="text-xs text-muted-foreground">Each new Advisory enquiry is emailed here. Replies go to the person who sent it.</p>
          <div className="flex flex-wrap items-center gap-2">
            <Input id="enquiry-alert" type="email" className="max-w-sm" maxLength={254} value={email} onChange={e => setEmail(e.target.value)} />
            <Button disabled={busy !== null} onClick={async () => {
              setBusy('save');
              try { await save({ data: { email: email.trim() || null } }); toast.success('Alert address saved'); await q.refetch(); }
              catch (e) { toast.error(e instanceof Error && e.message === 'Forbidden' ? 'Only System Administrators can change this.' : 'Check the email address.'); }
              finally { setBusy(null); }
            }}>{busy === 'save' ? 'Saving…' : 'Save'}</Button>
            <Button variant="outline" disabled={busy !== null || !q.data?.email} onClick={async () => {
              setBusy('test');
              try { await test(); toast.success('Test email queued — check the Enquiries inbox shortly.'); }
              catch (e) { toast.error(e instanceof Error ? e.message : 'The test email could not be sent.'); }
              finally { setBusy(null); }
            }}>{busy === 'test' ? 'Sending…' : 'Send test email'}</Button>
          </div>
          {blocked && (
            <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-destructive bg-card p-3 text-sm">
              <p className="text-destructive">
                Emails to this address {supp.data?.reason === 'bounce' ? 'bounced' : 'were blocked'}{supp.data?.suppressedAt ? ` on ${shortDate(supp.data.suppressedAt)}` : ''} and are blocked — fix the mailbox, then click Unblock and Send test.
              </p>
              <Button size="sm" variant="outline" disabled={busy !== null} onClick={async () => {
                setBusy('unblock');
                try { await unblock(); toast.success('Address unblocked. Send a test to check delivery.'); await supp.refetch(); }
                catch (e) { toast.error(e instanceof Error && e.message === 'Forbidden' ? 'Only System Administrators can do this.' : 'The address could not be unblocked.'); }
                finally { setBusy(null); }
              }}>{busy === 'unblock' ? 'Unblocking…' : 'Unblock'}</Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/** Main contact address used on the website, help text, auth pages, platform email footers and Reply-To. */
export function MainContactSettings() {
  const current = useMainContact();
  const qc = useQueryClient();
  const save = useServerFn(saveMainContactEmail);
  const [email, setEmail] = useState(current);
  const [busy, setBusy] = useState(false);
  useEffect(() => setEmail(current), [current]);
  return (
    <Card>
      <CardContent className="space-y-2 p-6">
        <Label htmlFor="main-contact">Main contact email</Label>
        <p className="text-xs text-muted-foreground">Shown wherever the platform gives a Traction Advisory contact address, and used as the Reply-To on platform emails. Practice-sent client reports keep the practice's own reply address. Security and legal contacts are separate.</p>
        <div className="flex flex-wrap items-center gap-2">
          <Input id="main-contact" type="email" className="max-w-sm" maxLength={254} placeholder={DEFAULT_MAIN_CONTACT} value={email} onChange={e => setEmail(e.target.value)} />
          <Button disabled={busy || !email.trim()} onClick={async () => {
            setBusy(true);
            try { await save({ data: { email: email.trim() } }); toast.success('Main contact email saved'); await qc.invalidateQueries({ queryKey: MAIN_CONTACT_KEY }); }
            catch (e) { toast.error(e instanceof Error && e.message === 'Forbidden' ? 'Only System Administrators can change this.' : 'Check the email address.'); }
            finally { setBusy(false); }
          }}>{busy ? 'Saving…' : 'Save'}</Button>
        </div>
      </CardContent>
    </Card>
  );
}
