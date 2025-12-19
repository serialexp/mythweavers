# Writer MCP Server

A Model Context Protocol (MCP) server that provides tools for reading Writer project files and converting them to markdown format suitable for LLM consumption.

## Installation

From the monorepo root:

```bash
pnpm install
pnpm --filter @writer/mcp-server build
```

## Usage

### With Claude Desktop

Add the following to your Claude Desktop configuration (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "writer-files": {
      "command": "node",
      "args": ["/path/to/writer2/apps/mcp-server/dist/index.js"]
    }
  }
}
```

### Available Tools

1. **read_story** - Read story metadata and list all books
   - `projectPath`: Path to the writer project directory

2. **read_character** - Read a specific character's details
   - `projectPath`: Path to the writer project directory
   - `characterId`: ID of the character

3. **read_location** - Read a specific location's details
   - `projectPath`: Path to the writer project directory
   - `locationId`: ID of the location

4. **read_scene** - Read a scene with optional paragraph content
   - `projectPath`: Path to the writer project directory
   - `sceneId`: ID of the scene
   - `includeParagraphs`: Whether to include paragraph content (default: true)

5. **list_characters** - List all characters in the project
   - `projectPath`: Path to the writer project directory

6. **list_locations** - List all locations in the project
   - `projectPath`: Path to the writer project directory

7. **read_full_story** - Read the complete story structure as a tree view
   - `projectPath`: Path to the writer project directory
   - Shows hierarchy of books, arcs, chapters, and scenes with IDs
   - Indicates context nodes and non-story nodes

8. **search_story** - Search for content across the story
   - `projectPath`: Path to the writer project directory
   - `query`: Search query
   - `searchIn`: Array of content types to search (default: ["scenes", "characters", "locations", "plotPoints"])
     - Available types: "scenes", "characters", "locations", "plotPoints", "books", "arcs", "chapters"

9. **list_context_nodes** - List all context nodes in the story
   - `projectPath`: Path to the writer project directory
   - `includeContent`: Whether to include scene content (default: false)
   - Context nodes are marked with nodeType='context' and contain background information

10. **read_story_context** - Read all context nodes with their full content
    - `projectPath`: Path to the writer project directory
    - Returns all context nodes grouped by chapter with their content
    - Useful for understanding world-building and background details

11. **list_recent_stories** - List recently opened stories from the writer app
    - No parameters required
    - Reads from `~/.local/share/com.serial-experiments.writer/global-settings.bin`
    - Returns story names and their file paths
    - Indicates if a story file no longer exists at the saved location

## Development

```bash
# Run in development mode
pnpm --filter @writer/mcp-server dev

# Build for production
pnpm --filter @writer/mcp-server build
```

## File Structure

The MCP server expects Writer projects to follow this structure:

```
project-directory/
├── index.json          # Main story metadata
├── characters/         # Character JSON files
├── locations/          # Location JSON files
├── book/              # Book directories with JSON files
├── arc/               # Arc directories with JSON files
├── chapter/           # Chapter directories with JSON files
├── scene/             # Scene directories with JSON files and paragraphs
├── plotPoints/        # Plot point JSON files
└── languages/         # Language JSON files
```