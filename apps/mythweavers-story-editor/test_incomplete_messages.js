/**
 * Simple test script to verify the includeIncomplete flag functionality
 * Run this script with: node test_incomplete_messages.js
 */

async function testIncompleteMessages() {
  const baseUrl = 'http://localhost:3001/mcp'

  const testRequest = {
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/call',
    params: {
      name: 'search_messages',
      arguments: {
        storyId: 'test-story-id', // You'll need to use a real story ID
        query: '.*', // Match any content
        includeIncomplete: true,
        maxResults: 20,
      },
    },
  }

  try {
    console.log('Testing includeIncomplete flag...')
    console.log('Request:', JSON.stringify(testRequest, null, 2))

    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'MCP-Protocol-Version': '2025-06-18',
      },
      body: JSON.stringify(testRequest),
    })

    const result = await response.json()
    console.log('Response:', JSON.stringify(result, null, 2))

    if (result.result?.content) {
      const content = JSON.parse(result.result.content[0].text)
      console.log('\nSummary:')
      console.log(`- Include incomplete: ${content.includeIncomplete}`)
      console.log(`- Incomplete messages found: ${content.incompleteMessagesFound}`)
      console.log(`- Total messages: ${content.totalMessages}`)

      if (content.incompleteMessagesFound > 0) {
        console.log('\nIncomplete messages:')
        content.results
          .filter((r) => r.isIncomplete)
          .forEach((r) => {
            console.log(`  - Message ${r.messageId}: "${r.snippets[0].text}" (${r.incompleteReason})`)
          })
      }
    }
  } catch (error) {
    console.error('Error:', error.message)
    console.log('\nNote: Make sure the backend server is running (pnpm run dev) and you have a valid story ID')
  }
}

// Only run if this script is executed directly
if (require.main === module) {
  testIncompleteMessages()
}

module.exports = { testIncompleteMessages }
