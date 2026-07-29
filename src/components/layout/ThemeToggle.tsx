/**
 * components/layout/ThemeToggle.tsx — Botón para alternar tema claro/oscuro.
 *
 * Mantiene el comportamiento (next-themes, anti-mismatch) pero con
 * micro-animación de entrada para el ícono.
 */
import * as React from 'react'
import { useTheme } from 'next-themes'
import { Sun, Moon } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function ThemeToggle({
  className,
  size = 'icon',
}: {
  className?: string
  size?: 'icon' | 'sm' | 'default'
}) {
  const { resolvedTheme, setTheme } = useTheme()
  const [montado, setMontado] = React.useState(false)

  React.useEffect(() => {
    setMontado(true)
  }, [])

  if (!montado) {
    return (
      <Button variant="ghost" size={size} className={className} disabled>
        <Sun className="size-4" />
      </Button>
    )
  }

  const esOscuro = resolvedTheme === 'dark'

  return (
    <Button
      variant="ghost"
      size={size}
      className={className}
      onClick={() => setTheme(esOscuro ? 'light' : 'dark')}
      title={esOscuro ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
      aria-label={esOscuro ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
    >
      <span
        key={esOscuro ? 'sun' : 'moon'}
        className="inline-flex animate-in fade-in zoom-in-90 duration-200"
      >
        {esOscuro ? <Sun className="size-4" /> : <Moon className="size-4" />}
      </span>
    </Button>
  )
}
