import { useNavigate } from '@solidjs/router'
import { onMount } from 'solid-js'

export default function About() {
  const navigate = useNavigate()

  onMount(() => {
    navigate('/', { replace: true })
  })

  return <div>Redirecting...</div>
}
