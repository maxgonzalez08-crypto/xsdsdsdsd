import { 
    supabase, 
    signUpUser,
    loginUser,
    createClass, 
    joinClass, 
    getClassById,
    leaveClass,
    getUserRole,
    createChallenge, 
    getChallengesForClass, 
    completeChallenge,
    isChallengeCompletedByUser,
    createQuiz,
    getQuizzesForClass,
    completeQuiz,
    subscribeToClassChanges,
    unsubscribeFromChanges,
    getClassLeaderboard,
    updateUserProgress
} from './supabase.js';

import { translations, getCurrentLanguage, setLanguage, t } from './translations.js';
import { CONFIG } from './config.js';

class FinanQuest {
    constructor() {
        this.userData = this.loadUserData();
        this.groupData = this.loadGroupData();
        this.expenseChart = null;
        this.incomeChart = null;
        this.classSubscription = null;
        this.init();
    }

    init() {
        this.checkLanguageSelection();
        this.setupLanguage();
        this.checkUsername();
        this.setupEventListeners();
        this.updateDisplay();
        this.loadQuizzes();
        this.loadChallenges();
        this.setupCompoundCalculator();

        // Subscribe to real-time changes if user is in a class
        if (this.userData.currentGroup) {
            this.subscribeToClassChanges();
        }
    }

    checkLanguageSelection() {
        const savedLanguage = getCurrentLanguage();
        if (!localStorage.getItem('financquest_language_selected')) {
            // First time user - set Catalan as default and mark as selected
            setLanguage('ca');
            localStorage.setItem('financquest_language_selected', 'true');
        } else if (!savedLanguage) {
            this.showLanguageSelection();
        }
    }

