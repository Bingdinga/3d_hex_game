/**
 * Socket class handles real-time communication with the server
 */
class SocketManager {
    constructor() {
      // Initialize the socket connection
      this.socket = io();
      this.isConnected = false;
      
      // Event callbacks
      this.onConnect = null;
      this.onDisconnect = null;
      this.onRoomCreated = null;
      this.onRoomJoined = null;
      this.onRoomError = null;
      this.onUserJoined = null;
      this.onUserLeft = null;
      this.onHexUpdated = null;
      this.onChatMessage = null;
      
      // Initialize event listeners
      this.initEventListeners();
    }
    
    /**
     * Set up socket event listeners
     */
    initEventListeners() {
      // Connection events
      this.socket.on('connect', () => {
        console.log('Connected to server');
        this.isConnected = true;
        if (this.onConnect) this.onConnect();
      });
      
      this.socket.on('disconnect', () => {
        console.log('Disconnected from server');
        this.isConnected = false;
        if (this.onDisconnect) this.onDisconnect();
      });
      
      // Room events
      this.socket.on('roomCreated', (roomCode) => {
        console.log(`Room created: ${roomCode}`);
        if (this.onRoomCreated) this.onRoomCreated(roomCode);
      });
      
      this.socket.on('roomJoined', (data) => {
        console.log(`Joined room: ${data.roomCode}`);
        if (this.onRoomJoined) this.onRoomJoined(data.roomCode, data.state);
      });
      
      this.socket.on('roomError', (error) => {
        console.error('Room error:', error);
        if (this.onRoomError) this.onRoomError(error);
      });
      
      // User events
      this.socket.on('userJoined', (userId) => {
        console.log(`User joined: ${userId}`);
        if (this.onUserJoined) this.onUserJoined(userId);
      });
      
      this.socket.on('userLeft', (userId) => {
        console.log(`User left: ${userId}`);
        if (this.onUserLeft) this.onUserLeft(userId);
      });
      
      // Game state events
      this.socket.on('hexUpdated', (data) => {
        // console.log(`Hex updated: ${data.hexId}`, data.action);
        if (this.onHexUpdated) this.onHexUpdated(data.hexId, data.action);
      });
      
      // Chat events
      this.socket.on('chatMessage', (data) => {
        console.log(`Chat message from ${data.userId}: ${data.message}`);
        if (this.onChatMessage) this.onChatMessage(data.userId, data.message, data.timestamp);
      });
    }
    
    /**
     * Create a new room
     */
    createRoom() {
      if (this.isConnected) {
        this.socket.emit('createRoom');
      } else {
        console.error('Cannot create room: not connected to server');
      }
    }
    
    /**
     * Join an existing room
     * @param {string} roomCode - Code of the room to join
     */
    joinRoom(roomCode) {
      if (this.isConnected) {
        this.socket.emit('joinRoom', roomCode);
      } else {
        console.error('Cannot join room: not connected to server');
      }
    }
    
    /**
     * Send a hex interaction to the server
     * @param {string} roomCode - Room code
     * @param {string} hexId - ID of the interacted hex
     * @param {Object} action - Action data
     */
    sendHexAction(roomCode, hexId, action) {
      if (this.isConnected) {
        this.socket.emit('hexClicked', { roomCode, hexId, action });
      } else {
        console.error('Cannot send hex action: not connected to server');
      }
    }
    
    /**
     * Send a chat message
     * @param {string} roomCode - Room code
     * @param {string} message - Message content
     */
    sendChatMessage(roomCode, message) {
      if (this.isConnected) {
        this.socket.emit('chatMessage', { roomCode, message });
      } else {
        console.error('Cannot send message: not connected to server');
      }
    }
    
    // Event registration methods
    setConnectCallback(callback) {
      this.onConnect = callback;
    }
    
    setDisconnectCallback(callback) {
      this.onDisconnect = callback;
    }
    
    setRoomCreatedCallback(callback) {
      this.onRoomCreated = callback;
    }
    
    setRoomJoinedCallback(callback) {
      this.onRoomJoined = callback;
    }
    
    setRoomErrorCallback(callback) {
      this.onRoomError = callback;
    }
    
    setUserJoinedCallback(callback) {
      this.onUserJoined = callback;
    }
    
    setUserLeftCallback(callback) {
      this.onUserLeft = callback;
    }
    
    setHexUpdatedCallback(callback) {
      this.onHexUpdated = callback;
    }
    
    setChatMessageCallback(callback) {
      this.onChatMessage = callback;
    }
  }

  export { SocketManager };