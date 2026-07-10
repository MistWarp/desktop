# MistWarp Desktop

To install, paste this into your terminal.

This might not work on windows, you will need to do these steps with the windows equivalents

Run this to get the desktop files onto your computer
```bash
git clone --recursive https://github.com/MistWarp/desktop mistwarp-desktop
```
Then run this to update and build the desktop application
```bash
cd mistwarp-desktop
git pull
npm ci
npm run fetch
npm run electron:package:dir
cd dist
pwd
```

The last line of this will tell you the directory to open in your file manager, then go into the folder named the platform you are on (mac/linux/windows) and find the executable, then you should move the executable to your applications folder or similar and you are done.

## Releasing a new version

One command, run from a clean master checkout with the [GitHub CLI](https://cli.github.com/) authenticated:

```bash
npm run deploy
```

This bumps the patch version, commits, tags, pushes, and creates the GitHub release. GitHub Actions then builds the Windows, macOS, and Linux installers and attaches them to the release automatically, which takes about 20-25 minutes.

Options:

```bash
npm run deploy -- minor        # or major, or an exact version like 1.2.3
npm run deploy -- 1.2.0-beta.1 # prerelease versions are marked as such
npm run deploy:watch           # stay attached until the builds finish
npm run deploy -- --dry-run    # run all the checks without releasing anything
```
