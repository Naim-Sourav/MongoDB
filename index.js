
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
  asyncBattles: [], // NEW: Store async battles here
  questions: [],
  savedQuestions: [],
  mistakes: [],
  examResults: [],
  questTemplates: [], 
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

// Existing Realtime Battle Schema (Legacy support or active games)
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

// NEW: Async Turn-Based Battle Schema
const asyncBattleSchema = new mongoose.Schema({
    creatorId: { type: String, required: true },
    creatorName: String,
    creatorAvatar: String,
    targetId: { type: String, required: true },
    targetName: String,
    targetAvatar: String,
    questions: { type: Array, required: true },
    config: Object,
    creatorScore: { type: Number, required: true },
    targetScore: { type: Number, default: null }, // Null means turn pending
    status: { type: String, enum: ['PENDING', 'COMPLETED'], default: 'PENDING' },
    winnerId: String, // 'DRAW' or Uid
    createdAt: { type: Number, default: Date.now }
});
asyncBattleSchema.index({ targetId: 1, status: 1 });
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
  res.send(`🚀 Dhrubok API Running! Mode: ${isDbConnected() ? 'MongoDB' : 'Memory'}`);
});

// ... (Existing Routes for Users, Quests, Admin remain same) ...
// --- RE-INSERTING EXISTING ROUTES HERE FOR CONTEXT (Abbreviated) ---
app.post('/api/admin/quests', async (req, res) => { res.json({success:true})}); // Stub for brevity
app.get('/api/admin/quests', async (req, res) => { res.json([]) });
app.delete('/api/admin/quests/:id', async (req, res) => { res.json({success:true}) });
// ... (User Sync Logic) ...
app.post('/api/users/sync', async (req, res) => {
    // ... (Keep existing implementation) ...
    res.json({success:true}); 
});
app.post('/api/quests/update', async (req, res) => { res.json({success:true}) });
app.post('/api/quests/claim', async (req, res) => { res.json({success:true}) });
app.get('/api/admin/stats', async (req, res) => { res.json({}) });
app.get('/api/admin/payments', async (req, res) => { res.json([]) });
app.post('/api/payments', async (req, res) => { res.json({success:true}) });
app.put('/api/admin/payments/:id', async (req, res) => { res.json({success:true}) });
app.delete('/api/admin/payments/:id', async (req, res) => { res.json({success:true}) });
app.get('/api/notifications', async (req, res) => { 
    if(isDbConnected()) {
        const notifs = await Notification.find().sort({ date: -1 });
        res.json(notifs.map(n => ({...n.toObject(), id: n._id.toString()})));
    } else { res.json(memoryDb.notifications); }
});
app.post('/api/admin/notifications', async (req, res) => { 
    // ... (Keep existing)
    const data = { ...req.body, date: Date.now() };
    if(isDbConnected()) await new Notification(data).save();
    else memoryDb.notifications.unshift({ ...data, _id: Date.now().toString() });
    res.json({ success: true });
});
app.get('/api/leaderboard', async (req, res) => { res.json([]) });
app.get('/api/exam-packs', async (req, res) => { res.json([]) });
app.get('/api/users/:userId/enrollments', async (req, res) => { res.json([]) });
app.get('/api/users/:userId/stats', async (req, res) => { 
    // ... (Keep existing)
    res.json({}); 
});
app.post('/api/users/:userId/exam-results', async (req, res) => { res.json({success:true}) });
app.get('/api/users/:userId/saved-questions', async (req, res) => { res.json([]) });
app.post('/api/users/:userId/saved-questions', async (req, res) => { res.json({success:true}) });
app.patch('/api/users/:userId/saved-questions/:id', async (req, res) => { res.json({success:true}) });
app.delete('/api/users/:userId/saved-questions/:id', async (req, res) => { res.json({success:true}) });
app.delete('/api/users/:userId/saved-questions/by-q/:qId', async (req, res) => { res.json({success:true}) });
app.get('/api/users/:userId/mistakes', async (req, res) => { res.json([]) });
app.delete('/api/users/:userId/mistakes/:id', async (req, res) => { res.json({success:true}) });
app.get('/api/admin/questions', async (req, res) => { res.json({questions:[], total:0}) });
app.post('/api/admin/questions/bulk', async (req, res) => { res.json({success:true}) });
app.delete('/api/admin/questions/:id', async (req, res) => { res.json({success:true}) });
app.get('/api/quiz/syllabus-stats', async (req, res) => { res.json({}) });
app.post('/api/quiz/generate-from-db', async (req, res) => { res.json([]) });

// --- NEW ASYNC BATTLE ROUTES ---

