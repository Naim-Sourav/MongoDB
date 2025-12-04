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
      id: 'hsc-test-paper',
      title: 'HSC 24 টেস্ট পেপার সলভ',
      subtitle: 'শীর্ষ কলেজসমূহের টেস্ট পরীক্ষার প্রশ্ন সমাধান',
      price: 350,
      originalPrice: 1000,
      totalExams: 40,
      features: ['নটরডেম, ভিকারুননিসা, হলিক্রস কলেজের প্রশ্ন', 'সৃজনশীল ও বহুনির্বাচনী', 'বোর্ড স্ট্যান্ডার্ড মানবন্টন'],
      theme: 'purple',
      tag: 'HSC Special'
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

// Optimized User Schema with embedded stats
const userSchema = new mongoose.Schema({
  uid: { type: String, required: true, unique: true },
  email: String,
  displayName: String,
  photoURL: String,
  role: { type: String, default: 'student' },
  // Extended Profile
  college: String,
  hscBatch: String,
  department: String,
  target: String,
  
  points: { type: Number, default: 0 },
  totalExams: { type: Number, default: 0 },
  lastLogin: { type: Number, default: Date.now },
  createdAt: { type: Number, default: Date.now },

  // --- OPTIMIZATION START: Denormalized Stats ---
  // Storing aggregated stats directly in User doc to avoid expensive queries on ExamResult
  stats: {
    totalCorrect: { type: Number, default: 0 },
    totalWrong: { type: Number, default: 0 },
    totalSkipped: { type: Number, default: 0 },
    // Maps allow us to store dynamic keys (Subject Names / Topic Names)
    subjectStats: { 
      type: Map, 
      of: new mongoose.Schema({ correct: Number, total: Number }, { _id: false }), 
      default: {} 
    },
    topicStats: { 
      type: Map, 
      of: new mongoose.Schema({ correct: Number, total: Number }, { _id: false }), 
      default: {} 
    }
  }
  // --- OPTIMIZATION END ---
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
    subject: String,
    mode: { type: String, enum: ['1v1', '2v2', 'FFA'], default: '1v1' },
    questionCount: { type: Number, default: 5 },
    timePerQuestion: { type: Number, default: 15 }
  },
  players: [{
    uid: String,
    name: String,
    avatar: String,
    score: { type: Number, default: 0 },
    team: { type: String, enum: ['A', 'B', 'NONE'], default: 'NONE' }
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
  savedAt: { type: Number, default: Date.now }
});
savedQuestionSchema.index({ userId: 1 });
const SavedQuestion = mongoose.model('SavedQuestion', savedQuestionSchema);

const examResultSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  subject: { type: String, required: true },
  totalQuestions: Number,
  correct: Number,
  wrong: Number,
  skipped: Number,
  score: Number,
  // Detailed Analysis
  topicStats: [{
    topic: String,
    correct: Number,
    total: Number
  }],
  timestamp: { type: Number, default: Date.now }
});
// Index for faster lookups if we ever need to rebuild stats
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

// Static Question Pool for Fallback
const BATTLE_QUESTIONS_FALLBACK = [
  { question: "নিচের কোনটি ভেক্টর রাশি?", options: ["কাজ", "শক্তি", "বেগ", "তাপমাত্রা"], correctAnswerIndex: 2, subject: "Physics" },
  { question: "পানির রাসায়নিক সংকেত কোনটি?", options: ["HO2", "H2O", "H2O2", "OH"], correctAnswerIndex: 1, subject: "Chemistry" },
  { question: "নিউটনের গতির সূত্র কয়টি?", options: ["২টি", "৩টি", "৪টি", "৫টি"], correctAnswerIndex: 1, subject: "Physics" },
  { question: "DNA এর পূর্ণরূপ কী?", options: ["Deoxyribonucleic Acid", "Dyno Acid", "Dual Acid", "None"], correctAnswerIndex: 0, subject: "Biology" },
  { question: "কোষের পাওয়ার হাউস কোনটি?", options: ["নিউক্লিয়াস", "মাইটোকন্ড্রিয়া", "প্লাস্টিড", "রাইবোজোম"], correctAnswerIndex: 1, subject: "Biology" }
];

