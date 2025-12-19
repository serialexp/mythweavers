import { PropsWithChildren } from 'react'
import { Link } from 'wouter'

export const Navitem = (
  props: PropsWithChildren<{
    to: string
    className?: string
  }>,
) => {
  return (
    <Link to={props.to} className={`transition-colors duration-200 ${props.className}`}>
      {props.children}
    </Link>
  )
}
