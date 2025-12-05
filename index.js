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
  examPacks: []
};

// Connect to MongoDB
mongoose.connect(MONGODB_URI, {
  serverSelectionTimeoutMS: 5000, 
  socketTimeoutMS: 45000,
})
  .then(() => console.log('✅ Connected to MongoDB Atlas'))
  .catch(err => console.error('⚠️ MongoDB Connection Failed. Switching to In-Memory Fallback mode.'));

const isDbConnected = () => mongoose.connection.readyState === 1;

// --- Schemas ---

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

// Updated Battle Schema
const battleSchema = new mongoose.Schema({
  roomId: { type: String, required: true, unique: true },
  hostId: String,
  createdAt: { type: Number, default: Date.now },
  status: { type: String, enum: ['WAITING', 'ACTIVE', 'FINISHED'], default: 'WAITING' },
  startTime: Number,
  questions: Array,
  currentQuestionIndex: { type: Number, default: 0 },
  // Track all answers for detailed comparison
  answers: [{
    userId: String,
    questionIndex: Number,
    selectedOption: Number,
    isCorrect: Boolean,
    timeTaken: Number, // seconds
    timestamp: Number
  }],
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
    college: String, // Added College
    score: { type: Number, default: 0 },
    totalTime: { type: Number, default: 0 }, // For tie breaking
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
  mistakes: Array,
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

// Static Question Pool
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

// Admin Stats
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

// Sync User
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
      if (!user) { user = { ...updateData, points: 0, stats: { totalCorrect: 0, totalWrong: 0, subjectStats: {}, topicStats: {} } }; memoryDb.users.push(user); } 
      else { Object.assign(user, updateData); }
      return res.json(user);
    }
  } catch (e) { res.status(500).json({error: 'Sync failed'}); }
});

// Exam Results & Mistakes
app.post('/api/users/:userId/exam-results', async (req, res) => {
    try {
        const { userId } = req.params;
        const { mistakes, ...resultData } = req.body; 
        const examResultData = { userId, ...resultData, mistakes: mistakes || [], timestamp: Date.now() };
        
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
                if (!user.stats) user.stats = { totalCorrect:0, totalWrong:0, subjectStats: {}, topicStats: {} };
                user.points = (user.points || 0) + (resultData.correct * 10) + 20; 
                user.totalExams = (user.totalExams || 0) + 1;
                user.stats.totalCorrect += resultData.correct;
                user.stats.totalWrong += resultData.wrong;
                await user.save();
            }
        } else {
            memoryDb.examResults.push(examResultData);
            if (mistakes && mistakes.length > 0) {
                mistakes.forEach(m => {
                    const existing = memoryDb.mistakes.find(mk => mk.userId === userId && mk.question === m.question);
                    if (existing) { existing.wrongCount++; existing.lastMissed = Date.now(); } 
                    else { memoryDb.mistakes.push({ ...m, userId, wrongCount: 1, lastMissed: Date.now(), _id: Date.now().toString() }); }
                });
            }
        }
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: 'Failed' }); }
});

// Mistake Routes
app.get('/api/users/:userId/mistakes', async (req, res) => {
    try {
        const { userId } = req.params;
        if (isDbConnected()) {
            const mistakes = await Mistake.find({ userId }).sort({ lastMissed: -1 }).limit(100);
            res.json(mistakes);
        } else {
            res.json(memoryDb.mistakes.filter(m => m.userId === userId));
        }
    } catch (e) { res.status(500).json({ error: 'Failed to fetch mistakes' }); }
});

app.delete('/api/users/:userId/mistakes/:id', async (req, res) => {
    try {
        const { id } = req.params;
        if (isDbConnected()) await Mistake.findByIdAndDelete(id);
        else memoryDb.mistakes = memoryDb.mistakes.filter(m => m._id !== id);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: 'Failed to delete' }); }
});

// --- BATTLE ROUTES UPDATED ---

