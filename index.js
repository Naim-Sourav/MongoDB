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
  examPacks: [
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
    },
    {
      id: 'eng-qbank-solve',
      title: 'ইঞ্জিনিয়ারিং প্রশ্ন ব্যাংক সলভ',
      subtitle: 'বুয়েট, চুয়েট, কুয়েট, রুয়েট বিগত ২০ বছরের প্রশ্ন',
      price: 750,
      originalPrice: 2000,
      totalExams: 50,
      features: ['অধ্যায়ভিত্তিক এক্সাম', 'কঠিন প্রশ্নের সহজ সমাধান', 'শর্টকাট টেকনিক', 'আনলিমিটেড এটেম্পট'],
      theme: 'blue',
      tag: 'Premium'
    },
    {
      id: 'varsity-ka-boost',
      title: 'ভার্সিটি ক-ইউনিট বুস্টার',
      subtitle: 'ঢাবি, জাবি, রাবি ও গুচ্ছ প্রস্তুতির সেরা প্যাক',
      price: 450,
      originalPrice: 1200,
      totalExams: 60,
      features: ['টাইম ম্যানেজমেন্ট প্র্যাকটিস', 'বিষয়ভিত্তিক মডেল টেস্ট', 'পূর্ণাঙ্গ মডেল টেস্ট', 'লাইভ লিডারবোর্ড'],
      theme: 'orange',
      tag: 'Popular'
    }
  ]
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

// --- Schemas & Models (Mongoose) ---

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
  }
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
  type: { type: String, enum: ['INFO', 'WARNING', 'SUCCESS'] },
  date: { type: Number, default: Date.now },
  target: { type: String, default: 'ALL' }
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
    totalTimeTaken: { type: Number, default: 0 }, // For tie-breaking
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
  createdAt: { type: Number, default: Date.now }
});
questionBankSchema.index({ subject: 1, chapter: 1, topic: 1 });
const QuestionBank = mongoose.model('QuestionBank', questionBankSchema);

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
  res.send(`🚀 Shikkha Shohayok API Running! Mode: ${isDbConnected() ? 'MongoDB' : 'Memory'}`);
});

// --- ADMIN & STATS ---
app.get('/api/admin/stats', async (req, res) => {
  try {
    const stats = { totalUsers: 0, totalRevenue: 0, totalQuestions: 0, totalExams: 0, pendingPayments: 0, approvedEnrollments: 0 };
    if (isDbConnected()) {
        stats.totalUsers = await User.countDocuments();
        stats.totalQuestions = await QuestionBank.countDocuments();
        stats.totalExams = await ExamResult.countDocuments();
        stats.pendingPayments = await Payment.countDocuments({ status: 'PENDING' });
        stats.approvedEnrollments = await Payment.countDocuments({ status: 'APPROVED' });
        const revenueAgg = await Payment.aggregate([{ $match: { status: 'APPROVED' } }, { $group: { _id: null, total: { $sum: "$amount" } } }]);
        stats.totalRevenue = revenueAgg[0]?.total || 0;
    } else {
        stats.totalUsers = memoryDb.users.length;
        stats.totalQuestions = memoryDb.questions.length;
        stats.totalExams = memoryDb.examResults.length;
        stats.pendingPayments = memoryDb.payments.filter(p => p.status === 'PENDING').length;
        stats.approvedEnrollments = memoryDb.payments.filter(p => p.status === 'APPROVED').length;
        stats.totalRevenue = memoryDb.payments.filter(p => p.status === 'APPROVED').reduce((sum, p) => sum + (p.amount || 0), 0);
    }
    res.json(stats);
  } catch (e) { res.status(500).json({ error: 'Stats failed' }); }
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
    } catch(e) { res.status(500).json({error: e.message}); }
});

app.post('/api/payments', async (req, res) => {
    try {
        const data = { ...req.body, status: 'PENDING', timestamp: Date.now() };
        if(isDbConnected()) {
            await new Payment(data).save();
        } else {
            memoryDb.payments.push({ ...data, id: Date.now().toString() });
        }
        res.json({ success: true });
    } catch(e) { res.status(500).json({error: e.message}); }
});

app.put('/api/admin/payments/:id', async (req, res) => {
    try {
        const { status } = req.body;
        if(isDbConnected()) {
            await Payment.findByIdAndUpdate(req.params.id, { status });
        } else {
            const p = memoryDb.payments.find(x => x.id === req.params.id);
            if(p) p.status = status;
        }
        res.json({ success: true });
    } catch(e) { res.status(500).json({error: e.message}); }
});

