import { type JSX, type ParentComponent, splitProps } from 'solid-js'
import { Dynamic } from 'solid-js/web'
import * as styles from './Card.css'

// ============================================================================
// Card Container
// ============================================================================

export interface CardProps extends JSX.HTMLAttributes<HTMLDivElement> {
  /** Card visual variant */
  variant?: 'default' | 'elevated' | 'outlined' | 'flat'
  /** Makes the card interactive with hover effects */
  interactive?: boolean
  /** Padding (when not using CardBody) */
  padding?: 'none' | 'sm' | 'md' | 'lg'
  /** Max-width size preset */
  size?: 'auto' | 'sm' | 'md' | 'lg' | 'xl' | 'full'
  children: JSX.Element
}

export const Card: ParentComponent<CardProps> = (props) => {
  const [local, variants, rest] = splitProps(props, ['children', 'class'], ['variant', 'interactive', 'padding', 'size'])

  return (
    <div class={`${styles.card(variants)} ${local.class ?? ''}`} {...rest}>
      {local.children}
    </div>
  )
}

// ============================================================================
// Card Image
// ============================================================================

export interface CardImageProps extends JSX.ImgHTMLAttributes<HTMLImageElement> {
  /** Image height */
  height?: string
}

export const CardImage = (props: CardImageProps) => {
  const [local, rest] = splitProps(props, ['class', 'height', 'style'])

  return (
    <img
      class={`${styles.cardImage} ${local.class ?? ''}`}
      style={{
        height: local.height,
        ...(typeof local.style === 'object' ? local.style : {}),
      }}
      {...rest}
    />
  )
}

// ============================================================================
// Card Body
// ============================================================================

export interface CardBodyProps extends JSX.HTMLAttributes<HTMLDivElement> {
  /** Padding size */
  padding?: 'none' | 'sm' | 'md' | 'lg'
  /** Gap between children */
  gap?: 'none' | 'sm' | 'md' | 'lg'
  children: JSX.Element
}

export const CardBody: ParentComponent<CardBodyProps> = (props) => {
  const [local, variants, rest] = splitProps(props, ['children', 'class'], ['padding', 'gap'])

  return (
    <div class={`${styles.cardBody(variants)} ${local.class ?? ''}`} {...rest}>
      {local.children}
    </div>
  )
}

// ============================================================================
// Card Title
// ============================================================================

export interface CardTitleProps extends JSX.HTMLAttributes<HTMLHeadingElement> {
  /** Title size */
  size?: 'sm' | 'md' | 'lg'
  /** HTML heading level (h1-h6) */
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'
  children: JSX.Element
}

export const CardTitle: ParentComponent<CardTitleProps> = (props) => {
  const [local, variants, rest] = splitProps(props, ['children', 'class', 'as'], ['size'])

  return (
    <Dynamic component={local.as ?? 'h3'} class={`${styles.cardTitle(variants)} ${local.class ?? ''}`} {...rest}>
      {local.children}
    </Dynamic>
  )
}

// ============================================================================
// Card Description
// ============================================================================

export interface CardDescriptionProps extends JSX.HTMLAttributes<HTMLParagraphElement> {
  children: JSX.Element
}

export const CardDescription: ParentComponent<CardDescriptionProps> = (props) => {
  const [local, rest] = splitProps(props, ['children', 'class'])

  return (
    <p class={`${styles.cardDescription} ${local.class ?? ''}`} {...rest}>
      {local.children}
    </p>
  )
}

// ============================================================================
// Card Actions
// ============================================================================

export interface CardActionsProps extends JSX.HTMLAttributes<HTMLDivElement> {
  /** How to justify the actions */
  justify?: 'start' | 'center' | 'end' | 'between' | 'around'
  /** Gap between actions */
  gap?: 'sm' | 'md' | 'lg'
  children: JSX.Element
}

export const CardActions: ParentComponent<CardActionsProps> = (props) => {
  const [local, variants, rest] = splitProps(props, ['children', 'class'], ['justify', 'gap'])

  return (
    <div class={`${styles.cardActions(variants)} ${local.class ?? ''}`} {...rest}>
      {local.children}
    </div>
  )
}
