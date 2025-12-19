import * as fs from 'node:fs'
import * as path from 'node:path'
import { Octokit } from '@octokit/rest'
import type { Release } from '@writer/legacy-backend/src/procedures/get-releases'
import axios from 'axios'
import * as lzma from 'lzma-native'
import * as tar from 'tar'
import * as unzipper from 'unzipper'

const CACHE_DIR = path.join('.typst-cache')
const RELEASES_CACHE_FILE = path.join(CACHE_DIR, 'releases.json')
const DOWNLOAD_DIR = path.join(CACHE_DIR, 'downloads')
const EXTRACT_DIR = path.join(CACHE_DIR, 'extracted')

const ensureDirExists = (dir: string) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

const cacheReleases = async (releases: any) => {
  ensureDirExists(CACHE_DIR)
  fs.writeFileSync(RELEASES_CACHE_FILE, JSON.stringify(releases, null, 2))
}

const getCachedReleases = () => {
  if (fs.existsSync(RELEASES_CACHE_FILE)) {
    const data = fs.readFileSync(RELEASES_CACHE_FILE, 'utf-8')
    return JSON.parse(data)
  }
  return null
}

const downloadFile = async (url: string, dest: string) => {
  const writer = fs.createWriteStream(dest)
  const response = await axios({
    url,
    method: 'GET',
    responseType: 'stream',
  })

  response.data.pipe(writer)

  return new Promise((resolve, reject) => {
    writer.on('finish', resolve)
    writer.on('error', reject)
  })
}

const extractFile = async (filePath: string, destDir: string) => {
  ensureDirExists(destDir)
  console.log('filePath', filePath)

  const fileName = path.basename(filePath)
  console.log('filename', fileName)
  const extensionlessFile = fileName.slice(0, fileName.indexOf('.'))
  console.log('extensionless', extensionlessFile)
  const fileExt = path.extname(fileName)
  const baseName = path.basename(fileName, fileExt)

  const unzipFile = async (inputPath: string, outputPath: string) => {
    if (fileExt === '.zip') {
      await fs
        .createReadStream(inputPath)
        .pipe(unzipper.Extract({ path: outputPath }))
        .promise()
    } else if (fileExt === '.xz') {
      const writePath = path.join(outputPath, baseName)
      console.log('decompress using xz', writePath)
      const decompressor = lzma.createDecompressor()
      const input = fs.createReadStream(inputPath)
      const output = fs.createWriteStream(writePath)

      input.pipe(decompressor).pipe(output)

      return new Promise((resolve, reject) => {
        output.on('finish', resolve)
        output.on('error', reject)
      })
    }
  }

  const untarFile = async (inputPath: string, outputPath: string, finalName: string) => {
    console.log('untarring', {
      inputPath,
      outputPath,
      finalName,
    })
    const finalPath = path.join(outputPath, finalName)
    const tempExtractPath = path.join(outputPath, 'tar-temp')

    // Clean up any existing paths
    if (fs.existsSync(finalPath)) {
      fs.rmSync(finalPath, { recursive: true, force: true })
    }
    if (fs.existsSync(tempExtractPath)) {
      fs.rmSync(tempExtractPath, { recursive: true, force: true })
    }

    // Create temp directory for tar extraction
    fs.mkdirSync(tempExtractPath, { recursive: true })

    // Extract tar file
    await tar.x({
      file: inputPath,
      cwd: tempExtractPath,
      filter: (path) => path.endsWith('typst'),
    })

    // Find and move the typst binary
    const files = fs.readdirSync(tempExtractPath, { recursive: true }) as string[]
    console.log('files', files)
    const typstFile = files.find((f) => f.endsWith('typst'))

    if (typstFile) {
      const sourcePath = path.join(tempExtractPath, typstFile)
      console.log('sourcePath', sourcePath, 'to', finalPath)
      fs.renameSync(sourcePath, finalPath)
    } else {
      console.error('No typst binary found in extracted files')
    }

    // Clean up temp directory
    //fs.rmSync(tempExtractPath, { recursive: true, force: true });
  }

  const tempDir = path.join(destDir, 'temp')
  ensureDirExists(tempDir)

  console.log('unzipping to', tempDir)
  await unzipFile(filePath, tempDir)
  console.log('decompressing')
  if (fileName.includes('.tar')) {
    const tarFilePath = path.join(tempDir, baseName)
    await untarFile(tarFilePath, destDir, extensionlessFile)
  } else {
    const fileWithTypst = fs.readdirSync(path.join(tempDir, extensionlessFile)).find((f) => f.startsWith('typst'))
    console.log('fileWithTypst', fileWithTypst)
    if (!fileWithTypst) {
      throw new Error('No typst binary found in extracted files')
    }
    console.log(' extensionlessFile3', extensionlessFile)
    const fileExtension = path.extname(fileWithTypst)
    const extractedFilePath = path.join(tempDir, extensionlessFile, fileWithTypst)
    const finalFilePath = path.join(destDir, `${extensionlessFile}${fileExtension}`)
    console.log({
      extractedFilePath,
      finalFilePath,
      tempDir,
      extensionlessFile,
      fileName,
      fileWithTypst,
    })
    console.log('renaming', extractedFilePath, 'to', finalFilePath)
    if (fs.existsSync(extractedFilePath)) {
      fs.renameSync(extractedFilePath, finalFilePath)
    } else {
      console.error('File not found', extractedFilePath)
    }
  }

  fs.rmSync(tempDir, { recursive: true, force: true })
}

const downloadReleaseAssets = async (release: Release) => {
  ensureDirExists(DOWNLOAD_DIR)
  const assets = release.assets

  for (const asset of assets) {
    try {
      const assetPath = path.join(DOWNLOAD_DIR, asset.name)
      const base = path.basename(asset.name)
      const baseWithoutExtension = base.slice(0, base.indexOf('.'))

      const extractPath = path.join(EXTRACT_DIR, baseWithoutExtension)

      if (!fs.existsSync(assetPath)) {
        console.log(`Downloading ${asset.name}...`)
        await downloadFile(asset.browser_download_url, assetPath)
      } else {
        console.log(`${asset.name} already exists, skipping download.`)
      }

      console.log(`Extracting ${asset.name}...`)
      await extractFile(assetPath, extractPath)
    } catch (error) {
      console.error(`Error extracting ${asset.name}:`, error)
    }
  }

  // move typst binary to the right place, read all files in the directory and move the typst binary to the right place
  const files = fs.readdirSync(EXTRACT_DIR)
  const typstFile = files.find((f) => f.startsWith('typst'))
  if (typstFile) {
    const sourcePath = path.join(EXTRACT_DIR, typstFile, typstFile)
    console.log('sourcePath', sourcePath, 'to ', path.join('src-tauri', 'binaries', typstFile))
    fs.renameSync(sourcePath, path.join('src-tauri', 'binaries', typstFile))
  }
}

const doThings = async () => {
  const octokit = new Octokit({})
  let releases = getCachedReleases()

  if (!releases) {
    console.log('Fetching releases from GitHub...')
    releases = await octokit.repos.listReleases({
      owner: 'typst',
      repo: 'typst',
    })
    await cacheReleases(releases.data)
    releases = releases.data
  } else {
    console.log('Using cached releases...')
  }

  const latestRelease = releases[0]
  console.log(latestRelease)

  await downloadReleaseAssets(latestRelease)
}

doThings()
