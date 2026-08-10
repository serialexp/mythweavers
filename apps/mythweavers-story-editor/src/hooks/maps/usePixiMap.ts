import { Viewport } from 'pixi-viewport'
import * as PIXI from 'pixi.js'
import { Accessor, createSignal, onCleanup, onMount } from 'solid-js'
import { DIAGNOSTIC_GRID_LABEL, drawDiagnosticGrid } from '../../utils/maps/diagnosticGrid'
import { clearLandmarkTextureCache } from '../../utils/maps/landmarkRenderer'
import { MapError, describeError, readMaxTextureSize, setMaxTextureSize } from '../../utils/maps/mapDiagnostics'

export interface PixiContainers {
  /** Reference grid drawn beneath everything; see drawDiagnosticGrid. */
  grid: PIXI.Graphics | null
  voronoi: PIXI.Container | null
  hyperlane: PIXI.Container | null
  paths: PIXI.Container | null
  landmark: PIXI.Container | null
  fleet: PIXI.Container | null
  label: PIXI.Container | null
  preview: PIXI.Graphics | null
  brush: PIXI.Graphics | null
}

export interface PixiMapReturn {
  app: Accessor<PIXI.Application | null>
  viewport: Accessor<Viewport | null>
  containers: Accessor<PixiContainers>
  isReady: Accessor<boolean>
  /** Set when the renderer could not start. Null while healthy. */
  error: Accessor<MapError | null>
  initialize: () => Promise<void>
  render: () => void
}

/**
 * Hook to initialize and manage PIXI.js application and viewport
 * Handles creation of containers and resize events
 */
