import { resolve } from '@tauri-apps/api/path'
import { mkdir, writeFile } from '@tauri-apps/plugin-fs'
import type { Character } from '@writer/shared'
import { Show, createEffect, createSignal } from 'solid-js'
import { charactersState, updateCharacterProperty } from '../lib/stores/characters'
import { addNotification } from '../lib/stores/notifications'
import { currentScene } from '../lib/stores/retrieval/current-scene'
import { storyState } from '../lib/stores/story'
import { useAi } from '../lib/use-ai'
import { type ImageGenerationResult, clearImageHistory, hasImageHistory, useImageAi } from '../lib/use-image-ai'
import { getAllCharacterVersions } from '../lib/utils/character-versions'
import { CharacterSelect } from './CharacterSelect'
import { CharacterTimeline } from './CharacterTimeline'
import { ColorPicker, HAIR_COLORS } from './ColorPicker'
import { FileSelector } from './FileSelector'
import { SceneFinder } from './shared/SceneFinder'

const EYE_COLORS = [
  { name: 'Brown', value: '#694731' },
  { name: 'Blue', value: '#0066CC' },
  { name: 'Green', value: '#006633' },
  { name: 'Hazel', value: '#9E6B4C' },
  { name: 'Grey', value: '#999999' },
  { name: 'Amber', value: '#FFA000' },
] as const

const HEIGHT_HINTS = [
  { age: '3mo', height: 60 },
  { age: '6mo', height: 67 },
  { age: '1y', height: 75 },
  { age: 2, height: 85 },
  { age: 4, height: 100 },
  { age: 6, height: 115 },
  { age: 8, height: 130 },
  { age: 10, height: 140 },
  { age: 12, height: 150 },
  { age: 14, height: 160 },
  { age: 16, height: 170 },
  { age: 'Adult', height: 170 },
] as const

const GENDER_OPTIONS = [
  'Male',
  'Female',
  'Non-binary',
  'Genderfluid',
  'Agender',
  'Transgender',
  'Genderqueer',
  'Other',
] as const

const ORIENTATION_OPTIONS = [
  {
    value: 'Straight',
    label: 'Straight',
    description: 'Attracted to the opposite gender',
  },
  {
    value: 'Gay',
    label: 'Gay',
    description: 'Attracted to the same gender (typically used for men)',
  },
  {
    value: 'Lesbian',
    label: 'Lesbian',
    description: 'Attracted to the same gender (women)',
  },
  {
    value: 'Bisexual',
    label: 'Bisexual',
    description: 'Attracted to both same and opposite genders',
  },
  {
    value: 'Pansexual',
    label: 'Pansexual',
    description: 'Attracted to people regardless of gender',
  },
  {
    value: 'Asexual',
    label: 'Asexual',
    description: 'Experiences little to no sexual attraction',
  },
  {
    value: 'Demisexual',
    label: 'Demisexual',
    description: 'Only experiences sexual attraction after forming emotional bonds',
  },
  {
    value: 'Other',
    label: 'Other',
    description: 'Another orientation not listed here',
  },
] as const

