const settings = require('./settings');
const UpdateWindow = require('./windows/update');
const packageJSON = require('../package.json');
const privilegedFetch = require('./fetch');

const currentVersion = packageJSON.version;
const LATEST_RELEASE_API = 'https://api.github.com/repos/MistWarp/desktop/releases/latest';
const ALL_RELEASES_API = 'https://api.github.com/repos/MistWarp/desktop/releases?per_page=1';

/**
 * Determines whether the update checker is even allowed to be enabled
 * in this build of the app.
 * @returns {boolean}
 */
const isUpdateCheckerAllowed = () => {
  if (process.env.TW_DISABLE_UPDATE_CHECKER) {
    return false;
  }

  // Must be enabled in package.json
  return !!packageJSON.tw_update;
};

const checkForUpdates = async () => {
  if (!isUpdateCheckerAllowed() || settings.updateChecker === 'never' || settings.updateChecker === 'security') {
    return;
  }

  const includeUnstable = settings.updateChecker === 'unstable';
  const json = await privilegedFetch.json(includeUnstable ? ALL_RELEASES_API : LATEST_RELEASE_API);
  const release = Array.isArray(json) ? json[0] : json;
  if (!release || typeof release.tag_name !== 'string') {
    return;
  }

  // Imported lazily as it takes about 10ms to import
  const semverLt = require('semver/functions/lt');
  const semverValid = require('semver/functions/valid');

  const latest = release.tag_name.replace(/^v/, '');
  if (!semverValid(latest)) {
    return;
  }

  const now = Date.now();
  const ignoredUpdate = settings.ignoredUpdate;
  const ignoredUpdateUntil = settings.ignoredUpdateUntil * 1000;
  if (ignoredUpdate === latest && now < ignoredUpdateUntil) {
    // This update was ignored
    return;
  }

  if (semverLt(currentVersion, latest)) {
    UpdateWindow.updateAvailable(currentVersion, latest, false);
  }
};

/**
 * @param {string} version
 * @param {Date} until
 */
const ignoreUpdate = async (version, until) => {
  settings.ignoredUpdate = version;
  settings.ignoredUpdateUntil = Math.floor(until.getTime() / 1000);
  await settings.save();
};

module.exports = {
  isUpdateCheckerAllowed,
  checkForUpdates,
  ignoreUpdate
};
