import { transform } from 'esbuild'
import {
    existsSync,
    mkdirSync,
    readFileSync,
    writeFileSync,
    copyFileSync,
    rmSync,
    statSync
} from 'fs'
import { join, normalize, dirname } from 'path'
import { sync } from 'glob'

// Ensure output directories exist
const ensureDirectoryExists = (dirPath) => {
    if (!existsSync(dirPath)) {
        mkdirSync(dirPath, { recursive: true })
    }
}

// CSS bundling
async function bundleCSS() {
    const outputDir = 'dist/public/assets/css'
    ensureDirectoryExists(outputDir)

    // Bundle theme-liteyuki-magipoke
    const liteyukiFiles = sync(
        'src/public/assets/css/theme-liteyuki-magipoke*.css'
    )

    if (liteyukiFiles.length > 0) {
        await bundleThemeFiles(
            liteyukiFiles,
            join(outputDir, 'theme-liteyuki-magipoke.css'),
            'theme-liteyuki-magipoke'
        )
    }

    // Bundle theme-snowykami
    const snowykamiFiles = sync('src/public/assets/css/theme-snowykami.css')

    if (snowykamiFiles.length > 0) {
        await bundleThemeFiles(
            snowykamiFiles,
            join(outputDir, 'theme-snowykami.css'),
            'theme-snowykami'
        )
    }
}

// Helper function to bundle theme files
async function bundleThemeFiles(files, outputFile, themeName) {
    // Read all CSS files and concatenate them
    let combinedCSS = `/* ${themeName} theme bundle */\n`
    for (const file of files) {
        const content = readFileSync(file, 'utf8')
        combinedCSS += `/* ${file} */\n${content}\n\n`
    }

    // Use esbuild to minify the combined CSS
    const result = await transform(combinedCSS, {
        loader: 'css',
        minify: true
    })

    // Write the result to the output file
    writeFileSync(outputFile, result.code)

    // Check if the output file is empty
    const stats = existsSync(outputFile) ? statSync(outputFile) : { size: 0 }

    if (stats.size === 0) {
        console.error(`Warning: ${outputFile} is empty!`)
    }
}

// Copy other files
async function copyOtherFiles() {
    // Get all files from src directory
    const allFiles = sync('src/**/*', { nodir: true })

    // Filter out CSS files that we've already bundled
    const cssPattern = normalize('src/public/assets/css')
    const filesToCopy = allFiles.filter((file) => {
        const normalizedPath = normalize(file)
        return !normalizedPath.startsWith(cssPattern)
    })

    // Copy each file to the dist directory
    filesToCopy.forEach((file) => {
        const normalizedFile = normalize(file)
        const destPath = normalizedFile.replace(
            normalize('src/'),
            normalize('dist/')
        )
        ensureDirectoryExists(dirname(destPath))
        copyFileSync(normalizedFile, destPath)
    })
}

// Main build function
async function build() {
    // Clean dist directory if it exists
    if (existsSync('dist')) {
        rmSync('dist', { recursive: true, force: true })
    }

    // Create dist directory
    ensureDirectoryExists('dist')

    // Run build tasks
    await bundleCSS()
    await copyOtherFiles()
}

// Run the build
build().catch((err) => {
    console.error('Build failed:', err)
    process.exit(1)
})
