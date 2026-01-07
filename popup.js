// popup.js
let activeMode = 'websites'; // 'websites' or 'types'
let activeRange = 'today';   // 'today', '7days', '30days'

document.addEventListener('DOMContentLoaded', () => {
    // Initialize Theme
    loadTheme();

    updateDisplay();
    // Only auto-refresh the display if we are looking at "Today"
    setInterval(() => {
        if (activeRange === 'today' && !document.getElementById('main-view').classList.contains('hidden')) {
            updateDisplay();
        }
    }, 1000);

    // Reset Button (Manual Clear for Today)
    document.getElementById('reset-btn').addEventListener('click', () => {
        if (confirm("Clear today's data?")) {
            const today = new Date().toISOString().split('T')[0];
            chrome.storage.local.remove(today, () => updateDisplay());
        }
    });

    // View Switching
    document.getElementById('analytics-btn').addEventListener('click', () => {
        document.getElementById('main-view').classList.add('hidden');
        document.getElementById('analytics-view').classList.remove('hidden');
        loadChart();
    });

    document.getElementById('back-btn').addEventListener('click', () => {
        document.getElementById('analytics-view').classList.add('hidden');
        document.getElementById('main-view').classList.remove('hidden');
    });

    // Toggle Controls
    const btnWeb = document.getElementById('toggle-websites');
    const btnType = document.getElementById('toggle-types');
    const rangeSelect = document.getElementById('range-selector');

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

    rangeSelect.addEventListener('change', (e) => {
        activeRange = e.target.value;
        loadChart();
    });

    // Theme Toggle Listener
    document.getElementById('theme-toggle').addEventListener('click', toggleTheme);
});

// --- THEME HANDLING ---
function loadTheme() {
    chrome.storage.local.get(['theme'], (result) => {
        const theme = result.theme || 'light';
        applyTheme(theme);
    });
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    applyTheme(newTheme);
    chrome.storage.local.set({ theme: newTheme });
}

function applyTheme(theme) {
    if (theme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
        document.querySelector('.icon.moon').style.display = 'none';
        document.querySelector('.icon.sun').style.display = 'block';
    } else {
        document.documentElement.removeAttribute('data-theme');
        document.querySelector('.icon.moon').style.display = 'block';
        document.querySelector('.icon.sun').style.display = 'none';
    }
}

// --- DATE HELPER ---
function getLastDays(days) {
    const dates = [];
    for (let i = 0; i < days; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        dates.push(d.toISOString().split('T')[0]);
    }
    return dates;
}

