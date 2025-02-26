// Add this function at the top level of the file, before it's used
function getLastWord(name) {
    if (!name) return '';
    const parts = name.split(' ');
    if (parts.length <= 1) return name;

    const particles = ['de', 'van', 'van de', 'van der', 'der', 'den'];
    const lastPart = parts.pop();

    if (particles.includes(lastPart.toLowerCase())) {
        const secondLastPart = parts.pop();
        return `${lastPart} ${secondLastPart}`;
    }
    return lastPart;
}

// Retry WebSocket connection if it fails
// Update the WebSocket connection to use relative URLs
function connectWebSocket() {
    // Use relative WebSocket URL that works on any domain
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    console.log('Connecting to WebSocket at:', wsUrl);
    
    const ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
        addLogEntry('Connected to server', 'success');
        createMatchButtons();
    };

    ws.onclose = () => {
        addLogEntry('Connection lost', 'error', 'Attempting to reconnect in 5 seconds...');
        setTimeout(connectWebSocket, 5000);
    };

    ws.onerror = (error) => {
        addLogEntry('WebSocket error', 'error', 'Server might not be running. Check if scraper.js is started.');
        console.error('WebSocket error:', error);
    };

    return ws;
}

const ws = connectWebSocket();

// Define utility functions first
function addLogEntry(message, type = 'info', details = null) {
    const logContent = document.querySelector('.log-content');
    if (!logContent) return;
    
    const entry = document.createElement('div');
    entry.className = `log-entry log-${type}`;
    const time = new Date().toLocaleTimeString('en-US', { 
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    
    entry.innerHTML = `
        <span class="log-time">${time}</span>
        <span class="log-type" data-type="${type}" title="${type.toUpperCase()}"></span>
        <span class="log-message">${message}</span>
    `;
    
    logContent.insertBefore(entry, logContent.firstChild);
    if (logContent.children.length > 100) {
        logContent.removeChild(logContent.lastChild);
    }
}

function addDetailedLogEntry(message, type = 'info', details = null) {
    const logContent = document.querySelector('.log-content-detailed');
    if (!logContent) return;
    
    // Only add log-score entries if there are less than 2 already
    if (type === 'score' && logContent.querySelectorAll('.log-entry.detailed.log-score').length >= 2) {
        return;
    }
    
    const entry = document.createElement('div');
    entry.className = `log-entry detailed log-${type}`;
    const time = new Date().toLocaleTimeString('en-US', { 
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        fractionalSecondDigits: 3
    });
    
    let detailsStr = '';
    if (details) {
        detailsStr = '\n' + (typeof details === 'object' ? 
            JSON.stringify(details, null, 2) : details);
    }

    entry.innerHTML = `
        <span class="log-time">${time}</span>
        <span class="log-type" data-type="${type}" title="${type.toUpperCase()}"></span>
        ${message}${detailsStr}
    `;
    
    logContent.insertBefore(entry, logContent.firstChild);
    
    if (logContent.children.length > 37) {
        logContent.removeChild(logContent.lastChild);
    }
}

// URL change function must be defined before it's used
function clearScoreboard() {
    // Show loading state in title
    document.querySelector('.match-title').textContent = 'Loading...';
    
    // Clear innings data and show placeholders
    ['.inning1', '.inning2'].forEach(inning => {
        const container = document.querySelector(inning);
        if (container) {
            container.querySelector('.team-name').textContent = '';
            container.querySelector('.score').textContent = '';
            container.querySelector('.overs').textContent = '';
            container.querySelector('.innings-content').innerHTML = `
                <div class="innings-placeholder">
                    Waiting for match data...
                </div>`;
            container.querySelector('.last-over').innerHTML = '';
        }
    });

    // Clear screenshot and show placeholder
    const screenshot = document.getElementById('match-screenshot');
    if (screenshot) {
        screenshot.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
        showScreenshotPlaceholder();
    }
}

function showScreenshotPlaceholder() {
    const container = document.querySelector('.screenshot-container');
    if (!container) return;
    
    // Remove any existing placeholder
    const existingPlaceholder = container.querySelector('.screenshot-placeholder');
    if (existingPlaceholder) existingPlaceholder.remove();
    
    // Add new placeholder
    const placeholder = document.createElement('div');
    placeholder.className = 'screenshot-placeholder';
    placeholder.textContent = 'Waiting for screenshot...';
    container.appendChild(placeholder);
}

function changeURL(url) {
    if (ws.readyState === WebSocket.OPEN) {
        clearScoreboard();
        
        // Update UI to show polling status
        const title = document.querySelector('.match-title');
        title.textContent = 'Loading match data...';
        title.style.opacity = '0.7';
        
        addLogEntry('Starting aggressive data polling...', 'info');
        
        ws.send(JSON.stringify({
            command: 'changeURL',
            url: url
        }));
        
        const logMessage = `Switching to match - <a href="${url}" target="_blank" style="color: #4dabf7; text-decoration: underline;">${url}</a>`;
        addLogEntry(logMessage, 'info');
    } else {
        addLogEntry('WebSocket not connected', 'error');
    }
}

// Match URLs
const matchURLS = {
    'HCC Zami': 'https://graphics.frogbox.tv/match/194/2d94c289-9cd2-4eef-b60d-7e6c85263089/',
    'Wanderers Zami': 'https://graphics.frogbox.tv/match/194/6a8dcb7b-f1c2-4db2-8e83-06d5b307d621/',
    'Quick Dames': 'https://graphics.frogbox.tv/match/194/774d5a32-4665-4efb-9bf9-1ed30d7faf39/',
    'Qui Vive 2': 'https://graphics.frogbox.tv/match/194/f233c350-2134-449c-a124-759487c1d37c/',
    'Kampong 1': 'https://graphics.frogbox.tv/match/194/41021426-92ab-4314-b310-837c5ffe5cf4/', // End screen
    'R&W 1': 'https://graphics.frogbox.tv/match/194/1d4a7135-f7d3-4650-a4f8-59e562afffac/',     // Scorecard
    'VRA 1': 'https://graphics.frogbox.tv/match/194/f066e76b-7162-433d-a77e-42a74069b5cb/',
    'HBS 1': 'https://graphics.frogbox.tv/match/194/45e53a42-cd40-4cd9-824d-f8ac9ed814b3/',
    'VOC 1': 'https://graphics.frogbox.tv/match/146/3a1f7435-5f6e-4f19-88bc-82d9cb2505bc/', // Scorecard VOC
    'Bdaal 1': 'https://graphics.frogbox.tv/match/194/810aa8eb-bb4a-4e6c-8c47-a4c472dbb805/' //Bottom score rich data
};

const MAX_PRESETS = 10; // Changed from 6 to 10
let matchArchive = {};

// Add after other global variables
let isManualMode = localStorage.getItem('isManualMode') === 'true';
let lastScrapedData = null;

// Load saved presets and archive from localStorage
try {
    const savedPresets = localStorage.getItem('matchPresets');
    const savedArchive = localStorage.getItem('matchArchive');
    if (savedPresets) Object.assign(matchURLS, JSON.parse(savedPresets));
    if (savedArchive) matchArchive = JSON.parse(savedArchive);
} catch (e) {
    console.error('Error loading saved presets:', e);
}

// After matchURLS definition, add:
const MAX_URL_HISTORY = 10;
let urlHistory = [];

// Load saved URL history from localStorage
try {
    const savedHistory = localStorage.getItem('urlHistory');
    if (savedHistory) {
        urlHistory = JSON.parse(savedHistory);
    }
} catch (e) {
    console.error('Error loading URL history:', e);
}

function saveNewPreset(url) {
    if (!url.includes('graphics.frogbox.tv/match/')) {
        addLogEntry('Invalid FrogBox Graphics URL', 'error');
        return false;
    }

    // First use a temporary name
    let teamName = 'New Match';

    // Add new preset temporarily to start fetching data
    matchURLS[teamName] = url;
    changeURL(url);

    // Wait for first data to come in (which includes the match title)
    const titleObserver = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            if (mutation.type === 'characterData' || mutation.target.textContent !== '') {
                const title = mutation.target.textContent;
                // Just extract the opponent name (everything after "VCC vs" or before "vs VCC")
                const newName = title.includes('VCC vs') ? 
                    title.split('VCC vs ')[1] : 
                    title.split(' vs VCC')[0];
                
                // Remove the temporary entry
                delete matchURLS[teamName];
                
                // Move oldest preset to archive if we exceed MAX_PRESETS
                const presetEntries = Object.entries(matchURLS);
                if (presetEntries.length >= MAX_PRESETS) {
                    // Move the oldest preset to archive
                    const [oldestName, oldestUrl] = presetEntries[0];
                    delete matchURLS[oldestName];
                    
                    // Add to archive with timestamp
                    matchArchive[`${oldestName} (${new Date().toLocaleDateString()})`] = oldestUrl;
                    
                    // Limit archive size to 50 entries
                    const archiveEntries = Object.entries(matchArchive);
                    if (archiveEntries.length > 50) {
                        delete matchArchive[archiveEntries[0][0]];
                    }
                }

                // Add with proper name
                matchURLS[newName] = url;

                // Save to localStorage
                localStorage.setItem('matchPresets', JSON.stringify(matchURLS));
                localStorage.setItem('matchArchive', JSON.stringify(matchArchive));

                createMatchButtons();
                updateArchiveButtons();
                addLogEntry(`Added preset: ${newName}`, 'success');

                titleObserver.disconnect();
                break;
            }
        }
    });

    // Start observing the title element
    const titleElement = document.querySelector('.match-title');
    if (titleElement) {
        titleObserver.observe(titleElement, {
            characterData: true,
            childList: true,
            subtree: true
        });
    }

    return true;
}

