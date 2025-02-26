const puppeteer = require('puppeteer');
const WebSocket = require('ws');
const { backupFiles } = require('./backup');

// const MATCH_URL = 'https://graphics.frogbox.tv/match/194/2d94c289-9cd2-4eef-b60d-7e6c85263089/'; //  HCC Zami
// const MATCH_URL = 'https://graphics.frogbox.tv/match/194/6a8dcb7b-f1c2-4db2-8e83-06d5b307d621/'; //  Wanderers Zami
// const MATCH_URL = 'https://graphics.frogbox.tv/match/194/f066e76b-7162-433d-a77e-42a74069b5cb/'; //  VRA
// let currentURL = 'https://graphics.frogbox.tv/match/194/f233c350-2134-449c-a124-759487c1d37c/';  //  Qui Vive 2
// let currentURL = 'https://graphics.frogbox.tv/match/194/774d5a32-4665-4efb-9bf9-1ed30d7faf39/';  //  Quick Dames
// let currentURL = 'https://graphics.frogbox.tv/match/194/fa030ad7-042f-41dc-814c-09f545f28cab/';  //  VRA
let currentURL = 'https://graphics.frogbox.tv/match/194/810aa8eb-bb4a-4e6c-8c47-a4c472dbb805/';     //  Bloemendaal (Bottom scorecard)
const UPDATE_INTERVAL = 10000;

// Initialize WebSocket server with error handling
const wss = new WebSocket.Server({ 
    port: 8080 
}, () => {
    console.log('WebSocket server started on port 8080');
});

wss.on('error', (error) => {
    console.error('WebSocket server error:', error);
    if (error.code === 'EADDRINUSE') {
        console.error('Port 8080 is already in use. Please close other instances or change the port.');
        process.exit(1);
    }
});

let connections = new Set();
let browser;
let page;
let currentPolling = null; // Track current polling interval

async function pollUntilData(maxAttempts = 30) {
    let attempts = 0;
    let regularInterval = null;
    
    // Clear any existing polling and intervals
    if (currentPolling) {
        clearInterval(currentPolling);
        currentPolling = null;
    }

    // Function to check for valid data
    const checkData = async () => {
        console.log(`Polling attempt ${attempts + 1}/${maxAttempts}`);
        
        try {
            // Take screenshot
            const screenshot = await page.screenshot({
                type: 'png',
                encoding: 'base64',
                fullPage: true
            });

            // Immediately check for data presence
            const { hasData, matchData } = await page.evaluate(() => {
                const title = document.querySelector('.TextStyle__H1-oxuuya-2')?.textContent;
                const inning = document.querySelector('.InningDisplayStyle__Container-uk34h8-0');
                const score = document.querySelector('.InningDisplayStyle__ScoreContainer-uk34h8-7')?.textContent;
                const team = document.querySelector('.InningDisplayStyle__TeamNameContainer-uk34h8-5')?.textContent;
                
                // Get all the data while we're in the page context
                const data = {
                    // ...existing data collection code...
                };

                return {
                    hasData: !!(title && inning && (score || team)),
                    matchData: data
                };
            });

            // Always send screenshot and any data we have
            const message = {
                screenshot: `data:image/png;base64,${screenshot}`,
                data: matchData
            };

            // Send to all clients
            connections.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify(message));
                }
            });

            attempts++;
            
            if (hasData) {
                console.log('Valid match data found, stopping aggressive polling');
                clearInterval(currentPolling);
                currentPolling = null;
                // Start regular interval updates
                regularInterval = setInterval(() => collectAndSendData(), UPDATE_INTERVAL);
                return true;
            }
            
            if (attempts >= maxAttempts) {
                console.log('Max polling attempts reached, falling back to regular interval');
                clearInterval(currentPolling);
                currentPolling = null;
                regularInterval = setInterval(() => collectAndSendData(), UPDATE_INTERVAL);
                return false;
            }

            return false;
        } catch (error) {
            console.error('Error during polling:', error);
            return false;
        }
    };

    // Start aggressive polling every second
    currentPolling = setInterval(checkData, 1000);
    
    // Do an immediate first check
    await checkData();
}

async function handleChangeURL(url) {
    console.log('Changing URL to:', url);
    currentURL = url;
    
    try {
        // Check if browser/page needs to be recreated
        if (!browser || !page || page.isClosed()) {
            console.log('Browser or page is not available, recreating...');
            if (browser) await browser.close();
            
            browser = await puppeteer.launch({ 
                headless: "new",
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            });
            page = await browser.newPage();
        }

        // Navigate to new URL with error handling
        await page.goto(currentURL, { 
            waitUntil: ['domcontentloaded'],
            timeout: 30000 
        });
        
        console.log('Page loaded, starting polling');
        await pollUntilData(30);
        
    } catch (error) {
        console.error('Error changing URL:', error);
        // Attempt to restart scraper on serious errors
        await startScraper();
    }
}

