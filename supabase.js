
import { CONFIG } from './config.js';

// Supabase configuration and direct API functions
const supabaseUrl = CONFIG.SUPABASE_URL;
const supabaseKey = CONFIG.SUPABASE_KEY;

// Generate a random class code
function generateClassCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// Helper function to make authenticated requests to Supabase
async function supabaseRequest(endpoint, options = {}) {
    const url = `${supabaseUrl}/rest/v1/${endpoint}`;
    const headers = {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        ...options.headers
    };

    const response = await fetch(url, {
        ...options,
        headers
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Supabase API error: ${response.status} - ${error}`);
    }

    return response.json();
}

// User authentication functions
export async function signUpUser(username, password) {
    try {
        // First check if username already exists
        const existingUsers = await supabaseRequest(`users?username=eq.${encodeURIComponent(username)}&select=username`);

        if (existingUsers && existingUsers.length > 0) {
            return { success: false, error: 'Username already taken. Please choose a different username.' };
        }

        // If username doesn't exist, create new user
        const data = await supabaseRequest('users', {
            method: 'POST',
            headers: {
                'Prefer': 'return=representation'
            },
            body: JSON.stringify({
                username,
                password,
                created_at: new Date().toISOString()
            })
        });

        return { success: true, data: data[0] };
    } catch (err) {
        console.error('Error signing up user:', err);
        return { success: false, error: err.message };
    }
}

export async function loginUser(username, password) {
    try {
        const data = await supabaseRequest(`users?username=eq.${encodeURIComponent(username)}&password=eq.${encodeURIComponent(password)}&select=*`);

        if (!data || data.length === 0) {
            return { success: false, error: 'Invalid username or password' };
        }

        return { success: true, data: data[0] };
    } catch (err) {
        console.error('Error logging in user:', err);
        return { success: false, error: 'Invalid username or password' };
    }
}

// Class management functions
export async function createClass(name, password, creatorUsername, customCode = null) {
    try {
        let classCode = customCode;
        let attempts = 0;
        const maxAttempts = 10;

        // Generate a unique class code
        while (!classCode && attempts < maxAttempts) {
            const candidate = generateClassCode();
            const existing = await supabaseRequest(`classes?class_code=eq.${encodeURIComponent(candidate)}&select=class_code`);
            
            if (!existing || existing.length === 0) {
                classCode = candidate;
            }
            attempts++;
        }

        if (!classCode) {
            return { success: false, error: 'Unable to generate unique class code' };
        }

        // Check if class name already exists
        const existingName = await supabaseRequest(`classes?name=eq.${encodeURIComponent(name)}&select=name`);

        if (existingName && existingName.length > 0) {
            return { success: false, error: 'Class name already exists! Please choose a different name.' };
        }

        const data = await supabaseRequest('classes', {
            method: 'POST',
            headers: {
                'Prefer': 'return=representation'
            },
            body: JSON.stringify({
                name,
                password,
                owner_username: creatorUsername,
                class_code: classCode,
                created_at: new Date().toISOString()
            })
        });

        return { success: true, data: data[0] };
    } catch (err) {
        console.error('Error creating class:', err);
        return { success: false, error: err.message };
    }
}

export async function joinClass(classCodeOrName, password, username) {
    try {
        // Try to find by class_code first, then by name
        let data = await supabaseRequest(`classes?class_code=eq.${encodeURIComponent(classCodeOrName)}&password=eq.${encodeURIComponent(password)}&select=*`);

        if (!data || data.length === 0) {
            // Try by name if class_code didn't work
            data = await supabaseRequest(`classes?name=eq.${encodeURIComponent(classCodeOrName)}&password=eq.${encodeURIComponent(password)}&select=*`);
        }

        if (!data || data.length === 0) {
            return { success: false, error: 'Class not found or incorrect password!' };
        }

        const classData = data[0];

        // Check if user is already a member
        const existingMember = await supabaseRequest(`class_members?class_id=eq.${classData.id}&username=eq.${encodeURIComponent(username)}&select=*`);

        if (!existingMember || existingMember.length === 0) {
            // Add user as student to class_members
            await supabaseRequest('class_members', {
                method: 'POST',
                body: JSON.stringify({
                    class_id: classData.id,
                    username: username,
                    role: 'student'
                })
            });

            // Also create user_progress entry
            try {
                await supabaseRequest('user_progress', {
                    method: 'POST',
                    body: JSON.stringify({
                        class_id: classData.id,
                        username: username,
                        xp: 0,
                        challenges_completed: 0,
                        quizzes_completed: 0
                    })
                });
            } catch (progressError) {
                console.error('Error creating user progress:', progressError);
                // Don't fail the join if progress creation fails
            }
        }

        return { success: true, data: classData };
    } catch (err) {
        console.error('Error joining class:', err);
        return { success: false, error: err.message };
    }
}

export async function getClassById(classId) {
    try {
        const data = await supabaseRequest(`classes?id=eq.${classId}&select=*`);

        if (!data || data.length === 0) {
            return { success: false, error: 'Class not found' };
        }

        return { success: true, data: data[0] };
    } catch (err) {
        console.error('Error getting class:', err);
        return { success: false, error: err.message };
    }
}

export async function leaveClass(classId, username) {
    try {
        // Remove from class_members
        await supabaseRequest(`class_members?class_id=eq.${classId}&username=eq.${encodeURIComponent(username)}`, {
            method: 'DELETE'
        });

        // Remove from user_progress
        await supabaseRequest(`user_progress?class_id=eq.${classId}&username=eq.${encodeURIComponent(username)}`, {
            method: 'DELETE'
        });

        return { success: true };
    } catch (err) {
        console.error('Error leaving class:', err);
        return { success: false, error: err.message };
    }
}

export async function getUserRole(classId, username) {
    try {
        const data = await supabaseRequest(`class_members?class_id=eq.${classId}&username=eq.${encodeURIComponent(username)}&select=role`);

        return { success: true, role: data && data.length > 0 ? data[0].role : null };
    } catch (err) {
        console.error('Error getting user role:', err);
        return { success: false, error: err.message };
    }
}

// Challenge management functions
export async function createChallenge(classId, title, description) {
    try {
        const data = await supabaseRequest('challenges', {
            method: 'POST',
            headers: {
                'Prefer': 'return=representation'
            },
            body: JSON.stringify({
                class_id: classId,
                title: title,
                description: description,
                completed_by: [],
                created_at: new Date().toISOString()
            })
        });

        return { success: true, data: data[0] };
    } catch (err) {
        console.error('Error creating challenge:', err);
        return { success: false, error: err.message };
    }
}

// Quiz management functions
export async function createQuiz(classId, title, questions) {
    try {
        const data = await supabaseRequest('quizzes', {
            method: 'POST',
            headers: {
                'Prefer': 'return=representation'
            },
            body: JSON.stringify({
                class_id: classId,
                title: title,
                questions: questions,
                completed_by: [],
                created_at: new Date().toISOString()
            })
        });

        return { success: true, data: data[0] };
    } catch (err) {
        console.error('Error creating quiz:', err);
        return { success: false, error: err.message };
    }
}

// Leaderboard functions
export async function getClassLeaderboard(classId) {
    try {
        const data = await supabaseRequest(`class_leaderboard?class_id=eq.${classId}&select=*&order=xp.desc`);
        return { success: true, data };
    } catch (err) {
        console.error('Error fetching leaderboard:', err);
        return { success: false, error: err.message };
    }
}

export async function updateUserProgress(classId, username, xp, challengesCompleted, quizzesCompleted, actionData = {}) {
    try {
        // First check if record exists
        const existing = await supabaseRequest(`user_progress?class_id=eq.${classId}&username=eq.${encodeURIComponent(username)}&select=id,challenge_progress`);

        // Merge existing challenge progress with new action data
        const challengeProgress = existing && existing.length > 0 ? existing[0].challenge_progress || {} : {};
        if (actionData.challengeId && actionData.progress !== undefined) {
            challengeProgress[actionData.challengeId] = actionData.progress;
        }

        const updateData = {
            xp: xp,
            challenges_completed: challengesCompleted,
            quizzes_completed: quizzesCompleted,
            challenge_progress: challengeProgress,
            updated_at: new Date().toISOString()
        };
        
        let data;
        if (existing && existing.length > 0) {
            // Update existing record
            data = await supabaseRequest(`user_progress?id=eq.${existing[0].id}`, {
                method: 'PATCH',
                headers: {
                    'Prefer': 'return=representation'
                },
                body: JSON.stringify(updateData)
            });
        } else {
            // Insert new record
            data = await supabaseRequest('user_progress', {
                method: 'POST',
                headers: {
                    'Prefer': 'return=representation'
                },
                body: JSON.stringify({
                    class_id: classId,
                    username: username,
                    ...updateData
                })
            });
        }

        return { success: true, data: data[0] };
    } catch (err) {
        console.error('Error updating user progress:', err);
        return { success: false, error: err.message };
    }
}

export async function getQuizzesForClass(classId) {
    try {
        const data = await supabaseRequest(`quizzes?class_id=eq.${classId}&select=*&order=created_at.desc`);
        return { success: true, data };
    } catch (err) {
        console.error('Error fetching quizzes:', err);
        return { success: false, error: err.message };
    }
}

export async function completeQuiz(quizId, username, score, classId = null) {
    try {
        // First get the current quiz to update completed_by array
        const quiz = await supabaseRequest(`quizzes?id=eq.${quizId}&select=completed_by,class_id`);

        if (!quiz || quiz.length === 0) {
            return { success: false, error: 'Quiz not found' };
        }

        const quizData = quiz[0];

        // Add username to completed_by array if not already present
        const completedBy = quizData.completed_by || [];
        if (!completedBy.includes(username)) {
            completedBy.push(username);

            const data = await supabaseRequest(`quizzes?id=eq.${quizId}`, {
                method: 'PATCH',
                headers: {
                    'Prefer': 'return=representation'
                },
                body: JSON.stringify({ completed_by: completedBy })
            });

            // Update user progress for quiz completion
            if (classId || quizData.class_id) {
                const targetClassId = classId || quizData.class_id;
                await updateUserProgressForQuizCompletion(targetClassId, username);
            }

            return { success: true, data: data[0], newCompletion: true };
        }

        return { success: true, data: quizData, newCompletion: false };
    } catch (err) {
        console.error('Error completing quiz:', err);
        return { success: false, error: err.message };
    }
}

// Helper function to update user progress when a quiz is completed
async function updateUserProgressForQuizCompletion(classId, username) {
    try {
        // Get current user progress
        const currentProgress = await supabaseRequest(`user_progress?class_id=eq.${classId}&username=eq.${encodeURIComponent(username)}&select=*`);

        // Get total completed quizzes for this user
        const allQuizzes = await supabaseRequest(`quizzes?class_id=eq.${classId}&select=completed_by`);

        // Count how many quizzes this user has completed
        const completedQuizzes = allQuizzes.filter(quiz => 
            (quiz.completed_by || []).includes(username)
        ).length;

        // Update challenge progress for quiz completion challenges
        const challengeProgress = currentProgress && currentProgress.length > 0 ? currentProgress[0].challenge_progress || {} : {};
        challengeProgress['complete_all_quizzes'] = completedQuizzes;

        const updateData = {
            quizzes_completed: completedQuizzes,
            challenge_progress: challengeProgress,
            updated_at: new Date().toISOString()
        };

        if (currentProgress && currentProgress.length > 0) {
            // Update existing progress
            await supabaseRequest(`user_progress?id=eq.${currentProgress[0].id}`, {
                method: 'PATCH',
                body: JSON.stringify(updateData)
            });
        } else {
            // Create new progress record
            await supabaseRequest('user_progress', {
                method: 'POST',
                body: JSON.stringify({
                    class_id: classId,
                    username: username,
                    xp: 0,
                    challenges_completed: 0,
                    ...updateData
                })
            });
        }
    } catch (err) {
        console.error('Error updating user progress for quiz completion:', err);
    }
}

export async function getChallengesForClass(classId) {
    try {
        const data = await supabaseRequest(`challenges?class_id=eq.${classId}&select=*&order=created_at.desc`);
        return { success: true, data };
    } catch (err) {
        console.error('Error fetching challenges:', err);
        return { success: false, error: err.message };
    }
}

export async function completeChallenge(challengeId, username) {
    try {
        // First get the current challenge to update completed_by array
        const challenge = await supabaseRequest(`challenges?id=eq.${challengeId}&select=completed_by`);

        if (!challenge || challenge.length === 0) {
            return { success: false, error: 'Challenge not found' };
        }

        const challengeData = challenge[0];

        // Add username to completed_by array if not already present
        const completedBy = challengeData.completed_by || [];
        if (!completedBy.includes(username)) {
            completedBy.push(username);

            const data = await supabaseRequest(`challenges?id=eq.${challengeId}`, {
                method: 'PATCH',
                headers: {
                    'Prefer': 'return=representation'
                },
                body: JSON.stringify({ completed_by: completedBy })
            });

            return { success: true, data: data[0] };
        }

        return { success: true, data: challengeData };
    } catch (err) {
        console.error('Error completing challenge:', err);
        return { success: false, error: err.message };
    }
}

export async function isChallengeCompletedByUser(challengeId, username) {
    try {
        const data = await supabaseRequest(`challenges?id=eq.${challengeId}&select=completed_by`);

        if (!data || data.length === 0) {
            return { success: false, error: 'Challenge not found' };
        }

        const completedBy = data[0].completed_by || [];
        return { success: true, completed: completedBy.includes(username) };
    } catch (err) {
        console.error('Error checking challenge completion:', err);
        return { success: false, error: err.message };
    }
}

// Real-time subscriptions (simplified for static hosting - these won't work without WebSocket support)
export function subscribeToClassChanges(classId, callback) {
    console.warn('Real-time subscriptions are not available in static hosting mode');
    return null;
}

export function unsubscribeFromChanges(subscription) {
    // No-op for static hosting
}

// Export a placeholder for backward compatibility
export const supabase = {
    url: supabaseUrl,
    key: supabaseKey
};
