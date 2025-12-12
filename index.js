
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
const MONGODB_URI = process.env.MONGODB_URI;

// Robust Connection Logic
if (MONGODB_URI) {
  mongoose.connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 5000,
  })
  .then(() => console.log('✅ Connected to MongoDB Atlas'))
  .catch(err => {
    console.error('❌ MongoDB Connection Error:', err.message);
    console.log('⚠️ Running in In-Memory Fallback mode due to connection failure.');
  });
} else {
  console.log('⚠️ No MONGODB_URI environment variable found.');
  console.log('⚠️ Running in In-Memory Fallback mode.');
}

// Helper to check DB status
const isDbConnected = () => mongoose.connection.readyState === 1;

// --- In-Memory Fallback Storage ---
const memoryDb = {
  users: [],
  payments: [],
  notifications: [
    { _id: '1', title: 'System', message: 'Running in fallback mode', type: 'WARNING', date: Date.now(), target: 'ALL' }
  ],
  asyncBattles: [],
  questions: [],
  savedQuestions: [],
  mistakes: [],
  examResults: []
};

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
  stats: { type: Object, default: {} },
  dailyQuests: Array,
  weeklyQuests: Array
});
const User = mongoose.model('User', userSchema);

const notificationSchema = new mongoose.Schema({
  title: String,
  message: String,
  type: { type: String, enum: ['INFO', 'WARNING', 'SUCCESS', 'BATTLE_CHALLENGE', 'BATTLE_RESULT'] },
  date: { type: Number, default: Date.now },
  target: { type: String, default: 'ALL' }, // 'ALL' or userId
  actionLink: String,
  metadata: mongoose.Schema.Types.Mixed,
  read: { type: Boolean, default: false }
});
const Notification = mongoose.model('Notification', notificationSchema);

const asyncBattleSchema = new mongoose.Schema({
    challengerId: String,
    challengerName: String,
    opponentId: String,
    opponentName: String,
    subject: String,
    chapter: String,
    status: { type: String, enum: ['PENDING', 'COMPLETED', 'REJECTED'], default: 'PENDING' },
    questions: Array,
    challengerScore: Number,
    opponentScore: Number,
    challengerAnswers: Array, // Added for analysis
    opponentAnswers: Array,   // Added for analysis
    winnerId: String,
    createdAt: { type: Number, default: Date.now }
});
const AsyncBattle = mongoose.model('AsyncBattle', asyncBattleSchema);

const paymentSchema = new mongoose.Schema({
  userId: String,
  userName: String,
  courseTitle: String,
  amount: Number,
  trxId: String,
  senderNumber: String,
  status: { type: String, default: 'PENDING' },
  timestamp: { type: Number, default: Date.now }
});
const Payment = mongoose.model('Payment', paymentSchema);

const questionBankSchema = new mongoose.Schema({
  subject: String,
  chapter: String,
  topic: String,
  question: String,
  options: [String],
  correctAnswerIndex: Number,
  explanation: String,
  difficulty: String,
  createdAt: { type: Number, default: Date.now }
});
const QuestionBank = mongoose.model('QuestionBank', questionBankSchema);

const examResultSchema = new mongoose.Schema({
  userId: String,
  subject: String,
  score: Number,
  totalQuestions: Number,
  correct: Number,
  wrong: Number,
  skipped: Number,
  topicStats: Array,
  mistakes: Array,
  timestamp: { type: Number, default: Date.now }
});
const ExamResult = mongoose.model('ExamResult', examResultSchema);

// --- ROUTES ---

app.get('/', (req, res) => {
  res.send('Dhrubok API Running');
});

// --- NOTIFICATIONS ---
app.get('/api/users/:userId/notifications', async (req, res) => {
    try {
        const { userId } = req.params;
        if (isDbConnected()) {
            const notifs = await Notification.find({ 
                $or: [{ target: 'ALL' }, { target: userId }] 
            }).sort({ date: -1 }).limit(20);
            
            const formatted = notifs.map(n => ({
                id: n._id.toString(),
                title: n.title,
                message: n.message,
                type: n.type,
                date: n.date,
                actionLink: n.actionLink,
                metadata: n.metadata,
                read: false // Client handles read state via localStorage overlay
            }));
            res.json(formatted);
        } else {
            const userNotifs = memoryDb.notifications.filter(n => n.target === 'ALL' || n.target === userId);
            res.json(userNotifs.map(n => ({...n, id: n._id})));
        }
    } catch(e) { res.status(500).json({error: e.message}); }
});

