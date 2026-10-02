const http = require('http');

// Sign in with Rotur for the desktop app. The editor runs on tw-editor://, so
// Rotur can't send the sign-in code back to it. Instead Rotur redirects the
// browser to a listener on 127.0.0.1, on whatever port is free (RFC 8252).
// The editor makes the PKCE verifier and swaps the code; this only carries
// the code back.

const AUTHORIZE = 'https://api.rotur.dev/oauth/authorize';
// The address the editor asks for. Rotur matches loopback addresses on any
// port, so this is what's registered, and the port is filled in here.
const REDIRECT = 'http://127.0.0.1/';
const TIMEOUT = 10 * 60 * 1000;

const PAGE = (title) => `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>${title}</title></head>
<body style="font-family: system-ui, sans-serif; text-align: center; padding: 4em 1em;">
<h1 style="font-size: 1.4em;">${title}</h1>
<p>You can close this tab and go back to MistWarp.</p>
</body>
</html>`;

let cancelPending = null;

/**
 * @param {string} authorizeUrl Rotur's authorize URL, with redirect_uri set to REDIRECT.
 * @param {(url: string) => unknown} open Opens a URL in the browser.
 * @returns {Promise<{redirectUri: string, state: string, code: string|null, error: string|null,
 *   error_description: string|null}>} What Rotur sent to the listener.
 */
const authorizeWithLoopback = (authorizeUrl, open) => new Promise((resolve, reject) => {
  let url;
  try {
    url = new URL(authorizeUrl);
  } catch (e) {
    reject(new Error('Not a Rotur sign-in address'));
    return;
  }
  const state = url.searchParams.get('state');
  if (`${url.origin}${url.pathname}` !== AUTHORIZE || url.searchParams.get('redirect_uri') !== REDIRECT || !state) {
    reject(new Error('Not a Rotur sign-in address'));
    return;
  }

  // Only one sign-in at a time: a new one ends the last.
  if (cancelPending) cancelPending();

  let redirectUri = '';
  let timer = null;
  const server = http.createServer();
  const finish = (error, result) => {
    if (cancelPending === cancel) cancelPending = null;
    clearTimeout(timer);
    server.close();
    if (error) reject(error);
    else resolve(result);
  };
  const cancel = () => finish(new Error('Another sign-in started'));
  cancelPending = cancel;

  server.on('request', (req, res) => {
    const requestUrl = new URL(req.url, redirectUri);
    const params = requestUrl.searchParams;
    // Anything but Rotur's answer to this sign-in, such as a favicon, is ignored.
    if (req.method !== 'GET' || requestUrl.pathname !== '/' || params.get('state') !== state ||
        !(params.has('code') || params.has('error'))) {
      res.writeHead(404, {'Content-Type': 'text/plain', 'Connection': 'close'});
      res.end('Not found');
      return;
    }
    const error = params.get('error');
    res.writeHead(200, {'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Connection': 'close'});
    res.end(PAGE(error ? 'Sign-in cancelled' : 'Signed in to MistWarp'));
    finish(null, {
      redirectUri,
      state,
      code: params.get('code'),
      error,
      error_description: params.get('error_description')
    });
  });
  server.on('error', (e) => finish(e));
  server.listen(0, '127.0.0.1', () => {
    redirectUri = `http://127.0.0.1:${server.address().port}/`;
    url.searchParams.set('redirect_uri', redirectUri);
    timer = setTimeout(() => finish(new Error('Rotur sign-in timed out')), TIMEOUT);
    open(url.href);
  });
});

module.exports = {authorizeWithLoopback};
