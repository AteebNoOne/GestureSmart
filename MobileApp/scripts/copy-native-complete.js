const fs = require('fs');
const path = require('path');

// Cross-platform recursive copy function
function copyFolderRecursive(source, target) {
    // Create target directory if it doesn't exist
    if (!fs.existsSync(target)) {
        fs.mkdirSync(target, { recursive: true });
    }

    // Get all files and folders
    const items = fs.readdirSync(source);

    items.forEach(item => {
        const sourcePath = path.join(source, item);
        const targetPath = path.join(target, item);

        if (fs.lstatSync(sourcePath).isDirectory()) {
            // Recursively copy subdirectories
            copyFolderRecursive(sourcePath, targetPath);
        } else {
            // Copy file
            fs.writeFileSync(targetPath, fs.readFileSync(sourcePath));
        }
    });
}

function copyNativeFiles() {
    console.log('🚀 Copying native files from android/app/src/main...\n');

    const basePath = path.join(__dirname, '..');
    const sourceDir = path.join(basePath, 'android/app/src/main');
    const targetDir = path.join(basePath, 'native/main');

    try {
        if (!fs.existsSync(sourceDir)) {
            console.error('❌ Source directory not found:', sourceDir);
            process.exit(1);
        }

        console.log('📁 Copying from:', sourceDir);
        console.log('📁 Copying to:', targetDir);

        // Remove existing target directory if it exists
        if (fs.existsSync(targetDir)) {
            console.log('🗑️ Removing existing backup...');
            fs.rmSync(targetDir, { recursive: true, force: true });
        }

        // Copy the entire main folder
        copyFolderRecursive(sourceDir, targetDir);

        console.log('✅ Native files copied successfully!');
        console.log('📁 Backup location: native/main/');

    } catch (error) {
        console.error('❌ Error copying native files:', error.message);
        process.exit(1);
    }
}

function addGradleDependencies() {
    console.log('📦 Adding required dependencies to build.gradle...');

    const basePath = path.join(__dirname, '..');
    const buildGradlePath = path.join(basePath, 'android/app/build.gradle');

    if (!fs.existsSync(buildGradlePath)) {
        console.warn('⚠️ build.gradle not found at:', buildGradlePath);
        return;
    }

    let buildGradleContent = fs.readFileSync(buildGradlePath, 'utf8');

    // Dependencies to add
    const dependencies = [
        "    implementation 'com.google.mediapipe:tasks-vision:0.10.26.1'"
    ];

    // Check if dependencies already exist (and not in wrong places)
    const hasMediaPipeCorrect = buildGradleContent.includes("implementation 'com.google.mediapipe:tasks-vision:0.10.26.1'") &&
        !buildGradleContent.includes('implementation("com.facebook.fresco:animated-gif:${expoLibs.versions.fresco.get()\n    implementation \'com.google.mediapipe:tasks-vision:0.10.26.1\'');

    if (hasMediaPipeCorrect) {
        console.log('✅ Dependencies already exist in build.gradle');
        return;
    }

    // Clean up any malformed dependencies first
    buildGradleContent = buildGradleContent.replace(
        /implementation\("com\.facebook\.fresco:animated-gif:\$\{expoLibs\.versions\.fresco\.get\(\)\s*implementation 'com\.google\.mediapipe:tasks-vision:0\.10\.26\.1'\s*"\)\}/g,
        'implementation("com.facebook.fresco:animated-gif:${expoLibs.versions.fresco.get()}")'
    );

    // Find the end of the dependencies block (last closing brace)
    const dependenciesStart = buildGradleContent.indexOf('dependencies {');
    if (dependenciesStart === -1) {
        console.warn('⚠️ Could not find dependencies block in build.gradle');
        return;
    }

    // Find the matching closing brace for dependencies block
    let braceCount = 0;
    let dependenciesEnd = -1;

    for (let i = dependenciesStart; i < buildGradleContent.length; i++) {
        if (buildGradleContent[i] === '{') {
            braceCount++;
        } else if (buildGradleContent[i] === '}') {
            braceCount--;
            if (braceCount === 0) {
                dependenciesEnd = i;
                break;
            }
        }
    }

    if (dependenciesEnd === -1) {
        console.warn('⚠️ Could not find end of dependencies block');
        return;
    }

    // Add dependencies before the closing brace
    let newDependencies = [];
    if (!hasMediaPipeCorrect) {
        newDependencies.push(dependencies[0]);
    }

    if (newDependencies.length > 0) {
        const beforeClosing = buildGradleContent.substring(0, dependenciesEnd);
        const afterClosing = buildGradleContent.substring(dependenciesEnd);

        const newBuildGradleContent = beforeClosing + '\n' + newDependencies.join('\n') + '\n' + afterClosing;

        fs.writeFileSync(buildGradlePath, newBuildGradleContent);
        console.log('✅ Added dependencies to build.gradle:');
        newDependencies.forEach(dep => console.log(`   ${dep.trim()}`));
    }
}

function restoreNativeFiles() {
    console.log('🔄 Restoring native files to android/app/src/main...\n');

    const basePath = path.join(__dirname, '..');
    const sourceDir = path.join(basePath, 'native/main');
    const targetDir = path.join(basePath, 'android/app/src/main');

    try {
        if (!fs.existsSync(sourceDir)) {
            console.error('❌ Backup directory not found:', sourceDir);
            console.log('💡 Run with "backup" command first to create a backup.');
            process.exit(1);
        }

        console.log('📁 Restoring from:', sourceDir);
        console.log('📁 Restoring to:', targetDir);

        // Remove existing target directory if it exists
        if (fs.existsSync(targetDir)) {
            console.log('🗑️ Removing existing files...');
            fs.rmSync(targetDir, { recursive: true, force: true });
        }

        // Restore the entire main folder
        copyFolderRecursive(sourceDir, targetDir);

        console.log('✅ Native files restored successfully!');

        // Add required dependencies
        addGradleDependencies();

        console.log('🚀 Ready to build your app!');

    } catch (error) {
        console.error('❌ Error restoring native files:', error.message);
        process.exit(1);
    }
}

// Check command line argument
const command = process.argv[2];

if (command === 'backup') {
    copyNativeFiles();
} else if (command === 'restore') {
    restoreNativeFiles();
} else {
    console.log('📋 Usage:');
    console.log('  node script.js backup   - Copy android/app/src/main to native/main');
    console.log('  node script.js restore  - Copy native/main back to android/app/src/main');
    console.log('');
    console.log('💡 Please specify backup or restore command.');
}