// background.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "logTime") {
        updateTime(request.seconds, request.domain, request.title, request.category);
        sendResponse({status: "success"}); 
    }
    return true; 
});

function updateTime(secondsToAdd, domain, title, category) {
    const today = new Date().toISOString().split('T')[0];

    chrome.storage.local.get([today], (result) => {
        let data = result[today] || { total: 0, domains: {}, categories: {} };
        if (typeof data === 'number') data = { total: data, domains: {}, categories: {} };
        if (!data.categories) data.categories = {};

        // 1. Update Global Total
        data.total += secondsToAdd;

        // 2. Update Category Stats (The "Habit" Data)
        if (!data.categories[category]) data.categories[category] = 0;
        data.categories[category] += secondsToAdd;

        // 3. Update Domain & Videos
        if (!data.domains[domain]) data.domains[domain] = { total: 0, videos: {} };
        if (typeof data.domains[domain] === 'number') data.domains[domain] = { total: data.domains[domain], videos: {} };

        data.domains[domain].total += secondsToAdd;

        const safeTitle = title || "Unknown Video";
        if (!data.domains[domain].videos[safeTitle]) data.domains[domain].videos[safeTitle] = 0;
        data.domains[domain].videos[safeTitle] += secondsToAdd;

        let storageUpdate = {};
        storageUpdate[today] = data;
        chrome.storage.local.set(storageUpdate);
    });
}