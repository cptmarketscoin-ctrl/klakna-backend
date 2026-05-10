const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');

const ngrokPath = 'C:/Users/Administrator/Downloads/ngrok.exe';
const port = 8080;

console.log('Starting ngrok with latest binary...');
const ngrok = spawn(ngrokPath, ['http', port.toString(), '--log=stdout']);

let output = '';

ngrok.stdout.on('data', (data) => {
  const text = data.toString();
  output += text;
  console.log('ngrok:', text.trim());
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
        const result = JSON.parse(data);
        if (result.tunnels && result.tunnels.length > 0) {
          const publicUrl = result.tunnels[0].public_url;
          console.log('\nNGROK_URL:' + publicUrl);
          
          // Save URL to file for reference
          fs.writeFileSync('ngrok-url.txt', publicUrl);
          console.log('URL saved to ngrok-url.txt');
        } else {
          console.error('No tunnels found');
          process.exit(1);
        }
      } catch (e) {
        console.error('Failed to parse tunnels:', e.message);
        console.error('API response:', data);
        process.exit(1);
      }
    });
  }).on('error', (err) => {
    console.error('Failed to query ngrok API:', err.message);
    process.exit(1);
  });
}, 8000);
