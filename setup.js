#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('🎵 Spotiffy Dock Setup\n');
console.log('This script will help you configure your Spotify Client ID.\n');

console.log('To get your Spotify Client ID:');
console.log('1. Go to https://developer.spotify.com/dashboard');
console.log('2. Log in with your Spotify account');
console.log('3. Click "Create an App"');
console.log('4. Fill in the app details (name can be "Spotiffy Dock")');
console.log('5. Add "http://localhost:3000/callback" to Redirect URIs');
console.log('6. Copy the Client ID\n');

rl.question('Enter your Spotify Client ID: ', (clientId) => {
  if (!clientId || clientId.trim() === '') {
    console.log('❌ Client ID is required. Please run the setup again.');
    rl.close();
    return;
  }

  // Update the SpotifyService.js file
  const spotifyServicePath = path.join(__dirname, 'src', 'services', 'SpotifyService.js');
  
  try {
    let content = fs.readFileSync(spotifyServicePath, 'utf8');
    content = content.replace(
      /const clientId = 'YOUR_SPOTIFY_CLIENT_ID';/,
      `const clientId = '${clientId.trim()}';`
    );
    fs.writeFileSync(spotifyServicePath, content);
    
    console.log('✅ Spotify Client ID configured successfully!');
    console.log('\nNext steps:');
    console.log('1. Make sure you have Spotify Premium');
    console.log('2. Run "npm run build" to build the app');
    console.log('3. Run "npm start" to launch the dock');
    console.log('\nThe dock will appear at the top of your screen when you move your mouse there.');
    
  } catch (error) {
    console.error('❌ Error updating configuration:', error.message);
  }
  
  rl.close();
});
