import express from 'express';
import cors from 'cors';
import 'dotenv/config'; // Load environment variables
import fs from 'fs/promises'; // Import fs.promises for async file operations
import path from 'path'; // Import path module
import { fileURLToPath } from 'url';
import { info, error, warning } from './logger.js';

process.on('exit', (code) => {
  warning(`Server is about to exit with code: ${code}`);
});

info('Server initialization started.');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to get base download path from env or default
const getBaseDownloadPath = () => {
  return process.env.DOWNLOAD_PATH || path.join(__dirname, '..', 'downloads');
};

import { YtDlp } from 'ytdlp-nodejs';
import NodeID3 from 'node-id3';
const ytdlp = new YtDlp();
import { getLibrary, refreshLibrary, deleteSong, getSongArt, updateSongMetadata } from './libraryManager.js';

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json()); // To parse JSON request bodies

let spotifyAccessToken = '';
let tokenExpiryTime = 0;

// Function to get Spotify Access Token
async function getSpotifyAccessToken() {
  info('Attempting to get Spotify Access Token...');
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    error('Spotify Client ID or Client Secret not set in environment variables.');
    return null;
  }

  const authString = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  try {
    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${authString}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: 'grant_type=client_credentials'
    });

    const data = await response.json();
    if (response.ok) {
      spotifyAccessToken = data.access_token;
      tokenExpiryTime = Date.now() + (data.expires_in * 1000) - 60000; // Store expiry time, refresh 1 minute before actual expiry
      info('Spotify Access Token obtained.');
      return spotifyAccessToken;
    } else {
      error('Error getting Spotify access token:', data);
      return null;
    }
  } catch (error) {
    error('Network error while getting Spotify access token:', error);
    return null;
  }
}

// Middleware to ensure we have a valid access token
app.use(async (req, res, next) => {
  info('Middleware: Checking Spotify Access Token...');
  if (!spotifyAccessToken || Date.now() >= tokenExpiryTime) {
    info('Refreshing Spotify Access Token...');
    await getSpotifyAccessToken();
  }
  next();
});


app.get('/', (req, res) => {
  res.send('Hello from the backend!');
});

// Endpoint to search Spotify
app.get('/search-spotify', async (req, res) => {
  info(`Received search-spotify request for query: "${req.query.q}"`);
  const query = req.query.q;
  const limit = req.query.limit || 10;
  if (!query) {
    return res.status(400).json({ error: 'Query parameter "q" is required.' });
  }

  if (!spotifyAccessToken) {
    return res.status(500).json({ error: 'Spotify access token not available.' });
  }

  try {
    const response = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=${limit}`, {
      headers: {
        'Authorization': `Bearer ${spotifyAccessToken}`
      }
    });

    const data = await response.json();
    if (response.ok) {
      res.json(data);
    } else {
      error('Error searching Spotify:', data);
      res.status(response.status).json({ error: data.error.message || 'Error searching Spotify' });
    }
  } catch (error) {
    error('Network error while searching Spotify:', error);
    res.status(500).json({ error: 'Network error while searching Spotify' });
  }
});

// Endpoint to create folder structure
app.post('/create-folder-structure', async (req, res) => {
  info(`Received request to create folder structure for artist: "${req.body.artistName}", album: "${req.body.albumName}"`);
  const { artistName, albumName } = req.body;

  if (!artistName || !albumName) {
    return res.status(400).json({ error: 'Artist name and album name are required.' });
  }

  const baseDownloadPath = getBaseDownloadPath();

  try {
    await fs.mkdir(baseDownloadPath, { recursive: true });
    const artistPath = path.join(baseDownloadPath, artistName);
    await fs.mkdir(artistPath, { recursive: true });
    const albumPath = path.join(artistPath, albumName);
    await fs.mkdir(albumPath, { recursive: true });

    res.json({ message: 'Folder structure created successfully', path: albumPath });
  } catch (error) {
    error('Error creating folder structure:', error);
    res.status(500).json({ error: 'Failed to create folder structure.' });
  }
});

app.get('/spotify-proxy', async (req, res) => {
  info(`Received spotify-proxy request for URL: "${req.query.url}"`);
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: 'URL parameter is required.' });
  }

  if (!spotifyAccessToken) {
    return res.status(500).json({ error: 'Spotify access token not available.' });
  }

  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${spotifyAccessToken}`
      }
    });

    const data = await response.json();
    if (response.ok) {
      res.json(data);
    } else {
      error('Error proxying Spotify request:', data);
      res.status(response.status).json({ error: data.error.message || 'Error proxying Spotify request' });
    }
  } catch (error) {
    error('Network error while proxying Spotify request:', error);
    res.status(500).json({ error: 'Network error while proxying Spotify request' });
  }
});

