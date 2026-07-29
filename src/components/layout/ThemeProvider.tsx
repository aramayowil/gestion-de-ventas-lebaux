/**
 * components/layout/ThemeProvider.tsx — Wrapper para next-themes.
 *
 * Vive en layout/ porque es parte del armazón de la app (envuelve toda la
 * página), no un componente de negocio ni un primitivo de UI reusable.
 *
 * Evita el flash de tema incorrecto (FOUC) usando suppressHydrationWarning
 * en el <html> y aplicando el tema antes del primer render de React.
 */

import * as React from 'react'
import { ThemeProvider as NextThemesProvider } from 'next-themes'

export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>
}
