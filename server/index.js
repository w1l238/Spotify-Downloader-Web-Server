import express from 'express';
import cors from 'cors';
import 'dotenv/config'; // Load environment variables
import fs from 'fs/promises'; // Import fs.promises for async file operations
import path from 'path'; // Import path module
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import { YtDlp } from 'ytdlp-nodejs';
import NodeID3 from 'node-id3';
const ytdlp = new YtDlp();

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json()); // To parse JSON request bodies

let spotifyAccessToken = '';
let tokenExpiryTime = 0;

// Function to get Spotify Access Token
async function getSpotifyAccessToken() {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error('Spotify Client ID or Client Secret not set in environment variables.');
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
      console.log('Spotify Access Token obtained.');
      return spotifyAccessToken;
    } else {
      console.error('Error getting Spotify access token:', data);
      return null;
    }
  } catch (error) {
    console.error('Network error while getting Spotify access token:', error);
    return null;
  }
}

// Middleware to ensure we have a valid access token
app.use(async (req, res, next) => {
  if (!spotifyAccessToken || Date.now() >= tokenExpiryTime) {
    console.log('Refreshing Spotify Access Token...');
    await getSpotifyAccessToken();
  }
  next();
});


app.get('/', (req, res) => {
  res.send('Hello from the backend!');
});

// Endpoint to search Spotify
app.get('/search-spotify', async (req, res) => {
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
      console.error('Error searching Spotify:', data);
      res.status(response.status).json({ error: data.error.message || 'Error searching Spotify' });
    }
  } catch (error) {
    console.error('Network error while searching Spotify:', error);
    res.status(500).json({ error: 'Network error while searching Spotify' });
  }
});

// Endpoint to create folder structure
app.post('/create-folder-structure', async (req, res) => {
  const { artistName, albumName } = req.body;

  if (!artistName || !albumName) {
    return res.status(400).json({ error: 'Artist name and album name are required.' });
  }

  const baseDownloadPath = path.join(__dirname, '..', 'downloads'); // Define a base download directory in the project root

  try {
    await fs.mkdir(baseDownloadPath, { recursive: true });
    const artistPath = path.join(baseDownloadPath, artistName);
    await fs.mkdir(artistPath, { recursive: true });
    const albumPath = path.join(artistPath, albumName);
    await fs.mkdir(albumPath, { recursive: true });

    res.json({ message: 'Folder structure created successfully', path: albumPath });
  } catch (error) {
    console.error('Error creating folder structure:', error);
    res.status(500).json({ error: 'Failed to create folder structure.' });
  }
});

app.get('/spotify-proxy', async (req, res) => {
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
      console.error('Error proxying Spotify request:', data);
      res.status(response.status).json({ error: data.error.message || 'Error proxying Spotify request' });
    }
  } catch (error) {
    console.error('Network error while proxying Spotify request:', error);
    res.status(500).json({ error: 'Network error while proxying Spotify request' });
  }
});

app.post('/download-song', async (req, res) => {
  const { trackName, artistName, albumName, albumArtUrl } = req.body;

  if (!trackName || !artistName || !albumName) {
    return res.status(400).json({ error: 'Track name, artist name, and album name are required.' });
  }

  const searchQuery = `${trackName} ${artistName}`;
  const baseDownloadPath = path.join(__dirname, '..', 'downloads');
  const targetFolderPath = path.join(baseDownloadPath, artistName, albumName);
  const outputFilePath = path.join(targetFolderPath, `${trackName}.mp3`);

  // Check if the file already exists
  try {
    await fs.access(outputFilePath);
    console.log('Song already exists:', outputFilePath);
    return res.status(200).json({ status: 'exists', message: 'Song already downloaded' });
  } catch (error) {
    // File does not exist, proceed with download
  }

  const searchProcess = ytdlp.exec([`ytsearch1:"${searchQuery}"`, '--dump-json']);
  let searchResultJson = '';
  searchProcess.stdout.on('data', (data) => {
    searchResultJson += data.toString();
  });

  searchProcess.on('close', async () => {
    if (!searchResultJson) {
      console.error('yt-dlp did not return any data for query:', searchQuery);
      return res.status(404).json({ error: 'Could not find a YouTube video for the song.' });
    }

    try {
      await fs.mkdir(targetFolderPath, { recursive: true });
      const videoInfo = JSON.parse(searchResultJson);

      if (!videoInfo || videoInfo.length === 0) {
        return res.status(404).json({ error: 'Could not find a YouTube video for the song.' });
      }

      const videoUrl = videoInfo.webpage_url;

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

      console.log('Download complete. Starting metadata injection.');

      // Inject metadata
      const tags = {
        title: trackName,
        artist: artistName,
        album: albumName,
      };

      if (albumArtUrl) {
        console.log('Fetching album art from:', albumArtUrl);
        try {
          const imageResponse = await fetch(albumArtUrl);
          const imageBuffer = await imageResponse.arrayBuffer();
          console.log('Album art fetched and converted to buffer.');
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
          console.error('Error fetching album art:', imageError);
        }
      }

      try {
        await NodeID3.Promise.write(tags, outputFilePath);
        console.log('Metadata written successfully.');
      } catch (id3Error) {
        console.error('Error writing ID3 tags:', id3Error);
      }


      console.log(`Downloaded and converted: ${outputFilePath}`);
      res.json({ message: 'Song downloaded and converted successfully', filePath: outputFilePath });
    } catch (error) {
      console.error('Error in download-song endpoint:', error);
      res.status(500).json({ error: 'An error occurred during song download.' });
    }
  });

  searchProcess.on('error', (err) => {
    console.error('Error executing ytdlp search:', err);
    res.status(500).json({ error: 'An error occurred during YouTube search.' });
  });
});


app.listen(port, () => {
  console.log(`Backend listening at http://localhost:${port}`);
  getSpotifyAccessToken(); // Get initial token when server starts
});