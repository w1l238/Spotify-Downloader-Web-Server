import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiSearch } from 'react-icons/fi';
import './css/Home.css';

const Home = () => {
    useEffect(() => {
        document.title = 'Home - Spotify Downloader';
    }, []);

    const [query, setQuery] = useState('');
    const navigate = useNavigate();

    const handleSearch = async () => {
        if (!query.trim()) return;

        const limit = localStorage.getItem('spotify_results_limit') || 20;

        try {
            const response = await fetch(`http://localhost:3001/search-spotify?q=${encodeURIComponent(query)}&limit=${limit}`);
            if (response.ok) {
                const data = await response.json();
                navigate('/results', { state: { results: data.tracks } });
            } else {
                console.error('Search failed');
                // Handle search failure, e.g., show a notification
            }
        } catch (error) {
            console.error('Error during search:', error);
        }
    };

    const handleKeyPress = (event) => {
        if (event.key === 'Enter') {
            handleSearch();
        }
    };

    return (
        <div className="home-container">
            <div className="search-container">
                <input
                    type="text"
                    placeholder="Search for a song..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyPress={handleKeyPress}
                />
                <button onClick={handleSearch} className="search-icon-btn">
                    <FiSearch />
                </button>
            </div>
        </div>
    );
};

export default Home;
