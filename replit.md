# Overview

FinanQuest is a gamified financial education static web application built with Vite. The application provides interactive financial learning through quizzes, challenges, expense tracking, and an AI assistant. Users can join classes, compete on leaderboards, earn XP, and receive personalized financial advice. The platform supports multiple languages (English, Spanish, Catalan) and includes comprehensive user management and progress tracking. The app now runs entirely as a static site with no backend required.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Framework**: Vite-powered vanilla JavaScript application with hot module reloading
- **Build Tool**: Vite configured to serve frontend on port 5000 with API proxy to port 3001
- **Module System**: ES6 modules with separate files for different concerns (supabase.js, translations.js, script.js)
- **UI Components**: Modal-based interface with responsive design, Font Awesome icons, and Chart.js for data visualization
- **Language System**: Multi-language support with dynamic translation system supporting English, Spanish, and Catalan

## API Architecture
- **Development Server**: Express server on port 3001 for local development (dev-server.js)
- **Serverless Functions**: Vercel serverless functions in /api directory for production
- **API Proxy**: Vite proxies /api requests to development server during local development
- **Secure Communication**: API key stored server-side only, never exposed to frontend

## Data Storage Solutions
- **Primary Database**: Supabase (PostgreSQL) for user data, classes, challenges, quizzes, and expense tracking
- **Local Storage**: Browser localStorage for user session data, group information, and application state
- **Real-time Updates**: Supabase real-time subscriptions for live class updates and leaderboard changes
- **Data Models**: Users, classes, challenges, quizzes, expenses, and user progress tracking

## Authentication and Authorization
- **Custom Authentication**: Username/password system implemented through Supabase
- **Session Management**: Local storage-based session handling
- **Role-based Access**: Teacher and student roles with different permissions for class management
- **Data Privacy**: User-specific data isolation with secure API endpoints

## AI Integration Architecture (Serverless)
- **AI Provider**: Groq API (fetch-based) for language model interactions using `llama-3.1-8b-instant`
- **Implementation**: Direct REST API calls using native fetch (no SDK dependency)
- **Server-side Processing**: All AI requests handled through serverless API endpoint (/api/ask-ai)
- **API Key Security**: Groq API key stored as environment variable (GROQ_API_KEY) on server only
- **Frontend Integration**: Client sends POST requests to /api/ask-ai with question, financialData, and language
- **Personal Data Integration**: Financial data sent to API for personalized recommendations
- **Multi-language Support**: AI responses provided in English, Spanish, or Catalan based on user preference
- **Error Handling**: Comprehensive error handling with user-friendly error messages
- **Vercel Compatibility**: Uses fetch-based approach for full Vercel serverless function support
- **Deployment**: Works on both Replit (dev-server.js) and Vercel (api/ask-ai.js)

# External Dependencies

## AI Services
- **Groq API**: Primary AI service for generating financial advice and answering user questions
- **API Key Management**: Server-side environment variable storage for secure key handling

## Database Services
- **Supabase**: PostgreSQL database with real-time capabilities
- **Supabase Auth**: User authentication and session management
- **Real-time Subscriptions**: Live updates for collaborative features

## Frontend Libraries
- **Chart.js**: Data visualization for expense and income charts
- **Font Awesome**: Icon library for UI elements
- **Vite**: Build tool and development server with hot module reloading

## Dependencies
- **Express**: Development API server for local testing
- **@supabase/supabase-js**: Database client library
- **Vite**: Build tool and development server
- **Native Fetch**: Used for Groq API calls (no SDK required)

## Development and Deployment

### Local Development (Replit)
- **Frontend**: `npm run dev` - Vite server on port 5000
- **API Server**: `npm run api` - Express server on port 3001
- **Environment Variables**: GROQ_API_KEY from Replit secrets
- **API Proxy**: Vite proxies /api requests to localhost:3001

### Production Deployment (Vercel)
- **Static Files**: Built with `npm run build`
- **Serverless Functions**: /api/ask-ai.js deployed as Vercel function
- **Environment Variables**: GROQ_API_KEY configured in Vercel dashboard
- **Configuration**: vercel.json handles routing and function deployment