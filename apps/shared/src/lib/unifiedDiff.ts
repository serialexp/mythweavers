/**
 * Utilities for generating and applying unified diffs for LLM-based rewrites.
 *
 * This approach is more efficient than asking the LLM to output the entire rewritten text
 * because the LLM only outputs the changes, not the unchanged content.
 */

/**
 * Format content with line numbers for LLM input.
 * Example output: "1| First line\n2| Second line\n3| Third line"
 */
export function formatWithLineNumbers(content: string): string {
  const lines = content.split('\n')
  return lines.map((line, i) => `${i + 1}| ${line}`).join('\n')
}

/**
 * Statistics about a diff
 */
export interface DiffStats {
  added: number
  removed: number
}

/**
 * Calculate statistics for a unified diff
 */
export function calculateDiffStats(diffText: string): DiffStats {
  const lines = diffText.split('\n')
  let added = 0
  let removed = 0

  for (const line of lines) {
    if (line.startsWith('+') && !line.startsWith('+++')) {
      added++
    } else if (line.startsWith('-') && !line.startsWith('---')) {
      removed++
    }
  }

  return { added, removed }
}

/**
 * Apply a unified diff to the original content.
 *
 * Supports standard unified diff format with @@ hunks:
 * @@ -<old_line>,<old_count> +<new_line>,<new_count> @@
 *
 * - Lines starting with '-' are removed from original
 * - Lines starting with '+' are added to result
 * - Lines starting with ' ' (space) are context (unchanged)
 */
export function applyUnifiedDiff(originalContent: string, diffText: string): string {
  const originalLines = originalContent.split('\n')
  const diffLines = diffText.trim().split('\n')

  const result: string[] = []
  let originalIndex = 0
  let i = 0

  while (i < diffLines.length) {
    const line = diffLines[i]

    // Parse hunk header: @@ -start,count +start,count @@
    if (line.startsWith('@@')) {
      const match = line.match(/@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/)
      if (match) {
        const oldStart = parseInt(match[1]) - 1 // Convert to 0-indexed

        // Copy any lines before this hunk that weren't touched
        while (originalIndex < oldStart) {
          result.push(originalLines[originalIndex])
          originalIndex++
        }
      }
      i++
      continue
    }

    // Handle diff content lines
    if (line.startsWith('-')) {
      // Skip this line in original (it's being deleted)
      originalIndex++
      i++
    } else if (line.startsWith('+')) {
      // Add new line to result
      result.push(line.substring(1)) // Remove '+'
      i++
    } else if (line.startsWith(' ')) {
      // Context line - copy from original
      result.push(originalLines[originalIndex])
      originalIndex++
      i++
    } else {
      // Unrecognized line (diff header, etc.) - skip
      i++
    }
  }

  // Copy any remaining lines from original that weren't part of hunks
  while (originalIndex < originalLines.length) {
    result.push(originalLines[originalIndex])
    originalIndex++
  }

  return result.join('\n')
}

/**
 * Strip markdown code blocks and line-number pipe prefixes from diff output.
 * LLMs sometimes wrap their output in ```diff blocks, and when the input
 * was formatted with `formatWithLineNumbers` ("1| line"), models often
 * reproduce the "| " prefix in their diff lines.
 */
export function cleanDiffOutput(response: string): string {
  let cleaned = response.trim()
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:diff)?\n/, '').replace(/\n```$/, '')
  }

  // Strip "| " pipe prefixes that LLMs copy from line-numbered input.
  // Diff content lines start with +, -, or space — the pipe appears right after:
  //   "+| added line"  → "+added line"
  //   "-| removed line" → "-removed line"
  //   " | context line" → " context line"
  cleaned = cleaned.replace(/^([+ -])\| /gm, '$1')

  return cleaned
}

/**
 * Check if the response indicates no changes are needed
 */
export function isNoChangesResponse(response: string): boolean {
  const trimmed = response.trim()
  return trimmed === 'NO_CHANGES' || trimmed.startsWith('NO_CHANGES')
}

/**
 * Result of processing a diff response from the LLM
 */
export interface ProcessedDiffResult {
  /** The resulting content after applying the diff (or original if no changes) */
  resultContent: string
  /** The raw diff text for display purposes */
  diffText: string
  /** Statistics about the diff */
  stats: DiffStats
  /** Whether no changes were needed */
  noChanges: boolean
}

/**
 * Process an LLM response containing a unified diff.
 * Handles NO_CHANGES, markdown code blocks, and applies the diff.
 */
export function processLLMDiffResponse(
  originalContent: string,
  llmResponse: string,
): ProcessedDiffResult {
  if (isNoChangesResponse(llmResponse)) {
    return {
      resultContent: originalContent,
      diffText: 'NO_CHANGES',
      stats: { added: 0, removed: 0 },
      noChanges: true,
    }
  }

  const cleanedDiff = cleanDiffOutput(llmResponse)
  const resultContent = applyUnifiedDiff(originalContent, cleanedDiff)
  const stats = calculateDiffStats(cleanedDiff)

  return {
    resultContent,
    diffText: cleanedDiff,
    stats,
    noChanges: false,
  }
}

/**
 * Build the rewrite prompt that asks for a unified diff.
 *
 * @param originalContent The original text to rewrite
 * @param instruction The user's rewrite instruction
 * @param contextSection Optional additional context to include
 */
export function buildDiffRewritePrompt(
  originalContent: string,
  instruction: string,
  contextSection?: string,
): string {
  const numberedContent = formatWithLineNumbers(originalContent)

  return `${contextSection || ''}Rewrite the following text according to these instructions: "${instruction}"

Output a standard UNIFIED DIFF to update the text. Use this exact format:

@@ -<old_line>,<old_count> +<new_line>,<new_count> @@
 context line (unchanged, prefix with space)
-line to remove (prefix with minus)
+line to add (prefix with plus)
 context line (unchanged)

Example to replace line 5:
@@ -5,1 +5,1 @@
-Has a sword
+Has a magic sword and a shield

Example to add lines after line 10:
@@ -10,0 +11,3 @@
+New line one
+New line two
+New line three

Example to delete lines 7-9:
@@ -7,3 +7,0 @@
-Line to delete
-Another line to delete
-Third line to delete

Rules:
- Line numbers are 1-indexed (first line is 1)
- Include minimal context (1-2 lines before/after changes)
- Prefix unchanged lines with a space
- Prefix removed lines with -
- Prefix added lines with +
- You can have multiple @@ hunks for different sections
- If no changes needed, output exactly: NO_CHANGES

Important guidelines:
- You may make larger changes around the specific instruction to ensure smooth narrative flow
- Make sure transitions between sentences and paragraphs remain natural
- If changing a specific detail, adjust surrounding context as needed so everything makes sense
- Preserve the overall story, tone, style, and narrative perspective
- Ensure the rewritten section reads as a cohesive whole

CRITICAL: Return ONLY the unified diff. No preamble, no explanation, no markdown code blocks.

Original text (with line numbers):

${numberedContent}

Unified diff:`
}