// --- MAIN TIMER VIEW (Today Only) ---
function updateDisplay() {
    const today = new Date().toISOString().split('T')[0];
    const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const dateEl = document.getElementById('date-display');
    if (dateEl) dateEl.textContent = new Date().toLocaleDateString(undefined, dateOptions);

    chrome.storage.local.get([today], (result) => {
        let data = result[today] || { total: 0, domains: {}, categories: {} };
        if (typeof data === 'number') data = { total: data, domains: {}, categories: {} };

        document.getElementById('time-display').textContent = formatTime(data.total);

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

    if (!data.domains || Object.keys(data.domains).length === 0) {
        listContainer.innerHTML = '<div class="empty-state">No videos watched yet</div>';
        return;
    }

    const sortedDomains = Object.entries(data.domains).sort(([, a], [, b]) => b.total - a.total);

    let html = '';
    sortedDomains.forEach(([domain, domainData]) => {
        const totalSeconds = domainData.total || 0;
        const videosMap = domainData.videos || {};
        const isOpen = currentlyOpenDomains.has(domain) ? 'open' : '';

        const sortedVideos = Object.entries(videosMap).sort(([, a], [, b]) => b - a);
        let videoHtml = '';
        sortedVideos.forEach(([title, time]) => {
            const meta = domainData.meta && domainData.meta[title];
            const category = meta ? meta.category : '';
            const badge = category && category !== 'Long Form' ? `<span class="video-badge">${category}</span>` : '';

            videoHtml += `<div class="video-item"><div class="video-info"><span class="video-title" title="${title}">${title}</span>${badge}</div><span>${formatTime(time)}</span></div>`;
        });

        html += `<details ${isOpen}><summary><span>${domain}</span><span class="domain-time">${formatTime(totalSeconds)}</span></summary><div class="video-list">${videoHtml}</div></details>`;
    });

    if (listContainer.innerHTML !== html) listContainer.innerHTML = html;
}

// --- ANALYTICS (Aggregation) ---
function loadChart() {
    let keysToFetch = [];
    if (activeRange === 'today') keysToFetch = [new Date().toISOString().split('T')[0]];
    else if (activeRange === '7days') keysToFetch = getLastDays(7);
    else if (activeRange === '30days') keysToFetch = getLastDays(30);

    chrome.storage.local.get(keysToFetch, (result) => {
        const aggregated = { total: 0, domains: {}, categories: {} };

        Object.values(result).forEach(dayData => {
            if (!dayData) return;
            if (typeof dayData === 'number') dayData = { total: dayData, domains: {}, categories: {} };

            aggregated.total += (dayData.total || 0);

            if (dayData.categories) {
                for (const [cat, time] of Object.entries(dayData.categories)) {
                    aggregated.categories[cat] = (aggregated.categories[cat] || 0) + time;
                }
            }

            if (dayData.domains) {
                for (const [domain, dData] of Object.entries(dayData.domains)) {
                    if (!aggregated.domains[domain]) aggregated.domains[domain] = { total: 0, videos: {} };
                    aggregated.domains[domain].total += (dData.total || dData);
                }
            }
        });

        if (aggregated.total === 0) {
            const ctx = document.getElementById('usageChart').getContext('2d');
            ctx.clearRect(0, 0, 220, 220); // Width/Height match canvas in HTML
            document.getElementById('legend').innerHTML = "<div class='empty-state'>No data for this period</div>";
            return;
        }

        if (activeMode === 'websites') drawPieChart(aggregated.domains, aggregated.total, false);
        else drawPieChart(aggregated.categories, aggregated.total, true);
    });
}

// --- CHART INTERACTIVITY ---
let cachedBars = [];
let hoverBarIndex = -1;
let currentDataMap = null;
let currentTotalTime = 0;
let currentIsCategoryMode = false;

function drawPieChart(dataMap, totalTime, isCategoryMode) {
    // Note: Function name kept for compatibility with existing calls, but implementation is now Bar Chart
    currentDataMap = dataMap;
    currentTotalTime = totalTime;
    currentIsCategoryMode = isCategoryMode;

    hoverBarIndex = -1; // Reset hover
    renderChart(-1);
}

function renderChart(hoverIndex) {
    const canvas = document.getElementById('usageChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // Clear Canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const sortedData = Object.entries(currentDataMap).sort(([, a], [, b]) => {
        const valA = (typeof a === 'number') ? a : a.total || a;
        const valB = (typeof b === 'number') ? b : b.total || b;
        return valB - valA;
    });

    // Limit to top 7 items to prevent overcrowding
    const displayData = sortedData.slice(0, 7);

    // Palette
    const palette = ['#A78BFA', '#F472B6', '#34D399', '#60A5FA', '#FBBF24', '#F87171', '#818CF8', '#2DD4BF', '#FB923C'];
    const catColors = {
        'YouTube Shorts': '#F87171',
        'Reels': '#E1306C',
        'TikTok': '#000000',
        'Short Video': '#F472B6',
        'Long Form': '#34D399',
        'Live Stream': '#FBBF24',
        'Shorts/Reels': '#F472B6'
    };

    const themeBg = document.documentElement.getAttribute('data-theme') === 'dark' ? '#0f172a' : '#ffffff';

    // Update legend only on initial full draw
    if (hoverIndex === -1) document.getElementById('legend').innerHTML = '';

    cachedBars = [];

    if (displayData.length === 0) return;

    const maxVal = Math.max(...displayData.map(([, v]) => (typeof v === 'number' ? v : v.total)));
    const chartHeight = canvas.height - 20; // Reserve bottom space
    const chartWidth = canvas.width;

    // Slimmer Bars Logic
    // We strive for slimmer bars (max 16px) and center them
    let barWidth = 16;
    let barSpacing = 12;

    // Check if we need to shrink spacing/width for many items (though 7 items fits easily)
    // 7 items * 16px = 112px. Spacing = 12 * 6 = 72. Total = 184. Fits in 220.

    const totalContentWidth = (barWidth * displayData.length) + (barSpacing * (displayData.length - 1));
    let currentX = (chartWidth - totalContentWidth) / 2; // Center alignment

    displayData.forEach(([label, valueData], index) => {
        const val = (typeof valueData === 'number') ? valueData : valueData.total;

        // Calculate Height relative to max
        const barHeight = (val / maxVal) * chartHeight;
        const x = currentX;
        const y = canvas.height - barHeight; // Draw from bottom up

        let color = currentIsCategoryMode ? (catColors[label] || palette[index % palette.length]) : palette[index % palette.length];

        // --- ANIMATION/HOVER STATE ---
        const isHovered = (index === hoverIndex);

        // Dimming Effect
        if (hoverIndex !== -1 && !isHovered) {
            ctx.globalAlpha = 0.3;
        } else {
            ctx.globalAlpha = 1.0;
        }

        // Glitch/Grow Effect
        const drawHeight = isHovered ? barHeight + 5 : barHeight; // Grow Up
        const drawY = canvas.height - drawHeight;
        const drawX = isHovered ? x - 1 : x; // Expand width slightly
        const drawW = isHovered ? barWidth + 2 : barWidth;

        ctx.fillStyle = color;

        if (isHovered) {
            ctx.shadowColor = color;
            ctx.shadowBlur = 20;
            ctx.fillStyle = adjustBrightness(color, 40);
        } else {
            ctx.shadowBlur = 0;
        }

        // Draw Bar
        ctx.beginPath();
        // Rounded top corners
        ctx.roundRect(drawX, drawY, drawW, drawHeight, [4, 4, 0, 0]);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Cache for Hit Detection
        cachedBars.push({
            index: index,
            x: x,
            y: canvas.height - barHeight, // Original top
            width: barWidth,
            height: barHeight,
            label: label,
            val: val,
            color: color
        });

        // Add to Legend (Only once)
        if (hoverIndex === -1) {
            const percentage = ((val / currentTotalTime) * 100).toFixed(1);
            const legendItem = document.createElement('div');
            legendItem.className = 'legend-item';
            legendItem.innerHTML = `<div class="color-dot" style="background-color: ${color}"></div><div class="legend-text"><span>${label}</span><span style="font-weight:bold">${percentage}%</span></div>`;
            document.getElementById('legend').appendChild(legendItem);
        }

        currentX += barWidth + barSpacing;
    });

    ctx.globalAlpha = 1.0;
}

// Interaction Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    // ... existing init code ...
    const canvas = document.getElementById('usageChart');
    const tooltip = document.getElementById('chart-tooltip');

    canvas.addEventListener('mousemove', (e) => {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        // const scaleY = canvas.height / rect.height; // Not strictly needed for X-check

        const mouseX = (e.clientX - rect.left) * scaleX;
        const mouseY = (e.clientY - rect.top) * (canvas.height / rect.height);

        // Hit Detection (Rectangular)
        let foundIndex = -1;

        for (const bar of cachedBars) {
            // Check X bounds (main criteria) and loose Y bounds
            if (mouseX >= bar.x && mouseX <= bar.x + bar.width) {
                // Check if mouse is somewhat near the bar vertically (optional, but good for UX)
                if (mouseY >= bar.y - 20) { // -20 buffer above bar
                    foundIndex = bar.index;
                    break;
                }
            }
        }

        if (foundIndex !== hoverBarIndex) {
            hoverBarIndex = foundIndex;
            renderChart(hoverBarIndex);

            // Update Tooltip
            if (foundIndex !== -1) {
                const bar = cachedBars[foundIndex];
                tooltip.innerHTML = `<div style="text-align:center;">
                    <span style="font-weight:700; font-size:13px; color:${bar.color}">${bar.label}</span>
                </div>`;
                tooltip.classList.remove('hidden');
            } else {
                tooltip.classList.add('hidden');
            }
        }

        // Move Tooltip
        if (!tooltip.classList.contains('hidden')) {
            tooltip.style.left = (e.clientX - rect.left) + 'px';
            // Position tooltip consistently above the mouse or bar? Mouse is easier.
            tooltip.style.top = (e.clientY - rect.top - 20) + 'px';
        }
    });

    canvas.addEventListener('mouseleave', () => {
        hoverBarIndex = -1;
        renderChart(-1);
        tooltip.classList.add('hidden');
    });
});

// Helper for hover brightness
function adjustBrightness(col, amt) {
    let usePound = false;
    if (col[0] == "#") {
        col = col.slice(1);
        usePound = true;
    }
    let num = parseInt(col, 16);
    let r = (num >> 16) + amt;
    if (r > 255) r = 255; else if (r < 0) r = 0;
    let b = ((num >> 8) & 0x00FF) + amt;
    if (b > 255) b = 255; else if (b < 0) b = 0;
    let g = (num & 0x0000FF) + amt;
    if (g > 255) g = 255; else if (g < 0) g = 0;
    return (usePound ? "#" : "") + (g | (b << 8) | (r << 16)).toString(16);
}

function formatTime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}