function updateArchiveButtons() {
    const archiveContainer = document.querySelector('.match-archive');
    if (!archiveContainer) return;

    archiveContainer.innerHTML = Object.entries(matchArchive)
        .map(([name, url]) => `
            <button class="archive-button" onclick="changeURL('${url}')" title="${url}">
                ${name}
            </button>
        `).join('');
}

// Modify the DOMContentLoaded event handler
document.addEventListener('DOMContentLoaded', () => {
    createMatchButtons();
    updateArchiveButtons();

    // Add URL input handler
    const urlInput = document.getElementById('match-url');
    const addButton = document.getElementById('add-url');

    if (urlInput && addButton) {
        // Add datalist for URL suggestions
        const datalist = document.createElement('datalist');
        datalist.id = 'url-history';
        urlInput.setAttribute('list', 'url-history');
        urlInput.parentNode.appendChild(datalist);

        // Populate datalist with history
        function updateUrlSuggestions() {
            datalist.innerHTML = urlHistory
                .map(url => `<option value="${url}">`)
                .join('');
        }
        updateUrlSuggestions();

        addButton.onclick = () => {
            const url = urlInput.value.trim();
            if (url) {
                // Add to history if not already present
                if (!urlHistory.includes(url)) {
                    urlHistory.unshift(url);
                    // Keep only MAX_URL_HISTORY most recent URLs
                    urlHistory = urlHistory.slice(0, MAX_URL_HISTORY);
                    // Save to localStorage
                    localStorage.setItem('urlHistory', JSON.stringify(urlHistory));
                    updateUrlSuggestions();
                }
                
                changeURL(url); // Start using URL immediately
                if (saveNewPreset(url)) {
                    urlInput.value = ''; // Clear input only if save was successful
                }
            }
        };

        urlInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                addButton.click();
            }
        });
    }

    // Initialize manual mode state on page load
    const container = document.querySelector('.container');
    const manualControls = document.querySelector('.manual-controls');
    const toggleButton = document.querySelector('.toggle-manual-mode');
    
    container.classList.toggle('manual-mode', isManualMode);
    manualControls.classList.toggle('visible', isManualMode);
    toggleButton.classList.toggle('active', isManualMode);
    toggleButton.textContent = isManualMode ? 'Switch to Auto Mode' : 'Switch to Manual Mode';

    // Initialize manual controls with saved data if in manual mode
    if (isManualMode) {
        const savedData = getManualData();
        if (Object.values(savedData).some(val => val)) {
            updateDigitalScoreboard(savedData);
        }
    }

    addLogEntry('Page initialized', 'info');
    showScreenshotPlaceholder();  // Show initial placeholder

    // Setup control buttons
    document.querySelectorAll('.tablet-button').forEach(button => {
        button.addEventListener('click', () => {
            const field = button.dataset.field;
            const input = document.querySelector(`[data-field="${field}"]`);
            if (!input) return;

            if (button.classList.contains('clear')) {
                input.value = '';
            } else if (button.classList.contains('decrease')) {
                const step = input.step ? parseFloat(input.step) : 1;
                const value = parseFloat(input.value) || 0;
                input.value = Math.max(0, value - step);
            } else if (button.classList.contains('increase')) {
                const step = input.step ? parseFloat(input.step) : 1;
                const value = parseFloat(input.value) || 0;
                input.value = value + step;
            }

            // Save to localStorage and update scoreboard
            localStorage.setItem(`manual_${field}`, input.value);
            if (isManualMode) {
                updateDigitalScoreboard(getManualData());
            }
        });
    });

    // Add input event listeners for manual controls
    document.querySelectorAll('.manual-input').forEach(input => {
        input.addEventListener('input', () => {
            if (isManualMode) {
                localStorage.setItem(`manual_${input.dataset.field}`, input.value);
                updateDigitalScoreboard(getManualData());
            }
        });
    });

    // Modify input event listeners for manual controls to update instantly
    document.querySelectorAll('.manual-input').forEach(input => {
        ['input', 'change'].forEach(eventType => {
            input.addEventListener(eventType, () => {
                const field = input.dataset.field;
                const value = input.value;
                
                // Save to localStorage
                localStorage.setItem(`manual_${field}`, value);
                
                // If in manual mode, update scoreboard immediately
                if (isManualMode) {
                    const manualData = getManualData();
                    updateDigitalScoreboard(manualData);
                }
            });
        });
    });

    // Update tablet button handlers to trigger immediate updates
    document.querySelectorAll('.tablet-button').forEach(button => {
        button.addEventListener('click', () => {
            const field = button.dataset.field;
            const input = document.querySelector(`[data-field="${field}"]`);
            if (!input) return;

            if (button.classList.contains('clear')) {
                input.value = '';
            } else if (button.classList.contains('decrease')) {
                const step = input.step ? parseFloat(input.step) : 1;
                const value = parseFloat(input.value) || 0;
                input.value = Math.max(0, value - step);
            } else if (button.classList.contains('increase')) {
                const step = input.step ? parseFloat(input.step) : 1;
                const value = parseFloat(input.value) || 0;
                input.value = value + step;
            }

            // Save to localStorage and update scoreboard immediately
            localStorage.setItem(`manual_${field}`, input.value);
            if (isManualMode) {
                const manualData = getManualData();
                updateDigitalScoreboard(manualData);
            }
        });
    });

    // Enhanced input event handler for all manual inputs
    document.querySelectorAll('.manual-input').forEach(input => {
        ['input', 'change', 'keyup'].forEach(eventType => {
            input.addEventListener(eventType, () => {
                if (!isManualMode) return;
                
                // Get all current manual input values
                const manualData = {};
                document.querySelectorAll('.manual-input').forEach(inp => {
                    manualData[inp.dataset.field] = inp.value;
                });

                // Save to localStorage
                localStorage.setItem(`manual_${input.dataset.field}`, input.value);
                
                // Update scoreboard immediately
                updateDigitalScoreboard(manualData);
            });
        });
    });

    // Update tablet button handlers
    document.querySelectorAll('.tablet-button').forEach(button => {
        button.addEventListener('click', () => {
            if (!isManualMode) return;

            const field = button.dataset.field;
            const input = document.querySelector(`[data-field="${field}"]`);
            if (!input) return;

            // Handle button actions
            if (button.classList.contains('clear')) {
                input.value = '';
            } else if (button.classList.contains('decrease')) {
                const step = input.step ? parseFloat(input.step) : 1;
                const value = parseFloat(input.value) || 0;
                input.value = Math.max(0, value - step);
            } else if (button.classList.contains('increase')) {
                const step = input.step ? parseFloat(input.step) : 1;
                const value = parseFloat(input.value) || 0;
                input.value = value + step;
            }

            // Save to localStorage
            localStorage.setItem(`manual_${field}`, input.value);

            // Get all current values and update immediately
            const manualData = {};
            document.querySelectorAll('.manual-input').forEach(inp => {
                manualData[inp.dataset.field] = inp.value;
            });
            updateDigitalScoreboard(manualData);
        });
    });

    // Add teams URL handler
    const teamsUrlInput = document.getElementById('teams-url');
    const fetchTeamsButton = document.getElementById('fetch-teams');

    if (teamsUrlInput && fetchTeamsButton) {
        fetchTeamsButton.onclick = () => {
            const url = teamsUrlInput.value.trim();
            if (!url) {
                addLogEntry('Please enter a team list URL', 'error');
                return;
            }

            if (!url.includes('matchcentre.kncb.nl')) {
                addLogEntry('URL must be from matchcentre.kncb.nl', 'error');
                return;
            }

            if (ws.readyState === WebSocket.OPEN) {
                addLogEntry('Fetching teams data...', 'info');
                
                // Clear previous content and show loading state
                const teamAList = document.getElementById('teamA-list');
                const teamBList = document.getElementById('teamB-list');
                
                if (teamAList) teamAList.innerHTML = '<div class="player-item loading">Loading team data...</div>';
                if (teamBList) teamBList.innerHTML = '<div class="player-item loading">Loading team data...</div>';

                // Send the request
                ws.send(JSON.stringify({
                    command: 'fetchTeams',
                    url: url
                }));

                // Disable button and show loading state
                fetchTeamsButton.disabled = true;
                fetchTeamsButton.textContent = 'Loading...';
                fetchTeamsButton.style.opacity = '0.5';
                
                // Enable after timeout
                setTimeout(() => {
                    fetchTeamsButton.disabled = false;
                    fetchTeamsButton.textContent = 'Fetch Teams';
                    fetchTeamsButton.style.opacity = '1';
                }, 5000);
            } else {
                addLogEntry('WebSocket not connected', 'error');
            }
        };

        // Add input validation
        teamsUrlInput.addEventListener('input', () => {
            const url = teamsUrlInput.value.trim();
            fetchTeamsButton.disabled = !url.includes('kncb.nl');
        });

        teamsUrlInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !fetchTeamsButton.disabled) {
                fetchTeamsButton.click();
            }
        });
    }

});

