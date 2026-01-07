// content.js
// This script runs on every page. It checks for playing videos.

let accumulatedTime = 0;
const SYNC_INTERVAL = 5000; 
let lastSyncTime = Date.now();
// Capture the domain (e.g., "youtube.com")
const hostname = window.location.hostname; 

console.log(`Video Tracker: Script loaded on ${hostname}`);

const trackingInterval = setInterval(() => {
    // 1. Safety Check
    if (!chrome.runtime?.id) {
        clearInterval(trackingInterval);
        return;
    }

    const videos = document.querySelectorAll('video');
    let isAnyVideoPlaying = false;

    for (const video of videos) {
        if (!video.paused && !video.ended && video.readyState > 2) {
            isAnyVideoPlaying = true;
            break; 
        }
    }

    if (isAnyVideoPlaying) {
        accumulatedTime += 1;
    }

    if (Date.now() - lastSyncTime > SYNC_INTERVAL && accumulatedTime > 0) {
        syncTime();
    }

}, 1000); 

function syncTime() {
    if (accumulatedTime === 0) return;

    if (!chrome.runtime || !chrome.runtime.sendMessage) {
        clearInterval(trackingInterval);
        return;
    }

    try {
        // CHANGED: We now send the 'domain' along with the time
        chrome.runtime.sendMessage({
            action: "logTime",
            seconds: accumulatedTime,
            domain: hostname
        }, (response) => {
            if (chrome.runtime.lastError) {
                clearInterval(trackingInterval);
            }
        });

        console.log(`Video Tracker: Syncing ${accumulatedTime}s for ${hostname}`);
        accumulatedTime = 0;
        lastSyncTime = Date.now();

    } catch (error) {
        clearInterval(trackingInterval);
    }
}

window.addEventListener('beforeunload', () => {
    if (chrome.runtime?.id) {
        syncTime();
    }
});