// --- ROUTES ---

app.get('/', (req, res) => {
  res.send(`🚀 Shikkha Shohayok API Running! Mode: ${isDbConnected() ? 'MongoDB' : 'Memory'}`);
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
        stats.totalExams = await ExamResult.countDocuments();
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
        stats.totalExams = memoryDb.examResults.length;
        stats.pendingPayments = memoryDb.payments.filter(p => p.status === 'PENDING').length;
        stats.approvedEnrollments = memoryDb.payments.filter(p => p.status === 'APPROVED').length;
        stats.totalRevenue = memoryDb.payments.filter(p => p.status === 'APPROVED').reduce((sum, p) => sum + (p.amount || 0), 0);
    }
    res.json(stats);
  } catch (e) {
      res.status(500).json({ error: 'Stats failed' });
  }
});

// --- USER MANAGEMENT ---

app.post('/api/users/sync', async (req, res) => {
  try {
    const { uid, email, displayName, photoURL, college, hscBatch, department, target } = req.body;
    const updateData = { 
        uid, email, displayName, photoURL, lastLogin: Date.now(),
        college, hscBatch, department, target 
    };
    
    // Remove undefined keys
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

// --- OPTIMIZED GET STATS ---
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

        // Self-Healing: If user exists but has no aggregated stats (Legacy user), build them once
        // This is a one-time expensive operation per user, then it becomes fast.
        if (isDbConnected() && (!user.stats || !user.stats.totalCorrect) && user.totalExams > 0) {
            console.log(`Migrating stats for user ${userId}...`);
            const results = await ExamResult.find({ userId });
            
            // Rebuild stats logic
            let totalCorrect = 0, totalWrong = 0, totalSkipped = 0;
            const subjectStats = {};
            const topicStats = {};

            results.forEach(r => {
                totalCorrect += r.correct;
                totalWrong += r.wrong;
                totalSkipped += (r.skipped || 0);

                // Subject Agg
                if (!subjectStats[r.subject]) subjectStats[r.subject] = { correct: 0, total: 0 };
                subjectStats[r.subject].correct += r.correct;
                subjectStats[r.subject].total += r.totalQuestions;

                // Topic Agg
                if (r.topicStats && Array.isArray(r.topicStats)) {
                    r.topicStats.forEach(ts => {
                        if (!topicStats[ts.topic]) topicStats[ts.topic] = { correct: 0, total: 0 };
                        topicStats[ts.topic].correct += ts.correct;
                        topicStats[ts.topic].total += ts.total;
                    });
                }
            });

            // Save to User
            user.stats = { totalCorrect, totalWrong, totalSkipped, subjectStats, topicStats };
            await user.save();
        }

        // --- Fast Read Logic ---
        // Construct breakdown arrays from the embedded Maps/Objects
        
        let subjectBreakdown = [];
        let topicBreakdown = [];

        // Handle Map vs Object (Mongoose Map vs Memory Object)
        const subjStatsObj = user.stats?.subjectStats instanceof Map 
            ? Object.fromEntries(user.stats.subjectStats) 
            : (user.stats?.subjectStats || {});
            
        const topicStatsObj = user.stats?.topicStats instanceof Map 
            ? Object.fromEntries(user.stats.topicStats) 
            : (user.stats?.topicStats || {});

        // Convert Subject Stats to Array
        subjectBreakdown = Object.keys(subjStatsObj).map(s => ({
            subject: s,
            accuracy: (subjStatsObj[s].correct / subjStatsObj[s].total) * 100
        })).sort((a,b) => b.accuracy - a.accuracy);

        // Convert Topic Stats to Array
        topicBreakdown = Object.keys(topicStatsObj).map(t => ({
            topic: t,
            accuracy: (topicStatsObj[t].correct / topicStatsObj[t].total) * 100,
            total: topicStatsObj[t].total
        })).sort((a,b) => b.accuracy - a.accuracy);

        res.json({
            user: {
                college: user.college,
                hscBatch: user.hscBatch,
                department: user.department,
                target: user.target,
                points: user.points
            },
            points: user.points,
            totalExams: user.totalExams,
            totalCorrect: user.stats?.totalCorrect || 0,
            totalWrong: user.stats?.totalWrong || 0,
            subjectBreakdown,
            topicBreakdown,
            strongestSubject: subjectBreakdown[0],
            weakestSubject: subjectBreakdown[subjectBreakdown.length - 1],
            strongestTopics: topicBreakdown.slice(0, 5),
            weakestTopics: topicBreakdown.slice().reverse().slice(0, 5)
        });

    } catch (e) { 
        console.error(e);
        res.status(500).json({ error: 'Failed' }); 
    }
});

