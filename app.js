// Global variables
let socket;
let agents = {};
let level = 0;
let announcements = [];
let chatLog = [];
let chatLogWindow = null;

// DOM Elements
const $ = id => document.getElementById(id);

// Initialize on load
document.addEventListener('DOMContentLoaded', init);

function init() {
    // Setup event listeners
    $('login_button').addEventListener('click', login);
    $('login_nickname').addEventListener('keydown', e => {
        if (e.key === 'Enter') login();
    });
    $('login_room').addEventListener('keydown', e => {
        if (e.key === 'Enter') login();
    });
    
    $('error_button').addEventListener('click', () => {
        $('error_screen').style.display = 'none';
        $('login_screen').style.display = 'block';
    });
    
    // Setup context menu handler
    document.addEventListener('contextmenu', handleContextMenu);
}

function login() {
    const nickname = $('login_nickname').value.trim();
    const room = $('login_room').value.trim();
    
    if (!nickname) {
        alert('Please enter a nickname');
        return;
    }
    
    // Hide login screen, show boot screen
    $('login_screen').style.display = 'none';
    $('boot_screen').style.display = 'flex';
    
    // Connect to socket
    connectSocket(nickname, room);
    
    // Simulate boot sequence
    setTimeout(() => {
        $('boot_screen').style.display = 'none';
        $('main_app').style.display = 'block';
        
        // Show welcome window
        showWelcomeWindow();
        
        // Setup chat interface
        setupChat();
    }, 3000);
}

function connectSocket(nickname, room) {
    socket = io('https://bonzi.nigger.email', {
        transports: ['websocket'],
        forceNew: true
    });
    
    // Register login
    let self = {
        name: nickname,
        room: room,
        color: "purple"
    };
    
    socket.emit("login", self);
    
    // Setup socket event handlers
    setupSocketHandlers();
}

function setupSocketHandlers() {
    socket.on('loginFail', error => {
        $('boot_screen').style.display = 'none';
        $('error_screen').style.display = 'block';
        $('error_kick').innerHTML = error;
    });
    
    socket.on('login', logindata => {
        $('current_room').textContent = logindata.room;
        $('user_count').textContent = Object.keys(logindata.users).length;
        
        // Create agents for all users
        Object.keys(logindata.users).forEach(userkey => {
            let user = logindata.users[userkey];
            let x = Math.floor(Math.random() * (window.innerWidth - 200));
            let y = Math.floor(Math.random() * (window.innerHeight - 200 - 40));
            agents[userkey] = new Agent(user.name, userkey, x, y, user.color);
        });
    });
    
    socket.on('join', user => {
        $('user_count').textContent = parseInt($('user_count').textContent) + 1;
        
        let x = Math.floor(Math.random() * (window.innerWidth - 200));
        let y = Math.floor(Math.random() * (window.innerHeight - 200 - 40));
        agents[user.guid] = new Agent(user.name, user.guid, x, y, user.color);
        
        // Add to chat log
        addToChatLog(`${user.name} has joined the room`);
    });
    
    socket.on('leave', guid => {
        $('user_count').textContent = Math.max(0, parseInt($('user_count').textContent) - 1);
        
        if (agents[guid]) {
            addToChatLog(`${agents[guid].name} has left the room`);
            agents[guid].kill();
            delete agents[guid];
        }
    });
    
    socket.on('talk', data => {
        if (agents[data.guid]) {
            agents[data.guid].talk(data.text, data.text);
            addToChatLog(`<b>${agents[data.guid].name}:</b> ${data.text}`, true);
        }
    });
    
    socket.on('update', user => {
        if (agents[user.guid]) {
            $(`agent_${user.guid}n`).innerHTML = user.name;
            agents[user.guid].voice = user.voice;
            if (user.color != agents[user.guid].color) {
                agents[user.guid].change(user.color);
            }
        }
    });
    
    socket.on('actqueue', queue => {
        if (agents[queue.guid]) {
            agents[queue.guid].actqueue(queue.list, 0);
        }
    });
    
    socket.on('update_self', info => {
        level = info.level;
        if (info.roomowner) {
            $('room_owner').style.display = 'block';
        }
    });
    
    socket.on('kick', kicker => {
        socket.disconnect();
        $('main_app').style.display = 'none';
        $('error_screen').style.display = 'block';
        $('error_kick').innerHTML = 'You were kicked by ' + kicker;
        $('error_kicker').innerHTML = kicker;
    });
    
    socket.on('announce', data => {
        announcements.push(new MSWindow(data.title, data.html));
        if (announcements.length > 3) {
            announcements[0].kill();
            announcements.shift();
        }
    });
}

function setupChat() {
    // Set up send button
    $('send_button').addEventListener('click', send);
    
    // Set up enter key in chat input
    $('send_message').addEventListener('keydown', e => {
        if (e.key === 'Enter') send();
    });
    
    // Set up chat log button
    $('chat_log_button').addEventListener('click', toggleChatLog);
}

