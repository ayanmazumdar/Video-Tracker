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
    }, 5000);

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

    // Refresh chart if visible to update axis/grid colors
    if (!document.getElementById('analytics-view').classList.contains('hidden')) {
        renderChart(-1);
    }
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

        if (activeMode === 'websites') drawChart(aggregated.domains, aggregated.total, false);
        else drawChart(aggregated.categories, aggregated.total, true);
    });
}

// --- CHART INTERACTIVITY ---
let cachedBars = [];
let hoverBarIndex = -1;
let currentDataMap = null;
let currentTotalTime = 0;
let currentIsCategoryMode = false;

function drawChart(dataMap, totalTime, isCategoryMode) {
    currentDataMap = dataMap;
    currentTotalTime = totalTime;
    currentIsCategoryMode = isCategoryMode;

    hoverBarIndex = -1; // Reset hover
    renderChart(-1);
}

const PALETTE = ['#A78BFA', '#F472B6', '#34D399', '#60A5FA', '#FBBF24', '#F87171', '#818CF8', '#2DD4BF', '#FB923C'];
const CATEGORY_COLORS = {
    'YouTube Shorts': '#F87171',
    'Reels': '#E1306C',
    'TikTok': '#000000',
    'Short Video': '#F472B6',
    'Long Form': '#34D399',
    'Live Stream': '#FBBF24',
    'Shorts/Reels': '#F472B6'
};

function renderChart(hoverIndex) {
    const canvas = document.getElementById('usageChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // Layout Constants
    const marginLeft = 35;
    const marginBottom = 20;
    const marginTop = 10;
    const marginRight = 10;
    const graphW = canvas.width - marginLeft - marginRight;
    const graphH = canvas.height - marginBottom - marginTop;
    const graphX = marginLeft;
    const graphY = marginTop;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Prepare Data
    const sortedData = Object.entries(currentDataMap).sort(([, a], [, b]) => {
        const valA = (typeof a === 'number') ? a : a.total || a;
        const valB = (typeof b === 'number') ? b : b.total || b;
        return valB - valA;
    });
    const displayData = sortedData.slice(0, 7);

    // Calculate Scale
    let yMax = calculateYMax(displayData);

    // Draw Components
    drawGrid(ctx, graphX, graphY, graphW, graphH, yMax);
    drawBars(ctx, displayData, graphX, graphY, graphH, graphW, yMax, hoverIndex);

    // Update Legend (only on fresh render, not hover)
    if (hoverIndex === -1) updateLegend(displayData);
}

function calculateYMax(displayData) {
    let yMax;
    if (activeRange === 'today') {
        const totalSeconds = currentTotalTime;
        if (totalSeconds < 3600) yMax = 3600;
        else if (totalSeconds < 18000) yMax = 18000;
        else yMax = 36000;
    } else if (activeRange === '7days') {
        yMax = 70 * 3600;
    } else {
        yMax = 300 * 3600;
    }

    const dataMax = displayData.length > 0
        ? Math.max(...displayData.map(([, v]) => (typeof v === 'number' ? v : v.total)))
        : 0;
    return Math.max(yMax, dataMax);
}

function drawGrid(ctx, x, y, w, h, yMax) {
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 4]);

    const themeParams = {
        gridColor: 'rgba(150, 150, 150, 0.2)',
        textColor: document.documentElement.getAttribute('data-theme') === 'dark' ? '#94a3b8' : '#6b7280'
    };

    ctx.strokeStyle = themeParams.gridColor;
    ctx.fillStyle = themeParams.textColor;
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    // Vertical Lines
    for (let i = 0; i <= 5; i++) {
        const lineX = x + (w / 5) * i;
        ctx.beginPath();
        ctx.moveTo(lineX, y);
        ctx.lineTo(lineX, y + h);
        ctx.stroke();
    }

    // Horizontal Lines & Labels
    const steps = 5;
    for (let i = 0; i <= steps; i++) {
        const ratio = i / steps;
        const lineY = y + h - (h * ratio);

        ctx.beginPath();
        ctx.moveTo(x, lineY);
        ctx.lineTo(x + w, lineY);
        ctx.stroke();

        const valSeconds = yMax * ratio;
        ctx.fillText(formatAxisTime(valSeconds), x - 6, lineY);
    }
    ctx.setLineDash([]);
}

function drawBars(ctx, displayData, graphX, graphY, graphH, graphW, yMax, hoverIndex) {
    if (displayData.length === 0) return;

    cachedBars = [];
    const barWidth = 12;
    const barSpacing = 8;
    const totalContentWidth = (barWidth * displayData.length) + (barSpacing * (displayData.length - 1));
    let currentX = graphX + (graphW - totalContentWidth) / 2;

    displayData.forEach(([label, valueData], index) => {
        const val = (typeof valueData === 'number') ? valueData : valueData.total;
        const barHeight = (val / yMax) * graphH;
        const x = currentX;
        const y = graphY + graphH - barHeight;

        let color = currentIsCategoryMode
            ? (CATEGORY_COLORS[label] || PALETTE[index % PALETTE.length])
            : PALETTE[index % PALETTE.length];

        const isHovered = (index === hoverIndex);

        // Dimming
        ctx.globalAlpha = (hoverIndex !== -1 && !isHovered) ? 0.3 : 1.0;

        // Hover Effect
        const drawHeight = isHovered ? barHeight + 4 : barHeight;
        const drawY = graphY + graphH - drawHeight;
        const drawX = isHovered ? x - 1 : x;
        const drawW = isHovered ? barWidth + 2 : barWidth;

        ctx.fillStyle = color;
        ctx.shadowColor = isHovered ? color : 'transparent';
        ctx.shadowBlur = isHovered ? 10 : 0;

        ctx.beginPath();
        ctx.roundRect(drawX, drawY, drawW, drawHeight, [3, 3, 0, 0]);
        ctx.fill();

        cachedBars.push({
            index, x, y, width: barWidth, height: barHeight, label, color
        });

        currentX += barWidth + barSpacing;
    });

    ctx.globalAlpha = 1.0;
    ctx.shadowBlur = 0;
}

function updateLegend(displayData) {
    const legend = document.getElementById('legend');
    legend.innerHTML = '';

    displayData.forEach(([label, valueData], index) => {
        const val = (typeof valueData === 'number') ? valueData : valueData.total;
        const color = currentIsCategoryMode
            ? (CATEGORY_COLORS[label] || PALETTE[index % PALETTE.length])
            : PALETTE[index % PALETTE.length];

        const percentage = currentTotalTime > 0 ? ((val / currentTotalTime) * 100).toFixed(1) : 0;

        const item = document.createElement('div');
        item.className = 'legend-item';
        item.innerHTML = `<div class="color-dot" style="background-color: ${color}"></div>
                         <div class="legend-text">
                             <span>${label}</span>
                             <span style="font-weight:bold">${percentage}%</span>
                         </div>`;
        legend.appendChild(item);
    });
}

function formatAxisTime(seconds) {
    if (seconds === 0) return '0';
    const h = seconds / 3600;
    if (h >= 1) {
        // Show decimal formatting if needed, e.g. 1.5h, but mostly integer is cleaner if grid lines align
        return Math.abs(h % 1) < 0.1 ? `${Math.floor(h)}h` : `${h.toFixed(1)}h`;
    }
    const m = Math.floor(seconds / 60);
    return `${m}m`;
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


function formatTime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}