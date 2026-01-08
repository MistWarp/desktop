# MistWarp Desktop

To install, paste this into your terminal.

This wont work on windows, you will need to do these steps with the windows equivalents
to get the files
```bash
git clone --recursive https://github.com/MistWarp/desktop mistwarp-desktop
```
to update and build them
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
