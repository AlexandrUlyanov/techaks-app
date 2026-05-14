import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-[11px] font-black uppercase tracking-widest transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-[#05C3D4]/20 active:scale-95",
  {
    variants: {
      variant: {
        default: "bg-[#05C3D4] text-black hover:bg-[#27E6F2] glow-cyan",
        destructive: "bg-destructive text-white hover:bg-destructive/90",
        outline:
          "border border-border bg-background text-foreground hover:bg-muted hover:border-[#05C3D4]",
        secondary: "bg-[#464A50] text-white hover:bg-[#5A5F66]",
        ghost: "hover:bg-white/5 text-white/60 hover:text-white",
        link: "text-[#05C3D4] underline-offset-4 hover:underline",
      },
      size: {
        default: "h-12 px-8 py-2",
        sm: "h-10 rounded-lg gap-1.5 px-4",
        lg: "h-14 rounded-2xl px-10",
        icon: "size-12",
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