function createMatchButtons() {
    const buttonContainer = document.querySelector('.match-buttons');
    if (!buttonContainer) return;

    // Keep the URL input container by selecting everything after it
    const urlContainer = buttonContainer.querySelector('.url-input-container');
    if (!urlContainer) return;

    // Remove only the old preset buttons
    Array.from(buttonContainer.children).forEach(child => {
        if (child !== urlContainer) child.remove();
    });

    // Add new preset buttons
    Object.entries(matchURLS).forEach(([name, url]) => {
        const button = document.createElement('button');
        button.className = 'match-button';
        button.textContent = name;
        button.onclick = () => {
            document.querySelectorAll('.match-button').forEach(btn => 
                btn.classList.remove('active'));
            button.classList.add('active');
            changeURL(url);
        };
        buttonContainer.appendChild(button);
    });
}

// Add to window for debug access
window.changeURL = changeURL;
window.matchURLS = matchURLS;

// Replace the current ws.onmessage handler
ws.onmessage = (event) => {
    try {
        console.log('Received WebSocket message:', {
            dataType: typeof event.data,
            dataLength: event.data.length,
            preview: event.data.substring(0, 100)
        });

        const message = JSON.parse(event.data);
        console.log('Parsed message:', {
            type: message.type,
            hasData: !!message.data,
            hasScreenshot: !!message.screenshot,
            dataKeys: message.data ? Object.keys(message.data) : []
        });

        // Handle error messages first
        if (message.type === 'error') {
            console.error('Server error:', message.message);
            addLogEntry(message.message, 'error');
            return;
        }

        // Handle teams data with explicit logging
        if (message.type === 'teams') {
            console.log('Processing teams data:', message.data);
            if (!message.data) {
                console.warn('Teams message has no data');
                addLogEntry('Received empty teams data', 'warning');
                return;
            }

            handleTeamsData(message.data);
            return;
        }

        // Handle match updates
        if (message.screenshot) {
            handleScreenshot(message.screenshot);
        }

        if (message.data) {
            handleMatchData(message.data);
        } else {
            console.log('Message contains neither match data nor teams data:', message);
            addLogEntry('Received incomplete data update', 'warning');
        }

    } catch (error) {
        console.error('Error processing message:', {
            error,
            rawData: event.data.substring(0, 200)
        });
        addLogEntry(`Error: ${error.message}`, 'error');
    }
};