app.delete('/api/admin/payments/:id', async (req, res) => {
    try {
        if(isDbConnected()) {
            await Payment.findByIdAndDelete(req.params.id);
        } else {
            memoryDb.payments = memoryDb.payments.filter(x => x.id !== req.params.id);
        }
        res.json({ success: true });
    } catch(e) { res.status(500).json({error: e.message}); }
});

// --- NOTIFICATIONS ---
app.get('/api/notifications', async (req, res) => {
    try {
        if(isDbConnected()) {
            const notifs = await Notification.find().sort({ date: -1 });
            res.json(notifs);
        } else {
            res.json(memoryDb.notifications);
        }
    } catch(e) { res.status(500).json({error: e.message}); }
});

app.post('/api/admin/notifications', async (req, res) => {
    try {
        const data = { ...req.body, date: Date.now() };
        if(isDbConnected()) {
            await new Notification(data).save();
        } else {
            memoryDb.notifications.unshift({ ...data, _id: Date.now().toString() });
        }
        res.json({ success: true });
    } catch(e) { res.status(500).json({error: e.message}); }
});

// --- LEADERBOARD ---
app.get('/api/leaderboard', async (req, res) => {
    try {
        if(isDbConnected()) {
            const users = await User.find().sort({ points: -1 }).limit(50).select('uid displayName photoURL points');
            res.json(users);
        } else {
            res.json(memoryDb.users.sort((a,b) => b.points - a.points).slice(0, 50));
        }
    } catch(e) { res.status(500).json({error: e.message}); }
});

// --- EXAM PACKS ---
app.get('/api/exam-packs', async (req, res) => {
    try {
        if(isDbConnected()) {
            const packs = await ExamPack.find();
            res.json(packs.length ? packs : memoryDb.examPacks);
        } else {
            res.json(memoryDb.examPacks);
        }
    } catch(e) { res.status(500).json({error: e.message}); }
});

// --- USERS & SYNC ---
app.post('/api/users/sync', async (req, res) => {
  try {
    const { uid, email, displayName, photoURL, college, hscBatch, department, target } = req.body;
    const updateData = { uid, email, displayName, photoURL, lastLogin: Date.now(), college, hscBatch, department, target };
    Object.keys(updateData).forEach(key => updateData[key] === undefined && delete updateData[key]);

    if (isDbConnected()) {
      const user = await User.findOneAndUpdate({ uid }, updateData, { upsert: true, new: true });
      return res.json(user);
    } else {
      let user = memoryDb.users.find(u => u.uid === uid);
      if (!user) { 
          user = { ...updateData, points: 0, stats: { totalCorrect: 0, totalWrong: 0, totalSkipped: 0, subjectStats: {}, topicStats: {} } }; 
          memoryDb.users.push(user); 
      } else {
          Object.assign(user, updateData);
      }
      return res.json(user);
    }
  } catch (e) { res.status(500).json({error: 'Sync failed'}); }
});

app.get('/api/users/:userId/enrollments', async (req, res) => {
  try {
    const { userId } = req.params;
    if (isDbConnected()) {
        const payments = await Payment.find({ userId, status: 'APPROVED' });
        res.json(payments.map(p => ({ id: p.courseId, title: p.courseTitle, progress: 0 })));
    } else {
        const payments = memoryDb.payments.filter(p => p.userId === userId && p.status === 'APPROVED');
        res.json(payments.map(p => ({ id: p.courseId, title: p.courseTitle, progress: 0 })));
    }
  } catch (e) { res.status(500).json({ error: 'Fetch enrollments failed' }); }
});

