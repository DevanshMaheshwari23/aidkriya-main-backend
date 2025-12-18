# aidKRIYA Walker - Backend API

RESTful API for aidKRIYA Walker - A peer-to-peer walking companion marketplace.

## Features

- 🔐 JWT-based Authentication
- 👤 User Profile Management
- 🚶 Walk Request System
- 🤝 Walker Matching Algorithm
- 📍 Real-time GPS Tracking
- 💳 Razorpay Payment Integration
- ⭐ Rating & Review System
- 💰 Digital Wallet System

## Tech Stack

- **Runtime:** Node.js
- **Framework:** Express.js
- **Database:** MongoDB
- **Authentication:** JWT
- **Payment:** Razorpay
- **SMS:** Twilio

## Prerequisites

- Node.js (v14 or higher)
- MongoDB (v4.4 or higher)
- Razorpay Account
- Twilio Account (for OTP)

## Installation

1. Clone the repository
git clone <repository-url>
cd aidkriya-walker-backend

text

2. Install dependencies
npm install

text

3. Create `.env` file
cp .env.example .env

text

4. Update environment variables in `.env`

5. Start the server
Development
npm run dev

Production
npm start

text

## API Endpoints

### Authentication
- `POST /api/auth/signup` - Register new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/verify-otp` - Verify OTP
- `POST /api/auth/resend-otp` - Resend OTP
- `GET /api/auth/me` - Get current user
- `POST /api/auth/logout` - Logout user

### Profile
- `GET /api/profile/:userId` - Get user profile
- `PUT /api/profile/setup` - Setup/Update profile
- `POST /api/profile/verification` - Upload verification docs
- `PUT /api/profile/availability` - Update walker availability

### Walk Request
- `POST /api/walk-request/create` - Create walk request
- `GET /api/walk-request/:requestId` - Get walk request
- `PUT /api/walk-request/:requestId/cancel` - Cancel walk request
- `GET /api/walk-request/history/:userId` - Get walk history

### Matching
- `POST /api/matching/find-walkers` - Find available walkers
- `POST /api/matching/accept` - Accept walk request
- `POST /api/matching/reject` - Reject walk request
- `GET /api/matching/pending-requests/:walkerId` - Get pending requests

### Tracking
- `POST /api/tracking/start` - Start walk session
- `POST /api/tracking/update-location` - Update GPS location
- `POST /api/tracking/end` - End walk session
- `GET /api/tracking/session/:sessionId` - Get session details
- `POST /api/tracking/sos-alert` - Send SOS alert

### Payment
- `POST /api/payment/create-order` - Create payment order
- `POST /api/payment/verify` - Verify payment
- `GET /api/payment/transactions/:userId` - Get transaction history
- `GET /api/payment/wallet/:userId` - Get wallet balance

### Rating
- `POST /api/rating/submit` - Submit rating
- `GET /api/rating/user/:userId` - Get user ratings
- `GET /api/rating/average/:userId` - Get average rating

## Environment Variables

PORT=3000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/aidkriya-walker
JWT_SECRET=your-secret-key
RAZORPAY_KEY_ID=your-razorpay-key
RAZORPAY_KEY_SECRET=your-razorpay-secret
TWILIO_ACCOUNT_SID=your-twilio-sid
TWILIO_AUTH_TOKEN=your-twilio-token

text

## Testing

Use Postman or any API client to test endpoints.

Import the Postman collection from `/postman` directory.

## Deployment

### Deploy to Railway
railway login
railway init
railway up

text

### Deploy to Render
1. Connect GitHub repository
2. Set environment variables
3. Deploy

## License

MIT# aidkriya-main-backend
