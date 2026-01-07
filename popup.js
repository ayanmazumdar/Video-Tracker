// popup.js
let activeMode = 'websites'; // State for chart toggle ('websites' or 'types')

document.addEventListener('DOMContentLoaded', () => {
    updateDisplay();
    setInterval(updateDisplay, 1000);

    // Navigation & Reset
    document.getElementById('reset-btn').addEventListener('click', () => {
        if(confirm("Clear today's data?")) chrome.storage.local.clear(() => updateDisplay());
    });

    document.getElementById('analytics-btn').addEventListener('click', () => {
        document.getElementById('main-view').classList.add('hidden');
        document.getElementById('analytics-view').classList.remove('hidden');
        loadChart(); 
    });

    document.getElementById('back-btn').addEventListener('click', () => {
        document.getElementById('analytics-view').classList.add('hidden');
        document.getElementById('main-view').classList.remove('hidden');
    });

    // Chart Toggles
    const btnWeb = document.getElementById('toggle-websites');
    const btnType = document.getElementById('toggle-types');

    btnWeb.addEventListener('click', () => {
        activeMode = 'websites';
        btnWeb.classList.add('active');
        btnType.classList.remove('active');
        loadChart();
    });

    btnType.addEventListener('click', () => {
        activeMode = 'types';
        btnType.classList.add('active');
        btnWeb.classList.remove('active');
        loadChart();
    });
});

function updateDisplay() {
    const today = new Date().toISOString().split('T')[0];
    const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const dateEl = document.getElementById('date-display');
    if(dateEl) dateEl.textContent = new Date().toLocaleDateString(undefined, dateOptions);

    chrome.storage.local.get([today], (result) => {
        let data = result[today] || { total: 0, domains: {}, categories: {} };
        if (typeof data === 'number') data = { total: data, domains: {}, categories: {} };

        // Update Total
        document.getElementById('time-display').textContent = formatTime(data.total);

        // Update List (Only if main view is visible)
        if (!document.getElementById('main-view').classList.contains('hidden')) {
            updateList(data);
        }
    });
}

function updateList(data) {
    const listContainer = document.getElementById('breakdown-container');
    const currentlyOpenDomains = new Set();
    listContainer.querySelectorAll('details[open]').forEach(detail => {
        currentlyOpenDomains.add(detail.querySelector('summary span').textContent);
    });

    const sortedDomains = Object.entries(data.domains).sort(([, a], [, b]) => b.total - a.total);

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
            videoHtml += `<div class="video-item"><span class="video-title" title="${title}">${title}</span><span>${formatTime(time)}</span></div>`;
        });
        if (videoHtml === '') videoHtml = '<div class="video-item">No detailed titles</div>';

        html += `<details ${isOpen}><summary><span>${domain}</span><span>${formatTime(totalSeconds)}</span></summary><div class="video-list">${videoHtml}</div></details>`;
    });

    if (listContainer.innerHTML !== html) listContainer.innerHTML = html;
}

function loadChart() {
    const today = new Date().toISOString().split('T')[0];
    chrome.storage.local.get([today], (result) => {
        let data = result[today] || { total: 0, domains: {}, categories: {} };
        if (typeof data === 'number') data = { total: data, domains: {}, categories: {} };

        if (data.total === 0) {
            const ctx = document.getElementById('usageChart').getContext('2d');
            ctx.clearRect(0, 0, 280, 280);
            document.getElementById('legend').innerHTML = "<div style='text-align:center; color:#999'>No data recorded today</div>";
            return;
        }

        // DECIDE WHICH DATA TO DRAW
        if (activeMode === 'websites') {
            drawPieChart(data.domains, data.total, false); // false = not categories
        } else {
            drawPieChart(data.categories, data.total, true); // true = use fixed category colors
        }
    });
}

function drawPieChart(dataMap, totalTime, isCategoryMode) {
    const canvas = document.getElementById('usageChart');
    const ctx = canvas.getContext('2d');
    const legendContainer = document.getElementById('legend');
    legendContainer.innerHTML = ''; 
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const sortedData = Object.entries(dataMap).sort(([, a], [, b]) => {
        const valA = (typeof a === 'number') ? a : a.total || a;
        const valB = (typeof b === 'number') ? b : b.total || b;
        return valB - valA;
    });

    // Colors
    const palette = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#6366f1', '#14b8a6', '#f97316'];
    const catColors = {
        'Shorts/Reels': '#ef4444', // Red
        'Long Form': '#10b981',     // Green
        'Live Stream': '#f59e0b'    // Amber
    };

    let startAngle = 0;
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = 100;

    sortedData.forEach(([label, valueData], index) => {
        const val = (typeof valueData === 'number') ? valueData : valueData.total;
        if(val === 0) return;

        const sliceAngle = (val / totalTime) * 2 * Math.PI;
        
        // Pick color: Fixed map if category mode, otherwise palette
        const color = isCategoryMode 
            ? (catColors[label] || '#64748b') 
            : palette[index % palette.length];

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

        // Legend
        const percentage = ((val / totalTime) * 100).toFixed(1);
        const legendItem = document.createElement('div');
        legendItem.className = 'legend-item';
        legendItem.innerHTML = `
            <div class="color-box" style="background-color: ${color}"></div>
            <div class="legend-text"><span>${label}</span><span style="font-weight:bold">${percentage}%</span></div>
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