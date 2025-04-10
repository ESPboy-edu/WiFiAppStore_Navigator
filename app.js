// Configuration
const API_URL = 'https://script.google.com/macros/s/AKfycbwKMaHpDg_a52oSNdlbO9q1XEDlFMRVbFdKrarnp0HyHoCAGak/exec';
const CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours
const BASE_DOWNLOAD_URL = "https://drive.google.com/file/d/";

// Application state
let menuHistory = [];

// UI Elements
const elements = {
    menuContainer: document.getElementById('menu-container'),
    loading: document.getElementById('loading'),
    gameDetailsContainer: document.getElementById('game-details-container'),
    refreshBtn: document.getElementById('force-refresh'),
    backButton: document.getElementById('back-button'),
    backButtonContainer: document.getElementById('back-button-container')
};

// Decode date from numeric format (day + (month+1)*32 + year*500)
function decodeDate(encodedDate) {
    if (!encodedDate || isNaN(encodedDate)) return "invalid date";
    
    const num = parseInt(encodedDate, 10);
    if (num <= 0) return "invalid date";
    
    const year = Math.floor(num / 500);
    const monthDay = num % 500;
    
    // Защита от некорректных значений
    if (monthDay <= 0 || monthDay >= 500) return "invalid date";
    
    const month = Math.floor(monthDay / 32) - 1;
    const day = monthDay % 32;
    
    // Валидация полученных значений
    if (month < 0 || month > 11 || day <= 0 || day > 31) {
        return "invalid date";
    }
    
    // Форматирование с ведущими нулями
    const pad = n => String(n).padStart(2, '0');
    return `${pad(day)}.${pad(month+1)}.${year}`;
}

// Fetch data with caching
async function fetchMenuData(params = {}) {
    const cacheKey = `${params.cmd}_${params.dat || '0'}`;
    const cachedData = getCachedData(cacheKey);
    
    if (cachedData && !shouldInvalidateCache(cacheKey)) {
        console.log('Using cached data for', cacheKey);
        return cachedData;
    }

    try {
        elements.loading.textContent = 'Loading data...';
        const url = new URL(API_URL);
        Object.entries(params).forEach(([key, value]) => {
            url.searchParams.append(key, value);
        });

        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const data = await response.text();
        cacheData(cacheKey, data);
        return data;
    } catch (error) {
        console.error('Loading error:', error);
        return cachedData || (params.cmd === '4' ? "1;2;3;4;5;6;7;8;9" : "0;0;");
    }
}

// Caching functions
function cacheData(key, data) {
    const cache = {
        data,
        timestamp: Date.now()
    };
    localStorage.setItem(`menuCache_${key}`, JSON.stringify(cache));
}

function getCachedData(key) {
    const cached = localStorage.getItem(`menuCache_${key}`);
    return cached ? JSON.parse(cached).data : null;
}

function shouldInvalidateCache(key) {
    const cached = localStorage.getItem(`menuCache_${key}`);
    if (!cached) return true;
    
    const { timestamp } = JSON.parse(cached);
    return (Date.now() - timestamp) > CACHE_EXPIRY_MS;
}

// Load and display menu
async function loadAndShowMenu(params = {}, isBackNavigation = false) {
    elements.loading.style.display = 'block';
    elements.menuContainer.innerHTML = '';
    elements.gameDetailsContainer.innerHTML = '';
    
    const data = await fetchMenuData(params);
    
    if (params.cmd === '4') {
        renderGameDetails(parseGameData(data));
    } else {
        renderMenu(parseMenuData(data, params.cmd), params);
    }
    
    if (!isBackNavigation) {
        menuHistory.push(params);
    }
    
    updateBackButton();
}

