import {
  type Component,
  Show,
  createEffect,
  createSignal,
  onMount,
} from 'solid-js'
import {
  calculateMinZoom,
  clampOffset,
  cropImage,
  getTouchCenter,
  getTouchDistance,
} from '../../utils/canvas'
import * as styles from './ImageCropper.css'

export interface ImageCropperRef {
  /** Get the cropped image as a base64 data URL */
  getCroppedImage: () => string
  /** Reset to initial zoom/position */
  reset: () => void
  /** Programmatically set zoom level */
  setZoom: (zoom: number) => void
}

export interface ImageCropperProps {
  /** Image source (base64 data URL, blob URL, or regular URL) */
  src: string
  /** Aspect ratio constraint (e.g., 1 for square, 16/9, null for freeform) */
  aspectRatio?: number | null
  /** Minimum zoom level (default: calculated to fit image) */
  minZoom?: number
  /** Maximum zoom level (default: 5) */
  maxZoom?: number
  /** Show zoom slider control (default: true) */
  showZoomSlider?: boolean
  /** Show circular crop area (default: false, shows rectangle) */
  circular?: boolean
  /** Output format (default: 'image/jpeg') */
  outputFormat?: 'image/jpeg' | 'image/png' | 'image/webp'
  /** Output quality for jpeg/webp (0-1, default: 0.9) */
  outputQuality?: number
  /** Output size in pixels (default: 256) */
  outputSize?: number
  /** Viewport width (default: 300) */
  width?: number
  /** Viewport height (default: 300, or calculated from width + aspectRatio) */
  height?: number
  /** Component class */
  class?: string
  /** Ref to get component methods */
  ref?: (ref: ImageCropperRef) => void
}

