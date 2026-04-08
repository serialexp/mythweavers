import { Badge } from "@mythweavers/ui"

interface ProtocolBadgeProps {
  protocol: "ANTHROPIC" | "OPENAI_COMPATIBLE" | "CLOUDFLARE"
}

const LABELS: Record<string, string> = {
  ANTHROPIC: "Anthropic",
  OPENAI_COMPATIBLE: "OpenAI",
  CLOUDFLARE: "Cloudflare",
}

const VARIANTS: Record<string, "primary" | "secondary" | "info"> = {
  ANTHROPIC: "primary",
  OPENAI_COMPATIBLE: "secondary",
  CLOUDFLARE: "info",
}

export function ProtocolBadge(props: ProtocolBadgeProps) {
  return (
    <Badge
      variant={VARIANTS[props.protocol] ?? "secondary"}
      size="sm"
    >
      {LABELS[props.protocol] ?? props.protocol}
    </Badge>
  )
}
