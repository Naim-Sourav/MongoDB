
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
// 1. General Limiter: Protects against general spam (300 req per 15 min per IP)
const generalLimiter = rateLimit({
	windowMs: 15 * 60 * 1000, 
	limit: 300, 
	standardHeaders: 'draft-7',
	legacyHeaders: false,
    message: { error: "Too many requests, please try again later." }
});

// 2. Heavy Task Limiter: Protects DB intensive routes like Quiz Generation (50 req per 15 min)
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
  questTemplates: [], 
  examPacks: [],
  questionPapers: [],
  reports: [] // NEW: Reports storage
};

// Connect to MongoDB with Pool Size Optimization
mongoose.connect(MONGODB_URI, {
  serverSelectionTimeoutMS: 5000, 
  socketTimeoutMS: 45000,
  maxPoolSize: 10 // Limit connection pool to avoid max connection errors on free tier
})
  .then(() => console.log('✅ Connected to MongoDB Atlas'))
  .catch(err => console.error('⚠️ MongoDB Connection Failed. Switching to In-Memory Fallback mode.'));

// Helper to check DB status
const isDbConnected = () => mongoose.connection.readyState === 1;

// --- Helper Functions ---
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
  uid: { type: String, required: true, unique: true, index: true },
  email: String,
  displayName: String,
  photoURL: String,
  phoneNumber: String,
  role: { type: String, default: 'student' },
  college: String,
  hscBatch: String,
  department: String,
  target: String,
  points: { type: Number, default: 0, index: -1 },
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
  status: { type: String, default: 'PENDING', enum: ['PENDING', 'APPROVED', 'REJECTED'], index: true },
  timestamp: { type: Number, default: Date.now }
});
const Payment = mongoose.model('Payment', paymentSchema);

const notificationSchema = new mongoose.Schema({
  title: String,
  message: String,
  type: { type: String, enum: ['INFO', 'WARNING', 'SUCCESS', 'BATTLE_CHALLENGE', 'BATTLE_RESULT'] },
  date: { type: Number, default: Date.now, index: -1 },
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
  subject: { type: String, required: true, index: true },
  chapter: { type: String, required: true, index: true },
  topic: String,
  question: { type: String, required: true },
  options: { type: [String], required: true },
  correctAnswerIndex: { type: Number, required: true },
  explanation: String,
  difficulty: { type: String, default: 'MEDIUM' },
  examRef: { type: String, index: true },
  createdAt: { type: Number, default: Date.now }
});
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
  userId: { type: String, required: true, index: true },
  questionId: { type: mongoose.Schema.Types.ObjectId, ref: 'QuestionBank' },
  folder: { type: String, default: 'General' },
  savedAt: { type: Number, default: Date.now }
});
const SavedQuestion = mongoose.model('SavedQuestion', savedQuestionSchema);

const mistakeSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
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

// NEW: Report Schema
const reportSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    userName: String,
    questionId: { type: mongoose.Schema.Types.ObjectId, ref: 'QuestionBank' },
    // If question is not from DB (e.g. AI generated), we store raw text
    questionText: String, 
    type: { type: String, required: true, enum: ['WRONG_ANSWER', 'TYPO', 'WRONG_EXPLANATION', 'OTHER'] },
    description: String,
    status: { type: String, default: 'PENDING', enum: ['PENDING', 'RESOLVED', 'IGNORED'] },
    timestamp: { type: Number, default: Date.now }
});
const Report = mongoose.model('Report', reportSchema);

// --- ROUTES ---

app.get('/', (req, res) => {
  res.send(`🚀 Dhrubok API Running! Mode: ${isDbConnected() ? 'MongoDB' : 'Memory'}`);
});

// ----------------------
// REPORT ROUTES
// ----------------------

app.post('/api/reports', async (req, res) => {
    try {
        const { userId, userName, questionId, questionText, type, description } = req.body;
        
        if (isDbConnected()) {
            await Report.create({ 
                userId, 
                userName, 
                questionId: questionId || undefined, 
                questionText, 
                type, 
                description 
            });
        } else {
            memoryDb.reports.push({ 
                _id: Date.now().toString(), 
                userId, userName, questionId, questionText, type, description, 
                status: 'PENDING', timestamp: Date.now() 
            });
        }
        res.json({ success: true });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: "Failed to submit report" });
    }
});

