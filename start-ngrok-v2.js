const { spawn } = require('child_process');
const http = require('http');

const ngrokPath = './node_modules/ngrok/bin/ngrok.exe';
const port = 8080;

console.log('Starting ngrok...');
const ngrok = spawn(ngrokPath, ['http', port.toString(), '--log=stdout']);

ngrok.stdout.on('data', (data) => {
  const output = data.toString();
  console.log('ngrok:', output);
});

ngrok.stderr.on('data', (data) => {
  console.error('ngrok error:', data.toString());
});

// Wait for ngrok to start, then query API
setTimeout(() => {
  http.get('http://127.0.0.1:4040/api/tunnels', (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
      try {
        const tunnels = JSON.parse(data);
        const publicUrl = tunnels.tunnels[0].public_url;
        console.log('NGROK_URL:' + publicUrl);
        process.exit(0);
      } catch (e) {
        console.error('Failed to parse tunnels:', e.message);
        process.exit(1);
      }
    });
  }).on('error', (err) => {
    console.error('Failed to query ngrok API:', err.message);
    process.exit(1);
  });
}, 5000);
