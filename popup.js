document.addEventListener('DOMContentLoaded', () => {
    updateDisplay();
    
    // Update the display every second while the popup is open
    // to give a real-time feel if a video is playing in the background
    setInterval(updateDisplay, 1000);
});

function updateDisplay() {
    const today = new Date().toISOString().split('T')[0];
    
    // Set formatted date
    const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    document.getElementById('date-display').textContent = new Date().toLocaleDateString(undefined, dateOptions);

    chrome.storage.local.get([today], (result) => {
        const totalSeconds = result[today] || 0;
        document.getElementById('time-display').textContent = formatTime(totalSeconds);
    });
}

function formatTime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;

    const pad = (num) => num.toString().padStart(2, '0');
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
}