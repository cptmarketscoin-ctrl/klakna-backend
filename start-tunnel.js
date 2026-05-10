#!/usr/bin/env node
const localtunnel = require('localtunnel');

console.log('[localtunnel] Starting...');

async function main() {
  try {
    const tunnel = await localtunnel({ port: 8080 });
    console.log('[localtunnel] URL: ' + tunnel.url);
    console.log('[localtunnel] Tunnel active');

    tunnel.on('close', () => {
      console.log('[localtunnel] Tunnel closed, restarting in 3s...');
      setTimeout(main, 3000);
    });

    tunnel.on('error', (err) => {
      console.error('[localtunnel] Error:', err.message);
      console.log('[localtunnel] Restarting in 3s...');
      setTimeout(main, 3000);
    });
  } catch (err) {
    console.error('[localtunnel] Failed:', err.message);
    console.log('[localtunnel] Retrying in 5s...');
    setTimeout(main, 5000);
  }
}

main();

process.on('SIGINT', () => {
  console.log('\n[localtunnel] Exiting...');
  process.exit(0);
});