// --- ASYNC BATTLE ---

// Create Battle Challenge
app.post('/api/battles/async/create', async (req, res) => {
    try {
        const { 
            challengerId, challengerName, opponentId, opponentName, 
            subject, chapter, questions, challengerScore, challengerAnswers 
        } = req.body;
        
        const battleData = {
            challengerId, challengerName, opponentId, opponentName, 
            subject, chapter, questions, challengerScore, challengerAnswers,
            status: 'PENDING', createdAt: Date.now()
        };

        let savedBattle;
        if(isDbConnected()) {
            savedBattle = await new AsyncBattle(battleData).save();
            
            // Notify Opponent
            await new Notification({
                title: `⚔️ Battle Challenge!`,
                message: `${challengerName} আপনাকে ${subject}-এ চ্যালেঞ্জ করেছে! স্কোর বিট করতে পারবেন?`,
                type: 'BATTLE_CHALLENGE',
                target: opponentId,
                date: Date.now(),
                actionLink: `/quiz`, 
                metadata: { 
                    battleId: savedBattle._id.toString(), 
                    challengerName, 
                    questions 
                }
            }).save();
        } else {
            savedBattle = { ...battleData, _id: Date.now().toString() };
            memoryDb.asyncBattles.push(savedBattle);
            
            // Mock notification
            memoryDb.notifications.unshift({
                _id: Date.now().toString(),
                title: `⚔️ Battle Challenge!`,
                message: `${challengerName} আপনাকে ${subject}-এ চ্যালেঞ্জ করেছে!`,
                type: 'BATTLE_CHALLENGE',
                target: opponentId,
                date: Date.now(),
                metadata: { battleId: savedBattle._id, challengerName, questions }
            });
        }
        res.json({ success: true, battleId: isDbConnected() ? savedBattle._id : savedBattle._id });
    } catch(e) { res.status(500).json({error: e.message}); }
});

// Complete Battle (Opponent Played)
app.post('/api/battles/async/:id/complete', async (req, res) => {
    try {
        const { opponentId, opponentScore, opponentAnswers } = req.body;
        const battleId = req.params.id;
        
        let battle;
        if (isDbConnected()) {
            battle = await AsyncBattle.findById(battleId);
        } else {
            battle = memoryDb.asyncBattles.find(b => b._id === battleId);
        }

        if(!battle) return res.status(404).json({error: "Battle not found"});

        battle.opponentScore = opponentScore;
        battle.opponentAnswers = opponentAnswers;
        battle.status = 'COMPLETED';
        
        // Determine Winner
        let resultMsg = "";
        let winnerId = null;
        if (battle.challengerScore > opponentScore) {
            resultMsg = `দুঃখিত! ${battle.challengerName} জিতেছে (${battle.challengerScore} vs ${opponentScore})`;
            winnerId = battle.challengerId;
        } else if (opponentScore > battle.challengerScore) {
            resultMsg = `অভিনন্দন! আপনি জিতেছেন! (${opponentScore} vs ${battle.challengerScore})`;
            winnerId = battle.opponentId;
        } else {
            resultMsg = `ড্র হয়েছে! (${opponentScore} পয়েন্ট)`;
        }
        battle.winnerId = winnerId;

        if (isDbConnected()) {
            await battle.save();
            
            // Notify Challenger about result
            const challengerMsg = winnerId === battle.challengerId 
                ? `অভিনন্দন! আপনি ${battle.opponentName}-কে হারিয়েছেন!` 
                : `${battle.opponentName} আপনার চ্যালেঞ্জ জিতে নিয়েছে!`;

            await new Notification({
                title: `🏆 Battle Result: vs ${battle.opponentName}`,
                message: challengerMsg,
                type: 'BATTLE_RESULT',
                target: battle.challengerId,
                date: Date.now(),
                metadata: { battleId: battle._id.toString(), result: 'WIN/LOSS' }
            }).save();

        } else {
            // Mock notify
             memoryDb.notifications.unshift({
                _id: Date.now().toString(),
                title: `🏆 Battle Result`,
                message: `Result vs ${battle.opponentName} is ready.`,
                type: 'BATTLE_RESULT',
                target: battle.challengerId,
                date: Date.now()
            });
        }
        
        res.json({ success: true, result: resultMsg });
    } catch(e) { res.status(500).json({error: e.message}); }
});

