/**
 * components/ui/money-input.tsx — Input numérico con formato de precios
 * argentinos (punto como separador de miles, coma como decimal).
 *
 * Por qué no usar <input type="number">:
 *  - No permite mostrar "1.234.567" mientras se escribe (el navegador
 *    rechaza cualquier caracter que no sea dígito, '.', '-', 'e').
 *  - En iOS/Android muestra un teclado con signos (+/-, e) que no
 *    aplican a un monto en pesos, y las flechitas de spinner se ven mal.
 *
 * Este input es `type="text"` pero con `inputMode` numérico para que el
 * teclado que aparece en celulares sea el de solo números, y filtra
 * cualquier caracter que no sea dígito (y opcionalmente una coma
 * decimal) a medida que se escribe.
 *
 * El valor que entra/sale por props siempre es un `number` común
 * (sin formato); el string formateado con puntos es solo de display.
 */
import * as React from 'react'
import { Input } from '@/components/ui/input'

/** Quita todo lo que no sea dígito. */
function soloDigitos(v: string): string {
  return v.replace(/\D/g, '')
}

/** Agrupa una cadena de dígitos en miles con puntos: "1234567" → "1.234.567" */
function agruparMiles(digitos: string): string {
  const limpio = digitos.replace(/^0+(?=\d)/, '')
  if (!limpio) return ''
  return limpio.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

export interface MoneyInputProps extends Omit<
  React.ComponentProps<typeof Input>,
  'value' | 'onChange' | 'type' | 'inputMode'
> {
  /** Valor numérico sin formato (ej: 1234567.5) */
  value: number
  /** Se llama con el valor numérico ya parseado cada vez que cambia */
  onChange: (value: number) => void
  /** Permite ingresar centavos con coma. Default: false (montos enteros). */
  allowDecimals?: boolean
  /** Si es true, muestra vacío en vez de "0" cuando el valor es 0 y el input no tiene foco */
  mostrarVacioEnCero?: boolean
}

export const MoneyInput = React.forwardRef<HTMLInputElement, MoneyInputProps>(
  function MoneyInput(
    {
      value,
      onChange,
      allowDecimals = false,
      mostrarVacioEnCero = true,
      onFocus,
      onBlur,
      ...props
    },
    forwardedRef,
  ) {
    const [enFoco, setEnFoco] = React.useState(false)

    const formatearNumero = React.useCallback(
      (n: number): string => {
        if (!n) return mostrarVacioEnCero ? '' : '0'
        if (allowDecimals) {
          const fijo = n.toFixed(2)
          const [ent, dec] = fijo.split('.')
          return dec === '00'
            ? agruparMiles(ent)
            : `${agruparMiles(ent)},${dec}`
        }
        return agruparMiles(String(Math.round(n)))
      },
      [allowDecimals, mostrarVacioEnCero],
    )

    const [display, setDisplay] = React.useState(() => formatearNumero(value))

    // Si el valor cambia desde afuera (ej: botón "Saldo completo") y el
    // input no está siendo editado en este momento, sincronizamos el display.
    React.useEffect(() => {
      if (!enFoco) setDisplay(formatearNumero(value))
    }, [value, enFoco, formatearNumero])

    function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
      const crudo = e.target.value

      if (allowDecimals) {
        const filtrado = crudo.replace(/[^\d,]/g, '')
        const partes = filtrado.split(',')
        const entero = soloDigitos(partes[0] ?? '')
        const tieneComa = partes.length > 1
        const decimales = tieneComa
          ? soloDigitos(partes.slice(1).join('')).slice(0, 2)
          : ''

        const enteroFmt = agruparMiles(entero)
        setDisplay(tieneComa ? `${enteroFmt},${decimales}` : enteroFmt)

        const numero = parseFloat(
          `${entero || '0'}.${decimales.padEnd(2, '0') || '00'}`,
        )
        onChange(numero)
      } else {
        const digitos = soloDigitos(crudo)
        setDisplay(agruparMiles(digitos))
        onChange(digitos ? parseInt(digitos, 10) : 0)
      }
    }

    return (
      <Input
        ref={forwardedRef}
        type="text"
        inputMode={allowDecimals ? 'decimal' : 'numeric'}
        autoComplete="one-time-code"
        pattern="[0-9.,]*"
        value={display}
        onChange={handleChange}
        onFocus={(e) => {
          setEnFoco(true)
          onFocus?.(e)
        }}
        onBlur={(e) => {
          setEnFoco(false)
          onBlur?.(e)
        }}
        {...props}
      />
    )
  },
)
