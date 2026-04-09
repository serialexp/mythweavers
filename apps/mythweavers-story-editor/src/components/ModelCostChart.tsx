import { Component, For, Show, createResource, createSignal } from "solid-js"
import { getMyBalanceUsageModelBreakdown } from "../client/config"

const COLORS = {
  input: "#60a5fa", // blue-400
  output: "#a78bfa", // violet-400
  cacheRead: "#34d399", // emerald-400
  cacheWrite: "#fbbf24", // amber-400
} as const

const LEGEND_ITEMS = [
  { key: "input" as const, label: "Input", color: COLORS.input },
  { key: "output" as const, label: "Output", color: COLORS.output },
  { key: "cacheRead" as const, label: "Cache Read", color: COLORS.cacheRead },
  { key: "cacheWrite" as const, label: "Cache Write", color: COLORS.cacheWrite },
]

function formatCost(n: number): string {
  if (n < 0.01) return `$${n.toFixed(4)}`
  return `$${n.toFixed(2)}`
}

/** Shorten model IDs for display — drop date suffixes like -20250514 */
function shortModelId(id: string): string {
  return id.replace(/-\d{8}$/, "")
}

const ModelCostChart: Component<{ since?: string }> = (props) => {
  const [data] = createResource(
    () => ({ since: props.since }),
    async (params) => {
      const query: Record<string, unknown> = {}
      if (params.since) {
        query.since = params.since
      }
      const { data } = await getMyBalanceUsageModelBreakdown({ query: query as any })
      return data ?? null
    },
  )

  const [hoveredSegment, setHoveredSegment] = createSignal<{
    model: string
    category: string
    cost: number
    x: number
    y: number
  } | null>(null)

  // Chart dimensions
  const marginLeft = 180
  const marginRight = 20
  const marginTop = 10
  const marginBottom = 20
  const barHeight = 28
  const barGap = 8
  const chartWidth = 700

  const models = () => data()?.models ?? []
  const svgHeight = () =>
    marginTop + models().length * (barHeight + barGap) - barGap + marginBottom
  const maxCost = () => {
    const max = Math.max(...models().map((m) => m.totalCost), 0)
    return max || 1 // avoid division by zero
  }
  const barAreaWidth = () => chartWidth - marginLeft - marginRight

  return (
    <div
      style={{
        "margin-bottom": "1.5rem",
        position: "relative",
      }}
    >
      <h3
        style={{
          "font-size": "0.8125rem",
          "font-weight": "600",
          color: "var(--text-muted, #9ca3af)",
          "text-transform": "uppercase",
          "letter-spacing": "0.5px",
          "margin-bottom": "0.5rem",
        }}
      >
        Cost by Model
      </h3>

      {/* Legend */}
      <div
        style={{
          display: "flex",
          gap: "1rem",
          "margin-bottom": "0.75rem",
          "flex-wrap": "wrap",
        }}
      >
        <For each={LEGEND_ITEMS}>
          {(item) => (
            <div
              style={{
                display: "flex",
                "align-items": "center",
                gap: "0.35rem",
                "font-size": "0.75rem",
                color: "var(--text-secondary, #d1d5db)",
              }}
            >
              <div
                style={{
                  width: "10px",
                  height: "10px",
                  "border-radius": "2px",
                  "background-color": item.color,
                  "flex-shrink": "0",
                }}
              />
              {item.label}
            </div>
          )}
        </For>
      </div>

      <Show when={!data.loading && models().length > 0}>
        <svg
          width={chartWidth}
          height={svgHeight()}
          viewBox={`0 0 ${chartWidth} ${svgHeight()}`}
          style={{ display: "block", "max-width": "100%", overflow: "visible" }}
        >
          <For each={models()}>
            {(model, i) => {
              const y = () => marginTop + i() * (barHeight + barGap)
              const scale = () => barAreaWidth() / maxCost()

              const inputW = () => model.inputCost * scale()
              const outputW = () => model.outputCost * scale()
              const cacheReadW = () => model.cacheReadCost * scale()
              const cacheWriteW = () => model.cacheWriteCost * scale()

              const inputX = () => marginLeft
              const outputX = () => inputX() + inputW()
              const cacheReadX = () => outputX() + outputW()
              const cacheWriteX = () => cacheReadX() + cacheReadW()

              const segments = () => [
                {
                  key: "Input",
                  x: inputX(),
                  w: inputW(),
                  color: COLORS.input,
                  cost: model.inputCost,
                },
                {
                  key: "Output",
                  x: outputX(),
                  w: outputW(),
                  color: COLORS.output,
                  cost: model.outputCost,
                },
                {
                  key: "Cache Read",
                  x: cacheReadX(),
                  w: cacheReadW(),
                  color: COLORS.cacheRead,
                  cost: model.cacheReadCost,
                },
                {
                  key: "Cache Write",
                  x: cacheWriteX(),
                  w: cacheWriteW(),
                  color: COLORS.cacheWrite,
                  cost: model.cacheWriteCost,
                },
              ]

              return (
                <g>
                  {/* Model label */}
                  <text
                    x={marginLeft - 8}
                    y={y() + barHeight / 2}
                    text-anchor="end"
                    dominant-baseline="central"
                    fill="var(--text-secondary, #d1d5db)"
                    font-size="11"
                    font-family="ui-monospace, monospace"
                  >
                    {shortModelId(model.modelId)}
                  </text>

                  {/* Stacked bar segments */}
                  <For each={segments()}>
                    {(seg) => (
                      <Show when={seg.w > 0.5}>
                        <rect
                          x={seg.x}
                          y={y()}
                          width={seg.w}
                          height={barHeight}
                          fill={seg.color}
                          rx="3"
                          ry="3"
                          style={{ cursor: "pointer", opacity: "0.85" }}
                          onMouseEnter={(e) => {
                            ;(e.currentTarget as SVGRectElement).style.opacity =
                              "1"
                            setHoveredSegment({
                              model: shortModelId(model.modelId),
                              category: seg.key,
                              cost: seg.cost,
                              x: seg.x + seg.w / 2,
                              y: y(),
                            })
                          }}
                          onMouseLeave={(e) => {
                            ;(e.currentTarget as SVGRectElement).style.opacity =
                              "0.85"
                            setHoveredSegment(null)
                          }}
                        />
                      </Show>
                    )}
                  </For>

                  {/* Total cost label at end of bar */}
                  <text
                    x={marginLeft + model.totalCost * (barAreaWidth() / maxCost()) + 6}
                    y={y() + barHeight / 2}
                    dominant-baseline="central"
                    fill="var(--text-muted, #9ca3af)"
                    font-size="10"
                    font-family="ui-monospace, monospace"
                  >
                    {formatCost(model.totalCost)} ({model.generationCount})
                  </text>
                </g>
              )
            }}
          </For>
        </svg>

        {/* Tooltip */}
        <Show when={hoveredSegment()}>
          {(seg) => (
            <div
              style={{
                position: "absolute",
                left: `${seg().x}px`,
                top: `${seg().y - 8}px`,
                transform: "translate(-50%, -100%)",
                background: "var(--bg-raised, #1f2937)",
                border: "1px solid var(--border-color, #374151)",
                "border-radius": "4px",
                padding: "4px 8px",
                "font-size": "0.6875rem",
                color: "var(--text-primary, #f3f4f6)",
                "white-space": "nowrap",
                "pointer-events": "none",
                "z-index": "10",
                "box-shadow": "0 2px 8px rgba(0,0,0,0.3)",
              }}
            >
              <strong>{seg().model}</strong> — {seg().category}:{" "}
              {formatCost(seg().cost)}
            </div>
          )}
        </Show>
      </Show>

      <Show when={data.loading}>
        <div
          style={{
            color: "var(--text-muted, #9ca3af)",
            "font-size": "0.8125rem",
            padding: "1rem 0",
          }}
        >
          Loading chart…
        </div>
      </Show>

      <Show when={!data.loading && models().length === 0}>
        <div
          style={{
            color: "var(--text-muted, #9ca3af)",
            "font-size": "0.8125rem",
            padding: "1rem 0",
          }}
        >
          No LLM usage data yet.
        </div>
      </Show>
    </div>
  )
}

export default ModelCostChart
