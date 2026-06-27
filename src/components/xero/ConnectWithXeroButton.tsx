import * as React from "react";
import { cn } from "@/lib/utils";

type Variant = "connect" | "reconnect" | "disconnect";

const LABELS: Record<Variant, string> = {
  connect: "Connect to Xero",
  reconnect: "Reconnect to Xero",
  disconnect: "Disconnect from Xero",
};

/**
 * Xero-branded action button used wherever the user connects, reconnects, or
 * disconnects a Xero organisation. Follows Xero's app partner brand guidelines
 * (blue #13B5EA, white text, white Xero "X" mark on the left, min 32px height,
 * adequate padding, undistorted mark). Required for Xero App Store certification
 * checkpoint 4 (Branding and Naming).
 */
export const ConnectWithXeroButton = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: Variant;
    size?: "sm" | "md";
    label?: string;
  }
>(function ConnectWithXeroButton(
  { variant = "connect", size = "md", label, className, children, ...props },
  ref,
) {
  const text = label ?? LABELS[variant];
  const isDisconnect = variant === "disconnect";

  return (
    <button
      ref={ref}
      type={props.type ?? "button"}
      {...props}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md font-semibold tracking-tight",
        "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
        "disabled:cursor-not-allowed disabled:opacity-60",
        size === "sm" ? "h-8 px-3 text-xs" : "h-10 px-4 text-sm",
        isDisconnect
          ? "border border-[#13B5EA] bg-white text-[#13B5EA] hover:bg-[#13B5EA]/10 focus-visible:ring-[#13B5EA]/40"
          : "bg-[#13B5EA] text-white hover:bg-[#0fa3d3] focus-visible:ring-[#13B5EA]/50",
        className,
      )}
      aria-label={text}
    >
      <XeroMark className={cn(size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4", isDisconnect ? "text-[#13B5EA]" : "text-white")} />
      <span>{children ?? text}</span>
    </button>
  );
});

function XeroMark({ className }: { className?: string }) {
  // Stylised Xero "X" mark inside a circle. Drawn from primitives so the asset
  // is bundled with the app and not loaded from an external host. Single colour
  // (currentColor) so it inherits white on the blue button and blue on the
  // outline variant — never distorted, recoloured, or stretched.
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      aria-hidden="true"
      focusable="false"
      fill="none"
    >
      <circle cx="12" cy="12" r="11" fill="currentColor" opacity="0.0" />
      <circle cx="12" cy="12" r="11" stroke="currentColor" strokeWidth="2" />
      <path
        d="M8.2 8.2 L15.8 15.8 M15.8 8.2 L8.2 15.8"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
}
