/**
 * Indicador de carga compartido por el arranque de la aplicación y el login.
 *
 * La lógica asíncrona vive en TanStack Query; este archivo conserva solamente
 * el componente visual para que Fast Refresh pueda tratarlo como un módulo de
 * componentes puro.
 */
export function Spinner({ className = 'size-6' }: { className?: string }) {
  return (
    <div
      className={`
        ${className}
        animate-spin rounded-full
        border-2 border-muted border-t-primary
      `}
      role="status"
      aria-label="Cargando"
    />
  )
}
