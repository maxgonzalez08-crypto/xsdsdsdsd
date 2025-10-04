
-- Complete database schema fix for FinanQuest
-- Drop existing tables to recreate with proper structure
DROP TABLE IF EXISTS user_progress CASCADE;
DROP TABLE IF EXISTS class_members CASCADE;
DROP TABLE IF EXISTS challenges CASCADE;
DROP TABLE IF EXISTS quizzes CASCADE;
DROP TABLE IF EXISTS classes CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Users table
CREATE TABLE users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Classes table
CREATE TABLE classes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    owner_username TEXT NOT NULL,
    class_code VARCHAR(20) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Class members table
CREATE TABLE class_members (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
    username TEXT NOT NULL,
    role TEXT DEFAULT 'student' CHECK (role IN ('admin', 'student')),
    joined_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(class_id, username)
);

-- User progress table
CREATE TABLE user_progress (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
    username TEXT NOT NULL,
    xp INTEGER DEFAULT 0,
    challenges_completed INTEGER DEFAULT 0,
    quizzes_completed INTEGER DEFAULT 0,
    challenge_progress JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(class_id, username)
);

-- Quizzes table
CREATE TABLE quizzes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    questions JSONB NOT NULL,
    completed_by TEXT[] DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW()
);

-- Challenges table
CREATE TABLE challenges (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    completed_by TEXT[] DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_classes_class_code ON classes(class_code);
CREATE INDEX IF NOT EXISTS idx_classes_name ON classes(name);
CREATE INDEX IF NOT EXISTS idx_classes_owner_username ON classes(owner_username);
CREATE INDEX IF NOT EXISTS idx_class_members_class_id ON class_members(class_id);
CREATE INDEX IF NOT EXISTS idx_class_members_username ON class_members(username);
CREATE INDEX IF NOT EXISTS idx_class_members_role ON class_members(role);
CREATE INDEX IF NOT EXISTS idx_user_progress_class_id ON user_progress(class_id);
CREATE INDEX IF NOT EXISTS idx_user_progress_username ON user_progress(username);
CREATE INDEX IF NOT EXISTS idx_user_progress_xp ON user_progress(xp);
CREATE INDEX IF NOT EXISTS idx_quizzes_class_id ON quizzes(class_id);
CREATE INDEX IF NOT EXISTS idx_challenges_class_id ON challenges(class_id);

-- Create a view for leaderboard data (students only)
CREATE OR REPLACE VIEW class_leaderboard AS
SELECT 
    up.class_id,
    up.username,
    up.xp,
    up.challenges_completed,
    up.quizzes_completed,
    cm.role,
    cm.joined_at
FROM user_progress up
JOIN class_members cm ON up.class_id = cm.class_id AND up.username = cm.username
WHERE cm.role = 'student'
ORDER BY up.xp DESC;

-- Trigger to automatically add class creator as admin
CREATE OR REPLACE FUNCTION add_class_creator_as_admin()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO class_members (class_id, username, role)
    VALUES (NEW.id, NEW.owner_username, 'admin');
    
    INSERT INTO user_progress (class_id, username, xp, challenges_completed, quizzes_completed)
    VALUES (NEW.id, NEW.owner_username, 0, 0, 0);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_add_class_creator
    AFTER INSERT ON classes
    FOR EACH ROW
    EXECUTE FUNCTION add_class_creator_as_admin();

-- Function to update user progress timestamp
CREATE OR REPLACE FUNCTION update_user_progress_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_user_progress_timestamp
    BEFORE UPDATE ON user_progress
    FOR EACH ROW
    EXECUTE FUNCTION update_user_progress_timestamp();

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE quizzes ENABLE ROW LEVEL SECURITY;

-- Create permissive policies for all tables (allow all operations)
-- These policies allow the application to function properly
DROP POLICY IF EXISTS "Enable all operations for users" ON users;
DROP POLICY IF EXISTS "Enable all operations for classes" ON classes;
DROP POLICY IF EXISTS "Enable all operations for class_members" ON class_members;
DROP POLICY IF EXISTS "Enable all operations for user_progress" ON user_progress;
DROP POLICY IF EXISTS "Enable all operations for challenges" ON challenges;
DROP POLICY IF EXISTS "Enable all operations for quizzes" ON quizzes;

CREATE POLICY "Enable all operations for users" ON users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all operations for classes" ON classes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all operations for class_members" ON class_members FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all operations for user_progress" ON user_progress FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all operations for challenges" ON challenges FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all operations for quizzes" ON quizzes FOR ALL USING (true) WITH CHECK (true);
