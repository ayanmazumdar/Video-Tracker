// background.js
let updateQueue = Promise.resolve(); // Queue to prevent race conditions

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "logTime") {
        // Chain the request to the end of the queue
        updateQueue = updateQueue.then(() => {
            return updateTimeSafe(request.seconds, request.domain, request.title, request.category);
        });
        sendResponse({ status: "queued" });
    }
    return true;
});

function updateTimeSafe(secondsToAdd, domain, title, category) {
    return new Promise((resolve) => {
        const today = new Date().toISOString().split('T')[0];

        chrome.storage.local.get([today], (result) => {
            let data = result[today] || { total: 0, domains: {}, categories: {} };

            // Legacy data support
            if (typeof data === 'number') data = { total: data, domains: {}, categories: {} };
            if (!data.categories) data.categories = {};

            // 1. Update Global Total
            // We directly add the accumulated seconds from the content script.
            data.total += secondsToAdd;

            // 2. Update Category Stats (Always increment)
            if (!data.categories[category]) data.categories[category] = 0;
            data.categories[category] += secondsToAdd;

            // 3. Update Domain & Videos (Always increment)
            if (!data.domains[domain]) data.domains[domain] = { total: 0, videos: {} };
            if (typeof data.domains[domain] === 'number') data.domains[domain] = { total: data.domains[domain], videos: {} };

            data.domains[domain].total += secondsToAdd;

            const safeTitle = title || "Unknown Video";
            if (!data.domains[domain].videos[safeTitle]) data.domains[domain].videos[safeTitle] = 0;
            data.domains[domain].videos[safeTitle] += secondsToAdd;

            // Save Metadata (Category) - Store "Clean" category for the List UI
            // but we kept the full 'category' for the Global Stats/Chart above.
            const cleanCategory = category.replace(' (Background)', '');
            if (!data.domains[domain].meta) data.domains[domain].meta = {};
            data.domains[domain].meta[safeTitle] = { category: cleanCategory };

            // 4. Save and Resolve
            let storageUpdate = {};
            storageUpdate[today] = data;
            chrome.storage.local.set(storageUpdate, () => {
                resolve();
            });
        });
    });
}