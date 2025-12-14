import { BaseLLMClient } from "./BaseLLMClient";
import {
  LLMGenerateOptions,
  LLMGenerateResponse,
  LLMModel,
  LLMMessage,
  ModelPricing,
} from "../../types/llm";
import { settingsStore } from "../../stores/settingsStore";

interface OpenAIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export class OpenAILLMClient extends BaseLLMClient {
  protected provider = "openai";

  async list(): Promise<{ models: LLMModel[] }> {
    try {
      const apiKey = settingsStore.openaiApiKey;
      if (!apiKey) {
        console.log(
          "No OpenAI API key configured, returning empty model list",
        );
        return { models: [] };
      }

      this.log("Fetching models from OpenAI...");

      const response = await fetch("https://api.openai.com/v1/models", {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        this.logError("Failed to fetch models:", response.status, errorData);
        throw new Error(`Failed to fetch models: ${response.statusText}`);
      }

      const data = await response.json();
      this.log("Models response:", data);

      // Filter and map models that are useful for text generation
      const textModels = data.data.filter((model: any) => 
        model.id.includes('gpt') && !model.id.includes('vision') && !model.id.includes('instruct')
      );

      // Pricing map for different models (prices per million tokens)
      const pricingMap: Record<string, ModelPricing> = {
        // GPT-4o models
        "gpt-4o": {
          input: 2.50,
          output: 10.00,
          input_cache_read: 1.25,
        },
        "gpt-4o-2024-05-13": {
          input: 5.00,
          output: 15.00,
        },
        "gpt-4o-mini": {
          input: 0.15,
          output: 0.60,
          input_cache_read: 0.075,
        },
        // GPT-4 models
        "gpt-4-turbo": {
          input: 10.00,
          output: 30.00,
        },
        "gpt-4-turbo-2024-04-09": {
          input: 10.00,
          output: 30.00,
        },
        "gpt-4": {
          input: 30.00,
          output: 60.00,
        },
        "gpt-4-32k": {
          input: 60.00,
          output: 120.00,
        },
        // GPT-3.5 models
        "gpt-3.5-turbo": {
          input: 0.50,
          output: 1.50,
        },
        "gpt-3.5-turbo-0125": {
          input: 0.50,
          output: 1.50,
        },
        "gpt-3.5-turbo-16k": {
          input: 3.00,
          output: 4.00,
        },
        // O1 models
        "o1": {
          input: 15.00,
          output: 60.00,
          input_cache_read: 7.50,
        },
        "o1-mini": {
          input: 1.10,
          output: 4.40,
          input_cache_read: 0.55,
        },
        // GPT-5 models
        "gpt-5": {
          input: 1.25,
          output: 10.00,
          input_cache_read: 0.125,
        },
        "gpt-5-mini": {
          input: 0.25,
          output: 2.00,
          input_cache_read: 0.025,
        },
        "gpt-5-nano": {
          input: 0.05,
          output: 0.40,
          input_cache_read: 0.005,
        },
        "gpt-5-chat-latest": {
          input: 1.25,
          output: 10.00,
          input_cache_read: 0.125,
        },
      };

      // Context length map
      const contextLengthMap: Record<string, number> = {
        "gpt-4o": 128000,
        "gpt-4o-mini": 128000,
        "gpt-4-turbo": 128000,
        "gpt-4": 8192,
        "gpt-3.5-turbo": 16385,
        "gpt-5": 400000,  // 400k context length
        "gpt-5-mini": 400000,
        "gpt-5-nano": 400000,
        "gpt-5-chat-latest": 400000,
      };

      // Map response to our model format
      const models: LLMModel[] = textModels.map((model: any) => {
        // Find pricing - try exact match first, then pattern matching
        let pricing = pricingMap[model.id];
        let contextLength = contextLengthMap[model.id] || 8192; // default
        
        if (!pricing) {
          // Fall back to pattern matching for partial matches
          for (const [key, value] of Object.entries(pricingMap)) {
            if (model.id.includes(key)) {
              pricing = value;
              break;
            }
          }
        }
        
        if (!contextLength || contextLength === 8192) {
          // Fall back to pattern matching for context length
          for (const [key, value] of Object.entries(contextLengthMap)) {
            if (model.id.includes(key)) {
              contextLength = value;
              break;
            }
          }
        }

        return {
          name: model.id,
          context_length: contextLength,
          description: model.id,
          pricing: pricing,
        };
      });

      this.log(`Found ${models.length} models`);
      return { models };
    } catch (error) {
      this.logError("Error fetching models:", error);
      // Return empty list on error instead of throwing
      return { models: [] };
    }
  }

  async *generate(
    options: LLMGenerateOptions,
  ): AsyncGenerator<LLMGenerateResponse> {
    const { model, messages, max_tokens, temperature } = options;
    const apiKey = settingsStore.openaiApiKey;

    if (!apiKey) {
      throw new Error("OpenAI API key not configured");
    }

    try {
      const openaiMessages = this.formatMessages(messages);

      const requestBody: any = {
        model,
        messages: openaiMessages,
        temperature: temperature ?? 1,
        stream: true,
        stream_options: {
          include_usage: true
        }
      };

      // Use max_completion_tokens for newer models (o1, gpt-4o, gpt-5, etc.)
      // and max_tokens for older models
      if (model.startsWith('o1') || model.includes('gpt-4o') || model.includes('gpt-4-turbo') || model.includes('gpt-5')) {
        requestBody.max_completion_tokens = max_tokens || 4096;
      } else {
        requestBody.max_tokens = max_tokens || 4096;
      }

      this.log("Request:", { model, messageCount: messages.length });

      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify(requestBody),
        signal: options.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logError("API error:", response.status, errorText);
        throw new Error(`OpenAI API error: ${response.status} ${errorText}`);
      }

      // Always use streaming for this implementation
      yield* this.handleStream(response);
    } catch (error) {
      this.handleError(error);
    }
  }