// --- OPTIMIZED POST EXAM (Write-Heavy) ---
app.post('/api/users/:userId/exam-results', async (req, res) => {
    try {
        const { userId } = req.params;
        const resultData = { userId, ...req.body, timestamp: Date.now() };
        
        if (isDbConnected()) {
            // 1. Save the detailed result (Archival/History)
            await new ExamResult(resultData).save();
            
            // 2. Determine User Update Operation (Aggregated Stats)
            const user = await User.findOne({ uid: userId });
            
            if (user) {
                // Initialize stats if missing
                if (!user.stats) user.stats = { totalCorrect:0, totalWrong:0, totalSkipped:0, subjectStats: {}, topicStats: {} };
                
                // Update Global Totals
                user.points = (user.points || 0) + (resultData.correct * 10) + 20; // 10 pts per correct, 20 bonus
                user.totalExams = (user.totalExams || 0) + 1;
                user.stats.totalCorrect = (user.stats.totalCorrect || 0) + resultData.correct;
                user.stats.totalWrong = (user.stats.totalWrong || 0) + resultData.wrong;
                user.stats.totalSkipped = (user.stats.totalSkipped || 0) + (resultData.skipped || 0);

                // Update Subject Stats
                const subj = resultData.subject;
                const currentSubjStat = user.stats.subjectStats.get(subj) || { correct: 0, total: 0 };
                user.stats.subjectStats.set(subj, {
                    correct: currentSubjStat.correct + resultData.correct,
                    total: currentSubjStat.total + resultData.totalQuestions
                });

                // Update Topic Stats
                if (resultData.topicStats && Array.isArray(resultData.topicStats)) {
                    resultData.topicStats.forEach(ts => {
                        const topicName = ts.topic;
                        const currentTopicStat = user.stats.topicStats.get(topicName) || { correct: 0, total: 0 };
                        user.stats.topicStats.set(topicName, {
                            correct: currentTopicStat.correct + ts.correct,
                            total: currentTopicStat.total + ts.total
                        });
                    });
                }

                await user.save();
            }
        } else {
            // Memory Mode
            memoryDb.examResults.push(resultData);
            const user = memoryDb.users.find(u => u.uid === userId);
            if(user) {
                // Simple Memory Aggregation Logic
                user.points = (user.points || 0) + (resultData.correct * 10) + 20;
                user.totalExams = (user.totalExams || 0) + 1;
                
                if (!user.stats) user.stats = { totalCorrect:0, totalWrong:0, totalSkipped:0, subjectStats: {}, topicStats: {} };
                user.stats.totalCorrect += resultData.correct;
                user.stats.totalWrong += resultData.wrong;
                
                // Simplified Memory Subject Update
                const subj = resultData.subject;
                if(!user.stats.subjectStats[subj]) user.stats.subjectStats[subj] = { correct: 0, total: 0 };
                user.stats.subjectStats[subj].correct += resultData.correct;
                user.stats.subjectStats[subj].total += resultData.totalQuestions;
            }
        }
        res.json({ success: true });
    } catch (e) { 
        console.error(e);
        res.status(500).json({ error: 'Failed' }); 
    }
});