function handleScreenshot(screenshotData) {
    console.log('Processing screenshot');
    const img = document.getElementById('match-screenshot');
    if (!img) {
        console.error('Screenshot image element not found');
        return;
    }

    // Use transparent pixel while loading
    img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    
    img.onload = () => {
        console.log('Screenshot loaded successfully');
        const placeholder = document.querySelector('.screenshot-placeholder');
        if (placeholder) placeholder.remove();
    };

    img.onerror = (e) => console.error('Screenshot load error:', e);
    img.src = screenshotData;
    addLogEntry('Screenshot updated', 'info');
}

function handleMatchData(data) {
    // Store for manual mode
    lastScrapedData = data;
    
    // Only update UI if not in manual mode
    if (!isManualMode) {
        // Update title
        const title = data.title ? data.title.replace(/\s+vs\s+/i, ' - ') : 'Loading...';
        document.querySelector('.match-title').textContent = title;
        
        // Update innings
        if (data.inning1) updateInning('.inning1', data.inning1);
        if (data.inning2) updateInning('.inning2', data.inning2);

        // Add to logs
        addLogEntry(`${data.title} - ${data.inning1?.score || 'N/A'} (${data.inning1?.overs || '0.0'})${
            data.inning2?.score ? ` | ${data.inning2.score} (${data.inning2.overs})` : ''
        }`, 'score');

        addDetailedLogEntry('Match Update', 'score', {
            title: data.title,
            status: data.matchStatus,
            tossWinner: data.tossWinner,
            venue: data.venue,
            inning1: data.inning1,
            inning2: data.inning2
        });

        // Update scoreboards
        populateScoreboard(data);
        updateDigitalScoreboard(data);
    }
}

