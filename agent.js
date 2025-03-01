class Agent {
    constructor(name, id, x, y, color) {
        this.name = name;
        this.id = id;
        this.x = x;
        this.y = y;
        this.color = color;
        this.voice = "Sam";
        this.moving = false;
        this.talking = false;
        this.element = null;
        this.canvas = null;
        this.spritesheet = null;
        this.sprite = null;
        this.nametag = null;
        this.speechBubble = null;
        this.actionQueue = [];
        
        this.init();
    }
    
    init() {
        // Create main element
        this.element = document.createElement('div');
        this.element.className = 'agent';
        this.element.id = 'agent_' + this.id;
        this.element.style.left = this.x + 'px';
        this.element.style.top = this.y + 'px';
        
        // Create canvas for sprite
        this.canvas = document.createElement('canvas');
        this.canvas.width = 200;
        this.canvas.height = 160;
        this.element.appendChild(this.canvas);
        
        // Create nametag
        this.nametag = document.createElement('div');
        this.nametag.className = 'agent-nametag';
        this.nametag.id = 'agent_' + this.id + 'n';
        this.nametag.textContent = this.name;
        this.element.appendChild(this.nametag);
        
        // Add to container
        document.getElementById('agent_container').appendChild(this.element);
        
        // Set up sprite
        this.setupSprite();
        
        // Make draggable
        this.makeDraggable();
        
        // Play enter animation
        this.playAnimation('enter');
    }
    
    setupSprite() {
        const data = {
            images: ['/purple.png'],
            frames: { width: 200, height: 160 },
            animations: {
                idle: 0,
                enter: [277, 302, "idle", 0.25],
                leave: [16, 39, 40, 0.25],
                talk: [1, 15, "idle", 0.25],
                shrug: [41, 55, "idle", 0.25]
            }
        };
        
        this.spritesheet = new createjs.SpriteSheet(data);
        this.sprite = new createjs.Sprite(this.spritesheet, "idle");
        
        // Set up stage
        this.stage = new createjs.Stage(this.canvas);
        this.stage.addChild(this.sprite);
        createjs.Ticker.addEventListener("tick", this.stage);
    }
    
    makeDraggable() {
        let offsetX, offsetY, self = this;
        
        const dragStart = function(e) {
            // Get touch or mouse position
            const clientX = e.clientX || e.touches[0].clientX;
            const clientY = e.clientY || e.touches[0].clientY;
            
            offsetX = clientX - self.x;
            offsetY = clientY - self.y;
            self.moving = true;
            
            document.addEventListener('mousemove', dragMove);
            document.addEventListener('touchmove', dragMove, { passive: false });
            document.addEventListener('mouseup', dragEnd);
            document.addEventListener('touchend', dragEnd);
            
            // Prevent default to avoid scrolling on mobile
            e.preventDefault();
        };
        
        const dragMove = function(e) {
            if (!self.moving) return;
            
            // Get touch or mouse position
            const clientX = e.clientX || e.touches[0].clientX;
            const clientY = e.clientY || e.touches[0].clientY;
            
            self.x = clientX - offsetX;
            self.y = clientY - offsetY;
            
            // Keep on screen
            const maxX = window.innerWidth - self.canvas.width;
            const maxY = window.innerHeight - self.canvas.height - 40; // Account for taskbar
            
            if (self.x < 0) self.x = 0;
            if (self.y < 0) self.y = 0;
            if (self.x > maxX) self.x = maxX;
            if (self.y > maxY) self.y = maxY;
            
            self.element.style.left = self.x + 'px';
            self.element.style.top = self.y + 'px';
            
            // If there's a speech bubble, move it too
            if (self.speechBubble) {
                self.positionSpeechBubble();
            }
            
            // Prevent default to avoid scrolling on mobile
            e.preventDefault();
        };
        
        const dragEnd = function() {
            self.moving = false;
            document.removeEventListener('mousemove', dragMove);
            document.removeEventListener('touchmove', dragMove);
            document.removeEventListener('mouseup', dragEnd);
            document.removeEventListener('touchend', dragEnd);
        };
        
        this.element.addEventListener('mousedown', dragStart);
        this.element.addEventListener('touchstart', dragStart, { passive: false });
    }
    
    talk(text, rawText) {
        // If already talking, add to queue
        if (this.talking) {
            this.actionQueue.push(() => this.talk(text, rawText));
            return;
        }
        
        this.talking = true;
        
        // Process text (linkify etc)
        text = this.processText(text);
        
        // Create or update speech bubble
        if (!this.speechBubble) {
            this.speechBubble = document.createElement('div');
            this.speechBubble.className = 'speech-bubble';
            document.getElementById('agent_container').appendChild(this.speechBubble);
        }
        
        this.speechBubble.innerHTML = text;
        this.positionSpeechBubble();
        this.speechBubble.style.display = 'block';
        
        // Play talk animation
        this.playAnimation('talk');
        
        // Speak the text
        this.speak(rawText);
        
        // Hide speech bubble after delay
        clearTimeout(this.talkTimeout);
        
        // Calculate delay based on text length (minimum 2 seconds)
        const delay = Math.max(2000, text.length * 100);
        
        this.talkTimeout = setTimeout(() => {
            if (this.speechBubble) {
                this.speechBubble.style.display = 'none';
            }
            this.sprite.gotoAndPlay('idle');
            this.talking = false;
            
            // Process next action in queue if any
            if (this.actionQueue.length > 0) {
                const nextAction = this.actionQueue.shift();
                nextAction();
            }
        }, delay);
    }
    
    positionSpeechBubble() {
        if (!this.speechBubble) return;
        
        const bubbleWidth = this.speechBubble.offsetWidth;
        const bubbleHeight = this.speechBubble.offsetHeight;
        
        // Position the bubble above the agent
        let bubbleX = this.x + (this.canvas.width / 2) - (bubbleWidth / 2);
        let bubbleY = this.y - bubbleHeight - 20;
        
        // Keep bubble on screen
        if (bubbleX < 0) bubbleX = 0;
        if (bubbleX + bubbleWidth > window.innerWidth) {
            bubbleX = window.innerWidth - bubbleWidth;
        }
        if (bubbleY < 0) bubbleY = 0;
        
        this.speechBubble.style.left = bubbleX + 'px';
        this.speechBubble.style.top = bubbleY + 'px';
    }
    
    processText(text) {
        // Replace {NAME} with agent name
        text = text.replace(/\{NAME\}/g, this.name);
        
        // Linkify URLs
        text = text.replace(
            /(https?:\/\/[^\s]+)/g, 
            '<a href="$1" target="_blank">$1</a>'
        );
        
        return text;
    }
    
    speak(text) {
        // Microsoft Sam TTS via Tetyys API
        if (!text) return;
        
        text = text.replace(/\{NAME\}/g, this.name);
        
        const url = "https://www.tetyys.com/SAPI4/SAPI4?text=" + 
                    encodeURIComponent(text) + 
                    "&voice=" + encodeURIComponent(this.voice) + 
                    "&pitch=150&speed=100";
                    
        const audio = new Audio(url);
        audio.play();
    }
    
    playAnimation(name) {
        if (this.sprite) {
            this.sprite.gotoAndPlay(name);
        }
    }
    
    actqueue(actions, index) {
        if (!actions || index >= actions.length) return;
        
        const action = actions[index];
        
        if (action.type === "text") {
            this.talk(action.text, action.text);
            setTimeout(() => {
                this.actqueue(actions, index + 1);
            }, Math.max(2000, action.text.length * 100));
        } else if (action.type === "anim") {
            this.playAnimation(action.anim);
            setTimeout(() => {
                this.actqueue(actions, index + 1);
            }, action.timeout || 1000);
        }
    }
    
    change(newColor) {
        this.color = newColor;
        // In a real implementation, we would change the spritesheet based on color
        // For now, we're just keeping the purple sprite
    }
    
    kill() {
        // Play leave animation then remove
        this.playAnimation('leave');
        
        setTimeout(() => {
            // Remove speech bubble if exists
            if (this.speechBubble) {
                this.speechBubble.remove();
                this.speechBubble = null;
            }
            
            // Remove the agent element
            this.element.remove();
            
            // Clean up createjs resources
            if (this.stage) {
                createjs.Ticker.removeEventListener("tick", this.stage);
                this.stage.removeAllChildren();
                this.stage = null;
            }
            
            this.sprite = null;
            this.spritesheet = null;
        }, 1000); // Wait for leave animation
    }
}

