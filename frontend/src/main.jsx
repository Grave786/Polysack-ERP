import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import App from './App';
import './index.css';

const CHUNK_RELOAD_KEY = 'polysack_chunk_reload_ts';
const CHUNK_RELOAD_COOLDOWN_MS = 60 * 1000;

const reloadOnceForStaleChunk = () => {
    try {
        const lastReload = Number(sessionStorage.getItem(CHUNK_RELOAD_KEY) || 0);
        if (lastReload && Date.now() - lastReload < CHUNK_RELOAD_COOLDOWN_MS) {
            return;
        }
        sessionStorage.setItem(CHUNK_RELOAD_KEY, String(Date.now()));
    } catch {
        // Ignore sessionStorage access errors and still attempt reload
    }
    window.location.reload();
};

window.addEventListener('vite:preloadError', (event) => {
    event.preventDefault();
    reloadOnceForStaleChunk();
});

window.addEventListener('unhandledrejection', (event) => {
    const message = String(event?.reason?.message || event?.reason || '');
    if (
        message.includes('Failed to fetch dynamically imported module') ||
        message.includes('error loading dynamically imported module')
    ) {
        reloadOnceForStaleChunk();
    }
});

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <BrowserRouter>
            <Toaster
                position="top-right"
                toastOptions={{
                    duration: 4000,
                    style: {
                        background: '#1e293b',
                        color: '#fff',
                        fontSize: '14px',
                        borderRadius: '8px',
                        border: '1px solid #334155',
                    },
                }}
            />
            <App />
        </BrowserRouter>
    </React.StrictMode>
);
