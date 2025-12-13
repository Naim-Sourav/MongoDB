
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
  questTemplates: [], // Admin templates
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

// Admin managed templates
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

// User specific progress
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
  examRef: { type: String }, // NEW FIELD: To link questions to a specific exam paper ID
  createdAt: { type: Number, default: Date.now }
});
questionBankSchema.index({ subject: 1, chapter: 1, topic: 1 });
questionBankSchema.index({ examRef: 1 });
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

// --- QUEST ROUTES ---

const getQuestsFromPool = async (category, count) => {
    let pool = [];
    if (isDbConnected()) {
        pool = await QuestTemplate.find({ category, isActive: true });
    } else {
        pool = memoryDb.questTemplates.filter(q => q.category === category && q.isActive);
    }
    if (pool.length === 0) {
        // Defaults if DB is empty
        const DEFAULT_QUESTS = [
            { title: 'Exam Warrior', description: 'যেকোনো ১টি কুইজ সম্পন্ন করো', type: 'EXAM_COMPLETE', target: 1, reward: 25, icon: 'FileCheck', link: '/quiz', category: 'DAILY' },
            { title: 'Knowledge Seeker', description: 'AI টিউটরকে ১টি প্রশ্ন করো', type: 'ASK_AI', target: 1, reward: 15, icon: 'Bot', link: 'SYNAPSE', category: 'DAILY' },
            { title: 'Battle Ready', description: '১টি কুইজ ব্যাটল খেলো', type: 'PLAY_BATTLE', target: 1, reward: 50, icon: 'Swords', link: '/battle', category: 'DAILY' },
            { title: 'Focus Master', description: '৩০ মিনিট পড়াশোনা করো', type: 'STUDY_TIME', target: 30, reward: 40, icon: 'Clock', link: '/tracker', category: 'DAILY' },
            { title: 'Curious Mind', description: '১টি প্রশ্ন বুকমার্ক করো', type: 'SAVE_QUESTION', target: 1, reward: 10, icon: 'Bookmark', link: '/quiz', category: 'DAILY' },
            { title: 'Consistency King', description: '৭ দিন টানা লগইন করো', type: 'LOGIN', target: 7, reward: 200, icon: 'Crown', category: 'WEEKLY' },
            { title: 'Battle Champion', description: '৩টি কুইজ ব্যাটল জিতো', type: 'WIN_BATTLE', target: 3, reward: 150, icon: 'Trophy', link: '/battle', category: 'WEEKLY' },
            { title: 'Marathon Runner', description: '৫টি কুইজ সম্পন্ন করো', type: 'EXAM_COMPLETE', target: 5, reward: 100, icon: 'Zap', link: '/quiz', category: 'WEEKLY' }
        ];
        pool = DEFAULT_QUESTS.filter(q => q.category === category);
    }
    return pool.sort(() => 0.5 - Math.random()).slice(0, count).map(q => ({
        id: q._id ? q._id.toString() : Math.random().toString(),
        title: q.title,
        description: q.description,
        type: q.type,
        target: q.target,
        progress: 0,
        reward: q.reward,
        completed: false,
        claimed: false,
        icon: q.icon,
        link: q.link,
        category: q.category
    }));
};

