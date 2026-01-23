const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cors());

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
  questTemplates: [],
  examPacks: [],
  questionPapers: []
};

// Connect to MongoDB
mongoose.connect(MONGODB_URI, {
  serverSelectionTimeoutMS: 5000, 
  socketTimeoutMS: 45000,
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
  uid: { type: String, required: true, unique: true },
  email: String,
  displayName: String,
  photoURL: String,
  role: { type: String, default: 'student' },
  college: String,
  hscBatch: String,
  department: String,
  target: String,
  points: { type: Number, default: 0 },
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
  status: { type: String, default: 'PENDING', enum: ['PENDING', 'APPROVED', 'REJECTED'] },
  timestamp: { type: Number, default: Date.now }
});
const Payment = mongoose.model('Payment', paymentSchema);

const notificationSchema = new mongoose.Schema({
  title: String,
  message: String,
  type: { type: String, enum: ['INFO', 'WARNING', 'SUCCESS', 'BATTLE_CHALLENGE', 'BATTLE_RESULT'] },
  date: { type: Number, default: Date.now },
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
  subject: { type: String, required: true },
  chapter: { type: String, required: true },
  topic: String,
  question: { type: String, required: true },
  options: { type: [String], required: true },
  correctAnswerIndex: { type: Number, required: true },
  explanation: String,
  difficulty: { type: String, default: 'MEDIUM' },
  examRef: { type: String }, 
  createdAt: { type: Number, default: Date.now }
});
questionBankSchema.index({ subject: 1, chapter: 1, topic: 1 });
questionBankSchema.index({ examRef: 1 });
const QuestionBank = mongoose.model('QuestionBank', questionBankSchema);

const questionPaperSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  year: { type: String, required: true },
  source: { type: String, required: true }, 
  totalQuestions: { type: Number, default: 0 },
  time: { type: Number, default: 60 }
});
const QuestionPaper = mongoose.model('QuestionPaper', questionPaperSchema);

const savedQuestionSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  questionId: { type: mongoose.Schema.Types.ObjectId, ref: 'QuestionBank' },
  folder: { type: String, default: 'General' },
  savedAt: { type: Number, default: Date.now }
});
savedQuestionSchema.index({ userId: 1 });
const SavedQuestion = mongoose.model('SavedQuestion', savedQuestionSchema);

const mistakeSchema = new mongoose.Schema({
  userId: { type: String, required: true },
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
mistakeSchema.index({ userId: 1 });
const Mistake = mongoose.model('Mistake', mistakeSchema);

const examResultSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  subject: { type: String, required: true },
  totalQuestions: Number,
  correct: Number,
  wrong: Number,
  skipped: Number,
  score: Number,
  topicStats: [{ topic: String, correct: Number, total: Number }],
  timestamp: { type: Number, default: Date.now }
});
examResultSchema.index({ userId: 1 }); 
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

// --- ADMIN STATS AGGREGATION ---
app.get('/api/admin/stats', async (req, res) => {
  try {
    const stats = {
        totalUsers: 0,
        totalRevenue: 0,
        totalQuestions: 0,
        totalExams: 0,
        pendingPayments: 0,
        approvedEnrollments: 0
    };

    if (isDbConnected()) {
        stats.totalUsers = await User.countDocuments();
        stats.totalQuestions = await QuestionBank.countDocuments();
        
        const totalExamsAgg = await User.aggregate([{ $group: { _id: null, total: { $sum: "$totalExams" } } }]);
        stats.totalExams = totalExamsAgg[0]?.total || 0;

        stats.pendingPayments = await Payment.countDocuments({ status: 'PENDING' });
        stats.approvedEnrollments = await Payment.countDocuments({ status: 'APPROVED' });
        
        const revenueAgg = await Payment.aggregate([
            { $match: { status: 'APPROVED' } },
            { $group: { _id: null, total: { $sum: "$amount" } } }
        ]);
        stats.totalRevenue = revenueAgg[0]?.total || 0;
    } else {
        // Memory Fallback
        stats.totalUsers = memoryDb.users.length;
        stats.totalQuestions = memoryDb.questions.length;
        stats.totalExams = memoryDb.users.reduce((sum, u) => sum + (u.totalExams || 0), 0);
        stats.pendingPayments = memoryDb.payments.filter(p => p.status === 'PENDING').length;
        stats.approvedEnrollments = memoryDb.payments.filter(p => p.status === 'APPROVED').length;
        stats.totalRevenue = memoryDb.payments.filter(p => p.status === 'APPROVED').reduce((sum, p) => sum + (p.amount || 0), 0);
    }
    res.json(stats);
  } catch (e) {
      res.status(500).json({ error: 'Stats failed' });
  }
});

