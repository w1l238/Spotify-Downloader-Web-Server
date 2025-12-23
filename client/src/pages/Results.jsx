import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import Popup from '../components/Popup';
import './css/Results.css';

const Results = () => {
    useEffect(() => {
        document.title = 'Results - Spotify Downloader';
    }, []);

    const location = useLocation();
    const initialResults = location.state?.results || { items: [], next: null, previous: null };
    const [results, setResults] = useState(initialResults);
    const [downloading, setDownloading] = useState({});
    const [popup, setPopup] = useState({ visible: false, message: '', type: '' });

    useEffect(() => {
        setResults(location.state?.results || { items: [], next: null, previous: null });
    }, [location.state]);

    const handleDownload = async (track) => {
        setDownloading(prev => ({ ...prev, [track.id]: true }));

        const trackDetails = {
            trackName: track.name,
            artistName: track.artists.map(artist => artist.name).join(', '),
            albumName: track.album.name,
            albumArtUrl: track.album.images[0]?.url
        };

        try {
            const response = await fetch('http://localhost:3001/download-song', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(trackDetails),
            });

            const data = await response.json();
            if (response.ok) {
                if (data.status === 'exists') {
                    setPopup({ visible: true, message: 'Song already downloaded', type: 'info' });
                } else {
                    setPopup({ visible: true, message: 'Download successful!', type: 'success' });
                }
            } else {
                setPopup({ visible: true, message: data.error || 'Download failed.', type: 'error' });
            }
        } catch (error) {
            console.error('Error downloading song:', error);
            setPopup({ visible: true, message: 'Download failed.', type: 'error' });
        } finally {
            setDownloading(prev => ({ ...prev, [track.id]: false }));
        }
    };

    const fetchPage = async (url) => {
        if (!url) return;

        try {
            const response = await fetch(`http://localhost:3001/spotify-proxy?url=${encodeURIComponent(url)}`);
            if (response.ok) {
                const data = await response.json();
                setResults(data.tracks);
            } else {
                console.error('Failed to fetch page');
            }
        } catch (error) {
            console.error('Error fetching page:', error);
        }
    };

    const closePopup = () => {
        setPopup({ visible: false, message: '', type: '' });
    };

    return (
        <div className="results-container">
            {popup.visible && <Popup message={popup.message} type={popup.type} onClose={closePopup} />}
            <h1>Results</h1>
            <div className="results-list">
                {results.items.length > 0 ? (
                    results.items.map((track) => (
                        <div key={track.id} className="track-item">
                            <img src={track.album.images[1]?.url || track.album.images[0]?.url || ''} alt={track.album.name} className="result-album-art" />
                            <div className="track-info">
                                <span className="track-name">{track.name}</span>
                                <span className="artist-name">{track.artists.map(artist => artist.name).join(', ')}</span>
                                <span className="album-name">{track.album.name}</span>
                            </div>
                            <button
                                className="download-button"
                                onClick={() => handleDownload(track)}
                                disabled={downloading[track.id]}
                            >
                                {downloading[track.id] ? 'Downloading...' : 'Download'}
                            </button>
                        </div>
                    ))
                ) : (
                    <p>No results found.</p>
                )}
            </div>
            <div className="pagination-controls">
                <button onClick={() => fetchPage(results.previous)} disabled={!results.previous}>
                    Previous
                </button>
                <button onClick={() => fetchPage(results.next)} disabled={!results.next}>
                    Next
                </button>
            </div>
        </div>
    );
};

export default Results;
