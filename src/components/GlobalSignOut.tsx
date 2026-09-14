import { useEffect, useState } from "react";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSignOut } from "@/lib/use-sign-out";

/**
 * A Sign out control for every signed-in page that does not already render one.
 *
 * Presentation only — it calls the same shared sign-out as the app header and
 * grants nothing. Pages that render AppHeader mark it with `data-app-header`;
 * this control hides itself when such a header is present so no page shows two.
 */
export function GlobalSignOut() {
  const signOut = useSignOut();
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Run after paint so page headers have mounted.
    const id = window.setTimeout(() => {
      setShow(!document.querySelector("[data-app-header]"));
    }, 0);
    return () => window.clearTimeout(id);
  });

  if (!show) return null;

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
