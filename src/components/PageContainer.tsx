import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";
import { cn } from "@/lib/utils";

type PageContainerProps<T extends ElementType = "main"> = {
  as?: T;
  children: ReactNode;
  width?: "readable" | "wide" | "full";
  className?: string;
} & Omit<ComponentPropsWithoutRef<T>, "as" | "children" | "className">;

/** Shared, left-aligned inset for every authenticated page. */
export function PageContainer<T extends ElementType = "main">({
  as,
  width = "wide",
  className,
  children,
  ...props
}: PageContainerProps<T>) {
  const Component = as ?? "main";
  return (
    <Component
      className={cn(
        "w-full px-4 py-8 sm:px-6",
        width === "readable" && "max-w-4xl",
        width === "wide" && "max-w-7xl",
        width === "full" && "max-w-none",
        className,
      )}
      {...props}
    >
      {children}
    </Component>
  );
}