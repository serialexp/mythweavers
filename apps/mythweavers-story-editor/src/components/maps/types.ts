/**
 * Shared type definitions for map components
 */

export interface TimelineMessageInfo {
  position: string
  chapter: string
  preview: string
}

export type OverlayMethod = 'voronoi' | 'metaball' | 'blurred' | 'noise'

export interface PopupPosition {
  x: number
  y: number
}

export interface QuickColor {
  name: string
  hex: string
}
