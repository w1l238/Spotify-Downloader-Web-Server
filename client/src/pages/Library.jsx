import React, { useState, useEffect, useMemo } from 'react';
import { FiGrid, FiList, FiTrash2, FiMusic, FiSearch, FiRefreshCw, FiArrowLeft, FiDisc, FiX, FiCheck, FiEdit } from 'react-icons/fi';
import toast, { Toaster } from 'react-hot-toast';
import './css/Library.css';

const Library = () => {
    const [songs, setSongs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [view, setView] = useState('albums'); // 'albums' | 'songs'
    const [selectedAlbum, setSelectedAlbum] = useState(null);
    const [deleteModal, setDeleteModal] = useState({ show: false, songId: null, songTitle: '' });
    const [errorModal, setErrorModal] = useState({ show: false, message: '' });
    const [editModal, setEditModal] = useState({ show: false, song: null });
    const [scanStatus, setScanStatus] = useState('idle'); // 'idle' | 'loading' | 'success' | 'error'
    const [animationsDone, setAnimationsDone] = useState(false);

    useEffect(() => {
        document.title = 'Library - Spotify Downloader';
        document.body.classList.add('library-page');
        
        const shouldAutoScan = localStorage.getItem('auto_scan_library') === 'true';
        if (shouldAutoScan) {
            handleScan();
        } else {
            fetchLibrary();
        }

        const timer = setTimeout(() => setAnimationsDone(true), 1500);
        return () => {
            clearTimeout(timer);
            document.body.classList.remove('library-page');
        };
    }, []);

    const fetchLibrary = async () => {
        setLoading(true);
        try {
            const response = await fetch('http://localhost:3001/api/library');
            if (response.ok) {
                const data = await response.json();
                setSongs(data);
            } else {
                toast.error('Failed to load library');
            }
        } catch (error) {
            console.error('Error fetching library:', error);
            toast.error('Network error loading library', { id: 'network-error' });
        } finally {
            setLoading(false);
        }
    };

    const handleScan = async () => {
        setScanStatus('loading');
        try {
            const response = await fetch('http://localhost:3001/api/library/scan');
            // Add 1 second artificial delay for better UX
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            if (response.ok) {
                const data = await response.json();
                setSongs(data);
                toast.success('Library updated', { className: 'popup success show' });
                setScanStatus('success');
            } else {
                const data = await response.json();
                const rawError = data.error || 'Failed to scan library';
                setErrorModal({ 
                    show: true, 
                    message: (
                        <>
                            {rawError}
                            <br /><br />
                            <b>Check backend server status.</b>
                        </>
                    )
                });
                setScanStatus('error');
            }
        } catch (error) {
            console.error('Error scanning library:', error);
            setErrorModal({ 
                show: true, 
                message: (
                    <>
                        Network error scanning library: {error.message}
                        <br /><br />
                        <b>Possible Fix: Check backend server status.</b>
                    </>
                )
            });
            setScanStatus('error');
        } finally {
            setTimeout(() => setScanStatus('idle'), 3000);
        }
    };

    const handleDeleteClick = (song) => {
        setDeleteModal({ show: true, songId: song.id, songTitle: song.title });
    };

    const handleEditClick = (song) => {
        setEditModal({ show: true, song: { ...song } });
    };

    const saveMetadata = async () => {
        const { song } = editModal;
        if (!song) return;

        try {
            const response = await fetch(`http://localhost:3001/api/files/${encodeURIComponent(song.id)}/metadata`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: song.title,
                    artist: song.artist,
                    album: song.album,
                    year: song.year
                })
            });

            if (response.ok) {
                toast.success('Metadata updated');
                fetchLibrary(); // Full refresh to sync everything
                setEditModal({ show: false, song: null });
            } else {
                const data = await response.json();
                setErrorModal({ show: true, message: data.error || 'Failed to update metadata' });
            }
        } catch (error) {
            console.error('Error saving metadata:', error);
            setErrorModal({ show: true, message: 'Network error saving metadata' });
        }
    };

    const confirmDelete = async () => {
        if (!deleteModal.songId) return;

        try {
            const response = await fetch(`http://localhost:3001/api/files/${encodeURIComponent(deleteModal.songId)}`, {
                method: 'DELETE',
            });

            if (response.ok) {
                setSongs(songs.filter(s => s.id !== deleteModal.songId));
                toast.success(`Deleted "${deleteModal.songTitle}"`, {
                    style: {
                        background: 'rgba(29, 185, 84, 0.7)',
                        color: 'white',
                        backdropFilter: 'blur(5px)',
                        border: '1px solid rgba(255,255,255,0.3)',
                        borderRadius: '1rem',
                    }
                });
                
                // If we deleted the last song in the current album, go back
                if (selectedAlbum) {
                    const remaining = songs.filter(s => s.id !== deleteModal.songId && s.album === selectedAlbum.name);
                    if (remaining.length === 0) {
                        setView('albums');
                        setSelectedAlbum(null);
                    }
                }

            } else {
                const data = await response.json();
                const rawError = data.error || 'Failed to delete song';
                
                let message = rawError;
                if (rawError.includes('EACCES')) {
                    message = (
                        <>
                            {rawError}
                            <br /><br />
                            <b>Fix: Check user permissions on the folder or file of the song being deleted.</b>
                        </>
                    );
                }
                
                setErrorModal({ show: true, message });
            }
        } catch (error) {
            console.error('Error deleting song:', error);
            setErrorModal({ show: true, message: 'Network error deleting song' });
        } finally {
            setDeleteModal({ show: false, songId: null, songTitle: '' });
        }
    };

    const formatDuration = (seconds) => {
        if (!seconds) return '--:--';
        const min = Math.floor(seconds / 60);
        const sec = Math.floor(seconds % 60);
        return `${min}:${sec < 10 ? '0' : ''}${sec}`;
    };

    // Group songs by Album
    const albums = useMemo(() => {
        const groups = {};
        songs.forEach(song => {
            const albumName = song.album || 'Unknown Album';
            if (!groups[albumName]) {
                groups[albumName] = {
                    name: albumName,
                    artist: song.artist,
                    songs: [],
                    artId: song.id // Use first song ID to fetch art
                };
            }
            groups[albumName].songs.push(song);
        });
        return Object.values(groups).sort((a, b) => a.name.localeCompare(b.name));
    }, [songs]);

    // Filter Logic
    const filteredContent = useMemo(() => {
        const query = searchQuery.toLowerCase();
        if (view === 'albums') {
            return albums.filter(album => 
                album.name.toLowerCase().includes(query) || 
                album.artist.toLowerCase().includes(query)
            );
        } else if (view === 'songs' && selectedAlbum) {
            // Show all songs in album, or filter if user wants (optional). 
            // For now let's just show all songs of the album, assuming query was for finding the album.
            // Or we can allow searching within the album:
            const albumSongs = songs.filter(s => s.album === selectedAlbum.name);
            if (!query) return albumSongs;
            return albumSongs.filter(s => s.title.toLowerCase().includes(query));
        }
        return [];
    }, [albums, songs, view, selectedAlbum, searchQuery]);

    const handleAlbumClick = (album) => {
        setSelectedAlbum(album);
        setView('songs');
        setSearchQuery(''); // Clear search when entering album
    };

    const handleBack = () => {
        setView('albums');
        setSelectedAlbum(null);
        setSearchQuery('');
    };

    return (
        <div className="library-container">
            <Toaster position="bottom-right" toastOptions={{
                className: '',
                style: {
                    background: 'transparent',
                    color: 'white',
                    backdropFilter: 'blur(15px)',
                    border: '1px solid rgba(255,255,255,0.3)',
                    borderRadius: '1rem',
                    boxShadow: '0 4px 15px rgba(0,0,0,0.2)'
                }
            }} />
            
            <div className={`library-header ${!animationsDone ? 'fade-in' : ''}`}>
                <div className="library-title">
                    {view === 'albums' ? (
                        <h2>My Library</h2>
                    ) : (
                        <button className="back-btn" onClick={handleBack}>
                            <FiArrowLeft /> <span>Back to Albums</span>
                        </button>
                    )}
                </div>

                <div className="library-controls">
                     <div className="library-search">
                        <FiSearch style={{ marginRight: '0.5rem', opacity: 0.7 }} />
                        <input 
                            type="text" 
                            placeholder={view === 'albums' ? "Search albums..." : "Search in album..."}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>

                    <button 
                        className={`icon-btn ${scanStatus}`} 
                        onClick={handleScan} 
                        title="Rescan Library"
                        disabled={scanStatus === 'loading'}
                    >
                         {scanStatus === 'loading' ? <FiRefreshCw className="spin" /> : 
                          scanStatus === 'success' ? <FiCheck /> :
                          scanStatus === 'error' ? <FiX /> :
                          <FiRefreshCw />}
                    </button>
                </div>
            </div>

            {loading && songs.length === 0 ? (
                <div style={{ textAlign: 'center', marginTop: '4rem' }}>Loading library...</div>
            ) : (
                <>
                    {view === 'albums' && (
                        <div className="album-grid">
                            {filteredContent.map((album, index) => (
                                <div 
                                    key={album.name} 
                                    className={`album-card ${!animationsDone ? 'fade-in' : ''}`} 
                                    onClick={() => handleAlbumClick(album)}
                                    style={{ animationDelay: !animationsDone ? `${Math.min(index * 0.03, 0.5)}s` : '0s' }}
                                >
                                    <div className="album-art">
                                        <img 
                                            src={`http://localhost:3001/api/files/${encodeURIComponent(album.artId)}/art`} 
                                            alt={album.name}
                                            onError={(e) => { e.target.onerror = null; e.target.src = 'data:image/svg+xml;base64,...'; /* Fallback handled by CSS gradient mostly */ e.target.style.display = 'none'; }}
                                            onLoad={(e) => e.target.style.display = 'block'}
                                        />
                                        <FiDisc style={{ display: 'none', fontSize: '3rem', opacity: 0.5 }} /> 
                                    </div>
                                    <div className="album-info">
                                        <h3 title={album.name}>{album.name}</h3>
                                        <p>{album.artist}</p>
                                        <p style={{ fontSize: '0.8rem', opacity: 0.5 }}>{album.songs.length} songs</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {view === 'songs' && selectedAlbum && (
                        <div className="album-detail-view" key={selectedAlbum.name}>
                             <div className="album-view-header fade-in">
                                <div className="album-view-art">
                                    <img 
                                        src={`http://localhost:3001/api/files/${encodeURIComponent(selectedAlbum.artId)}/art`} 
                                        alt={selectedAlbum.name}
                                        onError={(e) => { e.target.style.display = 'none'; }}
                                    />
                                </div>
                                <div className="album-view-details">
                                    <h1>{selectedAlbum.name}</h1>
                                    <h2>{selectedAlbum.artist}</h2>
                                    <p>{selectedAlbum.songs.length} songs</p>
                                </div>
                             </div>

                             <div className="song-list">
                                <div className="song-list-header fade-in" style={{ animationDelay: '0.1s' }}>
                                    <div>#</div>
                                    <div>Title</div>
                                    <div>Duration</div>
                                    <div></div>
                                </div>
                                {filteredContent.map((song, index) => (
                                    <div 
                                        key={song.id} 
                                        className="song-row fade-in"
                                        style={{ animationDelay: `${0.2 + Math.min(index * 0.03, 0.5)}s` }}
                                    >
                                        <div style={{ opacity: 0.5 }}>{index + 1}</div>
                                        <div style={{ fontWeight: 'bold' }}>{song.title}</div>
                                        <div style={{ fontFamily: 'monospace', opacity: 0.7 }}>{formatDuration(song.duration)}</div>
                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                            <button className="edit-btn" onClick={() => handleEditClick(song)} title="Edit Metadata">
                                                <FiEdit />
                                            </button>
                                            <button className="delete-btn" onClick={() => handleDeleteClick(song)} title="Delete Song">
                                                <FiTrash2 />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                             </div>
                        </div>
                    )}

                    {filteredContent.length === 0 && !loading && (
                        <div style={{ textAlign: 'center', marginTop: '4rem', opacity: 0.5 }}>
                            No items found.
                        </div>
                    )}
                </>
            )}

            {/* Edit Modal */}
            {editModal.show && (
                <div className="modal-overlay" onClick={() => setEditModal({ show: false, song: null })}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <button className="modal-close-btn" onClick={() => setEditModal({ show: false, song: null })}>
                            <FiX />
                        </button>
                        <h3>Edit Metadata</h3>
                        <div className="edit-form">
                            <label>Title</label>
                            <input 
                                type="text" 
                                value={editModal.song.title} 
                                onChange={e => setEditModal({ ...editModal, song: { ...editModal.song, title: e.target.value } })}
                            />
                            <label>Artist</label>
                            <input 
                                type="text" 
                                value={editModal.song.artist} 
                                onChange={e => setEditModal({ ...editModal, song: { ...editModal.song, artist: e.target.value } })}
                            />
                            <label>Album</label>
                            <input 
                                type="text" 
                                value={editModal.song.album} 
                                onChange={e => setEditModal({ ...editModal, song: { ...editModal.song, album: e.target.value } })}
                            />
                            <label>Year</label>
                            <input 
                                type="number" 
                                value={editModal.song.year || ''} 
                                onChange={e => setEditModal({ ...editModal, song: { ...editModal.song, year: e.target.value } })}
                            />
                        </div>
                        <div className="modal-actions">
                            <button className="modal-btn cancel" onClick={() => setEditModal({ show: false, song: null })}>Cancel</button>
                            <button className="modal-btn save" onClick={saveMetadata} style={{ background: '#1db954', color: 'white' }}>Save</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {deleteModal.show && (
                <div className="modal-overlay" onClick={() => setDeleteModal({ ...deleteModal, show: false })}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <h3>Delete Song?</h3>
                        <p>Are you sure you want to delete <b>{deleteModal.songTitle}</b>?</p>
                        <p style={{fontSize: '0.8rem', color: '#aaa', marginBottom: '2rem'}}>This action cannot be undone.</p>
                        <div className="modal-actions">
                            <button className="modal-btn cancel" onClick={() => setDeleteModal({ ...deleteModal, show: false })}>Cancel</button>
                            <button className="modal-btn delete" onClick={confirmDelete}>Delete</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Error Modal */}
            {errorModal.show && (
                <div className="modal-overlay">
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <button className="modal-close-btn" onClick={() => setErrorModal({ show: false, message: '' })}>
                            <FiX />
                        </button>
                        <h3 style={{ color: '#ff5050' }}>Error</h3>
                        <p>{errorModal.message}</p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Library;