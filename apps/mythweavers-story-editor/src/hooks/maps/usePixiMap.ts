import { Viewport } from 'pixi-viewport'
import * as PIXI from 'pixi.js'
import { Accessor, createSignal, onCleanup, onMount } from 'solid-js'
import { clearLandmarkTextureCache } from '../../utils/maps/landmarkRenderer'

export interface PixiContainers {
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

  // Manual render function for immediate updates when needed
  const render = () => {
    const pixiApp = app()
    if (pixiApp) {
      pixiApp.render()
    }
  }

  // Exposed initialization function to be called from component
  const initialize = async () => {
    const container = containerRef()
    if (!container || app()) return

    // Create Pixi application
    const pixiApp = new PIXI.Application()
    await pixiApp.init({
      width: container.clientWidth,
      height: container.clientHeight,
      backgroundColor: 0x1a1a1a,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    })

    // Add canvas to container
    container.appendChild(pixiApp.canvas as HTMLCanvasElement)

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
    initialize,
    render,
  }
}
