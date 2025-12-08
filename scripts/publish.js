const { execSync } = require('child_process');
const path = require('path');

// Helper to execute commands in the project root
function run(command) {
    console.log(`\n> ${command}`);
    // Execute command with output inherited by parent process
    // cwd is set to project root (one level up from scripts/)
    execSync(command, { stdio: 'inherit', cwd: path.resolve(__dirname, '..') });
}

try {
    console.log('Starting publish process...');

    // 1. Delete all node_modules folders
    // -name "node_modules": find directories named node_modules
    // -type d: find directories only
    // -prune: do not descend into the current directory if it matches (optimizes and avoids errors)
    console.log('Cleaning node_modules...');
    run('find . -name "node_modules" -type d -prune -exec rm -rf "{}" +');

    // 2. Install dependencies
    console.log('Installing dependencies...');
    run('pnpm install');

    // 3. Build the project
    console.log('Building project...');
    run('pnpm build');

    // 4. Publish
    console.log('Publishing...');
    run('pnpm changeset publish');

    console.log('\nPublish process completed successfully.');
} catch (error) {
    console.error('\nPublish process failed.');
    process.exit(1);
}

