#!/usr/bin/env node
/**
 * Migration script to update @story/shared imports to @mythweavers/shared
 *
 * Usage:
 *   node scripts/migrate-story-shared-imports.mjs          # Dry run (preview changes)
 *   node scripts/migrate-story-shared-imports.mjs --apply  # Apply changes
 */

import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT_DIR = join(__dirname, '..')
const DRY_RUN = !process.argv.includes('--apply')

// Directories to search
const SEARCH_DIRS = ['apps/mythweavers-story-editor/src', 'apps/story-legacy-backend/src', 'packages/ui/src']

// File extensions to process
const EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx']

function findFiles(dir, files = []) {
  try {
    const entries = readdirSync(dir)
    for (const entry of entries) {
      const fullPath = join(dir, entry)
      const stat = statSync(fullPath)
      if (stat.isDirectory()) {
        // Skip node_modules and dist
        if (entry !== 'node_modules' && entry !== 'dist') {
          findFiles(fullPath, files)
        }
      } else if (EXTENSIONS.some((ext) => entry.endsWith(ext))) {
        files.push(fullPath)
      }
    }
  } catch (_e) {
    // Directory doesn't exist, skip
  }
  return files
}

function processFile(filePath) {
  const changes = []
  const content = readFileSync(filePath, 'utf-8')
  const lines = content.split('\n')

  // Regex to match @story/shared imports
  const importRegex = /@story\/shared/g

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (importRegex.test(line)) {
      changes.push({
        file: filePath,
        oldImport: line.trim(),
        newImport: line.replace(/@story\/shared/g, '@mythweavers/shared').trim(),
        line: i + 1,
      })
    }
    // Reset regex lastIndex
    importRegex.lastIndex = 0
  }

  return changes
}

function applyChanges(filePath) {
  const content = readFileSync(filePath, 'utf-8')
  const newContent = content.replace(/@story\/shared/g, '@mythweavers/shared')
  writeFileSync(filePath, newContent, 'utf-8')
}

function main() {
  console.log('Migration: @story/shared -> @mythweavers/shared')
  console.log('='.repeat(50))

  if (DRY_RUN) {
    console.log('\n🔍 DRY RUN - No files will be modified')
    console.log('   Run with --apply to make changes\n')
  } else {
    console.log('\n⚡ APPLYING CHANGES\n')
  }

  const allChanges = []
  const filesToUpdate = new Set()

  for (const searchDir of SEARCH_DIRS) {
    const fullDir = join(ROOT_DIR, searchDir)
    const files = findFiles(fullDir)

    for (const file of files) {
      const changes = processFile(file)
      if (changes.length > 0) {
        allChanges.push(...changes)
        filesToUpdate.add(file)
      }
    }
  }

  if (allChanges.length === 0) {
    console.log('✅ No @story/shared imports found. Nothing to migrate.')
    return
  }

  // Group changes by file
  const changesByFile = new Map()
  for (const change of allChanges) {
    const existing = changesByFile.get(change.file) || []
    existing.push(change)
    changesByFile.set(change.file, existing)
  }

  // Print changes
  console.log(`Found ${allChanges.length} import(s) in ${filesToUpdate.size} file(s):\n`)

  for (const [file, changes] of changesByFile) {
    const relPath = relative(ROOT_DIR, file)
    console.log(`📄 ${relPath}`)
    for (const change of changes) {
      console.log(`   Line ${change.line}:`)
      console.log(`   - ${change.oldImport}`)
      console.log(`   + ${change.newImport}`)
    }
    console.log()
  }

  // Apply changes if not dry run
  if (!DRY_RUN) {
    for (const file of filesToUpdate) {
      applyChanges(file)
    }
    console.log(`✅ Updated ${filesToUpdate.size} file(s)`)
  } else {
    console.log(`\nRun with --apply to update ${filesToUpdate.size} file(s)`)
  }
}

main()
