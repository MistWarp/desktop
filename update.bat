@echo off
cd mistwarp-desktop
git pull
npm ci
npm run fetch
npm run electron:package:dir
cd dist
cd