// --- QUESTS ---

const checkAndResetUserQuests = async (user) => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    if (!user.lastQuestReset || user.lastQuestReset < todayStart) {
        user.dailyQuests = generateDailyQuests();
        user.lastQuestReset = Date.now();
    }
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
        if (!user.dailyQuests || user.dailyQuests.length === 0) {
            user.dailyQuests = generateDailyQuests();
            isUpdated = true;
        }
        const processQuests = (questList) => {
            questList.forEach(quest => {
                if (quest.type === actionType && !quest.completed) {
                    quest.progress = Math.min(quest.target, (quest.progress || 0) + Number(value));
                    if (quest.progress >= quest.target) quest.completed = true;
                    isUpdated = true;
                }
            });
        };
        if (user.dailyQuests) processQuests(user.dailyQuests);
        if (user.weeklyQuests) processQuests(user.weeklyQuests);
        if (isUpdated && isDbConnected()) await user.save();
        res.json({ success: true, quests: user.dailyQuests });
    } catch (e) { res.status(500).json({ error: e.message }); }
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
        if (category === 'LIFETIME') return res.json({ success: true, points: user.points }); 
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
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- USERS ---

app.post('/api/users/sync', async (req, res) => {
    try {
        const userData = req.body;
        if (isDbConnected()) {
            let user = await User.findOne({ uid: userData.uid });
            if (!user) {
                user = new User({
                    ...userData,
                    dailyQuests: generateDailyQuests(),
                    lastQuestReset: Date.now()
                });
                await user.save();
            } else {
                await User.findOneAndUpdate({ uid: userData.uid }, { $set: userData }, { new: true });
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
                    stats: { totalCorrect: 0, totalWrong: 0, totalSkipped: 0, subjectStats: {}, topicStats: {} }
                });
            }
        }
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/users/:userId/stats', async (req, res) => {
    try {
        let user;
        if (isDbConnected()) {
            user = await User.findOne({ uid: req.params.userId });
            if (user) {
                const updatedUser = await checkAndResetUserQuests(user);
                if (updatedUser !== user) { await updatedUser.save(); user = updatedUser; }
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
            const subjStatsObj = user.stats.subjectStats instanceof Map 
                ? Object.fromEntries(user.stats.subjectStats) 
                : (user.stats.subjectStats || {});
            const topicStatsObj = user.stats.topicStats instanceof Map
                ? Object.fromEntries(user.stats.topicStats)
                : (user.stats.topicStats || {});

            const subjectBreakdown = Object.keys(subjStatsObj).map(s => ({
                subject: s,
                accuracy: (subjStatsObj[s].correct / subjStatsObj[s].total) * 100
            })).sort((a,b) => b.accuracy - a.accuracy);

            const topicBreakdown = Object.keys(topicStatsObj).map(t => ({
                topic: t,
                accuracy: (topicStatsObj[t].correct / topicStatsObj[t].total) * 100,
                total: topicStatsObj[t].total
            })).sort((a,b) => b.accuracy - a.accuracy);

            res.json({ 
                points: user.points, 
                totalExams: user.totalExams,
                totalCorrect: user.stats.totalCorrect,
                totalWrong: user.stats.totalWrong,
                subjectBreakdown,
                strongestTopics: topicBreakdown.slice(0, 5),
                weakestTopics: topicBreakdown.slice().reverse().slice(0, 5),
                quests: user.dailyQuests || [],
                weeklyQuests: user.weeklyQuests || [],
                user: user
            });
        } else { res.json({ points: 0, totalExams: 0, quests: generateDailyQuests() }); }
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/users/:userId/exam-results', async (req, res) => {
    try {
        const { userId } = req.params;
        const resultData = req.body;
        if (isDbConnected()) {
            await ExamResult.create({ userId, ...resultData });
            const user = await User.findOne({ uid: userId });
            if (user) {
                user.totalExams += 1;
                user.points += (resultData.score > 0 ? (resultData.correct * 5) + 10 : 0);
                if (!user.stats) user.stats = { totalCorrect:0, totalWrong:0, totalSkipped:0, subjectStats: {}, topicStats: {} };
                user.stats.totalCorrect += resultData.correct;
                user.stats.totalWrong += resultData.wrong;
                user.stats.totalSkipped += resultData.skipped;
                const subjStat = user.stats.subjectStats.get(resultData.subject) || { correct: 0, total: 0 };
                subjStat.correct += resultData.correct;
                subjStat.total += resultData.totalQuestions;
                user.stats.subjectStats.set(resultData.subject, subjStat);
                resultData.topicStats.forEach(t => {
                    const topicStat = user.stats.topicStats.get(t.topic) || { correct: 0, total: 0 };
                    topicStat.correct += t.correct;
                    topicStat.total += t.total;
                    user.stats.topicStats.set(t.topic, topicStat);
                });
                await user.save();
            }
            if (resultData.mistakes && resultData.mistakes.length > 0) {
                for (const m of resultData.mistakes) {
                    await Mistake.findOneAndUpdate(
                        { userId, question: m.question },
                        { 
                            $setOnInsert: { options: m.options, correctAnswerIndex: m.correctAnswerIndex, explanation: m.explanation, subject: m.subject, chapter: m.chapter, topic: m.topic },
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

// --- SYLLABUS STATS (NESTED QUESTION COUNTS) ---
app.get('/api/quiz/syllabus-stats', async (req, res) => {
    try {
        let stats = {};
        if (isDbConnected()) {
            const agg = await QuestionBank.aggregate([
                {
                    $group: {
                        _id: { subject: "$subject", chapter: "$chapter", topic: "$topic" },
                        count: { $sum: 1 }
                    }
                }
            ]);
            agg.forEach(item => {
                const { subject, chapter, topic } = item._id;
                const count = item.count;
                if (!stats[subject]) stats[subject] = { total: 0, chapters: {} };
                stats[subject].total += count;
                if (!stats[subject].chapters[chapter]) stats[subject].chapters[chapter] = { total: 0, topics: {} };
                stats[subject].chapters[chapter].total += count;
                if (topic) {
                    stats[subject].chapters[chapter].topics[topic] = count;
                }
            });
        } else {
            // Memory Fallback
            memoryDb.questions.forEach(q => {
                const { subject, chapter, topic } = q;
                if (!stats[subject]) stats[subject] = { total: 0, chapters: {} };
                stats[subject].total++;
                if (!stats[subject].chapters[chapter]) stats[subject].chapters[chapter] = { total: 0, topics: {} };
                stats[subject].chapters[chapter].total++;
                if (topic) stats[subject].chapters[chapter].topics[topic] = (stats[subject].chapters[chapter].topics[topic] || 0) + 1;
            });
        }
        res.json(stats);
    } catch (e) {
        console.error("Stats Error:", e);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

// --- OTHER ROUTES REMAIND UNCHANGED ---
app.get('/api/users/:userId/enrollments', async (req, res) => {
    try {
        const { userId } = req.params;
        let enrollments = [];
        if (isDbConnected()) {
            const payments = await Payment.find({ userId, status: 'APPROVED' });
            enrollments = payments.map(p => ({ id: p.courseId, title: p.courseTitle, progress: 0 }));
        } else {
            const payments = memoryDb.payments.filter(p => p.userId === userId && p.status === 'APPROVED');
            enrollments = payments.map(p => ({ id: p.courseId, title: p.courseTitle, progress: 0 }));
        }
        res.json(enrollments);
    } catch (e) { res.status(500).json({ error: 'Fetch enrollments failed' }); }
});

app.get('/api/users/:userId/saved-questions', async (req, res) => {
    try {
        if (isDbConnected()) {
            const saved = await SavedQuestion.find({ userId: req.params.userId }).populate('questionId');
            res.json(saved.filter(s => s.questionId));
        } else { res.json(memoryDb.savedQuestions.filter(s => s.userId === req.params.userId)); }
    } catch (e) { res.status(500).json({error: e.message}); }
});

app.post('/api/users/:userId/saved-questions', async (req, res) => {
    try {
        const { questionId, folder } = req.body;
        if (isDbConnected()) { await SavedQuestion.create({ userId: req.params.userId, questionId, folder }); }
        else { memoryDb.savedQuestions.push({ _id: Date.now().toString(), userId: req.params.userId, questionId, folder }); }
        res.json({ success: true });
    } catch (e) { res.status(500).json({error: e.message}); }
});

app.patch('/api/users/:userId/saved-questions/:id', async (req, res) => {
    try {
        const { folder } = req.body;
        if (isDbConnected()) { await SavedQuestion.findByIdAndUpdate(req.params.id, { folder }); }
        res.json({ success: true });
    } catch (e) { res.status(500).json({error: e.message}); }
});

app.delete('/api/users/:userId/saved-questions/:id', async (req, res) => {
    try {
        if (isDbConnected()) { await SavedQuestion.findByIdAndDelete(req.params.id); }
        else { memoryDb.savedQuestions = memoryDb.savedQuestions.filter(s => s._id !== req.params.id); }
        res.json({ success: true });
    } catch (e) { res.status(500).json({error: e.message}); }
});

app.delete('/api/users/:userId/saved-questions/by-q/:questionId', async (req, res) => {
    try {
        if (isDbConnected()) { await SavedQuestion.findOneAndDelete({ userId: req.params.userId, questionId: req.params.questionId }); }
        res.json({ success: true });
    } catch (e) { res.status(500).json({error: e.message}); }
});

app.get('/api/users/:userId/mistakes', async (req, res) => {
    try {
        if (isDbConnected()) {
            const mistakes = await Mistake.find({ userId: req.params.userId }).sort({ lastMissed: -1 });
            res.json(mistakes);
        } else { res.json(memoryDb.mistakes.filter(m => m.userId === req.params.userId)); }
    } catch (e) { res.status(500).json({error: e.message}); }
});

app.delete('/api/users/:userId/mistakes/:id', async (req, res) => {
    try {
        if (isDbConnected()) { await Mistake.findByIdAndDelete(req.params.id); }
        else { memoryDb.mistakes = memoryDb.mistakes.filter(m => m._id !== req.params.id); }
        res.json({ success: true });
    } catch (e) { res.status(500).json({error: e.message}); }
});

app.get('/api/admin/questions', async (req, res) => {
    try {
        const { page = 1, limit = 10, subject, chapter } = req.query;
        const query = {};
        if(subject) query.subject = subject;
        if(chapter) query.chapter = chapter;
        if(isDbConnected()) {
            const questions = await QuestionBank.find(query).skip((page-1)*limit).limit(Number(limit)).sort({createdAt: -1});
            const total = await QuestionBank.countDocuments(query);
            res.json({ questions, total });
        } else {
            const qs = memoryDb.questions.filter(q => (!subject || q.subject === subject) && (!chapter || q.chapter === chapter));
            res.json({ questions: qs.slice((page-1)*limit, page*limit), total: qs.length });
        }
    } catch(e) { res.status(500).json({error: e.message}); }
});

app.post('/api/admin/questions/bulk', async (req, res) => {
    try {
        const { questions, metadata } = req.body;
        if(isDbConnected()) {
            await QuestionBank.insertMany(questions);
            if (metadata) { await QuestionPaper.findOneAndUpdate({ id: metadata.id }, metadata, { upsert: true, new: true }); }
        } else {
            questions.forEach(q => memoryDb.questions.push({...q, _id: (Date.now() + Math.random()).toString()}));
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
        if(isDbConnected()) { await QuestionBank.findByIdAndDelete(req.params.id); }
        else { memoryDb.questions = memoryDb.questions.filter(q => q._id !== req.params.id); }
        res.json({ success: true });
    } catch(e) { res.status(500).json({error: e.message}); }
});

app.get('/api/question-papers', async (req, res) => {
    try {
        if (isDbConnected()) {
            const papers = await QuestionPaper.find().sort({ year: -1 });
            res.json(papers);
        } else { res.json(memoryDb.questionPapers); }
    } catch(e) { res.status(500).json({error: e.message}); }
});

app.get('/api/quiz/past-paper/:examRef', async (req, res) => {
    try {
        const { examRef } = req.params;
        if (isDbConnected()) {
            const questions = await QuestionBank.find({ examRef });
            res.json(questions);
        } else {
            const questions = memoryDb.questions.filter(q => q.examRef === examRef);
            res.json(questions);
        }
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/quiz/generate-from-db', async (req, res) => {
    try {
        const { subject, chapter, topics, count } = req.body;
        if (isDbConnected()) {
            const pipeline = [
                { $match: { subject, chapter: chapter === 'Full Syllabus' ? { $exists: true } : chapter, ...(topics && topics.length > 0 && topics[0] !== 'Full Syllabus' ? { topic: { $in: topics } } : {}) }},
                { $sample: { size: count } }
            ];
            const questions = await QuestionBank.aggregate(pipeline);
            res.json(questions);
        } else {
            const filtered = memoryDb.questions.filter(q => q.subject === subject && (chapter === 'Full Syllabus' || q.chapter === chapter));
            const shuffled = filtered.sort(() => 0.5 - Math.random()).slice(0, count);
            res.json(shuffled);
        }
    } catch (e) { res.status(500).json({error: e.message}); }
});

app.get('/api/admin/payments', async (req, res) => {
    try {
        if(isDbConnected()) {
            const payments = await Payment.find().sort({ timestamp: -1 });
            res.json(payments);
        } else { res.json(memoryDb.payments); }
    } catch(e) { res.status(500).json({error: e.message}); }
});

app.post('/api/payments', async (req, res) => {
    try {
        if(isDbConnected()) { await Payment.create(req.body); }
        else { memoryDb.payments.push({ ...req.body, _id: Date.now().toString(), status: 'PENDING', timestamp: Date.now() }); }
        res.json({ success: true });
    } catch(e) { res.status(500).json({error: e.message}); }
});

app.put('/api/admin/payments/:id', async (req, res) => {
    try {
        const { status } = req.body;
        if(isDbConnected()) { await Payment.findByIdAndUpdate(req.params.id, { status }); }
        else { const p = memoryDb.payments.find(x => x._id === req.params.id); if(p) p.status = status; }
        res.json({ success: true });
    } catch(e) { res.status(500).json({error: e.message}); }
});

app.delete('/api/admin/payments/:id', async (req, res) => {
    try {
        if(isDbConnected()) { await Payment.findByIdAndDelete(req.params.id); }
        else { memoryDb.payments = memoryDb.payments.filter(p => p._id !== req.params.id); }
        res.json({ success: true });
    } catch(e) { res.status(500).json({error: e.message}); }
});

app.get('/api/leaderboard', async (req, res) => {
    try {
        if(isDbConnected()) {
            const users = await User.find({}, 'uid displayName photoURL points college hscBatch target department').sort({ points: -1 }).limit(100);
            res.json(users);
        } else { res.json(memoryDb.users.sort((a,b) => (b.points||0) - (a.points||0))); }
    } catch(e) { res.status(500).json({error: e.message}); }
});

app.get('/api/notifications', async (req, res) => {
    try {
        if(isDbConnected()) {
            const notifs = await Notification.find().sort({ date: -1 }).limit(50);
            res.json(notifs);
        } else { res.json(memoryDb.notifications); }
    } catch(e) { res.status(500).json({error: e.message}); }
});

app.post('/api/admin/notifications', async (req, res) => {
    try {
        if(isDbConnected()) { await Notification.create(req.body); }
        else { memoryDb.notifications.unshift({ ...req.body, _id: Date.now().toString(), date: Date.now() }); }
        res.json({ success: true });
    } catch(e) { res.status(500).json({error: e.message}); }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
