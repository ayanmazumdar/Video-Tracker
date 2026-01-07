// background.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "logTime") {
        updateTime(request.seconds, request.domain);
        sendResponse({status: "success"}); 
    }
    return true; 
});

function updateTime(secondsToAdd, domain) {
    const today = new Date().toISOString().split('T')[0];

    chrome.storage.local.get([today], (result) => {
        // Initialize default structure
        let data = result[today] || { total: 0, domains: {} };

        // MIGRATION: Handle case where old data was just a number
        if (typeof data === 'number') {
            data = { total: data, domains: {} };
        }

        // Update Total
        data.total += secondsToAdd;

        // Update Specific Domain
        // If domain doesn't exist yet, initialize it to 0
        if (!data.domains[domain]) {
            data.domains[domain] = 0;
        }
        data.domains[domain] += secondsToAdd;

        // Save back to storage
        let storageUpdate = {};
        storageUpdate[today] = data;

        chrome.storage.local.set(storageUpdate, () => {
            console.log(`Updated: ${data.total}s total, ${data.domains[domain]}s for ${domain}`);
        });
    });
}