// Update the WebSocket message handler
wss.on('connection', (ws) => {
    console.log('Client connected');
    ws.send(JSON.stringify({ type: 'connection', status: 'connected' }));
    connections.add(ws);
    
    // Handle incoming messages from clients
    ws.on('message', async (message) => {
        try {
            const data = JSON.parse(message);
            if (data.command === 'changeURL' && data.url) {
                await handleChangeURL(data.url);
            } else if (data.command === 'backup') {
                console.log('Backup requested');
                backupFiles();
            } else if (data.command === 'fetchTeams' && data.url) {
                await fetchTeams(data.url, ws);
            }
        } catch (error) {
            console.error('Error handling message:', error);
        }
    });

    ws.on('close', () => connections.delete(ws));
});

async function fetchTeams(url, ws) {
    try {
        console.log('Creating temp page for KNCB team scraping:', url);
        const tempPage = await browser.newPage();
        
        console.log('Navigating to URL:', url);
        await tempPage.goto(url, { 
            waitUntil: 'networkidle0',
            timeout: 30000 
        });

        console.log('Evaluating KNCB page for team data');
        const teams = await tempPage.evaluate(() => {
            const teams = {
                teamA: [],
                teamB: []
            };

            // Find team names first
            const teamNames = Array.from(document.querySelectorAll('.team-name')).map(el => el.textContent.trim());
            console.log('Found team names:', teamNames);

            // Get players from the lineup section
            const lineupSections = document.querySelectorAll('.lineup-list');
            lineupSections.forEach((section, index) => {
                const players = Array.from(section.querySelectorAll('.player-name'))
                    .map(el => el.textContent.trim())
                    .filter(name => name); // Remove empty names

                if (index === 0) {
                    teams.teamA = players;
                } else if (index === 1) {
                    teams.teamB = players;
                }
            });

            // If lineup section not found, try scorecard section
            if (teams.teamA.length === 0 || teams.teamB.length === 0) {
                const scorecardSections = document.querySelectorAll('.team-scorecard');
                scorecardSections.forEach((section, index) => {
                    const players = Array.from(section.querySelectorAll('.batting-scorecard .player-name'))
                        .map(el => el.textContent.trim())
                        .filter(name => name);

                    if (index === 0) {
                        teams.teamA = players;
                    } else if (index === 1) {
                        teams.teamB = players;
                    }
                });
            }

            return teams;
        });

        console.log('Teams data extracted:', {
            teamACount: teams.teamA.length,
            teamBCount: teams.teamB.length,
            teamASample: teams.teamA.slice(0, 3),
            teamBSample: teams.teamB.slice(0, 3)
        });

        if (!teams.teamA.length && !teams.teamB.length) {
            throw new Error('No players found in the page');
        }

        ws.send(JSON.stringify({
            type: 'teams',
            data: teams
        }));

        await tempPage.close();
        console.log('KNCB page closed');

    } catch (error) {
        console.error('Error fetching teams:', error);
        ws.send(JSON.stringify({
            type: 'error',
            message: `Failed to fetch teams: ${error.message}`
        }));
    }
}

