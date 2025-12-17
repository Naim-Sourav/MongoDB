
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const compression = require('compression');
const apicache = require('apicache');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();
const cache = apicache.middleware;

// --- Rate Limiting Strategy ---
// 1. General Limiter: Protects against general spam (100 req per 15 min per IP)
const generalLimiter = rateLimit({
	windowMs: 15 * 60 * 1000, 
	limit: 300, 
	standardHeaders: 'draft-7',
	legacyHeaders: false,
    message: { error: "Too many requests, please try again later." }
});

// 2. Heavy Task Limiter: Protects DB intensive routes like Quiz Generation (20 req per 15 min)
const heavyTaskLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 50,
    message: { error: "Server busy. Please wait a moment before generating more quizzes." }
});

// Middleware
app.use(compression()); 
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cors());
app.use(generalLimiter); // Apply general limit globally

// --- MongoDB Connection Setup ---
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://user:pass@cluster0.mongodb.net/shikkha-shohayok?retryWrites=true&w=majority';

// In-Memory Fallback Storage
const memoryDb = {
  users: [],
  payments: [],
  notifications: [
    { _id: '1', title: 'System', message: 'Running in fallback mode (Database disconnected)', type: 'WARNING', date: Date.now() }
  ],
  battles: [],
  questions: [],
  savedQuestions: [],
  mistakes: [],
  examResults: [],
  questTemplates: [], // Admin templates
  examPacks: [],
  questionPapers: [] // NEW: Stores list of available question banks
};

// Connect to MongoDB with Pool Size Optimization
// M0 Free Tier supports max 500 connections. 
// We cap our app at 10 to leave room for other processes and avoid saturation.
mongoose.connect(MONGODB_URI, {
  serverSelectionTimeoutMS: 5000, 
  socketTimeoutMS: 45000,
  maxPoolSize: 10 
})
  .then(() => console.log('✅ Connected to MongoDB Atlas'))
  .catch(err => console.error('⚠️ MongoDB Connection Failed. Switching to In-Memory Fallback mode.'));

// Helper to check DB status
const isDbConnected = () => mongoose.connection.readyState === 1;

// --- UTILS: QUEST GENERATOR ---
const QUEST_TYPES = [
    { type: 'EXAM_COMPLETE', title: 'মডেল টেস্ট হিরো', desc: '১টি মডেল টেস্ট সম্পন্ন করো', target: 1, reward: 50, icon: 'FileCheck' },
    { type: 'EXAM_COMPLETE', title: 'এক্সাম ম্যারাথন', desc: '৩টি মডেল টেস্ট সম্পন্ন করো', target: 3, reward: 100, icon: 'FileCheck' },
    { type: 'HIGH_SCORE', title: 'পারফেকশনিস্ট', desc: '১টি পরীক্ষায় ৮০% নম্বর পাও', target: 1, reward: 80, icon: 'Target' },
    { type: 'STUDY_TIME', title: 'পড়ুয়া', desc: '২০ মিনিট পড়াশোনা ট্র্যাক করো', target: 20, reward: 60, icon: 'Clock' },
    { type: 'PLAY_BATTLE', title: 'ব্যাটল ওয়ারিয়র', desc: '১টি কুইজ ব্যাটল খেলো', target: 1, reward: 50, icon: 'Swords' },
    { type: 'WIN_BATTLE', title: 'বিজয় উল্লাস', desc: '১টি কুইজ ব্যাটল জেতো', target: 1, reward: 100, icon: 'Trophy' },
    { type: 'ASK_AI', title: 'কৌতুহলী', desc: 'AI কে ২ বার প্রশ্ন করো', target: 2, reward: 40, icon: 'Bot' },
    { type: 'SAVE_QUESTION', title: 'সংগ্রাহক', desc: '৩টি প্রশ্ন সেভ করো', target: 3, reward: 30, icon: 'Bookmark' }
];