app.post('/api/battles/create', async (req, res) => {
  try {
    const { userId, userName, avatar, college, config } = req.body;
    const roomId = Math.floor(100000 + Math.random() * 900000).toString(); 
    
    let questions = [];
    if (isDbConnected()) {
        const pipeline = [{ $match: { subject: config.subject } }, { $sample: { size: config.questionCount } }];
        questions = await QuestionBank.aggregate(pipeline);
    }
    if (questions.length < config.questionCount) questions = BATTLE_QUESTIONS_FALLBACK.slice(0, config.questionCount);

    const battleData = {
      roomId, hostId: userId, config, questions,
      players: [{ uid: userId, name: userName, avatar, college: college || '', score: 0, totalTime: 0, team: config.mode === '2v2' ? 'A' : 'NONE' }],
      status: 'WAITING', currentQuestionIndex: 0, answers: []
    };

    if (isDbConnected()) {
      const battle = new Battle(battleData);
      await battle.save();
    } else {
      memoryDb.battles.push(battleData);
    }
    res.json({ roomId });
  } catch (e) { res.status(500).json({ error: 'Failed to create battle' }); }
});

app.post('/api/battles/join', async (req, res) => {
  try {
    const { roomId, userId, userName, avatar, college } = req.body;
    let battle;
    if (isDbConnected()) battle = await Battle.findOne({ roomId });
    else battle = memoryDb.battles.find(b => b.roomId === roomId);

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
        const newPlayer = { uid: userId, name: userName, avatar, college: college || '', score: 0, totalTime: 0, team };
        
        if (isDbConnected()) {
            battle.players.push(newPlayer);
            await battle.save();
        } else {
            battle.players.push(newPlayer);
        }
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

        const update = { status: 'ACTIVE', startTime: Date.now(), currentQuestionIndex: 0 };
        if (isDbConnected()) {
            Object.assign(battle, update);
            await battle.save();
        } else {
            Object.assign(battle, update);
        }
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: 'Failed to start game' }); }
});

app.get('/api/battles/:roomId', async (req, res) => {
  try {
    const { roomId } = req.params;
    let battle;
    if (isDbConnected()) battle = await Battle.findOne({ roomId });
    else battle = memoryDb.battles.find(b => b.roomId === roomId);
    
    if (!battle) return res.status(404).json({ error: 'Battle not found' });
    
    // Check if auto-advance needed
    if (battle.status === 'ACTIVE') {
       const currentIndex = battle.currentQuestionIndex;
       const answersForCurrent = battle.answers.filter(a => a.questionIndex === currentIndex);
       
       // If all players answered this question
       if (answersForCurrent.length >= battle.players.length) {
           // Advance logic handled by client polling detection OR simplified here:
           // We will rely on clients detecting "all answered" via this GET state
       }
    }

    res.json(battle);
  } catch (e) { res.status(500).json({ error: 'Failed to fetch battle state' }); }
});

// Update current question (Host calls this after delay)
app.post('/api/battles/:roomId/next-question', async (req, res) => {
    try {
        const { roomId } = req.params;
        const { nextIndex } = req.body;
        
        let battle;
        if (isDbConnected()) battle = await Battle.findOne({ roomId });
        else battle = memoryDb.battles.find(b => b.roomId === roomId);

        if(battle) {
            if (nextIndex >= battle.questions.length) {
                battle.status = 'FINISHED';
            } else {
                battle.currentQuestionIndex = nextIndex;
                battle.startTime = Date.now(); // Reset timer for next Q
            }
            if (isDbConnected()) await battle.save();
        }
        res.json({ success: true });
    } catch(e) { res.status(500).json({error: 'Next Q failed'}); }
});

app.post('/api/battles/:roomId/answer', async (req, res) => {
  try {
    const { roomId } = req.params;
    const { userId, questionIndex, selectedOption, timeTaken } = req.body; // timeTaken in seconds
    
    let battle;
    if (isDbConnected()) battle = await Battle.findOne({ roomId });
    else battle = memoryDb.battles.find(b => b.roomId === roomId);
    
    if (!battle) return res.status(404).json({ error: 'Battle not found' });
    
    // Validate if already answered
    const existing = battle.answers.find(a => a.userId === userId && a.questionIndex === questionIndex);
    if (existing) return res.status(400).json({ error: 'Already answered' });

    const question = battle.questions[questionIndex];
    const isCorrect = Number(selectedOption) === Number(question.correctAnswerIndex);
    const scoreInc = isCorrect ? 10 : 0;

    const answerRecord = {
        userId,
        questionIndex,
        selectedOption,
        isCorrect,
        timeTaken,
        timestamp: Date.now()
    };

    battle.answers.push(answerRecord);

    // Update Player Score and Time
    const player = battle.players.find(p => p.uid === userId);
    if (player) {
        player.score += scoreInc;
        player.totalTime += timeTaken;
    }

    if (isDbConnected()) await battle.save();
    
    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to submit answer' });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