app.get('/api/admin/reports', async (req, res) => {
    try {
        if (isDbConnected()) {
            // Populate question data to show in admin panel
            const reports = await Report.find().sort({ timestamp: -1 }).populate('questionId').lean();
            res.json(reports);
        } else {
            res.json(memoryDb.reports);
        }
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.delete('/api/admin/reports/:id', async (req, res) => {
    try {
        if (isDbConnected()) {
            await Report.findByIdAndDelete(req.params.id);
        } else {
            memoryDb.reports = memoryDb.reports.filter(r => r._id !== req.params.id);
        }
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ----------------------
// USER ROUTES
// ----------------------

app.post('/api/users/sync', async (req, res) => {
  const { uid, email, displayName, photoURL, phoneNumber, college, hscBatch, department, target } = req.body;
  if (!uid) return res.status(400).json({ error: "UID required" });

  try {
    let user;
    if (isDbConnected()) {
      user = await User.findOne({ uid });
      if (!user) {
        user = new User({ uid, email, displayName, photoURL, phoneNumber, college, hscBatch, department, target });
        user.dailyQuests = generateDailyQuests();
        await user.save();
      } else {
        // Update user fields
        if (displayName) user.displayName = displayName;
        if (photoURL) user.photoURL = photoURL;
        if (phoneNumber) user.phoneNumber = phoneNumber;
        if (college) user.college = college;
        if (hscBatch) user.hscBatch = hscBatch;
        if (department) user.department = department;
        if (target) user.target = target;
        user.lastLogin = Date.now();
        
        // Reset Quests if needed (Logic for Daily Reset)
        const now = new Date();
        const lastReset = new Date(user.lastQuestReset || 0);
        if (now.getDate() !== lastReset.getDate() || now.getMonth() !== lastReset.getMonth()) {
            user.dailyQuests = generateDailyQuests();
            user.lastQuestReset = Date.now();
        }
        await user.save();
      }
    } else {
      // Memory Fallback
      const existing = memoryDb.users.find(u => u.uid === uid);
      if (!existing) {
        memoryDb.users.push({ uid, email, displayName, photoURL, phoneNumber, college, hscBatch, department, target, stats: {}, dailyQuests: generateDailyQuests() });
      } else {
        existing.lastLogin = Date.now();
        if(displayName) existing.displayName = displayName;
        if(photoURL) existing.photoURL = photoURL;
        if(phoneNumber) existing.phoneNumber = phoneNumber;
        if(college) existing.college = college;
        if(hscBatch) existing.hscBatch = hscBatch;
        if(department) existing.department = department;
        if(target) existing.target = target;
      }
    }
    res.json({ success: true, user });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/users/:userId/stats', async (req, res) => {
  try {
    const { userId } = req.params;
    if (isDbConnected()) {
      const user = await User.findOne({ uid: userId });
      if (user) {
        res.json({
          points: user.points,
          totalExams: user.totalExams,
          totalCorrect: user.stats.totalCorrect,
          totalWrong: user.stats.totalWrong,
          quests: user.dailyQuests,
          subjectBreakdown: Array.from(user.stats.subjectStats.entries()).map(([k, v]) => ({
             subject: k, 
             accuracy: v.total > 0 ? (v.correct / v.total) * 100 : 0 
          })),
          user: user 
        });
      } else {
        res.status(404).json({ error: 'User not found' });
      }
    } else {
      res.json({ points: 0, totalExams: 0, quests: [] });
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/users/:userId/exam-results', async (req, res) => {
  const { userId } = req.params;
  const { subject, correct, wrong, skipped, score, topicStats, mistakes } = req.body;

  try {
    if (isDbConnected()) {
      const user = await User.findOne({ uid: userId });
      if (user) {
        user.totalExams += 1;
        user.points += score;
        user.stats.totalCorrect += correct;
        user.stats.totalWrong += wrong;
        user.stats.totalSkipped += skipped;

        // Update Subject Stats
        if (!user.stats.subjectStats.has(subject)) {
            user.stats.subjectStats.set(subject, { correct: 0, total: 0 });
        }
        const subStat = user.stats.subjectStats.get(subject);
        subStat.correct += correct;
        subStat.total += (correct + wrong + skipped);

        // Update Topic Stats
        if (topicStats && Array.isArray(topicStats)) {
            topicStats.forEach(t => {
                if (!user.stats.topicStats.has(t.topic)) {
                    user.stats.topicStats.set(t.topic, { correct: 0, total: 0 });
                }
                const ts = user.stats.topicStats.get(t.topic);
                ts.correct += t.correct;
                ts.total += t.total;
            });
        }

        await user.save();

        // Save Result Record
        await ExamResult.create({
            userId, subject, correct, wrong, skipped, score, 
            totalQuestions: correct + wrong + skipped,
            topicStats
        });

        // Save Mistakes
        if (mistakes && mistakes.length > 0) {
            for (const m of mistakes) {
                const existing = await Mistake.findOne({ userId, question: m.question });
                if (existing) {
                    existing.wrongCount += 1;
                    existing.lastMissed = Date.now();
                    await existing.save();
                } else {
                    await Mistake.create({
                        userId, 
                        question: m.question, 
                        options: m.options, 
                        correctAnswerIndex: m.correctAnswerIndex,
                        explanation: m.explanation,
                        subject: m.subject,
                        chapter: m.chapter,
                        topic: m.topic
                    });
                }
            }
        }
      }
    }
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- MISTAKES ---

app.get('/api/users/:userId/mistakes', async (req, res) => {
    try {
        if(isDbConnected()) {
            const mistakes = await Mistake.find({ userId: req.params.userId }).sort({ lastMissed: -1 }).limit(100);
            res.json(mistakes);
        } else {
            res.json(memoryDb.mistakes.filter(m => m.userId === req.params.userId));
        }
    } catch(e) { res.status(500).json({error:e.message}); }
});

app.delete('/api/users/:userId/mistakes/:id', async (req, res) => {
    try {
        if(isDbConnected()) {
            await Mistake.findByIdAndDelete(req.params.id);
        }
        res.json({ success: true });
    } catch(e) { res.status(500).json({error:e.message}); }
});

// --- SAVED QUESTIONS ---

app.get('/api/users/:userId/saved-questions', async (req, res) => {
    try {
        if(isDbConnected()) {
            const saved = await SavedQuestion.find({ userId: req.params.userId }).populate('questionId');
            res.json(saved);
        } else {
            res.json(memoryDb.savedQuestions.filter(s => s.userId === req.params.userId));
        }
    } catch(e) { res.status(500).json({error:e.message}); }
});

app.post('/api/users/:userId/saved-questions', async (req, res) => {
    try {
        if(isDbConnected()) {
            await SavedQuestion.create({ 
                userId: req.params.userId, 
                questionId: req.body.questionId, 
                folder: req.body.folder || 'General' 
            });
        }
        res.json({ success: true });
    } catch(e) { res.status(500).json({error:e.message}); }
});

app.patch('/api/users/:userId/saved-questions/:id', async (req, res) => {
    try {
        if(isDbConnected()) {
            await SavedQuestion.findByIdAndUpdate(req.params.id, { folder: req.body.folder });
        }
        res.json({ success: true });
    } catch(e) { res.status(500).json({error:e.message}); }
});

app.delete('/api/users/:userId/saved-questions/:id', async (req, res) => {
    try {
        if(isDbConnected()) {
            await SavedQuestion.findByIdAndDelete(req.params.id);
        }
        res.json({ success: true });
    } catch(e) { res.status(500).json({error:e.message}); }
});

app.delete('/api/users/:userId/saved-questions/by-q/:questionId', async (req, res) => {
    try {
        if(isDbConnected()) {
            await SavedQuestion.findOneAndDelete({ userId: req.params.userId, questionId: req.params.questionId });
        }
        res.json({ success: true });
    } catch(e) { res.status(500).json({error:e.message}); }
});

// --- QUESTS ---

app.post('/api/quests/update', async (req, res) => {
    const { userId, actionType, value } = req.body;
    try {
        if (isDbConnected()) {
            const user = await User.findOne({ uid: userId });
            if (user) {
                let updated = false;
                user.dailyQuests.forEach(q => {
                    if (q.type === actionType && !q.completed) {
                        q.progress += value;
                        if (q.progress >= q.target) q.completed = true;
                        updated = true;
                    }
                });
                if (updated) await user.save();
            }
        }
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/quests/claim', async (req, res) => {
    const { userId, questId } = req.body;
    try {
        if (isDbConnected()) {
            const user = await User.findOne({ uid: userId });
            if (user) {
                const quest = user.dailyQuests.find(q => q.id === questId);
                if (quest && quest.completed && !quest.claimed) {
                    quest.claimed = true;
                    user.points += quest.reward;
                    await user.save();
                    res.json({ success: true, points: user.points });
                } else {
                    res.status(400).json({ error: "Quest not claimable" });
                }
            }
        } else {
            res.json({ success: true, points: 100 });
        }
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// --- ADMIN / QUESTION BANK ---

app.get('/api/admin/questions', async (req, res) => {
    const { page = 1, limit = 20, subject, chapter } = req.query;
    try {
        if (isDbConnected()) {
            const filter = {};
            if (subject) filter.subject = subject;
            if (chapter) filter.chapter = chapter;
            
            const questions = await QuestionBank.find(filter)
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(parseInt(limit));
            const total = await QuestionBank.countDocuments(filter);
            
            res.json({ questions, total });
        } else {
            res.json({ questions: memoryDb.questions, total: memoryDb.questions.length });
        }
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/admin/questions/bulk', async (req, res) => {
    const { questions, metadata } = req.body;
    try {
        if (isDbConnected()) {
            if (questions && questions.length > 0) {
                await QuestionBank.insertMany(questions);
            }
            if (metadata) {
                // Upsert metadata
                await QuestionPaper.findOneAndUpdate(
                    { id: metadata.id },
                    metadata,
                    { upsert: true, new: true }
                );
            }
        } else {
            memoryDb.questions.push(...questions);
        }
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.delete('/api/admin/questions/:id', async (req, res) => {
    try {
        if (isDbConnected()) {
            await QuestionBank.findByIdAndDelete(req.params.id);
        }
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/question-papers', cache('5 minutes'), async (req, res) => {
    try {
        if (isDbConnected()) {
            const papers = await QuestionPaper.find();
            res.json(papers);
        } else {
            res.json(memoryDb.questionPapers);
        }
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- QUIZ GEN FROM DB ---

app.get('/api/quiz/past-paper/:examRef', cache('10 minutes'), async (req, res) => {
    try {
        if (isDbConnected()) {
            const questions = await QuestionBank.find({ examRef: req.params.examRef });
            res.json(questions);
        } else {
            res.json([]);
        }
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/quiz/generate-from-db', heavyTaskLimiter, async (req, res) => {
    const { subject, chapter, topics, count } = req.body;
    try {
        if (isDbConnected()) {
            const filter = { subject };
            if (chapter && chapter !== 'Full Syllabus') filter.chapter = chapter;
            // If topics provided, verify against syllabus/tags if implemented, else random from chapter
            
            const questions = await QuestionBank.aggregate([
                { $match: filter },
                { $sample: { size: count || 10 } }
            ]);
            res.json(questions);
        } else {
            res.json([]);
        }
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/quiz/syllabus-stats', cache('10 minutes'), async (req, res) => {
    try {
        if(isDbConnected()) {
            // Aggregate count of questions per subject/chapter
            const stats = await QuestionBank.aggregate([
                { $group: { _id: { subject: "$subject", chapter: "$chapter" }, count: { $sum: 1 } } }
            ]);
            
            const formatted = {};
            stats.forEach(item => {
                if(!formatted[item._id.subject]) formatted[item._id.subject] = { chapters: {} };
                formatted[item._id.subject].chapters[item._id.chapter] = { count: item.count };
            });
            res.json(formatted);
        } else {
            res.json({});
        }
    } catch(e) { res.status(500).json({error:e.message}); }
});

// --- EXAM PACKS ---
app.get('/api/exam-packs', async (req, res) => {
    try {
        if(isDbConnected()) {
            const packs = await ExamPack.find();
            res.json(packs);
        } else {
            res.json([]);
        }
    } catch(e) { res.status(500).json({error:e.message}); }
});

// --- NOTIFICATIONS ---

app.get('/api/notifications', async (req, res) => {
    try {
        if(isDbConnected()) {
            const notifs = await Notification.find().sort({ date: -1 }).limit(20);
            res.json(notifs);
        } else {
            res.json(memoryDb.notifications);
        }
    } catch(e) { res.status(500).json({error:e.message}); }
});

app.post('/api/admin/notifications', async (req, res) => {
    try {
        if(isDbConnected()) {
            await Notification.create(req.body);
        } else {
            memoryDb.notifications.push({ ...req.body, _id: Date.now().toString(), date: Date.now() });
        }
        res.json({ success: true });
    } catch(e) { res.status(500).json({error:e.message}); }
});

// --- LEADERBOARD ---

app.get('/api/leaderboard', cache('1 minute'), async (req, res) => {
    try {
        if(isDbConnected()) {
            const users = await User.find().sort({ points: -1 }).limit(50).select('uid displayName photoURL points college target');
            res.json(users);
        } else {
            res.json(memoryDb.users);
        }
    } catch(e) { res.status(500).json({error:e.message}); }
});

// --- ADMIN STATS ---

app.get('/api/admin/stats', async (req, res) => {
    try {
        if (isDbConnected()) {
            const totalRevenue = await Payment.aggregate([{ $match: { status: 'APPROVED' } }, { $group: { _id: null, total: { $sum: "$amount" } } }]);
            const pendingPayments = await Payment.countDocuments({ status: 'PENDING' });
            const totalUsers = await User.countDocuments();
            const totalQuestions = await QuestionBank.countDocuments();
            const approvedEnrollments = await Payment.countDocuments({ status: 'APPROVED' });
            
            res.json({
                totalRevenue: totalRevenue[0]?.total || 0,
                pendingPayments,
                totalUsers,
                totalQuestions,
                approvedEnrollments,
                totalExams: await ExamResult.countDocuments()
            });
        } else {
            res.json({ totalRevenue: 0, pendingPayments: 0, totalUsers: 0 });
        }
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// --- PAYMENTS ---

app.get('/api/admin/payments', async (req, res) => {
    try {
        if(isDbConnected()) {
            const payments = await Payment.find().sort({ timestamp: -1 });
            res.json(payments);
        } else {
            res.json(memoryDb.payments);
        }
    } catch(e) { res.status(500).json({error:e.message}); }
});

app.post('/api/payments', async (req, res) => {
    try {
        if(isDbConnected()) {
            await Payment.create(req.body);
        } else {
            memoryDb.payments.push({ ...req.body, _id: Date.now().toString(), status: 'PENDING', timestamp: Date.now() });
        }
        res.json({ success: true });
    } catch(e) { res.status(500).json({error:e.message}); }
});

app.put('/api/admin/payments/:id', async (req, res) => {
    try {
        if(isDbConnected()) {
            await Payment.findByIdAndUpdate(req.params.id, { status: req.body.status });
        } 
        res.json({ success: true });
    } catch(e) { res.status(500).json({error:e.message}); }
});

app.delete('/api/admin/payments/:id', async (req, res) => {
    try {
        if(isDbConnected()) {
            await Payment.findByIdAndDelete(req.params.id);
        }
        res.json({ success: true });
    } catch(e) { res.status(500).json({error:e.message}); }
});

// --- BATTLE ROUTES (Basic Placeholders, most logic is client-side via Firebase RTDB) ---
app.post('/api/battles/create', async (req, res) => {
    // In a real backend architecture, the server might create the RTDB node securely
    // For now, we trust the client implementation but provide endpoint for logging
    res.json({ success: true });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
