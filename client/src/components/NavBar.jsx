import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { FiSearch, FiSettings } from 'react-icons/fi';
import './css/NavBar.css';

const NavBar = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const [query, setQuery] = useState('');

    const handleSearch = async () => {
        if (!query.trim()) return;

        const limit = localStorage.getItem('spotify_results_limit') || 20;

        try {
            const response = await fetch(`http://localhost:3001/search-spotify?q=${encodeURIComponent(query)}&limit=${limit}`);
            if (response.ok) {
                const data = await response.json();
                navigate('/results', { state: { results: data.tracks } });
                setQuery('');
            } else {
                console.error('Search failed');
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
        <nav className="navbar">
            <div className="navbar-title">
                <Link to="/">Spotify Downloader</Link>
            </div>
            <div className="navbar-search">
                {location.pathname !== '/' && location.pathname !== '/settings' && (
                    <div className="search-container">
                        <input
                            type="text"
                            placeholder="Search..."
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onKeyPress={handleKeyPress}
                        />
                        <button onClick={handleSearch} className="search-icon-btn">
                            <FiSearch />
                        </button>
                    </div>
                )}
            </div>
            <div className="navbar-links">
                <Link to="/settings" className="settings-icon">
                    <FiSettings />
                </Link>
            </div>
        </nav>
    );
};

export default NavBar;
