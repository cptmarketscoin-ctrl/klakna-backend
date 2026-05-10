#!/usr/bin/env node
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const CLOUDFLARED = 'C:/Users/Administrator/Downloads/cloudflared-windows-amd64.exe';
const LOG_FILE = 'C:/Users/Administrator/AppData/Local/Temp/cf-tunnel.log';
const URL_FILE = 'C:/Users/Administrator/AppData/Local/Temp/cf-tunnel-url.txt';

let tunnelProcess = null;
let restarting = false;

function startTunnel() {
  if (restarting) return;
  restarting = true;
  
  console.log('[CF Tunnel] Starting...');
  
  // Clear old log
  try { fs.unlinkSync(LOG_FILE); } catch(e) {}
  
  tunnelProcess = spawn(CLOUDFLARED, [
    'tunnel',
    '--url', 'http://localhost:8080',
    '--logfile', LOG_FILE,
    '--loglevel', 'info'
  ], {
    detached: true,
    stdio: 'ignore'
  });
  
  tunnelProcess.unref();
  
  console.log('[CF Tunnel] Process started, PID:', tunnelProcess.pid);
  
  // Wait for URL
  setTimeout(() => {
    try {
      const log = fs.readFileSync(LOG_FILE, 'utf8');
      const match = log.match(/(https:\/\/[a-z0-9-]+\.trycloudflare\.com)/);
      if (match) {
        const url = match[1];
        fs.writeFileSync(URL_FILE, url);
        console.log('[CF Tunnel] URL: ' + url);
      } else {
        console.log('[CF Tunnel] URL not found in log yet, retrying...');
      }
    } catch(e) {
      console.log('[CF Tunnel] Log not available yet');
    }
    restarting = false;
  }, 8000);
  
  // Restart on exit
  tunnelProcess.on('exit', (code) => {
    console.log('[CF Tunnel] Process exited with code', code, '- restarting in 3s...');
    setTimeout(startTunnel, 3000);
  });
}

// Initial start
startTunnel();

// Keep alive and periodically check URL
setInterval(() => {
  if (!tunnelProcess || tunnelProcess.killed) {
    console.log('[CF Tunnel] Process not running, restarting...');
    startTunnel();
  }
}, 10000);

// Check for URL file updates
setInterval(() => {
  try {
    const url = fs.readFileSync(URL_FILE, 'utf8').trim();
    if (url) {
      console.log('[CF Tunnel] Current URL: ' + url);
    }
  } catch(e) {}
}, 60000);

console.log('[CF Tunnel] Daemon started. URL will be saved to:', URL_FILE);
