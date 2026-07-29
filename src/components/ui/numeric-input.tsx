/**
 * components/ui/numeric-input.tsx — Input "solo números" sin separador de
 * miles, pensado para campos chicos como porcentajes, días o cantidades
 * que se tipean directamente (no montos en pesos, para eso ver
 * money-input.tsx).
 *
 * Igual que MoneyInput, usamos type="text" + inputMode numérico en vez de
 * type="number" para evitar el teclado con signos (+/-, e) y las flechitas
 * de spinner en celulares, y para poder acotar el valor entre min/max
 * mientras se escribe sin que el navegador "trabe" el input.
 */
import * as React from 'react'
import { Input } from '@/components/ui/input'

export interface NumericInputProps extends Omit<
  React.ComponentProps<typeof Input>,
  'value' | 'onChange' | 'type' | 'inputMode'
> {
  value: number
  onChange: (value: number) => void
  /** Permite un decimal separado por coma (ej: descuento 12,5%). Default: false. */
  allowDecimals?: boolean
  min?: number
  max?: number
}

export const NumericInput = React.forwardRef<
  HTMLInputElement,
  NumericInputProps
>(function NumericInput(
  {
    value,
    onChange,
    allowDecimals = false,
    min,
    max,
    onFocus,
    onBlur,
    ...props
  },
  forwardedRef,
) {
  const [enFoco, setEnFoco] = React.useState(false)

  const formatear = React.useCallback(
    (n: number): string => {
      if (!n && n !== 0) return ''
      if (n === 0) return ''
      return allowDecimals ? String(n).replace('.', ',') : String(Math.round(n))
    },
    [allowDecimals],
  )

  const [display, setDisplay] = React.useState(() => formatear(value))

  React.useEffect(() => {
    if (!enFoco) setDisplay(formatear(value))
  }, [value, enFoco, formatear])

  function clamp(n: number): number {
    let r = n
    if (min !== undefined) r = Math.max(min, r)
    if (max !== undefined) r = Math.min(max, r)
    return r
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    let filtrado = allowDecimals
      ? e.target.value.replace(/[^\d,]/g, '')
      : e.target.value.replace(/\D/g, '')

    if (allowDecimals) {
      const partes = filtrado.split(',')
      if (partes.length > 2)
        filtrado = `${partes[0]},${partes.slice(1).join('')}`
    }

    setDisplay(filtrado)

    const numero = parseFloat(filtrado.replace(',', '.')) || 0
    onChange(clamp(numero))
  }

  function handleBlur(e: React.FocusEvent<HTMLInputElement>) {
    setEnFoco(false)
    // Al perder foco, mostramos el valor ya acotado a min/max
    setDisplay(formatear(value))
    onBlur?.(e)
  }

  return (
    <Input
      ref={forwardedRef}
      type="text"
      inputMode={allowDecimals ? 'decimal' : 'numeric'}
      autoComplete="one-time-code"
      pattern={allowDecimals ? '[0-9,]*' : '[0-9]*'}
      value={display}
      onChange={handleChange}
      onFocus={(e) => {
        setEnFoco(true)
        onFocus?.(e)
      }}
      onBlur={handleBlur}
      {...props}
    />
  )
})
