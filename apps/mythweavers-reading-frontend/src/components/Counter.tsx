import { createSignal } from "solid-js";
import { Button } from "@mythweavers/ui";

export default function Counter() {
  const [count, setCount] = createSignal(0);
  return (
    <Button variant="secondary" onClick={() => setCount(count() + 1)}>
      Clicks: {count()}
    </Button>
  );
}