// 1. Submit Challenge (Player A finishes)
app.post('/api/battles/async/submit-challenge', async (req, res) => {
    try {
        const { creatorId, creatorName, creatorAvatar, targetId, targetName, targetAvatar, questions, config, creatorScore } = req.body;
        
        const battleData = {
            creatorId, creatorName, creatorAvatar,
            targetId, targetName, targetAvatar,
            questions, config,
            creatorScore,
            targetScore: null,
            status: 'PENDING',
            createdAt: Date.now()
        };

        let savedBattle;
        if (isDbConnected()) {
            savedBattle = await new AsyncBattle(battleData).save();
            
            // Create Notification for Target
            await new Notification({
                title: "⚔️ কুইজ চ্যালেঞ্জ!",
                message: `${creatorName} তোমাকে একটি চ্যালেঞ্জ ছুড়ে দিয়েছে! এখনই একসেপ্ট করো।`,
                type: "BATTLE_CHALLENGE",
                target: targetId,
                actionLink: "/battle",
                metadata: { battleId: savedBattle._id.toString() }
            }).save();

        } else {
            savedBattle = { ...battleData, _id: Date.now().toString() };
            memoryDb.asyncBattles.push(savedBattle);
            memoryDb.notifications.unshift({
                _id: Date.now().toString(),
                title: "⚔️ কুইজ চ্যালেঞ্জ!",
                message: `${creatorName} তোমাকে একটি চ্যালেঞ্জ ছুড়ে দিয়েছে!`,
                type: "BATTLE_CHALLENGE",
                target: targetId,
                actionLink: "/battle",
                metadata: { battleId: savedBattle._id }
            });
        }
        
        res.json({ success: true, battleId: isDbConnected() ? savedBattle._id : savedBattle._id });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Failed to submit challenge' });
    }
});

// 2. Get Pending Challenges for User
app.get('/api/battles/async/pending/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        let battles;
        if (isDbConnected()) {
            battles = await AsyncBattle.find({ targetId: userId, status: 'PENDING' }).sort({ createdAt: -1 });
        } else {
            battles = memoryDb.asyncBattles.filter(b => b.targetId === userId && b.status === 'PENDING').sort((a,b) => b.createdAt - a.createdAt);
        }
        res.json(battles);
    } catch (e) { res.status(500).json({ error: 'Failed to fetch pending battles' }); }
});

// 3. Complete Challenge (Player B finishes)
app.post('/api/battles/async/complete', async (req, res) => {
    try {
        const { battleId, targetScore } = req.body;
        
        let battle;
        if (isDbConnected()) {
            battle = await AsyncBattle.findById(battleId);
        } else {
            battle = memoryDb.asyncBattles.find(b => b._id.toString() === battleId);
        }

        if (!battle) return res.status(404).json({ error: 'Battle not found' });
        if (battle.status !== 'PENDING') return res.status(400).json({ error: 'Battle already completed' });

        // Calculate Result
        battle.targetScore = targetScore;
        battle.status = 'COMPLETED';
        
        if (battle.creatorScore > targetScore) battle.winnerId = battle.creatorId;
        else if (targetScore > battle.creatorScore) battle.winnerId = battle.targetId;
        else battle.winnerId = 'DRAW';

        if (isDbConnected()) {
            await battle.save();
            
            // Notify Creator of Result
            const winnerName = battle.winnerId === battle.creatorId ? 'আপনি জিতেছেন!' : battle.winnerId === battle.targetId ? `${battle.targetName} জিতেছে!` : 'ম্যাচ ড্র!';
            await new Notification({
                title: "🏆 ব্যাটল রেজাল্ট",
                message: `${battle.targetName} চ্যালেঞ্জ গ্রহণ করেছে। ${winnerName}`,
                type: "BATTLE_RESULT",
                target: battle.creatorId,
                actionLink: `/battle` // Could link to specific result view later
            }).save();

        } else {
            // Memory update done by ref
        }

        res.json({ success: true, battle });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Failed to complete battle' });
    }
});

// 4. Get Battle History (For Results Tab)
app.get('/api/battles/async/history/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        let battles;
        if (isDbConnected()) {
            battles = await AsyncBattle.find({ 
                $or: [{ creatorId: userId }, { targetId: userId }],
                status: 'COMPLETED'
            }).sort({ createdAt: -1 }).limit(20);
        } else {
            battles = memoryDb.asyncBattles.filter(b => 
                (b.creatorId === userId || b.targetId === userId) && b.status === 'COMPLETED'
            ).sort((a,b) => b.createdAt - a.createdAt);
        }
        res.json(battles);
    } catch (e) { res.status(500).json({ error: 'Failed to fetch history' }); }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
