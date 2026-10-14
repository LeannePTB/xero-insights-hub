import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { getEnquiryAlertEmail, saveEnquiryAlertEmail, sendEnquiryAlertTest } from '@/lib/upgrade-enquiries.functions';

/** System Administrator setting; the server enforces AAL2 and the role. */
export function EnquiryAlertSettings() {
  const read = useServerFn(getEnquiryAlertEmail), save = useServerFn(saveEnquiryAlertEmail), test = useServerFn(sendEnquiryAlertTest);
  const q = useQuery({ queryKey: ['enquiry-alert-email'], queryFn: () => read(), retry: false });
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState<'save' | 'test' | null>(null);
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
        </div>
      </CardContent>
    </Card>
  );
}
