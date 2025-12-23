import React, { useState, useEffect } from 'react';
import './css/Settings.css';
import Popup from '../components/Popup';

const Settings = () => {
    useEffect(() => {
        document.title = 'Settings - Spotify Downloader';
    }, []);

    const [limit, setLimit] = useState(20);
    const [clientId, setClientId] = useState('');
    const [clientSecret, setClientSecret] = useState('');
    const [downloadPath, setDownloadPath] = useState('');
    const [autoScan, setAutoScan] = useState(false);
    const [background, setBackground] = useState('linear-gradient(-45deg, #0350a2, #23a6d5, #23d5ab, #0350a2)');
    const [popup, setPopup] = useState({ visible: false, message: '', type: '' });

    const backgrounds = [
        { name: 'Blue Green', value: 'linear-gradient(-45deg, #0350a2, #23a6d5, #23d5ab, #0350a2)' },
        { name: 'Deep Purple', value: 'linear-gradient(-45deg, #2e0249, #570a57, #a91079, #2e0249)' },
        { name: 'Spotify Green', value: 'linear-gradient(-45deg, #1db954, #191414, #1db954, #121212)' },
        { name: 'Red Orange', value: 'linear-gradient(-45deg, #800000, #b22222, #ff4500, #800000)' },
        { name: 'Yellow Orange', value: 'linear-gradient(-45deg, #ff512f, #f09819, #ff512f, #ed1c24)' }
    ];

    useEffect(() => {
        const savedLimit = localStorage.getItem('spotify_results_limit');
        if (savedLimit) {
            setLimit(parseInt(savedLimit, 10));
        }

        const savedAutoScan = localStorage.getItem('auto_scan_library');
        if (savedAutoScan) {
            setAutoScan(savedAutoScan === 'true');
        }

        const savedBg = localStorage.getItem('app_background');
        if (savedBg) {
            setBackground(savedBg);
        }

        // Fetch config from backend
        fetch('http://localhost:3001/config')
            .then(res => res.json())
            .then(data => {
                if (data.clientId) setClientId(data.clientId);
                if (data.clientSecret) setClientSecret(data.clientSecret);
                if (data.downloadPath) setDownloadPath(data.downloadPath);
            })
            .catch(err => console.error('Error fetching config:', err));
    }, []);

    const handleSave = async () => {
        let success = true;

        // Save Limit
        if (limit > 0 && limit <= 50) {
            localStorage.setItem('spotify_results_limit', limit);
        } else {
            setPopup({ visible: true, message: 'Limit must be between 1 and 50.', type: 'error' });
            return; // Stop if limit is invalid
        }

        // Save AutoScan
        localStorage.setItem('auto_scan_library', autoScan);

        // Save Background
        localStorage.setItem('app_background', background);
        document.documentElement.style.setProperty('--app-background', background);

        // Save Config
        try {
            const response = await fetch('http://localhost:3001/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ clientId, clientSecret, downloadPath })
            });
            if (!response.ok) {
                const errData = await response.json();
                setPopup({ visible: true, message: `Error saving config: ${errData.error}`, type: 'error' });
                success = false;
            }
        } catch (err) {
            console.error('Error saving config:', err);
            setPopup({ visible: true, message: 'Network error while saving config.', type: 'error' });
            success = false;
        }

        if (success) {
            setPopup({ visible: true, message: 'Settings saved!', type: 'success' });
        }
    };

    return (
        <div className="settings-container">
            {popup.visible && (
                <Popup 
                    message={popup.message} 
                    type={popup.type} 
                    onClose={() => setPopup({ visible: false, message: '', type: '' })} 
                />
            )}
            <h1 className="fade-in">Settings</h1>

            <div className="setting-item fade-in" style={{ animationDelay: '0.1s' }}>
                <label htmlFor="bg-select">App Background:</label>
                <select 
                    id="bg-select" 
                    value={background} 
                    onChange={(e) => setBackground(e.target.value)}
                    style={{ 
                        background: 'rgba(255,255,255,0.1)', 
                        color: 'white', 
                        border: '1px solid rgba(255,255,255,0.2)',
                        borderRadius: '10px',
                        padding: '0.3rem',
                        marginTop: '0.5rem',
                        width: '100%'
                    }}
                >
                    {backgrounds.map(bg => (
                        <option key={bg.name} value={bg.value} style={{ background: '#222' }}>{bg.name}</option>
                    ))}
                </select>
            </div>

            <div className="setting-item fade-in" style={{ animationDelay: '0.2s' }}>
                <label htmlFor="auto-scan">
                    <input 
                        type="checkbox" 
                        id="auto-scan" 
                        checked={autoScan} 
                        onChange={(e) => setAutoScan(e.target.checked)} 
                        style={{ marginRight: '1rem', width: '1.2rem', height: '1.2rem', verticalAlign: 'middle' }}
                    />
                    Automatically scan library on open
                </label>
            </div>

            <div className="setting-item fade-in" style={{ animationDelay: '0.3s' }}>
                <label htmlFor="client-id">Spotify Client ID:</label>
                <input
                    type="text"
                    id="client-id"
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    placeholder="Spotify Client ID"
                    style={{ width: '100%', marginTop: '0.5rem' }} 
                />
                <label htmlFor="client-secret">Spotify Client Secret:</label>
                <input
                    type="password"
                    id="client-secret"
                    value={clientSecret}
                    onChange={(e) => setClientSecret(e.target.value)}
                    placeholder="Spotify Client Secret"
                    style={{ width: '100%', marginTop: '0.5rem' }}
                />
            </div>

            <div className="setting-item fade-in" style={{ animationDelay: '0.3s' }}>
                <label htmlFor="download-path">Download Path (Optional):</label>
                <input
                    type="text"
                    id="download-path"
                    value={downloadPath}
                    onChange={(e) => setDownloadPath(e.target.value)}
                    placeholder="e.g. /home/user/Music"
                    style={{ width: '100%', marginTop: '0.5rem' }}
                />
                <p style={{ fontSize: '0.8rem', opacity: 0.6, marginTop: '0.5rem' }}>
                    Leave empty to use the default 'downloads' folder in project root.
                </p>
            </div>

            <div className="setting-item fade-in" style={{ animationDelay: '0.4s' }}>
                <label htmlFor="results-limit">Results per page (1-50):</label>
                <input
                    type="number"
                    id="results-limit"
                    value={limit}
                    onChange={(e) => setLimit(e.target.value)}
                    min="1"
                    max="50"
                />
            </div>
            <button className="fade-in" style={{ animationDelay: '0.5s' }} onClick={handleSave}>Save</button>
        </div>
    );
};

export default Settings;
