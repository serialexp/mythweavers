import { PropsWithChildren } from 'react'
import { Helmet } from 'react-helmet'
import { useColorMode } from '../hooks/use-color-mode'
import { useAppDispatch, useAppSelector } from '../store'
import { Navitem } from '../ui-components/navitem/navitem'
import { AddToBookshelf } from './add-to-bookshelf'
import UserStatus from './user-status'
export const Layout = (props: PropsWithChildren) => {
  const colorMode = useColorMode()
  const { isOpen, storyId } = useAppSelector((state) => state.bookshelf)
  const _dispatch = useAppDispatch()
  return (
    <div className="flex flex-col min-h-screen" data-theme={colorMode === 'light' ? 'fantasy' : 'forest'}>
      <Helmet>
        <meta charSet="utf-8" />
        <title>Unknown - Reader</title>
      </Helmet>
      <nav className="sticky navbar top-0 bg-base-100 text-base-content dark:bg-gray-900 dark:text-gray-300 shadow-md z-50">
        <div className="container m-auto">
          <div>
            <Navitem to="/" className="btn btn-ghost text-xl">
              Reader
            </Navitem>
          </div>
          <div className="flex-none">
            <ul className="menu menu-horizontal px-1">
              <li>
                <Navitem to="/">Home</Navitem>
              </li>
              <li>
                <Navitem to="/stories">Stories</Navitem>
              </li>
              <li>
                <Navitem to="/download">Download Writer</Navitem>
              </li>
            </ul>
          </div>

          <UserStatus />
        </div>
      </nav>
      <main
        className="flex-grow overflow-hidden"
        style={{
          backgroundImage: colorMode === 'dark' ? 'url(/bg-dark.png)' : 'url(/bg-light.png)',
          backgroundAttachment: 'fixed',
          backgroundSize: 'cover',
        }}
      >
        <div className="container mx-auto flex-1">
          <div className="bg-base-100 p-4 h-full">{props.children}</div>
        </div>
      </main>
      {storyId ? <AddToBookshelf storyId={storyId} isOpen={isOpen} /> : null}
    </div>
  )
}