export const ImageCropper: Component<ImageCropperProps> = (props) => {
  const aspectRatio = () => props.aspectRatio ?? 1
  const maxZoom = () => props.maxZoom ?? 5
  const showZoomSlider = () => props.showZoomSlider ?? true
  const circular = () => props.circular ?? false
  const outputFormat = () => props.outputFormat ?? 'image/jpeg'
  const outputQuality = () => props.outputQuality ?? 0.9
  const outputSize = () => props.outputSize ?? 256
  const viewportWidth = () => props.width ?? 300
  const viewportHeight = () => {
    if (props.height !== undefined) return props.height
    if (aspectRatio() !== null) return viewportWidth() / aspectRatio()!
    return viewportWidth()
  }

  const [imageLoaded, setImageLoaded] = createSignal(false)
  const [imageSize, setImageSize] = createSignal({ width: 0, height: 0 })
  const [zoom, setZoom] = createSignal(1)
  const [offset, setOffset] = createSignal({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = createSignal(false)
  const [dragStart, setDragStart] = createSignal({ x: 0, y: 0, offsetX: 0, offsetY: 0 })

  // Touch state for pinch zoom
  const [lastTouchDistance, setLastTouchDistance] = createSignal<number | null>(null)
  const [lastTouchCenter, setLastTouchCenter] = createSignal<{ x: number; y: number } | null>(null)

  let containerRef: HTMLDivElement | undefined
  let imageRef: HTMLImageElement | undefined

  // Calculate minimum zoom to cover the viewport
  const minZoom = () => {
    if (props.minZoom !== undefined) return props.minZoom
    const { width, height } = imageSize()
    if (width === 0 || height === 0) return 1
    return calculateMinZoom(width, height, viewportWidth(), viewportHeight())
  }

  // Load image and get dimensions
  createEffect(() => {
    const src = props.src
    if (!src) return

    const img = new Image()
    img.onload = () => {
      setImageSize({ width: img.naturalWidth, height: img.naturalHeight })
      // Set initial zoom to fit
      const initialZoom = calculateMinZoom(
        img.naturalWidth,
        img.naturalHeight,
        viewportWidth(),
        viewportHeight()
      )
      setZoom(initialZoom)
      setOffset({ x: 0, y: 0 })
      setImageLoaded(true)
    }
    img.src = src
  })

  // Clamp offset when zoom changes
  createEffect(() => {
    const currentZoom = zoom()
    const { width, height } = imageSize()
    if (width === 0 || height === 0) return

    const clamped = clampOffset(
      offset(),
      width,
      height,
      viewportWidth(),
      viewportHeight(),
      currentZoom
    )
    if (clamped.x !== offset().x || clamped.y !== offset().y) {
      setOffset(clamped)
    }
  })

  // Pointer event handlers
  const handlePointerDown = (e: PointerEvent) => {
    if (e.pointerType === 'touch') return // Handle touch separately
    e.preventDefault()
    setIsDragging(true)
    setDragStart({
      x: e.clientX,
      y: e.clientY,
      offsetX: offset().x,
      offsetY: offset().y,
    })
    containerRef?.setPointerCapture(e.pointerId)
  }

  const handlePointerMove = (e: PointerEvent) => {
    if (!isDragging() || e.pointerType === 'touch') return
    e.preventDefault()

    const { x, y, offsetX, offsetY } = dragStart()
    const newOffset = {
      x: offsetX + (e.clientX - x),
      y: offsetY + (e.clientY - y),
    }

    const clamped = clampOffset(
      newOffset,
      imageSize().width,
      imageSize().height,
      viewportWidth(),
      viewportHeight(),
      zoom()
    )
    setOffset(clamped)
  }

  const handlePointerUp = (e: PointerEvent) => {
    if (e.pointerType === 'touch') return
    setIsDragging(false)
    containerRef?.releasePointerCapture(e.pointerId)
  }

  // Wheel zoom
  const handleWheel = (e: WheelEvent) => {
    e.preventDefault()

    const rect = containerRef?.getBoundingClientRect()
    if (!rect) return

    // Get mouse position relative to container center
    const mouseX = e.clientX - rect.left - viewportWidth() / 2
    const mouseY = e.clientY - rect.top - viewportHeight() / 2

    // Calculate new zoom
    const zoomDelta = e.deltaY > 0 ? 0.9 : 1.1
    const newZoom = Math.max(minZoom(), Math.min(maxZoom(), zoom() * zoomDelta))
    const zoomRatio = newZoom / zoom()

    // Adjust offset to zoom toward mouse position
    const newOffset = {
      x: mouseX - (mouseX - offset().x) * zoomRatio,
      y: mouseY - (mouseY - offset().y) * zoomRatio,
    }

    const clamped = clampOffset(
      newOffset,
      imageSize().width,
      imageSize().height,
      viewportWidth(),
      viewportHeight(),
      newZoom
    )

    setZoom(newZoom)
    setOffset(clamped)
  }

  // Touch handlers for pinch zoom
  const handleTouchStart = (e: TouchEvent) => {
    if (e.touches.length === 2) {
      e.preventDefault()
      const distance = getTouchDistance(e.touches[0], e.touches[1])
      const center = getTouchCenter(e.touches[0], e.touches[1])
      setLastTouchDistance(distance)
      setLastTouchCenter(center)
    } else if (e.touches.length === 1) {
      setIsDragging(true)
      setDragStart({
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        offsetX: offset().x,
        offsetY: offset().y,
      })
    }
  }

  const handleTouchMove = (e: TouchEvent) => {
    if (e.touches.length === 2) {
      e.preventDefault()
      const distance = getTouchDistance(e.touches[0], e.touches[1])
      const center = getTouchCenter(e.touches[0], e.touches[1])

      const lastDist = lastTouchDistance()
      const lastCenter = lastTouchCenter()

      if (lastDist !== null && lastCenter !== null) {
        const rect = containerRef?.getBoundingClientRect()
        if (!rect) return

        // Calculate zoom change
        const scale = distance / lastDist
        const newZoom = Math.max(minZoom(), Math.min(maxZoom(), zoom() * scale))
        const zoomRatio = newZoom / zoom()

        // Get center relative to container center
        const centerX = center.x - rect.left - viewportWidth() / 2
        const centerY = center.y - rect.top - viewportHeight() / 2

        // Pan by the center movement
        const panX = center.x - lastCenter.x
        const panY = center.y - lastCenter.y

        // Adjust offset for both zoom and pan
        const newOffset = {
          x: centerX - (centerX - offset().x) * zoomRatio + panX,
          y: centerY - (centerY - offset().y) * zoomRatio + panY,
        }

        const clamped = clampOffset(
          newOffset,
          imageSize().width,
          imageSize().height,
          viewportWidth(),
          viewportHeight(),
          newZoom
        )

        setZoom(newZoom)
        setOffset(clamped)
      }

      setLastTouchDistance(distance)
      setLastTouchCenter(center)
    } else if (e.touches.length === 1 && isDragging()) {
      const touch = e.touches[0]
      const { x, y, offsetX, offsetY } = dragStart()
      const newOffset = {
        x: offsetX + (touch.clientX - x),
        y: offsetY + (touch.clientY - y),
      }

      const clamped = clampOffset(
        newOffset,
        imageSize().width,
        imageSize().height,
        viewportWidth(),
        viewportHeight(),
        zoom()
      )
      setOffset(clamped)
    }
  }

  const handleTouchEnd = (e: TouchEvent) => {
    if (e.touches.length < 2) {
      setLastTouchDistance(null)
      setLastTouchCenter(null)
    }
    if (e.touches.length === 0) {
      setIsDragging(false)
    }
  }

  // Calculate image transform
  const imageTransform = () => {
    const { width, height } = imageSize()
    const z = zoom()
    const { x, y } = offset()

    // Position image centered in viewport, then apply offset
    const translateX = (viewportWidth() - width * z) / 2 + x
    const translateY = (viewportHeight() - height * z) / 2 + y

    return `translate(${translateX}px, ${translateY}px) scale(${z})`
  }

  // Crop area dimensions
  const cropAreaSize = () => {
    const ar = aspectRatio()
    if (ar === null) {
      return { width: viewportWidth(), height: viewportHeight() }
    }
    // Fit the crop area within the viewport maintaining aspect ratio
    const vw = viewportWidth()
    const vh = viewportHeight()
    if (vw / vh > ar) {
      return { width: vh * ar, height: vh }
    }
    return { width: vw, height: vw / ar }
  }

  // Get cropped image
  const getCroppedImage = (): string => {
    if (!imageRef || !imageLoaded()) {
      throw new Error('Image not loaded')
    }

    const { width, height } = cropAreaSize()
    const ar = aspectRatio()
    const outWidth = outputSize()
    const outHeight = ar !== null ? outWidth / ar : outWidth * (height / width)

    return cropImage({
      image: imageRef,
      zoom: zoom(),
      offset: offset(),
      viewportWidth: width,
      viewportHeight: height,
      outputWidth: outWidth,
      outputHeight: outHeight,
      format: outputFormat(),
      quality: outputQuality(),
    })
  }

  // Reset to initial state
  const reset = () => {
    const { width, height } = imageSize()
    if (width === 0 || height === 0) return

    const initialZoom = calculateMinZoom(width, height, viewportWidth(), viewportHeight())
    setZoom(initialZoom)
    setOffset({ x: 0, y: 0 })
  }

  // Slider change handler
  const handleSliderChange = (e: Event) => {
    const value = Number.parseFloat((e.target as HTMLInputElement).value)
    const newZoom = minZoom() + (value / 100) * (maxZoom() - minZoom())

    // Zoom toward center
    const zoomRatio = newZoom / zoom()
    const newOffset = {
      x: offset().x * zoomRatio,
      y: offset().y * zoomRatio,
    }

    const clamped = clampOffset(
      newOffset,
      imageSize().width,
      imageSize().height,
      viewportWidth(),
      viewportHeight(),
      newZoom
    )

    setZoom(newZoom)
    setOffset(clamped)
  }

  // Zoom button handlers
  const zoomIn = () => {
    const newZoom = Math.min(maxZoom(), zoom() * 1.2)
    const zoomRatio = newZoom / zoom()
    const newOffset = {
      x: offset().x * zoomRatio,
      y: offset().y * zoomRatio,
    }
    const clamped = clampOffset(
      newOffset,
      imageSize().width,
      imageSize().height,
      viewportWidth(),
      viewportHeight(),
      newZoom
    )
    setZoom(newZoom)
    setOffset(clamped)
  }

  const zoomOut = () => {
    const newZoom = Math.max(minZoom(), zoom() / 1.2)
    const zoomRatio = newZoom / zoom()
    const newOffset = {
      x: offset().x * zoomRatio,
      y: offset().y * zoomRatio,
    }
    const clamped = clampOffset(
      newOffset,
      imageSize().width,
      imageSize().height,
      viewportWidth(),
      viewportHeight(),
      newZoom
    )
    setZoom(newZoom)
    setOffset(clamped)
  }

  // Slider value (0-100)
  const sliderValue = () => {
    const min = minZoom()
    const max = maxZoom()
    return ((zoom() - min) / (max - min)) * 100
  }

  // Expose ref methods
  onMount(() => {
    props.ref?.({
      getCroppedImage,
      reset,
      setZoom: (z: number) => {
        const newZoom = Math.max(minZoom(), Math.min(maxZoom(), z))
        setZoom(newZoom)
      },
    })
  })

  return (
    <div
      ref={containerRef}
      class={`${styles.container} ${props.class ?? ''}`}
      style={{
        width: `${viewportWidth()}px`,
        height: `${viewportHeight()}px`,
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onWheel={handleWheel}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <Show when={imageLoaded()}>
        <img
          ref={imageRef}
          src={props.src}
          alt=""
          class={styles.imageLayer}
          style={{ transform: imageTransform() }}
          draggable={false}
        />
      </Show>

      {/* Crop area overlay */}
      <Show when={circular()}>
        <div
          class={styles.cropAreaCircle}
          style={{
            width: `${cropAreaSize().width}px`,
            height: `${cropAreaSize().height}px`,
          }}
        />
      </Show>
      <Show when={!circular()}>
        <div
          class={styles.cropAreaRect}
          style={{
            width: `${cropAreaSize().width}px`,
            height: `${cropAreaSize().height}px`,
          }}
        />
      </Show>

      {/* Zoom controls */}
      <Show when={showZoomSlider()}>
        <div class={styles.controls}>
          <button
            type="button"
            class={styles.zoomButton}
            onClick={zoomOut}
            disabled={zoom() <= minZoom()}
            aria-label="Zoom out"
          >
            -
          </button>
          <input
            type="range"
            class={styles.slider}
            min={0}
            max={100}
            value={sliderValue()}
            onInput={handleSliderChange}
            aria-label="Zoom level"
          />
          <button
            type="button"
            class={styles.zoomButton}
            onClick={zoomIn}
            disabled={zoom() >= maxZoom()}
            aria-label="Zoom in"
          >
            +
          </button>
          <span class={styles.zoomLabel}>{Math.round(zoom() * 100)}%</span>
        </div>
      </Show>
    </div>
  )
}
