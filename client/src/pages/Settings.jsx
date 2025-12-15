import React, { useState, useEffect } from 'react';
import './css/Settings.css';

const Settings = () => {
    useEffect(() => {
        document.title = 'Settings - Spotify Downloader';
    }, []);

    const [limit, setLimit] = useState(20);

    useEffect(() => {
        const savedLimit = localStorage.getItem('spotify_results_limit');
        if (savedLimit) {
            setLimit(parseInt(savedLimit, 10));
        }
    }, []);

    const handleSave = () => {
        if (limit > 0 && limit <= 50) {
            localStorage.setItem('spotify_results_limit', limit);
            alert('Settings saved!');
        } else {
            alert('Limit must be between 1 and 50.');
        }
    };

    return (
        <div className="settings-container">
            <h1>Settings</h1>
            <div className="setting-item">
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
            <button onClick={handleSave}>Save</button>
        </div>
    );
};

export default Settings;
