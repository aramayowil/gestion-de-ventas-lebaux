import * as React from 'react'

import { cn } from '@/lib/utils'

function Separator({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      role="separator"
      data-slot="separator"
      className={cn('shrink-0 bg-border/70', className)}
      {...props}
    />
  )
}

export { Separator }
