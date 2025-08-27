#!/usr/bin/env node

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Starting Spotiffy Backend with ngrok tunnel...\n');

// Start the backend server
const server = spawn('node', ['server.js'], {
  cwd: __dirname,
  stdio: 'inherit'
});

// Wait a moment for server to start, then start ngrok
setTimeout(() => {
  console.log('\n📡 Starting ngrok tunnel...');
  
  const ngrok = spawn('ngrok', ['http', '3001'], {
    stdio: 'pipe'
  });

  let ngrokUrl = '';

  ngrok.stdout.on('data', (data) => {
    const output = data.toString();
    console.log(output);
    
    // Extract the ngrok URL
    const match = output.match(/https:\/\/[a-zA-Z0-9-]+\.ngrok\.io/);
    if (match && !ngrokUrl) {
      ngrokUrl = match[0];
      console.log('\n🎯 Ngrok URL found:', ngrokUrl);
      console.log('\n📋 Next steps:');
      console.log('1. Go to https://developer.spotify.com/dashboard');
      console.log('2. Edit your app settings');
      console.log('3. Add this Redirect URI:', `${ngrokUrl}/callback`);
      console.log('4. Update your .env file with the new redirect URI');
      console.log('5. Restart the backend server');
      console.log('\n💡 The ngrok URL will change each time you restart ngrok.');
    }
  });

  ngrok.stderr.on('data', (data) => {
    console.error('Ngrok error:', data.toString());
  });

  // Handle process termination
  process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down...');
    server.kill();
    ngrok.kill();
    process.exit();
  });

}, 2000);

// Handle server errors
server.on('error', (error) => {
  console.error('Server error:', error);
});

server.on('close', (code) => {
  console.log(`Server process exited with code ${code}`);
});
