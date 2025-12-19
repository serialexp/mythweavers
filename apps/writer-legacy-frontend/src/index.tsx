import { render } from 'solid-js/web'
import App from './router.tsx'
import './index.css'

declare module 'solid-js' {
  namespace JSX {
    interface Directives {
      model: [() => any, (v: any) => any]
    }
  }
}

const rootElement = document.getElementById('root')
if (!rootElement) {
  alert('No root element')
} else {
  render(() => <App />, rootElement)
}
