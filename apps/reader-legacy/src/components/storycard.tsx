import type { StoryStatus } from '@writer/server'
import classnames from 'classnames'
import { Clock } from 'iconoir-react'
import React from 'react'
import { useLocation } from 'wouter'
import { openAddToBookshelf } from '../slices/bookshelf-slice'
import { useAppDispatch } from '../store'
import styles from './storycard.module.css'

import TimeAgo from 'javascript-time-ago'

// English.
import en from 'javascript-time-ago/locale/en'

TimeAgo.addLocale(en)
const timeAgo = new TimeAgo('en-US')

interface StoryCardProps {
  id: string
  coverArtAsset: string
  name: string
  ownerName: string
  pages: number
  summary: string // Add summary to props
  color: string
  textColor: string
  spellingLevel: number
  fontFamily: string
  lastChapterReleasedAt: string
  royalRoadId?: number
  status?: StoryStatus
  wordsPerWeek?: number
  canAddToLibrary?: boolean
}

const StoryCard: React.FC<StoryCardProps> = ({
  id,
  coverArtAsset,
  name,
  summary,
  color,
  textColor,
  pages,
  fontFamily,
  lastChapterReleasedAt,
  spellingLevel,
  royalRoadId,
  status,
  wordsPerWeek,
  canAddToLibrary,
}: StoryCardProps) => {
  const [_location, _navigate] = useLocation()
  const dispatch = useAppDispatch()

  const handleAddToLibraryClick = () => {
    dispatch(openAddToBookshelf(id)) // Show the popup when the button is clicked
  }

  return (
    <div className={styles.cardContainer}>
      <div
        className={styles.card}
        style={{
          '--thickness': `${Math.round(pages / 20)}px`,
          '--half-thickness': `${Math.round(pages / 20) / 2}px`,
        }}
      >
        <div className={styles.cardGlow}>
          <div className={styles.cardGlowInner} />
        </div>
        <div className={styles.cardLeft} style={{ backgroundColor: color }} />
        <div
          className={classnames(styles.cardFront, 'bg-slate-100 dark:bg-slate-800 relative')}
          style={{ backgroundColor: color, color: textColor }}
        >
          {coverArtAsset ? (
            <img src={coverArtAsset} alt={name} className="w-full object-cover" />
          ) : (
            <p
              className={`text-center text-gray-500 self-start mt-8 px-4 ${
                name.length > 40 ? 'text-md' : 'text-xl'
              } font-bold`}
              style={{ fontFamily: fontFamily }}
            >
              {name}
            </p>
          )}
        </div>
        <div
          className={classnames(styles.cardBack, 'flex flex-col shadow-md p-4 gap-2')}
          style={{ backgroundColor: color, color: textColor }}
        >
          <h2 className={`${name.length > 40 ? 'text-xs' : name.length > 20 ? 'text-md' : 'text-lg'} font-bold`}>
            {name}
          </h2>
          <p className={'text-xs overflow-x-hidden w-full'}>
            {pages} pages
            {status === 'COMPLETED' ? ' ✅' : status === 'HIATUS' ? ' ⏸️' : ' 🔥'} {wordsPerWeek ?? '?'} W/W
          </p>
          <div className={'text-xs flex-1 overflow-x-hidden w-full'} dangerouslySetInnerHTML={{ __html: summary }} />

          <div className="flex flex-row gap-2 justify-around">
            {canAddToLibrary && (
              <button
                type="button"
                className="btn btn-accent btn-sm"
                onClick={handleAddToLibraryClick} // Attach the event handler
              >
                + Library
              </button>
            )}
            <a
              className="btn btn-primary btn-sm"
              href={royalRoadId ? `https://www.royalroad.com/fiction/${royalRoadId}` : `/story/${id}`}
              target={royalRoadId ? '_blank' : undefined}
              rel={royalRoadId ? 'noopener noreferrer' : undefined}
            >
              Read
            </a>
          </div>
        </div>
      </div>
      <div className="text-lg text-gray-500 mt-4 flex items-center justify-center gap-1">
        <span title={status === 'COMPLETED' ? 'Completed' : status === 'HIATUS' ? 'Hiatus' : 'Ongoing'}>
          {status === 'COMPLETED' ? ' ✅' : status === 'HIATUS' ? ' ⏸️' : ' 🔥'}
        </span>
        {lastChapterReleasedAt && (
          <div
            title="Last chapter released"
            className="text-gray-700 bg-opacity-70 bg-white rounded-md px-2 py-1 text-sm flex items-center gap-2"
          >
            <Clock /> {timeAgo.format(new Date(lastChapterReleasedAt))}
          </div>
        )}
        {spellingLevel > 0 && spellingLevel < 3 && <div>🙄</div>}

        {royalRoadId && (
          <a
            title="Royal road story"
            href={`https://www.royalroad.com/fiction/${royalRoadId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-6 h-6 text-xs text-gray-500"
          >
            <img src="/rr-192x192.png" alt="External Link" />
          </a>
        )}
      </div>
    </div>
  )
}

export default StoryCard
