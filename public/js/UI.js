/**
 * UI class to handle all UI interactions
 */
class UI {
  constructor() {
    // Room elements
    this.roomCodeDisplay = document.getElementById('room-code-display');
    this.copyRoomCodeBtn = document.getElementById('copy-room-code');
    this.createRoomBtn = document.getElementById('create-room-btn');
    this.roomCodeInput = document.getElementById('room-code-input');
    this.joinRoomBtn = document.getElementById('join-room-btn');

    // Chat elements
    this.chatContainer = document.getElementById('chat-container');
    this.toggleChatBtn = document.getElementById('toggle-chat-btn');
    this.chatMessages = document.getElementById('chat-messages');
    this.chatInput = document.getElementById('chat-input');
    this.sendChatBtn = document.getElementById('send-chat-btn');



    // State
    this.currentRoomCode = null;
    this.isMobile = this.detectMobile();

    // Initialize event listeners
    this.initEventListeners();

    // Adjust UI for mobile
    if (this.isMobile) {
      this.setupMobileUI();
    }
  }

  /**
   * Detect if the user is on a mobile device
   * @returns {boolean} True if on mobile device
   */
  detectMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }

  /**
   * Make UI adjustments for mobile devices
   */
  setupMobileUI() {
    // Add class to body for potential CSS targeting
    document.body.classList.add('mobile-device');

    // Adjust input fields for better mobile experience
    this.roomCodeInput.setAttribute('autocapitalize', 'characters');
    this.roomCodeInput.setAttribute('autocomplete', 'off');
    this.roomCodeInput.setAttribute('autocorrect', 'off');
    this.roomCodeInput.setAttribute('spellcheck', 'false');

    this.chatInput.setAttribute('autocomplete', 'off');

    // Make sure chat is collapsed by default on mobile
    this.chatContainer.classList.add('collapsed');

    // Set up blur handlers for inputs to hide keyboard
    this.roomCodeInput.addEventListener('blur', () => {
      // Small timeout to prevent immediate re-focus when button is tapped
      setTimeout(() => {
        window.scrollTo(0, 0);
      }, 100);
    });

    this.chatInput.addEventListener('blur', () => {
      setTimeout(() => {
        window.scrollTo(0, 0);
      }, 100);
    });
  }

  /**
   * Set up all event listeners for UI elements
   */
  initEventListeners() {
    // Room-related listeners
    this.createRoomBtn.addEventListener('click', () => {
      if (this.onCreateRoom) this.onCreateRoom();
    });

    this.joinRoomBtn.addEventListener('click', () => {
      const roomCode = this.roomCodeInput.value.trim().toUpperCase();
      if (roomCode && this.onJoinRoom) {
        this.onJoinRoom(roomCode);
      }
    });

    this.copyRoomCodeBtn.addEventListener('click', () => {
      if (this.currentRoomCode) {
        this.copyToClipboard(this.currentRoomCode);
      }
    });

    // Chat-related listeners
    this.toggleChatBtn.addEventListener('click', () => {
      this.toggleChat();
    });

    // Also allow clicking the chat header to toggle
    document.getElementById('chat-header').addEventListener('click', (e) => {
      // Only toggle if the click wasn't on the toggle button (which has its own handler)
      if (e.target !== this.toggleChatBtn) {
        this.toggleChat();
      }
    });

    this.sendChatBtn.addEventListener('click', () => {
      this.sendChatMessage();
    });

    this.chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this.sendChatMessage();
        e.preventDefault(); // Prevent default to avoid line breaks in input
      }
    });
  }

  // Add to the UI constructor after other initialization
  initGameHUD() {
    // Create HUD container
    this.hudContainer = document.createElement('div');
    this.hudContainer.id = 'game-hud';
    this.hudContainer.className = 'game-hud';

    // Create controls indicator with minimal design
    this.controlsIndicator = document.createElement('div');
    this.controlsIndicator.className = 'hud-panel';
    this.controlsIndicator.innerHTML = `
      <div class="control-row"><span class="key">T</span> Generate Terrain</div>
      <div class="control-row"><span class="key">Shift+T</span> Change Colors</div>
      <div class="control-row"><span class="key">Shift+Click</span> Place Model</div>
      <div class="control-row"><span class="key">A</span> Toggle Animations</div>
      <div class="control-row"><span class="key">Scroll</span> Adjust Height</div>
    `;

    this.hudContainer.appendChild(this.controlsIndicator);

    // Add HUD to the document
    document.getElementById('ui-overlay').appendChild(this.hudContainer);

    // Auto-hide HUD after 8 seconds
    setTimeout(() => {
      this.hudContainer.classList.add('hud-hidden');
    }, 8000);

    // Allow showing/hiding HUD with H key
    window.addEventListener('keydown', (e) => {
      if (e.key === 'h' || e.key === 'H') {
        this.hudContainer.classList.toggle('hud-hidden');
      }
    });
  }

  /**
   * Copy text to clipboard with fallbacks for different browsers
   * @param {string} text - Text to copy
   */
  copyToClipboard(text) {
    // Try the modern navigator.clipboard API first
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text)
        .then(() => {
          this.showCopyFeedback();
        })
        .catch(err => {
          console.error('Could not copy room code: ', err);
          this.fallbackCopyToClipboard(text);
        });
    } else {
      this.fallbackCopyToClipboard(text);
    }
  }

  /**
   * Fallback method to copy text using a temporary textarea
   * @param {string} text - Text to copy
   */
  fallbackCopyToClipboard(text) {
    const textArea = document.createElement('textarea');
    textArea.value = text;

    // Make the textarea out of viewport
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';

    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    try {
      const successful = document.execCommand('copy');
      if (successful) {
        this.showCopyFeedback();
      } else {
        console.error('Failed to copy');
      }
    } catch (err) {
      console.error('Error copying: ', err);
    }

    document.body.removeChild(textArea);
  }

  /**
   * Show feedback that the copy was successful
   */
  showCopyFeedback() {
    // Temporary visual feedback
    const originalText = this.copyRoomCodeBtn.textContent;
    this.copyRoomCodeBtn.textContent = 'Copied!';

    // Also flash the button to provide visual feedback
    this.copyRoomCodeBtn.classList.add('copy-flash');

    setTimeout(() => {
      this.copyRoomCodeBtn.textContent = originalText;
      this.copyRoomCodeBtn.classList.remove('copy-flash');
    }, 2000);
  }

  /**
   * Toggle chat panel expanded/collapsed state
   */
  toggleChat() {
    this.chatContainer.classList.toggle('collapsed');
    this.toggleChatBtn.textContent = this.chatContainer.classList.contains('collapsed') ? '▼' : '▲';

    // If expanding, focus the chat input
    if (!this.chatContainer.classList.contains('collapsed')) {
      this.chatInput.focus();
      // Reset the "New" indicator if it was showing
      if (this.toggleChatBtn.textContent === '▲') {
        this.toggleChatBtn.textContent = '▲';
      }
    }
  }

  /**
   * Send a chat message
   */
  sendChatMessage() {
    const message = this.chatInput.value.trim();
    if (message && this.currentRoomCode && this.onSendChatMessage) {
      this.onSendChatMessage(this.currentRoomCode, message);
      this.chatInput.value = '';

      // On mobile, keep focus on the input for continued typing
      if (this.isMobile) {
        this.chatInput.focus();
      }
    }
  }

  /**
   * Update the room code display
   * @param {string} roomCode - The room code to display
   */
  updateRoomDisplay(roomCode) {
    this.currentRoomCode = roomCode;

    if (roomCode) {
      this.roomCodeDisplay.textContent = `Room: ${roomCode}`;
      this.copyRoomCodeBtn.disabled = false;

      // Update UI state to show we're in a room
      this.createRoomBtn.disabled = true;
      this.joinRoomBtn.disabled = true;
      this.roomCodeInput.disabled = true;

      // On mobile, blur the input to hide keyboard
      if (this.isMobile) {
        this.roomCodeInput.blur();
        window.scrollTo(0, 0);
      }
    } else {
      this.roomCodeDisplay.textContent = 'Not in a room';
      this.copyRoomCodeBtn.disabled = true;

      // Update UI state to show we're not in a room
      this.createRoomBtn.disabled = false;
      this.joinRoomBtn.disabled = false;
      this.roomCodeInput.disabled = false;
    }
  }

  /**
   * Display a new chat message
   * @param {string} userId - ID of the user who sent the message
   * @param {string} message - The message content
   * @param {number} timestamp - Message timestamp
   */
  displayChatMessage(userId, message, timestamp) {
    const messageElement = document.createElement('div');
    messageElement.className = 'chat-message';

    // Format the timestamp
    const date = new Date(timestamp);
    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Create message content with user ID and timestamp
    messageElement.innerHTML = `
      <span class="user-id">${this.formatUserId(userId)}</span>
      <span class="timestamp">${timeStr}</span>
      <div class="message-content">${this.escapeHtml(message)}</div>
    `;

    // Add to chat and scroll to bottom
    this.chatMessages.appendChild(messageElement);
    this.chatMessages.scrollTop = this.chatMessages.scrollHeight;

    // If chat is collapsed, give visual indication of new message
    if (this.chatContainer.classList.contains('collapsed')) {
      this.toggleChatBtn.textContent = '▼ New';

      // For mobile, provide haptic feedback if available
      if (this.isMobile && window.navigator.vibrate) {
        window.navigator.vibrate(100); // Short vibration
      }

      // Flash the chat header briefly
      this.chatContainer.classList.add('new-message');
      setTimeout(() => {
        this.chatContainer.classList.remove('new-message');
      }, 1000);
    }
  }

  /**
   * Format a user ID to a shorter display name
   * @param {string} userId - The full user ID
   * @returns {string} Shortened display name
   */
  formatUserId(userId) {
    // Use the last 5 characters of the ID if it's long
    if (userId.length > 10) {
      return `User-${userId.substring(userId.length - 5)}`;
    }
    return userId;
  }

  /**
   * Display an error message
   * @param {string} message - Error message to display
   */
  displayError(message) {
    // For mobile, use a custom toast-like notification instead of alert
    if (this.isMobile) {
      this.showToast(message, 'error');
    } else {
      alert(message);
    }
  }

  /**
   * Display a toast notification
   * @param {string} message - Message to display
   * @param {string} type - Type of toast (error, success, info)
   */
  showToast(message, type = 'info') {
    // Create toast element if it doesn't exist
    let toastContainer = document.getElementById('toast-container');

    if (!toastContainer) {
      toastContainer = document.createElement('div');
      toastContainer.id = 'toast-container';
      toastContainer.style.position = 'fixed';
      toastContainer.style.bottom = '80px';
      toastContainer.style.left = '50%';
      toastContainer.style.transform = 'translateX(-50%)';
      toastContainer.style.zIndex = '1000';
      toastContainer.style.width = '80%';
      toastContainer.style.maxWidth = '300px';
      document.body.appendChild(toastContainer);
    }

    // Create toast
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.style.backgroundColor = type === 'error' ? 'rgba(220, 53, 69, 0.9)' : 'rgba(40, 167, 69, 0.9)';
    toast.style.color = 'white';
    toast.style.padding = '12px 16px';
    toast.style.marginBottom = '10px';
    toast.style.borderRadius = '4px';
    toast.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
    toast.style.transition = 'opacity 0.3s ease-in-out';
    toast.style.opacity = '0';
    toast.textContent = message;

    // Add to container
    toastContainer.appendChild(toast);

    // Trigger reflow to enable animation
    toast.offsetHeight;
    toast.style.opacity = '1';

    // Vibration for errors on mobile
    if (type === 'error' && window.navigator.vibrate) {
      window.navigator.vibrate([100, 50, 100]); // Error pattern
    }

    // Remove after delay
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.addEventListener('transitionend', () => {
        if (toast.parentNode) {
          toastContainer.removeChild(toast);
        }

        // Remove container if empty
        if (toastContainer.children.length === 0) {
          document.body.removeChild(toastContainer);
        }
      });
    }, 3000);
  }

  /**
   * Escape HTML to prevent XSS
   * @param {string} unsafe - Potentially unsafe HTML string
   * @returns {string} Escaped safe string
   */
  escapeHtml(unsafe) {
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  /**
   * Set callback for when a user creates a room
   * @param {Function} callback - Function to call
   */
  setCreateRoomCallback(callback) {
    this.onCreateRoom = callback;
  }

  /**
   * Set callback for when a user joins a room
   * @param {Function} callback - Function to call with room code
   */
  setJoinRoomCallback(callback) {
    this.onJoinRoom = callback;
  }


  /**
   * Set callback for when a user sends a chat message
   * @param {Function} callback - Function to call with room code and message
   */
  setSendChatMessageCallback(callback) {
    this.onSendChatMessage = callback;
  }

  // Add this to the UI class methods
  setRefreshModelsCallback(callback) {
    this.onRefreshModels = callback;
  }
}

export { UI };