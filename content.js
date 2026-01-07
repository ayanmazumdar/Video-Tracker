// content.js
// This script runs on every page. It checks for playing videos.

let accumulatedTime = 0;
const SYNC_INTERVAL = 5000; // Sync with storage every 5 seconds
let lastSyncTime = Date.now();

console.log("Video Tracker: Script loaded on this page.");

// Assign interval to a variable so we can stop it later
const trackingInterval = setInterval(() => {
    // 1. Safety Check: If extension was reloaded, chrome.runtime.id becomes undefined
    // We must stop this script immediately to prevent "Context Invalidated" errors.
    if (!chrome.runtime?.id) {
        console.log("Video Tracker: Extension context invalidated. Stopping tracker.");
        clearInterval(trackingInterval);
        return;
    }

    const videos = document.querySelectorAll('video');
    let isAnyVideoPlaying = false;

    for (const video of videos) {
        // Check if video is playing (not paused, not ended, and has data)
        if (!video.paused && !video.ended && video.readyState > 2) {
            isAnyVideoPlaying = true;
            break; 
        }
    }

    if (isAnyVideoPlaying) {
        accumulatedTime += 1;
    }

    // Send data to background script periodically or if we have a lot of data
    if (Date.now() - lastSyncTime > SYNC_INTERVAL && accumulatedTime > 0) {
        syncTime();
    }

}, 1000); 

function syncTime() {
    if (accumulatedTime === 0) return;

    // 2. Explicit Safety Check: Ensure chrome.runtime exists before accessing sendMessage
    // This prevents "Cannot read properties of undefined (reading 'sendMessage')"
    if (!chrome.runtime || !chrome.runtime.sendMessage) {
        console.log("Video Tracker: Runtime unavailable. Stopping.");
        clearInterval(trackingInterval);
        return;
    }

    // 3. Wrap sendMessage in try-catch to handle rare race conditions
    try {
        chrome.runtime.sendMessage({
            action: "logTime",
            seconds: accumulatedTime
        }, (response) => {
            // Check for internal runtime errors (like message channel closing)
            if (chrome.runtime.lastError) {
                console.log("Video Tracker: Connection lost (expected during reload).");
                clearInterval(trackingInterval);
            }
        });

        console.log(`Video Tracker: Syncing ${accumulatedTime} seconds to storage.`);
        accumulatedTime = 0;
        lastSyncTime = Date.now();

    } catch (error) {
        console.log("Video Tracker: Extension reloaded/invalidated. Stopping sync.");
        clearInterval(trackingInterval);
    }
}

// Ensure we save data before the user leaves the page
window.addEventListener('beforeunload', () => {
    // Only attempt sync if the extension is still valid
    if (chrome.runtime?.id) {
        syncTime();
    }
});