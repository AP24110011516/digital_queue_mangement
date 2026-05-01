# Digital Queue Management System

A full-stack web application built with the MERN stack (MongoDB, Express, React, Node.js) and Socket.IO for real-time queue synchronization.

## Features

- **Role-based Access Control**: Customer, Agent, Admin roles using JWT.
- **Real-time Queue Updates**: Socket.IO handles events for generating tokens, calling next customers, and updating active queues instantly.
- **Admin Management**: Admins can create service counters and assign available agents to them. They can also view analytics.
- **Queue Tokens**: Auto-generated sequential tokens with estimated wait time.

## Requirements

- Node.js
- MongoDB running locally on port 27017 or a valid MongoDB Atlas URI

## Setup Instructions

### 1. Backend Setup

Open a terminal and navigate to the `backend` directory:
```bash
cd backend
npm install
```

By default it connects to `mongodb://localhost:27017/queue_management` and runs on port `5000`. Setup a `.env` file if you wish to override:
```env
MONGO_URI=your_mongo_db_string
JWT_SECRET=supersecret
PORT=5000
```

Start the backend (Dev Mode):
```bash
npm run dev
```
(If `npm run dev` doesn't work, ensure you installed `nodemon` via `npm install --save-dev nodemon` and added the script to package.json, or just run `node server.js`).

### 2. Frontend Setup

Open another terminal and navigate to the `frontend` directory:
```bash
cd frontend
npm install
```

Start the frontend:
```bash
npm run dev
```

### 3. Usage Flow

1. **Admin Login/Register**: Create an account and select "Admin" role (for development, the register page allows role selection).
2. **Dashboard Setup**: In Admin dashboard, create a Service Counter. 
3. **Agent Registration**: Create an account with the "Agent" role.
4. **Assign Agent**: Back in Admin dashboard, assign the Agent you just created to the Service Counter.
5. **Customer Join**: Create an account with the "Customer" role. Click "Generate Token".
6. **Processing**: The Agent logs in, sees their assigned counter, and clicks "Call Next Customer". The customer sees the status change on their dashboard in real-time.