app.post('/download-song', async (req, res) => {
  info(`Received download-song request for track: "${req.body.trackName}" by "${req.body.artistName}"`);
  const { trackName, artistName, albumName, albumArtUrl } = req.body;

  if (!trackName || !artistName || !albumName) {
    return res.status(400).json({ error: 'Track name, artist name, and album name are required.' });
  }

  const searchQuery = `${trackName} ${artistName}`;
  const baseDownloadPath = getBaseDownloadPath();
  const targetFolderPath = path.join(baseDownloadPath, artistName, albumName);
  const outputFilePath = path.join(targetFolderPath, `${trackName}.mp3`);

  // Check if the file already exists
  try {
    await fs.access(outputFilePath);
    info('Song already exists:', outputFilePath);
    return res.status(200).json({ status: 'exists', message: 'Song already downloaded' });
  } catch (error) {
    // File does not exist, proceed with download
  }

  info(`Initiating YouTube search for: "${searchQuery}"`);
  const searchProcess = ytdlp.exec([`ytsearch1:"${searchQuery}"`, '--dump-json']);
  let searchResultJson = '';
  searchProcess.stdout.on('data', (data) => {
    searchResultJson += data.toString();
  });

  searchProcess.on('close', async () => {
    if (!searchResultJson) {
      error('yt-dlp did not return any data for query:', searchQuery);
      return res.status(404).json({ error: 'Could not find a YouTube video for the song.' });
    }

    try {
      info(`Attempting to create target folder: "${targetFolderPath}"`);
      await fs.mkdir(targetFolderPath, { recursive: true });
      const videoInfo = JSON.parse(searchResultJson);

      if (!videoInfo || videoInfo.length === 0) {
        return res.status(404).json({ error: 'Could not find a YouTube video for the song.' });
      }

      const videoUrl = videoInfo.webpage_url;
      info(`Starting audio download from YouTube: "${videoUrl}" to "${outputFilePath}"`);

      // Download audio and convert to MP3 using ytdlp.exec
      await new Promise((resolve, reject) => {
        const downloadProcess = ytdlp.exec([
          videoUrl,
          '-x',
          '--audio-format', 'mp3',
          '--output', outputFilePath,
        ]);
        downloadProcess.on('close', resolve);
        downloadProcess.on('error', reject);
      });

      info('Download complete. Starting metadata injection.');

      // Inject metadata
      const tags = {
        title: trackName,
        artist: artistName,
        album: albumName,
      };

      if (albumArtUrl) {
        info('Fetching album art from:', albumArtUrl);
        try {
          const imageResponse = await fetch(albumArtUrl);
          const imageBuffer = await imageResponse.arrayBuffer();
          info('Album art fetched and converted to buffer.');
          tags.image = {
            mime: 'image/jpeg', // Assuming JPEG, but could be dynamic
            type: {
              id: 3,
              name: 'front cover'
            },
            description: 'Album Art',
            imageBuffer: Buffer.from(imageBuffer)
          };
        } catch (imageError) {
          error('Error fetching album art:', imageError);
        }
      }

      try {
        info('Attempting to write ID3 tags to MP3 file.');
        await NodeID3.Promise.write(tags, outputFilePath);
        info('Metadata written successfully.');
      } catch (id3Error) {
        error('Error writing ID3 tags:', id3Error);
      }


      info(`Downloaded and converted: ${outputFilePath}`);
      res.json({ message: 'Song downloaded and converted successfully', filePath: outputFilePath });
    } catch (error) {
      error('Error in download-song endpoint:', error);
      res.status(500).json({ error: 'An error occurred during song download.' });
    }
  });

  searchProcess.on('error', (err) => {
    error('Error executing ytdlp search:', err);
    res.status(500).json({ error: 'An error occurred during YouTube search.' });
  });
});


// Endpoint to get environment variables from '~/backend/.env'
// Structure:
// SPOTIFY_CLIENT_ID - Client ID from spotify
// SPOTIFY_CLIENT_SECRET - Client Secret from spotify
app.get('/config', async (req, res) => {
  try {
    const envPath = path.join(__dirname, '.env');
    const envContent = await fs.readFile(envPath, 'utf-8');
    const config = {};
    envContent.split('\n').forEach(line => {
      const [key, value] = line.split('=');
      if (key && value) {
        if (key.trim() === 'SPOTIFY_CLIENT_ID') config.clientId = value.trim();
        if (key.trim() === 'SPOTIFY_CLIENT_SECRET') config.clientSecret = value.trim();
        if (key.trim() === 'DOWNLOAD_PATH') config.downloadPath = value.trim();
      }
    });
    res.json(config);
  } catch (error) {
    if (error.code === 'ENOENT') {
      res.json({ clientId: '', clientSecret: '', downloadPath: '' });
    } else {
      error('Error reading .env file:', error);
      res.status(500).json({ error: 'Failed to read configuration.' });
    }
  }
});

