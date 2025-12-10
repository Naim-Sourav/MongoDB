
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
  mistakes: [], // Added for mistakes
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
    chapter: String, // Added Chapter
    mode: { type: String, enum: ['1v1', '2v2', 'FFA'], default: '1v1' },
    questionCount: { type: Number, default: 5 },
    timePerQuestion: { type: Number, default: 15 }
  },
  players: [{
    uid: String,
    name: String,
    avatar: String,
    score: { type: Number, default: 0 },
    team: { type: String, enum: ['A', 'B', 'NONE'], default: 'NONE' },
    answeredQuestions: { type: [Number], default: [] } // Track answered indices to prevent spam
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

// Mistake Schema - Stores full question content
const mistakeSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  question: { type: String, required: true },
  options: { type: [String], required: true },
  correctAnswerIndex: { type: Number, required: true },
  explanation: String,
  subject: String,
  chapter: String,
  topic: String,
  wrongCount: { type: Number, default: 1 }, // How many times got this wrong
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

        // --- Fast Read Logic ---
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

// --- OPTIMIZED POST EXAM (Write-Heavy) with MISTAKE LOGGING ---
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
                        update: { 
                            $set: { 
                                ...m, 
                                userId,
                                lastMissed: Date.now() 
                            },
                            $inc: { wrongCount: 1 } 
                        },
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
                user.stats.totalSkipped = (user.stats.totalSkipped || 0) + (resultData.skipped || 0);

                const subj = resultData.subject;
                const currentSubjStat = user.stats.subjectStats.get(subj) || { correct: 0, total: 0 };
                user.stats.subjectStats.set(subj, {
                    correct: currentSubjStat.correct + resultData.correct,
                    total: currentSubjStat.total + resultData.totalQuestions
                });

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
            memoryDb.examResults.push(examResultData);
            
            if (mistakes && mistakes.length > 0) {
                mistakes.forEach(m => {
                    const existing = memoryDb.mistakes.find(mk => mk.userId === userId && mk.question === m.question);
                    if (existing) {
                        existing.wrongCount++;
                        existing.lastMissed = Date.now();
                    } else {
                        memoryDb.mistakes.push({ ...m, userId, wrongCount: 1, lastMissed: Date.now(), _id: Date.now().toString() });
                    }
                });
            }

            const user = memoryDb.users.find(u => u.uid === userId);
            if(user) {
                user.points = (user.points || 0) + (resultData.correct * 10) + 20;
                user.totalExams = (user.totalExams || 0) + 1;
                
                if (!user.stats) user.stats = { totalCorrect:0, totalWrong:0, totalSkipped:0, subjectStats: {}, topicStats: {} };
                user.stats.totalCorrect += resultData.correct;
                user.stats.totalWrong += resultData.wrong;
                
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

// --- BATTLE ROUTES ---

app.post('/api/battles/create', async (req, res) => {
  try {
    const { userId, userName, avatar, config } = req.body;
    const roomId = Math.floor(100000 + Math.random() * 900000).toString(); 
    
    // Fetch Questions strictly from DB based on Subject AND Chapter
    let questions = [];
    if (isDbConnected()) {
        const pipeline = [
            { $match: { subject: config.subject, chapter: config.chapter } },
            { $sample: { size: config.questionCount } }
        ];
        questions = await QuestionBank.aggregate(pipeline);
    } else {
        // Memory fallback filtering
        questions = memoryDb.questions.filter(q => 
            q.subject === config.subject && q.chapter === config.chapter
        ).slice(0, config.questionCount);
    }
    
    // Check if questions are sufficient
    if (questions.length === 0) {
        return res.status(400).json({ error: 'Not enough questions in database for this chapter.' });
    }

    const battleData = {
      roomId,
      hostId: userId,
      config,
      questions,
      players: [{ uid: userId, name: userName, avatar, score: 0, team: config.mode === '2v2' ? 'A' : 'NONE', answeredQuestions: [] }],
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

        const newPlayer = { uid: userId, name: userName, avatar, score: 0, team, answeredQuestions: [] };
        
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

        const startTime = Date.now();
        if (isDbConnected()) {
            battle.status = 'ACTIVE';
            battle.startTime = startTime;
            await battle.save();
        } else {
            battle.status = 'ACTIVE';
            battle.startTime = startTime;
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
    const { userId, isCorrect, questionIndex } = req.body; // Added questionIndex
    const inc = isCorrect ? 10 : 0;
    
    if (isDbConnected()) {
      const battle = await Battle.findOne({ roomId });
      if (!battle) return res.status(404).json({ error: 'Battle not found' });
      
      const playerIndex = battle.players.findIndex(p => p.uid === userId);
      if (playerIndex > -1) {
          const player = battle.players[playerIndex];
          // Check if already answered
          if (player.answeredQuestions.includes(questionIndex)) {
              return res.status(400).json({ error: 'Already answered this question' });
          }

          player.score += inc;
          player.answeredQuestions.push(questionIndex);
          
          await battle.save();
      }
      res.json({ success: true });
    } else {
      const battle = memoryDb.battles.find(b => b.roomId === roomId);
      if (!battle) return res.status(404).json({ error: 'Battle not found' });
      const player = battle.players.find(p => p.uid === userId);
      if (player) {
          // Mock duplicate check
          if (!player.answeredQuestions) player.answeredQuestions = [];
          if (player.answeredQuestions.includes(questionIndex)) {
              return res.status(400).json({ error: 'Already answered' });
          }
          player.score += inc;
          player.answeredQuestions.push(questionIndex);
      }
      res.json({ success: true });
    }
  } catch (e) {
    res.status(500).json({ error: 'Failed to submit answer' });
  }
});

// Other existing routes...
// [Truncated for brevity, assuming other routes like /api/admin/* and /api/users/* exist as before]

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
