// popup.js
document.addEventListener('DOMContentLoaded', () => {
    updateDisplay();
    // Real-time update for the main timer
    setInterval(updateDisplay, 1000);

    // --- BUTTON LISTENERS ---

    // 1. Reset
    document.getElementById('reset-btn').addEventListener('click', () => {
        if(confirm("Are you sure you want to clear today's data?")) {
            chrome.storage.local.clear(() => {
                updateDisplay();
            });
        }
    });

    // 2. Go to Analytics
    document.getElementById('analytics-btn').addEventListener('click', () => {
        document.getElementById('main-view').classList.add('hidden');
        document.getElementById('analytics-view').classList.remove('hidden');
        loadChart(); // Draw chart only when requested
    });

    // 3. Go Back to Main
    document.getElementById('back-btn').addEventListener('click', () => {
        document.getElementById('analytics-view').classList.add('hidden');
        document.getElementById('main-view').classList.remove('hidden');
    });
});

// --- MAIN VIEW LOGIC ---

function updateDisplay() {
    const today = new Date().toISOString().split('T')[0];
    const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const dateEl = document.getElementById('date-display');
    if(dateEl) dateEl.textContent = new Date().toLocaleDateString(undefined, dateOptions);

    chrome.storage.local.get([today], (result) => {
        let data = result[today] || { total: 0, domains: {} };
        if (typeof data === 'number') data = { total: data, domains: {} };

        // Update Total
        document.getElementById('time-display').textContent = formatTime(data.total);

        // Update List (Only if we are actually looking at the main view)
        const mainView = document.getElementById('main-view');
        if (!mainView.classList.contains('hidden')) {
            updateList(data);
        }
    });
}

function updateList(data) {
    const listContainer = document.getElementById('breakdown-container');
    
    // Capture open state
    const currentlyOpenDomains = new Set();
    listContainer.querySelectorAll('details[open]').forEach(detail => {
        const domainName = detail.querySelector('summary span').textContent;
        currentlyOpenDomains.add(domainName);
    });

    const sortedDomains = Object.entries(data.domains)
        .sort(([, a], [, b]) => b.total - a.total);

    if (sortedDomains.length === 0) {
        listContainer.innerHTML = '<div style="text-align:center; color:#999; padding:15px;">No videos watched yet</div>';
        return;
    }

    let html = '';
    sortedDomains.forEach(([domain, domainData]) => {
        const totalSeconds = (typeof domainData === 'number') ? domainData : domainData.total;
        const videosMap = (typeof domainData === 'object' && domainData.videos) ? domainData.videos : {};
        const isOpen = currentlyOpenDomains.has(domain) ? 'open' : '';

        const sortedVideos = Object.entries(videosMap).sort(([, a], [, b]) => b - a);

        let videoHtml = '';
        sortedVideos.forEach(([title, time]) => {
            videoHtml += `
                <div class="video-item">
                    <span class="video-title" title="${title}">${title}</span>
                    <span>${formatTime(time)}</span>
                </div>`;
        });
        if (videoHtml === '') videoHtml = '<div class="video-item">No detailed titles</div>';

        html += `
            <details ${isOpen}>
                <summary><span>${domain}</span><span>${formatTime(totalSeconds)}</span></summary>
                <div class="video-list">${videoHtml}</div>
            </details>`;
    });

    if (listContainer.innerHTML !== html) {
        listContainer.innerHTML = html;
    }
}

// --- ANALYTICS CHART LOGIC ---

function loadChart() {
    const today = new Date().toISOString().split('T')[0];
    
    chrome.storage.local.get([today], (result) => {
        let data = result[today] || { total: 0, domains: {} };
        if (typeof data === 'number') data = { total: data, domains: {} };

        if (data.total === 0) {
            // Clear canvas if no data
            const ctx = document.getElementById('usageChart').getContext('2d');
            ctx.clearRect(0, 0, 300, 300);
            document.getElementById('legend').innerHTML = "<div style='text-align:center; color:#999'>No data recorded today</div>";
            return;
        }

        drawPieChart(data.domains, data.total);
    });
}

function drawPieChart(domains, totalTime) {
    const canvas = document.getElementById('usageChart');
    const ctx = canvas.getContext('2d');
    const legendContainer = document.getElementById('legend');
    legendContainer.innerHTML = ''; // Clear previous legend
    
    // Clear previous chart
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const sortedDomains = Object.entries(domains)
        .sort(([, a], [, b]) => b.total - a.total);

    const colors = [
        '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', 
        '#ec4899', '#6366f1', '#14b8a6', '#f97316', '#64748b'
    ];

    let startAngle = 0;
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = 100; // Smaller radius for popup

    sortedDomains.forEach(([domain, domainData], index) => {
        const time = domainData.total;
        const sliceAngle = (time / totalTime) * 2 * Math.PI;
        const color = colors[index % colors.length];

        // Draw Slice
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, startAngle, startAngle + sliceAngle);
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();
        
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#fff';
        ctx.stroke();

        // Add Legend Item
        const percentage = ((time / totalTime) * 100).toFixed(1);
        const legendItem = document.createElement('div');
        legendItem.className = 'legend-item';
        legendItem.innerHTML = `
            <div class="color-box" style="background-color: ${color}"></div>
            <div class="legend-text">
                <span>${domain}</span>
                <span class="legend-percent">${percentage}%</span>
            </div>
        `;
        legendContainer.appendChild(legendItem);

        startAngle += sliceAngle;
    });
}

function formatTime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    const pad = (num) => num.toString().padStart(2, '0');
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
}