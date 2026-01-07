// background.js

// 1. Create a global promise chain to act as a queue
let updateQueue = Promise.resolve();

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "logTime") {
        // 2. Chain the new update to the end of the queue
        updateQueue = updateQueue.then(() => {
            return updateTimeSafe(request.seconds, request.domain, request.title, request.category);
        });
        
        // Respond immediately that the request was received
        sendResponse({status: "queued"}); 
    }
    return true; 
});

// 3. Convert the update logic to return a Promise
function updateTimeSafe(secondsToAdd, domain, title, category) {
    return new Promise((resolve) => {
        const today = new Date().toISOString().split('T')[0];

        chrome.storage.local.get([today], (result) => {
            let data = result[today] || { total: 0, domains: {}, categories: {} };
            
            // Legacy data fix: handle cases where data might be just a number from older versions
            if (typeof data === 'number') data = { total: data, domains: {}, categories: {} };
            if (!data.categories) data.categories = {};

            // --- Core Update Logic (Same as before) ---
            
            // 1. Update Global Total
            data.total += secondsToAdd;

            // 2. Update Category Stats
            if (!data.categories[category]) data.categories[category] = 0;
            data.categories[category] += secondsToAdd;

            // 3. Update Domain & Videos
            if (!data.domains[domain]) data.domains[domain] = { total: 0, videos: {} };
            // Legacy fix for domains
            if (typeof data.domains[domain] === 'number') data.domains[domain] = { total: data.domains[domain], videos: {} };

            data.domains[domain].total += secondsToAdd;

            const safeTitle = title || "Unknown Video";
            if (!data.domains[domain].videos[safeTitle]) data.domains[domain].videos[safeTitle] = 0;
            data.domains[domain].videos[safeTitle] += secondsToAdd;

            // --- End Core Update Logic ---

            let storageUpdate = {};
            storageUpdate[today] = data;

            // 4. Save and Resolve the Promise only when storage is done
            chrome.storage.local.set(storageUpdate, () => {
                resolve(); 
            });
        });
    });
}