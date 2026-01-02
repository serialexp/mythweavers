# Project-Specific Instructions for Claude

## Package Manager

- Use pnpm instead of npm for all package management commands
- For example: `pnpm install`, `pnpm run dev`, `pnpm add <package>`

## Type Checking

- Always run `pnpm run tsc` or `pnpm run typecheck` to check for TypeScript errors before committing changes
- Both commands do the same thing (tsc --noEmit)
- Fix any type errors that are found

## CSS Organization

- Use CSS modules instead of a single large App.css file
- Each component should have its own `.module.css` file (e.g., `AutoSaveIndicator.module.css`)
- Import styles as: `import styles from './ComponentName.module.css'`
- Use `class={styles.className}` instead of `class="className"`
- This keeps styles scoped to components and prevents the main CSS file from becoming too large

## CSS Variables

- Always use the predefined CSS variables for consistent theming
- The full list of CSS variables is defined in `src/styles/variables.css`
- Common variable patterns:
  - Background colors: `--bg-primary`, `--bg-secondary`, `--bg-tertiary`
  - Text colors: `--text-primary`, `--text-secondary`, `--text-muted`
  - Border: `--border-color`, `--border-hover`
  - Shadows: `--shadow-sm`, `--shadow-md`, `--shadow-lg`
  - Spacing: `--spacing-xs`, `--spacing-sm`, `--spacing-md`, `--spacing-lg`, `--spacing-xl`
  - Border radius: `--radius-sm`, `--radius-md`, `--radius-lg`
  - Transitions: `--transition-fast`, `--transition-base`, `--transition-slow`
  - Accent/theme colors: `--primary-color`, `--secondary-color`, `--success-color`, `--warning-color`, `--danger-color`
- These variables automatically adjust for dark mode via media queries
- Never use hardcoded colors or create new color variables without checking existing ones first

## ID Generation

- Always use the `generateMessageId()` function from `src/utils/id.ts` for generating IDs
- This applies to ALL entity IDs: messages, chapters, characters, context items, etc.
- Never create custom ID patterns like `ch_${Date.now()}_${Math.random()}`
- The generateMessageId function uses the @paralleldrive/cuid2 library which creates DOM-safe, unique IDs
- Import it as: `import { generateMessageId } from '../utils/id'`

## Other Project Guidelines

- When modifying the story generation, always test with both Anthropic and OpenRouter providers
- Cache functionality is critical - ensure cache control points are properly set
- Auto-save to server happens automatically - no need for explicit save buttons
- Story names are generated automatically from the first turn content

## Development Guidelines

- Do not, under any circumstances, run the dev server yourself. Always ask the user to do so.

## Docker Deployment

- To build and push Docker images, use: `npm run docker:build-push` (from the root directory)
- This builds both frontend and backend images and pushes them to Docker Hub
- Individual commands available:
  - `npm run docker:build` - Build both images
  - `npm run docker:push` - Push both images
  - `npm run docker:build:backend` - Build backend only
  - `npm run docker:build:frontend` - Build frontend only
  - `npm run docker:push:backend` - Push backend only
  - `npm run docker:push:frontend` - Push frontend only

## Server Endpoints

- Always use the prisma client in lib/prisma for server endpoints
- When creating a new server endpoint, be sure to add it to a new file
- Please, for the love of god, stop importing everything dynamically.

## API Client (Important!)

- **ALWAYS** use the generated SDK from `src/client/config.ts` for API calls
- The SDK is auto-generated from the backend OpenAPI spec using `pnpm generate:client`
- **NEVER** write manual fetch calls to the backend - use the generated functions instead
- Import functions from `../client/config` (this re-exports the configured SDK)

**Example - Correct:**
```typescript
import { postMyStoriesByStoryIdMessagesReorder } from '../client/config'

const { data } = await postMyStoriesByStoryIdMessagesReorder({
  path: { storyId },
  body: { items },
})
```

