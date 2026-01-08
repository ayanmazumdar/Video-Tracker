// content.js
let accumulatedTime = 0;
const SYNC_INTERVAL = 5000;
let lastSyncTime = Date.now();
const hostname = window.location.hostname;

// Set of currently playing video elements
const activeVideos = new Set();
let trackingTimer = null;
let lastVisibilityState = document.visibilityState;

console.log(`Video Tracker: Active on ${hostname}`);

// --- Observer & Listeners ---

// 1. Initial Scan
document.querySelectorAll('video').forEach(attachListeners);

// 2. Observer for new videos
const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
            if (node.nodeName === 'VIDEO') {
                attachListeners(node);
            } else if (node.querySelectorAll) {
                node.querySelectorAll('video').forEach(attachListeners);
            }
        });
    });
});

observer.observe(document.body, { childList: true, subtree: true });

// 3. Visibility Listener (Instant Status Update)
document.addEventListener('visibilitychange', () => {
    // If we were tracking, flush the time for the *previous* state
    if (activeVideos.size > 0 && accumulatedTime > 0) {
        const primaryVideo = activeVideos.values().next().value;
        syncTime(primaryVideo, lastVisibilityState);
    }
    // Update state for the next batch
    lastVisibilityState = document.visibilityState;
});

function attachListeners(video) {
    if (video.dataset.vtAttached) return; // Prevent double attachment
    video.dataset.vtAttached = 'true';

    video.addEventListener('play', handlePlay);
    video.addEventListener('playing', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('ended', handlePause);
    video.addEventListener('waiting', handlePause); // Usually implies buffering
    video.addEventListener('emptied', handlePause); // Source removed

    // Check initial state (e.g. autoplay)
    if (!video.paused && !video.ended && video.readyState > 2) {
        handlePlay({ target: video });
    }
}

// --- Event Handlers ---

function handlePlay(e) {
    activeVideos.add(e.target);
    startTracking();
}

function handlePause(e) {
    activeVideos.delete(e.target);
    if (activeVideos.size === 0) {
        stopTracking();
    }
}

// --- Tracking Loop ---

function startTracking() {
    if (trackingTimer) return; // Already running

    trackingTimer = setInterval(() => {
        if (!chrome.runtime?.id) {
            stopTracking();
            return;
        }

        if (activeVideos.size > 0) {
            accumulatedTime += 1; // Increment by 1s if at least one video is playing

            if (Date.now() - lastSyncTime > SYNC_INTERVAL && accumulatedTime > 0) {
                const primaryVideo = activeVideos.values().next().value;
                // Sync with current state
                syncTime(primaryVideo, document.visibilityState);
            }
        } else {
            stopTracking(); // Safety catch
        }
    }, 1000);
}

function stopTracking() {
    if (trackingTimer) {
        clearInterval(trackingTimer);
        trackingTimer = null;
    }
    // Final sync on stop
    if (accumulatedTime > 0) {
        syncTime(null, document.visibilityState);
    }
}

// --- Sync Logic ---

function determineCategory(video, visibilityState) {
    let category = 'Long Form';

    if (video) {
        const url = window.location.href;

        // 1. Live Stream Check
        if (video.duration === Infinity) {
            category = 'Live Stream';
        }
        // 2. Vertical/Shorts Check
        else if (video.videoWidth > 0 && video.videoHeight > 0 && (video.videoWidth / video.videoHeight < 0.9)) {
            if (url.includes('youtube.com/shorts/')) category = 'YouTube Shorts';
            else if (url.includes('instagram.com/reels/') || url.includes('facebook.com/reel/')) category = 'Reels';
            else if (url.includes('tiktok.com')) category = 'TikTok';
            else category = 'Short Video';
        }
        // 3. Duration Check
        else if (Number.isFinite(video.duration) && video.duration < 90) {
            if (url.includes('youtube.com/shorts/')) category = 'YouTube Shorts';
            else category = 'Short Video';
        }
    }

    // --- Background Detection ---
    if (visibilityState === 'hidden') {
        category += ' (Background)';
    }

    return category;
}

function syncTime(videoElement, visibilityState) {
    if (accumulatedTime === 0) return;

    if (!chrome.runtime || !chrome.runtime.sendMessage) {
        stopTracking();
        return;
    }

    // Clean title: remove notification counts e.g. "(1) Video Name" -> "Video Name"
    let currentTitle = document.title.replace(/^\(\d+\)\s+/, '').trim();
    // Default to current state if not passed (legacy safety, though internal calls pass it)
    const visState = visibilityState || document.visibilityState;
    let category = determineCategory(videoElement, visState);

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
        stopTracking();
    }
}

// Window lifecycle safety
window.addEventListener('beforeunload', () => {
    if (trackingTimer) stopTracking();
});