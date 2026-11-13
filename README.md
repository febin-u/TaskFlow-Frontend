# TaskFlow --- Personal Productivity & Task Management

TaskFlow is a full-stack task management application that helps users
organise goals into missions, track deadlines, and monitor productivity.

## Live application

-   **Frontend:** https://taskflow-frontend-r402.onrender.com
-   **Backend API:** https://taskflow-backend-g7s2.onrender.com

A free Render instance may take a little time to wake after inactivity.

## Features

-   User registration and login with JWT authentication
-   Create, edit, complete, and delete personal tasks
-   Dashboard with total, active, and completed mission counts
-   Automatic progress percentage
-   Calendar view for due dates and upcoming missions
-   Activity history, profile, and settings
-   Dark and light themes
-   Responsive desktop and mobile interface

## Technology stack

-   **Frontend:** React, JavaScript, React Router, Vite, CSS
-   **Backend:** Node.js, Express, MongoDB, Mongoose, JWT, bcryptjs

## Source code

-   [TaskFlow Frontend](https://github.com/febin-u/TaskFlow-Frontend)
-   [TaskFlow Backend](https://github.com/febin-u/TaskFlow-Backend)

## Run locally

### Frontend

``` bash
git clone https://github.com/febin-u/TaskFlow-Frontend.git
cd TaskFlow-Frontend
npm install
npm run dev
```

### Backend

``` bash
git clone https://github.com/febin-u/TaskFlow-Backend.git
cd TaskFlow-Backend
npm install
```

Create a `.env` file in the backend root:

``` env
PORT=5001
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_long_random_secret
```

Start the backend with `npm start`. For development, use `npm run dev`.

When running locally, ensure the frontend API configuration points to
your local backend.

## Security

-   Never commit `.env` files.
-   Never expose database credentials, JWT secrets, or access tokens.
-   Use your own MongoDB connection string and a strong, private JWT
    secret.

## Developer

**Febin U**

A full-stack development project demonstrating frontend development,
REST API design, authentication, database integration, and deployment.
