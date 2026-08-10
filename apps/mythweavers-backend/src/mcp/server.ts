/**
 * MCP server construction.
 *
 * One server instance per request, in stateless mode. The alternative —
 * long-lived sessions keyed by an Mcp-Session-Id header — buys resumable SSE
 * streams and server-initiated notifications, neither of which these tools
 * need: every tool is a single request/response against Postgres. Stateless
 * also means no session table, no eviction policy, and no way for one user's
 * session to outlive their token.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { isExpectedServiceError } from '../services/story/index.js'
import { STORY_TOOLS, type ToolContext } from './tools.js'

export const MCP_SERVER_INFO = {
  name: 'mythweavers',
  version: '1.0.0',
} as const

const INSTRUCTIONS = `These tools read and edit stories in MythWeavers.

A story is a tree: story → books → arcs → chapters → scenes. Scenes hold the
prose, as paragraphs. Characters and context items (themes, locations, plot
threads) hang off the story and are what the story's AI generation draws on.

Typical flow: mw_outline to see the structure, mw_read on a chapter or scene to
get the prose with paragraph ids, then mw_prose to edit specific paragraphs.
Use mw_search for continuity questions before writing anything new.

Edits are real and immediately visible to the author. Prefer small, targeted
paragraph edits over wholesale rewrites, and read a scene before changing it.`

/**
 * Build a server bound to one user. Tool handlers close over the context, so
 * there is no path by which a tool call can reach another user's data.
 */
export function createStoryMcpServer(context: ToolContext): McpServer {
  const server = new McpServer(MCP_SERVER_INFO, { instructions: INSTRUCTIONS })

  for (const tool of STORY_TOOLS) {
    server.registerTool(
      tool.name,
      { description: tool.description, inputSchema: tool.inputSchema },
      // biome-ignore lint/suspicious/noExplicitAny: the SDK infers per-tool arg
      // types from each inputSchema; the shared StoryTool signature is wider.
      (async (args: any) => {
        try {
          const text = await tool.handler((args ?? {}) as Record<string, unknown>, context)
          return { content: [{ type: 'text' as const, text }] }
        } catch (error) {
          // Validation failures, missing ids and conflicts are information the
          // caller can act on, so they come back as tool errors with their
          // message intact. Anything else is a bug on our side and is rethrown
          // so it surfaces as a protocol error and gets logged.
          if (!isExpectedServiceError(error)) throw error
          return {
            isError: true,
            content: [{ type: 'text' as const, text: error.message }],
          }
        }
        // biome-ignore lint/suspicious/noExplicitAny: see above.
      }) as any,
    )
  }

  return server
}
