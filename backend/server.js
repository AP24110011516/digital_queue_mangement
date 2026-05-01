const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const http = require('http');
const { Server } = require('socket.io');
const { expireStaleTokens } = require('./services/queueService');

dotenv.config();

const app = express();
const allowedOrigins = [
  process.env.CLIENT_URL || 'http://localhost:5173',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'http://127.0.0.1:5175',
];
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
});

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));
app.use(express.json());

app.set('io', io);

mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/queue_management')
  .then(() => console.log('MongoDB Connected'))
  .catch(err => console.log('MongoDB Connection Error: ', err));

io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  socket.on('register_session', ({ userId, role }) => {
    if (role) {
      socket.join(`role:${role}`);
    }

    if (userId) {
      socket.join(`user:${userId}`);
    }

    console.log(`Socket ${socket.id} joined realtime rooms for ${role || 'guest'}:${userId || 'anonymous'}`);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

const authRoutes = require('./routes/authRoutes');
const queueRoutes = require('./routes/queueRoutes');
const adminRoutes = require('./routes/adminRoutes');
const staffRoutes = require('./routes/staffRoutes');

app.use('/api/auth', authRoutes);
app.use('/api/queue', queueRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/staff', staffRoutes);

app.get('/', (req, res) => {
  res.send('Digital Queue Management API is running...');
});

// Auto-expiry sweep disabled — counter staff controls completion manually
// setInterval(() => expireStaleTokens(io), 30_000);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
 
