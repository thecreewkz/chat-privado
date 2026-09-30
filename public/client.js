const socket = io();

// Elementos DOM
const loginScreen = document.getElementById('login-screen');
const chatScreen = document.getElementById('chat-screen');
const usernameInput = document.getElementById('username-input');
const loginBtn = document.getElementById('login-btn');
const userList = document.getElementById('user-list');
const noConversation = document.getElementById('no-conversation');
const conversation = document.getElementById('conversation');
const conversationTitle = document.getElementById('conversation-title');
const messagesContainer = document.getElementById('messages');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const typingIndicator = document.getElementById('typing-indicator');

// Estado
let currentUser = null;
let currentRoom = null;
let currentPartner = null;
let typingTimeout = null;

// Login
loginBtn.addEventListener('click', login);
usernameInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') login();
});

function login() {
  const username = usernameInput.value.trim();
  if (!username) {
    alert('Por favor, digite seu nome');
    return;
  }
  socket.emit('register', username);
}

socket.on('registered', (data) => {
  currentUser = data;
  loginScreen.classList.remove('active');
  chatScreen.classList.add('active');
});

// Lista de usuários
socket.on('userList', (users) => {
  userList.innerHTML = '';
  users.forEach(user => {
    const li = document.createElement('li');
    li.innerHTML = `
      <span class="status-dot"></span>
      <span class="username">${user.username}</span>
    `;
    
    if (user.socketId === currentUser.socketId) {
      li.classList.add('self');
      li.querySelector('.username').textContent += ' (você)';
    } else {
      li.addEventListener('click', () => startConversation(user));
    }
    
    userList.appendChild(li);
  });
});

// Iniciar conversa
function startConversation(targetUser) {
  currentPartner = targetUser;
  socket.emit('createRoom', {
    roomName: `${currentUser.username}-${targetUser.username}`,
    targetUsername: targetUser.username
  });
}

socket.on('roomCreated', (data) => {
  currentRoom = data.roomId;
  const partner = data.participants.find(p => p.socketId !== currentUser.socketId);
  
  conversationTitle.textContent = `Conversa com ${partner.username}`;
  noConversation.classList.add('hidden');
  conversation.classList.remove('hidden');
  messagesContainer.innerHTML = '';
  messageInput.focus();
});

// Enviar mensagem
sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') sendMessage();
});

function sendMessage() {
  const message = messageInput.value.trim();
  if (!message || !currentRoom) return;

  socket.emit('privateMessage', {
    roomId: currentRoom,
    message
  });

  messageInput.value = '';
  socket.emit('typing', { roomId: currentRoom, isTyping: false });
}

// Receber mensagem
socket.on('privateMessage', (data) => {
  const isSent = data.senderId === currentUser.socketId;
  const messageEl = document.createElement('div');
  messageEl.className = `message ${isSent ? 'sent' : 'received'}`;
  
  const time = new Date(data.timestamp).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit'
  });

  messageEl.innerHTML = `
    ${!isSent ? `<div class="sender-name">${data.sender}</div>` : ''}
    <div class="message-text">${escapeHtml(data.message)}</div>
    <div class="message-time">${time}</div>
  `;

  messagesContainer.appendChild(messageEl);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
});

// Indicador de digitação
messageInput.addEventListener('input', () => {
  if (!currentRoom) return;
  
  socket.emit('typing', { roomId: currentRoom, isTyping: true });
  
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    socket.emit('typing', { roomId: currentRoom, isTyping: false });
  }, 1000);
});

socket.on('typing', (data) => {
  if (data.isTyping) {
    typingIndicator.textContent = `${data.username} está digitando...`;
    typingIndicator.classList.remove('hidden');
  } else {
    typingIndicator.classList.add('hidden');
  }
});

// Usuário saiu
socket.on('userLeft', (data) => {
  if (currentRoom) {
    const messageEl = document.createElement('div');
    messageEl.className = 'message received';
    messageEl.innerHTML = `
      <div class="message-text" style="font-style: italic; color: #a0aec0;">
        ${data.username} saiu da conversa
      </div>
    `;
    messagesContainer.appendChild(messageEl);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }
});

// Erros
socket.on('error', (data) => {
  alert(data.message);
});

// Utilitário
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
