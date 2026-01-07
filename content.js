// content.js
let accumulatedTime = 0;
const SYNC_INTERVAL = 5000; 
let lastSyncTime = Date.now();
// We'll capture the title dynamically inside the loop
const hostname = window.location.hostname; 

console.log(`Video Tracker: Script loaded on ${hostname}`);

const trackingInterval = setInterval(() => {
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

    // Capture the current page title (e.g., "Rick Astley - Never Gonna Give You Up - YouTube")
    // We trim whitespace to keep it clean
    let currentTitle = document.title.trim();

    try {
        chrome.runtime.sendMessage({
            action: "logTime",
            seconds: accumulatedTime,
            domain: hostname,
            title: currentTitle // NEW: Sending the specific video title
        }, (response) => {
            if (chrome.runtime.lastError) {
                clearInterval(trackingInterval);
            }
        });

        console.log(`Video Tracker: Syncing ${accumulatedTime}s for "${currentTitle}"`);
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