// --- SAVED QUESTIONS ---

app.get('/api/users/:userId/saved-questions', async (req, res) => {
    try {
        const { userId } = req.params;
        if (isDbConnected()) {
            const saved = await SavedQuestion.find({ userId }).populate('questionId');
            res.json(saved);
        } else {
            res.json(memoryDb.savedQuestions.filter(sq => sq.userId === userId));
        }
    } catch(e) { res.status(500).json({ error: 'Failed' }); }
});

app.post('/api/users/:userId/saved-questions', async (req, res) => {
    try {
        const { userId } = req.params;
        const { questionId } = req.body;
        
        if (isDbConnected()) {
            const exists = await SavedQuestion.findOne({ userId, questionId });
            if (exists) {
                await SavedQuestion.deleteOne({ userId, questionId });
                res.json({ status: 'REMOVED' });
            } else {
                await new SavedQuestion({ userId, questionId }).save();
                res.json({ status: 'SAVED' });
            }
        } else {
            // Memory fallback incomplete for refs, simplified
            res.json({ status: 'SAVED_MEMORY' });
        }
    } catch(e) { res.status(500).json({ error: 'Failed' }); }
});

app.delete('/api/users/:userId/saved-questions/:id', async (req, res) => {
    try {
        const { id } = req.params;
        if (isDbConnected()) {
            await SavedQuestion.findByIdAndDelete(id);
        }
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: 'Failed' }); }
});

// --- ADMIN PAYMENTS ---

app.get('/api/admin/payments', async (req, res) => {
  try {
    if (isDbConnected()) {
      const payments = await Payment.find().sort({ timestamp: -1 });
      res.json(payments);
    } else {
      res.json(memoryDb.payments);
    }
  } catch (e) { res.status(500).json({ error: 'Failed' }); }
});

app.post('/api/payments', async (req, res) => {
  try {
    const payment = req.body;
    if (isDbConnected()) {
      const newPayment = new Payment(payment);
      await newPayment.save();
      res.json(newPayment);
    } else {
      payment._id = Date.now().toString();
      payment.status = 'PENDING';
      payment.timestamp = Date.now();
      memoryDb.payments.push(payment);
      res.json(payment);
    }
  } catch (e) { res.status(500).json({ error: 'Failed' }); }
});

app.put('/api/admin/payments/:id', async (req, res) => {
  try {
    const { status } = req.body;
    if (isDbConnected()) {
      const payment = await Payment.findByIdAndUpdate(req.params.id, { status }, { new: true });
      res.json(payment);
    } else {
      const payment = memoryDb.payments.find(p => p._id === req.params.id);
      if (payment) payment.status = status;
      res.json(payment);
    }
  } catch (e) { res.status(500).json({ error: 'Failed' }); }
});

app.delete('/api/admin/payments/:id', async (req, res) => {
  try {
    if (isDbConnected()) {
      await Payment.findByIdAndDelete(req.params.id);
    } else {
      memoryDb.payments = memoryDb.payments.filter(p => p._id !== req.params.id);
    }
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: 'Failed' }); }
});

// --- ADMIN NOTIFICATIONS ---

app.get('/api/notifications', async (req, res) => {
  try {
    if (isDbConnected()) {
      const notifs = await Notification.find().sort({ date: -1 }).limit(10);
      res.json(notifs);
    } else {
      res.json(memoryDb.notifications);
    }
  } catch (e) { res.status(500).json({ error: 'Failed' }); }
});

app.post('/api/admin/notifications', async (req, res) => {
  try {
    if (isDbConnected()) {
      const notif = new Notification(req.body);
      await notif.save();
      res.json(notif);
    } else {
      const notif = { ...req.body, _id: Date.now().toString(), date: Date.now() };
      memoryDb.notifications.unshift(notif);
      res.json(notif);
    }
  } catch (e) { res.status(500).json({ error: 'Failed' }); }
});

// --- LEADERBOARD ---

