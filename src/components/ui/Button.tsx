import type { ButtonHTMLAttributes, ReactNode } from 'react'
import './button.css'

export type ButtonVariant = 'primary' | 'solid' | 'secondary' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md'

interface CommonButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual treatment. Derived from real usage; default is the neutral bordered button. */
  variant?: ButtonVariant
  size?: ButtonSize
  /** Toggle on-state: applies the accent treatment and sets aria-pressed. Omit for non-toggle buttons. */
  pressed?: boolean
}

export interface ButtonProps extends CommonButtonProps {
  children: ReactNode
}

// Icon-only buttons have no text content, so an accessible name is required at
// the type level — this is what an `iconOnly` boolean on Button could not enforce.
export interface IconButtonProps extends CommonButtonProps {
  'aria-label': string
  children: ReactNode
}

function buildClass(
  variant: ButtonVariant,
  size: ButtonSize,
  pressed: boolean | undefined,
  icon: boolean,
  extra: string | undefined,
): string {
  return [
    'facet-btn',
    `facet-btn--${variant}`,
    size === 'sm' ? 'facet-btn--sm' : null,
    icon ? 'facet-btn--icon' : null,
    pressed ? 'facet-btn--pressed' : null,
    extra,
  ]
    .filter(Boolean)
    .join(' ')
}

export function Button({
  variant = 'secondary',
  size = 'md',
  pressed,
  type = 'button',
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buildClass(variant, size, pressed, false, className)}
      {...(pressed === undefined ? {} : { 'aria-pressed': pressed })}
      {...rest}
    >
      {children}
    </button>
  )
}

export function IconButton({
  variant = 'ghost',
  size = 'md',
  pressed,
  type = 'button',
  className,
  children,
  ...rest
}: IconButtonProps) {
  return (
    <button
      type={type}
      className={buildClass(variant, size, pressed, true, className)}
      {...(pressed === undefined ? {} : { 'aria-pressed': pressed })}
      {...rest}
    >
      {children}
    </button>
  )
}
