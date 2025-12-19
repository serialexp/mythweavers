import { Apple, Linux, Menu, Windows } from 'iconoir-react'
import React from 'react'
import { Helmet } from 'react-helmet'
import { trpc } from '../utils/trpc'

export const DownloadPage: React.FC = () => {
  const releases = trpc.getReleases.useQuery()

  if (releases.isLoading) {
    return <div>Loading...</div>
  }
  if (releases.error) {
    return <div>Error: {releases.error.message}</div>
  }

  return (
    <>
      <Helmet>
        <title>Releases - Reader</title>
      </Helmet>
      <h1 className="text-3xl font-bold mb-6">Writer</h1>
      <h2 className="card-title">The fuck is this?</h2>
      <p className="mt-2">
        Writer is (obviously) the companion to Reader! It's software developed with the explicit goal of writing web
        novels. It does things like keep track of chapters, characters and locations. It also has fairly heavy
        integration with a variety of AI platforms to help you with editing (and a convenient assistant for questions).
      </p>
      <p className="mt-2">
        The best feature of Writer is that everything you do happens completely offline. Lack of internet doesn't
        prevent you from writing. Some of the AI features (OpenAI, Anthropic, Groq) are obviously unavailable, but you
        could still make that work using Ollama on your local machine.
      </p>
      <div className="mb-6 card glass bg-base-100 mt-4">
        <div className="card-body">
          <p>
            This is the absolute first version of Writer and I'm sure it's full of bugs. Download the latest version to
            get the best experience. At this point we do not check for version discrepancies between client and server,
            so if you are encountering issues, please download the latest version of the writer client.
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        {releases.data?.map((release) => (
          <div key={release.id} className="flex flex-row justify-between w-full">
            <div className="flex gap-2 justify-between items-center bg-slate-100 dark:bg-slate-800 w-full p-2 rounded-lg">
              <div className="flex-1">
                <h2 className="text-xl font-semibold">{release.name}</h2>
                <p className="text-gray-600">{new Date(release.publishedAt).toLocaleString()}</p>
                <p>{release.description}</p>
              </div>
              <div className="ml-auto grid grid-cols-4 gap-2">
                {release.windowsUrl ? (
                  <a href={release.windowsUrl} className="btn btn-primary" download>
                    <Windows />
                  </a>
                ) : (
                  <div />
                )}
                {release.macUrl ? (
                  <a href={release.macUrl} className="btn btn-primary" download>
                    <Apple /> x64
                  </a>
                ) : (
                  <span className="btn btn-primary btn-disabled">
                    <Apple /> x64
                  </span>
                )}
                {release.siliconUrl ? (
                  <a href={release.siliconUrl} className="btn btn-primary" download>
                    <Apple /> ARM
                  </a>
                ) : (
                  <span className="btn btn-primary btn-disabled">
                    <Apple /> ARM
                  </span>
                )}
                {release.linuxUrl ? (
                  <a href={release.linuxUrl} className="btn btn-primary" download>
                    <Linux />
                  </a>
                ) : (
                  <div />
                )}
              </div>
              <div className="dropdown dropdown-left">
                <button type="button" className="btn btn-accent">
                  <Menu />
                </button>
                <ul className="dropdown-content menu bg-base-100 rounded-box z-[1] w-52 p-2 shadow">
                  <li>
                    <a href={release.depUrl} download>
                      .deb
                    </a>
                  </li>
                  <li>
                    <a href={release.rpmUrl} download>
                      .rpm
                    </a>
                  </li>
                  <li>
                    <a href={release.msiUrl} download>
                      .msi
                    </a>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        ))}
        {releases.data?.length === 0 && <div>No releases found</div>}
      </div>
    </>
  )
}
