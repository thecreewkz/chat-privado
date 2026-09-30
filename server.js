const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// Armazena usuários conectados: { socketId: { username, room } }
const users = new Map();

// Armazena salas privadas: { roomName: [socketId1, socketId2] }
const privateRooms = new Map();

app.use(express.static(path.join(__dirname, 'public')));

io.on('connection', (socket) => {
  console.log(`Usuário conectado: ${socket.id}`);

  // Registrar usuário
  socket.on('register', (username) => {
    users.set(socket.id, { username, room: null });
    socket.emit('registered', { socketId: socket.id, username });
    io.emit('userList', getUserList());
    console.log(`${username} registrou-se`);
  });

  // Criar sala privada
  socket.on('createRoom', (data) => {
    const { roomName, targetUsername } = data;
    const user = users.get(socket.id);
    if (!user) return;

    // Verificar se o usuário alvo existe
    const targetEntry = Array.from(users.entries()).find(
      ([_, u]) => u.username === targetUsername
    );

    if (!targetEntry) {
      socket.emit('error', { message: `Usuário "${targetUsername}" não encontrado` });
      return;
    }

    const [targetSocketId] = targetEntry;

    // Criar sala única (ordenada para consistência)
    const roomId = [socket.id, targetSocketId].sort().join('-');

    // Entrar na sala
    socket.join(roomId);
    users.get(socket.id).room = roomId;

    // Adicionar usuário alvo à sala
    const targetSocket = io.sockets.sockets.get(targetSocketId);
    if (targetSocket) {
      targetSocket.join(roomId);
      users.get(targetSocketId).room = roomId;
    }

    // Registrar sala
    if (!privateRooms.has(roomId)) {
      privateRooms.set(roomId, [socket.id, targetSocketId]);
    }

    // Notificar ambos
    io.to(roomId).emit('roomCreated', {
      roomId,
      participants: [
        { socketId: socket.id, username: user.username },
        { socketId: targetSocketId, username: targetUsername }
      ]
    });

    console.log(`Sala privada criada: ${roomId} entre ${user.username} e ${targetUsername}`);
  });

  // Enviar mensagem privada
  socket.on('privateMessage', (data) => {
    const { roomId, message } = data;
    const user = users.get(socket.id);
    if (!user) return;

    const messageData = {
      roomId,
      sender: user.username,
      senderId: socket.id,
      message,
      timestamp: new Date().toISOString()
    };

    io.to(roomId).emit('privateMessage', messageData);
    console.log(`Mensagem em ${roomId}: ${user.username}: ${message}`);
  });

  // Digitação
  socket.on('typing', (data) => {
    const { roomId, isTyping } = data;
    const user = users.get(socket.id);
    if (!user) return;

    socket.to(roomId).emit('typing', {
      username: user.username,
      isTyping
    });
  });

  // Desconexão
  socket.on('disconnect', () => {
    const user = users.get(socket.id);
    if (user) {
      // Notificar sala se estava em uma
      if (user.room) {
        socket.to(user.room).emit('userLeft', {
          username: user.username,
          socketId: socket.id
        });
      }
      users.delete(socket.id);
      io.emit('userList', getUserList());
      console.log(`${user.username} desconectou`);
    }
  });
});

function getUserList() {
  return Array.from(users.entries()).map(([socketId, data]) => ({
    socketId,
    username: data.username
  }));
}

server.listen(PORT, () => {
  console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
});
