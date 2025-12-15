import React, { useEffect, useState } from 'react';
import './css/Popup.css';

const Popup = ({ message, type, onClose }) => {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        // Fade in with a slight delay to ensure transition is registered
        const renderTimer = setTimeout(() => {
            setIsVisible(true);
        }, 50); // Small delay

        const timer = setTimeout(() => {
            // Start fade out before closing
            setIsVisible(false);
            // Allow time for fade-out animation before unmounting
            const closeTimer = setTimeout(() => {
                onClose();
            }, 500); // Match this duration to your CSS fade-out transition
            return () => clearTimeout(closeTimer);
        }, 3000); // Auto-close after 3 seconds

        return () => {
            clearTimeout(renderTimer);
            clearTimeout(timer);
        };
    }, [onClose]);

    return (
        <div className={`popup ${type} ${isVisible ? 'show' : 'hide'}`}>
            <p>{message}</p>
            <button className="close-btn" onClick={onClose}>&times;</button>
        </div>
    );
};

export default Popup;