// --- ADMIN & PAYMENTS ---
app.post('/api/payments', async (req, res) => {
    try {
        const paymentData = req.body;
        if(isDbConnected()) {
            await new Payment(paymentData).save();
        } else {
            memoryDb.payments.push({ ...paymentData, _id: Date.now().toString() });
        }
        res.json({ success: true });
    } catch(e) { res.status(500).json({error: e.message}); }
});

app.get('/api/admin/payments', async (req, res) => {
    try {
        if(isDbConnected()) {
            const payments = await Payment.find().sort({ timestamp: -1 });
            res.json(payments.map(p => ({ ...p.toObject(), id: p._id })));
        } else {
            res.json(memoryDb.payments.map(p => ({ ...p, id: p._id })));
        }
    } catch(e) { res.status(500).json({error: e.message}); }
});

app.post('/api/admin/notifications', async (req, res) => {
    try {
        const { title, message, type, target } = req.body;
        if(isDbConnected()) {
            await new Notification({ title, message, type, target: target || 'ALL' }).save();
        } else {
            memoryDb.notifications.unshift({ _id: Date.now().toString(), title, message, type, target: 'ALL', date: Date.now() });
        }
        res.json({ success: true });
    } catch(e) { res.status(500).json({error: e.message}); }
});

// --- USER SYNC & STATS ---
app.post('/api/users/sync', async (req, res) => {
    try {
        const userData = req.body;
        if(isDbConnected()) {
            await User.findOneAndUpdate({ uid: userData.uid }, userData, { upsert: true, new: true });
        } else {
            const idx = memoryDb.users.findIndex(u => u.uid === userData.uid);
            if(idx >= 0) memoryDb.users[idx] = { ...memoryDb.users[idx], ...userData };
            else memoryDb.users.push(userData);
        }
        res.json({ success: true });
    } catch(e) { res.status(500).json({error: e.message}); }
});

app.get('/api/users/:userId/stats', async (req, res) => {
    try {
        const { userId } = req.params;
        let user;
        if(isDbConnected()) {
            user = await User.findOne({ uid: userId });
        } else {
            user = memoryDb.users.find(u => u.uid === userId);
        }
        
        if (user) res.json(user);
        else res.json({ points: 0, totalExams: 0 });
    } catch(e) { res.status(500).json({error: e.message}); }
});

// --- EXAM RESULTS & Q-BANK ---
app.post('/api/users/:userId/exam-results', async (req, res) => {
    try {
        const { userId } = req.params;
        const resultData = req.body;
        
        if(isDbConnected()) {
            await new ExamResult({ userId, ...resultData }).save();
            // Update User Stats logic would go here (points increment etc)
            await User.updateOne({ uid: userId }, { 
                $inc: { 
                    points: resultData.score, 
                    totalExams: 1,
                    'stats.totalCorrect': resultData.correct,
                    'stats.totalWrong': resultData.wrong
                } 
            });
        }
        res.json({ success: true });
    } catch(e) { res.status(500).json({error: e.message}); }
});

app.post('/api/admin/questions/bulk', async (req, res) => {
    try {
        const { questions } = req.body;
        if(isDbConnected()) {
            await QuestionBank.insertMany(questions);
        } else {
            memoryDb.questions.push(...questions);
        }
        res.json({ success: true });
    } catch(e) { res.status(500).json({error: e.message}); }
});

// --- LEADERBOARD ---
app.get('/api/leaderboard', async (req, res) => {
    try {
        let users;
        if (isDbConnected()) {
            users = await User.find().sort({ points: -1 }).limit(50);
        } else {
            users = memoryDb.users.sort((a,b) => b.points - a.points).slice(0, 50);
        }
        res.json(users);
    } catch(e) { res.status(500).json({error: e.message}); }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