const generateDailyQuests = () => {
    // Shuffle and pick 3 random quests
    const shuffled = [...QUEST_TYPES].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, 3);
    
    return selected.map((q, idx) => ({
        id: `dq_${Date.now()}_${idx}`,
        title: q.title,
        description: q.desc,
        type: q.type,
        target: q.target,
        progress: 0,
        reward: q.reward,
        completed: false,
        claimed: false,
        icon: q.icon,
        category: 'DAILY'
    }));
};

// --- Schemas & Models (Mongoose) ---

const questTemplateSchema = new mongoose.Schema({
  title: String,
  description: String,
  type: String, 
  target: Number,
  reward: Number,
  icon: String,
  link: String,
  category: { type: String, enum: ['DAILY', 'WEEKLY'], default: 'DAILY' },
  isActive: { type: Boolean, default: true }
});
const QuestTemplate = mongoose.model('QuestTemplate', questTemplateSchema);

const questSchema = new mongoose.Schema({
  id: String,
  title: String,
  description: String,
  type: String,
  target: Number,
  progress: { type: Number, default: 0 },
  reward: Number,
  completed: { type: Boolean, default: false },
  claimed: { type: Boolean, default: false },
  icon: String,
  link: String,
  category: String
}, { _id: false });

const userSchema = new mongoose.Schema({
  uid: { type: String, required: true, unique: true, index: true }, // Indexed for fast login
  email: String,
  displayName: String,
  photoURL: String,
  role: { type: String, default: 'student' },
  college: String,
  hscBatch: String,
  department: String,
  target: String,
  points: { type: Number, default: 0, index: -1 }, // Indexed for Leaderboard
  totalExams: { type: Number, default: 0 },
  lastLogin: { type: Number, default: Date.now },
  createdAt: { type: Number, default: Date.now },
  stats: {
    totalCorrect: { type: Number, default: 0 },
    totalWrong: { type: Number, default: 0 },
    totalSkipped: { type: Number, default: 0 },
    subjectStats: { type: Map, of: new mongoose.Schema({ correct: Number, total: Number }, { _id: false }), default: {} },
    topicStats: { type: Map, of: new mongoose.Schema({ correct: Number, total: Number }, { _id: false }), default: {} }
  },
  dailyQuests: [questSchema],
  weeklyQuests: [questSchema],
  lastQuestReset: { type: Number, default: 0 },
  lastWeeklyQuestReset: { type: Number, default: 0 }
});
const User = mongoose.model('User', userSchema);

const paymentSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  userName: String,
  userEmail: String,
  courseId: String,
  courseTitle: String,
  amount: Number,
  trxId: { type: String, required: true },
  senderNumber: { type: String, required: true },
  status: { type: String, default: 'PENDING', enum: ['PENDING', 'APPROVED', 'REJECTED'], index: true }, // Indexed for Admin filtering
  timestamp: { type: Number, default: Date.now }
});
const Payment = mongoose.model('Payment', paymentSchema);

const notificationSchema = new mongoose.Schema({
  title: String,
  message: String,
  type: { type: String, enum: ['INFO', 'WARNING', 'SUCCESS', 'BATTLE_CHALLENGE', 'BATTLE_RESULT'] },
  date: { type: Number, default: Date.now, index: -1 }, // Indexed for sorting
  target: { type: String, default: 'ALL' },
  actionLink: String,
  metadata: Object
});
const Notification = mongoose.model('Notification', notificationSchema);

const battleSchema = new mongoose.Schema({
  roomId: { type: String, required: true, unique: true },
  hostId: String,
  createdAt: { type: Number, default: Date.now },
  status: { type: String, enum: ['WAITING', 'ACTIVE', 'FINISHED'], default: 'WAITING' },
  startTime: Number,
  questions: Array,
  config: {
    subjects: [String], 
    chapters: [String], 
    mode: { type: String, enum: ['1v1', '2v2', 'FFA'], default: '1v1' },
    questionCount: { type: Number, default: 5 },
    timePerQuestion: { type: Number, default: 15 },
    maxPlayers: { type: Number, default: 2 }
  },
  players: [{
    uid: String,
    name: String,
    avatar: String,
    score: { type: Number, default: 0 },
    totalTimeTaken: { type: Number, default: 0 }, 
    team: { type: String, enum: ['A', 'B', 'NONE'], default: 'NONE' },
    answers: { type: Map, of: Number, default: {} } 
  }]
});
const Battle = mongoose.model('Battle', battleSchema);

