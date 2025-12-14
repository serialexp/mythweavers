import { settingsStore } from "../stores/settingsStore";
import { LandmarkIndustry } from "../types/core";

interface LandmarkInfo {
  population?: string;
  industry?: LandmarkIndustry;
  description?: string;
  planetaryBodies?: string;
}

interface LandmarkSearchResponse {
  population?: string | number;
  population_formatted?: string;
  industry?: string;
  description?: string;
  planetaryBodies?: string;
  found?: boolean;
  error?: string;
}

export async function searchLandmarkInfo(landmarkName: string, landmarkType?: 'system' | 'station' | 'nebula' | 'junction'): Promise<LandmarkInfo> {
  const { provider, anthropicApiKey } = settingsStore;

  if (provider !== 'anthropic') {
    throw new Error('Web search is only available with Anthropic provider');
  }

  if (!anthropicApiKey) {
    throw new Error('Anthropic API key not configured');
  }

  // Junctions are auto-generated connection points, not searchable
  if (landmarkType === 'junction') {
    return {};
  }

  try {
    console.log(`[LandmarkSearch] Searching for information about: ${landmarkName} (type: ${landmarkType || 'unknown'})`);

    // Determine what we're searching for
    let searchContext = '';
    if (landmarkType === 'system') {
      searchContext = 'star system (not a planet - the entire solar system)';
    } else if (landmarkType === 'station') {
      searchContext = 'space station';
    } else if (landmarkType === 'nebula') {
      searchContext = 'nebula or spatial anomaly';
    } else {
      searchContext = 'location';
    }

    // Make a direct request to Anthropic API with web search tool
    const requestBody = {
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: `Search the web for CANON information about "${landmarkName}" from Star Wars, which is a ${searchContext}.

Focus on official Star Wars canon sources (post-2014 Disney canon and the original six films). If canon information is limited, you may include Legends/EU information but prioritize canon.

Return ONLY a JSON object with this exact structure (no additional text or markdown):
{
  "found": true or false,
  "population": number or null (raw number, e.g., 2000000000 for 2 billion - for systems, give the total population of all planets),
  "population_formatted": "human-readable string" or null (e.g., "2 billion"),
  "industry": "farming" or "political" or "industry" or "trade" or "mining" or null,
  "description": "2-3 sentence description" or null,
  "planetaryBodies": "comma-separated list of planets and major moons" or null (only for systems, e.g., "Tatooine I, Tatooine II")
}

Important:
- Prioritize TIMELESS GEOGRAPHICAL/ASTRONOMICAL information (what the location IS, not what happened there)
- Focus on: physical characteristics, climate, terrain, native species, natural resources, economic role
- AVOID: specific events, battles, character visits, or plot points from movies/shows
- For the description, include facts about the location's characteristics, environment, or role in the galaxy
- Prioritize information from official Star Wars canon (films, TV shows, and post-2014 books/materials)
- Look for information on Wookieepedia, checking the Canon tab when available
- If this is a star system, describe the SYSTEM not just the primary planet
- For systems, list all known planets and major moons in planetaryBodies
- For stations and nebulae, leave planetaryBodies as null
- If the location is not found or is not from Star Wars, set "found" to false and leave other fields null.`
        }
      ],
      tools: [{
        type: "web_search_20250305",
        name: "web_search",
        max_uses: 5
      }]
    };

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicApiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[LandmarkSearch] API error:', response.status, errorText);
      throw new Error(`Anthropic API error: ${response.status}`);
    }

    const data = await response.json();
    
    // Extract the text content from the response
    let responseText = '';
    if (data.content && Array.isArray(data.content)) {
      for (const content of data.content) {
        if (content.type === 'text') {
          responseText += content.text;
        }
      }
    }

    console.log(`[LandmarkSearch] Raw response: ${responseText}`);

    // Try to parse as JSON
    let parsedData: LandmarkSearchResponse;
    try {
      // Find JSON in the response (it might have markdown code blocks around it)
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('[LandmarkSearch] Failed to parse JSON response:', parseError);
      // Fall back to empty result if parsing fails
      parsedData = { found: false };
    }

    // Check if location was found
    if (!parsedData.found) {
      console.log(`[LandmarkSearch] Location not found or not from Star Wars`);
      return {};
    }

    // Convert the parsed data to our format
    const result: LandmarkInfo = {};

    // Handle population
    if (parsedData.population !== null && parsedData.population !== undefined) {
      // Convert to string and ensure it's a valid number
      result.population = String(parsedData.population).replace(/[^0-9]/g, '');
    }

    // Handle industry - validate it's one of our allowed values
    if (parsedData.industry) {
      const validIndustries: LandmarkIndustry[] = ['farming', 'political', 'industry', 'trade', 'mining'];
      if (validIndustries.includes(parsedData.industry as LandmarkIndustry)) {
        result.industry = parsedData.industry as LandmarkIndustry;
      }
    }

    // Handle description - remove citation markers but keep the text
    if (parsedData.description) {
      // Remove <cite index='...'> opening tags but keep the content
      let cleanDescription = parsedData.description.replace(/<cite[^>]*>/g, '');
      // Remove </cite> closing tags
      cleanDescription = cleanDescription.replace(/<\/cite>/g, '');
      // Clean up any double spaces that might result
      cleanDescription = cleanDescription.replace(/\s+/g, ' ').trim();
      
      if (cleanDescription) {
        result.description = cleanDescription;
      }
    }

    // Handle planetary bodies - clean up citations if present
    if (parsedData.planetaryBodies) {
      // Remove citation markers if they exist
      let cleanBodies = parsedData.planetaryBodies.replace(/<cite[^>]*>/g, '');
      cleanBodies = cleanBodies.replace(/<\/cite>/g, '');
      cleanBodies = cleanBodies.trim();
      
      if (cleanBodies) {
        result.planetaryBodies = cleanBodies;
      }
    }

    console.log(`[LandmarkSearch] Parsed data:`, result);

    return result;
  } catch (error) {
    console.error('[LandmarkSearch] Error searching for landmark info:', error);
    throw error;
  }
}