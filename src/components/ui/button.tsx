import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--tech-radius-button)] text-[11px] font-black uppercase tracking-widest transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-ring/30 active:scale-95",
  {
    variants: {
      variant: {
        default:
          "bg-[var(--tech-color-primary)] text-[var(--tech-color-primary-foreground)] hover:brightness-95 shadow-[var(--tech-shadow-button)]",
        destructive: "bg-destructive text-white hover:bg-destructive/90",
        outline:
          "border border-border bg-background text-foreground hover:bg-muted hover:border-[var(--tech-color-primary)]",
        secondary:
          "bg-[var(--tech-color-brand-dark)] text-white hover:brightness-110",
        ghost: "hover:bg-white/5 text-white/60 hover:text-white",
        link: "text-[var(--tech-color-primary)] underline-offset-4 hover:underline",
      },
      size: {
        default: "h-[var(--tech-control-height-button)] px-8 py-2",
        sm: "h-10 rounded-[calc(var(--tech-radius-button)-2px)] gap-1.5 px-4",
        lg: "h-14 rounded-[calc(var(--tech-radius-button)+4px)] px-10",
        icon: "size-[var(--tech-control-size-icon-button)]",
        "icon-sm": "size-10",
        "icon-lg": "size-14",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
