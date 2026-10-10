import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSignOut } from "@/lib/use-sign-out";
import { useHeaderPresent } from "@/components/shell/shell-context";

/**
 * Floating Sign out for the bare (no side menu) layout. Hidden when the page's
 * own AppHeader shows one. Presentation only — grants nothing.
 */
export function GlobalSignOut() {
  const signOut = useSignOut();
  const headerPresent = useHeaderPresent();
  if (headerPresent) return null;

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 print:hidden">
      <Button
        variant="outline"
        size="sm"
        onClick={() => void signOut()}
        className="pointer-events-auto bg-card font-semibold shadow-lg"
      >
        <LogOut className="mr-2 h-4 w-4" /> Sign out
      </Button>
    </div>
  );
}
