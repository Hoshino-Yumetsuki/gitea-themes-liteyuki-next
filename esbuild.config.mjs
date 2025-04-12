import { build as esbuild } from 'esbuild'
import {
    existsSync,
    mkdirSync,
    copyFileSync,
    rmSync,
    statSync,
    readdirSync,
    lstatSync
} from 'fs'
import { join, normalize, dirname, relative } from 'path'
import { minify } from 'terser'

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

    // Define theme files to process
    const themeFiles = [
        {
            entryFile: 'src/public/assets/css/theme-liteyuki-magipoke.css',
            outputFile: join(outputDir, 'theme-liteyuki-magipoke.css'),
            themeName: 'theme-liteyuki-magipoke'
        },
        {
            entryFile: 'src/public/assets/css/theme-snowykami.css',
            outputFile: join(outputDir, 'theme-snowykami.css'),
            themeName: 'theme-snowykami'
        }
    ]

    // Process each theme file
    for (const theme of themeFiles) {
        if (existsSync(theme.entryFile)) {
            console.log(`Processing theme: ${theme.themeName}`)
            await bundleThemeFile(
                theme.entryFile,
                theme.outputFile,
                theme.themeName
            )
        } else {
            console.error(`Error: Theme file not found: ${theme.entryFile}`)
        }
    }
}

// Helper function to bundle theme files
async function bundleThemeFile(entryFile, outputFile, themeName) {
    try {
        console.log(
            `Bundling ${themeName} from ${entryFile} to ${outputFile}...`
        )

        // Use esbuild's build API to handle imports
        const result = await esbuild({
            entryPoints: [entryFile],
            outfile: outputFile,
            bundle: true,
            minify: true,
            loader: {
                '.css': 'css'
            },
            logLevel: 'info',
            banner: {
                css: `/* ${themeName} theme bundle */\n`
            },
            write: true,
            metafile: true,
            external: ['*.jpg', '*.png', '*.svg', '*.gif', 'https://*'] // Don't try to bundle image files or external URLs
        })

        // Log any warnings
        if (result.warnings && result.warnings.length > 0) {
            console.warn(`Warnings for ${themeName}:`, result.warnings)
        }

        // Check if the output file is empty or exists
        if (!existsSync(outputFile)) {
            console.error(`Error: Output file was not created: ${outputFile}`)
            return
        }

        const stats = statSync(outputFile)
        if (stats.size === 0) {
            console.error(`Warning: ${outputFile} is empty!`)
        } else {
            console.log(
                `Successfully bundled ${themeName} theme to ${outputFile} (${(
                    stats.size / 1024
                ).toFixed(1)}kb)`
            )
        }
    } catch (error) {
        console.error(`Error bundling ${themeName} theme:`, error.message)
        if (error.errors) {
            console.error(
                `Detailed errors for ${themeName}:`,
                JSON.stringify(error.errors, null, 2)
            )
        }
    }
}

// Copy other files
async function copyOtherFiles() {
    // Function to recursively get all files from a directory
    function getAllFiles(dirPath, arrayOfFiles = []) {
        const files = readdirSync(dirPath)
        
        files.forEach(file => {
            const filePath = join(dirPath, file)
            if (lstatSync(filePath).isDirectory()) {
                arrayOfFiles = getAllFiles(filePath, arrayOfFiles)
            } else {
                arrayOfFiles.push(filePath)
            }
        })
        
        return arrayOfFiles
    }
    
    // Get all files from src directory
    const allFiles = getAllFiles('src')

    // Filter out CSS files that we've already bundled
    const cssPattern = normalize('src/public/assets/css')
    const filesToCopy = allFiles.filter((file) => {
        const normalizedPath = normalize(file)
        return !normalizedPath.startsWith(cssPattern)
    })

    // Copy each file to the dist directory
    for (const file of filesToCopy) {
        const normalizedFile = normalize(file)
        const destPath = normalizedFile.replace(
            normalize('src/'),
            normalize('dist/')
        )
        ensureDirectoryExists(dirname(destPath))
        
        // If it's a JavaScript file, minify it with terser
        if (normalizedFile.endsWith('.js')) {
            await minifyJSFile(normalizedFile, destPath)
        } else {
            copyFileSync(normalizedFile, destPath)
        }
    }
}

// Minify JavaScript files with terser
async function minifyJSFile(srcPath, destPath) {
    try {
        const code = await import('fs').then(fs => fs.promises.readFile(srcPath, 'utf8'))
        const result = await minify(code, {
            compress: true,
            mangle: true
        })
        
        if (result.code) {
            await import('fs').then(fs => fs.promises.writeFile(destPath, result.code))
            console.log(`Minified JS file: ${relative(process.cwd(), destPath)}`)
        } else {
            // Fallback to copy if minification fails
            copyFileSync(srcPath, destPath)
            console.warn(`Warning: Could not minify ${relative(process.cwd(), srcPath)}, copied instead`)
        }
    } catch (error) {
        console.error(`Error minifying ${relative(process.cwd(), srcPath)}:`, error.message)
        // Fallback to copy if minification fails
        copyFileSync(srcPath, destPath)
    }
}

// Main build function
async function mainBuild() {
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
mainBuild().catch((err) => {
    console.error('Build failed:', err)
    process.exit(1)
})
