const ngrok = require('ngrok');

(async () => {
  try {
    await ngrok.authtoken({
      authtoken: '3DXmJ4CVIOEddSs6wwCWV2NlzEf_4q4PQ3jqSSRYmHZG6ncnc'
    });
    
    const url = await ngrok.connect({
      addr: 8080,
      proto: 'http'
    });
    
    console.log('NGROK_URL:' + url);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();
