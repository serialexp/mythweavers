import { Card, CardBody } from '@mythweavers/ui'
import { Component, For, Show } from 'solid-js'
import * as styles from './ScriptDataDiff.css'

type ScriptDataValue = string | number | boolean | null | undefined | ScriptDataObject | ScriptDataValue[]
type ScriptDataObject = { [key: string]: ScriptDataValue }

interface ScriptDataDiffProps {
  before: ScriptDataObject
  after: ScriptDataObject
  messageId: string
}

export const ScriptDataDiff: Component<ScriptDataDiffProps> = (props) => {
  const beforeStr = JSON.stringify(props.before, null, 2)
  const afterStr = JSON.stringify(props.after, null, 2)

  if (beforeStr === afterStr) return null

  const changes: string[] = []

  const findChanges = (obj1: ScriptDataValue, obj2: ScriptDataValue, path = '') => {
    if (obj1 === null || obj1 === undefined || obj2 === null || obj2 === undefined) {
      if (obj1 !== obj2) {
        changes.push(`${path}: ${JSON.stringify(obj1)} → ${JSON.stringify(obj2)}`)
      }
      return
    }

    if (typeof obj1 !== typeof obj2) {
      changes.push(`${path}: ${JSON.stringify(obj1)} → ${JSON.stringify(obj2)}`)
      return
    }

    if (typeof obj1 !== 'object') {
      if (obj1 !== obj2) {
        changes.push(`${path}: ${JSON.stringify(obj1)} → ${JSON.stringify(obj2)}`)
      }
      return
    }

    if (Array.isArray(obj1) && Array.isArray(obj2)) {
      if (JSON.stringify(obj1) !== JSON.stringify(obj2)) {
        changes.push(`${path}: [${obj1.length} items] → [${obj2.length} items]`)
      }
      return
    }

    if (!Array.isArray(obj1) && !Array.isArray(obj2)) {
      const objKeys1 = Object.keys(obj1 as ScriptDataObject)
      const objKeys2 = Object.keys(obj2 as ScriptDataObject)
      const allKeys = new Set([...objKeys1, ...objKeys2])

      for (const key of allKeys) {
        const newPath = path ? `${path}.${key}` : key
        const val1 = (obj1 as ScriptDataObject)[key]
        const val2 = (obj2 as ScriptDataObject)[key]

        if (val2 === undefined) {
          changes.push(`${newPath}: ${JSON.stringify(val1)} → (removed)`)
        } else if (val1 === undefined) {
          changes.push(`${newPath}: (added) → ${JSON.stringify(val2)}`)
        } else {
          findChanges(val1, val2, newPath)
        }
      }
    }
  }

  findChanges(props.before, props.after)

  return (
    <Show when={changes.length > 0}>
      <Card variant="outlined" style={{ margin: '0.5rem 0', 'font-size': '0.85rem' }}>
        <CardBody padding="sm">
          <div class={styles.header}>Script Data Changes:</div>
          <div class={styles.changesContainer}>
            <For each={changes}>
              {(change, index) => (
                <div class={index() < changes.length - 1 ? styles.changeRowWithBorder : styles.changeRow}>
                  <span class={styles.bulletPoint}>• </span>
                  {change}
                </div>
              )}
            </For>
          </div>
        </CardBody>
      </Card>
    </Show>
  )
}
