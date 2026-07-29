import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * Botón premium dark con dorado de marca.
 * Variantes revisadas para acompañar el rediseño:
 *   - default: dorado "latón" con texto oscuro (modo oscuro) / claro (modo claro)
 *   - outline: borde sutil con hover elevado
 *   - ghost: transparente con hover tenue
 *   - secondary: superficie elevada
 *   - destructive: rojo marca
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-200 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive active:scale-[0.98]",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-[0_2px_8px_-2px_var(--primary)] hover:brightness-110 hover:shadow-[0_4px_16px_-4px_var(--primary)] dark:hover:brightness-105",
        destructive:
          "bg-destructive text-white shadow-xs hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/70 dark:hover:bg-destructive",
        outline:
          "border border-border bg-card/60 backdrop-blur-sm shadow-xs hover:bg-elevated hover:border-primary/40 dark:bg-card/40 dark:hover:bg-elevated",
        secondary:
          "bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/80 border border-border/50",
        ghost:
          "hover:bg-elevated hover:text-foreground dark:hover:bg-elevated/60",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        // 44px = tamaño táctil mínimo recomendado (WCAG 2.5.5 / Apple HIG).
        default: "h-11 px-4 py-2 has-[>svg]:px-3",
        sm: "h-9 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5 text-[13px]",
        lg: "h-12 rounded-lg px-6 text-base has-[>svg]:px-5",
        icon: "size-11",
        "icon-sm": "size-9 rounded-md",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