// Parse menu data for levels 1-3
function parseMenuData(dataString, cmdLevel) {
    const parts = dataString.split(';');
    if (parts.length < 3) return [];
    
    const menuItems = [];
    const itemCount = parseInt(parts[1], 10);
    
    if (cmdLevel === '3') {
        // Format: 1;count;item1;date1;access1;likes1;item2;date2;access2;likes2;...
        for (let i = 2; i < 2 + itemCount * 4 && i < parts.length; i += 4) {
            const name = parts[i]?.trim();
            const dateStr = parts[i+1]?.trim();
            const access = parts[i+2]?.trim();
            const likes = parts[i+3]?.trim();
            
            if (name) {
                menuItems.push({
                    name,
                    date: decodeDate(dateStr),
                    access,
                    likes
                });
            }
        }
    } else {
        // Format: 0;count;item1;date1;item2;date2;...
        for (let i = 2; i < 2 + itemCount * 2 && i < parts.length; i += 2) {
            const name = parts[i]?.trim();
            const dateStr = parts[i+1]?.trim();
            
            if (name) {
                menuItems.push({
                    name,
                    date: decodeDate(dateStr)
                });
            }
        }
    }
    
    return menuItems;
}

// Parse game data for level 4
function parseGameData(dataString) {
    const parts = dataString.split(';');
    if (parts.length < 9) return null;
    
    const fileId = parts[5]?.trim();
    
    return {
        filename: parts[1],
        author: parts[2],
        license: parts[3],
        description: parts[4],
        downloadPath: `${BASE_DOWNLOAD_URL}${fileId}`,
        accessLevel: parts[6],
        likes: parts[7],
        downloads: parts[8]
    };
}

// Render menu for levels 1-3
function renderMenu(menuItems, currentParams) {
    elements.loading.style.display = 'none';
    
    if (menuItems.length === 0) {
        elements.menuContainer.innerHTML = '<div class="menu-item">No data available</div>';
        return;
    }
    
    menuItems.forEach(item => {
        const itemElement = document.createElement('div');
        itemElement.className = 'menu-item';
        
        if (currentParams.cmd === '3') {
            itemElement.innerHTML = `
                <div class="menu-item-content">
                    <span class="menu-item-name">${item.name}</span>
                    <span class="menu-item-info"> | Updated: ${item.date} | Access: ${item.access} | Likes: ${item.likes}</span>
                </div>
            `;
        } else {
            itemElement.innerHTML = `
                <div class="menu-item-content">
                    <span class="menu-item-name">${item.name}</span>
                    <span class="menu-item-info"> | Updated: ${item.date}</span>
                </div>
            `;
        }
        
        itemElement.addEventListener('click', () => {
            const nextLevel = String(parseInt(currentParams.cmd, 10) + 1);
            loadAndShowMenu({ cmd: nextLevel, dat: item.name });
        });
        
        elements.menuContainer.appendChild(itemElement);
    });
}

// Render game details for level 4 (без строки Downloads)
function renderGameDetails(gameData) {
    elements.loading.style.display = 'none';
    
    if (!gameData) {
        elements.gameDetailsContainer.innerHTML = '<div>No game data available</div>';
        return;
    }
    
    elements.gameDetailsContainer.innerHTML = `
        <div class="game-details">
            <h3>${gameData.filename}</h3>
            <p><strong>Author:</strong> ${gameData.author}</p>
            <p><strong>License:</strong> ${gameData.license}</p>
            <p><strong>Description:</strong> ${gameData.description}</p>
            <p><strong>Access Level:</strong> ${gameData.accessLevel}</p>
            <p><strong>Likes:</strong> ${gameData.likes}</p>
            <a href="${gameData.downloadPath}" target="_blank" class="download-btn">Download</a>
        </div>
    `;
}

// Back button management
function updateBackButton() {
    elements.backButtonContainer.style.display = menuHistory.length > 1 ? 'block' : 'none';
}

// Navigate back
function goBack() {
    if (menuHistory.length < 2) return;
    
    menuHistory.pop();
    const prevParams = menuHistory[menuHistory.length - 1];
    loadAndShowMenu(prevParams, true);
}

// Initialize application
function init() {
    elements.refreshBtn.addEventListener('click', () => {
        menuHistory = [];
        loadAndShowMenu({ cmd: '1', dat: '0' });
    });
    
    elements.backButton.addEventListener('click', goBack);
    
    loadAndShowMenu({ cmd: '1', dat: '0' });
}

// Start the application
init();