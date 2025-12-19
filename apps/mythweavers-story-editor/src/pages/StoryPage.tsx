import { Component } from 'solid-js'

interface StoryPageProps {
  children?: any
}

export const StoryPage: Component<StoryPageProps> = (props) => {
  // The actual story content will be passed as children from App.tsx
  return <>{props.children}</>
}
