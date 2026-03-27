const express = require('express');
const http = require('http');
const bcrypt = require('bcryptjs');
const socketio = require('socket.io');
const cors = require('cors');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketio(server);

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const users = {};        // username -> { passwordHash }
const onlineUsers = {};  // username -> socket.id

// Registration endpoint
app.post('/register', async (req, res) => {
  const { username, password } = req.body;
  if (users[username]) return res.status(409).json({ message: 'Username exists' });
  users[username] = { passwordHash: await bcrypt.hash(password, 10) };
  res.json({ success: true });
});

// Login endpoint
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const user = users[username];
  if (!user) return res.status(404).json({ message: 'Not found' });
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return res.status(401).json({ message: 'Invalid credentials' });
  res.json({ success: true });
});

// Get users list
app.get('/users', (req, res) => {
  res.json({ users: Object.keys(users) });
});

io.on('connection', socket => {
  socket.on('login', username => {
    onlineUsers[username] = socket.id;
    socket.username = username;
    io.emit('online-users', Object.keys(onlineUsers));
  });

  socket.on('call-user', ({ target, offer }) => {
    const sid = onlineUsers[target];
    if (sid) io.to(sid).emit('call-made', { offer, from: socket.username });
  });

  socket.on('make-answer', ({ target, answer }) => {
    const sid = onlineUsers[target];
    if (sid) io.to(sid).emit('answer-made', { answer, from: socket.username });
  });

  socket.on('ice-candidate', ({ target, candidate }) => {
    const sid = onlineUsers[target];
    if (sid) io.to(sid).emit('ice-candidate', { candidate, from: socket.username });
  });

  socket.on('disconnect', () => {
    if (socket.username) delete onlineUsers[socket.username];
    io.emit('online-users', Object.keys(onlineUsers));
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));