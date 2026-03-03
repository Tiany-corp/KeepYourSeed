const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '../dist');
const destDir = path.join(__dirname, '../temp_serve/kys-web-app');

// 1. Remove existing directory if it exists
if (fs.existsSync(destDir)) {
    fs.rmSync(destDir, { recursive: true, force: true });
}

// 2. Create destination directory
fs.mkdirSync(destDir, { recursive: true });

// 3. Helper function to copy recursively
function copySync(src, dest) {
    const stat = fs.statSync(src);
    if (stat.isDirectory()) {
        if (!fs.existsSync(dest)) fs.mkdirSync(dest);
        const files = fs.readdirSync(src);
        for (const file of files) {
            copySync(path.join(src, file), path.join(dest, file));
        }
    } else {
        fs.copyFileSync(src, dest);
    }
}

// 4. Perform the copy
if (fs.existsSync(srcDir)) {
    copySync(srcDir, destDir);
    console.log(`✅ Success! Copied ${srcDir} to ${destDir}`);
} else {
    console.error(`❌ Error: The 'dist' directory does not exist. Please run 'npm run build:web' first.`);
    process.exit(1);
}
