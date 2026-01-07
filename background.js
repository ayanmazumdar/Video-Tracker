// background.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "logTime") {
        updateTime(request.seconds, request.domain, request.title);
        sendResponse({status: "success"}); 
    }
    return true; 
});

function updateTime(secondsToAdd, domain, title) {
    const today = new Date().toISOString().split('T')[0];

    chrome.storage.local.get([today], (result) => {
        let data = result[today] || { total: 0, domains: {} };

        // 1. Update Global Total
        // Migration check for old data formats
        if (typeof data === 'number') data = { total: data, domains: {} };
        data.total += secondsToAdd;

        // 2. Initialize Domain if missing
        if (!data.domains[domain]) {
            // New structure: Object with 'total' and 'videos' map
            data.domains[domain] = { total: 0, videos: {} };
        }
        
        // Migration check: If domain data was just a number (from previous version), fix it
        if (typeof data.domains[domain] === 'number') {
            const oldTotal = data.domains[domain];
            data.domains[domain] = { total: oldTotal, videos: {} };
        }

        // 3. Update Domain Total
        data.domains[domain].total += secondsToAdd;

        // 4. Update Specific Video Title
        // Use a safe key for the title (replace dots/invalid chars if necessary, but usually strings are fine in JSON)
        if (!data.domains[domain].videos[title]) {
            data.domains[domain].videos[title] = 0;
        }
        data.domains[domain].videos[title] += secondsToAdd;

        // Save
        let storageUpdate = {};
        storageUpdate[today] = data;

        chrome.storage.local.set(storageUpdate, () => {
            console.log(`Updated: ${domain} -> "${title}" (+${secondsToAdd}s)`);
        });
    });
}