app.get('/api/users/:userId/stats', async (req, res) => {
    const { userId } = req.params;
    try {
        let user;
        if (isDbConnected()) {
            user = await User.findOne({ uid: userId });
        } else {
            user = memoryDb.users.find(u => u.uid === userId);
        }
        if (!user) return res.json({ points: 0, totalExams: 0 });

        const subjStatsObj = user.stats?.subjectStats instanceof Map ? Object.fromEntries(user.stats.subjectStats) : (user.stats?.subjectStats || {});
        const topicStatsObj = user.stats?.topicStats instanceof Map ? Object.fromEntries(user.stats.topicStats) : (user.stats?.topicStats || {});

        const subjectBreakdown = Object.keys(subjStatsObj).map(s => ({
            subject: s, accuracy: (subjStatsObj[s].correct / subjStatsObj[s].total) * 100
        })).sort((a,b) => b.accuracy - a.accuracy);

        const topicBreakdown = Object.keys(topicStatsObj).map(t => ({
            topic: t, accuracy: (topicStatsObj[t].correct / topicStatsObj[t].total) * 100, total: topicStatsObj[t].total
        })).sort((a,b) => b.accuracy - a.accuracy);

        res.json({
            user: { college: user.college, hscBatch: user.hscBatch, department: user.department, target: user.target, points: user.points },
            points: user.points,
            totalExams: user.totalExams,
            totalCorrect: user.stats?.totalCorrect || 0,
            totalWrong: user.stats?.totalWrong || 0,
            subjectBreakdown,
            strongestTopics: topicBreakdown.slice(0, 5),
            weakestTopics: topicBreakdown.slice().reverse().slice(0, 5)
        });
    } catch (e) { res.status(500).json({ error: 'Failed' }); }
});

app.post('/api/users/:userId/exam-results', async (req, res) => {
    try {
        const { userId } = req.params;
        const { mistakes, ...resultData } = req.body; 
        const examResultData = { userId, ...resultData, timestamp: Date.now() };
        
        if (isDbConnected()) {
            await new ExamResult(examResultData).save();
            if (mistakes && mistakes.length > 0) {
                const bulkOps = mistakes.map(m => ({
                    updateOne: {
                        filter: { userId, question: m.question }, 
                        update: { $set: { ...m, userId, lastMissed: Date.now() }, $inc: { wrongCount: 1 } },
                        upsert: true
                    }
                }));
                await Mistake.bulkWrite(bulkOps);
            }
            const user = await User.findOne({ uid: userId });
            if (user) {
                if (!user.stats) user.stats = { totalCorrect:0, totalWrong:0, totalSkipped:0, subjectStats: {}, topicStats: {} };
                user.points = (user.points || 0) + (resultData.correct * 10) + 20; 
                user.totalExams = (user.totalExams || 0) + 1;
                user.stats.totalCorrect = (user.stats.totalCorrect || 0) + resultData.correct;
                user.stats.totalWrong = (user.stats.totalWrong || 0) + resultData.wrong;
                
                const subj = resultData.subject;
                const currentSubjStat = user.stats.subjectStats.get(subj) || { correct: 0, total: 0 };
                user.stats.subjectStats.set(subj, { correct: currentSubjStat.correct + resultData.correct, total: currentSubjStat.total + resultData.totalQuestions });

                if (resultData.topicStats && Array.isArray(resultData.topicStats)) {
                    resultData.topicStats.forEach(ts => {
                        const currentTopicStat = user.stats.topicStats.get(ts.topic) || { correct: 0, total: 0 };
                        user.stats.topicStats.set(ts.topic, { correct: currentTopicStat.correct + ts.correct, total: currentTopicStat.total + ts.total });
                    });
                }
                await user.save();
            }
        } else {
            memoryDb.examResults.push(examResultData);
            if (mistakes) mistakes.forEach(m => memoryDb.mistakes.push({ ...m, userId, _id: Date.now() }));
            // Memory user update simplified...
        }
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: 'Failed' }); }
});

// --- SAVED QUESTIONS ---
app.get('/api/users/:userId/saved-questions', async (req, res) => {
    try {
        if(isDbConnected()) {
            const saved = await SavedQuestion.find({ userId: req.params.userId }).populate('questionId');
            res.json(saved.filter(s => s.questionId)); 
        } else {
            res.json(memoryDb.savedQuestions.filter(s => s.userId === req.params.userId));
        }
    } catch(e) { res.status(500).json({error: e.message}); }
});

app.post('/api/users/:userId/saved-questions', async (req, res) => {
    try {
        const { questionId, folder } = req.body;
        if(isDbConnected()) {
            await new SavedQuestion({ userId: req.params.userId, questionId, folder: folder || 'General' }).save();
        } else {
            memoryDb.savedQuestions.push({ userId: req.params.userId, questionId, folder: folder || 'General', _id: Date.now().toString() });
        }
        res.json({ success: true });
    } catch(e) { res.status(500).json({error: e.message}); }
});

