
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
  asyncBattles: [], // For async challenges
  questions: [],
  savedQuestions: [],
  mistakes: [],
  examResults: [],
  questTemplates: [], // Admin templates
  examPacks: [] // ... (Mock data from before)
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
  target: { type: String, default: 'ALL' }, // 'ALL' or specific userId
  actionLink: String,
  metadata: mongoose.Schema.Types.Mixed
});
notificationSchema.index({ target: 1 });
const Notification = mongoose.model('Notification', notificationSchema);

const battleSchema = new mongoose.Schema({
  roomId: { type: String, required: true, unique: true },
  hostId: String,
  createdAt: { type: Number, default: Date.now },
  status: { type: String, enum: ['WAITING', 'ACTIVE', 'FINISHED'], default: 'WAITING' },
  startTime: Number,
  questions: Array,
  config: Object,
  players: Array
});
const Battle = mongoose.model('Battle', battleSchema);

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
    winnerId: String,
    createdAt: { type: Number, default: Date.now }
});
const AsyncBattle = mongoose.model('AsyncBattle', asyncBattleSchema);

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
const QuestionBank = mongoose.model('QuestionBank', questionBankSchema);

// ... (Other schemas like SavedQuestion, Mistake, ExamResult remain same) ...
const savedQuestionSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  questionId: { type: mongoose.Schema.Types.ObjectId, ref: 'QuestionBank' },
  folder: { type: String, default: 'General' },
  savedAt: { type: Number, default: Date.now }
});
const SavedQuestion = mongoose.model('SavedQuestion', savedQuestionSchema);

const mistakeSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  question: { type: String, required: true },
  // ... fields from frontend model
  wrongCount: { type: Number, default: 1 },
  lastMissed: { type: Number, default: Date.now }
});
const Mistake = mongoose.model('Mistake', mistakeSchema);

const examResultSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  subject: { type: String, required: true },
  totalQuestions: Number,
  correct: Number,
  wrong: Number,
  skipped: Number,
  score: Number,
  topicStats: Array,
  timestamp: { type: Number, default: Date.now }
});
const ExamResult = mongoose.model('ExamResult', examResultSchema);

// --- ROUTES ---

app.get('/', (req, res) => {
  res.send('API Running');
});

// --- NOTIFICATIONS WITH USER TARGETING ---
app.get('/api/users/:userId/notifications', async (req, res) => {
    try {
        const { userId } = req.params;
        if (isDbConnected()) {
            // Fetch global + user specific
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
                metadata: n.metadata
            }));
            res.json(formatted);
        } else {
            const userNotifs = memoryDb.notifications.filter(n => n.target === 'ALL' || n.target === userId);
            res.json(userNotifs.map(n => ({...n, id: n._id})));
        }
    } catch(e) { res.status(500).json({error: e.message}); }
});

// --- ASYNC BATTLE LOGIC ---
app.post('/api/battles/async/create', async (req, res) => {
    try {
        const { challengerId, challengerName, opponentId, opponentName, subject, chapter, questions, challengerScore } = req.body;
        
        const battleData = {
            challengerId, challengerName, opponentId, opponentName, 
            subject, chapter, questions, challengerScore,
            status: 'PENDING', createdAt: Date.now()
        };

        let savedBattle;
        if(isDbConnected()) {
            savedBattle = await new AsyncBattle(battleData).save();
            // Notify Opponent
            await new Notification({
                title: `Battle Challenge!`,
                message: `${challengerName} has challenged you in ${subject} (${chapter}).`,
                type: 'BATTLE_CHALLENGE',
                target: opponentId,
                date: Date.now(),
                actionLink: `/quiz`, // Frontend will handle config loading via metadata
                metadata: { battleId: savedBattle._id.toString(), challengerName, questions }
            }).save();
        } else {
            savedBattle = { ...battleData, _id: Date.now().toString() };
            memoryDb.asyncBattles.push(savedBattle);
            // Mock notify
            memoryDb.notifications.unshift({
                _id: Date.now().toString(),
                title: `Battle Challenge!`,
                message: `${challengerName} has challenged you in ${subject}.`,
                type: 'BATTLE_CHALLENGE',
                target: opponentId,
                date: Date.now(),
                metadata: { battleId: savedBattle._id, challengerName, questions }
            });
        }
        res.json({ success: true, battleId: isDbConnected() ? savedBattle._id : savedBattle._id });
    } catch(e) { res.status(500).json({error: e.message}); }
});

app.post('/api/battles/async/:id/complete', async (req, res) => {
    try {
        const { opponentId, opponentScore } = req.body;
        const battleId = req.params.id;
        
        let battle;
        if (isDbConnected()) {
            battle = await AsyncBattle.findById(battleId);
        } else {
            battle = memoryDb.asyncBattles.find(b => b._id === battleId);
        }

        if(!battle) return res.status(404).json({error: "Battle not found"});

        battle.opponentScore = opponentScore;
        battle.status = 'COMPLETED';
        
        // Determine Winner
        let resultMsg = "";
        let winnerId = null;
        if (battle.challengerScore > opponentScore) {
            resultMsg = `${battle.challengerName} won! (${battle.challengerScore} vs ${opponentScore})`;
            winnerId = battle.challengerId;
        } else if (opponentScore > battle.challengerScore) {
            resultMsg = `${battle.opponentName} won! (${opponentScore} vs ${battle.challengerScore})`;
            winnerId = battle.opponentId;
        } else {
            resultMsg = `It's a draw! (${opponentScore} pts)`;
        }
        battle.winnerId = winnerId;

        if (isDbConnected()) {
            await battle.save();
            // Notify Challenger
            await new Notification({
                title: `Battle Result vs ${battle.opponentName}`,
                message: resultMsg,
                type: 'BATTLE_RESULT',
                target: battle.challengerId,
                date: Date.now()
            }).save();
        } else {
            // Mock notify
             memoryDb.notifications.unshift({
                _id: Date.now().toString(),
                title: `Battle Result vs ${battle.opponentName}`,
                message: resultMsg,
                type: 'BATTLE_RESULT',
                target: battle.challengerId,
                date: Date.now()
            });
        }
        
        res.json({ success: true, result: resultMsg });
    } catch(e) { res.status(500).json({error: e.message}); }
});

// ... (Rest of existing endpoints: /api/admin/*, /api/users/sync, etc. kept as is) ...
// Ensure fallback logic is robust for all existing endpoints

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
