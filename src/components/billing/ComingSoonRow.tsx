import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { toast } from 'sonner';
import { Check, ChevronDown, Clock, FlaskConical, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getClientComingSoon, registerComingSoonInterest, type ComingSoonEntry } from '@/lib/coming-soon.functions';
import { usePersistedDisclosure } from '@/hooks/usePersistedDisclosure';
import { useIsMobile } from '@/hooks/use-mobile';

/**
 * Practice-only teaser row. public.coming_soon_for_client returns nothing for
 * Business Owners, Viewers or anyone outside the organisation, so the row is
 * simply absent for them. It never makes a card visible or usable.
 */
export function ComingSoonRow({ clientId, alwaysOpen = false }: { clientId: string; alwaysOpen?: boolean }) {
  const fetchRows = useServerFn(getClientComingSoon);
  const q = useQuery({ queryKey: ['coming-soon', clientId], queryFn: () => fetchRows({ data: { clientId } }), retry: false });
  const isMobile = useIsMobile();
  const [stored, setOpen] = usePersistedDisclosure('ta:section:coming-soon');
  const [touched, setTouched] = useState(false);
  const entries = q.data?.entries ?? [];
  if (entries.length === 0) return null;
  // Collapsed by default on mobile until the person opens it.
  const open = alwaysOpen || (isMobile && !touched ? false : stored);
  return (
    <section aria-label="Roadmap" className="mt-4 rounded-lg border border-border bg-card">
      {alwaysOpen ? (
        <h2 className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium"><Clock className="h-3.5 w-3.5 text-emphasis" aria-hidden />Roadmap</h2>
      ) : (
        <button type="button" onClick={() => { setTouched(true); setOpen(!open); }} aria-expanded={open} className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left text-sm font-medium">
          <span className="flex items-center gap-2"><Clock className="h-3.5 w-3.5 text-emphasis" aria-hidden />Roadmap</span>
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
        </button>
      )}
      {open && (
        <ul className="grid gap-2 border-t border-border p-3 sm:grid-cols-2 lg:grid-cols-4">
          {entries.map((e) => <ComingSoonTile key={e.key} clientId={clientId} entry={e} />)}
        </ul>
      )}
    </section>
  );
}

function ComingSoonTile({ clientId, entry }: { clientId: string; entry: ComingSoonEntry }) {
  const register = useServerFn(registerComingSoonInterest);
  const [noted, setNoted] = useState(false);
  const [submissionKey] = useState(() => crypto.randomUUID());
  const mut = useMutation({
    mutationFn: () => register({ data: { clientId, entryKey: entry.key, submissionKey } }),
    onSuccess: () => setNoted(true),
    onError: (e: any) => toast.error(e?.message ?? 'Your interest could not be recorded.'),
  });
  return (
    <li className="flex min-w-0 flex-col gap-1 rounded-md bg-card p-3">
      <p className="flex items-center gap-1.5 text-sm font-semibold"><Clock className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />{entry.name}</p>
      <p className="line-clamp-2 text-xs text-muted-foreground">{entry.description}</p>
      {entry.timing && <p className="text-xs text-muted-foreground">Expected: {entry.timing}</p>}
      <div className="mt-auto pt-1">
        {entry.earlyAccess ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-link"><FlaskConical className="h-3 w-3" aria-hidden />You have early access</span>
        ) : noted ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground"><Check className="h-3 w-3" aria-hidden />Interest noted</span>
        ) : (
          <Button size="sm" variant="outline" className="h-7 px-2 text-xs" disabled={mut.isPending} onClick={() => mut.mutate()}>
            {mut.isPending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}I'm interested<span className="sr-only"> in {entry.name}</span>
          </Button>
        )}
      </div>
    </li>
  );
}