app.post('/api/admin/quests', async (req, res) => {
    try {
        const questData = { ...req.body, isActive: true };
        if (isDbConnected()) {
            await new QuestTemplate(questData).save();
        } else {
            memoryDb.questTemplates.push({ ...questData, _id: Date.now().toString() });
        }
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/admin/quests', async (req, res) => {
    try {
        if (isDbConnected()) {
            const quests = await QuestTemplate.find();
            res.json(quests);
        } else {
            res.json(memoryDb.questTemplates);
        }
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/admin/quests/:id', async (req, res) => {
    try {
        if (isDbConnected()) {
            await QuestTemplate.findByIdAndDelete(req.params.id);
        } else {
            memoryDb.questTemplates = memoryDb.questTemplates.filter(q => q._id !== req.params.id);
        }
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// --- USERS & SYNC ---
app.post('/api/users/sync', async (req, res) => {
  try {
    const { uid, email, displayName, photoURL, college, hscBatch, department, target, phoneNumber } = req.body;
    const updateData = { uid, email, displayName, photoURL, lastLogin: Date.now(), college, hscBatch, department, target, phoneNumber };
    // Remove undefined keys
    Object.keys(updateData).forEach(key => updateData[key] === undefined && delete updateData[key]);

    if (isDbConnected()) {
      let user = await User.findOne({ uid });
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      
      // Weekly Reset Logic (Saturday Midnight)
      const day = now.getDay();
      const daysUntilSaturday = (6 - day + 7) % 7;
      const nextSaturday = new Date(now);
      nextSaturday.setDate(now.getDate() + (daysUntilSaturday === 0 ? 7 : daysUntilSaturday));
      nextSaturday.setHours(0,0,0,0);
      const nextWeeklyResetTime = nextSaturday.getTime();

      let dailyQuestsToSet = null;
      let weeklyQuestsToSet = null;

      if (!user) {
          dailyQuestsToSet = await getQuestsFromPool('DAILY', 5);
          weeklyQuestsToSet = await getQuestsFromPool('WEEKLY', 3);
          updateData.lastQuestReset = todayStart;
          updateData.lastWeeklyQuestReset = nextWeeklyResetTime;
      } else {
          // Daily Reset
          if (!user.lastQuestReset || user.lastQuestReset < todayStart) {
              dailyQuestsToSet = await getQuestsFromPool('DAILY', 5);
              updateData.lastQuestReset = todayStart;
          }
          // Weekly Reset
          if (!user.lastWeeklyQuestReset || Date.now() > user.lastWeeklyQuestReset) {
              weeklyQuestsToSet = await getQuestsFromPool('WEEKLY', 3);
              updateData.lastWeeklyQuestReset = nextWeeklyResetTime;
          }
      }

      if (dailyQuestsToSet) updateData.dailyQuests = dailyQuestsToSet;
      if (weeklyQuestsToSet) updateData.weeklyQuests = weeklyQuestsToSet;

      user = await User.findOneAndUpdate({ uid }, updateData, { upsert: true, new: true });
      return res.json(user);
    } else {
      let user = memoryDb.users.find(u => u.uid === uid);
      if (!user) { 
          user = { 
              ...updateData, 
              points: 0, 
              stats: { totalCorrect: 0, totalWrong: 0, totalSkipped: 0, subjectStats: {}, topicStats: {} }, 
              dailyQuests: await getQuestsFromPool('DAILY', 5),
              weeklyQuests: await getQuestsFromPool('WEEKLY', 3)
          }; 
          memoryDb.users.push(user); 
      } else {
          Object.assign(user, updateData);
      }
      return res.json(user);
    }
  } catch (e) { res.status(500).json({error: 'Sync failed'}); }
});

// --- QUEST UPDATES ---
app.post('/api/quests/update', async (req, res) => {
    try {
        const { userId, actionType, value } = req.body; 
        if (isDbConnected()) {
            const user = await User.findOne({ uid: userId });
            if (!user) return res.status(404).json({ error: 'User not found' });
            
            let updated = false;
            
            // Update Daily
            if (user.dailyQuests) {
                user.dailyQuests = user.dailyQuests.map(q => {
                    if (q.type === actionType && !q.completed) {
                        q.progress += value;
                        if (q.progress >= q.target) {
                            q.progress = q.target;
                            q.completed = true;
                        }
                        updated = true;
                    }
                    return q;
                });
            }

            // Update Weekly
            if (user.weeklyQuests) {
                user.weeklyQuests = user.weeklyQuests.map(q => {
                    if (q.type === actionType && !q.completed) {
                        q.progress += value;
                        if (q.progress >= q.target) {
                            q.progress = q.target;
                            q.completed = true;
                        }
                        updated = true;
                    }
                    return q;
                });
            }

            if (updated) await user.save();
            res.json({ success: true, quests: user.dailyQuests, weeklyQuests: user.weeklyQuests });
        } else { res.json({ success: true }); }
    } catch(e) { res.status(500).json({ error: 'Quest update failed' }); }
});

app.post('/api/quests/claim', async (req, res) => {
    try {
        const { userId, questId, category } = req.body; 
        if(isDbConnected()) {
            const user = await User.findOne({ uid: userId });
            let quest;
            
            if (category === 'WEEKLY') {
                quest = user.weeklyQuests.find(q => q.id === questId);
            } else {
                quest = user.dailyQuests.find(q => q.id === questId);
            }

            if (quest && quest.completed && !quest.claimed) {
                quest.claimed = true;
                user.points += quest.reward;
                await user.save();
                res.json({ success: true, points: user.points, quests: user.dailyQuests, weeklyQuests: user.weeklyQuests });
            } else {
                res.status(400).json({ error: 'Cannot claim' });
            }
        } else { res.json({ success: true, points: 100 }); }
    } catch(e) { res.status(500).json({ error: 'Claim failed' }); }
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
            const formattedPayments = payments.map(p => {
                const obj = p.toObject();
                return { ...obj, id: obj._id.toString() };
            });
            res.json(formattedPayments);
        } else { res.json(memoryDb.payments); }
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
            const formattedNotifs = notifs.map(n => {
                const obj = n.toObject();
                return { ...obj, id: obj._id.toString() };
            });
            res.json(formattedNotifs);
        } else { res.json(memoryDb.notifications); }
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
            const users = await User.find().sort({ points: -1 }).limit(50).select('uid displayName photoURL points college hscBatch target department');
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
        } else { res.json(memoryDb.examPacks); }
    } catch(e) { res.status(500).json({error: e.message}); }
});

// --- USER DATA ---
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
            user: { displayName: user.displayName, photoURL: user.photoURL, college: user.college, hscBatch: user.hscBatch, department: user.department, target: user.target, points: user.points, phoneNumber: user.phoneNumber },
            points: user.points,
            totalExams: user.totalExams,
            totalCorrect: user.stats?.totalCorrect || 0,
            totalWrong: user.stats?.totalWrong || 0,
            subjectBreakdown,
            strongestTopics: topicBreakdown.slice(0, 5),
            weakestTopics: topicBreakdown.slice().reverse().slice(0, 5),
            quests: user.dailyQuests || [],
            weeklyQuests: user.weeklyQuests || []
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
            
            // Save mistakes
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

            // Update User Stats
            const user = await User.findOne({ uid: userId });
            if (user) {
                if (!user.stats) user.stats = { totalCorrect:0, totalWrong:0, totalSkipped:0, subjectStats: {}, topicStats: {} };
                user.points = (user.points || 0) + (resultData.correct * 5) + 10; 
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
        }
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: 'Failed' }); }
});

