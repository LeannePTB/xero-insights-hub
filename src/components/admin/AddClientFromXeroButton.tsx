import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Plug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { startXeroOnboardConnect } from "@/lib/xero/connections.functions";

/**
 * One-step onboarding: authorise a Xero file, and the client subscription is
 * created automatically from the Xero organisation name on callback.
 */
export function AddClientFromXeroButton({
  firmId,
  disabled,
  className,
  variant = "default",
}: {
  firmId: string;
  disabled?: boolean;
  className?: string;
  variant?: "default" | "outline" | "secondary";
}) {
  const start = useServerFn(startXeroOnboardConnect);
  const mut = useMutation({
    mutationFn: () => start({ data: { origin: window.location.origin, firmId } }),
    onSuccess: ({ authorizeUrl }) => {
      window.location.href = authorizeUrl;
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not start the Xero connection"),
  });

  return (
    <Button
      variant={variant}
      className={className}
      disabled={disabled || mut.isPending}
      onClick={() => mut.mutate()}
    >
      {mut.isPending ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Plug className="mr-2 h-4 w-4" />
      )}
      Add client from Xero
    </Button>
  );
}
