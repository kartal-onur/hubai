# Theming and "adapt to any UI"

The shipped `<HubAIChat>` is styled with CSS custom properties and inline styles,
so it renders correctly without any CSS import and adapts to any design system
through three layers of override.

## 1. CSS variables

Set these on `<HubAIChat>` (via `style`) or any ancestor:

| Variable | Default | Purpose |
|----------|---------|---------|
| `--hubai-bg` | `#ffffff` | Panel background |
| `--hubai-fg` | `#0a0a0a` | Foreground text |
| `--hubai-border` | `rgba(0,0,0,0.08)` | Borders |
| `--hubai-header-bg` / `--hubai-header-fg` | `#0a0a0a` / `#fafafa` | Header |
| `--hubai-user-bg` / `--hubai-user-fg` | `#0a0a0a` / `#fafafa` | User bubble + buttons |
| `--hubai-assistant-bg` / `--hubai-assistant-fg` | `#f4f4f5` / `#0a0a0a` | Assistant bubble + chips |
| `--hubai-muted-fg` | `#71717a` | Secondary text |
| `--hubai-accent` | `#ff3b30` | Stop button, error |
| `--hubai-radius` | `16px` | Bubble radius |
| `--hubai-width` | `420px` | Panel width |
| `--hubai-font` | `inherit` | Font family |

```tsx
<HubAIChat style={{
  ["--hubai-accent" as string]: "#7c3aed",
  ["--hubai-width" as string]: "480px",
}} {...rest} />
```

## 2. Per-slot classNames

Override any slot with your own classes (Tailwind, CSS modules, anything):

```tsx
<HubAIChat classNames={{
  root: "my-panel",
  header: "my-header",
  userBubble: "my-user-bubble",
  linkButton: "my-link-btn",
  input: "my-input",
}} {...rest} />
```

Slots: `root`, `header`, `title`, `messages`, `messageRow`, `userBubble`,
`assistantBubble`, `toolChip`, `linkButton`, `inputArea`, `input`, `sendButton`,
`stopButton`, `closeButton`, `clearButton`.

## 3. Icons and copy

Swap icons (e.g. pass lucide components) and inject every string:

```tsx
import { Sparkles, Send, X } from "lucide-react";

<HubAIChat
  icons={{ sparkles: Sparkles, send: Send, close: X }}
  labels={{ title: "Asistan", inputPlaceholder: "Bir sey sor...", defaultLinkLabel: "Ac" }}
  toolLabels={{ create_task: "Gorev olusturuluyor" }}
  {...rest}
/>
```

Icons are plain components taking `{ className?, size? }`. Defaults are inline
SVGs, so no icon library is required.

## Optional stylesheet

Import once for the slide-in animation, spinner, scrollbar, and hover states:

```ts
import "@kartal-onur/hubai/styles.css";
```

Everything works without it; you only lose the animations and hover affordances.

## Full control: build your own UI

When the panel is not enough, use the headless hook and render anything:

```tsx
const { messages, isStreaming, send, stop, clear } = useHubAI({
  endpoint: "/api/ai/chat",
  onRefresh: () => router.refresh(),
  onLink: (link) => router.push(link.href),
});
```

`messages` carry `content`, `toolActions`, and `links`. The SSE contract is the
real interface, so a non-React host can reimplement the client in a few dozen
lines over the same protocol.
