/**
 * Instruction for generating RAG queries based on input text
 */
export const ragQueriesInstruction = `Based on the following text, generate 3 specific search queries that would help retrieve relevant context and information to enhance this content. The queries should be focused on retrieving specific details about characters, locations, events, or themes mentioned or implied in the text.

Return ONLY a JSON array of 3 strings, with no additional text or explanation. For example:
["query 1", "query 2", "query 3"]`
