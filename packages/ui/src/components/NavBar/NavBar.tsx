import { type JSX, type ParentComponent, splitProps } from 'solid-js'
import * as styles from './NavBar.css'

// ============================================================================
// NavBar Container
// ============================================================================

export interface NavBarProps extends JSX.HTMLAttributes<HTMLElement> {
  /** NavBar visual variant */
  variant?: 'default' | 'transparent' | 'elevated'
  /** NavBar position */
  position?: 'static' | 'sticky' | 'fixed'
  /** NavBar size */
  size?: 'sm' | 'md' | 'lg'
  children: JSX.Element
}

export const NavBar: ParentComponent<NavBarProps> = (props) => {
  const [local, variants, rest] = splitProps(props, ['children', 'class'], ['variant', 'position', 'size'])

  return (
    <nav class={`${styles.navBar(variants)} ${local.class ?? ''}`} {...rest}>
      <div class={styles.navBarContainer}>{local.children}</div>
    </nav>
  )
}

// ============================================================================
// NavBar Brand (Logo/Title area)
// ============================================================================

export interface NavBarBrandProps extends JSX.AnchorHTMLAttributes<HTMLAnchorElement> {
  children: JSX.Element
}

export const NavBarBrand: ParentComponent<NavBarBrandProps> = (props) => {
  const [local, rest] = splitProps(props, ['children', 'class'])

  return (
    <a class={`${styles.navBarBrand} ${local.class ?? ''}`} {...rest}>
      {local.children}
    </a>
  )
}

// ============================================================================
// NavBar Nav (Navigation links container)
// ============================================================================

export interface NavBarNavProps extends JSX.HTMLAttributes<HTMLUListElement> {
  children: JSX.Element
}

export const NavBarNav: ParentComponent<NavBarNavProps> = (props) => {
  const [local, rest] = splitProps(props, ['children', 'class'])

  return (
    <ul class={`${styles.navBarNav} ${local.class ?? ''}`} {...rest}>
      {local.children}
    </ul>
  )
}

// ============================================================================
// NavBar Actions (Right-side actions like buttons, user menu)
// ============================================================================

export interface NavBarActionsProps extends JSX.HTMLAttributes<HTMLDivElement> {
  children: JSX.Element
}

export const NavBarActions: ParentComponent<NavBarActionsProps> = (props) => {
  const [local, rest] = splitProps(props, ['children', 'class'])

  return (
    <div class={`${styles.navBarActions} ${local.class ?? ''}`} {...rest}>
      {local.children}
    </div>
  )
}

// ============================================================================
// NavLink (Individual navigation link)
// ============================================================================

export interface NavLinkProps extends JSX.AnchorHTMLAttributes<HTMLAnchorElement> {
  /** Whether this link is currently active */
  active?: boolean
  children: JSX.Element
}

export const NavLink: ParentComponent<NavLinkProps> = (props) => {
  const [local, variants, rest] = splitProps(props, ['children', 'class'], ['active'])

  return (
    <li>
      <a
        class={`${styles.navLink(variants)} ${local.class ?? ''}`}
        aria-current={variants.active ? 'page' : undefined}
        {...rest}
      >
        {local.children}
      </a>
    </li>
  )
}
