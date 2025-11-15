import * as fs from 'fs';
import * as path from 'path';

/** Converts a string to a file-safe name. */
export function toFileSafeName(name: string): string {
    // Replace invalid file characters with an underscore
    return name.replace(/[\/\\:*?"<>|]/g, '_').trim();
}

/** Ensures a directory exists, creating it if necessary. */
export function ensureDir(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

/** Determines the output image path and relative path for CSV. */
export function getImagePath(baseDir: string, imageSubFolder: string, baseName: string, type: 'screenshot' | 'logo', index: number = 1): { fullPath: string; relativePath: string } {
    const safeBaseName = toFileSafeName(baseName);
    const fileName = type === 'screenshot' 
        ? `${safeBaseName}.png` 
        : `${safeBaseName}-${index}.png`;
    
    const fullImagePath = path.join(baseDir, imageSubFolder, fileName);
    const relativeImagePath = path.join(imageSubFolder, fileName);

    return { fullPath: fullImagePath, relativePath: relativeImagePath.replace(/\\/g, '/') };
}