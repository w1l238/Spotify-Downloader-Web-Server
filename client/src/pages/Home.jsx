import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiSearch } from 'react-icons/fi';
import toast, { Toaster } from 'react-hot-toast';
import './css/Home.css';

const Home = () => {
    useEffect(() => {
        document.title = 'Home - Spotify Downloader';
        document.body.classList.add('home-page');
        return () => {
            document.body.classList.remove('home-page');
            document.body.classList.remove('search-focused'); // Clean up focus state too
        };
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
                navigate('/results', { state: { results: data.tracks, query } });
            } else {
                console.error('Search failed');
                toast.error('Search failed. Please check server status.', { id: 'search-error' });
            }
        } catch (error) {
            console.error('Error during search:', error);
            toast.error('Network error during search. Please check server status.', { id: 'search-error' });
        }
    };

    const handleKeyPress = (event) => {
        if (event.key === 'Enter') {
            handleSearch();
        }
    };

    return (
        <div className="home-container">
            <Toaster position="bottom-right" toastOptions={{
                style: {
                    background: 'transparent',
                    color: 'white',
                    backdropFilter: 'blur(15px)',
                    border: '1px solid rgba(255,255,255,0.3)',
                    borderRadius: '1rem',
                    boxShadow: '0 4px 15px rgba(0,0,0,0.2)'
                }
            }} />
                <div className="search-container" style={{ animationDelay: '0.1s' }}>
                    <input
                        type="text"
                        placeholder="Search for a song..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyPress={handleKeyPress}
                        onFocus={() => document.body.classList.add('search-focused')}
                        onBlur={() => document.body.classList.remove('search-focused')}
                    />
                    <button onClick={handleSearch} className="search-icon-btn">
                        <FiSearch />
                    </button>
                </div>
        </div>
    );
};

export default Home;
