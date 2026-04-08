import { Badge } from "@mythweavers/ui"

interface ProtocolBadgeProps {
  protocol: "ANTHROPIC" | "OPENAI_COMPATIBLE"
}

export function ProtocolBadge(props: ProtocolBadgeProps) {
  return (
    <Badge
      variant={props.protocol === "ANTHROPIC" ? "primary" : "secondary"}
      size="sm"
    >
      {props.protocol === "ANTHROPIC" ? "Anthropic" : "OpenAI Compatible"}
    </Badge>
  )
}