  protected formatMessages(messages: LLMMessage[]): OpenAIMessage[] {
    return messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));
  }

  protected parseResponse(data: any): LLMGenerateResponse {
    // Log the response for debugging
    this.log("Parsing response:", data);

    // Check if this is the final chunk with usage data (empty choices array)
    if (data.usage && (!data.choices || data.choices.length === 0)) {
      return {
        response: "",
        done: true,
        usage: {
          prompt_tokens: data.usage.prompt_tokens,
          completion_tokens: data.usage.completion_tokens,
          total_tokens: data.usage.total_tokens,
          // OpenAI returns cached tokens in prompt_tokens_details.cached_tokens
          cache_read_input_tokens: data.usage.prompt_tokens_details?.cached_tokens,
        },
      };
    }

    if (data.choices && data.choices[0]) {
      const choice = data.choices[0];
      
      // Check if this is the end of the stream
      if (choice.finish_reason) {
        return {
          response: "",
          done: true,
          usage: data.usage ? {
            prompt_tokens: data.usage.prompt_tokens,
            completion_tokens: data.usage.completion_tokens,
            total_tokens: data.usage.total_tokens,
            // OpenAI returns cached tokens in prompt_tokens_details.cached_tokens
            cache_read_input_tokens: data.usage.prompt_tokens_details?.cached_tokens,
          } : undefined,
        };
      }

      // Extract content from delta
      const content = choice.delta?.content || "";
      
      return {
        response: content,
        done: false,
      };
    }

    // Log unknown response format
    this.logError("Unknown response format:", data);
    return { response: "", done: false };
  }

  private async *handleStream(
    response: Response,
  ): AsyncGenerator<LLMGenerateResponse> {
    const reader = response.body?.getReader();
    if (!reader) throw new Error("No response body");

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6);
          if (data === "[DONE]") continue;

          try {
            const parsed = JSON.parse(data);
            yield this.parseResponse(parsed);
          } catch (e) {
            this.logError("Failed to parse streaming response:", e);
          }
        }
      }
    }
  }
}