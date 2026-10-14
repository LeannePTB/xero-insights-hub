import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { ChevronDown, Lock } from 'lucide-react';
import { getCardCatalogue, getMyLockedModules } from '@/lib/card-model.functions';
import { lockedModuleTiles } from '@/lib/cards/locked-modules';
import { usePersistedDisclosure } from '@/hooks/usePersistedDisclosure';

/**
 * Practice-only: one slim row of modules this client lacks. Visibility comes
 * from public.client_locked_modules (empty for anyone else). No client figures.
 */
export function LockedModuleTiles({ clientId }: { clientId: string }) {
  const fetchLocked = useServerFn(getMyLockedModules), fetchCatalogue = useServerFn(getCardCatalogue);
  const locked = useQuery({ queryKey: ['client-locked-modules', clientId], queryFn: () => fetchLocked({ data: { clientId } }), retry: false });
  const catalogue = useQuery({ queryKey: ['card-catalogue'], queryFn: () => fetchCatalogue(), retry: false });
  const [open, setOpen] = usePersistedDisclosure('ta:section:locked-modules');
  const tiles = lockedModuleTiles(catalogue.data?.catalogue, locked.data?.modules ?? []);
  if (tiles.length === 0) return null;
  return (
    <section aria-label="Advisory modules not included" className="mt-6 rounded-lg border border-border bg-card">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left text-sm font-medium">
        <span className="flex items-center gap-2"><Lock className="h-3.5 w-3.5 text-emphasis" aria-hidden />More with Advisory</span>
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
      </button>
      {open && (
        <ul className="grid gap-2 border-t border-border p-3 sm:grid-cols-2 lg:grid-cols-4">
          {tiles.map(t => (
            <li key={t.key} className="flex min-w-0 flex-col gap-1 rounded-md bg-muted/50 p-3">
              <p className="flex items-center gap-1.5 text-sm font-semibold"><Lock className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />{t.label}</p>
              <p className="line-clamp-2 text-xs text-muted-foreground">{t.description}</p>
              <Link to="/clients/$clientId/advisory" params={{ clientId }} search={{ module: t.key }} className="mt-auto w-fit text-xs font-medium text-link underline-offset-2 hover:underline">Find out more<span className="sr-only"> about {t.label}</span></Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
