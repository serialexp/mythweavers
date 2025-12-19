export interface LlmInterface {
  listModels(): Promise<string[]>
  chat(
    model: string,
    text: string,
    options?: {
      additionalInstructions?: string
    },
  ): Promise<string>
}
