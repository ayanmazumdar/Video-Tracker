// background.js
// Handles storage and state management

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "logTime") {
        updateTime(request.seconds);
        // Send a response to keep the message channel open if needed, 
        // and to avoid "message port closed" errors in content script
        sendResponse({status: "success"}); 
    }
    return true; // Indicates we wish to send a response asynchronously
});

function updateTime(secondsToAdd) {
    const today = new Date().toISOString().split('T')[0]; // Format: YYYY-MM-DD

    chrome.storage.local.get([today], (result) => {
        let currentSeconds = result[today] || 0;
        let newTotal = currentSeconds + secondsToAdd;

        let data = {};
        data[today] = newTotal;

        chrome.storage.local.set(data, () => {
            console.log(`Updated time for ${today}: ${newTotal}s`);
        });
    });
}