function contextmenu(items, x, y, passthrough) {
    // Remove any existing context menus
    const existingMenus = document.querySelectorAll('.context-menu');
    existingMenus.forEach(menu => menu.remove());
    
    // Create menu
    const menu = document.createElement('div');
    menu.className = 'context-menu';
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
    
    // Add items
    items.forEach((item, index) => {
        if (item.type === 1) {
            // Separator
            const separator = document.createElement('div');
            separator.className = 'context-menu-separator';
            menu.appendChild(separator);
        } else {
            // Regular item
            const menuItem = document.createElement('div');
            menuItem.className = 'context-menu-item';
            if (item.disabled) {
                menuItem.className += ' disabled';
            }
            menuItem.textContent = item.name;
            
            if (!item.disabled) {
                menuItem.addEventListener('click', () => {
                    item.callback(passthrough);
                    menu.remove();
                });
            }
            
            menu.appendChild(menuItem);
        }
    });
    
    // Add cancel method
    passthrough.cancel = function() {
        menu.remove();
    };
    
    // Close when clicking outside
    const closeMenu = function(e) {
        if (!menu.contains(e.target)) {
            menu.remove();
            document.removeEventListener('click', closeMenu);
        }
    };
    
    // Add to DOM and attach event listener after a small delay
    document.body.appendChild(menu);
    setTimeout(() => {
        document.addEventListener('click', closeMenu);
    }, 10);
    
    // Keep menu on screen
    const menuWidth = menu.offsetWidth;
    const menuHeight = menu.offsetHeight;
    
    if (x + menuWidth > window.innerWidth) {
        menu.style.left = (window.innerWidth - menuWidth) + 'px';
    }
    
    if (y + menuHeight > window.innerHeight) {
        menu.style.top = (window.innerHeight - menuHeight) + 'px';
    }
}

