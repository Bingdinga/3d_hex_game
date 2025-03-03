const { v4: uuidv4 } = require('uuid');

class RoomManager {
  constructor() {
    this.rooms = {}; // Maps room codes to room state
    this.userRooms = {}; // Maps user IDs to room codes they're in
  }

  // Generate a unique room code
  generateRoomCode() {
    // Create a simple 6-character alphanumeric code
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }

  // Create a new room
  createRoom(userId) {
    const roomCode = this.generateRoomCode();
    
    this.rooms[roomCode] = {
      host: userId,
      users: [userId],
      hexState: {}, // Will store the state of each hex
      createdAt: Date.now()
    };
    
    // Associate the user with this room
    if (!this.userRooms[userId]) {
      this.userRooms[userId] = [];
    }
    this.userRooms[userId].push(roomCode);
    
    return roomCode;
  }

  // Add a user to an existing room
  joinRoom(roomCode, userId) {
    // Check if room exists
    if (!this.rooms[roomCode]) {
      return { success: false, error: 'Room not found' };
    }
    
    // Add user to room
    this.rooms[roomCode].users.push(userId);
    
    // Associate the user with this room
    if (!this.userRooms[userId]) {
      this.userRooms[userId] = [];
    }
    this.userRooms[userId].push(roomCode);
    
    return { 
      success: true, 
      state: this.rooms[roomCode].hexState 
    };
  }

  // Update the state of a hex in a room
  updateHexState(roomCode, hexId, action) {
    if (!this.rooms[roomCode]) return false;
    
    this.rooms[roomCode].hexState[hexId] = {
      ...this.rooms[roomCode].hexState[hexId],
      ...action,
      lastUpdated: Date.now()
    };
    
    return true;
  }

  // Remove a user from all rooms they're in
  removeUserFromRooms(userId) {
    const roomsLeft = [];
    
    if (this.userRooms[userId]) {
      for (const roomCode of this.userRooms[userId]) {
        const room = this.rooms[roomCode];
        
        if (room) {
          // Remove user from room
          room.users = room.users.filter(id => id !== userId);
          roomsLeft.push(roomCode);
          
          // If room is empty, clean it up
          if (room.users.length === 0) {
            delete this.rooms[roomCode];
          }
        }
      }
      
      delete this.userRooms[userId];
    }
    
    return roomsLeft;
  }

  // Get room details
  getRoomState(roomCode) {
    return this.rooms[roomCode] || null;
  }
}

module.exports = RoomManager;