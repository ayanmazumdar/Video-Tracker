// popup.js
document.addEventListener('DOMContentLoaded', () => {
    updateDisplay();
    setInterval(updateDisplay, 1000);
});

function updateDisplay() {
    const today = new Date().toISOString().split('T')[0];
    
    const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    document.getElementById('date-display').textContent = new Date().toLocaleDateString(undefined, dateOptions);

    chrome.storage.local.get([today], (result) => {
        // Handle undefined or empty data
        let data = result[today] || { total: 0, domains: {} };
        
        // Migration check just in case (same as background.js)
        if (typeof data === 'number') {
            data = { total: data, domains: {} };
        }

        // 1. Update Total Time
        document.getElementById('time-display').textContent = formatTime(data.total);

        // 2. Update Breakdown List
        const listContainer = document.getElementById('breakdown-container');
        
        // Sort domains by time (highest first)
        const sortedDomains = Object.entries(data.domains)
            .sort(([, a], [, b]) => b - a);

        if (sortedDomains.length === 0) {
            listContainer.innerHTML = '<div style="text-align:center; color:#999;">No data yet today</div>';
        } else {
            let html = '';
            sortedDomains.forEach(([domain, seconds]) => {
                html += `
                    <div class="domain-row">
                        <span class="domain-name">${domain}</span>
                        <span class="domain-time">${formatTime(seconds)}</span>
                    </div>
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