async function startScraper() {
    console.log('Starting scraper...');
    browser = await puppeteer.launch({ 
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    page = await browser.newPage();
    
    try {
        // Set larger timeout and wait for network idle
        await page.setDefaultNavigationTimeout(30000);
        await page.goto(currentURL, { 
            waitUntil: ['networkidle0', 'domcontentloaded'],
            timeout: 30000 
        });
        console.log('Page loaded');

        // Wait for critical elements
        await page.waitForSelector('.TextStyle__H1-oxuuya-2');
        await page.waitForSelector('.InningDisplayStyle__Container-uk34h8-0');
        
        // Set viewport size for consistent screenshots
        await page.setViewport({ width: 1200, height: 800 });
        
        // Take initial screenshot and send data
        await collectAndSendData();
        
        // Then start interval
        setInterval(collectAndSendData, UPDATE_INTERVAL);

    } catch (error) {
        console.error('Scraping error:', error);
        await browser.close();
    }
}

async function collectAndSendData() {
    try {
        console.log('Collecting data...');
        
        // Take screenshot of the entire page
        const screenshot = await page.screenshot({
            type: 'png',
            encoding: 'base64',
            fullPage: true  // capture full page
        });

        console.log('Screenshot taken:', {
            hasScreenshot: !!screenshot,
            screenshotLength: screenshot.length
        });

        const matchData = await page.evaluate(() => {
            // Add new function to handle horizontal bar layout
            function getHorizontalBarData() {
                const horizontalBar = document.querySelector('.HorizontalBarStyle__Container');
                if (!horizontalBar) return null;

                // Get team names
                const teamA = horizontalBar.querySelector('.HorizontalBarStyle__LogoContainerL')
                    ?.closest('.HorizontalBarStyle__TeamContainer')
                    ?.querySelector('.HorizontalBarStyle__TeamName')?.textContent || '';
                const teamB = horizontalBar.querySelector('.HorizontalBarStyle__LogoContainerR')
                    ?.closest('.HorizontalBarStyle__TeamContainer')
                    ?.querySelector('.HorizontalBarStyle__TeamName')?.textContent || '';

                // Get score and overs
                const scoreText = horizontalBar.querySelector('.HorizontalBarStyle__ScoreContainer')?.textContent || '';
                const oversText = horizontalBar.querySelector('.HorizontalBarStyle__OverContainer')?.textContent || '';
                
                // Get target score
                const targetText = horizontalBar.querySelector('.HorizontalBarStyle__TargetContainer')?.textContent || '';

                // Get batsmen details
                const batsmen = Array.from(horizontalBar.querySelectorAll('.HorizontalBarStyle__PlayerName'))
                    .map(player => {
                        const container = player.closest('.HorizontalBarStyle__BatsmanContainer');
                        const isStriker = !!container?.querySelector('.svg-inline--fa.fa-play');
                        return {
                            name: player.textContent || '',
                            runs: container?.querySelector('.HorizontalBarStyle__BatsmanRuns')?.textContent || '0',
                            balls: container?.querySelector('.HorizontalBarStyle__BatsmanBalls')?.textContent || '0',
                            isStriker
                        };
                    });

                // Get current bowler
                const bowler = horizontalBar.querySelector('.HorizontalBarStyle__BowlerName')?.textContent || '';

                // Get current over balls
                const currentOverBalls = Array.from(
                    horizontalBar.querySelectorAll('.HorizontalBarStyle__OverContainer .HorizontalBarStyle__Ball')
                ).map(ball => ({
                    runs: ball.textContent,
                    isWicket: ball.classList.contains('wicket')
                }));

                return {
                    layout: 'horizontal',
                    teamA,
                    teamB,
                    scoreText,
                    oversText,
                    targetText,
                    batsmen,
                    bowler,
                    currentOverBalls
                };
            }

            // Try to get horizontal bar data first, fall back to existing layout if not found
            const horizontalData = getHorizontalBarData();
            if (horizontalData) return horizontalData;

            // Debug logging for selectors
            const selectors = {
                title: '.TextStyle__H1-oxuuya-2',
                innings: '.InningDisplayStyle__Container-uk34h8-0',
                matchStatus: '.MatchStatusStyle__Container-sc-1vzzte1-0',
                tossWinner: '.TossWinnerStyle__Container-sc-1qj7e6n-0',
                venue: '.VenueStyle__Container-sc-1izr7v1-0'
            };

            // Log all selectors and their found elements
            Object.entries(selectors).forEach(([key, selector]) => {
                const element = document.querySelector(selector);
                console.log(`Selector "${key}": ${selector} => ${element ? 'Found' : 'Not found'}`);
                if (element) {
                    console.log(`Content for ${key}:`, element.textContent);
                }
            });

            function getInningData(index) {
                console.log(`Getting data for inning ${index}`);
                const inningContainers = Array.from(document.querySelectorAll('.InningDisplayStyle__Container-uk34h8-0'));
                console.log(`Found ${inningContainers.length} innings containers`);
                
                const inningContainer = inningContainers[index - 1];
                if (!inningContainer) {
                    console.log(`No container found for inning ${index}`);
                    return {};
                }

                // Log container content for debugging
                console.log(`Inning ${index} container:`, inningContainer.innerHTML.substring(0, 200) + '...');

                const scoreElement = inningContainer.querySelector('.InningDisplayStyle__ScoreContainer-uk34h8-7 .TextStyle__Custom-oxuuya-7');
                let scoreText = scoreElement?.textContent || '';
                let wickets = '';
                let score = scoreText;

                if (scoreText.includes('/')) {
                    const parts = scoreText.split('/');
                    wickets = parts[0];
                    score = parts[1];
                }

                const oversElement = inningContainer.querySelector('.InningDisplayStyle__OverContainer-uk34h8-6');
                const overs = oversElement?.textContent || '';

                const batsmenData = Array.from(inningContainer.querySelectorAll('.InningDisplayStyle__BodyLeftContainer-uk34h8-9 .InningDisplayStyle__ScoreRow-uk34h8-11'))
                    .map(row => ({
                        name: row.querySelector('.InningDisplayStyle__PlayerName-uk34h8-12')?.textContent || '',
                        runs: row.querySelector('.InningDisplayStyle__PlayerStat-uk34h8-14:first-child')?.textContent || '0',
                        balls: row.querySelector('.InningDisplayStyle__PlayerStat-uk34h8-14:last-child')?.textContent || '0',
                        isStriker: row.textContent.includes('*'),
                        strikeRate: calculateStrikeRate(
                            row.querySelector('.InningDisplayStyle__PlayerStat-uk34h8-14:first-child')?.textContent,
                            row.querySelector('.InningDisplayStyle__PlayerStat-uk34h8-14:last-child')?.textContent
                        )
                    }));

                const bowlersData = Array.from(inningContainer.querySelectorAll('.InningDisplayStyle__BodyRightContainer-uk34h8-10 .InningDisplayStyle__ScoreRow-uk34h8-11'))
                    .map(row => ({
                        name: row.querySelector('.InningDisplayStyle__PlayerName-uk34h8-12')?.textContent || '',
                        figures: row.querySelector('.InningDisplayStyle__PlayerStatBowler-uk34h8-15')?.textContent || '0-0',
                        overs: row.querySelector('.InningDisplayStyle__PlayerStat-uk34h8-14')?.textContent || '0'
                    }));

                return {
                    team: inningContainer.querySelector('.InningDisplayStyle__TeamNameContainer-uk34h8-5 .TextStyle__Custom-oxuuya-7')?.textContent,
                    score: score,
                    wickets: wickets,
                    overs: overs,
                    extras: inningContainer.querySelector('.InningDisplayStyle__ExtrasContainer-uk34h8-16')?.textContent,
                    totalOvers: inningContainer.querySelector('.InningDisplayStyle__TotalOversContainer-uk34h8-8')?.textContent,
                    requiredRate: inningContainer.querySelector('.InningDisplayStyle__RequiredRateContainer-uk34h8-18')?.textContent,
                    projectedScore: inningContainer.querySelector('.InningDisplayStyle__ProjectedScoreContainer-uk34h8-19')?.textContent,
                    batsmen: batsmenData,
                    bowlers: bowlersData,
                    lastOver: Array.from(inningContainer.querySelectorAll('.InningDisplayStyle__LastOverContainer-uk34h8-17 .Ball-sc-193m3jk-0')).map(ball => ({
                        runs: ball.textContent,
                        isWicket: ball.classList.contains('wicket')
                    }))
                };
            }

            function calculateStrikeRate(runs, balls) {
                if (!runs || !balls) return '0.00';
                const r = parseInt(runs), b = parseInt(balls);
                return b > 0 ? ((r / b) * 100).toFixed(2) : '0.00';
            }

            const inning1 = getInningData(1);
            const inning2 = getInningData(2);

            const data = {
                title: document.querySelector('.TextStyle__H1-oxuuya-2')?.textContent,
                inning1,
                inning2,
                matchStatus: document.querySelector('.MatchStatusStyle__Container-sc-1vzzte1-0')?.textContent,
                tossWinner: document.querySelector('.TossWinnerStyle__Container-sc-1qj7e6n-0')?.textContent,
                venue: document.querySelector('.VenueStyle__Container-sc-1izr7v1-0')?.textContent
            };

            // Validate data before returning
            console.log('Final data validation:', {
                hasTitle: !!data.title,
                hasInning1: Object.keys(data.inning1).length > 0,
                hasInning2: Object.keys(data.inning2).length > 0,
                matchStatus: data.matchStatus,
            });

            return data;
        });

        // Create message with proper data URL format for the screenshot
        const message = {
            screenshot: `data:image/png;base64,${screenshot}`,
            data: matchData
        };

        // Validate message before sending
        if (!message.screenshot.startsWith('data:image/png;base64,')) {
            console.error('Invalid screenshot format');
            return;
        }

        connections.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify(message));
                console.log('Message sent with screenshot');
            }
        });
    } catch (error) {
        console.error('Error during data collection:', error);
    }
}

// Make sure to clean up on process exit
process.on('SIGINT', async () => {
    console.log('Shutting down...');
    if (browser) await browser.close();
    wss.close(() => {
        console.log('WebSocket server closed');
        process.exit(0);
    });
});

startScraper().catch(console.error);