function send() {
    let tosend = $('send_message').value.trim();
    if (!tosend) return;
    
    if (tosend.startsWith('/')) {
        let comd = tosend.split(' ')[0].replace('/', '');
        let param = tosend.includes(' ') ? tosend.substring(tosend.indexOf(' ') + 1, tosend.length) : '';
        socket.emit('command', {command: comd, param: param});
    } else {
        socket.emit('talk', tosend);
    }
    
    $('send_message').value = '';
}

function toggleChatLog() {
    if (chatLogWindow) {
        chatLogWindow.kill();
        chatLogWindow = null;
    } else {
        showChatLog();
    }
}

function showChatLog() {
    const html = `
        <div id="chat_log"></div>
        <div class="field-row-stacked buttons">
            <button id="clear_log_button">Clear Log</button>
        </div>
    `;
    
    chatLogWindow = new MSWindow('Chat Log', html, 10, 10, 400, 300, window => {
        const logElement = $('chat_log');
        
        // Populate chat log
        chatLog.forEach(entry => {
            const div = document.createElement('div');
            div.className = 'chat-entry' + (entry.highlight ? ' purple' : '');
            div.innerHTML = entry.text;
            logElement.appendChild(div);
        });
        
        // Scroll to bottom
        logElement.scrollTop = logElement.scrollHeight;
        
        // Setup clear button
        $('clear_log_button').addEventListener('click', () => {
            chatLog = [];
            logElement.innerHTML = '';
        });
    });
}

function addToChatLog(text, highlight = false) {
    chatLog.push({
        text: text,
        highlight: highlight,
        timestamp: new Date()
    });
    
    // Keep chat log limited to last 100 messages
    if (chatLog.length > 100) {
        chatLog.shift();
    }
    
    // Update chat log window if open
    if (chatLogWindow && $('chat_log')) {
        const logElement = $('chat_log');
        const div = document.createElement('div');
        div.className = 'chat-entry' + (highlight ? ' purple' : '');
        div.innerHTML = text;
        logElement.appendChild(div);
        
        // Scroll to bottom
        logElement.scrollTop = logElement.scrollHeight;
    }
}

function handleContextMenu(mouse) {
    mouse.preventDefault();
    
    // Find agent the mouse is over
    let bid = -1;
    Object.keys(agents).forEach((akey) => {
        // Check if within bounds of an agent
        if (
            mouse.clientX > agents[akey].x &&
            mouse.clientX < agents[akey].x + agents[akey].canvas.width &&
            mouse.clientY > agents[akey].y &&
            mouse.clientY < agents[akey].y + agents[akey].canvas.height
        ) bid = akey;
    });
    
    // Show context menu if agent found
    if (bid > -1) {
        // Define the contextmenu upon click (so it can be dynamic)
        let cmenu = [
            {
                type: 0,
                name: "Cancel",
                callback: (passthrough) => {
                    passthrough.cancel();
                }
            }, 
            {
                type: 0,
                name: "Call an Asshole",
                callback: (passthrough) => {
                    socket.emit("command", {
                        command: "asshole",
                        param: passthrough.name
                    });
                }
            }, 
            {
                type: 0,
                name: "Notice Bulge",
                callback: (passthrough) => {
                    socket.emit("command", {
                        command: "owo",
                        param: passthrough.name
                    });
                }
            }, 
            {
                type: 0,
                name: "Kick",
                disabled: level <= 1,
                callback: (passthrough) => {
                    socket.emit("command", {
                        command: "kick",
                        param: passthrough.id
                    });
                }
            }
        ];
        
        contextmenu(cmenu, mouse.clientX, mouse.clientY, agents[bid]);
    }
}

function showWelcomeWindow() {
    const html = `
        <div class="welcome-content">
            <div class="welcome-title">Welcome to MS Agent World!</div>
            <div class="welcome-logo">
                <svg width="100" height="100" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="45" fill="purple" />
                    <circle cx="35" cy="40" r="5" fill="white" />
                    <circle cx="65" cy="40" r="5" fill="white" />
                    <path d="M 30 60 Q 50 80 70 60" stroke="white" stroke-width="3" fill="none" />
                </svg>
            </div>
            <div class="welcome-text">
                Welcome to the MS Agent World! Here you can chat with other users using the classic Windows 98 style.
                <ul>
                    <li>Drag agents to move them around</li>
                    <li>Right-click on agents for more options</li>
                    <li>Type messages in the chat bar at the bottom</li>
                </ul>
            </div>
            <button id="welcome_ok">OK</button>
        </div>
    `;
    
    const welcomeWindow = new MSWindow('Welcome to MS Agent World', html, null, null, 350, 350);
    welcomeWindow.element.classList.add('welcome-window');
    
    $('welcome_ok').addEventListener('click', () => {
        welcomeWindow.kill();
    });
}

