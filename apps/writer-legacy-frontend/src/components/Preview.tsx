import { join } from '@tauri-apps/api/path'
import { open } from '@tauri-apps/plugin-dialog'
import { writeTextFile } from '@tauri-apps/plugin-fs'
import { Command, open as shellOpen } from '@tauri-apps/plugin-shell'
import markdownit from 'markdown-it'
import { createEffect, createSignal } from 'solid-js'
import { booksStore } from '../lib/stores/books'
import { addNotification } from '../lib/stores/notifications'
import { SortedParagraphObject, sortedObjects } from '../lib/stores/retrieval/sorted-objects'
import { updateSceneParagraphData } from '../lib/stores/scenes'
import { storyState } from '../lib/stores/story'
import { findPathToNodeIds } from '../lib/stores/tree'
import { uiState } from '../lib/stores/ui'

const md = markdownit({
  html: true,
  typographer: true,
})

export const Preview = () => {
  const text = sortedObjects(uiState.currentId)
    .map((item) => {
      if (item.type === 'paragraph') {
        return `${md.render(item.text.trim())}`
      }
      if (item.type === 'chapter_header') {
        return `<h1>${item.text}</h1>`
      }
      if (item.type === 'break') {
        return `<div><img style="margin: 2em auto; display: block;" src="https://pub-43e7e0f137a34d1ca1ce3be7325ba046.r2.dev/Group.png" /></div>`
      }
      return undefined
    })
    .filter((i) => i)
    .join('\n')

  const inlineText = sortedObjects(uiState.currentId, false, {
    translationsInline: true,
  })
    .map((item) => {
      if (item.type === 'paragraph') {
        return `${md.render(item.text.trim())}`
      }
      if (item.type === 'chapter_header') {
        return `<h1>${item.text}</h1>`
      }
      if (item.type === 'break') {
        return `<div><img style="margin: 2em auto; display: block;" src="https://pub-43e7e0f137a34d1ca1ce3be7325ba046.r2.dev/Group.png" /></div>`
      }
      return undefined
    })
    .filter((i) => i)
    .join('\n')

  const [typstText, setTypstText] = createSignal('')
  createEffect(() => {
    const process = async () => {
      let title = ''
      let author = ''
      let editor = ''
      let coverArtist = ''
      let titleText = ''
      let separatorImage = ''
      const contentPath = findPathToNodeIds(uiState.currentId ?? '')
      const book = booksStore.books[contentPath[0]]

      if (!book) {
        addNotification({
          title: 'Book not found',
          message: `Book ${contentPath[0]} not found`,
          type: 'error',
        })
        return
      }
      title = book.title
      author = book.author ?? ''
      editor = book.editor ?? ''
      coverArtist = book.coverArtist ?? ''
      separatorImage = book.separatorImage ?? ''

      const contentText = await Promise.all(
        sortedObjects(uiState.currentId).map(async (item) => {
          if (item.type === 'book_cover') {
            titleText = `#page(
              margin: (x: 0cm, y: 0cm),
            )[
              #align(center)[\n  #image("data${item.coverImage}", width: 100%, height: 100%)\n]\n#pagebreak()\n
            ]\n#align(center)[\n= ${title}\n\n== ${author}\n]\n#pagebreak()\n
            #set text(8pt)\n#align(left + bottom)[\n#block(width: 95%)[
            Copyright ${new Date().getFullYear()} ${author}
            
            All rights reserved. No part of this publication may be reproduced, stored or transmitted in any form or by any means, electronic, mechanical, photocopying, recording, scanning, or otherwise without prior written permission from the author. It is illegal to copy this book, post it to a website, or distribute it by any other means without permission.
            
            This novel is entirely a work of fiction. The names, characters and incidents portrayed in it are the work of the author's imagination. Any resemblance to actual persons, living or dead, events or localities is entirely coincidental.
            
            ISBN: xxxx
            
            reader.serial-experiments.com
            
            First Edition
            
            Editing by ${editor}
            
            Book cover design by ${coverArtist}
            ]\n]\n#pagebreak()\n#counter(page).update(1) \n`
          }
          if (item.type === 'paragraph') {
            return `${item.plainText
              .replaceAll('#', '\\#')
              .replaceAll('$', '\\$')
              .replaceAll('<', '\\<')
              .replaceAll('>', '\\>')
              .replaceAll('╬', '\\╬')
              .replaceAll(/([^\w\.\? \”])_([^\w\.\? \”])/gm, '$1\\_$2')
              .replaceAll('@', '\\@')
              .replace(/\s*\*\*([\w ]+)\*\*$/g, (_match, p1) => {
                return `=== ${p1}`
              })
              // any number of asterisks on a single line
              .replaceAll(
                /^\*+$/gm,
                `#align(center)[\n #block(above: 1cm, below: 1cm)[\n  #image("data${separatorImage}", width: 50%)\n]\n]\n`,
              )
              .replaceAll(
                '----- * * * -----',
                `#align(center)[\n #block(above: 1cm, below: 1cm)[\n  #image("data${separatorImage}", width: 50%)\n]\n]\n`,
              )
              .replaceAll(
                '* * *',
                `#align(center)[\n #block(above: 1cm, below: 1cm)[\n  #image("data${separatorImage}", width: 50%)\n]\n]\n`,
              )
              .replace(/^\* /gm, '- ')
              .replace(/_{2,}/g, '`--`')}\n`
          }
          if (item.type === 'chapter_header') {
            return `#align(center)[\n= ${item.text}\n]\n`
          }
          if (item.type === 'break') {
            return `#align(center)[\n #block(above: 1cm, below: 1cm)[\n  #image("data${separatorImage}", width: 50%)\n]\n]\n`
          }
          return undefined
        }),
      ).then((i) => {
        return i.filter((i) => i).join('\n')
      })
      const newTypstText = `#import "@preview/cmarker:0.1.0"
#import "@preview/hydra:0.5.1": hydra
#set text(
  font: ("Libertinus Serif", "New Computer Modern"),
  size: 10pt
)
#set page(
  paper: "us-digest",
  margin: (x: 12.7mm, y: 14.7mm),
)
#show heading.where(level: 1): set block(below: 3cm)
#show heading.where(level: 3): set block(below: 1cm)
#show heading.where(level: 1): it => {
  pagebreak(to: "odd", weak: true)
  pad(top: 3cm, smallcaps(it))
}
#show heading.where(level: 1): it => { pagebreak(weak: true); it }

#set par(
  justify: false,
  leading: 0.65em,
  spacing: 1.22em,
)\n\n${titleText}\n\n
#set page(
  header: context {
    let curr_page = here().page()
    let header1s = query(selector(heading.where(level: 1)))
    let anchor = header1s.map(it => {it.location().page()})
    if curr_page not in anchor {
      if calc.odd(curr_page) {
        align(center, smallcaps("${title}"))
      } else {
        align(center, smallcaps("${author}"))
      }
    }
  },
  numbering: "1",
)
  #set par(
  justify: true,
  first-line-indent: 1.2em,
  spacing: 0.82em,
  )
  #set text(10pt)
\n${contentText}`
      setTypstText(newTypstText)
    }
    process()
  })

  const [tab, setTab] = createSignal(0)

  return (
    <div class="flex flex-col h-full w-full">
      <div class="flex w-full tabs tabs-bordered">
        <button class={`tab ${tab() === 0 ? 'tab-active' : ''}`} type="button" onClick={() => setTab(0)}>
          HTML Source
        </button>
        <button class={`tab ${tab() === 1 ? 'tab-active' : ''}`} type="button" onClick={() => setTab(1)}>
          Typst Source
        </button>
        <button class={`tab ${tab() === 2 ? 'tab-active' : ''}`} type="button" onClick={() => setTab(2)}>
          Rendered
        </button>
      </div>
      <div class="flex-1 overflow-y-auto px-4 py-2">
        {tab() === 0 && (
          <div>
            <p>Designed for easy copying to the place you publish</p>
            <textarea
              class="textarea textarea-bordered"
              id={'preview'}
              rows={10}
              value={text}
              onClick={() => {
                //select all
                setTimeout(() => {
                  const textarea: HTMLTextAreaElement | null = document.querySelector('#preview')
                  if (textarea) {
                    textarea.select()
                    textarea.setSelectionRange(0, 99999)
                    navigator.clipboard.writeText(textarea.value)
                  }
                }, 0)
              }}
            />
            <textarea
              class="textarea textarea-bordered"
              id={'preview_inline'}
              rows={10}
              value={inlineText}
              onClick={() => {
                //select all
                setTimeout(() => {
                  const textarea: HTMLTextAreaElement | null = document.querySelector('#preview_inline')
                  if (textarea) {
                    textarea.select()
                    textarea.setSelectionRange(0, 99999)
                    navigator.clipboard.writeText(textarea.value)
                  }
                }, 0)
              }}
            />
            <div class="mt-4">
              <h3 class="text-lg font-bold mb-2">Translations</h3>
              <textarea
                class="textarea textarea-bordered w-full"
                id={'translations'}
                rows={10}
                value={`<table>
  <tr>
    <th>English</th>
    <th>Original</th>
  </tr>
${sortedObjects(uiState.currentId)
  .filter((obj): obj is SortedParagraphObject => obj.type === 'paragraph')
  .flatMap((obj) => obj.translations ?? [])
  .map(
    (translation) => `  <tr>
    <td>${translation.original}</td>
    <td>${translation.translation}</td>
  </tr>`,
  )
  .join('\n')}\n</table>`}
                onClick={() => {
                  setTimeout(() => {
                    const textarea: HTMLTextAreaElement | null = document.querySelector('#translations')
                    if (textarea) {
                      textarea.select()
                      textarea.setSelectionRange(0, 99999)
                      navigator.clipboard.writeText(textarea.value)
                    }
                  }, 0)
                }}
              />
            </div>
          </div>
        )}
        {tab() === 1 && (
          <div>
            <p>Designed for easy rendering to PDF/HTML/Markdown</p>
            <textarea
              class="textarea textarea-bordered"
              id={'preview_typst'}
              rows={10}
              value={typstText()}
              onClick={() => {
                //select all
                setTimeout(() => {
                  const textarea: HTMLTextAreaElement | null = document.querySelector('#preview_typst')
                  if (textarea) {
                    textarea.select()
                    textarea.setSelectionRange(0, 99999)
                    navigator.clipboard.writeText(textarea.value)
                  }
                }, 0)
              }}
            />
            <button
              class="btn btn-primary"
              type="button"
              onClick={async () => {
                const savePath = await open({
                  multiple: false,
                  directory: false,
                })
                if (savePath) {
                  await writeTextFile(savePath.path, typstText())
                }
              }}
            >
              Save
            </button>
            <button
              type="button"
              class="btn btn-primary"
              onClick={async () => {
                if (!storyState.openPath) {
                  console.log('no open path')
                  return
                }
                await writeTextFile(await join(storyState.openPath, `${uiState.currentId}.typ`), typstText())
                console.log('typst out')
                const command = Command.sidecar('binaries/typst', [
                  'compile',
                  await join(storyState.openPath, `${uiState.currentId}.typ`),
                ])
                console.log('typst command', command)
                const output = await command.execute()
                console.log('typst output', output)
                if (output.code === 0) {
                  await shellOpen(await join(storyState.openPath, `${uiState.currentId}.pdf`))
                } else {
                  addNotification({
                    title: 'Typst Error',
                    message: output.stderr,
                    pre: true,
                    type: 'error',
                  })
                }
              }}
            >
              Render
            </button>
          </div>
        )}
        {tab() === 2 && (
          <div>
            <div class="max-w-xl m-auto">
              {sortedObjects(uiState.currentId, false, {
                translationsInline: true,
              }).map((scene) => {
                if (scene.type === 'summary') {
                  return (
                    <div class="p-4 my-2 bg-base-300">
                      Words: {scene.words}, TTS Cost: {((scene.words * 6) / 1_000_000) * 15} AI Words: {scene.aiWords},
                      Books: {scene.books}, Chapters: {scene.chapters}, Scenes: {scene.scenes}, Reading time:{' '}
                      {Math.round(((scene.words + scene.aiWords) / 14280) * 100) / 100} hours
                    </div>
                  )
                }
                if (scene.type === 'chapter_header') {
                  return <h1 class="w-full text-center text-xl">{scene.text}</h1>
                }
                if (scene.type === 'break') {
                  return (
                    <div class="my-12 m-auto flex justify-center">
                      <img alt={'break'} src={'https://pub-43e7e0f137a34d1ca1ce3be7325ba046.r2.dev/Group.png'} />
                    </div>
                  )
                }
                if (scene.type === 'paragraph') {
                  const textElement = document.createElement('div')
                  textElement.innerHTML = scene.text.replaceAll('--', '—')
                  return (
                    <div
                      class={`relative font-serif indent-4 my-2 group ${
                        scene.state === 'sdt'
                          ? 'text-purple-500'
                          : scene.state === 'revise'
                            ? 'text-red-500'
                            : scene.posted
                              ? 'text-gray-600'
                              : undefined
                      }`}
                    >
                      {textElement}
                      <div class="absolute right-[-30px] bottom-[0px] flex gap-2 items-center select-none hidden group-hover:flex">
                        <button
                          type="button"
                          class="btn btn-xs"
                          title={'Revise'}
                          onClick={() => {
                            updateSceneParagraphData(scene.sceneId, scene.paragraphId, {
                              state: 'revise',
                            })
                          }}
                        >
                          R
                        </button>
                        <button
                          type="button"
                          class="btn btn-xs"
                          title={"Show don't tell"}
                          onClick={() => {
                            updateSceneParagraphData(scene.sceneId, scene.paragraphId, { state: 'sdt' })
                          }}
                        >
                          SDT
                        </button>
                      </div>
                    </div>
                  )
                }
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
