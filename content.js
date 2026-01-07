// content.js
let accumulatedTime = 0;
const SYNC_INTERVAL = 5000; 
let lastSyncTime = Date.now();
const hostname = window.location.hostname; 

console.log(`Video Tracker: Active on ${hostname}`);

const trackingInterval = setInterval(() => {
    if (!chrome.runtime?.id) {
        clearInterval(trackingInterval);
        return;
    }

    const videos = document.querySelectorAll('video');
    let activeVideo = null;

    for (const video of videos) {
        if (!video.paused && !video.ended && video.readyState > 2) {
            activeVideo = video;
            break; 
        }
    }

    if (activeVideo) {
        accumulatedTime += 1;
    }

    if (Date.now() - lastSyncTime > SYNC_INTERVAL && accumulatedTime > 0) {
        syncTime(activeVideo);
    }
}, 1000); 

function determineCategory(video) {
    const url = window.location.href;
    
    // 1. Explicit URL Check
    if (url.includes('/shorts/')) return 'Shorts/Reels';
    if (url.includes('/reels/')) return 'Shorts/Reels';
    if (hostname.includes('tiktok.com')) return 'Shorts/Reels';

    // 2. Duration Check
    if (video && Number.isFinite(video.duration)) {
        if (video.duration < 90) return 'Shorts/Reels'; // Under 90s
        return 'Long Form'; 
    }

    // 3. Fallback for Live Streams
    if (video && video.duration === Infinity) return 'Live Stream';

    return 'Long Form'; // Default
}

function syncTime(videoElement) {
    if (accumulatedTime === 0) return;

    if (!chrome.runtime || !chrome.runtime.sendMessage) {
        clearInterval(trackingInterval);
        return;
    }

    let currentTitle = document.title.trim();
    // Default to Long Form if video element is lost during sync
    let category = videoElement ? determineCategory(videoElement) : 'Long Form';

    try {
        chrome.runtime.sendMessage({
            action: "logTime",
            seconds: accumulatedTime,
            domain: hostname,
            title: currentTitle,
            category: category
        });

        accumulatedTime = 0;
        lastSyncTime = Date.now();
    } catch (error) {
        clearInterval(trackingInterval);
    }
}

window.addEventListener('beforeunload', () => {
    if (chrome.runtime?.id) syncTime(null);
});