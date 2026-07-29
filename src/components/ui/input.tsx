import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Input premium dark:
 *  - Fondo ligeramente elevado respecto al card para "sobresalir"
 *  - Borde sutil con focus ring dorado
 *  - Placeholder más tenue
 */
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "file:text-foreground placeholder:text-muted-foreground/70 selection:bg-primary selection:text-primary-foreground dark:bg-input/20 border-input flex h-11 w-full min-w-0 rounded-lg border bg-card/60 px-3 py-1 text-base shadow-xs transition-[color,box-shadow,background-color] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        "hover:border-primary/30",
        "focus-visible:border-ring focus-visible:bg-card focus-visible:ring-ring/50 focus-visible:ring-[3px]",
        "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
        className
      )}
      {...props}
    />
  )
}

export { Input }