**Example - Wrong (don't do this):**
```typescript
// DON'T manually call fetch - use the SDK instead
const response = await fetch(`${baseUrl}/my/stories/${storyId}/messages/reorder`, {
  method: 'POST',
  body: JSON.stringify({ items }),
})
```

**Regenerating the API Client:**

The backend dev server is almost always running with hot reload, so you can regenerate the client anytime after making backend changes:

```bash
cd /home/bart/Projects/writer2/apps/mythweavers-story-editor
pnpm generate:client
```

**When to regenerate:**
- After adding new backend endpoints
- After modifying request/response schemas (adding fields, changing types)
- When you get TypeScript errors about missing properties on API calls
- The backend must be running on port 3201 for this to work

**When adding new backend endpoints:**
1. Add the endpoint to the backend (it hot-reloads automatically)
2. Regenerate the SDK: `pnpm generate:client`
3. Import and use the new generated function

## Saving Data (Important!)

- **ALWAYS** use saveService for persisting any data, regardless of storage mode (local or server)
- Never check `storageMode` before calling saveService methods - the service handles this internally
- The saveService automatically:
  - For server mode: Queues the save operation to be sent to the backend
  - For local mode: Triggers a full local save
- Example: When saving a node, always call `saveService.saveNode()` without checking storage mode
- All saves go through the saveService queue system - never bypass it

## SolidJS Store Gotchas

### Replacing Entire Objects in Stores

When you need to replace an entire nested object in a SolidJS store (e.g., clearing and setting new values):

**WRONG** - This will merge keys instead of replacing:
```typescript
setStore('myObject', newObject)  // Keeps old keys, merges new ones
```

**CORRECT** - Use `reconcile` to replace the entire object:
```typescript
import { reconcile } from 'solid-js/store'
setStore('myObject', reconcile(newObject))  // Replaces entire object
```

**Why?** SolidJS stores use fine-grained reactivity with proxies. By default, `setStore` only updates changed keys for performance (merge behavior). When you need to completely replace an object (e.g., clearing old keys), use `reconcile()` which does a proper diff and replaces the whole structure while maintaining optimal reactivity.

**Common case:** Filtering/accumulating data where the result might have fewer keys than before:
```typescript
// Accumulating states for a specific timeline position
const accumulated = {}  // Might be empty or have fewer keys than before
setStore('accumulatedStates', reconcile(accumulated))  // ✓ Clears old keys
```

### Unwrapping Store Proxies for Debugging

When logging store values, use `unwrap()` to see the actual data instead of proxy objects:
```typescript
import { unwrap } from 'solid-js/store'
console.log('Store value:', unwrap(statesStore.myObject))
```

### Reactivity in For Loop Callbacks (CRITICAL!)

When using constants in `<For>` loop callbacks, they are computed ONCE and never update, breaking reactivity:

**WRONG** - Constants break reactivity:
```typescript
<For each={items}>
  {(item) => {
    const isSelected = props.selectedId() === item.id;  // ❌ Computed once, never updates!
    return <div class={isSelected ? 'selected' : ''}>{item.name}</div>
  }}
</For>
```

**CORRECT** - Use functions to preserve reactivity:
```typescript
<For each={items}>
  {(item) => {
    const isSelected = () => props.selectedId() === item.id;  // ✓ Re-computed on every access
    return <div class={isSelected() ? 'selected' : ''}>{item.name}</div>
  }}
</For>
```

**Why?** In SolidJS, the For loop's child function runs once per item. Constants computed inside are captured at that moment and never re-evaluated, even if the underlying signals change. By using functions (`() => ...`), you create derived signals that re-compute on every access in the JSX, preserving reactivity.

**Symptoms:** You see console logs showing the signal updating, but the UI doesn't change. The memo runs, but buttons don't highlight, classes don't apply, etc.

**Rule of thumb:** In `<For>` callbacks, if you're deriving a value from props or signals and using it in JSX, make it a function!

## Story CLI Usage

The story CLI (`backend/src/cli/index.ts`) provides programmatic access to story data. Run commands from the `backend` directory or use `pnpm run cli` from anywhere in the project.

### Quick Start

All CLI commands follow this pattern:
```bash
pnpm run cli <command> <arguments> [options]
```

### Common Command Categories

#### Stories
- `stories:list` - List all stories with their IDs and names

#### Nodes (Books, Arcs, Chapters)
- `nodes:list <storyId>` - Display the complete chapter tree, don't filter this.
  - `--with-word-counts` - Include word count statistics
- `nodes:create <storyId> <type> <title>` - Create a new node
  - Types: `book`, `arc`, `chapter`
  - For arcs/chapters, use `--parent <nodeId>` to specify parent
- `nodes:update <storyId> <nodeId>` - Update node properties
  - `--title`, `--summary`, `--status`, `--order`
  - `--expanded <true|false>` - Collapse/expand in UI
  - `--story-time <minutes>` - Set timeline position (minutes from 0 BBY; negative = BBY, positive = ABY)
  - `--viewpoint <characterId>` - Set POV character
  - `--active-characters <id...>` - Characters present in this node
  - `--active-context <id...>` - Context items active in this node
- `nodes:delete <storyId> <nodeId>` - Delete a node and descendants

#### Messages
- `messages:list <storyId> <nodeIds>` - Display message IDs grouped by comma-separated node IDs
- `nodes:read <storyId> <nodeId>` - Print message content for a single node ID, NEVER FILTER THIS OUTPUT. You'll end up with half the content. To read multiple nodes, call this command multiple times.
  - `--include-deleted` - Include soft-deleted messages
  - `--summary` - Print stored summaries instead of full content
  - `--page <number>` - Page number for long chapters (automatically paginates at ~10,000 words per page)
- `messages:read <storyId> <messageId>` - Read the content of a single message (useful for checking before replacements)
- `messages:create <storyId> <nodeId>` - Add a new message
  - `--content <text>` - Message text (required)
  - `--content @file:<path>` - Read message from file
  - Pipe via stdin if no content specified
  - `--role <role>` - Message role (default: "assistant")
  - `--after <messageId>` - Insert after specific message
- `messages:update <storyId> <messageId>` - Update message content, use if you need to make a large change.
  - `--content <text>` - New content (supports @file: and stdin)
  - `--instruction <text>` - Update instructions
  - `--node <nodeId>` - Move message to different node
- `messages:delete <storyId> <messageId>` - Soft-delete a message
- `messages:replace <storyId> <messageId>` - Replace text within message, prefer this for smaller corrections.
  - `--search <text>` - Text to find (required)
  - `--replace <text>` - Replacement text (required)
  - `--expected <count>` - Assert number of replacements
- **When drafting new story content:** Always pause and ask the user how they want the update handled (tone, POV, placement, constraints, etc.). Confirm they agree with the plan **before** writing any message text. Only once alignment is explicit should you create or update the message content.

#### Maps
- `maps:list <storyId>` - List maps available for a story
- `maps:travel-time <storyId> <mapId> <fromLandmarkName> <toLandmarkName>` - Estimate travel time between two landmarks
  - `--hyperdrive <rating>` - Override hyperdrive rating (default: 1)
- `maps:landmarks <storyId> <mapId>` - List landmarks for a map (supports regex filtering)
  - `--search <pattern>` - Case-insensitive regex applied to name/description
- `story:time-display <storyTime>` - Convert a raw storyTime (minutes from 0 BBY) into a formatted Coruscant calendar date
  - `--json` - Emit the full structured breakdown instead of just the formatted string

#### Message Search
- `messages:search <storyId>` - Search messages. Use the provided filter parameters, don't try filtering with cli tools.
  - `--query <pattern>` - Regex pattern (required)
  - `--node <nodeId>` - Limit to specific chapter
  - `--context <count>` - Show N surrounding sentences
  - `--max-results <count>` - Maximum results to show
  - `--deleted` - Search only soft-deleted messages

**Semantic Search (embedding-based):**
- `messages:search <storyId> --semantic` - Search by meaning, not regex, don't try filtering with cli tools.
  - `--query <text>` - Search text
  - `--limit <count>` - Max results (default: 10)
  - `--min-score <0-1>` - Cosine similarity threshold
  - `--context <count>` - Paragraphs of context to show

#### Embeddings
- `embeddings:rebuild` - Rebuild paragraph embeddings for semantic search
  - `--story <storyId>` - Rebuild only for one story
  - `--force` - Regenerate even if cached data is current
  - `--progress-interval <count>` - Progress reporting frequency

#### Characters
- `characters:list <storyId>` - List all characters in a story
- `characters:at <storyId> <messageId>` - Evaluate which characters are active at a message

### Best Practices

**Getting story IDs:**
```bash
pnpm run cli stories:list  # See all story IDs and names
```

**Exploring structure:**
```bash
pnpm run cli nodes:list <storyId>  # View full chapter tree
pnpm run cli nodes:list <storyId> --with-word-counts  # Include stats
```

**Listing message IDs:**
```bash
pnpm run cli messages:list <storyId> <nodeId>  # Show message IDs for one node
pnpm run cli messages:list <storyId> nodeA,nodeB  # Show IDs grouped by node
```

**Reading context first (no truncation!):**
```bash
pnpm run cli context-items:read <storyId>  # Always read full context before anything else
```

Never pipe, `grep`, `head`, or `tail` the initial output of `context-items:read` or `nodes:read`; you must review the entire content on first pass. If you need a shorter version of node content, use the built-in summaries:
```bash
pnpm run cli nodes:read <storyId> <nodeId> --summary
```

**Reading content:**
```bash
pnpm run cli nodes:read <storyId> <nodeId>  # Print headers + content for one node
pnpm run cli nodes:read <storyId> <nodeId> --summary  # Use stored summaries (paragraph/summary fallback)

# For long chapters (>10k words), use pagination
pnpm run cli nodes:read <storyId> <nodeId> --page 1
pnpm run cli nodes:read <storyId> <nodeId> --page 2

# To read multiple nodes, call the command multiple times (one node at a time)
pnpm run cli nodes:read <storyId> nodeA
pnpm run cli nodes:read <storyId> nodeB

# Read a single message (useful for checking before replacements)
pnpm run cli messages:read <storyId> <messageId>
```

**Travel times:**
```bash
pnpm run cli maps:travel-time <storyId> <mapId> <fromLandmarkName> <toLandmarkName>
pnpm run cli maps:travel-time <storyId> <mapId> <fromLandmarkName> <toLandmarkName> --hyperdrive 0.75
```

**Landmarks:**
```bash
pnpm run cli maps:list <storyId>
pnpm run cli maps:landmarks <storyId> <mapId>
pnpm run cli maps:landmarks <storyId> <mapId> --search "(?i)coruscant|naboo"
```

**Bulk operations with files:**
```bash
# Create message from file
pnpm run cli messages:create <storyId> <nodeId> --content @file:message.txt

# Update message from file
pnpm run cli messages:update <storyId> <messageId> --content @file:new-content.txt

# Or pipe via stdin
cat message.txt | pnpm run cli messages:create <storyId> <nodeId>
```

**Searching content:**
```bash
# Find specific text (regex supported)
pnpm run cli messages:search <storyId> --query "pattern" --max-results 5

# Search semantic meaning (faster for concept searches)
pnpm run cli messages:search <storyId> --semantic --query "theme or concept"

# Show context around matches
pnpm run cli messages:search <storyId> --query "pattern" --context 3
```

**Finding characters:**
```bash
# List all characters
pnpm run cli characters:list <storyId>

# Find characters active at specific message
pnpm run cli characters:at <storyId> <messageId>
```

### Output Formats

- JSON output: All commands default to JSON (when not using `--summary-only` etc)
- Tree output: `nodes:list` displays a formatted tree structure
- Message tree: `messages:list` shows node headers and message IDs
- Table output: `stories:list` displays as markdown table
- Message output: `nodes:read` prints raw message content without extra formatting

### Tips

1. **Message IDs are immutable** - Use `messages:list` to locate IDs and `nodes:read` to review content
2. **Soft deletes** - Deleted content is still in database; use `--include-deleted` to see it
3. **Order matters** - `--order` controls position within parent (lower = earlier in tree)
4. **Timeline alignment** - `--story-time` positions nodes on story's timeline (in minutes)
5. **Embeddings require rebuild** - After adding messages, run `embeddings:rebuild` before semantic search
6. **Long chapters need pagination** - Chapters over ~10,000 words are automatically paginated. The command will show "Page 1 of N" and suggest using `--page 2`, `--page 3`, etc. Each message stays intact across page boundaries.
