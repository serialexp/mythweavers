import prand from 'pure-rand'
import { useRef, useState } from 'react'
import { hashString } from '../util'

const randomFonts = [
  'Arial, Helvetica, sans-serif',
  'Calligrapher, cursive',
  'Comic Sans MS, cursive',
  'Georgia, serif',
  'Impact, Charcoal, sans-serif',
  'Lucida Console, Monaco, monospace',
  'Lucida Sans Unicode, Lucida Grande, sans-serif',
  'Palatino Linotype, Book Antiqua, Palatino, serif',
  'Tahoma, Geneva, sans-serif',
  'Optima, sans-serif',
]

const darkColors = ['#232819', '#2C2C2C', '#2D2D2D']

const lightColors = ['#F0F0F0', '#F5F5F5', '#fad714']

export const Book = (props: {
  title: string
  author: string
  image: string
  spineColor?: string
  spineTextColor?: string
  pages: number
}) => {
  const [selected, isSelected] = useState(false)
  const [showImage, setShowImage] = useState(false)
  const ref = useRef<number | undefined>(undefined)
  const width = Math.max(Math.round(props.pages / 20), 50)
  const rng = prand.xoroshiro128plus(hashString(props.title))
  const height = prand.unsafeUniformIntDistribution(450, 600, rng)
  const randomRotation = prand.unsafeUniformIntDistribution(-10, 10, rng) / 10
  const randomFont = prand.unsafeUniformIntDistribution(0, randomFonts.length - 1, rng)
  const colorVariant = prand.unsafeUniformIntDistribution(0, 2, rng)
  const spineLines = Math.min(Math.floor(width / 50), 2)
  const titleSizing = Math.max(Math.min((37 * spineLines) / props.title.length, 1.2 * (width / 50)), 2)
  const openedWidth = (height / 600) * 400
  return (
    <div
      className={`container ${selected ? 'selected' : ''}`}
      onClick={() => {
        if (selected) {
          isSelected(false)
          ref.current = window.setTimeout(() => {
            setShowImage(false)
            ref.current = undefined
          }, 500)
        } else {
          if (ref.current) {
            window.clearTimeout(ref.current)
          }
          isSelected(true)
          setShowImage(true)
        }
      }}
      style={{
        '--randomRotation': `${randomRotation}deg`,
        '--title-size': `${titleSizing}cqw`,
        '--font': randomFonts[randomFont],
        '--height': `${height}px`,
        '--width': `${width}px`,
        '--opened-width': `${openedWidth}px`,
        '--neg-width': `-${width}px`,
        '--spine-background': props.spineTextColor === '#F5F5F5' ? 'url(./leather.png)' : 'url(./dark-leather.png)',
        '--offset': `-${width / 2}px`,
        '--neg-offset': `${width / 2}px`,
        '--spine-text-background': `${
          props.spineTextColor === '#000000' ? darkColors[colorVariant] : lightColors[colorVariant]
        }${props.spineTextColor === '#FFFFFF' && colorVariant === 2 ? ' url(./golden-foil.jpeg) repeat' : ''}`,
        '--text-fill-color': props.spineTextColor === '#FFFFFF' && colorVariant === 2 ? 'transparent' : 'inherit',
      }}
    >
      <div className="book">
        {showImage ? (
          <div className="front">
            <div
              className="cover"
              style={{
                background: `${props.spineColor} url(${props.image})`,
                backgroundSize: 'contain',
              }}
            />
          </div>
        ) : null}
        <div
          className="spine"
          style={{
            backgroundColor: props.spineColor,
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          <h2>
            {/*<span>{props.author}</span>*/}
            {props.title}
          </h2>
        </div>
      </div>
    </div>
  )
}