    showLanguageSelection() {
        document.getElementById('languageModal').style.display = 'block';

        // Add event listeners for language buttons
        document.querySelectorAll('.language-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const selectedLang = btn.dataset.lang;
                setLanguage(selectedLang);
                localStorage.setItem('financquest_language_selected', 'true');
                document.getElementById('languageModal').style.display = 'none';
                this.updatePageTranslations();
            });
        });
    }

    setupLanguage() {
        // Set initial language
        const currentLang = getCurrentLanguage();
        this.updatePageTranslations();
    }

    updatePageTranslations() {
        // Update all elements with data-translate attribute
        document.querySelectorAll('[data-translate]').forEach(element => {
            const key = element.getAttribute('data-translate');
            const translation = t(key);
            if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
                element.placeholder = translation;
            } else {
                element.textContent = translation;
            }
        });

        // Update placeholders
        document.querySelectorAll('[data-translate-placeholder]').forEach(element => {
            const key = element.getAttribute('data-translate-placeholder');
            element.placeholder = t(key);
        });

        // Update option elements in select dropdowns
        document.querySelectorAll('option[data-translate]').forEach(option => {
            const key = option.getAttribute('data-translate');
            option.textContent = t(key);
        });

        // Update button text content that contain spans
        document.querySelectorAll('button span[data-translate]').forEach(span => {
            const key = span.getAttribute('data-translate');
            span.textContent = t(key);
        });

        // Update specific dynamic content
        this.updateDynamicTranslations();
    }

    updateDynamicTranslations() {
        // Get currently active page to update only visible content during language changes
        const activePage = document.querySelector('.page.active');
        const activePageId = activePage ? activePage.id : null;

        // Reload quizzes only if currently on quizzes page and content exists
        if (activePageId === 'quizzes' && document.getElementById('quizzesList').children.length > 0) {
            this.loadQuizzes();
        }

        // Reload challenges only if currently on challenges page and content exists  
        if (activePageId === 'challenges' && document.getElementById('challengesList').children.length > 0) {
            this.loadChallenges();
        }

        // Update charts if they exist
        if (this.expenseChart || this.incomeChart) {
            this.updateCharts();
        }

        // Update profile language selector if visible
        if (document.getElementById('profileLanguageSelect')) {
            this.setupProfileLanguageSelector();
        }

        // Update class content if user is in a class and currently viewing groups
        if (this.userData.currentGroupId && document.getElementById('groupDashboard').style.display !== 'none') {
            this.loadClassQuizzes();
            this.loadClassChallenges();
        }
    }

    // Data Management
    loadUserData() {
        const defaultData = {
            username: '',
            isAuthenticated: false,
            xp: 0,
            level: 1,
            quizzesCompleted: 0,
            challengesCompleted: 0,
            achievements: [],
            income: [],
            expenses: [],
            completedQuizzes: [],
            completedChallenges: [],
            currentGroup: null,
            currentGroupId: null,
            challengeProgress: {},
            visitedEducationalResources: false,
            usedCompoundCalculator: false
        };

        const saved = localStorage.getItem('financquest_user');
        return saved ? { ...defaultData, ...JSON.parse(saved) } : defaultData;
    }

    loadGroupData() {
        const saved = localStorage.getItem('financquest_groups');
        return saved ? JSON.parse(saved) : {};
    }

    saveUserData() {
        localStorage.setItem('financquest_user', JSON.stringify(this.userData));
    }

    saveGroupData() {
        localStorage.setItem('financquest_groups', JSON.stringify(this.groupData));
    }

    // Real-time subscriptions
    subscribeToClassChanges() {
        if (this.userData.currentGroupId) {
            this.classSubscription = subscribeToClassChanges(
                this.userData.currentGroupId,
                (payload) => {
                    console.log('Real-time update received:', payload);
                    this.loadChallenges(); // Refresh challenges when changes occur
                }
            );
        }
    }

    unsubscribeFromClassChanges() {
        if (this.classSubscription) {
            unsubscribeFromChanges(this.classSubscription);
            this.classSubscription = null;
        }
    }

    // Custom Notification System
    showNotification(title, message, type = 'info') {
        // Use corner notification instead of modal
        const cornerNotification = document.getElementById('cornerNotification');
        const titleElement = document.getElementById('cornerNotificationTitle');
        const messageElement = document.getElementById('cornerNotificationMessage');
        const iconElement = document.getElementById('cornerNotificationIcon');
        
        // Set content
        titleElement.textContent = title;
        messageElement.textContent = message;
        
        // Set icon type
        iconElement.className = `corner-notification-icon ${type}`;
        
        // Set notification type
        cornerNotification.className = `corner-notification ${type}`;
        
        // Show notification
        cornerNotification.style.display = 'flex';
        setTimeout(() => {
            cornerNotification.classList.add('show');
        }, 100);
        
        // Auto-dismiss after 4 seconds
        setTimeout(() => {
            cornerNotification.classList.remove('show');
            setTimeout(() => {
                cornerNotification.style.display = 'none';
            }, 300);
        }, 4000);
    }

    showTranslatedNotification(titleKey, messageKey, type = 'info') {
        this.showNotification(t(titleKey), t(messageKey), type);
    }

    // Date Validation
    validateDate(dateString) {
        const date = new Date(dateString);
        const year = date.getFullYear();

        if (year > 2026) {
            this.showTranslatedNotification('invalidDate', 'dateAfter2026', 'error');
            return false;
        }
        return true;
    }

    // Authentication
    checkUsername() {
        if (!this.userData.isAuthenticated || !this.userData.username) {
            document.getElementById('authModal').style.display = 'block';
        }
    }

    async authenticateUser(username, password, isSignup = false) {
        try {
            let result;
            if (isSignup) {
                result = await signUpUser(username, password);
                if (result.success) {
                    this.showTranslatedNotification('success', 'accountCreated', 'success');
                    // Automatically log in the user after successful signup
                    const loginResult = await loginUser(username, password);
                    if (loginResult.success) {
                        this.userData.username = username;
                        this.userData.isAuthenticated = true;
                        this.saveUserData();
                        document.getElementById('authModal').style.display = 'none';
                        this.updateDisplay();
                        this.updatePageTranslations();
                        this.showNotification(t('success'), `${t('welcomeMessage')}, ${username}!`, 'success');
                    } else {
                        // Handle login failure after signup
                        this.showNotification(t('error'), loginResult.error || t('loginFailedAfterSignup'), 'error');
                        this.switchAuthForm('login');
                    }
                    return;
                }
            } else {
                result = await loginUser(username, password);
                if (result.success) {
                    this.userData.username = username;
                    this.userData.isAuthenticated = true;
                    this.saveUserData();
                    document.getElementById('authModal').style.display = 'none';
                    this.updateDisplay();
                    this.updatePageTranslations();
                    this.showNotification(t('success'), `${t('welcomeMessage')}, ${username}!`, 'success');
                    return;
                }
            }

            // Handle specific error messages
            let errorMessage = result.error;
            if (result.error.includes('already taken')) {
                errorMessage = t('usernameTaken');
            } else if (result.error.includes('Invalid')) {
                errorMessage = t('invalidCredentials');
            }
            this.showNotification(t('error'), errorMessage, 'error');
        } catch (error) {
            console.error('Authentication error:', error);
            this.showNotification(t('error'), t('invalidCredentials'), 'error');
        }
    }

    switchAuthForm(form) {
        const loginForm = document.getElementById('loginForm');
        const signupForm = document.getElementById('signupForm');

        if (form === 'login') {
            loginForm.style.display = 'block';
            signupForm.style.display = 'none';
        } else {
            loginForm.style.display = 'none';
            signupForm.style.display = 'block';
        }
    }

    // Event Listeners
    setupEventListeners() {
        // Authentication forms
        document.getElementById('loginFormElement').addEventListener('submit', (e) => {
            e.preventDefault();
            const username = document.getElementById('loginUsername').value.trim();
            const password = document.getElementById('loginPassword').value;
            if (username && password) {
                this.authenticateUser(username, password, false);
            }
        });

        document.getElementById('signupFormElement').addEventListener('submit', (e) => {
            e.preventDefault();
            const username = document.getElementById('signupUsername').value.trim();
            const password = document.getElementById('signupPassword').value;
            const confirmPassword = document.getElementById('confirmPassword').value;

            if (password !== confirmPassword) {
                this.showTranslatedNotification('error', 'passwordsDoNotMatch', 'error');
                return;
            }

            if (username && password) {
                this.authenticateUser(username, password, true);
            }
        });

        document.getElementById('switchToSignup').addEventListener('click', (e) => {
            e.preventDefault();
            this.switchAuthForm('signup');
        });

        document.getElementById('switchToLogin').addEventListener('click', (e) => {
            e.preventDefault();
            this.switchAuthForm('login');
        });

        // Navigation
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                this.showPage(link.dataset.page);
            });
        });

        // Extras Menu Navigation
        document.querySelectorAll('.extras-option-card').forEach(card => {
            card.addEventListener('click', (e) => {
                e.preventDefault();
                const targetPage = card.dataset.page;
                if (targetPage) {
                    this.showPage(targetPage);
                }
            });
        });

        // Back Button Navigation
        document.querySelectorAll('.back-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const targetPage = btn.dataset.page;
                if (targetPage) {
                    this.showPage(targetPage);
                }
            });
        });

        // Budget
        document.getElementById('addIncomeBtn').addEventListener('click', () => {
            this.setDefaultDate('incomeDate');
            document.getElementById('incomeModal').style.display = 'block';
        });

        document.getElementById('addExpenseBtn').addEventListener('click', () => {
            this.setDefaultDate('expenseDate');
            document.getElementById('expenseModal').style.display = 'block';
        });

        // AI Assistant
        document.getElementById('aiSubmitBtn').addEventListener('click', async () => {
            const question = document.getElementById('aiQuestionInput').value.trim();
            if (!question) return;

            // Show loading state
            const submitBtn = document.getElementById('aiSubmitBtn');
            const originalHTML = submitBtn.innerHTML;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            submitBtn.disabled = true;

            try {
                // Add user message immediately
                this.addAIMessage(question, '', 'user');
                this.showAITyping(); // Show typing indicator

                const response = await this.callOpenAI(question);
                this.hideAITyping(); // Hide typing indicator
                this.addAIMessage('', response, 'ai');
                document.getElementById('aiQuestionInput').value = '';
            } catch (error) {
                console.error('AI Chat Error:', error);
                this.hideAITyping(); // Hide typing indicator on error

                const errorMessage = this.getLocalizedAIError(error.message);
                this.addAIMessage('', errorMessage, 'ai', true);
            } finally {
                // Restore button state
                submitBtn.innerHTML = originalHTML;
                submitBtn.disabled = false;
            }
        });

        document.getElementById('aiQuestionInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                document.getElementById('aiSubmitBtn').click(); // Trigger the submit button click
            }
        });

        document.querySelectorAll('.suggestion-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const question = btn.dataset.question;
                this.handleSuggestionClick(question);
            });
        });

        // Clear chat functionality
        document.getElementById('clearChatBtn')?.addEventListener('click', () => {
            this.clearAIChat();
        });

        // Income form
        document.getElementById('incomeForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addIncome();
        });

        // Expense form
        document.getElementById('expenseForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addExpense();
        });

        // Groups
        document.getElementById('createGroupBtn').addEventListener('click', () => {
            this.showCreateGroupModal();
        });

        document.getElementById('joinGroupBtn').addEventListener('click', () => {
            this.showJoinGroupModal();
        });

        // Profile reset
        document.getElementById('resetDataBtn').addEventListener('click', () => {
            this.showConfirmation(
                t('areYouSure'), 
                t('resetDataConfirm'), 
                () => {
                    this.resetAllData();
                }
            );
        });

        // Profile language selector (will be available when profile page is shown)
        this.setupProfileLanguageSelector();

        // Notification modal OK button
        document.getElementById('notificationOkBtn').addEventListener('click', () => {
            document.getElementById('customNotificationModal').style.display = 'none';
        });

        // Modal close buttons
        document.querySelectorAll('.close').forEach(closeBtn => {
            closeBtn.addEventListener('click', (e) => {
                e.target.closest('.modal').style.display = 'none';
            });
        });

        // Click outside modal to close (except for auth modal)
        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal') && e.target.id !== 'authModal') {
                e.target.style.display = 'none';
            }
        });
    }

    setDefaultDate(inputId) {
        const today = new Date();
        const dateString = today.toISOString().split('T')[0];
        document.getElementById(inputId).value = dateString;
    }

    showConfirmation(title, message, onConfirm) {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'block';
        modal.innerHTML = `
            <div class="modal-content notification-modal">
                <div class="notification-icon warning"></div>
                <h2>${title}</h2>
                <p>${message}</p>
                <div style="display: flex; gap: 1rem; justify-content: center; margin-top: 2rem;">
                    <button class="btn btn-danger confirm-btn">${t('yesProceed')}</button>
                    <button class="btn btn-secondary cancel-btn">${t('cancel')}</button>
                </div>
            </div>
        `;

        modal.querySelector('.confirm-btn').addEventListener('click', () => {
            onConfirm();
            modal.remove();
        });

        modal.querySelector('.cancel-btn').addEventListener('click', () => {
            modal.remove();
        });

        document.body.appendChild(modal);
    }

    // Navigation
    showPage(pageId) {
        document.querySelectorAll('.page').forEach(page => {
            page.classList.remove('active');
        });
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
        });

        document.getElementById(pageId).classList.add('active');
        document.querySelector(`[data-page="${pageId}"]`).classList.add('active');

        // Scroll to top of the page when changing menus
        window.scrollTo({ top: 0, behavior: 'smooth' });

        // Track page visits for challenges
        if (pageId === 'educational-resources' && !this.userData.visitedEducationalResources) {
            this.userData.visitedEducationalResources = true;
            this.saveUserData();
        }

        // Update page-specific content and ensure translations are current
        if (pageId === 'profile') {
            this.updateProfilePage();
        } else if (pageId === 'budget') {
            this.updateBudgetPage();
        } else if (pageId === 'groups') {
            this.updateGroupsPage();
        } else if (pageId === 'quizzes') {
            // Refresh quizzes with current language when navigating to quizzes page
            this.loadQuizzes();
        } else if (pageId === 'challenges') {
            // Refresh challenges with current language when navigating to challenges page
            this.loadChallenges();
        }
    }

    // Display Updates
    updateDisplay() {
        if (!this.userData.username) return;

        // Update username displays
        document.getElementById('usernameDisplay').textContent = this.userData.username;
        document.getElementById('profileUsername').textContent = this.userData.username;

        // Update level and XP
        const level = this.calculateLevel();
        const xpForNextLevel = this.getXPForLevel(level + 1);
        const xpForCurrentLevel = this.getXPForLevel(level);
        const xpProgress = this.userData.xp - xpForCurrentLevel;
        const xpNeeded = xpForNextLevel - xpForCurrentLevel;

        document.getElementById('currentLevel').textContent = level;
        document.getElementById('profileLevel').textContent = level;
        document.getElementById('currentXP').textContent = xpProgress;
        document.getElementById('nextLevelXP').textContent = xpNeeded;
        document.getElementById('profileXP').textContent = this.userData.xp;

        // Update XP bar
        const xpPercentage = (xpProgress / xpNeeded) * 100;
        document.getElementById('xpBar').style.width = `${Math.min(xpPercentage, 100)}%`;

        // Update stats
        document.getElementById('quizzesCompleted').textContent = this.userData.quizzesCompleted;
        document.getElementById('challengesCompleted').textContent = this.userData.challengesCompleted;
        document.getElementById('achievementsCount').textContent = this.userData.achievements.length;
        document.getElementById('profileQuizzes').textContent = this.userData.quizzesCompleted;
        document.getElementById('profileChallenges').textContent = this.userData.challengesCompleted;
        document.getElementById('profileBadges').textContent = this.userData.achievements.length;

        // Update balance
        const balance = this.calculateBalance();
        document.getElementById('currentBalance').textContent = `€${balance.toFixed(2)}`;

    }

    calculateLevel() {
        return Math.floor(this.userData.xp / 100) + 1;
    }

    getXPForLevel(level) {
        return (level - 1) * 100;
    }

    // XP and Achievements
    addXP(amount, reason, challengeId = null) {
        const oldLevel = this.calculateLevel();
        this.userData.xp += amount;
        const newLevel = this.calculateLevel();

        this.showXPNotification(amount);

        if (newLevel > oldLevel) {
            this.showTranslatedNotification('levelUp', `levelUpMessage ${newLevel}!`, 'success');
        }

        this.checkAchievements();
        this.saveUserData();
        this.updateDisplay();

        // Update progress in Supabase if user is in a class
        if (this.userData.currentGroupId && this.userData.isAuthenticated) {
            this.updateSupabaseProgress(challengeId);
        }
    }

    async updateSupabaseProgress(challengeId = null) {
        try {
            const actionData = {};
            if (challengeId && this.userData.challengeProgress[challengeId]) {
                actionData.challengeId = challengeId;
                actionData.progress = this.userData.challengeProgress[challengeId];
            }

            const result = await updateUserProgress(
                this.userData.currentGroupId,
                this.userData.username,
                this.userData.xp,
                this.userData.challengesCompleted,
                this.userData.quizzesCompleted,
                actionData
            );

            if (result.success) {
                // Refresh leaderboard and challenges after progress update
                this.loadClassLeaderboard();
                this.loadChallenges();
            }
        } catch (error) {
            console.error('Error updating user progress:', error);
        }
    }

    showXPNotification(amount) {
        const notification = document.getElementById('xpNotification');
        document.getElementById('xpNotificationText').textContent = `+${amount} XP!`;
        notification.style.display = 'flex';

        setTimeout(() => {
            notification.style.display = 'none';
        }, 3000);
    }

    checkAchievements() {
        const achievements = [
            { id: 'first_budget', titleKey: 'firstBudgetCreated', condition: () => this.userData.income.length > 0 || this.userData.expenses.length > 0 },
            { id: 'first_quiz', titleKey: 'completedFirstQuiz', condition: () => this.userData.quizzesCompleted > 0 },
            { id: 'quiz_master', titleKey: 'quizMaster', condition: () => this.userData.quizzesCompleted >= 5 },
            { id: 'first_challenge', titleKey: 'challengeAccepted', condition: () => this.userData.challengesCompleted > 0 },
            { id: 'saver', titleKey: 'smartSaver', condition: () => this.calculateBalance() >= 50 },
            { id: 'level_5', titleKey: 'level5Explorer', condition: () => this.calculateLevel() >= 5 }
        ];

        achievements.forEach(achievement => {
            if (!this.userData.achievements.find(a => a.id === achievement.id) && achievement.condition()) {
                this.userData.achievements.push({ id: achievement.id, titleKey: achievement.titleKey });
                this.showTranslatedNotification('achievementUnlocked', `🏆 ${t(achievement.titleKey)}!`, 'success');
            }
        });
    }


    // Budget Management
    addIncome() {
        const amount = parseFloat(document.getElementById('incomeAmount').value);
        const category = document.getElementById('incomeCategory').value;
        const source = document.getElementById('incomeSource').value;
        const date = document.getElementById('incomeDate').value;

        if (!this.validateDate(date)) {
            return;
        }

        const income = {
            id: Date.now(),
            amount,
            category,
            source,
            date,
            timestamp: new Date().toISOString()
        };

        this.userData.income.push(income);
        this.addXP(10, 'Added income entry');

        // Update challenge progress
        this.updateChallengeProgress();

        this.saveUserData();
        this.updateDisplay();
        this.updateBudgetPage();

        document.getElementById('incomeModal').style.display = 'none';
        document.getElementById('incomeForm').reset();
        this.showTranslatedNotification('incomeAdded', 'incomeAddedMessage', 'success');
    }

    addExpense() {
        const amount = parseFloat(document.getElementById('expenseAmount').value);
        const category = document.getElementById('expenseCategory').value;
        const description = document.getElementById('expenseDescription').value;
        const date = document.getElementById('expenseDate').value;

        if (!this.validateDate(date)) {
            return;
        }

        const expense = {
            id: Date.now(),
            amount,
            category,
            description,
            date,
            timestamp: new Date().toISOString()
        };

        this.userData.expenses.push(expense);
        this.addXP(10, 'Added expense entry');

        // Update challenge progress
        this.updateChallengeProgress();

        this.saveUserData();
        this.updateDisplay();
        this.updateBudgetPage();

        document.getElementById('expenseModal').style.display = 'none';
        document.getElementById('expenseForm').reset();
        this.showTranslatedNotification('expenseAdded', 'expenseAddedMessage', 'success');
    }

    updateChallengeProgress() {
        // Update progress for all local challenges
        const challengeIds = [
            'track_expenses_3_days',
            'save_20_euros', 
            'add_5_transactions',
            'complete_all_quizzes'
        ];

        challengeIds.forEach(challengeId => {
            let progress = 0;

            switch(challengeId) {
                case 'track_expenses_3_days':
                    const uniqueDays = new Set(this.userData.expenses.map(e => e.date));
                    progress = uniqueDays.size;
                    break;
                case 'save_20_euros':
                    progress = this.calculateBalance() >= 20 ? 1 : 0;
                    break;
                case 'add_5_transactions':
                    progress = this.userData.income.length + this.userData.expenses.length;
                    break;
                case 'complete_all_quizzes':
                    progress = this.userData.quizzesCompleted;
                    break;
            }

            this.userData.challengeProgress[challengeId] = progress;
        });
    }

    calculateBalance() {
        const totalIncome = this.userData.income.reduce((sum, item) => sum + item.amount, 0);
        const totalExpenses = this.userData.expenses.reduce((sum, item) => sum + item.amount, 0);
        return totalIncome - totalExpenses;
    }

    updateBudgetPage() {
        const totalIncome = this.userData.income.reduce((sum, item) => sum + item.amount, 0);
        const totalExpenses = this.userData.expenses.reduce((sum, item) => sum + item.amount, 0);
        const balance = totalIncome - totalExpenses;

        document.getElementById('totalIncome').textContent = `€${totalIncome.toFixed(2)}`;
        document.getElementById('totalExpenses').textContent = `€${totalExpenses.toFixed(2)}`;
        document.getElementById('budgetBalance').textContent = `€${balance.toFixed(2)}`;

        this.updateTransactionsList();
        this.updateCharts();
    }

    updateCharts() {
        this.updateExpenseChart();
        this.updateIncomeChart();
    }

    updateExpenseChart() {
        const ctx = document.getElementById('expenseChart').getContext('2d');

        if (this.expenseChart) {
            this.expenseChart.destroy();
        }

        const expenseCategories = {};
        this.userData.expenses.forEach(expense => {
            const categoryName = this.getCategoryDisplayName(expense.category, 'expense');
            expenseCategories[categoryName] = (expenseCategories[categoryName] || 0) + expense.amount;
        });

        const data = Object.keys(expenseCategories);
        const amounts = Object.values(expenseCategories);

        if (data.length === 0) {
            ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
            ctx.font = '16px Arial';
            ctx.fillStyle = '#666';
            ctx.textAlign = 'center';
            ctx.fillText(t('noExpensesYet') || 'No expenses yet', ctx.canvas.width / 2, ctx.canvas.height / 2);
            return;
        }

        this.expenseChart = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: data,
                datasets: [{
                    data: amounts,
                    backgroundColor: [
                        '#ef4444',
                        '#f59e0b',
                        '#10b981',
                        '#3b82f6',
                        '#8b5cf6',
                        '#f97316'
                    ],
                    borderWidth: 2,
                    borderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            generateLabels: function(chart) {
                                const data = chart.data;
                                if (data.labels.length && data.datasets.length) {
                                    return data.labels.map((label, i) => {
                                        const meta = chart.getDatasetMeta(0);
                                        const style = meta.controller.getStyle(i);
                                        return {
                                            text: label,
                                            fillStyle: style.backgroundColor,
                                            strokeStyle: style.borderColor,
                                            lineWidth: style.borderWidth,
                                            hidden: isNaN(data.datasets[0].data[i]) || meta.data[i].hidden,
                                            index: i
                                        };
                                    });
                                }
                                return [];
                            }
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const label = context.label || '';
                                const value = context.parsed;
                                return `${label}: €${value.toFixed(2)}`;
                            }
                        }
                    }
                }
            }
        });
    }

    updateIncomeChart() {
        const ctx = document.getElementById('incomeChart').getContext('2d');

        if (this.incomeChart) {
            this.incomeChart.destroy();
        }

        const incomeCategories = {};
        this.userData.income.forEach(income => {
            const categoryName = this.getCategoryDisplayName(income.category, 'income');
            incomeCategories[categoryName] = (incomeCategories[categoryName] || 0) + income.amount;
        });

        const data = Object.keys(incomeCategories);
        const amounts = Object.values(incomeCategories);

        if (data.length === 0) {
            ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
            ctx.font = '16px Arial';
            ctx.fillStyle = '#666';
            ctx.textAlign = 'center';
            ctx.fillText(t('noIncomeYet') || 'No income yet', ctx.canvas.width / 2, ctx.canvas.height / 2);
            return;
        }

        this.incomeChart = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: data,
                datasets: [{
                    data: amounts,
                    backgroundColor: [
                        '#10b981',
                        '#06d6a0',
                        '#3b82f6',
                        '#8b5cf6',
                        '#f59e0b',
                        '#ef4444'
                    ],
                    borderWidth: 2,
                    borderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            generateLabels: function(chart) {
                                const data = chart.data;
                                if (data.labels.length && data.datasets.length) {
                                    return data.labels.map((label, i) => {
                                        const meta = chart.getDatasetMeta(0);
                                        const style = meta.controller.getStyle(i);
                                        return {
                                            text: label,
                                            fillStyle: style.backgroundColor,
                                            strokeStyle: style.borderColor,
                                            lineWidth: style.borderWidth,
                                            hidden: isNaN(data.datasets[0].data[i]) || meta.data[i].hidden,
                                            index: i
                                        };
                                    });
                                }
                                return [];
                            }
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const label = context.label || '';
                                const value = context.parsed;
                                return `${label}: €${value.toFixed(2)}`;
                            }
                        }
                    }
                }
            }
        });
    }

    getCategoryDisplayName(category, type) {
        // Map category IDs to translation keys
        const categoryMap = {
            // Income categories
            'salary': 'salary',
            'pocket_money': 'pocketMoney',
            'side_job': 'sideJob',
            'gift': 'gift',
            'other': 'other',
            // Expense categories
            'fixed': 'fixed',
            'variable': 'variable',
            'gasto_hormiga': 'gastoHormiga'
        };

        const translationKey = categoryMap[category] || category;
        const translated = t(translationKey);
        return translated !== translationKey ? translated : category;
    }

    updateTransactionsList() {
        const container = document.getElementById('transactionsList');
        const allTransactions = [
            ...this.userData.income.map(item => ({ ...item, type: 'income' })),
            ...this.userData.expenses.map(item => ({ ...item, type: 'expense' }))
        ].sort((a, b) => new Date(b.date) - new Date(a.date));

        if (allTransactions.length === 0) {
            container.innerHTML = `<p class="no-transactions" data-translate="noTransactionsMessage">${t('noTransactionsMessage')}</p>`;
        } else {
            container.innerHTML = allTransactions.slice(0, 10).map(transaction => 
                `<div class="transaction-item">
                    <div class="transaction-info">
                        <div class="transaction-description">
                            ${transaction.type === 'income' ? transaction.source : transaction.description}
                        </div>
                        <div class="transaction-date">${transaction.date}</div>
                    </div>
                    <div class="transaction-amount ${transaction.type}">
                        ${transaction.type === 'income' ? '+' : '-'}€${transaction.amount.toFixed(2)}
                    </div>
                </div>`
            ).join('');
        }
    }

    // Quiz System
    loadQuizzes() {
        const quizzes = [
            {
                id: 'budget_basics',
                titleKey: 'budgetBasics',
                get title() { return t('budgetBasics'); },
                questions: [
                    {
                        questionKey: 'whatIsBudget',
                        get question() { return t('whatIsBudget'); },
                        optionKeys: ['budgetPlan', 'bankAccount', 'creditCard'],
                        get options() { return [t('budgetPlan'), t('bankAccount'), t('creditCard')]; },
                        correct: 0,
                        get correctExplanation() { return t('whatIsBudgetCorrect'); },
                        get incorrectExplanation() { return t('whatIsBudgetIncorrect'); }
                    },
                    {
                        questionKey: 'budgetFirstStep',
                        get question() { return t('budgetFirstStep'); },
                        optionKeys: ['buyThings', 'trackMoney', 'getCreditCard'],
                        get options() { return [t('buyThings'), t('trackMoney'), t('getCreditCard')]; },
                        correct: 1,
                        get correctExplanation() { return t('budgetFirstStepCorrect'); },
                        get incorrectExplanation() { return t('budgetFirstStepIncorrect'); }
                    },
                    {
                        questionKey: 'savingsPercentage',
                        get question() { return t('savingsPercentage'); },
                        optionKeys: ['fivePercent', 'tenToTwenty', 'fiftyPercent'],
                        get options() { return [t('fivePercent'), t('tenToTwenty'), t('fiftyPercent')]; },
                        correct: 1,
                        get correctExplanation() { return t('savingsPercentageCorrect'); },
                        get incorrectExplanation() { return t('savingsPercentageIncorrect'); }
                    }
                ]
            },
            {
                id: 'saving_money',
                titleKey: 'savingMoney',
                get title() { return t('savingMoney'); },
                questions: [
                    {
                        questionKey: 'bestSavingStrategy',
                        get question() { return t('bestSavingStrategy') || 'What is the best strategy for saving money?'; },
                        optionKeys: ['saveAfterSpending', 'payYourselfFirst', 'saveOnlyExtra'],
                        get options() { return [
                            t('saveAfterSpending') || 'Save what\'s left after spending', 
                            t('payYourselfFirst') || 'Pay yourself first - save before spending', 
                            t('saveOnlyExtra') || 'Only save extra money from bonuses'
                        ]; },
                        correct: 1,
                        get correctExplanation() { return t('bestSavingStrategyCorrect'); },
                        get incorrectExplanation() { return t('bestSavingStrategyIncorrect'); }
                    },
                    {
                        questionKey: 'emergencyFund',
                        get question() { return t('emergencyFund') || 'What is an emergency fund?'; },
                        optionKeys: ['emergencyFundVacation', 'emergencyFundCorrect', 'emergencyFundShopping'],
                        get options() { return [
                            t('emergencyFundVacation') || 'Money for vacations', 
                            t('emergencyFundCorrect') || 'Money for unexpected expenses', 
                            t('emergencyFundShopping') || 'Money for shopping'
                        ]; },
                        correct: 1,
                        get correctExplanation() { return t('emergencyFundAnswerCorrect'); },
                        get incorrectExplanation() { return t('emergencyFundAnswerIncorrect'); }
                    },
                    {
                        questionKey: 'emergencyFundAmount',
                        get question() { return t('emergencyFundAmount') || 'How much should you have in an emergency fund?'; },
                        optionKeys: ['oneMonth', 'threeToSixMonths', 'oneYear'],
                        get options() { return [
                            t('oneMonth') || '1 month of expenses', 
                            t('threeToSixMonths') || '3-6 months of expenses', 
                            t('oneYear') || '1 year of expenses'
                        ]; },
                        correct: 1,
                        get correctExplanation() { return t('emergencyFundAmountCorrect'); },
                        get incorrectExplanation() { return t('emergencyFundAmountIncorrect'); }
                    }
                ]
            },
            {
                id: 'debt_management',
                titleKey: 'debtManagement',
                get title() { return t('debtManagement'); },
                questions: [
                    {
                        questionKey: 'whatIsInterest',
                        get question() { return t('whatIsInterest') || 'What is interest?'; },
                        optionKeys: ['interestEarning', 'interestCost', 'interestAccount'],
                        get options() { return [
                            t('interestEarning') || 'Money you earn from working', 
                            t('interestCost') || 'Cost of borrowing money', 
                            t('interestAccount') || 'A type of savings account'
                        ]; },
                        correct: 1,
                        get correctExplanation() { return t('whatIsInterestCorrect'); },
                        get incorrectExplanation() { return t('whatIsInterestIncorrect'); }
                    },
                    {
                        questionKey: 'debtPayoffStrategy',
                        get question() { return t('debtPayoffStrategy') || 'What is the "avalanche method" for paying off debt?'; },
                        optionKeys: ['paySmallestFirst', 'payHighestInterestFirst', 'payNewestFirst'],
                        get options() { return [
                            t('paySmallestFirst') || 'Pay off smallest balance first', 
                            t('payHighestInterestFirst') || 'Pay off highest interest rate first', 
                            t('payNewestFirst') || 'Pay off newest debt first'
                        ]; },
                        correct: 1,
                        get correctExplanation() { return t('debtPayoffStrategyCorrect'); },
                        get incorrectExplanation() { return t('debtPayoffStrategyIncorrect'); }
                    },
                    {
                        questionKey: 'creditScore',
                        get question() { return t('creditScore') || 'What factors affect your credit score the most?'; },
                        optionKeys: ['bankBalance', 'paymentHistory', 'incomeLevel'],
                        get options() { return [
                            t('bankBalance') || 'Your bank balance', 
                            t('paymentHistory') || 'Payment history and credit utilization', 
                            t('incomeLevel') || 'Your income level'
                        ]; },
                        correct: 1,
                        get correctExplanation() { return t('creditScoreCorrect'); },
                        get incorrectExplanation() { return t('creditScoreIncorrect'); }
                    }
                ]
            },
            {
                id: 'investment_basics',
                titleKey: 'investmentBasics',
                get title() { return t('investmentBasics') || 'Investment Basics'; },
                questions: [
                    {
                        questionKey: 'whatIsInvesting',
                        get question() { return t('whatIsInvesting') || 'What is investing?'; },
                        optionKeys: ['savingMoney', 'buyingAssets', 'spendingMoney'],
                        get options() { return [
                            t('savingMoney') || 'Saving money in a bank account', 
                            t('buyingAssets') || 'Buying assets to grow wealth over time', 
                            t('spendingMoney') || 'Spending money on luxury items'
                        ]; },
                        correct: 1,
                        get correctExplanation() { return t('whatIsInvestingCorrect'); },
                        get incorrectExplanation() { return t('whatIsInvestingIncorrect'); }
                    },
                    {
                        questionKey: 'riskReward',
                        get question() { return t('riskReward') || 'What is the relationship between risk and reward in investing?'; },
                        optionKeys: ['noRelationship', 'higherRiskHigherReward', 'lowerRiskHigherReward'],
                        get options() { return [
                            t('noRelationship') || 'There is no relationship', 
                            t('higherRiskHigherReward') || 'Higher risk typically means higher potential reward', 
                            t('lowerRiskHigherReward') || 'Lower risk means higher reward'
                        ]; },
                        correct: 1,
                        get correctExplanation() { return t('riskRewardCorrect'); },
                        get incorrectExplanation() { return t('riskRewardIncorrect'); }
                    },
                    {
                        questionKey: 'diversification',
                        get question() { return t('diversification') || 'What does diversification mean in investing?'; },
                        optionKeys: ['buyOneStock', 'spreadInvestments', 'buyExpensive'],
                        get options() { return [
                            t('buyOneStock') || 'Buying only one type of stock', 
                            t('spreadInvestments') || 'Spreading investments across different assets', 
                            t('buyExpensive') || 'Only buying expensive investments'
                        ]; },
                        correct: 1,
                        get correctExplanation() { return t('diversificationCorrect'); },
                        get incorrectExplanation() { return t('diversificationIncorrect'); }
                    }
                ]
            },
            {
                id: 'money_management',
                titleKey: 'moneyManagement',
                get title() { return t('moneyManagement') || 'Money Management'; },
                questions: [
                    {
                        questionKey: 'needsVsWants',
                        get question() { return t('needsVsWants') || 'Which of these is a "need" rather than a "want"?'; },
                        optionKeys: ['latestPhone', 'basicFood', 'designerClothes'],
                        get options() { return [
                            t('latestPhone') || 'Latest smartphone', 
                            t('basicFood') || 'Basic food and shelter', 
                            t('designerClothes') || 'Designer clothes'
                        ]; },
                        correct: 1,
                        get correctExplanation() { return t('needsVsWantsCorrect'); },
                        get incorrectExplanation() { return t('needsVsWantsIncorrect'); }
                    },
                    {
                        questionKey: 'compoundInterest',
                        get question() { return t('compoundInterest') || 'What is compound interest?'; },
                        optionKeys: ['simpleInterest', 'interestOnInterest', 'noInterest'],
                        get options() { return [
                            t('simpleInterest') || 'Interest calculated only on principal', 
                            t('interestOnInterest') || 'Interest earned on both principal and previous interest', 
                            t('noInterest') || 'Interest that doesn\'t grow'
                        ]; },
                        correct: 1,
                        get correctExplanation() { return t('compoundInterestCorrect'); },
                        get incorrectExplanation() { return t('compoundInterestIncorrect'); }
                    },
                    {
                        questionKey: 'financialGoals',
                        get question() { return t('financialGoals') || 'What makes a good financial goal?'; },
                        optionKeys: ['vague', 'specificMeasurable', 'impossible'],
                        get options() { return [
                            t('vague') || 'Vague and general', 
                            t('specificMeasurable') || 'Specific, measurable, and time-bound', 
                            t('impossible') || 'Impossible to achieve'
                        ]; },
                        correct: 1,
                        get correctExplanation() { return t('financialGoalsCorrect'); },
                        get incorrectExplanation() { return t('financialGoalsIncorrect'); }
                    }
                ]
            },
            {
                id: 'budgeting_503020',
                titleKey: 'budgeting503020',
                get title() { return t('budgeting503020') || '50/30/20 Budgeting Rule'; },
                questions: [
                    {
                        questionKey: 'whatIs503020Rule',
                        get question() { return t('whatIs503020Rule') || 'What is the 50/30/20 budgeting rule?'; },
                        optionKeys: ['fiftyNeeds', 'fiftyWants', 'fiftySavings'],
                        get options() { return [
                            t('fiftyNeeds') || '50% needs, 30% wants, 20% savings', 
                            t('fiftyWants') || '50% wants, 30% needs, 20% savings', 
                            t('fiftySavings') || '50% savings, 30% needs, 20% wants'
                        ]; },
                        correct: 0,
                        get correctExplanation() { return t('whatIs503020RuleCorrect'); },
                        get incorrectExplanation() { return t('whatIs503020RuleIncorrect'); }
                    },
                    {
                        questionKey: 'classifyHousing',
                        get question() { return t('classifyHousing') || 'In the 50/30/20 rule, where does rent/housing cost belong?'; },
                        optionKeys: ['needsCategory', 'wantsCategory', 'savingsCategory'],
                        get options() { return [
                            t('needsCategory') || 'Needs (50%)', 
                            t('wantsCategory') || 'Wants (30%)', 
                            t('savingsCategory') || 'Savings (20%)'
                        ]; },
                        correct: 0,
                        get correctExplanation() { return t('classifyHousingCorrect'); },
                        get incorrectExplanation() { return t('classifyHousingIncorrect'); }
                    },
                    {
                        questionKey: 'classifyDining',
                        get question() { return t('classifyDining') || 'In the 50/30/20 rule, where does dining out belong?'; },
                        optionKeys: ['needsCategory', 'wantsCategory', 'savingsCategory'],
                        get options() { return [
                            t('needsCategory') || 'Needs (50%)', 
                            t('wantsCategory') || 'Wants (30%)', 
                            t('savingsCategory') || 'Savings (20%)'
                        ]; },
                        correct: 1,
                        get correctExplanation() { return t('classifyDiningCorrect'); },
                        get incorrectExplanation() { return t('classifyDiningIncorrect'); }
                    }
                ]
            },
            {
                id: 'investment_compound',
                titleKey: 'investmentCompound',
                get title() { return t('investmentCompound') || 'Investment & Compound Interest'; },
                questions: [
                    {
                        questionKey: 'savingVsInvesting',
                        get question() { return t('savingVsInvesting') || 'What is the main difference between saving and investing?'; },
                        optionKeys: ['savingRisk', 'investingGrowth', 'noSecondDifference'],
                        get options() { return [
                            t('savingRisk') || 'Saving has more risk than investing', 
                            t('investingGrowth') || 'Investing offers potential for higher long-term growth', 
                            t('noSecondDifference') || 'There is no significant difference'
                        ]; },
                        correct: 1,
                        get correctExplanation() { return t('savingVsInvestingCorrect'); },
                        get incorrectExplanation() { return t('savingVsInvestingIncorrect'); }
                    },
                    {
                        questionKey: 'compoundGrowth',
                        get question() { return t('compoundGrowth') || 'If you invest €1000 at 7% annual return, approximately how much will you have after 20 years with compound interest?'; },
                        optionKeys: ['twothousand400', 'threethousand870', 'fivethousand'],
                        get options() { return [
                            t('twothousand400') || '€2,400', 
                            t('threethousand870') || '€3,870', 
                            t('fivethousand') || '€5,000'
                        ]; },
                        correct: 1,
                        get correctExplanation() { return t('compoundGrowthCorrect'); },
                        get incorrectExplanation() { return t('compoundGrowthIncorrect'); }
                    },
                    {
                        questionKey: 'startInvestingWhen',
                        get question() { return t('startInvestingWhen') || 'When is the best time to start investing?'; },
                        optionKeys: ['whenRich', 'asEarlyAsPossible', 'beforeRetirement'],
                        get options() { return [
                            t('whenRich') || 'When you become wealthy', 
                            t('asEarlyAsPossible') || 'As early as possible to benefit from compound interest', 
                            t('beforeRetirement') || 'Only a few years before retirement'
                        ]; },
                        correct: 1,
                        get correctExplanation() { return t('startInvestingWhenCorrect'); },
                        get incorrectExplanation() { return t('startInvestingWhenIncorrect'); }
                    }
                ]
            },
            {
                id: 'time_planning',
                titleKey: 'timePlanning',
                get title() { return t('timePlanning') || 'Financial Time Planning'; },
                questions: [
                    {
                        questionKey: 'shortTermGoal',
                        get question() { return t('shortTermGoal') || 'Which of these is a short-term financial goal (less than 1 year)?'; },
                        optionKeys: ['buyingPhone', 'buyingHouse', 'retirement'],
                        get options() { return [
                            t('buyingPhone') || 'Saving for a new phone', 
                            t('buyingHouse') || 'Buying a house', 
                            t('retirement') || 'Retirement planning'
                        ]; },
                        correct: 0,
                        get correctExplanation() { return t('shortTermGoalCorrect'); },
                        get incorrectExplanation() { return t('shortTermGoalIncorrect'); }
                    },
                    {
                        questionKey: 'mediumTermGoal',
                        get question() { return t('mediumTermGoal') || 'Which of these is a medium-term financial goal (1-5 years)?'; },
                        optionKeys: ['vacationFund', 'carPurchase', 'collegeEducation'],
                        get options() { return [
                            t('vacationFund') || 'Building a vacation fund', 
                            t('carPurchase') || 'Saving for a car', 
                            t('collegeEducation') || 'Saving for college education'
                        ]; },
                        correct: 1,
                        get correctExplanation() { return t('mediumTermGoalCorrect'); },
                        get incorrectExplanation() { return t('mediumTermGoalIncorrect'); }
                    },
                    {
                        questionKey: 'longTermGoal',
                        get question() { return t('longTermGoal') || 'Which of these is a long-term financial goal (5+ years)?'; },
                        optionKeys: ['emergencyFund', 'homeDownPayment', 'retirementSaving'],
                        get options() { return [
                            t('emergencyFund') || 'Building an emergency fund', 
                            t('homeDownPayment') || 'Saving for a home down payment', 
                            t('retirementSaving') || 'Retirement savings'
                        ]; },
                        correct: 2,
                        get correctExplanation() { return t('longTermGoalCorrect'); },
                        get incorrectExplanation() { return t('longTermGoalIncorrect'); }
                    }
                ]
            },
            {
                id: 'financial_concepts',
                titleKey: 'financialConcepts',
                get title() { return t('financialConcepts') || 'Basic Financial Concepts'; },
                questions: [
                    {
                        questionKey: 'whatIsLiquidity',
                        get question() { return t('whatIsLiquidity') || 'What does "liquidity" mean in finance?'; },
                        optionKeys: ['moneyInBank', 'howQuicklyConvertToCash', 'totalWealth'],
                        get options() { return [
                            t('moneyInBank') || 'How much money you have in the bank', 
                            t('howQuicklyConvertToCash') || 'How quickly an asset can be converted to cash', 
                            t('totalWealth') || 'Your total wealth'
                        ]; },
                        correct: 1,
                        get correctExplanation() { return t('whatIsLiquidityCorrect'); },
                        get incorrectExplanation() { return t('whatIsLiquidityIncorrect'); }
                    },
                    {
                        questionKey: 'positiveBalance',
                        get question() { return t('positiveBalance') || 'What does it mean to have a positive financial balance?'; },
                        optionKeys: ['incomeGreaterThanExpenses', 'havingCredit', 'noDebt'],
                        get options() { return [
                            t('incomeGreaterThanExpenses') || 'Your income is greater than your expenses', 
                            t('havingCredit') || 'Having access to credit cards', 
                            t('noDebt') || 'Having no debt'
                        ]; },
                        correct: 0,
                        get correctExplanation() { return t('positiveBalanceCorrect'); },
                        get incorrectExplanation() { return t('positiveBalanceIncorrect'); }
                    },
                    {
                        questionKey: 'responsibleConsumption',
                        get question() { return t('responsibleConsumption') || 'What is the key principle of responsible consumption?'; },
                        optionKeys: ['buyEverything', 'spendWithinMeans', 'alwaysBuyCheapest'],
                        get options() { return [
                            t('buyEverything') || 'Buy everything you want', 
                            t('spendWithinMeans') || 'Spend within your means and consider long-term impact', 
                            t('alwaysBuyCheapest') || 'Always buy the cheapest option'
                        ]; },
                        correct: 1,
                        get correctExplanation() { return t('responsibleConsumptionCorrect'); },
                        get incorrectExplanation() { return t('responsibleConsumptionIncorrect'); }
                    }
                ]
            }
        ];

        this.displayQuizzes(quizzes);
    }

    displayQuizzes(quizzes) {
        const container = document.getElementById('quizzesList');
        if (quizzes.length === 0) {
            container.innerHTML = `<p class="no-quizzes" data-translate="noQuizzesAvailable">${t('noQuizzesAvailable')}</p>`;
            return;
        }

        container.innerHTML = quizzes.map(quiz => {
            const isCompleted = this.userData.completedQuizzes.includes(quiz.id);
            return `
                <div class="quiz-card ${isCompleted ? 'completed' : ''}" data-quiz-id="${quiz.id}">
                    <h3>${quiz.title}</h3>
                    <p>${quiz.questions.length} ${t('questions')}</p>
                    <div class="quiz-actions">
                        ${isCompleted 
                            ? `<span class="completed-badge">✅ ${t('completed')}</span>` 
                            : `<button class="btn btn-primary quiz-start-btn">${t('startQuiz')}</button>`
                        }
                    </div>
                </div>
            `;
        }).join('');

        // Add event listeners for quiz start buttons
        document.querySelectorAll('.quiz-start-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const quizId = e.target.closest('.quiz-card').dataset.quizId;
                const quiz = quizzes.find(q => q.id === quizId);
                this.startQuiz(quiz);
            });
        });
    }

    startQuiz(quiz) {
        this.currentQuiz = quiz;
        this.currentQuestionIndex = 0;
        this.quizAnswers = [];

        this.showQuizQuestion();
        document.getElementById('quizModal').style.display = 'block';
    }

    showQuizQuestion() {
        const question = this.currentQuiz.questions[this.currentQuestionIndex];
        const isLastQuestion = this.currentQuestionIndex === this.currentQuiz.questions.length - 1;
        const progressPercentage = ((this.currentQuestionIndex + 1) / this.currentQuiz.questions.length) * 100;

        document.getElementById('quizContent').innerHTML = `
            <h2>${this.currentQuiz.title}</h2>
            <div class="quiz-progress-text">${t('question') || 'Question'} ${this.currentQuestionIndex + 1} ${t('of') || 'of'} ${this.currentQuiz.questions.length}</div>
            <div class="quiz-progress">
                <div class="quiz-progress-fill" style="width: ${progressPercentage}%"></div>
            </div>
            <div class="quiz-question">
                <h3>${question.question}</h3>
                <div class="quiz-options">
                    ${question.options.map((option, index) => 
                        `<label class="quiz-option" data-index="${index}">
                            <input type="radio" name="answer" value="${index}" style="display: none;">
                            ${option}
                        </label>`
                    ).join('')}
                </div>
                <div class="quiz-feedback" id="quizFeedback" style="display: none; margin-top: 1rem; padding: 1rem; border-radius: 8px;"></div>
            </div>
            <div class="quiz-actions" style="margin-top: 2rem; display: flex; gap: 1rem; justify-content: center;">
                ${this.currentQuestionIndex > 0 ? `<button class="btn btn-secondary" id="quizBackBtn">${t('back') || 'Back'}</button>` : ''}
                <button class="btn btn-primary" id="quizConfirmBtn" disabled>
                    ${t('confirmAnswer') || 'Confirm Answer'}
                </button>
            </div>
        `;

        // Add event listeners for options
        document.querySelectorAll('.quiz-option').forEach(option => {
            option.addEventListener('click', () => {
                // Remove previous selections 
                document.querySelectorAll('.quiz-option').forEach(opt => {
                    opt.classList.remove('selected');
                });
                
                // Mark selected option
                option.classList.add('selected');
                option.querySelector('input').checked = true;
                
                // Enable confirm button
                document.getElementById('quizConfirmBtn').disabled = false;
            });
        });

        // Add event listener for back button
        if (this.currentQuestionIndex > 0) {
            document.getElementById('quizBackBtn').addEventListener('click', () => {
                this.currentQuestionIndex--;
                this.quizAnswers.pop();
                this.showQuizQuestion();
            });
        }

        // Add event listener for confirm button
        document.getElementById('quizConfirmBtn').addEventListener('click', () => {
            const selectedAnswer = document.querySelector('input[name="answer"]:checked');
            if (selectedAnswer) {
                const selectedIndex = parseInt(selectedAnswer.value);
                const isCorrect = selectedIndex === question.correct;
                
                // Store the answer
                this.quizAnswers.push(selectedIndex);
                
                // Show feedback screen
                this.showAnswerFeedback(question, selectedIndex, isCorrect);
            }
        });
    }
    
    showAnswerFeedback(question, selectedIndex, isCorrect) {
        const explanation = isCorrect ? question.correctExplanation : question.incorrectExplanation;
        const isLastQuestion = this.currentQuestionIndex === this.currentQuiz.questions.length - 1;
        
        document.getElementById('quizContent').innerHTML = `
            <h2>${this.currentQuiz.title}</h2>
            <div class="quiz-progress-text">${t('question') || 'Question'} ${this.currentQuestionIndex + 1} ${t('of') || 'of'} ${this.currentQuiz.questions.length}</div>
            <div class="quiz-progress">
                <div class="quiz-progress-fill" style="width: ${((this.currentQuestionIndex + 1) / this.currentQuiz.questions.length) * 100}%"></div>
            </div>
            
            <div class="quiz-feedback-screen" style="text-align: center; margin: 2rem 0;">
                <div class="feedback-icon" style="font-size: 4rem; margin-bottom: 1rem;">
                    ${isCorrect ? '✅' : '❌'}
                </div>
                <h3 class="feedback-status" style="color: ${isCorrect ? '#22c55e' : '#ef4444'}; margin-bottom: 1.5rem;">
                    ${isCorrect ? (t('correct') || 'Correct!') : (t('incorrect') || 'Not quite!')}
                </h3>
                <div class="feedback-explanation" style="background: ${isCorrect ? '#f0fdf4' : '#fef2f2'}; padding: 1.5rem; border-radius: 12px; border: 2px solid ${isCorrect ? '#22c55e' : '#ef4444'}; margin-bottom: 2rem; text-align: left;">
                    <p style="margin: 0; line-height: 1.6;">${explanation}</p>
                </div>
                
                <div class="quiz-actions" style="display: flex; gap: 1rem; justify-content: center;">
                    <button class="btn btn-primary" id="quizContinueBtn">
                        ${isLastQuestion ? (t('finishQuiz') || 'Finish Quiz') : (t('continue') || 'Continue')}
                    </button>
                </div>
            </div>
        `;
        
        // Add event listener for continue button
        document.getElementById('quizContinueBtn').addEventListener('click', () => {
            if (isLastQuestion) {
                this.finishQuiz();
            } else {
                this.currentQuestionIndex++;
                this.showQuizQuestion();
            }
        });
    }

    // Keep the old function for compatibility but it won't be used in the new flow
    showQuestionFeedback(question, selectedIndex, isCorrect) {
        const feedbackElement = document.getElementById('quizFeedback');
        const explanation = isCorrect ? question.correctExplanation : question.incorrectExplanation;
        
        feedbackElement.innerHTML = `
            <div class="feedback-icon">
                ${isCorrect ? '✅' : '❌'}
            </div>
            <div class="feedback-content">
                <h4>${isCorrect ? (t('correct') || 'Correct!') : (t('incorrect') || 'Not quite!')}</h4>
                <p>${explanation}</p>
            </div>
        `;
        
        feedbackElement.className = `quiz-feedback ${isCorrect ? 'feedback-correct' : 'feedback-incorrect'}`;
        feedbackElement.style.display = 'flex';
        feedbackElement.style.alignItems = 'flex-start';
        feedbackElement.style.gap = '0.75rem';
        
        // Smooth scroll to feedback
        setTimeout(() => {
            feedbackElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 100);
    }

    async finishQuiz() {
        let correctAnswers = 0;
        this.currentQuiz.questions.forEach((question, index) => {
            if (this.quizAnswers[index] === question.correct) {
                correctAnswers++;
            }
        });

        const score = correctAnswers / this.currentQuiz.questions.length;
        const passed = score >= 0.6; // 60% to pass

        if (passed) {
            const isNewCompletion = this.isClassQuiz ? 
                !((this.currentQuiz.completed_by || []).includes(this.userData.username)) :
                !this.userData.completedQuizzes.includes(this.currentQuiz.id);

            if (isNewCompletion) {
                if (this.isClassQuiz) {
                    // Handle class quiz completion
                    try {
                        const result = await completeQuiz(this.currentQuiz.id, this.userData.username, score, this.userData.currentGroupId);
                        if (result.success && result.newCompletion) {
                            this.userData.quizzesCompleted++;
                            this.addXP(25, 'Completed quiz');

                            // Update Supabase progress
                            await updateUserProgress(
                                this.userData.currentGroupId,
                                this.userData.username,
                                this.userData.xp,
                                this.userData.challengesCompleted,
                                this.userData.quizzesCompleted
                            );
                        }
                    } catch (error) {
                        console.error('Error updating quiz progress in Supabase:', error);
                    }
                } else {
                    // Handle local quiz completion
                    this.userData.completedQuizzes.push(this.currentQuiz.id);
                    this.userData.quizzesCompleted++;

                    // Update challenge progress for quiz completion BEFORE adding XP
                    this.updateChallengeProgress();

                    // Add XP with challenge ID for quiz completion challenge
                    this.addXP(25, 'Completed quiz', 'complete_all_quizzes');

                    // Check and complete quiz champion challenge if applicable
                    this.checkQuizChampionChallenge();
                }
            }
        }

        const resultMessage = passed ? 
            (t('congratulationsPassed') || '🎉 Congratulations! You passed!') : 
            (t('needSixtyPercent') || '😔 You need 60% to pass. Try studying more!');

        document.getElementById('quizContent').innerHTML = `
            <h2>${t('quizComplete') || 'Quiz Complete!'}</h2>
            <div class="quiz-results" style="text-align: center;">
                <h3>${t('yourScore') || 'Your Score'}: ${correctAnswers}/${this.currentQuiz.questions.length}</h3>
                <p>${resultMessage}</p>
                ${passed ? `<p>+25 XP ${t('earned') || 'earned'}!</p>` : ''}
            </div>
            <div style="text-align: center; margin-top: 2rem;">
                <button class="btn btn-primary" onclick="document.getElementById('quizModal').style.display='none'">${t('close')}</button>
            </div>
        `;

        this.saveUserData();
        this.updateDisplay();

        if (this.isClassQuiz) {
            this.loadClassQuizzes();
            this.loadClassLeaderboard();
        } else {
            this.loadQuizzes();
            this.loadChallenges();
        }

        // Reset class quiz flag
        this.isClassQuiz = false;
    }

    checkQuizChampionChallenge() {
        // Check if user has completed all 3 quizzes (quiz champion challenge)
        const totalQuizzes = 3; // We have 3 local quizzes
        if (this.userData.quizzesCompleted >= totalQuizzes) {
            const challengeId = 'complete_all_quizzes';
            if (!this.userData.completedChallenges.includes(challengeId)) {
                this.userData.completedChallenges.push(challengeId);
                this.userData.challengesCompleted++;
                this.userData.challengeProgress[challengeId] = totalQuizzes;
                this.addXP(50, 'Quiz Champion - Completed all quizzes!');
                this.showTranslatedNotification('challengeCompleted', 'quizChampion', 'success');
            }
        }
    }

    // Challenge System
    async loadChallenges() {
        const localChallenges = [
            {
                id: 'track_expenses_3_days',
                title: t('expenseTracker') || 'Expense Tracker',
                description: t('logExpenses3Days') || 'Log expenses for 3 different days',
                target: 3,
                xpReward: 30,
                checkProgress: () => {
                    const uniqueDays = new Set(this.userData.expenses.map(e => e.date));
                    return uniqueDays.size;
                }
            },
            {
                id: 'save_20_euros',
                title: t('save20Euros') || 'Save €20',
                description: t('maintainBalance20') || 'Maintain a positive balance of €20 or more',
                target: 1,
                xpReward: 40,
                checkProgress: () => {
                    return this.calculateBalance() >= 20 ? 1 : 0;
                }
            },
            {
                id: 'add_5_transactions',
                title: t('transactionMaster') || 'Transaction Master',
                description: t('record5Transactions') || 'Record 5 income or expense transactions',
                target: 5,
                xpReward: 25,
                checkProgress: () => {
                    return this.userData.income.length + this.userData.expenses.length;
                }
            },
            {
                id: 'complete_all_quizzes',
                title: t('quizChampion') || 'Quiz Champion',
                description: t('completeAllQuizzes') || 'Complete all available quizzes',
                target: 3,
                xpReward: 50,
                checkProgress: () => {
                    return this.userData.quizzesCompleted;
                }
            },
            {
                id: 'join_class',
                title: t('joinClass') || 'Join Class',
                description: t('joinClassDescription') || 'Join a learning class to unlock collaborative features',
                target: 1,
                xpReward: 30,
                checkProgress: () => {
                    return this.userData.currentGroupId ? 1 : 0;
                }
            },
            {
                id: 'watch_video',
                title: t('watchVideo') || 'Watch Video',
                description: t('watchVideoDescription') || 'Visit educational resources to learn from videos',
                target: 1,
                xpReward: 20,
                checkProgress: () => {
                    return this.userData.visitedEducationalResources ? 1 : 0;
                }
            },
            {
                id: 'use_compound_calculator',
                title: t('useCalculator') || 'Use Calculator',
                description: t('useCalculatorDescription') || 'Use the compound interest calculator to plan your savings',
                target: 1,
                xpReward: 25,
                checkProgress: () => {
                    return this.userData.usedCompoundCalculator ? 1 : 0;
                }
            }
        ];

        this.displayChallenges(localChallenges);
    }

    displayChallenges(challenges) {
        const container = document.getElementById('challengesList');
        if (challenges.length === 0) {
            container.innerHTML = `<p class="no-challenges" data-translate="noChallengesAvailable">${t('noChallengesAvailable')}</p>`;
            return;
        }

        container.innerHTML = challenges.map(challenge => {
            const isCompleted = this.userData.completedChallenges.includes(challenge.id);
            const progress = isCompleted ? challenge.target : challenge.checkProgress();
            const progressPercentage = Math.min((progress / challenge.target) * 100, 100);

            // Check if challenge should be completed
            if (!isCompleted && progress >= challenge.target) {
                this.userData.completedChallenges.push(challenge.id);
                this.userData.challengesCompleted++;
                this.userData.challengeProgress[challenge.id] = progress;
                this.addXP(challenge.xpReward, 'Completed challenge', challenge.id);
                this.saveUserData();
            } else {
                // Update progress even if not completed
                this.userData.challengeProgress[challenge.id] = progress;
            }

            return `
                <div class="challenge-card ${isCompleted ? 'completed' : ''}" data-challenge-id="${challenge.id}">
                    <h3>${challenge.title}</h3>
                    <p>${challenge.description}</p>
                    <div class="challenge-progress">
                        <div class="challenge-progress-fill" style="width: ${progressPercentage}%"></div>
                    </div>
                    <div class="challenge-info">
                        <span>${t('progress') || 'Progress'}: ${progress}/${challenge.target}</span>
                        <span>${t('reward') || 'Reward'}: ${challenge.xpReward} XP</span>
                    </div>
                    ${isCompleted ? `<div class="completed-badge">✅ ${t('completed')}</div>` : ''}
                </div>
            `;
        }).join('');

        this.saveUserData(); // Save updated progress
    }

    // Group System
    updateGroupsPage() {
        if (this.userData.currentGroup) {
            this.showGroupDashboard();
        } else {
            document.getElementById('noGroupSection').style.display = 'block';
            document.getElementById('groupDashboard').style.display = 'none';
        }
    }

    showCreateGroupModal() {
        document.getElementById('groupModalContent').innerHTML = `
            <h2 data-translate="createClass">${t('createClass')}</h2>
            <form id="createGroupForm">
                <input type="text" id="groupName" data-translate-placeholder="className" placeholder="${t('className')}" required>
                <input type="password" id="groupPassword" data-translate-placeholder="classPassword" placeholder="${t('classPassword')}" required>
                <button type="submit" class="btn btn-primary" data-translate="createClass">${t('createClass')}</button>
            </form>
        `;

        document.getElementById('createGroupForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.createGroup();
        });

        document.getElementById('groupModal').style.display = 'block';
    }

    showJoinGroupModal() {
        document.getElementById('groupModalContent').innerHTML = `
            <h2 data-translate="joinClass">${t('joinClass')}</h2>
            <form id="joinGroupForm">
                <input type="text" id="joinGroupName" data-translate-placeholder="classNameOrCode" placeholder="${t('classNameOrCode') || 'Class Name or Code'}" required>
                <input type="password" id="joinGroupPassword" data-translate-placeholder="classPassword" placeholder="${t('classPassword')}" required>
                <button type="submit" class="btn btn-primary" data-translate="joinClass">${t('joinClass')}</button>
            </form>
        `;

        document.getElementById('joinGroupForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.joinGroup();
        });

        document.getElementById('groupModal').style.display = 'block';
    }

    async createGroup() {
        if (!this.userData.isAuthenticated) {
            this.showTranslatedNotification('error', 'pleaseLoginFirst', 'error');
            return;
        }

        const name = document.getElementById('groupName').value.trim();
        const password = document.getElementById('groupPassword').value;

        if (!name || !password) {
            this.showTranslatedNotification('error', 'fillAllFields', 'error');
            return;
        }

        try {
            const result = await createClass(name, password, this.userData.username);

            if (result.success) {
                this.userData.currentGroup = name;
                this.userData.currentGroupId = result.data.id;
                this.saveUserData();

                // Initialize user progress for the class creator
                await updateUserProgress(
                    result.data.id,
                    this.userData.username,
                    this.userData.xp || 0,
                    this.userData.challengesCompleted || 0,
                    this.userData.quizzesCompleted || 0
                );

                document.getElementById('groupModal').style.display = 'none';
                this.showTranslatedNotification('classCreated', `classCreatedMessage. ${t('classCode')}: ${result.data.class_code}`, 'success');
                this.subscribeToClassChanges();
                await this.showGroupDashboard();
            } else {
                if (result.error.includes('already exists')) {
                    this.showTranslatedNotification('error', 'classNameExists', 'error');
                } else {
                    this.showNotification(t('error'), result.error, 'error');
                }
            }
        } catch (error) {
            console.error('Error creating class:', error);
            this.showNotification(t('error'), t('createClassError'), 'error');
        }
    }

    async joinGroup() {
        if (!this.userData.isAuthenticated) {
            this.showTranslatedNotification('error', 'pleaseLoginFirst', 'error');
            return;
        }

        const nameOrCode = document.getElementById('joinGroupName').value.trim();
        const password = document.getElementById('joinGroupPassword').value;

        if (!nameOrCode || !password) {
            this.showTranslatedNotification('error', 'fillAllFields', 'error');
            return;
        }

        try {
            const result = await joinClass(nameOrCode, password, this.userData.username);

            if (result.success) {
                this.userData.currentGroup = result.data.name;
                this.userData.currentGroupId = result.data.id;
                this.saveUserData();

                // Initialize user progress for the class
                await updateUserProgress(
                    result.data.id,
                    this.userData.username,
                    this.userData.xp || 0,
                    this.userData.challengesCompleted || 0,
                    this.userData.quizzesCompleted || 0
                );

                document.getElementById('groupModal').style.display = 'none';
                this.showTranslatedNotification('joinedClass', 'joinedClassMessage', 'success');
                this.subscribeToClassChanges();
                await this.showGroupDashboard();
            } else {
                this.showTranslatedNotification('error', 'classNotFound', 'error');
            }
        } catch (error) {
            console.error('Error joining class:', error);
            this.showNotification(t('error'), t('joinClassError'), 'error');
        }
    }

    async showGroupDashboard() {
        if (!this.userData.currentGroupId) return;

        // Get user role
        const roleResult = await getUserRole(this.userData.currentGroupId, this.userData.username);
        const userRole = roleResult.success ? roleResult.role : 'student';
        const isAdmin = userRole === 'admin';

        // Get class information
        const classResult = await getClassById(this.userData.currentGroupId);
        const classData = classResult.success ? classResult.data : null;

        document.getElementById('noGroupSection').style.display = 'none';
        document.getElementById('groupDashboard').style.display = 'block';
        document.getElementById('groupDashboard').innerHTML = `
            <div class="class-dashboard">
                <div class="class-header">
                    <h2>${this.userData.currentGroup}</h2>
                    ${classData ? `<p class="class-code">${t('classCode')}: <strong>${classData.class_code}</strong></p>` : ''}
                    <div class="user-role-badge ${userRole}">
                        <i class="fas ${isAdmin ? 'fa-crown' : 'fa-user'}"></i>
                        ${isAdmin ? t('admin') || 'Admin' : t('student') || 'Student'}
                    </div>
                </div>

                <div class="class-tabs">
                    <button class="tab-btn active" data-tab="overview">${t('overview') || 'Overview'}</button>
                    <button class="tab-btn" data-tab="quizzes">${t('quizzes')}</button>
                    <button class="tab-btn" data-tab="challenges">${t('challenges')}</button>
                    <button class="tab-btn" data-tab="leaderboard">${t('leaderboard') || 'Leaderboard'}</button>
                    ${isAdmin ? `<button class="tab-btn" data-tab="manage">${t('manage') || 'Manage'}</button>` : ''}
                </div>

                <div class="tab-content">
                    <div id="tab-overview" class="tab-pane active">
                        <div class="class-stats">
                            <div class="stat-card">
                                <h3>${t('yourProgress') || 'Your Progress'}</h3>
                                <p>${t('quizzesCompleted')}: ${this.userData.quizzesCompleted}</p>
                                <p>${t('challengesCompleted')}: ${this.userData.challengesCompleted}</p>
                                <p>${t('totalXP') || 'Total XP'}: ${this.userData.xp}</p>
                            </div>
                        </div>
                    </div>

                    <div id="tab-quizzes" class="tab-pane">
                        <div class="class-section-header">
                            <h3>${t('classQuizzes') || 'Class Quizzes'}</h3>
                            ${isAdmin ? `<button class="btn btn-primary" id="createQuizBtn">${t('createQuiz') || 'Create Quiz'}</button>` : ''}
                        </div>
                        <div id="classQuizzesList"></div>
                    </div>

                    <div id="tab-challenges" class="tab-pane">
                        <div class="class-section-header">
                            <h3>${t('classChallenges') || 'Class Challenges'}</h3>
                            ${isAdmin ? `<button class="btn btn-primary" id="createChallengeBtn">${t('createChallenge') || 'Create Challenge'}</button>` : ''}
                        </div>
                        <div id="classChallengesList"></div>
                    </div>

                    <div id="tab-leaderboard" class="tab-pane">
                        <h3>${t('classLeaderboard') || 'Class Leaderboard'}</h3>
                        <div id="classLeaderboardList"></div>
                    </div>

                    ${isAdmin ? `
                    <div id="tab-manage" class="tab-pane">
                        <h3>${t('classManagement') || 'Class Management'}</h3>
                        <div class="management-actions">
                            <button class="btn btn-danger" id="deleteClassBtn">${t('deleteClass') || 'Delete Class'}</button>
                        </div>
                    </div>
                    ` : ''}
                </div>

                <div class="class-actions">
                    <button class="btn btn-secondary leave-class-btn">${t('leaveClass')}</button>
                </div>
            </div>
        `;

        // Set up tab functionality
        this.setupClassTabs();

        // Set up leave class button
        document.querySelector('.leave-class-btn').addEventListener('click', () => {
            this.showConfirmation(
                t('leaveClass') || 'Leave Class',
                t('leaveClassConfirm') || 'Are you sure you want to leave this class?',
                () => {
                    this.leaveGroup();
                }
            );
        });

        // Load initial content
        this.loadClassQuizzes();
        this.loadClassChallenges();
        this.loadClassLeaderboard();

        // Set up admin functionality
        if (isAdmin) {
            this.setupAdminFunctionality();
        }
    }

    async leaveGroup() {
        if (this.userData.currentGroupId && this.userData.username) {
            try {
                const result = await leaveClass(this.userData.currentGroupId, this.userData.username);
                if (!result.success) {
                    console.error('Error leaving class:', result.error);
                }
            } catch (error) {
                console.error('Error leaving class:', error);
            }
        }

        this.unsubscribeFromClassChanges();
        this.userData.currentGroup = null;
        this.userData.currentGroupId = null;
        this.saveUserData();
        this.updateGroupsPage();
        this.showTranslatedNotification('leftClass', 'leftClassMessage', 'info');
    }

    setupClassTabs() {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                // Remove active class from all tabs and panes
                document.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));

                // Add active class to clicked tab and corresponding pane
                btn.classList.add('active');
                document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
            });
        });
    }

    setupAdminFunctionality() {
        // Create quiz button
        document.getElementById('createQuizBtn')?.addEventListener('click', () => {
            this.showCreateQuizModal();
        });

        // Create challenge button
        document.getElementById('createChallengeBtn')?.addEventListener('click', () => {
            this.showCreateChallengeModal();
        });

        // Delete class button
        document.getElementById('deleteClassBtn')?.addEventListener('click', () => {
            this.showConfirmation(
                t('deleteClass') || 'Delete Class',
                t('deleteClassConfirm') || 'Are you sure you want to delete this class? This action cannot be undone.',
                () => this.deleteClass()
            );
        });
    }

    async loadClassQuizzes() {
        if (!this.userData.currentGroupId) return;

        try {
            const result = await getQuizzesForClass(this.userData.currentGroupId);
            if (result.success) {
                this.displayClassQuizzes(result.data);
            }
        } catch (error) {
            console.error('Error loading class quizzes:', error);
        }
    }

    displayClassQuizzes(quizzes) {
        const container = document.getElementById('classQuizzesList');
        if (!container) return;

        if (quizzes.length === 0) {
            container.innerHTML = `<p class="no-content">${t('noQuizzesYet') || 'No quizzes created yet.'}</p>`;
            return;
        }

        container.innerHTML = quizzes.map(quiz => {
            const isCompleted = (quiz.completed_by || []).includes(this.userData.username);
            return `
                <div class="quiz-card ${isCompleted ? 'completed' : ''}" data-quiz-id="${quiz.id}">
                    <h4>${quiz.title}</h4>
                    <p>${quiz.questions.length} ${t('questions')}</p>
                    <div class="quiz-actions">
                        ${isCompleted 
                            ? `<span class="completed-badge">✅ ${t('completed')}</span>` 
                            : `<button class="btn btn-primary quiz-start-btn">${t('startQuiz')}</button>`
                        }
                    </div>
                </div>
            `;
        }).join('');

        // Add event listeners for quiz start buttons
        document.querySelectorAll('.quiz-start-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const quizId = e.target.closest('.quiz-card').dataset.quizId;
                const quiz = quizzes.find(q => q.id === quizId);
                this.startClassQuiz(quiz);
            });
        });
    }

    async loadClassChallenges() {
        if (!this.userData.currentGroupId) return;

        try {
            const result = await getChallengesForClass(this.userData.currentGroupId);
            if (result.success) {
                this.displayClassChallenges(result.data);
            }
        } catch (error) {
            console.error('Error loading class challenges:', error);
        }
    }

    displayClassChallenges(challenges) {
        const container = document.getElementById('classChallengesList');
        if (!container) return;

        if (challenges.length === 0) {
            container.innerHTML = `<p class="no-content">${t('noChallengesYet') || 'No challenges created yet.'}</p>`;
            return;
        }

        container.innerHTML = challenges.map(challenge => {
            const isCompleted = (challenge.completed_by || []).includes(this.userData.username);
            return `
                <div class="challenge-card ${isCompleted ? 'completed' : ''}" data-challenge-id="${challenge.id}">
                    <h4>${challenge.title}</h4>
                    <p>${challenge.description}</p>
                    <div class="challenge-actions">
                        ${isCompleted 
                            ? `<span class="completed-badge">✅ ${t('completed')}</span>` 
                            : `<button class="btn btn-primary complete-challenge-btn">${t('markComplete') || 'Mark Complete'}</button>`
                        }
                    </div>
                </div>
            `;
        }).join('');

        // Add event listeners for challenge completion
        document.querySelectorAll('.complete-challenge-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const challengeId = e.target.closest('.challenge-card').dataset.challengeId;
                this.completeChallengeInSupabase(challengeId);
            });
        });
    }

    async loadClassLeaderboard() {
        if (!this.userData.currentGroupId) return;

        try {
            const result = await getClassLeaderboard(this.userData.currentGroupId);
            if (result.success) {
                this.displayClassLeaderboard(result.data);
            }
        } catch (error) {
            console.error('Error loading class leaderboard:', error);
        }
    }

    displayClassLeaderboard(leaderboardData) {
        const container = document.getElementById('classLeaderboardList');
        if (!container) return;

        if (leaderboardData.length === 0) {
            container.innerHTML = `<p class="no-content">${t('noProgressYet') || 'No progress data yet.'}</p>`;
            return;
        }

        container.innerHTML = `
            <div class="leaderboard">
                ${leaderboardData.map((user, index) => `
                    <div class="leaderboard-item ${user.username === this.userData.username ? 'current-user' : ''}">
                        <div class="rank">#${index + 1}</div>
                        <div class="user-info">
                            <span class="username">${user.username}</span>
                            <span class="role-badge ${user.role}">${user.role}</span>
                        </div>
                        <div class="stats">
                            <span class="xp">${user.xp || 0} XP</span>
                            <span class="quizzes">${user.quizzes_completed || 0} ${t('quizzes')}</span>
                            <span class="challenges">${user.challenges_completed || 0} ${t('challenges')}</span>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    async startClassQuiz(quiz) {
        this.currentQuiz = quiz;
        this.currentQuestionIndex = 0;
        this.quizAnswers = [];
        this.isClassQuiz = true;

        this.showQuizQuestion();
        document.getElementById('quizModal').style.display = 'block';
    }

    async completeChallengeInSupabase(challengeId) {
        try {
            const result = await completeChallenge(challengeId, this.userData.username);
            if (result.success) {
                this.userData.challengesCompleted++;
                this.addXP(25, 'Completed challenge');
                this.saveUserData();

                // Update progress in Supabase
                await updateUserProgress(
                    this.userData.currentGroupId,
                    this.userData.username,
                    this.userData.xp,
                    this.userData.challengesCompleted,
                    this.userData.quizzesCompleted
                );

                this.showTranslatedNotification('challengeCompleted', 'challengeCompletedMessage', 'success');
                this.loadClassChallenges(); // Refresh challenges
                this.loadClassLeaderboard(); // Refresh leaderboard
            } else {
                this.showNotification(t('error'), result.error, 'error');
            }
        } catch (error) {
            console.error('Error completing challenge:', error);
            this.showNotification(t('error'), t('failedToComplete') || 'Failed to complete challenge.', 'error');
        }
    }

    showCreateQuizModal() {
        document.getElementById('groupModalContent').innerHTML = `
            <h2>${t('createQuiz') || 'Create Quiz'}</h2>
            <form id="createQuizForm">
                <input type="text" id="quizTitle" placeholder="${t('quizTitle') || 'Quiz Title'}" required>
                <div id="questionsContainer">
                    <div class="question-group" data-question="0">
                        <h4>${t('question')} 1</h4>
                        <input type="text" class="question-text" placeholder="${t('questionText') || 'Question text'}" required>
                        <div class="options-container">
                            <input type="text" class="option" placeholder="${t('option')} 1" required>
                            <input type="text" class="option" placeholder="${t('option')} 2" required>
                            <input type="text" class="option" placeholder="${t('option')} 3" required>
                        </div>
                        <select class="correct-answer" required>
                            <option value="">${t('selectCorrect') || 'Select correct answer'}</option>
                            <option value="0">${t('option')} 1</option>
                            <option value="1">${t('option')} 2</option>
                            <option value="2">${t('option')} 3</option>
                        </select>
                        <button type="button" class="btn btn-danger remove-question">${t('remove') || 'Remove'}</button>
                    </div>
                </div>
                <button type="button" id="addQuestionBtn" class="btn btn-secondary">${t('addQuestion') || 'Add Question'}</button>
                <button type="submit" class="btn btn-primary">${t('createQuiz')}</button>
            </form>
        `;

        let questionCount = 1;
        document.getElementById('addQuestionBtn').addEventListener('click', () => {
            if (questionCount < 5) { // Limit to 5 questions
                questionCount++;
                const questionsContainer = document.getElementById('questionsContainer');
                const questionHTML = `
                    <div class="question-group" data-question="${questionCount - 1}">
                        <h4>${t('question')} ${questionCount}</h4>
                        <input type="text" class="question-text" placeholder="${t('questionText') || 'Question text'}" required>
                        <div class="options-container">
                            <input type="text" class="option" placeholder="${t('option')} 1" required>
                            <input type="text" class="option" placeholder="${t('option')} 2" required>
                            <input type="text" class="option" placeholder="${t('option')} 3" required>
                        </div>
                        <select class="correct-answer" required>
                            <option value="">${t('selectCorrect') || 'Select correct answer'}</option>
                            <option value="0">${t('option')} 1</option>
                            <option value="1">${t('option')} 2</option>
                            <option value="2">${t('option')} 3</option>
                        </select>
                        <button type="button" class="btn btn-danger remove-question">${t('remove') || 'Remove'}</button>
                    </div>
                `;
                questionsContainer.insertAdjacentHTML('beforeend', questionHTML);

                // Add remove functionality
                questionsContainer.lastElementChild.querySelector('.remove-question').addEventListener('click', (e) => {
                    e.target.closest('.question-group').remove();
                    questionCount--;
                });
            }
        });

        document.getElementById('createQuizForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.createClassQuiz();
        });

        document.getElementById('groupModal').style.display = 'block';
    }

    async createClassQuiz() {
        const title = document.getElementById('quizTitle').value.trim();
        const questionGroups = document.querySelectorAll('.question-group');

        const questions = [];
        questionGroups.forEach(group => {
            const questionText = group.querySelector('.question-text').value.trim();
            const options = Array.from(group.querySelectorAll('.option')).map(input => input.value.trim());
            const correct = parseInt(group.querySelector('.correct-answer').value);

            if (questionText && options.every(opt => opt) && !isNaN(correct)) {
                questions.push({
                    question: questionText,
                    options: options,
                    correct: correct
                });
            }
        });

        if (!title || questions.length === 0) {
            this.showNotification(t('error'), t('fillAllFields'), 'error');
            return;
        }

        try {
            const result = await createQuiz(this.userData.currentGroupId, title, questions);
            if (result.success) {
                document.getElementById('groupModal').style.display = 'none';
                this.showTranslatedNotification('quizCreated', 'quizCreatedMessage', 'success');
                this.loadClassQuizzes();
            } else {
                this.showNotification(t('error'), result.error, 'error');
            }
        } catch (error) {
            console.error('Error creating quiz:', error);
            this.showNotification(t('error'), t('failedToCreateQuiz') || 'Failed to create quiz.', 'error');
        }
    }

    showCreateChallengeModal() {
        document.getElementById('groupModalContent').innerHTML = `
            <h2>${t('createChallenge') || 'Create Challenge'}</h2>
            <form id="createChallengeForm">
                <input type="text" id="challengeTitle" placeholder="${t('challengeTitle') || 'Challenge Title'}" required>
                <textarea id="challengeDescription" placeholder="${t('challengeDescription') || 'Challenge Description'}" rows="4" required></textarea>
                <button type="submit" class="btn btn-primary">${t('createChallenge')}</button>
            </form>
        `;

        document.getElementById('createChallengeForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.createClassChallenge();
        });

        document.getElementById('groupModal').style.display = 'block';
    }

    async createClassChallenge() {
        const title = document.getElementById('challengeTitle').value.trim();
        const description = document.getElementById('challengeDescription').value.trim();

        if (!title || !description) {
            this.showNotification(t('error'), t('fillAllFields'), 'error');
            return;
        }

        try {
            const result = await createChallenge(this.userData.currentGroupId, title, description);
            if (result.success) {
                document.getElementById('groupModal').style.display = 'none';
                this.showTranslatedNotification('challengeCreated', 'challengeCreatedMessage', 'success');
                this.loadClassChallenges();
            } else {
                this.showNotification(t('error'), result.error, 'error');
            }
        } catch (error) {
            console.error('Error creating challenge:', error);
            this.showNotification(t('error'), t('failedToCreateChallenge') || 'Failed to create challenge.', 'error');
        }
    }


    async deleteClass() {
        // This would require a new Supabase function to delete a class
        this.showNotification(t('info'), t('featureComingSoon') || 'This feature is coming soon.', 'info');
    }

    // Profile Management
    updateProfilePage() {
        // Profile is updated through updateDisplay()
        this.setupProfileLanguageSelector();
    }

    setupProfileLanguageSelector() {
        const profileLangSelect = document.getElementById('profileLanguageSelect');
        if (profileLangSelect) {
            // Set current language
            profileLangSelect.value = getCurrentLanguage();

            // Add change listener
            profileLangSelect.removeEventListener('change', this.handleProfileLanguageChange);
            profileLangSelect.addEventListener('change', this.handleProfileLanguageChange.bind(this));
        }
    }

    handleProfileLanguageChange(e) {
        setLanguage(e.target.value);
        this.updatePageTranslations();
        this.updateCharts(); // Redraw charts with new language
    }

    // AI Assistant Methods

    async handleAIQuestion() {
        const input = document.getElementById('aiQuestionInput');
        const question = input.value.trim();

        if (!question) return;

        // Validate question length
        if (question.length > 500) {
            this.showTranslatedNotification('error', 'aiQuestionTooLong', 'error');
            return;
        }

        input.value = '';

        // Add user message to chat
        this.addAIMessage(question, '', 'user');
        this.showAITyping();

        // Store question in session for potential retry
        this.lastAIQuestion = question;

        try {
            const response = await this.callOpenAI(question);
            this.hideAITyping();

            // Validate response before displaying
            if (response && typeof response === 'string' && response.trim()) {
                this.addAIMessage('', response, 'ai');
                this.saveAIConversation(question, response);
            } else {
                throw new Error('Empty or invalid response received');
            }
        } catch (error) {
            console.error('AI Error Details:', {
                message: error.message,
                stack: error.stack,
                name: error.name,
                question: question
            });

            this.hideAITyping();

            let errorMessage = this.getLocalizedAIError(error.message);
            this.addAIMessage('', errorMessage, 'ai', true); // true indicates error message
        }
    }

    getLocalizedAIError(errorMessage) {
        console.log('Processing error message:', errorMessage);

        if (errorMessage.includes('API key') || errorMessage.includes('not configured') || errorMessage.includes('insufficient permissions')) {
            return t('aiErrorConfig') || 'AI service is not configured properly. Please contact support.';
        } else if (errorMessage.includes('model not found') || errorMessage.includes('not accessible')) {
            return t('aiErrorModel') || 'AI model is not available. Please try again later or contact support.';
        } else if (errorMessage.includes('Rate limit exceeded') || errorMessage.includes('429')) {
            return t('aiErrorBusy') || 'AI service is busy. Please wait a moment and try again.';
        } else if (errorMessage.includes('temporarily unavailable') || errorMessage.includes('503') || errorMessage.includes('internal error')) {
            return t('aiErrorUnavailable') || 'AI service is temporarily unavailable. Please try again later.';
        } else if (errorMessage.includes('connect') || errorMessage.includes('404') || errorMessage.includes('network') || errorMessage.includes('ENOTFOUND')) {
            return t('aiErrorConnection') || 'Unable to connect to AI service. Please check your connection and try again.';
        } else if (errorMessage.includes('Empty or invalid response')) {
            return t('aiErrorInvalid') || 'I received an incomplete response. Please try rephrasing your question.';
        } else if (errorMessage.includes('Backend server error') || errorMessage.includes('500')) {
            return t('aiErrorBackend') || 'Server error occurred. Please try again in a moment.';
        } else {
            return t('aiErrorGeneral') || 'I apologize, but I encountered an error. Please try asking your question again.';
        }
    }

    saveAIConversation(question, response) {
        if (!this.userData.aiHistory) {
            this.userData.aiHistory = [];
        }

        this.userData.aiHistory.push({
            question: question,
            response: response,
            timestamp: new Date().toISOString(),
            language: getCurrentLanguage()
        });

        // Keep only last 10 conversations to avoid localStorage bloat
        if (this.userData.aiHistory.length > 10) {
            this.userData.aiHistory = this.userData.aiHistory.slice(-10);
        }

        this.saveUserData();
    }

    handleSuggestionClick(questionType) {
        let question = '';
        switch (questionType) {
            case 'analyze-spending':
                question = t('analyzeSpending');
                break;
            case 'save-money':
                question = t('howToSave');
                break;
            case 'budget-tips':
                question = t('budgetTips');
                break;
        }

        document.getElementById('aiQuestionInput').value = question;
        this.handleAIQuestion();
    }

    async callOpenAI(userQuestion) {
        // Create financial context from user data
        const financialData = this.createFinancialContext();
        const currentLanguage = getCurrentLanguage();

        try {
            console.log('Sending AI request to serverless API...');

            // Call serverless API endpoint
            const response = await fetch('/api/ask-ai', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    question: userQuestion,
                    financialData: financialData,
                    language: currentLanguage
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
                throw new Error(errorData.error || `Server error: ${response.status}`);
            }

            const data = await response.json();
            console.log('AI Response received:', data.response);

            if (!data.response || typeof data.response !== 'string' || !data.response.trim()) {
                throw new Error('No valid response content received from AI service');
            }

            return data.response;
        } catch (error) {
            console.error('AI Service Error:', error);

            // Enhanced error handling with more specific messages
            if (error.message.includes('API key') || error.message.includes('not configured') || error.message.includes('authentication')) {
                throw new Error(t('aiErrorConfig') || 'AI service is not configured properly. Please check your API key.');
            } else if (error.message.includes('model not found') || error.message.includes('not accessible') || error.message.includes('503')) {
                throw new Error(t('aiErrorModel') || 'AI model is not available. Please try again later.');
            } else if (error.message.includes('Rate limit exceeded') || error.message.includes('limit') || error.message.includes('429')) {
                throw new Error(t('aiErrorBusy') || 'AI service is busy. Please wait a moment and try again.');
            } else if (error.message.includes('temporarily unavailable') || error.message.includes('internal error')) {
                throw new Error(t('aiErrorUnavailable') || 'AI service is temporarily unavailable. Please try again later.');
            } else if (error.message.includes('connect') || error.message.includes('network') || error.message.includes('Failed to fetch')) {
                throw new Error(t('aiErrorConnection') || 'Unable to connect to AI service. Please check your connection and try again.');
            } else if (error.message.includes('Empty or invalid response')) {
                throw new Error(t('aiErrorInvalid') || 'I received an incomplete response. Please try rephrasing your question.');
            } else {
                throw new Error(t('aiErrorGeneral') || 'I apologize, but I encountered an error. Please try asking your question again.');
            }
        }
    }

    createFinancialContext() {
        const totalIncome = this.userData.income.reduce((sum, item) => sum + item.amount, 0);
        const totalExpenses = this.userData.expenses.reduce((sum, item) => sum + item.amount, 0);
        const balance = totalIncome - totalExpenses;

        // Analyze expense categories
        const expenseCategories = {};
        this.userData.expenses.forEach(expense => {
            expenseCategories[expense.category] = (expenseCategories[expense.category] || 0) + expense.amount;
        });

        // Analyze income sources
        const incomeCategories = {};
        this.userData.income.forEach(income => {
            incomeCategories[income.category] = (incomeCategories[income.category] || 0) + income.amount;
        });

        return `
Total Income: €${totalIncome.toFixed(2)}
Total Expenses: €${totalExpenses.toFixed(2)}
Current Balance: €${balance.toFixed(2)}

Expense Breakdown:
${Object.entries(expenseCategories).map(([category, amount]) => 
    `- ${this.getCategoryDisplayName(category, 'expense')}: €${amount.toFixed(2)}`
).join('\n')}

Income Sources:
${Object.entries(incomeCategories).map(([category, amount]) => 
    `- ${this.getCategoryDisplayName(category, 'income')}: €${amount.toFixed(2)}`
).join('\n')}

Recent Transactions: ${this.userData.income.length + this.userData.expenses.length}
User Level: ${this.calculateLevel()}
XP: ${this.userData.xp}
        `.trim();
    }

    addUserMessage(message) {
        const chatHistory = document.getElementById('aiChatHistory');
        const messageDiv = document.createElement('div');
        messageDiv.className = 'user-message';
        messageDiv.innerHTML = `
            <div class="user-avatar">👤</div>
            <div class="user-content">${this.escapeHtml(message)}</div>
        `;
        chatHistory.appendChild(messageDiv);
        chatHistory.scrollTop = chatHistory.scrollHeight;
    }

    addAIMessage(userQuestion, aiResponse, sender, isError = false) {
        const chatHistory = document.getElementById('aiChatHistory');

        if (sender === 'user' && userQuestion) {
            const userDiv = document.createElement('div');
            userDiv.className = 'user-message';
            userDiv.innerHTML = `
                <div class="user-avatar">👤</div>
                <div class="user-content">${this.escapeHtml(userQuestion)}</div>
            `;
            chatHistory.appendChild(userDiv);
        }

        if (sender === 'ai' && aiResponse) {
            const aiDiv = document.createElement('div');
            aiDiv.className = `ai-message${isError ? ' error-message' : ''}`;

            let actionButtons = '';
            if (isError && this.lastAIQuestion) {
                actionButtons = `
                    <div class="ai-actions">
                        <button class="retry-btn btn btn-sm btn-secondary" onclick="app.retryLastAIQuestion()">
                            <i class="fas fa-redo"></i> ${t('retry') || 'Retry'}
                        </button>
                    </div>
                `;
            }

            aiDiv.innerHTML = `
                <div class="ai-avatar">${isError ? '⚠️' : '🤖'}</div>
                <div class="ai-content">
                    ${this.escapeHtml(aiResponse)}
                    ${actionButtons}
                </div>
            `;
            chatHistory.appendChild(aiDiv);
        }

        chatHistory.scrollTop = chatHistory.scrollHeight;
    }

    async retryLastAIQuestion() {
        if (this.lastAIQuestion) {
            document.getElementById('aiQuestionInput').value = this.lastAIQuestion;
            await this.handleAIQuestion();
        }
    }

    clearAIChat() {
        const chatHistory = document.getElementById('aiChatHistory');
        chatHistory.innerHTML = `
            <div class="ai-message">
                <div class="ai-avatar">🤖</div>
                <div class="ai-content">
                    <span data-translate="aiWelcomeMessage">${t('aiWelcomeMessage')}</span>
                </div>
            </div>
        `;
        this.lastAIQuestion = null;
        if (this.userData.aiHistory) {
            this.userData.aiHistory = [];
            this.saveUserData();
        }
    }

    showAITyping() {
        const chatHistory = document.getElementById('aiChatHistory');
        const typingDiv = document.createElement('div');
        typingDiv.className = 'ai-message ai-typing';
        typingDiv.id = 'ai-typing-indicator';
        typingDiv.innerHTML = `
            <div class="ai-avatar">🤖</div>
            <div class="ai-content">
                <span>${t('aiThinking')}</span>
                <div class="typing-dots">
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
            </div>
        `;
        chatHistory.appendChild(typingDiv);
        chatHistory.scrollTop = chatHistory.scrollHeight;
    }

    hideAITyping() {
        const typingIndicator = document.getElementById('ai-typing-indicator');
        if (typingIndicator) {
            typingIndicator.remove();
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    resetAllData() {
        this.unsubscribeFromClassChanges();
        localStorage.removeItem('financquest_user');
        localStorage.removeItem('financquest_groups');
        location.reload();
    }

    // Compound Interest Calculator
    setupCompoundCalculator() {
        const calculatorMode = document.getElementById('calculatorMode');
        const calculatorForm = document.getElementById('compoundCalculatorForm');

        if (calculatorMode) {
            calculatorMode.addEventListener('change', () => {
                this.updateCalculatorInputs(calculatorMode.value);
            });
        }

        if (calculatorForm) {
            calculatorForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.calculateCompoundInterest();
            });
        }
    }

    updateCalculatorInputs(mode) {
        const periodicContributionGroup = document.getElementById('periodicContributionGroup');
        const annualRateGroup = document.getElementById('annualRateGroup');
        const yearsGroup = document.getElementById('yearsGroup');
        const targetAmountGroup = document.getElementById('targetAmountGroup');

        // Reset all groups to visible
        [periodicContributionGroup, annualRateGroup, yearsGroup, targetAmountGroup].forEach(group => {
            if (group) group.style.display = 'block';
        });

        // Hide specific inputs based on calculation mode
        switch (mode) {
            case 'finalCapital':
                if (targetAmountGroup) targetAmountGroup.style.display = 'none';
                break;
            case 'timeToGoal':
                if (targetAmountGroup) targetAmountGroup.style.display = 'block';
                if (yearsGroup) yearsGroup.style.display = 'none';
                break;
            case 'requiredContribution':
                if (targetAmountGroup) targetAmountGroup.style.display = 'block';
                if (periodicContributionGroup) periodicContributionGroup.style.display = 'none';
                break;
            case 'requiredRate':
                if (targetAmountGroup) targetAmountGroup.style.display = 'block';
                if (annualRateGroup) annualRateGroup.style.display = 'none';
                break;
        }
    }

    calculateCompoundInterest() {
        try {
            const mode = document.getElementById('calculatorMode').value;
            const inputs = this.getCalculatorInputs();

            if (!this.validateCalculatorInputs(inputs, mode)) {
                return;
            }

            let result;
            switch (mode) {
                case 'finalCapital':
                    result = this.calculateFinalCapital(inputs);
                    break;
                case 'timeToGoal':
                    result = this.calculateTimeToGoal(inputs);
                    break;
                case 'requiredContribution':
                    result = this.calculateRequiredContribution(inputs);
                    break;
                case 'requiredRate':
                    result = this.calculateRequiredRate(inputs);
                    break;
            }

            if (result) {
                // Track calculator usage for challenge
                if (!this.userData.usedCompoundCalculator) {
                    this.userData.usedCompoundCalculator = true;
                    this.saveUserData();
                }
                
                this.displayCalculatorResults(result, inputs, mode);
            }

        } catch (error) {
            console.error('Calculator error:', error);
            this.showNotification('Error', 'An error occurred during calculation. Please check your inputs.', 'error');
        }
    }

    getCalculatorInputs() {
        const initialCapital = parseFloat(document.getElementById('initialCapital').value) || 0;
        const periodicContribution = parseFloat(document.getElementById('periodicContribution').value) || 0;
        const contributionFrequency = document.getElementById('contributionFrequency').value;
        const paymentTiming = document.getElementById('paymentTiming').value;
        const annualRate = parseFloat(document.getElementById('annualRate').value) || 0;
        const years = parseFloat(document.getElementById('years').value) || 0;
        const targetAmount = parseFloat(document.getElementById('targetAmount').value) || 0;

        // Calculate periods per year and interest rate per period
        const periodsPerYear = contributionFrequency === 'monthly' ? 12 : contributionFrequency === 'quarterly' ? 4 : 1;
        const interestPerPeriod = annualRate / 100 / periodsPerYear;
        const totalPeriods = years * periodsPerYear;

        return {
            initialCapital,
            periodicContribution,
            contributionFrequency,
            paymentTiming,
            annualRate,
            years,
            targetAmount,
            periodsPerYear,
            interestPerPeriod,
            totalPeriods
        };
    }

    validateCalculatorInputs(inputs, mode) {
        const { initialCapital, periodicContribution, annualRate, years, targetAmount } = inputs;

        if (initialCapital < 0 || periodicContribution < 0 || annualRate < 0 || years < 0 || targetAmount < 0) {
            this.showNotification('Invalid Input', 'All values must be non-negative.', 'error');
            return false;
        }

        if (mode === 'timeToGoal' && targetAmount <= initialCapital && periodicContribution === 0) {
            this.showNotification('Invalid Input', 'Target amount must be greater than initial capital when no contributions are made.', 'error');
            return false;
        }

        return true;
    }

    calculateFinalCapital(inputs) {
        const { initialCapital, periodicContribution, interestPerPeriod, totalPeriods, paymentTiming } = inputs;

        if (interestPerPeriod === 0) {
            // Simple case: no interest
            const finalAmount = initialCapital + (periodicContribution * totalPeriods);
            return {
                finalAmount,
                totalContributions: periodicContribution * totalPeriods,
                totalInterest: 0,
                evolution: this.generateEvolutionData(inputs, finalAmount)
            };
        }

        // Calculate future value of initial capital
        const futureValuePrincipal = initialCapital * Math.pow(1 + interestPerPeriod, totalPeriods);

        // Calculate future value of annuity
        let futureValueAnnuity = 0;
        if (periodicContribution > 0) {
            const annuityFactor = (Math.pow(1 + interestPerPeriod, totalPeriods) - 1) / interestPerPeriod;
            futureValueAnnuity = periodicContribution * annuityFactor;

            // Adjust for beginning of period payments (annuity due)
            if (paymentTiming === 'beginning') {
                futureValueAnnuity *= (1 + interestPerPeriod);
            }
        }

        const finalAmount = futureValuePrincipal + futureValueAnnuity;
        const totalContributions = periodicContribution * totalPeriods;
        const totalInterest = finalAmount - initialCapital - totalContributions;

        return {
            finalAmount,
            totalContributions,
            totalInterest,
            evolution: this.generateEvolutionData(inputs, finalAmount)
        };
    }

    calculateTimeToGoal(inputs) {
        const { initialCapital, periodicContribution, interestPerPeriod, targetAmount, paymentTiming, periodsPerYear } = inputs;

        if (targetAmount <= initialCapital) {
            return {
                requiredTime: 0,
                finalAmount: targetAmount,
                totalContributions: 0,
                totalInterest: targetAmount - initialCapital,
                evolution: []
            };
        }

        if (interestPerPeriod === 0) {
            // Simple case: no interest
            const periodsNeeded = (targetAmount - initialCapital) / periodicContribution;
            const years = periodsNeeded / periodsPerYear;
            return {
                requiredTime: years,
                finalAmount: targetAmount,
                totalContributions: periodicContribution * periodsNeeded,
                totalInterest: 0,
                evolution: this.generateEvolutionDataForTime(inputs, periodsNeeded)
            };
        }

        // Newton-Raphson method to solve for n
        const tolerance = 1e-6;
        const maxIterations = 100;
        let n = 10; // Initial guess

        for (let i = 0; i < maxIterations; i++) {
            const pv = initialCapital;
            const pmt = periodicContribution * (paymentTiming === 'beginning' ? 1 + interestPerPeriod : 1);
            const r = interestPerPeriod;
            const fv = targetAmount;

            // f(n) = PV(1+r)^n + PMT*((1+r)^n - 1)/r - FV
            const fn = pv * Math.pow(1 + r, n) + pmt * (Math.pow(1 + r, n) - 1) / r - fv;
            
            // f'(n) derivative
            const dfn = pv * Math.pow(1 + r, n) * Math.log(1 + r) + 
                       pmt * (Math.pow(1 + r, n) * Math.log(1 + r) / r);

            const newN = n - fn / dfn;

            if (Math.abs(newN - n) < tolerance) {
                const years = newN / periodsPerYear;
                const result = this.calculateFinalCapital({...inputs, totalPeriods: newN, years});
                return {
                    requiredTime: years,
                    ...result
                };
            }

            n = newN;

            if (n < 0 || n > 60 * periodsPerYear) {
                break;
            }
        }

        this.showNotification('Calculation Error', 'Unable to reach target with given parameters.', 'warning');
        return null;
    }

    calculateRequiredContribution(inputs) {
        const { initialCapital, interestPerPeriod, totalPeriods, targetAmount, paymentTiming } = inputs;

        if (interestPerPeriod === 0) {
            // Simple case: no interest
            const requiredContribution = (targetAmount - initialCapital) / totalPeriods;
            return {
                requiredContribution,
                finalAmount: targetAmount,
                totalContributions: requiredContribution * totalPeriods,
                totalInterest: 0,
                evolution: this.generateEvolutionData({...inputs, periodicContribution: requiredContribution}, targetAmount)
            };
        }

        // Calculate required annuity payment
        const futureValuePrincipal = initialCapital * Math.pow(1 + interestPerPeriod, totalPeriods);
        const remainingAmount = targetAmount - futureValuePrincipal;

        const annuityFactor = (Math.pow(1 + interestPerPeriod, totalPeriods) - 1) / interestPerPeriod;
        let requiredContribution = remainingAmount / annuityFactor;

        // Adjust for beginning of period payments
        if (paymentTiming === 'beginning') {
            requiredContribution /= (1 + interestPerPeriod);
        }

        const result = this.calculateFinalCapital({...inputs, periodicContribution: requiredContribution});
        return {
            requiredContribution,
            ...result
        };
    }

    calculateRequiredRate(inputs) {
        const { initialCapital, periodicContribution, totalPeriods, targetAmount, paymentTiming } = inputs;

        // Newton-Raphson method to solve for interest rate
        const tolerance = 1e-6;
        const maxIterations = 100;
        let r = 0.05; // Initial guess: 5%

        for (let i = 0; i < maxIterations; i++) {
            const pv = initialCapital;
            const pmt = periodicContribution * (paymentTiming === 'beginning' ? 1 : 0);
            const pmtEnd = periodicContribution * (paymentTiming === 'beginning' ? 0 : 1);
            const n = totalPeriods;
            const fv = targetAmount;

            // Calculate function and derivative
            const powerTerm = Math.pow(1 + r, n);
            let fn, dfn;

            if (Math.abs(r) < 1e-10) {
                // Handle r ≈ 0 case
                fn = pv + periodicContribution * n - fv;
                dfn = 0;
            } else {
                const annuityTerm = (powerTerm - 1) / r;
                fn = pv * powerTerm + pmtEnd * annuityTerm + pmt * annuityTerm * (1 + r) - fv;
                
                const dPowerTerm = n * Math.pow(1 + r, n - 1);
                const dAnnuityTerm = (dPowerTerm * r - (powerTerm - 1)) / (r * r);
                dfn = pv * dPowerTerm + pmtEnd * dAnnuityTerm + pmt * (dAnnuityTerm * (1 + r) + annuityTerm);
            }

            if (Math.abs(dfn) < 1e-15) break;

            const newR = r - fn / dfn;

            if (Math.abs(newR - r) < tolerance) {
                const annualRate = newR * inputs.periodsPerYear * 100;
                const result = this.calculateFinalCapital({...inputs, interestPerPeriod: newR, annualRate: annualRate});
                return {
                    requiredRate: annualRate,
                    ...result
                };
            }

            r = newR;

            if (r < -0.99 || r > 2) {
                break;
            }
        }

        this.showNotification('Calculation Error', 'Unable to find required interest rate with given parameters.', 'warning');
        return null;
    }

    generateEvolutionData(inputs, finalAmount) {
        const { initialCapital, periodicContribution, interestPerPeriod, totalPeriods, paymentTiming, periodsPerYear } = inputs;
        const evolution = [];
        let balance = initialCapital;

        const periodsPerDataPoint = Math.max(1, Math.floor(periodsPerYear)); // Annual data points
        
        for (let period = 0; period <= totalPeriods; period += periodsPerDataPoint) {
            const actualPeriods = Math.min(period, totalPeriods);
            const year = Math.floor(actualPeriods / periodsPerYear);
            
            let yearlyContribution = 0;
            let yearlyInterest = 0;
            let periodBalance = balance;

            // Calculate year's worth of periods
            const periodsThisYear = Math.min(periodsPerDataPoint, totalPeriods - period + periodsPerDataPoint);
            
            for (let p = 0; p < periodsThisYear && actualPeriods + p <= totalPeriods; p++) {
                const periodInterest = periodBalance * interestPerPeriod;
                yearlyInterest += periodInterest;

                if (paymentTiming === 'beginning') {
                    periodBalance += periodicContribution;
                    yearlyContribution += periodicContribution;
                }

                periodBalance += periodInterest;

                if (paymentTiming === 'end') {
                    periodBalance += periodicContribution;
                    yearlyContribution += periodicContribution;
                }
            }

            evolution.push({
                year: year,
                initialBalance: balance,
                contribution: yearlyContribution,
                interest: yearlyInterest,
                finalBalance: periodBalance
            });

            balance = periodBalance;
            
            if (actualPeriods >= totalPeriods) break;
        }

        return evolution;
    }

    generateEvolutionDataForTime(inputs, totalPeriods) {
        return this.generateEvolutionData({...inputs, totalPeriods}, 0);
    }

    displayCalculatorResults(result, inputs, mode) {
        const resultsContainer = document.getElementById('calculatorResults');
        const finalAmountResult = document.getElementById('finalAmountResult');
        const totalContributionsResult = document.getElementById('totalContributionsResult');
        const totalInterestResult = document.getElementById('totalInterestResult');
        const initialBalanceResult = document.getElementById('initialBalanceResult');
        const calculationSummary = document.getElementById('calculationSummary');

        // Format currency
        const formatCurrency = (amount) => `€${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        const formatNumber = (num, decimals = 2) => num.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

        // Update initial balance result
        if (initialBalanceResult) {
            initialBalanceResult.textContent = formatCurrency(inputs.initialCapital);
        }

        // Update calculation summary with dynamic content based on mode
        if (calculationSummary) {
            const frequencyText = inputs.contributionFrequency === 'monthly' ? t('monthly') : 
                                 inputs.contributionFrequency === 'quarterly' ? t('quarterly') : t('annual');
            const contributionText = formatCurrency(inputs.periodicContribution);
            
            let summaryText = '';
            let template = t('savingTemplate');
            
            // Determine values based on calculation mode
            let yearsValue, amountValue;
            
            if (mode === 'timeToGoal' && result.requiredTime) {
                yearsValue = Math.floor(result.requiredTime);
                amountValue = contributionText;
            } else if (mode === 'requiredContribution' && result.requiredContribution) {
                yearsValue = inputs.years;
                amountValue = formatCurrency(result.requiredContribution);
            } else if (mode === 'requiredRate' && inputs.years) {
                yearsValue = inputs.years;
                amountValue = contributionText;
            } else {
                yearsValue = inputs.years || 0;
                amountValue = contributionText;
            }
            
            // Use translation template with dynamic values
            summaryText = template
                .replace('{amount}', amountValue)
                .replace('{frequency}', frequencyText.toLowerCase())
                .replace('{years}', yearsValue);
            
            calculationSummary.textContent = summaryText;
        }

        // Update main result display based on mode
        const mainResultLabel = document.querySelector('.main-result-label');
        if (mode === 'timeToGoal') {
            if (mainResultLabel) mainResultLabel.textContent = t('requiredTimeResult');
            const years = Math.floor(result.requiredTime);
            const months = Math.round((result.requiredTime - years) * 12);
            finalAmountResult.textContent = `${years} ${t('yearsLabel')}, ${months} ${t('monthsLabel')}`;
        } else if (mode === 'requiredContribution') {
            if (mainResultLabel) mainResultLabel.textContent = t('requiredContributionResult');
            const frequencyLabel = inputs.contributionFrequency === 'monthly' ? t('perMonthLabel') : inputs.contributionFrequency === 'quarterly' ? 'per quarter' : t('perYearLabel');
            finalAmountResult.textContent = `${formatCurrency(result.requiredContribution)} ${frequencyLabel}`;
        } else if (mode === 'requiredRate') {
            if (mainResultLabel) mainResultLabel.textContent = t('requiredRateResult');
            finalAmountResult.textContent = `${formatNumber(result.requiredRate)}%`;
        } else {
            if (mainResultLabel) mainResultLabel.textContent = t('canSaveLabel');
            finalAmountResult.textContent = formatCurrency(result.finalAmount);
        }

        totalContributionsResult.textContent = formatCurrency(result.totalContributions);
        totalInterestResult.textContent = formatCurrency(result.totalInterest);

        // Create charts
        this.createEvolutionChart(result.evolution);
        this.createCompositionChart(result.totalContributions, result.totalInterest, inputs.initialCapital);

        // Create evolution table
        this.createEvolutionTable(result.evolution);

        // Create parameters summary
        this.createParametersSummary(inputs, mode);

        // Show results
        resultsContainer.style.display = 'block';
        resultsContainer.scrollIntoView({ behavior: 'smooth' });
    }

    createEvolutionChart(evolution) {
        const canvas = document.getElementById('evolutionChart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        
        // Destroy existing chart
        if (this.evolutionChart) {
            this.evolutionChart.destroy();
        }

        const labels = evolution.map(item => `${t('year')} ${item.year}`);
        const contributionData = evolution.map(item => item.contribution);
        const interestData = evolution.map(item => item.interest);

        this.evolutionChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: t('contribution'),
                        data: contributionData,
                        backgroundColor: 'rgba(64, 224, 208, 0.7)',
                        borderColor: '#40E0D0',
                        borderWidth: 1
                    },
                    {
                        label: t('interest'),
                        data: interestData,
                        backgroundColor: 'rgba(255, 107, 53, 0.7)',
                        borderColor: '#FF6B35',
                        borderWidth: 1
                    }
                ]
            },
            options: {
                responsive: true,
                scales: {
                    x: { stacked: true },
                    y: { stacked: true }
                },
                plugins: {
                    legend: {
                        position: 'top',
                    }
                }
            }
        });
    }

    createCompositionChart(totalContributions, totalInterest, initialCapital = 0) {
        const canvas = document.getElementById('compositionChart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        
        // Destroy existing chart
        if (this.compositionChart) {
            this.compositionChart.destroy();
        }

        this.compositionChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: [t('initialCapital'), t('totalContributions'), t('totalInterest')],
                datasets: [{
                    data: [initialCapital, totalContributions, totalInterest],
                    backgroundColor: ['#4f46e5', '#40E0D0', '#FF6B35'],
                    borderColor: ['#3730a3', '#30D5C8', '#F7931E'],
                    borderWidth: 3
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 20,
                            font: {
                                size: 14
                            }
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const label = context.label || '';
                                const value = '€' + context.parsed.toLocaleString('ca-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                                const total = context.dataset.data.reduce((sum, val) => sum + val, 0);
                                const percentage = ((context.parsed / total) * 100).toFixed(1);
                                return `${label}: ${value} (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
    }

    createEvolutionTable(evolution) {
        const tableBody = document.getElementById('evolutionTableBody');
        if (!tableBody) return;

        const formatCurrency = (amount) => `€${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

        tableBody.innerHTML = '';
        evolution.forEach(item => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${item.year}</td>
                <td>${formatCurrency(item.initialBalance)}</td>
                <td>${formatCurrency(item.contribution)}</td>
                <td>${formatCurrency(item.interest)}</td>
                <td>${formatCurrency(item.finalBalance)}</td>
            `;
            tableBody.appendChild(row);
        });
    }

    createParametersSummary(inputs, mode) {
        const container = document.getElementById('parametersSummary');
        if (!container) return;

        const formatCurrency = (amount) => `€${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        const formatPercent = (rate) => `${rate.toFixed(2)}%`;

        let parameters = [
            { label: t('initialCapital'), value: formatCurrency(inputs.initialCapital) },
            { label: t('periodicContribution'), value: formatCurrency(inputs.periodicContribution) },
            { label: t('contributionFrequency'), value: t(inputs.contributionFrequency) },
            { label: t('paymentTiming'), value: inputs.paymentTiming === 'end' ? t('endOfPeriod') : t('beginningOfPeriod') },
            { label: t('annualInterestRate'), value: formatPercent(inputs.annualRate) },
            { label: t('investmentYears'), value: `${inputs.years} ${t('yearsLabel')}` }
        ];

        if (mode === 'timeToGoal' || mode === 'requiredContribution' || mode === 'requiredRate') {
            parameters.push({ label: t('targetAmount'), value: formatCurrency(inputs.targetAmount) });
        }

        container.innerHTML = parameters.map(param => 
            `<div><strong>${param.label}:</strong> ${param.value}</div>`
        ).join('');
    }
}

// Initialize the application
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new FinanQuest();
    // Make app globally accessible for event handlers
    window.app = app;
});

// Export for global access
window.FinanQuest = FinanQuest;