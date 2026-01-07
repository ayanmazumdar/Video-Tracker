// popup.js
document.addEventListener('DOMContentLoaded', () => {
    updateDisplay();
    setInterval(updateDisplay, 1000);

    // NEW: Reset Button Listener
    document.getElementById('reset-btn').addEventListener('click', () => {
        // Clear all data from local storage
        chrome.storage.local.clear(() => {
            console.log("Storage cleared.");
            // Immediately update the display to show 00:00:00
            updateDisplay();
        });
    });
});

function updateDisplay() {
    const today = new Date().toISOString().split('T')[0];
    
    const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    document.getElementById('date-display').textContent = new Date().toLocaleDateString(undefined, dateOptions);

    chrome.storage.local.get([today], (result) => {
        let data = result[today] || { total: 0, domains: {} };
        if (typeof data === 'number') data = { total: data, domains: {} };

        // 1. Update Total Time
        document.getElementById('time-display').textContent = formatTime(data.total);

        // 2. Update Breakdown List
        const listContainer = document.getElementById('breakdown-container');
        
        // Capture open state to prevent collapsing
        const currentlyOpenDomains = new Set();
        listContainer.querySelectorAll('details[open]').forEach(detail => {
            const domainName = detail.querySelector('summary span').textContent;
            currentlyOpenDomains.add(domainName);
        });

        const sortedDomains = Object.entries(data.domains)
            .sort(([, a], [, b]) => b.total - a.total);

        if (sortedDomains.length === 0) {
            listContainer.innerHTML = '<div style="text-align:center; color:#999; padding:10px;">No data yet today</div>';
        } else {
            let html = '';
            
            sortedDomains.forEach(([domain, domainData]) => {
                const totalSeconds = (typeof domainData === 'number') ? domainData : domainData.total;
                const videosMap = (typeof domainData === 'object' && domainData.videos) ? domainData.videos : {};

                const isOpen = currentlyOpenDomains.has(domain) ? 'open' : '';

                const sortedVideos = Object.entries(videosMap)
                    .sort(([, a], [, b]) => b - a);

                let videoHtml = '';
                sortedVideos.forEach(([title, time]) => {
                    videoHtml += `
                        <div class="video-item">
                            <span class="video-title" title="${title}">${title}</span>
                            <span>${formatTime(time)}</span>
                        </div>
                    `;
                });

                if (videoHtml === '') videoHtml = '<div class="video-item">No detailed titles captured</div>';

                html += `
                    <details ${isOpen}>
                        <summary>
                            <span>${domain}</span>
                            <span>${formatTime(totalSeconds)}</span>
                        </summary>
                        <div class="video-list">
                            ${videoHtml}
                        </div>
                    </details>
                `;
            });
            
            listContainer.innerHTML = html;
        }
    });
}

function formatTime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    const pad = (num) => num.toString().padStart(2, '0');
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
}