function handleTeamsData(data) {
    console.log('Processing teams data:', {
        hasTeamA: !!data?.teamA,
        teamALength: data?.teamA?.length || 0,
        hasTeamB: !!data?.teamB,
        teamBLength: data?.teamB?.length || 0
    });

    // Get list containers
    const teamAList = document.getElementById('teamA-list');
    const teamBList = document.getElementById('teamB-list');

    if (!data || (!data.teamA?.length && !data.teamB?.length)) {
        console.warn('No valid teams data found');
        const message = 'No teams data found';
        if (teamAList) teamAList.innerHTML = `<div class="player-item">${message}</div>`;
        if (teamBList) teamBList.innerHTML = `<div class="player-item">${message}</div>`;
        addLogEntry(message, 'warning');
        return;
    }

    // Update team lists
    if (teamAList && data.teamA?.length) {
        const html = data.teamA
            .map(player => `<div class="player-item">${player}</div>`)
            .join('');
        teamAList.innerHTML = html;
        console.log('Updated Team A list with players:', data.teamA.length);
    }

    if (teamBList && data.teamB?.length) {
        const html = data.teamB
            .map(player => `<div class="player-item">${player}</div>`)
            .join('');
        teamBList.innerHTML = html;
        console.log('Updated Team B list with players:', data.teamB.length);
    }

    addLogEntry(`Teams updated - Found ${data.teamA?.length || 0} and ${data.teamB?.length || 0} players`, 'success');
}

function populateScoreboard(data) {
    // Send data to scoreboard.html using localStorage
    localStorage.setItem('scoreboardData', JSON.stringify(data));
}

let secondWindow = null;

function updateDigitalScoreboard(data) {
    console.log('updateDigitalScoreboard called with data:', data);

    const scoreboardData = isManualMode ? {
        // Manual mode mappings
        batsmanAName: data.batsmanA || '',
        batsmanARuns: data.runsA || '',
        batsmanBName: data.batsmanB || '',
        batsmanBRuns: data.runsB || '',
        team1Score: data.score1 || '',
        wickets: data.wickets || '',
        dlsScore: data.dls || '',
        overs: data.overs1 || '',
        inning1Score: data.inning1Score || ''
    } : {
        // Auto mode - fix score and wickets mapping
        batsmanAName: getLastWord(data.inning1?.batsmen?.[0]?.name) || '',
        batsmanARuns: data.inning1?.batsmen?.[0]?.runs || '',
        batsmanBName: getLastWord(data.inning1?.batsmen?.[1]?.name) || '',
        batsmanBRuns: data.inning1?.batsmen?.[1]?.runs || '',
        team1Score: data.inning1?.score?.split('/')?.[0] || '',  // Changed this
        wickets: data.inning1?.score?.split('/')?.[1] || '',     // Changed this
        dlsScore: data.matchStatus || '...',
        overs: data.inning1?.overs?.replace(/ OVERS/, '') || '',
        inning1Score: data.inning2?.score || ''
    };

    console.log('Sending scoreboardData:', scoreboardData);

    // Send to iframe
    const iframe = document.querySelector('iframe[src*="digital-scoreboard.html"]');
    if (iframe) {
        try {
            iframe.contentWindow.postMessage({
                type: 'updateScoreboard',
                data: scoreboardData
            }, '*');
            console.log('Data sent to iframe');
        } catch (e) {
            console.error('Error sending data to iframe:', e);
        }
    }

    // Sync the second window
    syncSecondWindow(scoreboardData);
}

