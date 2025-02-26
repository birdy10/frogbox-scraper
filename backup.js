const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

function backupFiles() {
    // Get absolute path to the project root
    const projectRoot = path.resolve(__dirname);
    const backupDir = path.join(projectRoot, 'BACKUP');

    // Debug log paths
    console.log('Project root:', projectRoot);
    console.log('Backup directory:', backupDir);

    // Create BACKUP directory if it doesn't exist
    if (!fs.existsSync(backupDir)) {
        try {
            fs.mkdirSync(backupDir, { recursive: true });
            console.log('Created BACKUP directory at:', backupDir);
        } catch (err) {
            console.error('Error creating BACKUP directory:', err);
            return;
        }
    }
    
    // Find existing backups and get next number
    let backupNum = 30;  
    const files = fs.readdirSync(backupDir);
    const backupRegex = /^(\d{2})\s+FrogBox Graphics scraper\.zip$/;
    
    // Find existing backup files and their numbers
    const backupFiles = files.filter(f => backupRegex.test(f));
    if (backupFiles.length > 0) {
        const nums = backupFiles.map(f => {
            const match = f.match(backupRegex);
            return match ? parseInt(match[1]) : 0;
        });
        backupNum = Math.max(...nums) + 1;
    }

    // Format number with leading zeros (01, 02, etc)
    const paddedNum = String(backupNum).padStart(2, '0');
    const zipName = `${paddedNum} FrogBox Graphics scraper.zip`;
    const zipPath = path.join(backupDir, zipName);
    console.log('Creating backup at:', zipPath);

    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => {
        console.log(`Backup created: ${zipName} (${archive.pointer()} bytes)`);
    });

    archive.on('error', (err) => {
        throw err;
    });

    archive.pipe(output);

    // Add all files except node_modules, .vscode, BACKUP folder and existing zip files
    fs.readdirSync(projectRoot).forEach(file => {
        const fullPath = path.join(projectRoot, file);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
            if (file !== 'node_modules' && file !== 'BACKUP' && file !== '.vscode') {
                archive.directory(fullPath, file);
            }
        } else if (!file.endsWith('.zip')) {
            archive.file(fullPath, { name: file });
        }
    });

    archive.finalize();
}

module.exports = { backupFiles };