const questionBankSchema = new mongoose.Schema({
  subject: { type: String, required: true, index: true }, // Indexed
  chapter: { type: String, required: true, index: true }, // Indexed
  topic: String,
  question: { type: String, required: true },
  options: { type: [String], required: true },
  correctAnswerIndex: { type: Number, required: true },
  explanation: String,
  difficulty: { type: String, default: 'MEDIUM' },
  examRef: { type: String, index: true }, // Indexed for Past Paper Fetch
  createdAt: { type: Number, default: Date.now }
});
const QuestionBank = mongoose.model('QuestionBank', questionBankSchema);

// NEW: Stores metadata about uploaded Question Banks (Papers)
const questionPaperSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true }, // e.g. medical_23_24
  title: { type: String, required: true },
  year: { type: String, required: true },
  source: { type: String, required: true }, // Medical, Engineering, etc.
  totalQuestions: { type: Number, default: 0 },
  time: { type: Number, default: 60 }
});
const QuestionPaper = mongoose.model('QuestionPaper', questionPaperSchema);

const savedQuestionSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true }, // Indexed
  questionId: { type: mongoose.Schema.Types.ObjectId, ref: 'QuestionBank' },
  folder: { type: String, default: 'General' },
  savedAt: { type: Number, default: Date.now }
});
const SavedQuestion = mongoose.model('SavedQuestion', savedQuestionSchema);

const mistakeSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true }, // Indexed
  question: { type: String, required: true },
  options: { type: [String], required: true },
  correctAnswerIndex: { type: Number, required: true },
  explanation: String,
  subject: String,
  chapter: String,
  topic: String,
  wrongCount: { type: Number, default: 1 },
  lastMissed: { type: Number, default: Date.now }
});
const Mistake = mongoose.model('Mistake', mistakeSchema);

const examResultSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  subject: { type: String, required: true },
  totalQuestions: Number,
  correct: Number,
  wrong: Number,
  skipped: Number,
  score: Number,
  topicStats: [{ topic: String, correct: Number, total: Number }],
  timestamp: { type: Number, default: Date.now }
});
const ExamResult = mongoose.model('ExamResult', examResultSchema);

const examPackSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  title: String,
  subtitle: String,
  price: Number,
  originalPrice: Number,
  totalExams: Number,
  features: [String],
  theme: String,
  tag: String
});
const ExamPack = mongoose.model('ExamPack', examPackSchema);

// --- ROUTES ---

app.get('/', (req, res) => {
  res.send(`🚀 Dhrubok API Running! Mode: ${isDbConnected() ? 'MongoDB' : 'Memory'}`);
});

// --- QUESTS ---

// Helper function to check and reset quests
const checkAndResetUserQuests = async (user) => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    
    // Daily Reset
    if (!user.lastQuestReset || user.lastQuestReset < todayStart) {
        user.dailyQuests = generateDailyQuests();
        user.lastQuestReset = Date.now();
    }
    // Weekly Reset logic could go here
    return user;
};