function syncSecondWindow(data) {
    if (!secondWindow || secondWindow.closed) {
        console.log('Second window not available or closed');
        return;
    }

    try {
        secondWindow.postMessage({
            type: 'updateScoreboard',
            data: data
        }, '*');
        console.log('Data sent to second window successfully');
    } catch (e) {
        console.error('Error sending data to second window:', e);
    }
}

window.openDigitalScoreboard = function() {
    // Use relative path instead of absolute
    const path = 'digital-scoreboard.html';
    secondWindow = window.open(
        path, 
        'digitalScoreboard',
        'width=1920,height=1080'
    );
    
    if (secondWindow) {
        // Function to retry sending data
        const sendData = () => {
            try {
                const currentData = JSON.parse(localStorage.getItem('scoreboardData') || '{}');
                updateDigitalScoreboard(currentData);
            } catch (e) {
                console.error('Error sending initial data:', e);
            }
        };

        // Try multiple times to send data
        setTimeout(sendData, 500);
        setTimeout(sendData, 1000);
        setTimeout(sendData, 2000);
    }
};

window.openFullscreenScoreboard = function() {
    if (secondWindow && !secondWindow.closed) {
        secondWindow.close();
    }
    
    secondWindow = window.open(
        'digital-scoreboard.html', 
        'digitalScoreboard',
        'popup=true'
    );

    if (secondWindow) {
        secondWindow.moveTo(window.screen.width, 0);
        
        // Function to handle fullscreen
        const setupFullscreen = () => {
            try {
                const element = secondWindow.document.documentElement;
                if (element.requestFullscreen) {
                    element.requestFullscreen();
                } else if (element.webkitRequestFullscreen) {
                    element.webkitRequestFullscreen();
                } else if (element.msRequestFullscreen) {
                    element.msRequestFullscreen();
                }
                
                // Send current data to the new window
                const currentData = JSON.parse(localStorage.getItem('scoreboardData') || '{}');
                updateDigitalScoreboard(currentData);
            } catch (e) {
                console.error('Error setting up fullscreen:', e);
            }
        };

        // Wait for window to load then go fullscreen
        secondWindow.onload = setupFullscreen;
    }
};

// Update video playback functionality
document.addEventListener('DOMContentLoaded', () => {
    const videoPlayer = document.getElementById('video-player');
    const videoWrapper = document.querySelector('.video-wrapper');
    const video = document.getElementById('animation-video');
    const buttons = document.querySelectorAll('.video-button');
    let isTransitioning = false;

    // Add these attributes to the video element
    video.setAttribute('playsinline', '');
    video.controls = false;

    // Function to close video player
    const closeVideo = () => {
        if (isTransitioning) return;
        isTransitioning = true;

        videoPlayer.classList.add('closing');
        
        setTimeout(() => {
            videoPlayer.classList.remove('visible', 'closing');
            video.pause();
            video.currentTime = 0;
            isTransitioning = false;
            document.querySelector('.kill-video').classList.remove('active');
        }, 300);
    };

    // Function to open video
    function openVideo(videoPath) {
        if (isTransitioning) return;
        isTransitioning = true;
    
        // Play in preview
        const previewVideo = document.getElementById('preview-video');
        const previewContainer = document.querySelector('.preview-video-container');
        if (previewVideo && previewContainer) {
            previewVideo.src = videoPath;
            previewContainer.classList.add('visible');
            previewVideo.play().catch(console.error);
            
            previewVideo.onended = () => {
                previewContainer.classList.remove('visible');
                previewVideo.currentTime = 0;
            };
        }
    
        // Play in scoreboard window if it exists
        if (secondWindow && !secondWindow.closed) {
            secondWindow.postMessage({
                type: 'playVideo',
                videoPath: videoPath
            }, '*');
        }
    
        // Play in iframe preview
        const iframe = document.querySelector('iframe[src*="digital-scoreboard.html"]');
        if (iframe) {
            iframe.contentWindow.postMessage({
                type: 'playVideo',
                videoPath: videoPath
            }, '*');
        }
    
        setTimeout(() => {
            isTransitioning = false;
        }, 300);
        document.querySelector('.kill-video').classList.add('active');
    }

    // Handle clicks anywhere in the video wrapper
    videoWrapper.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent event from reaching videoPlayer
        closeVideo();
    });

    // Handle clicks on video player background
    videoPlayer.addEventListener('click', (e) => {
        if (e.target === videoPlayer) {
            closeVideo();
        }
    });

    // Handle video end
    video.addEventListener('ended', () => {
        document.querySelector('.kill-video').classList.remove('active');
        closeVideo();
    });

    // Handle ESC key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && videoPlayer.classList.contains('visible')) {
            closeVideo();
        }
    });

    // Setup video buttons
    buttons.forEach(button => {
        button.addEventListener('click', () => {
            const videoName = button.dataset.video;
            openVideo(`animations/${videoName} - scoreboard animation.mp4`);
        });
    });

    // Listen for messages from the digital scoreboard window
    window.addEventListener('message', (event) => {
        if (event.data.type === 'playVideo') {
            const videoName = event.data.videoName;
            openVideo(`animations/${videoName} - scoreboard animation.mp4`);
        }
    });
});

