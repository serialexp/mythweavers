import { FiPause, FiPlay } from 'solid-icons/fi'
import { createSignal, onCleanup, onMount } from 'solid-js'
import { aiSpeech } from '../lib/ai-speech.ts'

export const AudioButton = (props: { text: string }) => {
  const [audioFile, setAudioFile] = createSignal<string | undefined>(undefined)
  let audioRef: HTMLAudioElement | undefined
  const [audioState, setAudioState] = createSignal<'loading' | 'playing' | 'stopped'>('stopped')

  onMount(() => {
    if (audioRef) {
      const handleEnded = () => {
        setAudioFile(undefined)
        setAudioState('stopped')
      }
      audioRef.addEventListener('ended', handleEnded)
      onCleanup(() => {
        audioRef?.removeEventListener('ended', handleEnded)
      })
    }
  })

  return (
    <>
      {audioFile() && <audio style={{ display: 'none' }} ref={audioRef} controls autoplay={true} src={audioFile()} />}
      <button
        type="button"
        class={`btn btn-xs ${audioState() === 'loading' ? 'loading' : ''}`}
        onClick={(e) => {
          e.stopPropagation()
          if (audioState() === 'playing') {
            setAudioState('stopped')
            setAudioFile(undefined)
          } else {
            setAudioState('loading')
            aiSpeech(props.text).then((res) => {
              setAudioState('playing')
              console.log(res)
              setAudioFile(res)
            })
          }
        }}
      >
        {audioState() === 'stopped' ? <FiPlay /> : <FiPause />}
      </button>
    </>
  )
}
