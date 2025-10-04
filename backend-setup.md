
# Backend Setup for AI Assistant

## Environment Variables

The backend requires several environment variables. Set these up in Replit Secrets:

### Required for AI Features:
1. Go to the "Secrets" tab in your Repl (lock icon in the sidebar)
2. Add a new secret:
   - **Key:** `GROQ_API_KEY`
   - **Value:** Your Groq API key (get one from https://console.groq.com/keys)

### Required for User Data Storage:
3. Add Supabase secrets:
   - **Key:** `SUPABASE_URL`
   - **Value:** Your Supabase project URL
   - **Key:** `SUPABASE_SERVICE_ROLE_KEY`
   - **Value:** Your Supabase service role key

## Database Setup

1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Run the SQL commands from `supabase_schema.sql` to create the expenses table

## Running the Application

### Development (Both Frontend and Backend)
- Click the **Run** button to start both the frontend (Vite) and backend (Node.js) simultaneously
- Frontend will be available at the main Repl URL
- Backend API will be available at the same URL with `/api/` endpoints

### Backend Only
- Use the "Start Backend" workflow to run only the backend server
- Backend will run on port 5000

## API Endpoints

- `POST /api/ask-ai` - Send questions to the AI assistant (with optional user data integration)
- `POST /api/expenses` - Save user expenses to database
- `GET /api/expenses/:userId` - Retrieve user expenses from database
- `GET /api/health` - Health check endpoint

## How Personal Data Integration Works

1. **Personal Questions**: When users ask questions about "my spending" or "my expenses", the backend:
   - Detects it's a personal question using keywords
   - Fetches the user's expense data from Supabase
   - Summarizes the data and includes it in the AI prompt
   - Returns personalized advice based on actual spending patterns

2. **General Questions**: For general financial questions, the AI responds without accessing personal data.

## Deployment

When deploying on Replit:
1. Make sure all required secrets are set
2. The deployment will automatically handle both frontend and backend
3. Users get personalized financial advice based on their actual spending data

## Security

- API keys are stored securely on the server
- User data is protected by Supabase Row Level Security
- Frontend never has direct access to API keys or other users' data
- All AI requests go through the backend for security