app.get('/api/leaderboard', async (req, res) => {
    try {
        if (isDbConnected()) {
            const users = await User.find().sort({ points: -1 }).limit(50);
            res.json(users);
        } else {
            res.json(memoryDb.users.sort((a,b) => (b.points||0) - (a.points||0)));
        }
    } catch (e) { res.status(500).json({ error: 'Failed' }); }
});

// --- EXAM PACKS ---
app.get('/api/exam-packs', async (req, res) => {
    try {
        if (isDbConnected()) {
            const packs = await ExamPack.find();
            // If DB is empty, insert defaults
            if (packs.length === 0) {
               await ExamPack.insertMany(memoryDb.examPacks);
               return res.json(memoryDb.examPacks);
            }
            res.json(packs);
        } else {
            res.json(memoryDb.examPacks);
        }
    } catch (e) { res.status(500).json({ error: 'Failed' }); }
});

// --- QUESTION BANK & SYLLABUS STATS ---

app.get('/api/quiz/syllabus-stats', async (req, res) => {
    try {
        let stats = {};
        
        if (isDbConnected()) {
            // Aggregation pipeline to count questions per subject/chapter/topic
            const agg = await QuestionBank.aggregate([
                {
                    $group: {
                        _id: { subject: "$subject", chapter: "$chapter", topic: "$topic" },
                        count: { $sum: 1 }
                    }
                }
            ]);

            // Transform aggregation result to nested structure
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

app.post('/api/admin/questions/bulk', async (req, res) => {
  try {
    const { questions } = req.body;
    if (isDbConnected()) {
      const ops = questions.map(q => ({
        updateOne: {
          filter: { question: q.question }, // Avoid duplicates by question text
          update: { $set: q },
          upsert: true
        }
      }));
      await QuestionBank.bulkWrite(ops);
    } else {
      memoryDb.questions.push(...questions);
    }
    res.json({ success: true });
  } catch (e) { 
      console.error(e);
      res.status(500).json({ error: e.message }); 
  }
});

app.get('/api/admin/questions', async (req, res) => {
    try {
        const { page = 1, limit = 10, subject, chapter } = req.query;
        const query = {};
        if (subject) query.subject = subject;
        if (chapter) query.chapter = chapter;

        if (isDbConnected()) {
            const questions = await QuestionBank.find(query)
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(parseInt(limit));
            const total = await QuestionBank.countDocuments(query);
            res.json({ questions, total });
        } else {
            res.json({ questions: memoryDb.questions.slice(0, 10), total: memoryDb.questions.length });
        }
    } catch (e) { res.status(500).json({ error: 'Failed' }); }
});

app.delete('/api/admin/questions/:id', async (req, res) => {
    try {
        if(isDbConnected()) {
            await QuestionBank.findByIdAndDelete(req.params.id);
        }
        res.json({ success: true });
    } catch(e) { res.status(500).json({error: 'Failed'}); }
});

app.post('/api/quiz/generate-from-db', async (req, res) => {
    try {
        const { subject, chapter, topics, count } = req.body;
        
        if (isDbConnected()) {
            const pipeline = [
                { 
                    $match: { 
                        subject, 
                        chapter,
                        topic: { $in: topics }
                    } 
                },
                { $sample: { size: count } }
            ];
            const questions = await QuestionBank.aggregate(pipeline);
            res.json(questions);
        } else {
            // Simple memory filter
            const filtered = memoryDb.questions.filter(q => 
                q.subject === subject && 
                q.chapter === chapter && 
                topics.includes(q.topic)
            );
            res.json(filtered.slice(0, count));
        }
    } catch (e) { res.status(500).json({ error: 'Failed' }); }
});

// --- BATTLE ROUTES ---

app.post('/api/battles/create', async (req, res) => {
  try {
    const { userId, userName, avatar, config } = req.body;
    const roomId = Math.floor(100000 + Math.random() * 900000).toString(); 
    
    // Fetch Questions
    let questions = [];
    if (isDbConnected()) {
        const pipeline = [
            { $match: { subject: config.subject } },
            { $sample: { size: config.questionCount } }
        ];
        questions = await QuestionBank.aggregate(pipeline);
    }
    
    // Fallback if DB empty or Memory mode
    if (questions.length < config.questionCount) {
        questions = BATTLE_QUESTIONS_FALLBACK.slice(0, config.questionCount);
    }

    const battleData = {
      roomId,
      hostId: userId,
      config,
      questions,
      players: [{ uid: userId, name: userName, avatar, score: 0, team: config.mode === '2v2' ? 'A' : 'NONE' }],
      status: 'WAITING'
    };

    if (isDbConnected()) {
      const battle = new Battle(battleData);
      await battle.save();
    } else {
      memoryDb.battles.push(battleData);
    }
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
    if (isDbConnected()) {
        battle = await Battle.findOne({ roomId });
    } else {
        battle = memoryDb.battles.find(b => b.roomId === roomId);
    }

    if (!battle) return res.status(404).json({ error: 'Room not found' });
    if (battle.status !== 'WAITING') return res.status(400).json({ error: 'Game already started' });

    const limit = battle.config.mode === '1v1' ? 2 : battle.config.mode === '2v2' ? 4 : 5;
    if (battle.players.length >= limit) return res.status(400).json({ error: 'Room is full' });

    const exists = battle.players.find(p => p.uid === userId);
    if (!exists) {
        let team = 'NONE';
        if (battle.config.mode === '2v2') {
            const teamA = battle.players.filter(p => p.team === 'A').length;
            const teamB = battle.players.filter(p => p.team === 'B').length;
            team = teamA <= teamB ? 'A' : 'B';
        }

        const newPlayer = { uid: userId, name: userName, avatar, score: 0, team };
        
        if (isDbConnected()) {
            battle.players.push(newPlayer);
            await battle.save();
        } else {
            battle.players.push(newPlayer);
        }
    }

    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to join battle' });
  }
});

app.post('/api/battles/start', async (req, res) => {
    try {
        const { roomId, userId } = req.body;
        
        let battle;
        if (isDbConnected()) {
            battle = await Battle.findOne({ roomId });
        } else {
            battle = memoryDb.battles.find(b => b.roomId === roomId);
        }

        if (!battle) return res.status(404).json({ error: 'Room not found' });
        if (battle.hostId !== userId) return res.status(403).json({ error: 'Only host can start' });

        if (isDbConnected()) {
            battle.status = 'ACTIVE';
            battle.startTime = Date.now();
            await battle.save();
        } else {
            battle.status = 'ACTIVE';
            battle.startTime = Date.now();
        }
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: 'Failed to start game' });
    }
});

app.get('/api/battles/:roomId', async (req, res) => {
  try {
    const { roomId } = req.params;
    let battle;
    if (isDbConnected()) {
      battle = await Battle.findOne({ roomId });
    } else {
      battle = memoryDb.battles.find(b => b.roomId === roomId);
    }
    
    if (!battle) return res.status(404).json({ error: 'Battle not found' });
    res.json(battle);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch battle state' });
  }
});

app.post('/api/battles/:roomId/answer', async (req, res) => {
  try {
    const { roomId } = req.params;
    const { userId, isCorrect } = req.body;
    const inc = isCorrect ? 10 : 0;
    
    if (isDbConnected()) {
      const battle = await Battle.findOne({ roomId });
      if (!battle) return res.status(404).json({ error: 'Battle not found' });
      
      const playerIndex = battle.players.findIndex(p => p.uid === userId);
      if (playerIndex > -1) {
          battle.players[playerIndex].score += inc;
          await battle.save();
      }
      res.json({ success: true });
    } else {
      const battle = memoryDb.battles.find(b => b.roomId === roomId);
      if (!battle) return res.status(404).json({ error: 'Battle not found' });
      const player = battle.players.find(p => p.uid === userId);
      if (player) player.score += inc;
      res.json({ success: true });
    }
  } catch (e) {
    res.status(500).json({ error: 'Failed to submit answer' });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
