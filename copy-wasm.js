import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const sourceDir = path.join(__dirname, 'node_modules', 'web-ifc')
const targetDir = path.join(__dirname, 'public')

// Create public directory if it doesn't exist
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir)
}

// Copy WASM and worker files
const wasmFiles = [
  'web-ifc.wasm',
  'web-ifc-mt.wasm',
  'web-ifc-node.wasm',
  'web-ifc-mt.worker.js'
]

wasmFiles.forEach(file => {
  const sourcePath = path.join(sourceDir, file)
  const targetPath = path.join(targetDir, file)
  
  if (fs.existsSync(sourcePath)) {
    fs.copyFileSync(sourcePath, targetPath)
    console.log(`Copied ${file} to public directory`)
  } else {
    console.warn(`Warning: ${file} not found in source directory`)
  }
}) 