const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const connectDB = require('./config/database');
const { errorHandler, notFound } = require('./middleware/errorHandler');

// Load environment variables
dotenv.config();

// Connect to database
connectDB();

// Initialize Express app
const app = express();

// Security middleware
app.use(helmet());

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
}));

// Body parser middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging middleware (only in development)
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Health check route
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'aidKRIYA Walker API is running',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      profile: '/api/profile',
      walkRequest: '/api/walk-request',
      matching: '/api/matching',
      tracking: '/api/tracking',
      payment: '/api/payment',
      rating: '/api/rating',
      feedback: '/api/feedback'
    }
  });
});

// API Routes (versioned under /api)
app.use('/api/auth', require('./routes/auth'));
app.use('/api/profile', require('./routes/profile'));
app.use('/api/walk-request', require('./routes/walkRequest'));
app.use('/api/matching', require('./routes/matching'));
app.use('/api/subscription', require('./routes/subscription'));
app.use('/api/tracking', require('./routes/tracking'));
app.use('/api/payment', require('./routes/payment'));
app.use('/api/rating', require('./routes/rating'));
app.use('/api/feedback', require('./routes/feedback'));
app.use('/api/notifications', require('./routes/notification'));

// Convenience aliases without /api prefix to support existing Flutter calls
// e.g. Flutter hitting /auth/login instead of /api/auth/login
app.use('/auth', require('./routes/auth'));
app.use('/profile', require('./routes/profile'));
app.use('/walk-request', require('./routes/walkRequest'));
app.use('/matching', require('./routes/matching'));
app.use('/tracking', require('./routes/tracking'));
app.use('/payment', require('./routes/payment'));
app.use('/rating', require('./routes/rating'));
app.use('/feedback', require('./routes/feedback'));
app.use('/notifications', require('./routes/notification'));

// Error handlers (must be last)
app.use(notFound);
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  console.log(`
  ╔═══════════════════════════════════════════════════╗
  ║   🚀 aidKRIYA Walker API Server Running          ║
  ║   📍 Port: ${PORT}                                     ║
  ║   🌍 Environment: ${process.env.NODE_ENV || 'development'}              ║
  ║   📊 Database: Connected                         ║
  ╚═══════════════════════════════════════════════════╝
  `);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('❌ Unhandled Rejection:', err.message);
  server.close(() => process.exit(1));
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err.message);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('👋 SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('✅ HTTP server closed');
  });
});
// WebSocket setup for live tracking
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

const io = new Server(server, {
  cors: { 
    origin: process.env.FRONTEND_URL || '*', 
    methods: ['GET', 'POST'] 
  }
});

// Socket authentication middleware
io.use((socket, next) => {
  const token = socket.handshake.auth?.token || socket.handshake.query?.token;
  if (!token) return next(new Error('NO_TOKEN'));
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.id;
    next();
  } catch (e) {
    next(new Error('INVALID_TOKEN'));
  }
});

io.on('connection', (socket) => {
  console.log('User connected:', socket.userId);
  
  // Join tracking session room
  socket.on('tracking:join', ({ sessionId }) => {
    socket.join(`session:${sessionId}`);
    console.log(`User ${socket.userId} joined session ${sessionId}`);
  });
  
  // Broadcast location updates
  socket.on('tracking:location', async ({ sessionId, location }) => {
    const WalkSession = require('./models/WalkSession');
    
    const session = await WalkSession.findById(sessionId);
    if (!session || session.status !== 'ACTIVE') return;
    
    // Update session route and distance
    session.route = session.route || [];
    session.route.push({
      latitude: location.latitude,
      longitude: location.longitude,
      timestamp: new Date(location.timestamp)
    });
    
    await session.save();
    
    // Broadcast to partner
    io.to(`session:${sessionId}`).emit('tracking:partner-location', {
      location,
      sessionId
    });
  });
  
  // Handle SOS alerts
  socket.on('tracking:sos', async ({ sessionId, location, reason }) => {
    const WalkSession = require('./models/WalkSession');
    
    const session = await WalkSession.findById(sessionId);
    if (!session) return;
    
    session.sosTriggered = true;
    session.sosTimestamp = new Date();
    session.sosLocation = { 
      latitude: location?.latitude, 
      longitude: location?.longitude 
    };
    await session.save();
    
    // Broadcast SOS to both users
    io.to(`session:${sessionId}`).emit('tracking:sos', { 
      sessionId, 
      location, 
      reason, 
      timestamp: session.sosTimestamp 
    });
  });
  
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.userId);
  });
});

module.exports = server;