app.post('/api/quests/update', async (req, res) => {
    try {
        const { userId, actionType, value } = req.body;
        
        let user;
        let isUpdated = false;

        if (isDbConnected()) {
            user = await User.findOne({ uid: userId });
        } else {
            user = memoryDb.users.find(u => u.uid === userId);
        }

        if (!user) return res.status(404).json({ error: 'User not found' });

        // Ensure quests are initialized if running in memory/first time
        if (!user.dailyQuests || user.dailyQuests.length === 0) {
            user.dailyQuests = generateDailyQuests();
            isUpdated = true;
        }

        // Update Logic
        const processQuests = (questList) => {
            questList.forEach(quest => {
                if (quest.type === actionType && !quest.completed) {
                    quest.progress = Math.min(quest.target, (quest.progress || 0) + Number(value));
                    if (quest.progress >= quest.target) {
                        quest.completed = true;
                        // Optional: Send notification for completion
                    }
                    isUpdated = true;
                }
            });
        };

        if (user.dailyQuests) processQuests(user.dailyQuests);
        if (user.weeklyQuests) processQuests(user.weeklyQuests);

        if (isUpdated) {
            if (isDbConnected()) await user.save();
            // In memory, reference is already updated
        }
        
        res.json({ success: true, quests: user.dailyQuests });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/quests/claim', async (req, res) => {
    try {
        const { userId, questId, category } = req.body;
        
        let user;
        if (isDbConnected()) {
            user = await User.findOne({ uid: userId });
        } else {
            user = memoryDb.users.find(u => u.uid === userId);
        }

        if (!user) return res.status(404).json({ error: 'User not found' });

        // Handle Lifetime quests (Mock for now as they are static in frontend)
        if (category === 'LIFETIME') {
             // Just verify generic logic or log it
             return res.json({ success: true, points: user.points }); 
        }

        const list = category === 'WEEKLY' ? user.weeklyQuests : user.dailyQuests;
        const quest = list.find(q => q.id === questId);

        if (quest && quest.completed && !quest.claimed) {
            quest.claimed = true;
            user.points = (user.points || 0) + quest.reward;
            
            if (isDbConnected()) await user.save();
            
            res.json({ success: true, points: user.points });
        } else {
            res.status(400).json({ error: 'Quest not eligible or already claimed' });
        }
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// --- USERS ---

app.post('/api/users/sync', async (req, res) => {
    try {
        const userData = req.body;
        if (isDbConnected()) {
            let user = await User.findOne({ uid: userData.uid });
            if (!user) {
                // New user: Create with initial quests
                user = new User({
                    ...userData,
                    dailyQuests: generateDailyQuests(),
                    lastQuestReset: Date.now()
                });
                await user.save();
            } else {
                // Update existing
                await User.findOneAndUpdate(
                    { uid: userData.uid },
                    { $set: userData },
                    { new: true }
                );
            }
        } else {
            const idx = memoryDb.users.findIndex(u => u.uid === userData.uid);
            if (idx >= 0) memoryDb.users[idx] = { ...memoryDb.users[idx], ...userData };
            else {
                memoryDb.users.push({
                    ...userData, 
                    dailyQuests: generateDailyQuests(),
                    points: 0,
                    totalExams: 0,
                    stats: { subjectStats: {}, topicStats: {} }
                });
            }
        }
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/users/:userId/stats', async (req, res) => {
    try {
        let user;
        if (isDbConnected()) {
            // Lean query for speed
            user = await User.findOne({ uid: req.params.userId }).lean();
            
            // Check for daily reset needed (Using Date logic manually since it's lean)
            if (user) {
                 const now = new Date();
                 const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
                 if (!user.lastQuestReset || user.lastQuestReset < todayStart) {
                     // Need to update, so fetch document
                     const docUser = await User.findOne({ uid: req.params.userId });
                     const updatedUser = await checkAndResetUserQuests(docUser);
                     await updatedUser.save();
                     user = updatedUser.toObject();
                 }
            }
        } else {
            user = memoryDb.users.find(u => u.uid === req.params.userId);
            if (user) {
                 const now = new Date();
                 const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
                 if (!user.lastQuestReset || user.lastQuestReset < todayStart) {
                     user.dailyQuests = generateDailyQuests();
                     user.lastQuestReset = Date.now();
                 }
            }
        }

        if (user) {
            // Safe handling for Maps if using in-memory vs mongoose
            // Mongoose Map becomes object in .lean() or toObject()
            let subjStats = [];
            if (user.stats && user.stats.subjectStats) {
                // If it's a plain object (from lean/memory) or Map
                const entries = user.stats.subjectStats instanceof Map ? Array.from(user.stats.subjectStats.entries()) : Object.entries(user.stats.subjectStats);
                subjStats = entries.map(([k,v]) => ({ subject: k, accuracy: v.total > 0 ? (v.correct/v.total)*100 : 0 }));
            }
            
            let topicStats = [];
            if (user.stats && user.stats.topicStats) {
                const entries = user.stats.topicStats instanceof Map ? Array.from(user.stats.topicStats.entries()) : Object.entries(user.stats.topicStats);
                topicStats = entries.map(([k,v]) => ({ topic: k, accuracy: v.total > 0 ? (v.correct/v.total)*100 : 0 }));
            }

            res.json({ 
                points: user.points, 
                totalExams: user.totalExams,
                totalCorrect: user.stats?.totalCorrect || 0,
                totalWrong: user.stats?.totalWrong || 0,
                subjectBreakdown: subjStats,
                strongestTopics: topicStats.sort((a,b) => b.accuracy - a.accuracy).slice(0, 3),
                weakestTopics: topicStats.sort((a,b) => a.accuracy - b.accuracy).slice(0, 3),
                quests: user.dailyQuests || [],
                weeklyQuests: user.weeklyQuests || [],
                user: user
            });
        } else {
            // Fallback for brand new user not yet synced
            res.json({ points: 0, totalExams: 0, quests: generateDailyQuests() });
        }
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/users/:userId/exam-results', async (req, res) => {
    try {
        const { userId } = req.params;
        const resultData = req.body;

        if (isDbConnected()) {
            // Save Result Log
            await ExamResult.create({ userId, ...resultData });

            // Update User Stats
            const user = await User.findOne({ uid: userId });
            if (user) {
                user.totalExams += 1;
                user.points += (resultData.score > 0 ? (resultData.correct * 5) + 10 : 0);
                user.stats.totalCorrect += resultData.correct;
                user.stats.totalWrong += resultData.wrong;
                user.stats.totalSkipped += resultData.skipped;

                // Update Subject Stats
                const subjStat = user.stats.subjectStats.get(resultData.subject) || { correct: 0, total: 0 };
                subjStat.correct += resultData.correct;
                subjStat.total += resultData.totalQuestions; // Assuming all Qs belong to this subject for simple exams
                user.stats.subjectStats.set(resultData.subject, subjStat);

                // Update Topic Stats
                resultData.topicStats.forEach(t => {
                    const topicStat = user.stats.topicStats.get(t.topic) || { correct: 0, total: 0 };
                    topicStat.correct += t.correct;
                    topicStat.total += t.total;
                    user.stats.topicStats.set(t.topic, topicStat);
                });

                await user.save();
            }

            // Save Mistakes
            if (resultData.mistakes && resultData.mistakes.length > 0) {
                for (const m of resultData.mistakes) {
                    await Mistake.findOneAndUpdate(
                        { userId, question: m.question }, // Simple dedup by question text
                        { 
                            $setOnInsert: { 
                                options: m.options, 
                                correctAnswerIndex: m.correctAnswerIndex,
                                explanation: m.explanation,
                                subject: m.subject,
                                chapter: m.chapter,
                                topic: m.topic
                            },
                            $inc: { wrongCount: 1 },
                            $set: { lastMissed: Date.now() }
                        },
                        { upsert: true }
                    );
                }
            }
        }
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- SAVED QUESTIONS ---

app.get('/api/users/:userId/saved-questions', async (req, res) => {
    try {
        if (isDbConnected()) {
            const saved = await SavedQuestion.find({ userId: req.params.userId }).populate('questionId').lean();
            res.json(saved.filter(s => s.questionId)); // Filter out null populated questions
        } else {
            res.json(memoryDb.savedQuestions.filter(s => s.userId === req.params.userId));
        }
    } catch (e) { res.status(500).json({error: e.message}); }
});

app.post('/api/users/:userId/saved-questions', async (req, res) => {
    try {
        const { questionId, folder } = req.body;
        if (isDbConnected()) {
            await SavedQuestion.create({ userId: req.params.userId, questionId, folder });
        } else {
            memoryDb.savedQuestions.push({ _id: Date.now(), userId: req.params.userId, questionId, folder });
        }
        res.json({ success: true });
    } catch (e) { res.status(500).json({error: e.message}); }
});

app.patch('/api/users/:userId/saved-questions/:id', async (req, res) => {
    try {
        const { folder } = req.body;
        if (isDbConnected()) {
            await SavedQuestion.findByIdAndUpdate(req.params.id, { folder });
        }
        res.json({ success: true });
    } catch (e) { res.status(500).json({error: e.message}); }
});

app.delete('/api/users/:userId/saved-questions/:id', async (req, res) => {
    try {
        if (isDbConnected()) {
            await SavedQuestion.findByIdAndDelete(req.params.id);
        } else {
            memoryDb.savedQuestions = memoryDb.savedQuestions.filter(s => s._id.toString() !== req.params.id);
        }
        res.json({ success: true });
    } catch (e) { res.status(500).json({error: e.message}); }
});

app.delete('/api/users/:userId/saved-questions/by-q/:questionId', async (req, res) => {
    try {
        if (isDbConnected()) {
            await SavedQuestion.findOneAndDelete({ userId: req.params.userId, questionId: req.params.questionId });
        }
        res.json({ success: true });
    } catch (e) { res.status(500).json({error: e.message}); }
});

// --- MISTAKES ---

app.get('/api/users/:userId/mistakes', async (req, res) => {
    try {
        if (isDbConnected()) {
            const mistakes = await Mistake.find({ userId: req.params.userId }).sort({ lastMissed: -1 }).limit(100).lean();
            res.json(mistakes);
        } else {
            res.json(memoryDb.mistakes.filter(m => m.userId === req.params.userId));
        }
    } catch (e) { res.status(500).json({error: e.message}); }
});

app.delete('/api/users/:userId/mistakes/:id', async (req, res) => {
    try {
        if (isDbConnected()) {
            await Mistake.findByIdAndDelete(req.params.id);
        }
        res.json({ success: true });
    } catch (e) { res.status(500).json({error: e.message}); }
});

// --- QUESTION BANK ADMIN ---

// GET: All Questions (Admin Viewer)
app.get('/api/admin/questions', async (req, res) => {
    try {
        const { page = 1, limit = 10, subject, chapter } = req.query;
        const query = {};
        if(subject) query.subject = subject;
        if(chapter) query.chapter = chapter;

        if(isDbConnected()) {
            const questions = await QuestionBank.find(query)
                                    .skip((page-1)*limit)
                                    .limit(Number(limit))
                                    .sort({createdAt: -1})
                                    .lean(); // Faster
            const total = await QuestionBank.countDocuments(query);
            res.json({ questions, total });
        } else {
            const qs = memoryDb.questions.filter(q => (!subject || q.subject === subject) && (!chapter || q.chapter === chapter));
            res.json({ questions: qs.slice((page-1)*limit, page*limit), total: qs.length });
        }
    } catch(e) { res.status(500).json({error: e.message}); }
});

// POST: Bulk Upload + Paper Metadata
app.post('/api/admin/questions/bulk', async (req, res) => {
    try {
        const { questions, metadata } = req.body;
        
        if(isDbConnected()) {
            // 1. Insert Questions
            await QuestionBank.insertMany(questions);
            
            // 2. Insert/Update Paper Metadata if provided
            if (metadata) {
                await QuestionPaper.findOneAndUpdate(
                    { id: metadata.id },
                    metadata,
                    { upsert: true, new: true }
                );
            }
        } else {
            questions.forEach(q => memoryDb.questions.push({...q, _id: Date.now() + Math.random()}));
            if (metadata) {
                const existingIdx = memoryDb.questionPapers.findIndex(p => p.id === metadata.id);
                if (existingIdx >= 0) memoryDb.questionPapers[existingIdx] = metadata;
                else memoryDb.questionPapers.push(metadata);
            }
        }
        res.json({ success: true });
    } catch(e) { res.status(500).json({error: e.message}); }
});

app.delete('/api/admin/questions/:id', async (req, res) => {
    try {
        if(isDbConnected()) {
            await QuestionBank.findByIdAndDelete(req.params.id);
        }
        res.json({ success: true });
    } catch(e) { res.status(500).json({error: e.message}); }
});

// GET: List of Available Question Papers - Cached
app.get('/api/question-papers', cache('5 minutes'), async (req, res) => {
    try {
        if (isDbConnected()) {
            const papers = await QuestionPaper.find().sort({ year: -1 }).lean();
            res.json(papers);
        } else {
            res.json(memoryDb.questionPapers);
        }
    } catch(e) { res.status(500).json({error: e.message}); }
});

// --- EXAM REF SPECIFIC ROUTE - Cached ---
app.get('/api/quiz/past-paper/:examRef', cache('10 minutes'), async (req, res) => {
    try {
        const { examRef } = req.params;
        if (isDbConnected()) {
            const questions = await QuestionBank.find({ examRef }).lean();
            res.json(questions);
        } else {
            const questions = memoryDb.questions.filter(q => q.examRef === examRef);
            res.json(questions);
        }
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// --- QUIZ GENERATION FROM DB ---

// Apply heavy task rate limiting here
app.post('/api/quiz/generate-from-db', heavyTaskLimiter, async (req, res) => {
    try {
        const { subject, chapter, topics, count } = req.body;
        
        if (isDbConnected()) {
            // Optimization: Match stage is crucial for performance.
            // Using $sample with a match stage first is efficient enough for M0 if indexes exist.
            const pipeline = [
                { $match: { 
                    subject, 
                    chapter: chapter === 'Full Syllabus' ? { $exists: true } : chapter,
                    ...(topics && topics.length > 0 && topics[0] !== 'Full Syllabus' ? { topic: { $in: topics } } : {})
                }},
                { $sample: { size: count } }
            ];
            const questions = await QuestionBank.aggregate(pipeline);
            res.json(questions);
        } else {
            const filtered = memoryDb.questions.filter(q => 
                q.subject === subject && 
                (chapter === 'Full Syllabus' || q.chapter === chapter)
            );
            // Shuffle
            const shuffled = filtered.sort(() => 0.5 - Math.random()).slice(0, count);
            res.json(shuffled);
        }
    } catch (e) { res.status(500).json({error: e.message}); }
});

app.get('/api/quiz/syllabus-stats', cache('10 minutes'), async (req, res) => {
    try {
        if (!isDbConnected()) return res.json({});

        // Aggregation to count questions per Subject -> Chapter -> Topic
        const stats = await QuestionBank.aggregate([
            {
                $group: {
                    _id: { subject: "$subject", chapter: "$chapter", topic: "$topic" },
                    count: { $sum: 1 }
                }
            },
            {
                $group: {
                    _id: { subject: "$_id.subject", chapter: "$_id.chapter" },
                    topics: { $push: { k: "$_id.topic", v: "$count" } },
                    totalChapter: { $sum: "$count" }
                }
            },
            {
                $group: {
                    _id: "$_id.subject",
                    chapters: { 
                        $push: { 
                            k: "$_id.chapter", 
                            v: { total: "$totalChapter", topics: { $arrayToObject: "$topics" } } 
                        } 
                    },
                    totalSubject: { $sum: "$totalChapter" }
                }
            }
        ]);

        // Transform to cleaner JSON structure
        const formatted = {};
        stats.forEach(s => {
            const chaptersObj = {};
            s.chapters.forEach(c => chaptersObj[c.k] = c.v);
            formatted[s._id] = {
                total: s.totalSubject,
                chapters: chaptersObj
            };
        });

        res.json(formatted);
    } catch (e) { res.status(500).json({error: e.message}); }
});

// --- PAYMENTS & ADMIN ---

app.get('/api/admin/payments', async (req, res) => {
    try {
        if(isDbConnected()) {
            const payments = await Payment.find().sort({ timestamp: -1 }).lean();
            res.json(payments);
        } else {
            res.json(memoryDb.payments);
        }
    } catch(e) { res.status(500).json({error: e.message}); }
});

app.post('/api/payments', async (req, res) => {
    try {
        if(isDbConnected()) {
            await Payment.create(req.body);
        } else {
            memoryDb.payments.push({ ...req.body, id: Date.now().toString(), status: 'PENDING', timestamp: Date.now() });
        }
        res.json({ success: true });
    } catch(e) { res.status(500).json({error: e.message}); }
});

app.put('/api/admin/payments/:id', async (req, res) => {
    try {
        const { status } = req.body;
        if(isDbConnected()) {
            await Payment.findByIdAndUpdate(req.params.id, { status });
        }
        res.json({ success: true });
    } catch(e) { res.status(500).json({error: e.message}); }
});

app.delete('/api/admin/payments/:id', async (req, res) => {
    try {
        if(isDbConnected()) {
            await Payment.findByIdAndDelete(req.params.id);
        }
        res.json({ success: true });
    } catch(e) { res.status(500).json({error: e.message}); }
});

app.get('/api/admin/stats', async (req, res) => {
    try {
        if(isDbConnected()) {
            const totalRevenue = await Payment.aggregate([
                { $match: { status: 'APPROVED' } },
                { $group: { _id: null, total: { $sum: "$amount" } } }
            ]);
            const approvedEnrollments = await Payment.countDocuments({ status: 'APPROVED' });
            const pendingPayments = await Payment.countDocuments({ status: 'PENDING' });
            const totalUsers = await User.countDocuments();
            const totalQuestions = await QuestionBank.countDocuments();
            
            // Calculate total exams taken from User stats
            const totalExamsAgg = await User.aggregate([{ $group: { _id: null, total: { $sum: "$totalExams" } } }]);

            res.json({
                totalRevenue: totalRevenue[0]?.total || 0,
                approvedEnrollments,
                pendingPayments,
                totalUsers,
                totalQuestions,
                totalExams: totalExamsAgg[0]?.total || 0
            });
        } else {
            res.json({ totalRevenue: 0, approvedEnrollments: 0, pendingPayments: 0, totalUsers: 0, totalQuestions: 0, totalExams: 0 });
        }
    } catch(e) { res.status(500).json({error: e.message}); }
});

// --- LEADERBOARD - Cached ---

app.get('/api/leaderboard', cache('1 minute'), async (req, res) => {
    try {
        if(isDbConnected()) {
            const users = await User.find({}, 'uid displayName photoURL points college hscBatch target department').sort({ points: -1 }).limit(100).lean();
            res.json(users);
        } else {
            res.json([
                { uid: '1', displayName: 'Tahmid', points: 5000 },
                { uid: '2', displayName: 'Rafiq', points: 4500 }
            ]);
        }
    } catch(e) { res.status(500).json({error: e.message}); }
});

// --- NOTIFICATIONS ---

app.get('/api/notifications', async (req, res) => {
    try {
        if(isDbConnected()) {
            const notifs = await Notification.find().sort({ date: -1 }).limit(50).lean();
            res.json(notifs);
        } else {
            res.json(memoryDb.notifications);
        }
    } catch(e) { res.status(500).json({error: e.message}); }
});

app.post('/api/admin/notifications', async (req, res) => {
    try {
        if(isDbConnected()) {
            await Notification.create(req.body);
        } else {
            memoryDb.notifications.push({ ...req.body, _id: Date.now().toString(), date: Date.now() });
        }
        res.json({ success: true });
    } catch(e) { res.status(500).json({error: e.message}); }
});

// --- EXAM PACKS ---
app.get('/api/exam-packs', async (req, res) => {
    if(isDbConnected()) {
        const packs = await ExamPack.find().lean();
        if (packs.length > 0) return res.json(packs);
    }
    // Fallback Mock
    res.json([
        {
          id: 'med-final-24',
          title: 'মেডিকেল ফাইনাল মডেল টেস্ট',
          subtitle: 'শেষ মুহূর্তের পূর্ণাঙ্গ প্রস্তুতি (১০০টি মডেল টেস্ট)',
          price: 500,
          originalPrice: 1500,
          totalExams: 100,
          features: ['সম্পূর্ণ সিলেবাসের ওপর পরীক্ষা', 'নেগেটিভ মার্কিং প্র্যাকটিস', 'মেডিকেল স্ট্যান্ডার্ড প্রশ্ন', 'সলভ শিট ও ব্যাখ্যা'],
          theme: 'emerald',
          tag: 'Best Seller'
        }
    ]);
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