export const CharacterModal = (props: { onClose: () => void }) => {
  const [generating, setGenerating] = createSignal(false)
  const [showSceneFinder, setShowSceneFinder] = createSignal(false)
  const [selectedSceneIds, setSelectedSceneIds] = createSignal<string[]>([])
  const [useSceneContext, setUseSceneContext] = createSignal(true)
  const [showImagePromptPopup, setShowImagePromptPopup] = createSignal(false)
  const [imagePrompt, setImagePrompt] = createSignal('')
  const [generatingImagePrompt, setGeneratingImagePrompt] = createSignal(false)

  // Image generation state
  const [showImageGenerationPopup, setShowImageGenerationPopup] = createSignal(false)
  const [generatedImage, setGeneratedImage] = createSignal<ImageGenerationResult | null>(null)
  const [generatingImage, setGeneratingImage] = createSignal(false)
  const [imageGenerationPrompt, setImageGenerationPrompt] = createSignal('')
  const [canRefineImage, setCanRefineImage] = createSignal(false)
  const [savingImage, setSavingImage] = createSignal(false)

  // Add effect to migrate summary to personality if needed
  createEffect(() => {
    const character = charactersState.selectedCharacter
    if (character?.summary && !character.personality) {
      updateCharacterProperty(charactersState.selectedCharacterId, 'personality', character.summary)
      updateCharacterProperty(charactersState.selectedCharacterId, 'summary', '')
    }
  })

  const generateImagePrompt = async () => {
    const character = charactersState.selectedCharacter
    if (!character) return

    setGeneratingImagePrompt(true)
    try {
      const characterData = []

      // Collect character information
      const fullName = [character.firstName, character.middleName, character.lastName].filter(Boolean).join(' ')
      if (fullName) characterData.push(`Name: ${fullName}`)
      if (character.nickname) characterData.push(`Nickname: "${character.nickname}"`)
      if (character.age) characterData.push(`Age: ${character.age} years old`)
      if (character.gender) characterData.push(`Gender: ${character.gender}`)
      if (character.height) characterData.push(`Height: ${character.height}cm`)
      if (character.hairColor) characterData.push(`Hair color: ${character.hairColor}`)
      if (character.eyeColor) {
        const eyeColor = EYE_COLORS.find((c) => c.value === character.eyeColor)?.name || character.eyeColor
        characterData.push(`Eye color: ${eyeColor}`)
      }
      if (character.distinguishingFeatures)
        characterData.push(`Distinguishing features: ${character.distinguishingFeatures}`)
      if (character.personality) characterData.push(`Personality: ${character.personality}`)
      if (character.background) characterData.push(`Background: ${character.background}`)
      if (character.personalityQuirks) characterData.push(`Personality quirks: ${character.personalityQuirks}`)
      if (character.likes) characterData.push(`Likes: ${character.likes}`)
      if (character.dislikes) characterData.push(`Dislikes: ${character.dislikes}`)

      const prompt = `Based on the following character information, generate a detailed prompt for an AI image generation model (such as Stable Diffusion, Midjourney, or DALL-E) that would create an accurate visual representation of this character as an anime-style illustration.

Character Information:
${characterData.join('\n')}

Please create a prompt that:
1. Describes the character's physical appearance in detail
2. Captures their personality through pose, expression, and styling
3. Specifies anime/manga art style (high quality anime illustration, detailed anime art)
4. Includes relevant background or setting elements if suggested by their background
5. Uses optimal keywords for AI image generation
6. Emphasizes illustration/artwork rather than photorealistic rendering

The prompt should be comprehensive but concise, focusing on creating a beautiful anime-style character illustration. Output only the image generation prompt, nothing else.`

      const result = await useAi('free', prompt, false)
      setImagePrompt(result)
      setShowImagePromptPopup(true)
    } catch (error) {
      console.error('Failed to generate image prompt:', error)
      addNotification({
        type: 'error',
        title: 'Failed to generate image prompt',
        message: 'An error occurred while generating the image prompt.',
      })
    } finally {
      setGeneratingImagePrompt(false)
    }
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      addNotification({
        type: 'success',
        title: 'Copied to clipboard',
        message: 'Image prompt has been copied to your clipboard.',
      })
    } catch (error) {
      console.error('Failed to copy to clipboard:', error)
      addNotification({
        type: 'error',
        title: 'Failed to copy',
        message: 'Could not copy to clipboard. Please select and copy manually.',
      })
    }
  }

  const fillRandomValues = () => {
    const character = charactersState.selectedCharacter
    if (!character) return

    // Random values for simple fields
    if (!character.gender) {
      updateCharacterProperty(
        charactersState.selectedCharacterId,
        'gender',
        GENDER_OPTIONS[Math.floor(Math.random() * GENDER_OPTIONS.length)],
      )
    }

    if (!character.sexualOrientation) {
      updateCharacterProperty(
        charactersState.selectedCharacterId,
        'sexualOrientation',
        ORIENTATION_OPTIONS[Math.floor(Math.random() * ORIENTATION_OPTIONS.length)].value,
      )
    }

    if (!character.height) {
      updateCharacterProperty(
        charactersState.selectedCharacterId,
        'height',
        Math.floor(Math.random() * (190 - 150 + 1)) + 150,
      )
    }

    if (!character.age) {
      updateCharacterProperty(
        charactersState.selectedCharacterId,
        'age',
        String(Math.floor(Math.random() * (40 - 18 + 1)) + 18),
      )
    }

    if (!character.hairColor) {
      updateCharacterProperty(
        charactersState.selectedCharacterId,
        'hairColor',
        HAIR_COLORS[Math.floor(Math.random() * HAIR_COLORS.length)].name,
      )
    }

    if (!character.eyeColor) {
      updateCharacterProperty(
        charactersState.selectedCharacterId,
        'eyeColor',
        EYE_COLORS[Math.floor(Math.random() * EYE_COLORS.length)].value,
      )
    }
  }

  const generateFieldWithAI = async (fieldName: string, fieldLabel: string, prompt: string) => {
    const character = charactersState.selectedCharacter
    if (!character) return

    setGenerating(true)
    try {
      const result = await useAi('free', [{ text: prompt, canCache: false }], true)
      updateCharacterProperty(charactersState.selectedCharacterId, fieldName as keyof Character, result)
    } catch (error) {
      console.error(`Failed to generate ${fieldLabel}:`, error)
      addNotification({
        type: 'error',
        title: `Failed to generate ${fieldLabel}`,
        message: 'An error occurred while generating the content.',
      })
    } finally {
      setGenerating(false)
    }
  }

  const generatePersonality = () => {
    const character = charactersState.selectedCharacter
    if (!character) return

    const characterInfo = []
    const fullName = [character.firstName, character.middleName, character.lastName].filter(Boolean).join(' ')
    if (fullName) characterInfo.push(`Name: ${fullName}`)
    if (character.age) characterInfo.push(`Age: ${character.age} years old`)
    if (character.gender) characterInfo.push(`Gender: ${character.gender}`)
    if (character.background) characterInfo.push(`Background: ${character.background}`)
    if (character.distinguishingFeatures)
      characterInfo.push(`Distinguishing features: ${character.distinguishingFeatures}`)

    const prompt = `Based on the following character information, create a detailed personality description that captures their core traits, behavioral patterns, and psychological makeup.

${characterInfo.length > 0 ? characterInfo.join('\n') : 'No specific character details provided.'}

Please provide a comprehensive personality description that includes:
- Core personality traits and temperament
- How they interact with others
- Their emotional patterns and responses
- Key behavioral characteristics
- What drives and motivates them

Write this as a cohesive paragraph that captures the essence of who they are as a person.`

    generateFieldWithAI('personality', 'Personality', prompt)
  }

  const generateBackground = () => {
    const character = charactersState.selectedCharacter
    if (!character) return

    const characterInfo = []
    const fullName = [character.firstName, character.middleName, character.lastName].filter(Boolean).join(' ')
    if (fullName) characterInfo.push(`Name: ${fullName}`)
    if (character.age) characterInfo.push(`Age: ${character.age} years old`)
    if (character.gender) characterInfo.push(`Gender: ${character.gender}`)
    if (character.personality) characterInfo.push(`Personality: ${character.personality}`)

    const prompt = `Based on the following character information, create a background story that explains their history, upbringing, and significant past events.

${characterInfo.length > 0 ? characterInfo.join('\n') : 'No specific character details provided.'}

Please provide a background that includes:
- Their upbringing and family situation
- Key events that shaped who they are today
- Educational or professional background
- Important relationships or experiences
- How their past influences their current behavior and goals

Write this as a cohesive narrative that explains how they became who they are.`

    generateFieldWithAI('background', 'Background', prompt)
  }

  const generateDistinguishingFeatures = () => {
    const character = charactersState.selectedCharacter
    if (!character) return

    const characterInfo = []
    const fullName = [character.firstName, character.middleName, character.lastName].filter(Boolean).join(' ')
    if (fullName) characterInfo.push(`Name: ${fullName}`)
    if (character.age) characterInfo.push(`Age: ${character.age} years old`)
    if (character.gender) characterInfo.push(`Gender: ${character.gender}`)
    if (character.height) characterInfo.push(`Height: ${character.height}cm`)
    if (character.hairColor) characterInfo.push(`Hair color: ${character.hairColor}`)
    if (character.eyeColor) {
      const eyeColor = EYE_COLORS.find((c) => c.value === character.eyeColor)?.name || character.eyeColor
      characterInfo.push(`Eye color: ${eyeColor}`)
    }
    if (character.personality) characterInfo.push(`Personality: ${character.personality}`)
    if (character.background) characterInfo.push(`Background: ${character.background}`)

    const prompt = `Based on the following character information, describe 2-3 notable distinguishing physical features that would make this character recognizable and memorable.

${characterInfo.length > 0 ? characterInfo.join('\n') : 'No specific character details provided.'}

Focus on physical characteristics such as:
- Scars, birthmarks, or tattoos with their stories
- Unique facial features or expressions
- Distinctive body language or posture
- Notable physical quirks or mannerisms
- Clothing style or accessories they're known for

Provide specific, vivid details that match their personality and background. Write as a short paragraph.`

    generateFieldWithAI('distinguishingFeatures', 'Distinguishing Features', prompt)
  }

  const generatePersonalityQuirks = () => {
    const character = charactersState.selectedCharacter
    if (!character) return

    const characterInfo = []
    const fullName = [character.firstName, character.middleName, character.lastName].filter(Boolean).join(' ')
    if (fullName) characterInfo.push(`Name: ${fullName}`)
    if (character.personality) characterInfo.push(`Personality: ${character.personality}`)
    if (character.background) characterInfo.push(`Background: ${character.background}`)

    const prompt = `Based on the following character information, create a list of 3-5 unique personality quirks, habits, or eccentricities that make this character distinctive and memorable.

${characterInfo.length > 0 ? characterInfo.join('\n') : 'No specific character details provided.'}

Focus on:
- Unusual habits or behavioral patterns
- Quirky speech patterns or verbal tics
- Unique ways they handle stress or emotions
- Strange collections or interests
- Odd superstitions or beliefs
- Distinctive social behaviors

Write these as a comma-separated list of specific, observable quirks that would make this character stand out.`

    generateFieldWithAI('personalityQuirks', 'Personality Quirks', prompt)
  }

  const generateLikes = () => {
    const character = charactersState.selectedCharacter
    if (!character) return

    const characterInfo = []
    const fullName = [character.firstName, character.middleName, character.lastName].filter(Boolean).join(' ')
    if (fullName) characterInfo.push(`Name: ${fullName}`)
    if (character.personality) characterInfo.push(`Personality: ${character.personality}`)
    if (character.background) characterInfo.push(`Background: ${character.background}`)
    if (character.personalityQuirks) characterInfo.push(`Personality quirks: ${character.personalityQuirks}`)

    const prompt = `Based on the following character information, create a list of 3-5 things this character genuinely likes, enjoys, or is passionate about.

${characterInfo.length > 0 ? characterInfo.join('\n') : 'No specific character details provided.'}

Consider:
- Hobbies and activities they enjoy
- Types of food, music, or entertainment they prefer
- Values or ideals they care about
- Social situations or environments they thrive in
- Skills or subjects they're passionate about

Write these as a comma-separated list that reflects their personality and background.`

    generateFieldWithAI('likes', 'Likes', prompt)
  }

  const generateDislikes = () => {
    const character = charactersState.selectedCharacter
    if (!character) return

    const characterInfo = []
    const fullName = [character.firstName, character.middleName, character.lastName].filter(Boolean).join(' ')
    if (fullName) characterInfo.push(`Name: ${fullName}`)
    if (character.personality) characterInfo.push(`Personality: ${character.personality}`)
    if (character.background) characterInfo.push(`Background: ${character.background}`)
    if (character.personalityQuirks) characterInfo.push(`Personality quirks: ${character.personalityQuirks}`)

    const prompt = `Based on the following character information, create a list of 3-5 things this character dislikes, avoids, or has strong aversions to.

${characterInfo.length > 0 ? characterInfo.join('\n') : 'No specific character details provided.'}

Consider:
- Behaviors or attitudes that annoy them
- Social situations they avoid
- Types of food, entertainment, or activities they dislike
- Values or ideals they oppose
- Environmental factors that make them uncomfortable

Write these as a comma-separated list that reflects their personality and background.`

    generateFieldWithAI('dislikes', 'Dislikes', prompt)
  }

  const generateWritingStyle = () => {
    const character = charactersState.selectedCharacter
    if (!character) return

    const characterInfo = []
    const fullName = [character.firstName, character.middleName, character.lastName].filter(Boolean).join(' ')
    if (fullName) characterInfo.push(`Name: ${fullName}`)
    if (character.personality) characterInfo.push(`Personality: ${character.personality}`)
    if (character.background) characterInfo.push(`Background: ${character.background}`)
    if (character.distinguishingFeatures)
      characterInfo.push(`Distinguishing features: ${character.distinguishingFeatures}`)
    if (character.personalityQuirks) characterInfo.push(`Personality quirks: ${character.personalityQuirks}`)
    if (character.gender) characterInfo.push(`Gender: ${character.gender}`)
    if (character.age) characterInfo.push(`Age: ${character.age} years old`)
    if (character.sexualOrientation) characterInfo.push(`Sexual orientation: ${character.sexualOrientation}`)
    if (character.likes) characterInfo.push(`Likes: ${character.likes}`)
    if (character.dislikes) characterInfo.push(`Dislikes: ${character.dislikes}`)

    const prompt = `Based on the following character information, generate a writing style description that would be appropriate for this character. The writing style should reflect their personality, background, and distinguishing features.

${characterInfo.length > 0 ? characterInfo.join('\n') : 'No specific character details provided.'}

Please provide a concise description of how this character should be written, including:
1. Tone and voice
2. Vocabulary level and style
3. Any specific quirks or patterns in their speech or thoughts
4. Emotional expression style

Format as a clear, concise paragraph.`

    generateFieldWithAI('writingStyle', 'Writing Style', prompt)
  }

  const generateImageFromPrompt = async (prompt: string, refine = false) => {
    setGeneratingImage(true)
    try {
      const result = await useImageAi(prompt, { basedOnPrevious: refine })
      setGeneratedImage(result)
      setCanRefineImage(await hasImageHistory())
    } catch (error) {
      console.error('Failed to generate image:', error)
    } finally {
      setGeneratingImage(false)
    }
  }

  const openImageGeneration = async () => {
    const character = charactersState.selectedCharacter
    if (!character) return

    // First generate the text prompt
    setGeneratingImagePrompt(true)
    try {
      const characterData = []

      // Collect character information
      const fullName = [character.firstName, character.middleName, character.lastName].filter(Boolean).join(' ')
      if (fullName) characterData.push(`Name: ${fullName}`)
      if (character.nickname) characterData.push(`Nickname: "${character.nickname}"`)
      if (character.age) characterData.push(`Age: ${character.age} years old`)
      if (character.gender) characterData.push(`Gender: ${character.gender}`)
      if (character.height) characterData.push(`Height: ${character.height}cm`)
      if (character.hairColor) characterData.push(`Hair color: ${character.hairColor}`)
      if (character.eyeColor) {
        const eyeColor = EYE_COLORS.find((c) => c.value === character.eyeColor)?.name || character.eyeColor
        characterData.push(`Eye color: ${eyeColor}`)
      }
      if (character.distinguishingFeatures)
        characterData.push(`Distinguishing features: ${character.distinguishingFeatures}`)
      if (character.personality) characterData.push(`Personality: ${character.personality}`)
      if (character.background) characterData.push(`Background: ${character.background}`)

      const prompt = `Based on the following character information, generate a detailed prompt for an AI image generation model (such as Stable Diffusion, Midjourney, or DALL-E) that would create an accurate visual representation of this character as an anime-style illustration.

Character Information:
${characterData.join('\n')}

Please create a prompt that:
1. Describes the character's physical appearance in detail
2. Captures their personality through pose, expression, and styling
3. Specifies anime/manga art style (high quality anime illustration, detailed anime art)
4. Includes relevant background or setting elements if suggested by their background
5. Uses optimal keywords for AI image generation
6. Emphasizes illustration/artwork rather than photorealistic rendering

The prompt should be comprehensive but concise, focusing on creating a beautiful anime-style character illustration. Output only the image generation prompt, nothing else.`

      const textPrompt = await useAi('free', prompt, false)
      setImageGenerationPrompt(textPrompt)
      setShowImageGenerationPopup(true)

      // Clear any previous image generation history
      await clearImageHistory()
      setCanRefineImage(false)
      setGeneratedImage(null)
    } catch (error) {
      console.error('Failed to generate image prompt:', error)
      addNotification({
        type: 'error',
        title: 'Failed to generate image prompt',
        message: 'An error occurred while generating the image prompt.',
      })
    } finally {
      setGeneratingImagePrompt(false)
    }
  }

  const saveGeneratedImage = async () => {
    const character = charactersState.selectedCharacter
    const image = generatedImage()
    const openPath = storyState.openPath

    if (!character || !image || !openPath) {
      addNotification({
        type: 'error',
        title: 'Cannot save image',
        message: 'Missing character, image, or story path.',
      })
      return
    }

    setSavingImage(true)
    try {
      // Create data directory if it doesn't exist
      const dataPath = await resolve(openPath, 'data')
      await mkdir(dataPath, { recursive: true })

      // Generate filename based on character name and timestamp
      const characterName =
        [character.firstName, character.lastName]
          .filter(Boolean)
          .join('_')
          .replace(/[^a-zA-Z0-9_-]/g, '') || 'character'
      const timestamp = Date.now()
      const filename = `${characterName}_${timestamp}.png`
      const fullPath = await resolve(dataPath, filename)

      // Convert base64 to binary and save
      const base64Data = image.imageBase64
      const binaryData = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0))

      await writeFile(fullPath, binaryData)

      // Update character's picture property to point to the saved file
      const relativePath = `/${filename}`
      updateCharacterProperty(charactersState.selectedCharacterId, 'picture', relativePath)

      addNotification({
        type: 'success',
        title: 'Image saved',
        message: `Character image saved as ${filename}`,
      })

      // Close the image generation popup
      setShowImageGenerationPopup(false)
      setGeneratedImage(null)
      await clearImageHistory()
    } catch (error) {
      console.error('Failed to save image:', error)
      addNotification({
        type: 'error',
        title: 'Failed to save image',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
      })
    } finally {
      setSavingImage(false)
    }
  }

  return (
    <div
      class="modal modal-open"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          props.onClose()
        }
      }}
    >
      <div class="modal-box w-11/12 max-w-full">
        <h3 class="font-bold text-lg">
          Character {charactersState.selectedCharacter?.firstName ?? charactersState.selectedCharacter?.id}
        </h3>

        {/* Image Prompt Popup */}
        {showImagePromptPopup() && (
          <div
            class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setShowImagePromptPopup(false)
              }
            }}
          >
            <div class="bg-base-100 rounded-lg shadow-xl w-11/12 max-w-2xl p-6">
              <h3 class="font-bold text-lg mb-4">Generated Image Prompt</h3>
              <div class="form-control">
                <textarea
                  class="textarea textarea-bordered w-full h-40"
                  value={imagePrompt()}
                  readonly
                  placeholder="Generated prompt will appear here..."
                />
              </div>
              <div class="flex justify-end gap-2 mt-4">
                <button
                  type="button"
                  class="btn btn-primary"
                  onClick={() => copyToClipboard(imagePrompt())}
                  disabled={!imagePrompt()}
                >
                  Copy to Clipboard
                </button>
                <button type="button" class="btn" onClick={() => setShowImagePromptPopup(false)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Image Generation Popup */}
        {showImageGenerationPopup() && (
          <div
            class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setShowImageGenerationPopup(false)
              }
            }}
          >
            <div class="bg-base-100 rounded-lg shadow-xl w-11/12 max-w-4xl p-6 max-h-[90vh] overflow-auto">
              <h3 class="font-bold text-lg mb-4">Generate Character Image</h3>

              <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left side - Prompt and controls */}
                <div class="space-y-4">
                  <div class="form-control">
                    <label class="label">
                      <span class="label-text">Image Generation Prompt</span>
                    </label>
                    <textarea
                      class="textarea textarea-bordered w-full h-32"
                      value={imageGenerationPrompt()}
                      onInput={(e) => setImageGenerationPrompt(e.currentTarget.value)}
                      placeholder="Describe the character image you want to generate..."
                    />
                  </div>

                  <div class="flex gap-2">
                    <button
                      type="button"
                      class="btn btn-primary"
                      onClick={() => generateImageFromPrompt(imageGenerationPrompt(), false)}
                      disabled={generatingImage() || !imageGenerationPrompt().trim()}
                    >
                      {generatingImage() ? 'Generating...' : 'Generate Image'}
                    </button>

                    {canRefineImage() && (
                      <div class="form-control">
                        <input
                          type="text"
                          class="input input-bordered"
                          placeholder="Refinement prompt (e.g., 'make it more realistic')"
                          onKeyPress={(e) => {
                            if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                              generateImageFromPrompt(e.currentTarget.value, true)
                              e.currentTarget.value = ''
                            }
                          }}
                        />
                      </div>
                    )}
                  </div>

                  {canRefineImage() && (
                    <div class="alert alert-info">
                      <span>You can refine the current image by typing adjustments above and pressing Enter</span>
                    </div>
                  )}
                </div>

                {/* Right side - Generated image preview */}
                <div class="space-y-4">
                  <div class="form-control">
                    <label class="label">
                      <span class="label-text">Generated Image</span>
                    </label>
                    <div class="border border-base-300 rounded-lg p-4 min-h-[300px] flex items-center justify-center">
                      {generatingImage() ? (
                        <div class="flex flex-col items-center gap-2">
                          <span class="loading loading-spinner loading-lg" />
                          <span>Generating image...</span>
                        </div>
                      ) : generatedImage() ? (
                        <img
                          src={generatedImage()!.dataUrl}
                          alt="Generated character"
                          class="max-w-full max-h-80 object-contain rounded"
                        />
                      ) : (
                        <span class="text-base-content/50">Generated image will appear here</span>
                      )}
                    </div>
                  </div>

                  {generatedImage() && (
                    <div class="flex gap-2">
                      <button
                        type="button"
                        class="btn btn-success flex-1"
                        onClick={saveGeneratedImage}
                        disabled={savingImage()}
                      >
                        {savingImage() ? 'Saving...' : 'Save & Use This Image'}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div class="flex justify-end gap-2 mt-6">
                <button
                  type="button"
                  class="btn btn-ghost"
                  onClick={async () => {
                    await clearImageHistory()
                    setShowImageGenerationPopup(false)
                    setGeneratedImage(null)
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        <div class="py-4 grid grid-cols-2 gap-4">
          {/* Left Column */}
          <div class="space-y-4">
            {/* Name Fields in a single row */}
            <div class="grid grid-cols-3 gap-2">
              <div class="form-control">
                <label class="label" for="firstName">
                  <span class="label-text">First Name</span>
                </label>
                <input
                  id="firstName"
                  type="text"
                  class="input input-bordered"
                  value={charactersState.selectedCharacter?.firstName ?? ''}
                  onInput={(e) => {
                    updateCharacterProperty(charactersState.selectedCharacterId, 'firstName', e.currentTarget.value)
                  }}
                />
              </div>

              <div class="form-control">
                <label class="label" for="middleName">
                  <span class="label-text">Middle Name</span>
                </label>
                <input
                  id="middleName"
                  type="text"
                  class="input input-bordered"
                  value={charactersState.selectedCharacter?.middleName ?? ''}
                  onInput={(e) => {
                    updateCharacterProperty(charactersState.selectedCharacterId, 'middleName', e.currentTarget.value)
                  }}
                />
              </div>

              <div class="form-control">
                <label class="label" for="lastName">
                  <span class="label-text">Last Name</span>
                </label>
                <input
                  id="lastName"
                  type="text"
                  class="input input-bordered"
                  value={charactersState.selectedCharacter?.lastName ?? ''}
                  onInput={(e) => {
                    updateCharacterProperty(charactersState.selectedCharacterId, 'lastName', e.currentTarget.value)
                  }}
                />
              </div>
            </div>

            <div class="form-control">
              <label class="label" for="nickname">
                <span class="label-text">Nickname</span>
              </label>
              <input
                id="nickname"
                type="text"
                class="input input-bordered"
                value={charactersState.selectedCharacter?.nickname ?? ''}
                onInput={(e) => {
                  updateCharacterProperty(charactersState.selectedCharacterId, 'nickname', e.currentTarget.value)
                }}
              />
            </div>

            <div class="form-control">
              <label class="label" for="picture">
                <span class="label-text">Picture</span>
              </label>
              <FileSelector
                name={charactersState.selectedCharacter?.firstName ?? ''}
                value={charactersState.selectedCharacter?.picture ?? ''}
                onChange={(file) => {
                  updateCharacterProperty(charactersState.selectedCharacterId, 'picture', file)
                }}
              />
            </div>

            <div class="form-control">
              <label class="label" for="personality">
                <span class="label-text">Personality</span>
                <button
                  type="button"
                  class="btn btn-xs btn-ghost"
                  onClick={generatePersonality}
                  disabled={generating()}
                >
                  {generating() ? 'Generating...' : 'AI Fill'}
                </button>
              </label>
              <textarea
                id="personality"
                class="textarea textarea-bordered"
                rows={8}
                value={charactersState.selectedCharacter?.personality ?? ''}
                onInput={(e) => {
                  updateCharacterProperty(charactersState.selectedCharacterId, 'personality', e.currentTarget.value)
                }}
                placeholder="Describe the character's personality, traits, and behavioral patterns."
              />
            </div>

            <div class="form-control">
              <label class="label" for="background">
                <span class="label-text">Background</span>
                <button type="button" class="btn btn-xs btn-ghost" onClick={generateBackground} disabled={generating()}>
                  {generating() ? 'Generating...' : 'AI Fill'}
                </button>
              </label>
              <textarea
                id="background"
                class="textarea textarea-bordered"
                rows={8}
                value={charactersState.selectedCharacter?.background ?? ''}
                onInput={(e) => {
                  updateCharacterProperty(charactersState.selectedCharacterId, 'background', e.currentTarget.value)
                }}
                placeholder="Describe the character's history, upbringing, and significant past events."
              />
            </div>

            <div class="form-control">
              <label class="label" for="writingStyle">
                <span class="label-text">Writing Style</span>
                <button
                  type="button"
                  class="btn btn-xs btn-ghost"
                  onClick={generateWritingStyle}
                  disabled={generating()}
                >
                  {generating() ? 'Generating...' : 'AI Fill'}
                </button>
              </label>
              <textarea
                id="writingStyle"
                class="textarea textarea-bordered"
                rows={8}
                value={charactersState.selectedCharacter?.writingStyle ?? ''}
                onInput={(e) => {
                  updateCharacterProperty(charactersState.selectedCharacterId, 'writingStyle', e.currentTarget.value)
                }}
                placeholder="Describe how this character should be written, including tone, vocabulary, speech patterns, and emotional expression style."
              />
            </div>

            <div class="form-control">
              <label class="label">
                <span class="label-text">Age</span>
                <span class="label-text-alt">{charactersState.selectedCharacter?.age ?? 0} years</span>
              </label>
              <input
                type="range"
                min="0"
                max="120"
                class="range"
                step="1"
                value={charactersState.selectedCharacter?.age ?? '0'}
                onInput={(e) => {
                  updateCharacterProperty(charactersState.selectedCharacterId, 'age', e.currentTarget.value)
                }}
              />
              <div class="w-full flex justify-between text-xs px-2 mt-1">
                <span>0</span>
                <span>60</span>
                <span>120</span>
              </div>
            </div>

            <div class="form-control">
              <label class="label">
                <span class="label-text">Gender</span>
              </label>
              <select
                class="select select-bordered"
                value={charactersState.selectedCharacter?.gender ?? ''}
                onChange={(e) => {
                  updateCharacterProperty(charactersState.selectedCharacterId, 'gender', e.currentTarget.value)
                }}
              >
                <option value="">Select gender...</option>
                {GENDER_OPTIONS.map((option) => (
                  <option value={option}>{option}</option>
                ))}
              </select>
            </div>

            <div class="form-control">
              <label class="label">
                <span class="label-text">Sexual Orientation</span>
              </label>
              <select
                class="select select-bordered"
                value={charactersState.selectedCharacter?.sexualOrientation ?? ''}
                onChange={(e) => {
                  updateCharacterProperty(
                    charactersState.selectedCharacterId,
                    'sexualOrientation',
                    e.currentTarget.value,
                  )
                }}
              >
                <option value="">Select orientation...</option>
                {ORIENTATION_OPTIONS.map((option) => (
                  <option value={option.value} title={option.description}>
                    {option.label}
                  </option>
                ))}
              </select>
              {charactersState.selectedCharacter?.sexualOrientation && (
                <label class="label">
                  <span class="label-text-alt">
                    {
                      ORIENTATION_OPTIONS.find((o) => o.value === charactersState.selectedCharacter?.sexualOrientation)
                        ?.description
                    }
                  </span>
                </label>
              )}
            </div>
          </div>

          {/* Right Column */}
          <div class="space-y-4">
            <div class="form-control">
              <label class="label cursor-pointer">
                <span class="label-text">Main Character</span>
                <input
                  type="checkbox"
                  class="checkbox"
                  checked={charactersState.selectedCharacter?.isMainCharacter ?? true}
                  onChange={(e) => {
                    updateCharacterProperty(
                      charactersState.selectedCharacterId,
                      'isMainCharacter',
                      e.currentTarget.checked,
                    )
                  }}
                />
              </label>
            </div>

            <div class="form-control">
              <label class="label">
                <span class="label-text">Later Version Of</span>
              </label>
              <CharacterSelect
                placeholder="Select earlier version..."
                value={charactersState.selectedCharacter?.laterVersionOf}
                onChange={(characterId: string | null) => {
                  updateCharacterProperty(
                    charactersState.selectedCharacterId,
                    'laterVersionOf',
                    characterId || undefined,
                  )
                }}
                filter={(char) =>
                  // Don't show the current character
                  char.id !== charactersState.selectedCharacterId &&
                  // Don't show characters that are later versions of this character (to avoid cycles)
                  char.laterVersionOf !== charactersState.selectedCharacterId
                }
              />
            </div>

            <div class="form-control">
              <label class="label">
                <span class="label-text">Height (cm)</span>
                <span class="label-text-alt">{charactersState.selectedCharacter?.height ?? 170}cm</span>
              </label>
              <div class="text-sm text-gray-500 mb-2">
                Average heights:{' '}
                {HEIGHT_HINTS.map((hint, i) => (
                  <>
                    {i > 0 && ' • '}
                    {hint.age} y/o: {hint.height}cm
                  </>
                ))}
              </div>
              <input
                type="range"
                min="40"
                max="220"
                class="range"
                step="1"
                value={charactersState.selectedCharacter?.height ?? 170}
                onInput={(e) => {
                  updateCharacterProperty(
                    charactersState.selectedCharacterId,
                    'height',
                    Number.parseInt(e.currentTarget.value),
                  )
                }}
              />
              <div class="w-full flex justify-between text-xs px-2 mt-1">
                <span>40cm</span>
                <span>130cm</span>
                <span>220cm</span>
              </div>
            </div>

            <div class="form-control">
              <label class="label">
                <span class="label-text">Hair Color</span>
              </label>
              <ColorPicker
                value={charactersState.selectedCharacter?.hairColor ?? ''}
                onChange={(color) => {
                  updateCharacterProperty(charactersState.selectedCharacterId, 'hairColor', color)
                }}
              />
            </div>

            <div class="form-control">
              <label class="label">
                <span class="label-text">Eye Color</span>
              </label>
              <ColorPicker
                value={charactersState.selectedCharacter?.eyeColor ?? ''}
                onChange={(color) => {
                  updateCharacterProperty(charactersState.selectedCharacterId, 'eyeColor', color)
                }}
                colors={EYE_COLORS}
              />
            </div>

            <div class="form-control">
              <label class="label">
                <span class="label-text">Distinguishing Features</span>
                <button
                  type="button"
                  class="btn btn-xs btn-ghost"
                  onClick={generateDistinguishingFeatures}
                  disabled={generating()}
                >
                  {generating() ? 'Generating...' : 'AI Fill'}
                </button>
              </label>
              <textarea
                class="textarea textarea-bordered"
                rows={5}
                value={charactersState.selectedCharacter?.distinguishingFeatures ?? ''}
                onInput={(e) => {
                  updateCharacterProperty(
                    charactersState.selectedCharacterId,
                    'distinguishingFeatures',
                    e.currentTarget.value,
                  )
                }}
                placeholder="Scars, tattoos, birthmarks, etc."
              />
            </div>
            <div class="form-control">
              <label class="label" for="personalityQuirks">
                <span class="label-text">Personality Quirks</span>
                <button
                  type="button"
                  class="btn btn-xs btn-ghost"
                  onClick={generatePersonalityQuirks}
                  disabled={generating()}
                >
                  {generating() ? 'Generating...' : 'AI Fill'}
                </button>
              </label>
              <textarea
                id="personalityQuirks"
                class="textarea textarea-bordered"
                rows={3}
                value={charactersState.selectedCharacter?.personalityQuirks ?? ''}
                onInput={(e) => {
                  updateCharacterProperty(
                    charactersState.selectedCharacterId,
                    'personalityQuirks',
                    e.currentTarget.value,
                  )
                }}
                placeholder="List the character's unique quirks, habits, or eccentricities that make them distinctive."
              />
            </div>

            <div class="form-control">
              <label class="label" for="likes">
                <span class="label-text">Likes</span>
                <button type="button" class="btn btn-xs btn-ghost" onClick={generateLikes} disabled={generating()}>
                  {generating() ? 'Generating...' : 'AI Fill'}
                </button>
              </label>
              <textarea
                id="likes"
                class="textarea textarea-bordered"
                rows={3}
                value={charactersState.selectedCharacter?.likes ?? ''}
                onInput={(e) => {
                  updateCharacterProperty(charactersState.selectedCharacterId, 'likes', e.currentTarget.value)
                }}
                placeholder="List the character's likes, preferences, and things they enjoy."
              />
            </div>

            <div class="form-control">
              <label class="label" for="dislikes">
                <span class="label-text">Dislikes</span>
                <button type="button" class="btn btn-xs btn-ghost" onClick={generateDislikes} disabled={generating()}>
                  {generating() ? 'Generating...' : 'AI Fill'}
                </button>
              </label>
              <textarea
                id="dislikes"
                class="textarea textarea-bordered"
                rows={3}
                value={charactersState.selectedCharacter?.dislikes ?? ''}
                onInput={(e) => {
                  updateCharacterProperty(charactersState.selectedCharacterId, 'dislikes', e.currentTarget.value)
                }}
                placeholder="List the character's dislikes, aversions, and things they avoid."
              />
            </div>
          </div>
        </div>

        {/* Significant Actions Section */}
        <CharacterTimeline
          versions={getAllCharacterVersions(charactersState.selectedCharacterId, charactersState.characters)}
          onRemoveAction={(character, timestamp) => {
            const significantActions = [...(character.significantActions || [])].filter(
              (a) => a.timestamp !== timestamp,
            )
            updateCharacterProperty(character.id, 'significantActions', significantActions)
          }}
        />

        <div class="modal-action">
          {/* Scene Context Selection */}
          <div class="mt-4 mb-4">
            <div class="flex items-center justify-between mb-2">
              <label class="flex items-center cursor-pointer gap-2">
                <input
                  type="checkbox"
                  class="checkbox"
                  checked={useSceneContext()}
                  onChange={() => setUseSceneContext(!useSceneContext())}
                />
                <span class="label-text">Use scene context for generation</span>
              </label>
              <button
                type="button"
                class="btn btn-xs btn-outline"
                onClick={() => setShowSceneFinder(!showSceneFinder())}
                disabled={!useSceneContext()}
              >
                {showSceneFinder() ? 'Hide Scene Selector' : 'Select Scenes'}
              </button>
            </div>

            <Show when={showSceneFinder() && useSceneContext()}>
              <SceneFinder
                currentSceneId={currentScene()?.id}
                onChange={(sceneIds) => setSelectedSceneIds(sceneIds)}
                selectedSceneIds={selectedSceneIds()}
                maxHeight="250px"
              />
            </Show>
          </div>

          <button type="button" class="btn btn-secondary" onClick={fillRandomValues}>
            Fill Random Values
          </button>
          <button
            type="button"
            class="btn btn-secondary"
            onClick={generateImagePrompt}
            disabled={generatingImagePrompt()}
          >
            {generatingImagePrompt() ? 'Generating...' : 'Generate Image Prompt'}
          </button>
          <button type="button" class="btn btn-accent" onClick={openImageGeneration} disabled={generatingImagePrompt()}>
            {generatingImagePrompt() ? 'Generating...' : 'Generate & Use Image'}
          </button>
          <button type="button" class="btn" onClick={props.onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
