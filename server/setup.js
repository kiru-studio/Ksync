#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('🚀 Spotiffy Backend Setup\n');
console.log('This script will help you configure your Spotify API credentials.\n');

console.log('To get your Spotify credentials:');
console.log('1. Go to https://developer.spotify.com/dashboard');
console.log('2. Log in with your Spotify account');
console.log('3. Click "Create an App"');
console.log('4. Fill in the app details (name can be "Spotiffy Backend")');
console.log('5. Add "http://localhost:3001/callback" to Redirect URIs');
console.log('6. Copy the Client ID and Client Secret\n');

rl.question('Enter your Spotify Client ID: ', (clientId) => {
  if (!clientId || clientId.trim() === '') {
    console.log('❌ Client ID is required. Please run the setup again.');
    rl.close();
    return;
  }

  rl.question('Enter your Spotify Client Secret: ', (clientSecret) => {
    if (!clientSecret || clientSecret.trim() === '') {
      console.log('❌ Client Secret is required. Please run the setup again.');
      rl.close();
      return;
    }

    // Create .env file
    const envContent = `# Spotify API Configuration
SPOTIFY_CLIENT_ID=${clientId.trim()}
SPOTIFY_CLIENT_SECRET=${clientSecret.trim()}
SPOTIFY_REDIRECT_URI=http://localhost:3001/callback

# Server Configuration
PORT=3001

# Optional: Database configuration (for production)
# DATABASE_URL=your_database_url_here

# Optional: Lyrics API keys
# GENIUS_ACCESS_TOKEN=your_genius_token_here
# MUSIXMATCH_API_KEY=your_musixmatch_key_here
`;

    try {
      fs.writeFileSync(path.join(__dirname, '.env'), envContent);
      
      console.log('✅ Spotify credentials configured successfully!');
      console.log('\nNext steps:');
      console.log('1. Run "npm install" to install dependencies');
      console.log('2. Run "npm start" to start the backend server');
      console.log('3. The backend will be available at http://localhost:3001');
      console.log('\nMake sure your frontend is configured to use this backend URL.');
      
    } catch (error) {
      console.error('❌ Error creating .env file:', error.message);
    }
    
    rl.close();
  });
});