class MSWindow {
    constructor(title, html, x, y, width, height, callback) {
        this.title = title;
        this.html = html;
        this.x = x || Math.round((window.innerWidth - 300) / 2);
        this.y = y || Math.round((window.innerHeight - 200) / 2);
        this.width = width || 300;
        this.height = height || 200;
        this.callback = callback;
        this.element = null;
        
        this.create();
    }
    
    create() {
        // Create window
        this.element = document.createElement('div');
        this.element.className = 'window ms-window';
        this.element.style.left = this.x + 'px';
        this.element.style.top = this.y + 'px';
        this.element.style.width = this.width + 'px';
        this.element.style.height = this.height + 'px';
        
        // Title bar
        const titleBar = document.createElement('div');
        titleBar.className = 'title-bar';
        
        const titleText = document.createElement('div');
        titleText.className = 'title-bar-text';
        titleText.textContent = this.title;
        titleBar.appendChild(titleText);
        
        const titleControls = document.createElement('div');
        titleControls.className = 'title-bar-controls';
        
        const closeButton = document.createElement('button');
        closeButton.setAttribute('aria-label', 'Close');
        closeButton.addEventListener('click', () => this.kill());
        titleControls.appendChild(closeButton);
        
        titleBar.appendChild(titleControls);
        this.element.appendChild(titleBar);
        
        // Window body
        const windowBody = document.createElement('div');
        windowBody.className = 'window-body';
        windowBody.innerHTML = this.html;
        this.element.appendChild(windowBody);
        
        // Make draggable
        this.makeDraggable(titleBar);
        
        // Add to container
        document.getElementById('windows-container').appendChild(this.element);
        
        // Call callback if provided
        if (this.callback) {
            this.callback(this);
        }
    }
    
    makeDraggable(handle) {
        let offsetX, offsetY, self = this;
        
        handle.style.cursor = 'move';
        
        handle.addEventListener('mousedown', function(e) {
            offsetX = e.clientX - self.x;
            offsetY = e.clientY - self.y;
            
            document.addEventListener('mousemove', moveWindow);
            document.addEventListener('mouseup', stopMoving);
        });
        
        function moveWindow(e) {
            self.x = e.clientX - offsetX;
            self.y = e.clientY - offsetY;
            
            // Keep on screen
            if (self.x < 0) self.x = 0;
            if (self.y < 0) self.y = 0;
            if (self.x + self.element.offsetWidth > window.innerWidth) {
                self.x = window.innerWidth - self.element.offsetWidth;
            }
            if (self.y + self.element.offsetHeight > window.innerHeight) {
                self.y = window.innerHeight - self.element.offsetHeight;
            }
            
            self.element.style.left = self.x + 'px';
            self.element.style.top = self.y + 'px';
        }
        
        function stopMoving() {
            document.removeEventListener('mousemove', moveWindow);
            document.removeEventListener('mouseup', stopMoving);
        }
    }
    
    kill() {
        if (this.element) {
            this.element.remove();
            this.element = null;
        }
    }
}