app.patch('/api/users/:userId/saved-questions/:id', async (req, res) => {
    try {
        const { folder } = req.body;
        if(isDbConnected()) await SavedQuestion.findByIdAndUpdate(req.params.id, { folder });
        res.json({ success: true });
    } catch(e) { res.status(500).json({error: e.message}); }
});

app.delete('/api/users/:userId/saved-questions/:id', async (req, res) => {
    try {
        if(isDbConnected()) await SavedQuestion.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch(e) { res.status(500).json({error: e.message}); }
});

app.delete('/api/users/:userId/saved-questions/by-q/:qId', async (req, res) => {
    try {
        if(isDbConnected()) await SavedQuestion.findOneAndDelete({ userId: req.params.userId, questionId: req.params.qId });
        res.json({ success: true });
    } catch(e) { res.status(500).json({error: e.message}); }
});

// --- MISTAKES ---
app.get('/api/users/:userId/mistakes', async (req, res) => {
    try {
        if(isDbConnected()) {
            const mistakes = await Mistake.find({ userId: req.params.userId });
            res.json(mistakes);
        } else {
            res.json(memoryDb.mistakes.filter(m => m.userId === req.params.userId));
        }
    } catch(e) { res.status(500).json({error: e.message}); }
});

app.delete('/api/users/:userId/mistakes/:id', async (req, res) => {
    try {
        if(isDbConnected()) await Mistake.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch(e) { res.status(500).json({error: e.message}); }
});

// --- QUESTION BANK ADMIN ---
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
        const { questions } = req.body;
        if(isDbConnected()) await QuestionBank.insertMany(questions);
        else questions.forEach(q => memoryDb.questions.push({...q, _id: Date.now() + Math.random()}));
        res.json({ success: true });
    } catch(e) { res.status(500).json({error: e.message}); }
});

app.delete('/api/admin/questions/:id', async (req, res) => {
    try {
        if(isDbConnected()) await QuestionBank.findByIdAndDelete(req.params.id);
        else memoryDb.questions = memoryDb.questions.filter(q => q._id !== req.params.id);
        res.json({ success: true });
    } catch(e) { res.status(500).json({error: e.message}); }
});

// --- QUIZ & SYLLABUS ---
app.get('/api/quiz/syllabus-stats', async (req, res) => {
    try {
        if(isDbConnected()) {
            const stats = await QuestionBank.aggregate([{ $group: { _id: { subject: "$subject", chapter: "$chapter", topic: "$topic" }, count: { $sum: 1 } } }]);
            const result = {};
            stats.forEach(({ _id, count }) => {
                if(!result[_id.subject]) result[_id.subject] = { total: 0, chapters: {} };
                result[_id.subject].total += count;
                if(!result[_id.subject].chapters[_id.chapter]) result[_id.subject].chapters[_id.chapter] = { total: 0, topics: {} };
                result[_id.subject].chapters[_id.chapter].total += count;
                result[_id.subject].chapters[_id.chapter].topics[_id.topic || 'General'] = count;
            });
            res.json(result);
        } else { res.json({}); }
    } catch(e) { res.status(500).json({error: e.message}); }
});

app.post('/api/quiz/generate-from-db', async (req, res) => {
    try {
        const { subject, chapter, topics, count } = req.body;
        const query = { subject, chapter };
        if(topics && topics.length > 0) query.topic = { $in: topics };

        if(isDbConnected()) {
            const questions = await QuestionBank.aggregate([{ $match: query }, { $sample: { size: count } }]);
            res.json(questions);
        } else {
            let qs = memoryDb.questions.filter(q => q.subject === subject && q.chapter === chapter);
            if(topics && topics.length > 0) qs = qs.filter(q => topics.includes(q.topic));
            res.json(qs.slice(0, count));
        }
    } catch(e) { res.status(500).json({error: e.message}); }
});