function updateInning(selector, inning) {
    if (!inning) return;
    
    const container = document.querySelector(selector);
    if (!container) return;

    // Update header
    container.querySelector('.team-name').textContent = inning.team || '';
    container.querySelector('.score').textContent = inning.score || '';
    container.querySelector('.overs').textContent = inning.overs || '';

    const inningsContent = container.querySelector('.innings-content');
    
    // Show placeholder if no batsmen or bowlers data
    if (!inning.batsmen?.length && !inning.bowlers?.length) {
        // Make placeholder the only child of innings-content
        inningsContent.innerHTML = `<div class="innings-placeholder">
            ${inning.team ? `Waiting for ${inning.team}'s innings to begin...` : 'Waiting for match data...'}
        </div>`;
        // Remove grid columns when showing placeholder
        inningsContent.style.display = 'block';
        return;
    }

    // Restore grid display when showing data
    inningsContent.style.display = 'grid';
    
    // Otherwise, restore the original structure and update with data
    inningsContent.innerHTML = `
        <div class="batting-section">
            <div class="batsmen-list">
                <div class="batting-header">
                    <div>Batsman</div>
                    <div>R</div>
                    <div>B</div>
                    <div>SR</div>
                </div>
                ${inning.batsmen?.map(batsman => `
                    <div class="batsman ${batsman.isStriker ? 'striker' : ''}">
                        <div class="name">${batsman.name}</div>
                        <div class="runs">${batsman.runs}</div>
                        <div class="balls">${batsman.balls}</div>
                        <div class="strike-rate">${batsman.strikeRate}</div>
                    </div>
                `).join('') || ''}
            </div>
        </div>
        <div class="bowling-section">
            <div class="bowlers-list">
                <div class="bowling-header">
                    <div>Bowler</div>
                    <div>O</div>
                    <div>R</div>
                    <div>W</div>
                </div>
                ${inning.bowlers?.map(bowler => `
                    <div class="bowler">
                        <div class="name">${bowler.name}</div>
                        <div class="overs">${bowler.overs}</div>
                        <div class="runs">${bowler.figures.split('-')[0]}</div>
                        <div class="wickets">${bowler.figures.split('-')[1] || '0'}</div>
                    </div>
                `).join('') || ''}
            </div>
        </div>
    `;

    // Update last over
    if (inning.lastOver?.length > 0) {
        const lastOver = container.querySelector('.last-over');
        if (lastOver) {
            lastOver.innerHTML = inning.lastOver.map(ball => `
                <div class="ball ${ball.isWicket ? 'wicket' : ''}">${ball.runs}</div>
            `).join('');
        }
    }
}

function toggleManualMode() {
    const container = document.querySelector('.container');
    const manualControls = document.querySelector('.manual-controls');
    const toggleButton = document.querySelector('.toggle-manual-mode');
    
    isManualMode = !isManualMode;
    localStorage.setItem('isManualMode', isManualMode);
    
    container.classList.toggle('manual-mode', isManualMode);
    manualControls.classList.toggle('visible', isManualMode);
    toggleButton.classList.toggle('active', isManualMode);
    toggleButton.textContent = isManualMode ? 'Switch to Auto Mode' : 'Switch to Manual Mode';

    if (isManualMode && lastScrapedData) {
        // Initialize manual inputs with auto mode data
        initializeManualControls(lastScrapedData);
    } else if (lastScrapedData) {
        updateDigitalScoreboard(lastScrapedData);
    }
}

function initializeManualControls(data) {
    // Get wickets and score from inning1 data
    const score = data.inning1?.score || '';
    let wickets = '', totalScore = '';

    if (score.includes('/')) {
        [wickets, totalScore] = score.split('/');
    } else {
        totalScore = score;
    }

    console.log('Initializing controls with:', { score, wickets, totalScore }); // Debug log

    // Create the controls data object with all fields
    const manualControls = {
        'team1': data.inning1?.team || '',
        'score1': totalScore || '',
        'wickets': wickets,  // Remove the || '' to allow empty values
        'overs1': data.inning1?.overs?.replace(/ OVERS/, '') || '',
        'batsmanA': data.inning1?.batsmen?.[0]?.name || '',
        'runsA': data.inning1?.batsmen?.[0]?.runs || '',
        'batsmanB': data.inning1?.batsmen?.[1]?.name || '',
        'runsB': data.inning1?.batsmen?.[1]?.runs || '',
        'dls': data.matchStatus || ''
    };

    // Set values in manual controls and save to localStorage
    Object.entries(manualControls).forEach(([field, value]) => {
        const input = document.querySelector(`[data-field="${field}"]`);
        if (input) {
            input.step = "1"; // Set step to 1 for all numeric inputs
            if (field === 'wickets') {
                // Don't set a default value, keep it empty if no wickets data
                input.value = value;
                if (value) { // Only save to localStorage if we have a value
                    localStorage.setItem(`manual_${field}`, value);
                }
            } else {
                input.value = value;
                localStorage.setItem(`manual_${field}`, value);
            }
        }
    });

    // Update digital scoreboard with the new data
    updateDigitalScoreboard(getManualData());
}

// Add window.toggleManualMode for HTML onclick access
window.toggleManualMode = toggleManualMode;

// Add this function for manual data handling
function getManualData() {
    const manualData = {};
    document.querySelectorAll('.manual-input').forEach(input => {
        manualData[input.dataset.field] = input.value;
    });
    return {
        batsmanAName: manualData.batsmanA || '',
        batsmanARuns: manualData.runsA || '',
        batsmanBName: manualData.batsmanB || '',
        batsmanBRuns: manualData.runsB || '',
        team1Score: manualData.score1 || '',
        wickets: manualData.wickets || '',  // Now correctly maps to the wickets input
        dlsScore: manualData.dls || '',
        overs: manualData.overs1 || '',
        inning1Score: manualData.inning1Score || ''
    };
}

// Modify the ws.onmessage handler to store last scraped data
ws.onmessage = (event) => {
    try {
        console.log('Received message, parsing...');
        const message = JSON.parse(event.data);
        
        // Handle screenshot first
        if (message.screenshot) {
            console.log('Screenshot received:', {
                isDataUrl: message.screenshot.startsWith('data:image/png;base64,'),
                length: message.screenshot.length
            });
            
            const img = document.getElementById('match-screenshot');
            if (img) {
                // Use transparent pixel instead of empty src
                img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
                // Set new image with load/error handlers
                img.onload = () => {
                    console.log('Screenshot loaded successfully');
                    // Remove placeholder when image loads
                    const placeholder = document.querySelector('.screenshot-placeholder');
                    if (placeholder) placeholder.remove();
                };
                img.onerror = (e) => console.error('Screenshot load error:', e);
                img.src = message.screenshot;
                
                addLogEntry('Screenshot updated', 'info');
            } else {
                console.error('Screenshot image element not found');
            }
        }

        // Handle match data
        const data = message.data;
        if (data) {
            // Store the last scraped data
            lastScrapedData = data;
            
            // Only update UI if not in manual mode
            if (!isManualMode) {
                // Update title with "vs" replaced by dash, but only if we have a real title
                const title = data.title ? data.title.replace(/\s+vs\s+/i, ' - ') : 'Loading...';
                document.querySelector('.match-title').textContent = title;
                
                // Rest of the data handling
                if (data.inning1) updateInning('.inning1', data.inning1);
                if (data.inning2) updateInning('.inning2', data.inning2);

                // Add to log
                addLogEntry(`${data.title} - ${data.inning1?.score || 'N/A'} (${data.inning1?.overs || '0.0'})${
                    data.inning2?.score ? ` | ${data.inning2.score} (${data.inning2.overs})` : ''
                }`, 'score');

                // Add detailed log
                addDetailedLogEntry('Match Update', 'score', {
                    title: data.title,
                    status: data.matchStatus,
                    tossWinner: data.tossWinner,
                    venue: data.venue,
                    inning1: data.inning1,
                    inning2: data.inning2
                });

                // Populate scoreboard.html
                populateScoreboard(data);
                updateDigitalScoreboard(data);
            }
        } else {
            console.warn('No match data in message');
        }

        // Handle teams data
        if (message.type === 'teams') {
            const teamAList = document.getElementById('teamA-list');
            const teamBList = document.getElementById('teamB-list');

            if (!message.data.teamA.length && !message.data.teamB.length) {
                addLogEntry('No team data found', 'warning');
                if (teamAList) teamAList.innerHTML = '<div class="player-item">No players found</div>';
                if (teamBList) teamBList.innerHTML = '<div class="player-item">No players found</div>';
                return;
            }

            if (teamAList && message.data.teamA) {
                teamAList.innerHTML = message.data.teamA
                    .map(player => `<div class="player-item">${player}</div>`)
                    .join('') || '<div class="player-item">No players found</div>';
            }

            if (teamBList && message.data.teamB) {
                teamBList.innerHTML = message.data.teamB
                    .map(player => `<div class="player-item">${player}</div>`)
                    .join('') || '<div class="player-item">No players found</div>';
            }

            addLogEntry(`Teams updated - Found ${message.data.teamA.length} and ${message.data.teamB.length} players`, 'success');
        }

    } catch (error) {
        console.error('Error processing message:', error, 'Raw data:', event.data.substring(0, 200));
        addLogEntry(`Error: ${error.message}`, 'error');
        addDetailedLogEntry('Error Details', 'error', {
            message: error.message,
            stack: error.stack,
            rawData: event.data.substring(0, 1000) + '...'
        });
    }
};

window.backupFiles = function() {
    // Send backup request via WebSocket
    if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
            command: 'backup'
        }));
        addLogEntry('Backup requested', 'info');
    } else {
        addLogEntry('Cannot backup - WebSocket not connected', 'error');
    }
};

// Add this new function
window.killAllVideos = function() {
    // Kill video in preview iframe
    const iframe = document.querySelector('iframe[src*="digital-scoreboard.html"]');
    if (iframe) {
        iframe.contentWindow.postMessage({
            type: 'killVideo'
        }, '*');
    }

    // Kill video in fullscreen window
    if (secondWindow && !secondWindow.closed) {
        secondWindow.postMessage({
            type: 'killVideo'
        }, '*');
    }

    // Kill video in main window
    const videoPlayer = document.getElementById('video-player');
    const video = document.getElementById('animation-video');
    if (videoPlayer && videoPlayer.classList.contains('visible')) {
        videoPlayer.classList.add('closing');
        setTimeout(() => {
            videoPlayer.classList.remove('visible', 'closing');
            if (video) {
                video.pause();
                video.currentTime = 0;
            }
        }, 300);
    }
};