// Endpoint to update environment variables
app.post('/config', async (req, res) => {
  const { clientId, clientSecret, downloadPath } = req.body;
  if (!clientId || !clientSecret) {
    return res.status(400).json({ error: 'Client ID and Secret are required.' });
  }

  try {
    const envPath = path.join(__dirname, '.env');
    let envContent = '';
    try {
      envContent = await fs.readFile(envPath, 'utf-8');
    } catch (err) {
      // Ignore error if file doesn't exist
    }

    const newLines = [];
    const keysFound = { clientId: false, clientSecret: false, downloadPath: false };

    envContent.split('\n').forEach(line => {
      const [key] = line.split('=');
      const trimmedKey = key ? key.trim() : '';
      if (trimmedKey === 'SPOTIFY_CLIENT_ID') {
        newLines.push(`SPOTIFY_CLIENT_ID=${clientId}`);
        keysFound.clientId = true;
      } else if (trimmedKey === 'SPOTIFY_CLIENT_SECRET') {
        newLines.push(`SPOTIFY_CLIENT_SECRET=${clientSecret}`);
        keysFound.clientSecret = true;
      } else if (trimmedKey === 'DOWNLOAD_PATH') {
        if (downloadPath) {
            newLines.push(`DOWNLOAD_PATH=${downloadPath}`);
            keysFound.downloadPath = true;
        }
      } else if (line.trim() !== '') {
        newLines.push(line);
      }
    });

    if (!keysFound.clientId) newLines.push(`SPOTIFY_CLIENT_ID=${clientId}`);
    if (!keysFound.clientSecret) newLines.push(`SPOTIFY_CLIENT_SECRET=${clientSecret}`);
    if (!keysFound.downloadPath && downloadPath) newLines.push(`DOWNLOAD_PATH=${downloadPath}`);

    await fs.writeFile(envPath, newLines.join('\n'));

    process.env.SPOTIFY_CLIENT_ID = clientId;
    process.env.SPOTIFY_CLIENT_SECRET = clientSecret;
    if (downloadPath) process.env.DOWNLOAD_PATH = downloadPath;

    await getSpotifyAccessToken();

    res.json({ message: 'Configuration saved and token refreshed.' });
  } catch (error) {
    error('Error writing .env file:', error);
    res.status(500).json({ error: 'Failed to save configuration.' });
  }
});

/****************************
* --- Library Endpoints ---
****************************/
app.get('/api/library', async (req, res) => {
  try {
    const library = await getLibrary();
    res.json(library);
  } catch (err) {
    error('Error fetching library:', err);
    res.status(500).json({ error: 'Failed to fetch library.' });
  }
});

app.get('/api/library/scan', async (req, res) => {
  try {
    const library = await refreshLibrary();
    res.json(library);
  } catch (err) {
    error('Error scanning library:', err);
    res.status(500).json({ error: 'Failed to scan library.' });
  }
});

app.get('/api/files/:id/art', async (req, res) => {
    const { id } = req.params;
    try {
        const art = await getSongArt(id);
        if (art) {
            res.setHeader('Content-Type', art.mime);
            res.send(art.buffer);
        } else {
            res.status(404).send('No art found');
        }
    } catch (err) {
        error('Error fetching art:', err);
        res.status(500).send('Error');
    }
});

app.put('/api/files/:id/metadata', async (req, res) => {
    const { id } = req.params;
    const { title, artist, album, trackNumber, year } = req.body;
    try {
        const tags = { title, artist, album, trackNumber, year };
        await updateSongMetadata(id, tags);
        res.json({ message: 'Metadata updated successfully.' });
    } catch (err) {
        error('Error updating metadata:', err);
        res.status(500).json({ error: err.message || 'Failed to update metadata.' });
    }
});

app.delete('/api/files/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await deleteSong(id);
    res.json({ message: 'Song deleted successfully.' });
  } catch (err) {
    error('Error deleting song:', err);
    res.status(500).json({ error: err.message || 'Failed to delete song.' });
  }
});

app.listen(port, () => {
  info(`Backend listening at http://localhost:${port}`);
  getSpotifyAccessToken(); // Get initial token when server starts
});