// --- BATTLE ROUTES ---
app.post('/api/battles/create', async (req, res) => {
  try {
    const { userId, userName, avatar, config } = req.body;
    const roomId = Math.floor(100000 + Math.random() * 900000).toString(); 
    
    // Support multiple subjects and chapters query
    const query = {
        subject: { $in: config.subjects },
        chapter: { $in: config.chapters }
    };

    let questions = [];
    if (isDbConnected()) {
        questions = await QuestionBank.aggregate([{ $match: query }, { $sample: { size: config.questionCount } }]);
    } else {
        questions = memoryDb.questions.filter(q => 
            config.subjects.includes(q.subject) && 
            config.chapters.includes(q.chapter)
        ).slice(0, config.questionCount);
    }
    
    if (questions.length === 0) return res.status(400).json({ error: 'Not enough questions in database for selected topics.' });

    const battleData = {
      roomId, hostId: userId, config, questions,
      players: [{ uid: userId, name: userName, avatar, score: 0, totalTimeTaken: 0, team: config.mode === '2v2' ? 'A' : 'NONE', answers: {} }],
      status: 'WAITING'
    };

    if (isDbConnected()) { await new Battle(battleData).save(); } 
    else { memoryDb.battles.push(battleData); }
    res.json({ roomId });
  } catch (e) { 
      console.error(e);
      res.status(500).json({ error: 'Failed to create battle' }); 
  }
});

app.post('/api/battles/join', async (req, res) => {
  try {
    const { roomId, userId, userName, avatar } = req.body;
    let battle;
    if (isDbConnected()) battle = await Battle.findOne({ roomId });
    else battle = memoryDb.battles.find(b => b.roomId === roomId);

    if (!battle) return res.status(404).json({ error: 'Room not found' });
    if (battle.status !== 'WAITING') return res.status(400).json({ error: 'Game already started' });

    const exists = battle.players.find(p => p.uid === userId);
    if (!exists) {
        battle.players.push({ uid: userId, name: userName, avatar, score: 0, totalTimeTaken: 0, team: 'NONE', answers: {} });
        if (isDbConnected()) await battle.save();
    }
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: 'Failed to join battle' }); }
});

app.post('/api/battles/start', async (req, res) => {
    try {
        const { roomId, userId } = req.body;
        let battle;
        if (isDbConnected()) battle = await Battle.findOne({ roomId });
        else battle = memoryDb.battles.find(b => b.roomId === roomId);

        if (!battle) return res.status(404).json({ error: 'Room not found' });
        if (battle.hostId !== userId) return res.status(403).json({ error: 'Only host can start' });

        battle.status = 'ACTIVE';
        battle.startTime = Date.now();
        if (isDbConnected()) await battle.save();
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: 'Failed to start' }); }
});

app.get('/api/battles/:roomId', async (req, res) => {
  try {
    let battle;
    if (isDbConnected()) battle = await Battle.findOne({ roomId: req.params.roomId });
    else battle = memoryDb.battles.find(b => b.roomId === req.params.roomId);
    
    if (!battle) return res.status(404).json({ error: 'Battle not found' });

    // Auto-finish logic if time expired
    if (battle.status === 'ACTIVE' && battle.startTime) {
        const totalDuration = (battle.config.timePerQuestion * battle.questions.length) + 10; // 10s buffer
        const elapsed = (Date.now() - battle.startTime) / 1000;
        if (elapsed > totalDuration) {
            battle.status = 'FINISHED';
            if (isDbConnected()) await battle.save();
        }
    }

    res.json(battle);
  } catch (e) { res.status(500).json({ error: 'Failed to fetch battle' }); }
});

app.post('/api/battles/:roomId/answer', async (req, res) => {
  try {
    const { userId, isCorrect, questionIndex, selectedOption, timeTaken } = req.body;
    let battle;
    if (isDbConnected()) battle = await Battle.findOne({ roomId: req.params.roomId });
    else battle = memoryDb.battles.find(b => b.roomId === req.params.roomId);

    if (!battle) return res.status(404).json({ error: 'Battle not found' });
    const player = battle.players.find(p => p.uid === userId);
    
    // Convert Map to object for checking (in Mongoose Maps need .get)
    let hasAnswered = false;
    if (player.answers instanceof Map) hasAnswered = player.answers.has(questionIndex.toString());
    else hasAnswered = player.answers && player.answers[questionIndex] !== undefined;

    if (player && !hasAnswered) {
        if(isCorrect) player.score += 10;
        
        // Track total time taken for tie-breaking
        if (timeTaken) {
            player.totalTimeTaken = (player.totalTimeTaken || 0) + timeTaken;
        }

        // Save the answer
        if (isDbConnected()) {
            player.answers.set(questionIndex.toString(), selectedOption);
            await battle.save();
        } else {
            player.answers[questionIndex] = selectedOption;
        }
    }
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: 'Failed' }); }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