// --- SAVED QUESTIONS ---
app.post('/api/users/:userId/saved-questions', async (req, res) => {
    try {
        const { userId } = req.params;
        const { questionId, folder = 'General' } = req.body;
        if(isDbConnected()) {
            await new SavedQuestion({ userId, questionId, folder }).save();
        } else {
            memoryDb.savedQuestions.push({ userId, questionId, folder, _id: Date.now().toString() });
        }
        res.json({ success: true });
    } catch(e) { res.status(500).json({error: e.message}); }
});

app.get('/api/users/:userId/saved-questions', async (req, res) => {
    try {
        const { userId } = req.params;
        if(isDbConnected()) {
            const saved = await SavedQuestion.find({ userId }).populate('questionId');
            res.json(saved);
        } else {
            // Mock population for memory mode
            const saved = memoryDb.savedQuestions.filter(s => s.userId === userId).map(s => {
                const q = memoryDb.questions.find(mq => mq._id === s.questionId);
                return { ...s, questionId: q };
            });
            res.json(saved);
        }
    } catch(e) { res.status(500).json({error: e.message}); }
});

app.delete('/api/users/:userId/saved-questions/:id', async (req, res) => {
    try {
        if(isDbConnected()) {
            await SavedQuestion.findByIdAndDelete(req.params.id);
        } else {
            memoryDb.savedQuestions = memoryDb.savedQuestions.filter(s => s._id !== req.params.id);
        }
        res.json({ success: true });
    } catch(e) { res.status(500).json({error: e.message}); }
});

