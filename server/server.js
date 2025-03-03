const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const { Server } = require('socket.io');
const RoomManager = require('./RoomManager');

// Initialize Express app
const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve static files from public directory
app.use(express.static(path.join(__dirname, '../public')));

// Initialize room manager
const roomManager = new RoomManager();

// Add this to server.js after your other routes
app.get('/api/models', (req, res) => {
  const modelsDir = path.join(__dirname, '../public/models');

  // Read all files in the models directory
  fs.readdir(modelsDir, (err, files) => {
    if (err) {
      console.error('Error reading models directory:', err);
      return res.status(500).json({ error: 'Failed to read models directory' });
    }

    // Filter for .glb files and remove extension
    const modelFiles = files
      .filter(file => file.endsWith('.glb'))
      .map(file => file.replace('.glb', ''));

    res.json({ models: modelFiles });
  });
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  // Handle room creation
  socket.on('createRoom', () => {
    const roomCode = roomManager.createRoom(socket.id);
    socket.join(roomCode);
    socket.emit('roomCreated', roomCode);
    console.log(`Room created: ${roomCode} by ${socket.id}`);
  });

  // Handle room joining
  socket.on('joinRoom', (roomCode) => {
    const joinResult = roomManager.joinRoom(roomCode, socket.id);

    if (joinResult.success) {
      socket.join(roomCode);
      socket.emit('roomJoined', { roomCode, state: joinResult.state });
      socket.to(roomCode).emit('userJoined', socket.id);
      console.log(`User ${socket.id} joined room ${roomCode}`);
    } else {
      socket.emit('roomError', joinResult.error);
    }
  });

  // Handle hex interaction
  socket.on('hexClicked', (data) => {
    const { roomCode, hexId, action } = data;
    if (roomManager.updateHexState(roomCode, hexId, action)) {
      io.to(roomCode).emit('hexUpdated', { hexId, action });
    }
  });

  // Handle chat messages
  socket.on('chatMessage', (data) => {
    const { roomCode, message } = data;
    io.to(roomCode).emit('chatMessage', {
      userId: socket.id,
      message,
      timestamp: Date.now()
    });
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    const roomsLeft = roomManager.removeUserFromRooms(socket.id);
    roomsLeft.forEach(roomCode => {
      socket.to(roomCode).emit('userLeft', socket.id);
    });
    console.log('User disconnected:', socket.id);
  });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});