export function usePixiMap(containerRef: Accessor<HTMLDivElement | undefined>): PixiMapReturn {
  const [app, setApp] = createSignal<PIXI.Application | null>(null)
  const [viewport, setViewport] = createSignal<Viewport | null>(null)
  const [containers, setContainers] = createSignal<PixiContainers>({
    grid: null,
    voronoi: null,
    hyperlane: null,
    paths: null,
    landmark: null,
    fleet: null,
    label: null,
    preview: null,
    brush: null,
  })
  const [isReady, setIsReady] = createSignal(false)
  const [error, setError] = createSignal<MapError | null>(null)

  // Manual render function for immediate updates when needed
  const render = () => {
    const pixiApp = app()
    if (pixiApp) {
      pixiApp.render()
    }
  }

  /**
   * The canvas whose context-loss events we are listening to, kept so the
   * listeners can be removed *before* the app is destroyed. Pixi's own
   * `destroy()` calls `loseContext()`, which fires `webglcontextlost` -- without
   * this, tearing the panel down would raise an error card on the way out.
   */
  let watchedCanvas: HTMLCanvasElement | null = null

  /**
   * A lost context is the one map failure that happens *after* a successful
   * start: the driver reclaims the GPU (another app, a sleep/wake, or an
   * allocation it could not satisfy) and every subsequent frame draws nothing.
   * Pixi calls preventDefault on the event, which permits the browser to
   * restore the context, but it only re-requests one for losses it forced
   * itself -- so a real loss otherwise ends as a permanently blank rectangle
   * with a single console line as the only evidence.
   */
  const handleContextLost = () => {
    console.error('[usePixiMap] WebGL context lost')
    setError({
      title: 'The map lost its connection to the graphics card',
      detail:
        'The browser reclaimed the GPU while the map was open. This is most often caused by a very ' +
        'large map image, by the machine sleeping, or by another program demanding video memory. ' +
        'Close the map and open it again to rebuild it.',
    })
  }

  const handleContextRestored = () => {
    setError({
      title: 'The graphics card is available again',
      detail: 'Close the map and open it again to redraw it.',
    })
  }

  const watchContextLoss = (canvas: HTMLCanvasElement) => {
    watchedCanvas = canvas
    canvas.addEventListener('webglcontextlost', handleContextLost)
    canvas.addEventListener('webglcontextrestored', handleContextRestored)
  }

  const unwatchContextLoss = () => {
    watchedCanvas?.removeEventListener('webglcontextlost', handleContextLost)
    watchedCanvas?.removeEventListener('webglcontextrestored', handleContextRestored)
    watchedCanvas = null
  }

  // Exposed initialization function to be called from component
  const initialize = async () => {
    const container = containerRef()
    if (!container || app()) return

    setError(null)

    // Create Pixi application
    const pixiApp = new PIXI.Application()
    try {
      await pixiApp.init({
        width: container.clientWidth,
        height: container.clientHeight,
        backgroundColor: 0x1a1a1a,
        antialias: true,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
      })
    } catch (err) {
      // This call is made unawaited from an effect, so a rejection here used to
      // surface as nothing at all: an unhandled rejection and an empty canvas.
      // init() is also where "this browser has no WebGL at all" lands, so there
      // is no need for a separate capability probe ahead of it.
      console.error('[usePixiMap] Renderer init failed', err)
      setError({
        title: 'The map renderer could not start',
        detail: `${describeError(err)}. The map needs WebGL, so this is either a browser with it disabled or a driver refusing a new drawing surface. On mobile it also happens when too many pages are open, because the browser caps how many WebGL surfaces exist at once.`,
      })
      pixiApp.destroy(true)
      return
    }

    // Now that a real context exists, record what size texture it will accept.
    // useMapLoader refuses oversized maps up front, because the GPU drops those
    // uploads silently and draws an untextured black quad instead.
    setMaxTextureSize(readMaxTextureSize(pixiApp.renderer))

    // Add canvas to container
    container.appendChild(pixiApp.canvas as HTMLCanvasElement)
    watchContextLoss(pixiApp.canvas as HTMLCanvasElement)

    // Create viewport
    const vp = new Viewport({
      screenWidth: container.clientWidth,
      screenHeight: container.clientHeight,
      worldWidth: 2000,
      worldHeight: 2000,
      events: pixiApp.renderer.events,
    })

    // Add viewport to stage
    pixiApp.stage.addChild(vp as any)

    // Configure viewport interactions
    vp.drag().pinch().wheel().decelerate().clampZoom({
      minScale: 0.1,
      maxScale: 5,
    })

    // Additional render triggers for viewport changes (ensures smooth updates)
    const triggerRender = () => pixiApp.render()
    vp.on('moved-end', triggerRender)
    vp.on('zoomed-end', triggerRender)

    // Diagnostic grid, beneath every other layer. Sorting rather than insertion
    // order is deliberate: useMapLoader inserts the map with addChildAt(sprite,
    // 0), so anything relying on being added first would end up drawn on top of
    // the map instead of under it.
    vp.sortableChildren = true
    const gridGraphics = new PIXI.Graphics()
    gridGraphics.label = DIAGNOSTIC_GRID_LABEL
    gridGraphics.zIndex = -1000
    gridGraphics.eventMode = 'none'
    drawDiagnosticGrid(gridGraphics, vp.worldWidth, vp.worldHeight)
    vp.addChild(gridGraphics)

    // Create containers in proper render order
    const voronoiContainer = new PIXI.Container()
    vp.addChild(voronoiContainer)

    const hyperlaneContainer = new PIXI.Container()
    vp.addChild(hyperlaneContainer)

    const pathsContainer = new PIXI.Container()
    vp.addChild(pathsContainer)

    const landmarkContainer = new PIXI.Container()
    vp.addChild(landmarkContainer)

    const fleetContainer = new PIXI.Container()
    vp.addChild(fleetContainer)

    const labelContainer = new PIXI.Container()
    vp.addChild(labelContainer)

    const previewSprite = new PIXI.Graphics()
    previewSprite.visible = false
    previewSprite.eventMode = 'none' // Non-interactive so it doesn't block clicks
    vp.addChild(previewSprite)

    const brushSprite = new PIXI.Graphics()
    brushSprite.visible = false
    brushSprite.eventMode = 'none' // Non-interactive so it doesn't block clicks
    vp.addChild(brushSprite)

    // Store references
    setApp(pixiApp)
    setViewport(vp)
    setContainers({
      grid: gridGraphics,
      voronoi: voronoiContainer,
      hyperlane: hyperlaneContainer,
      paths: pathsContainer,
      landmark: landmarkContainer,
      fleet: fleetContainer,
      label: labelContainer,
      preview: previewSprite,
      brush: brushSprite,
    })
    setIsReady(true)

    // Initial render
    pixiApp.render()
  }

  // Handle resize
  const handleResize = () => {
    const pixiApp = app()
    const vp = viewport()
    const container = containerRef()

    if (pixiApp && container && vp) {
      pixiApp.renderer.resize(container.clientWidth, container.clientHeight)
      vp.resize(container.clientWidth, container.clientHeight)
      pixiApp.render()
    }
  }

  // Setup
  onMount(() => {
    window.addEventListener('resize', handleResize)
  })

  // Cleanup
  onCleanup(() => {
    window.removeEventListener('resize', handleResize)

    // Before destroy(), which loses the context deliberately.
    unwatchContextLoss()
    // The limit belongs to the renderer that is about to stop existing.
    setMaxTextureSize(null)

    // Clear landmark texture cache before destroying the app
    // (textures are tied to the renderer and become invalid when app is destroyed)
    clearLandmarkTextureCache()

    const pixiApp = app()
    if (pixiApp) {
      pixiApp.destroy(true)
      setApp(null)
    }
    setViewport(null)
    setContainers({
      grid: null,
      voronoi: null,
      hyperlane: null,
      paths: null,
      landmark: null,
      fleet: null,
      label: null,
      preview: null,
      brush: null,
    })
    setIsReady(false)
  })

  return {
    app,
    viewport,
    containers,
    isReady,
    error,
    initialize,
    render,
  }
}
