/**
 * Neurobehavioral Task Battery — Firebase Data Store
 *
 * Usage: Include this script in any task HTML file.
 * It auto-initializes Firebase and exposes saveTaskData(data).
 *
 * Setup:
 * 1. Create a Firebase project at https://console.firebase.google.com
 * 2. Enable Firestore Database (start in test mode for development)
 * 3. Register a web app and paste your config below
 * 4. Deploy Firestore security rules for production
 */

// ─── Firebase Config ───
// REPLACE these values with your Firebase project config
const FIREBASE_CONFIG = {
    apiKey: "AIzaSyAA3bMOJf1OhkpF9trw1-SpT_PipoOxQJ4",
    authDomain: "neurobehavioural-tasks.firebaseapp.com",
    projectId: "neurobehavioural-tasks",
    storageBucket: "neurobehavioural-tasks.firebasestorage.app",
    messagingSenderId: "558002269627",
    appId: "1:558002269627:web:66739bd60a5ae892a7689e"
};

// ─── State ───
let _db = null;
let _initialized = false;
let _queue = []; // buffer writes before init completes

// ─── Load Firebase SDK from CDN ───
function _loadScript(src) {
    return new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = src;
        s.onload = resolve;
        s.onerror = reject;
        document.head.appendChild(s);
    });
}

async function _initFirebase() {
    if (_initialized) return;
    if (FIREBASE_CONFIG.apiKey === "YOUR_API_KEY") {
        console.warn('[data-store] Firebase not configured. Data will only be available via local download. Edit data-store.js to add your Firebase config.');
        return;
    }

    try {
        await _loadScript('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
        await _loadScript('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js');

        firebase.initializeApp(FIREBASE_CONFIG);
        _db = firebase.firestore();
        _initialized = true;
        console.log('[data-store] Firebase initialized');

        // Flush queued writes
        for (const item of _queue) {
            await _writeToFirestore(item.collection, item.data);
        }
        _queue = [];
    } catch (err) {
        console.error('[data-store] Firebase init failed:', err);
    }
}

async function _writeToFirestore(collection, data) {
    try {
        const docRef = await _db.collection(collection).add(data);
        console.log(`[data-store] Saved to ${collection}/${docRef.id}`);
        return docRef.id;
    } catch (err) {
        console.error('[data-store] Firestore write failed:', err);
        return null;
    }
}

/**
 * Save task completion data to Firestore.
 *
 * @param {Object} data - Must include { task, participantId, trials, ... }
 * @returns {Promise<string|null>} Firestore document ID, or null if not configured
 *
 * Data is saved to collection "responses" with structure:
 *   - task: string (task identifier)
 *   - participantId: string
 *   - completedAt: ISO timestamp
 *   - sessionId: string (unique per page load)
 *   - userAgent: string
 *   - screenWidth/screenHeight: number
 *   - trialCount: number
 *   - trials: array (full trial-level data)
 *   - summary: object (task-level aggregates)
 */
async function saveTaskData(data) {
    const enriched = {
        ...data,
        completedAt: new Date().toISOString(),
        savedAt: Date.now(),
        sessionId: _sessionId,
        userAgent: navigator.userAgent,
        screenWidth: window.innerWidth,
        screenHeight: window.innerHeight,
        trialCount: data.trials ? data.trials.length : 0,
    };

    if (!_initialized) {
        if (FIREBASE_CONFIG.apiKey === "YOUR_API_KEY") {
            console.log('[data-store] Firebase not configured, skipping save. Data:', enriched);
            return null;
        }
        // Queue for when init completes
        _queue.push({ collection: 'responses', data: enriched });
        return null;
    }

    return await _writeToFirestore('responses', enriched);
}

/**
 * Save individual trial data in real-time (optional, for crash resilience).
 * Writes to "live_trials" collection.
 */
async function saveTrialLive(data) {
    if (!_initialized) return null;
    return await _writeToFirestore('live_trials', {
        ...data,
        timestamp: Date.now(),
        sessionId: _sessionId,
    });
}

// ─── Session ID ───
const _sessionId = 'S-' + Date.now().toString(36) + '-' + Math.random().toString(36).substr(2, 6);

// ─── Auto-init on load ───
_initFirebase();

// ─── Status indicator ───
// Adds a small dot to the page corner showing connection status
window.addEventListener('DOMContentLoaded', () => {
    const dot = document.createElement('div');
    dot.id = 'firebase-status';
    dot.style.cssText = 'position:fixed;bottom:8px;right:8px;width:8px;height:8px;border-radius:50%;z-index:9999;transition:background 0.3s;';

    function updateDot() {
        if (FIREBASE_CONFIG.apiKey === "YOUR_API_KEY") {
            dot.style.background = '#52525b';
            dot.title = 'Firebase not configured — local only';
        } else if (_initialized) {
            dot.style.background = '#4ade80';
            dot.title = 'Connected to Firebase';
        } else {
            dot.style.background = '#eab308';
            dot.title = 'Connecting to Firebase...';
        }
    }

    document.body.appendChild(dot);
    updateDot();
    setInterval(updateDot, 2000);
});
