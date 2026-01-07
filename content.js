// content.js
let accumulatedTime = 0;
const SYNC_INTERVAL = 1000;
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
    if (!video) return 'Long Form';

    // Get URL for branding checks
    const url = window.location.href;

    // 1. Live Stream Check (Infinity Duration)
    if (video.duration === Infinity) return 'Live Stream';

    // 2. Aspect Ratio Check (Vertical = Shorts/Reels)
    if (video.videoWidth > 0 && video.videoHeight > 0) {
        const aspectRatio = video.videoWidth / video.videoHeight;
        if (aspectRatio < 0.9) {
            // Specific Branding Check based on URL
            if (url.includes('youtube.com/shorts/')) return 'YouTube Shorts';
            if (url.includes('instagram.com/reels/') || url.includes('facebook.com/reel/')) return 'Reels';
            if (url.includes('tiktok.com')) return 'TikTok';

            return 'Short Video'; // Generic vertical
        }
    }

    // 3. Duration Check (Fallback for Horizontal Shorts)
    if (Number.isFinite(video.duration)) {
        if (video.duration < 90) {
            // Check branding even for horizontal shorts (unlikely but possible)
            if (url.includes('youtube.com/shorts/')) return 'YouTube Shorts';
            return 'Short Video';
        }
        return 'Long Form';
    }

    return 'Long Form'; // Default safety
}

function syncTime(videoElement) {
    if (accumulatedTime === 0) return;

    if (!chrome.runtime || !chrome.runtime.sendMessage) {
        clearInterval(trackingInterval);
        return;
    }

    let currentTitle = document.title.trim();
    // Use the determined category
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