import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import * as pathUtil from 'node:path';
import {fileURLToPath} from 'node:url';

const root = pathUtil.resolve(pathUtil.dirname(fileURLToPath(import.meta.url)), '..');

const fail = (message) => {
    console.error(`deploy: ${message}`);
    process.exit(1);
};

const run = (command, args) => {
    const result = spawnSync(command, args, {cwd: root, encoding: 'utf-8'});
    if (result.error) throw result.error;
    if (result.status !== 0) {
        fail(`"${command} ${args.join(' ')}" failed with status ${result.status}\n${(result.stderr || '').trim()}`);
    }
    return (result.stdout || '').trim();
};

const runLoud = (command, args) => {
    const result = spawnSync(command, args, {cwd: root, stdio: 'inherit'});
    if (result.error) throw result.error;
    if (result.status !== 0) {
        fail(`"${command} ${args.join(' ')}" failed with status ${result.status}`);
    }
};

const tryRun = (command, args) => {
    const result = spawnSync(command, args, {cwd: root, encoding: 'utf-8'});
    if (result.error || result.status !== 0) return null;
    return (result.stdout || '').trim();
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const cliArgs = process.argv.slice(2).filter(arg => arg !== '--');
const watch = cliArgs.includes('--watch');
const dryRun = cliArgs.includes('--dry-run');
const bump = cliArgs.find(arg => !arg.startsWith('--')) || 'patch';

if (!/^(patch|minor|major|\d+\.\d+\.\d+(-[0-9A-Za-z-.]+)?)$/.test(bump)) {
    fail(`invalid version bump "${bump}". Use patch, minor, major, or an exact version like 1.2.3`);
}

if (tryRun('gh', ['--version']) === null) {
    fail('GitHub CLI (gh) is required. Install it from https://cli.github.com/ and run "gh auth login"');
}
if (tryRun('gh', ['auth', 'status']) === null) {
    fail('GitHub CLI is not authenticated. Run "gh auth login"');
}

const originURL = run('git', ['remote', 'get-url', 'origin']);
const slugMatch = originURL.match(/github\.com[:/]([^/]+)\/([^/]+?)(?:\.git)?$/);
if (!slugMatch) {
    fail(`could not parse GitHub repository from origin URL: ${originURL}`);
}
const slug = `${slugMatch[1]}/${slugMatch[2]}`;

const branch = run('git', ['rev-parse', '--abbrev-ref', 'HEAD']);
if (branch !== 'master') {
    fail(`must deploy from master, currently on ${branch}`);
}

if (run('git', ['status', '--porcelain']) !== '') {
    fail('working tree is not clean. Commit or stash your changes first');
}

console.log('Checking that master is up to date with origin...');
run('git', ['fetch', 'origin', 'master']);
if (tryRun('git', ['merge-base', '--is-ancestor', 'origin/master', 'HEAD']) === null) {
    fail('origin/master has commits you do not have locally. Run "git pull" first');
}

if (dryRun) {
    const currentVersion = JSON.parse(readFileSync(pathUtil.join(root, 'package.json'), 'utf-8')).version;
    console.log('Dry run: all checks passed.');
    console.log(`Would bump version (${bump}) from ${currentVersion}, push to ${slug}, and create a GitHub release.`);
    process.exit(0);
}

console.log(`Bumping version (${bump})...`);
runLoud('npm', ['version', bump, '-m', 'Release %s']);

const packageJSON = JSON.parse(readFileSync(pathUtil.join(root, 'package.json'), 'utf-8'));
const version = packageJSON.version;
const tag = `v${version}`;
const isPrerelease = version.includes('-');

console.log(`Pushing ${tag} to ${slug}...`);
runLoud('git', ['push', 'origin', 'master', '--follow-tags']);

console.log('Creating GitHub release...');
const releaseArgs = [
    'release', 'create', tag,
    '--repo', slug,
    '--title', `MistWarp ${version}`,
    '--generate-notes'
];
if (isPrerelease) {
    releaseArgs.push('--prerelease');
}
runLoud('gh', releaseArgs);

const findRun = async () => {
    for (let attempt = 0; attempt < 12; attempt++) {
        const output = tryRun('gh', [
            'run', 'list',
            '--repo', slug,
            '--workflow', 'release.yml',
            '--branch', tag,
            '--json', 'databaseId,url',
            '--limit', '1'
        ]);
        if (output) {
            try {
                const runs = JSON.parse(output);
                if (runs.length > 0) {
                    return runs[0];
                }
            } catch (e) {}
        }
        await sleep(5000);
    }
    return null;
};

console.log('Waiting for the release workflow to start...');
const workflowRun = await findRun();

console.log('');
console.log(`Release created: https://github.com/${slug}/releases/tag/${tag}`);
if (workflowRun) {
    console.log(`Build workflow:  ${workflowRun.url}`);
} else {
    console.log(`Build workflow:  https://github.com/${slug}/actions/workflows/release.yml`);
}
console.log('');
console.log('Windows, macOS, and Linux installers build on GitHub Actions and attach');
console.log('to the release automatically. This usually takes about 20-25 minutes.');

if (workflowRun && watch) {
    console.log('');
    runLoud('gh', ['run', 'watch', String(workflowRun.databaseId), '--repo', slug, '--exit-status']);
    console.log('Deploy complete.');
}