app.delete('/api/users/:userId/saved-questions/by-q/:questionId', async (req, res) => {
    try {
        const { userId, questionId } = req.params;
        if(isDbConnected()) {
            await SavedQuestion.findOneAndDelete({ userId, questionId });
        } else {
            memoryDb.savedQuestions = memoryDb.savedQuestions.filter(s => s.questionId !== questionId || s.userId !== userId);
        }
        res.json({ success: true });
    } catch(e) { res.status(500).json({error: e.message}); }
});

app.patch('/api/users/:userId/saved-questions/:id', async (req, res) => {
    try {
        const { folder } = req.body;
        if(isDbConnected()) {
            await SavedQuestion.findByIdAndUpdate(req.params.id, { folder });
        } else {
            const s = memoryDb.savedQuestions.find(x => x._id === req.params.id);
            if(s) s.folder = folder;
        }
        res.json({ success: true });
    } catch(e) { res.status(500).json({error: e.message}); }
});

// --- MISTAKES ---
app.get('/api/users/:userId/mistakes', async (req, res) => {
    try {
        const { userId } = req.params;
        if(isDbConnected()) {
            const mistakes = await Mistake.find({ userId }).sort({ lastMissed: -1 });
            res.json(mistakes);
        } else {
            res.json(memoryDb.mistakes.filter(m => m.userId === userId));
        }
    } catch(e) { res.status(500).json({error: e.message}); }
});

app.delete('/api/users/:userId/mistakes/:id', async (req, res) => {
    try {
        if(isDbConnected()) {
            await Mistake.findByIdAndDelete(req.params.id);
        } else {
            memoryDb.mistakes = memoryDb.mistakes.filter(m => m._id !== req.params.id);
        }
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

// --- EXAM REF SPECIFIC ROUTE ---
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
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.delete('/api/admin/questions/:id', async (req, res) => {
    try {
        if(isDbConnected()) await QuestionBank.findByIdAndDelete(req.params.id);
        else memoryDb.questions = memoryDb.questions.filter(q => q._id !== req.params.id);
        res.json({ success: true });
    } catch(e) { res.status(500).json({error: e.message}); }
});

app.post('/api/quiz/generate-from-db', async (req, res) => {
    try {
        const { subject, chapter, topics, count } = req.body;
        const query = { subject, chapter };
        if(topics && topics.length > 0) query.topic = { $in: topics };

        if(isDbConnected()) {
            // Random sampling using aggregate
            const questions = await QuestionBank.aggregate([
                { $match: query },
                { $sample: { size: count } }
            ]);
            res.json(questions);
        } else {
            const qs = memoryDb.questions.filter(q => q.subject === subject && q.chapter === chapter && (!topics || topics.includes(q.topic)));
            res.json(qs.sort(() => 0.5 - Math.random()).slice(0, count));
        }
    } catch(e) { res.status(500).json({error: e.message}); }
});

app.get('/api/quiz/syllabus-stats', async (req, res) => {
    try {
        if(isDbConnected()) {
            const stats = await QuestionBank.aggregate([
                { $group: {
                    _id: { subject: "$subject", chapter: "$chapter", topic: "$topic" },
                    count: { $sum: 1 }
                }}
            ]);
            // Transform to nested structure
            const result = {};
            stats.forEach(item => {
                const { subject, chapter, topic } = item._id;
                if(!result[subject]) result[subject] = { total: 0, chapters: {} };
                if(!result[subject].chapters[chapter]) result[subject].chapters[chapter] = { total: 0, topics: {} };
                
                result[subject].chapters[chapter].topics[topic] = item.count;
                result[subject].chapters[chapter].total += item.count;
                result[subject].total += item.count;
            });
            res.json(result);
        } else { res.json({}); }
    } catch(e) { res.status(500).json({error: e.message}); }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
