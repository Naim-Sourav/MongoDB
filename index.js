
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
  weeklyQuests: [questSchema], // New: Weekly Quests
  lastQuestReset: { type: Number, default: 0 },
  lastWeeklyQuestReset: { type: Number, default: 0 } // New: Tracker for weekly reset
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

// --- HELPER: QUEST GENERATOR ---
const DEFAULT_QUESTS = [
    // Daily - REBALANCED FOR HARDER ECONOMY
    { title: 'Exam Warrior', description: 'যেকোনো ১টি কুইজ সম্পন্ন করো', type: 'EXAM_COMPLETE', target: 1, reward: 25, icon: 'FileCheck', link: '/quiz', category: 'DAILY' },
    { title: 'Battle Ready', description: '১টি কুইজ ব্যাটল খেলো', type: 'PLAY_BATTLE', target: 1, reward: 30, icon: 'Swords', link: '/battle', category: 'DAILY' },
    { title: 'Knowledge Keeper', description: '২টি প্রশ্ন সেভ করো', type: 'SAVE_QUESTION', target: 2, reward: 20, icon: 'Bookmark', link: '/quiz', category: 'DAILY' },
    { title: 'Daily Learner', description: '২০ মিনিট পড়ো', type: 'STUDY_TIME', target: 20, reward: 40, icon: 'Clock', link: '/tracker', category: 'DAILY' },
    { title: 'Curious Mind', description: 'AI টিউটরকে ১টি প্রশ্ন করো', type: 'ASK_AI', target: 1, reward: 15, icon: 'Bot', link: 'SYNAPSE', category: 'DAILY' },
    { title: 'Sharpshooter', description: 'কুইজে ৮০% মার্ক পাও', type: 'HIGH_SCORE', target: 1, reward: 50, icon: 'Target', link: '/quiz', category: 'DAILY' },
    { title: 'Deep Diver', description: 'প্রশ্ন ব্যাংক থেকে ১০টি প্রশ্ন প্র্যাকটিস করো', type: 'EXAM_COMPLETE', target: 1, reward: 30, icon: 'Database', link: '/qbank', category: 'DAILY' },
    // Weekly - REBALANCED
    { title: 'Weekly Exam Master', description: 'এই সপ্তাহে ৫টি কুইজ সম্পন্ন করো', type: 'EXAM_COMPLETE', target: 5, reward: 150, icon: 'Trophy', link: '/quiz', category: 'WEEKLY' },
    { title: 'Syllabus Crusher', description: 'যেকোনো অধ্যায়ের উপর পরীক্ষা দাও', type: 'EXAM_COMPLETE', target: 1, reward: 100, icon: 'BookOpen', link: '/quiz', category: 'WEEKLY' },
    { title: 'Consistency King', description: 'টানা ৩ দিন অ্যাপ ব্যবহার করো', type: 'LOGIN', target: 3, reward: 150, icon: 'Calendar', link: '#', category: 'WEEKLY' },
    { title: 'Battle Royale', description: '৫টি ব্যাটল জিতো', type: 'WIN_BATTLE', target: 5, reward: 250, icon: 'Crown', link: '/battle', category: 'WEEKLY' }
];

const getQuestsFromPool = async (category, count) => {
    let pool = [];
    if (isDbConnected()) {
        pool = await QuestTemplate.find({ category, isActive: true });
    } else {
        pool = memoryDb.questTemplates.filter(q => q.category === category && q.isActive);
    }

    // Fallback if empty (seed logic)
    if (pool.length === 0) {
        pool = DEFAULT_QUESTS.filter(q => q.category === category);
    }

    // Shuffle and pick
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

// --- ADMIN QUEST ROUTES ---
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
    const { uid, email, displayName, photoURL, college, hscBatch, department, target } = req.body;
    const updateData = { uid, email, displayName, photoURL, lastLogin: Date.now(), college, hscBatch, department, target };
    Object.keys(updateData).forEach(key => updateData[key] === undefined && delete updateData[key]);

    if (isDbConnected()) {
      let user = await User.findOne({ uid });
      const now = new Date();
      
      // Daily Reset Logic (Midnight)
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      
      // Weekly Reset Logic (Next Saturday Midnight)
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
          // Check Daily
          if (!user.lastQuestReset || user.lastQuestReset < todayStart) {
              dailyQuestsToSet = await getQuestsFromPool('DAILY', 5);
              updateData.lastQuestReset = todayStart;
          }
          // Check Weekly
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
      // Memory DB fallback (Simplified)
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
        } else {
             // Memory logic...
            res.json({ success: true });
        }
    } catch(e) { res.status(500).json({ error: 'Quest update failed' }); }
});

app.post('/api/quests/claim', async (req, res) => {
    try {
        const { userId, questId, category } = req.body; // Added category
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
        } else {
            // Memory logic
            res.json({ success: true, points: 100 });
        }
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
             // Map _id to id for frontend compatibility
            const formattedPayments = payments.map(p => {
                const obj = p.toObject();
                return { ...obj, id: obj._id.toString() };
            });
            res.json(formattedPayments);
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
            const formattedNotifs = notifs.map(n => {
                const obj = n.toObject();
                return { ...obj, id: obj._id.toString() };
            });
            res.json(formattedNotifs);
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
        } else {
            res.json(memoryDb.examPacks);
        }
    } catch(e) { res.status(500).json({error: e.message}); }
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
            user: { 
                displayName: user.displayName, // Return displayName
                photoURL: user.photoURL,       // Return photoURL
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
            strongestTopics: topicBreakdown.slice(0, 5),
            weakestTopics: topicBreakdown.slice().reverse().slice(0, 5),
            quests: user.dailyQuests || [],
            weeklyQuests: user.weeklyQuests || [] // Include weekly
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
                
                // Reduced points for exam completion to prevent inflation
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

// --- NEW: DYNAMIC TOPIC FETCHING ---
app.post('/api/quiz/get-topics', async (req, res) => {
    try {
        const { subject, chapters } = req.body;
        
        if (isDbConnected()) {
            // Find distinct topics for the selected subject and chapters
            const topicsData = await QuestionBank.aggregate([
                { 
                    $match: { 
                        subject: subject,
                        chapter: { $in: chapters }
                    } 
                },
                { 
                    $group: { 
                        _id: { chapter: "$chapter", topic: "$topic" } 
                    } 
                },
                {
                    $group: {
                        _id: "$_id.chapter",
                        topics: { $push: "$_id.topic" }
                    }
                }
            ]);

            // Transform into a map: { "Chapter Name": ["Topic 1", "Topic 2"] }
            const topicMap = {};
            topicsData.forEach(item => {
                topicMap[item._id] = item.topics.filter(t => t); // Filter nulls
            });

            res.json(topicMap);
        } else {
            // Fallback for memory mode (Scan memoryDb)
            const topicMap = {};
            memoryDb.questions.forEach(q => {
                if (q.subject === subject && chapters.includes(q.chapter)) {
                    if (!topicMap[q.chapter]) topicMap[q.chapter] = new Set();
                    topicMap[q.chapter].add(q.topic);
                }
            });
            // Convert Sets to Arrays
            Object.keys(topicMap).forEach(k => {
                topicMap[k] = Array.from(topicMap[k]);
            });
            res.json(topicMap);
        }
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
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
    
    // Check if enough questions found
    if (questions.length === 0) {
        return res.status(400).json({ error: 'নির্বাচিত অধ্যায়গুলোতে কোনো প্রশ্ন পাওয়া যায়নি। দয়া করে অন্য অধ্যায় নির্বাচন করুন।' });
    }

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
    
    // 1. Fetch current state
    if (isDbConnected()) battle = await Battle.findOne({ roomId: req.params.roomId });
    else battle = memoryDb.battles.find(b => b.roomId === req.params.roomId);

    if (!battle) return res.status(404).json({ error: 'Battle not found' });
    const player = battle.players.find(p => p.uid === userId);
    
    // Check if already answered using Map (for memory db) or checking key (for Mongoose map)
    let hasAnswered = false;
    if (isDbConnected()) {
        hasAnswered = player.answers.has(questionIndex.toString());
    } else {
        hasAnswered = player.answers[questionIndex] !== undefined;
    }

    if (player && !hasAnswered) {
        if(isCorrect) player.score += 50; // Increased battle reward to 50
        
        if (timeTaken) {
            player.totalTimeTaken = (player.totalTimeTaken || 0) + timeTaken;
        }

        // 2. Save the answer
        if (isDbConnected()) {
            player.answers.set(questionIndex.toString(), selectedOption);
            await battle.save();
            
            // --- CONCURRENCY FIX: Re-fetch to check if ALL players answered ---
            // This handles the race condition where multiple players click simultaneously
            battle = await Battle.findOne({ roomId: req.params.roomId });
        } else {
            player.answers[questionIndex] = selectedOption;
        }

        // 3. AUTO-SKIP LOGIC: Check if ALL players answered this question
        const allAnswered = battle.players.every(p => {
            if (isDbConnected()) return p.answers.has(questionIndex.toString());
            return p.answers[questionIndex] !== undefined;
        });

        if (allAnswered) {
            const durationPerQ = battle.config.timePerQuestion;
            const targetElapsed = (questionIndex + 1) * durationPerQ;
            
            // Add 1000ms buffer so clients see the full time (e.g., 30s) instead of 28/29s due to latency
            battle.startTime = Date.now() - (targetElapsed * 1000) + 1000;
            
            if (isDbConnected()) await battle.save();
        }
    }
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: 'Failed' }); }
});

// --- TEMP MIGRATION ROUTE ---
app.post('/api/admin/fix-chapter-name', async (req, res) => {
    try {
        if (isDbConnected()) {
            // Update Question Bank
            const qResult = await QuestionBank.updateMany(
                { chapter: 'মৌলের পর্যায়বৃত্ত ধর্ম ও রাসায়নি...' },
                { $set: { chapter: 'মৌলের পর্যায়বৃত্ত ধর্ম ও রাসায়নিক বন্ধন' } }
            );
            
            // Update Mistakes
            const mResult = await Mistake.updateMany(
                { chapter: 'মৌলের পর্যায়বৃত্ত ধর্ম ও রাসায়নি...' },
                { $set: { chapter: 'মৌলের পর্যায়বৃত্ত ধর্ম ও রাসায়নিক বন্ধন' } }
            );

            return res.json({ 
                success: true, 
                questionsUpdated: qResult.modifiedCount,
                mistakesUpdated: mResult.modifiedCount 
            });
        } else {
            return res.status(400).json({ error: "Only available in MongoDB mode" });
        }
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

// --- BIOLOGY MIGRATION ROUTE ---
app.post('/api/admin/fix-biology-names', async (req, res) => {
    try {
        if (!isDbConnected()) {
            return res.status(400).json({ error: "Only available in MongoDB mode" });
        }

        // Exact truncated strings from OLD code mapped to NEW full strings
        const mapping = {
            // Botany (Biology 1st Paper)
            'এন্ডোপ্লাজমিক রেটিকুলাম, কোষী...': 'এন্ডোপ্লাজমিক রেটিকুলাম, কোষীয় কঙ্কাল ও মাইটোকন্ড্রিয়া',
            'ক্রোমোজোম,নিউক্লিক এসিড, DNA...': 'ক্রোমোজোম, নিউক্লিক এসিড, DNA ও RNA',
            'DNA রেপ্লিকেশন, ট্রান্সক্রিপশন ও...': 'DNA রেপ্লিকেশন, ট্রান্সক্রিপশন ও ট্রান্সলেশন',
            'অ্যামাইটোসিস,মাইটোসিস,কোষ চক্র': 'অ্যামাইটোসিস, মাইটোসিস, কোষ চক্র',
            'ভাইরাসের বৈশিষ্ট্য, গঠন প্রকারভেদ ...': 'ভাইরাসের বৈশিষ্ট্য, গঠন প্রকারভেদ ও গুরুত্ব',
            'ব্যাকটেরিওফাজ ও ভাইরাসজনিত...': 'ব্যাকটেরিওফাজ ও ভাইরাসজনিত রোগের লক্ষণ, প্রতিকার ও প্রতিরোধের উপায়',
            'ব্যাকটেরিয়ার গঠন,প্রকারভেদ ...': 'ব্যাকটেরিয়ার গঠন, প্রকারভেদ ও জনন',
            'ব্যাকটেরিয়ার উপকারিতা, অপকারিতা...': 'ব্যাকটেরিয়ার উপকারিতা, অপকারিতা ব্যাকটেরিয়াজনিত রোগের লক্ষণ ও প্রতিরোধ',
            'শৈবালের বৈশিষ্ট্য, জনন , গঠন...': 'শৈবালের বৈশিষ্ট্য, জনন , গঠন প্রকারভেদ ও গুরুত্ব',
            'ছত্রাকের বৈশিষ্ট্য, গঠন, প্রজনন ...': 'ছত্রাকের বৈশিষ্ট্য, গঠন, প্রজনন ও গুরুত্ব',
            'Agaricus এর আবাস,গঠন , জনন ...': 'Agaricus এর আবাস, গঠন , জনন ও অর্থনৈতিক গুরুত্ব',
            'ছত্রাকঘটিত রোগের কারণ, লক্ষণ...': 'ছত্রাকঘটিত রোগের কারণ, লক্ষণ, প্রতিকার',
            'ব্রায়োফাইটা এবং Riccia এর আবা...': 'ব্রায়োফাইটা এবং Riccia এর আবাস, গঠন ও শনাক্তকারী বৈশিষ্ট্য',
            'টেরিডোফাইটা এবং Pteris এ...': 'টেরিডোফাইটা এবং Pteris এর আবাস, গঠন ও জনন',
            'নগ্নবীজী উদ্ভিদ এবং Cycas গঠন ...': 'নগ্নবীজী উদ্ভিদ এবং Cycas গঠন ও শনাক্তকারী বৈশিষ্ট্য',
            'আবৃতবীজী উদ্ভিদ,স্বরূপ ,মূল কান্ড ...': 'আবৃতবীজী উদ্ভিদ, স্বরূপ ,মূল কান্ড ও পাতা',
            'পুষ্পপত্রবিন্যাস,পুষ্পপুট,অমরাবিন্যাস...': 'পুষ্পপত্রবিন্যাস, পুষ্পপুট, অমরাবিন্যাস ও ফল',
            'Poaceae ও Malvaceae গোত্রে...': 'Poaceae ও Malvaceae গোত্রের শনাক্তকারী বৈশিষ্ট্য',
            'এপিডার্মাল, গ্রাউন্ড টিস্যুতন্ত্রে...': 'এপিডার্মাল, গ্রাউন্ড টিস্যুতন্ত্রের অবস্থান, গঠন ও কাজ',
            'একবীজপত্রী ও দ্বিবীজপত্রী উদ্ভিদে...': 'একবীজপত্রী ও দ্বিবীজপত্রী উদ্ভিদের মূল ও কান্ডের শনাক্তকারী বৈশিষ্ট্য',
            'উদ্ভিদের খনিজ লবণ শোষণ প্রক্রি...': 'উদ্ভিদের খনিজ লবণ শোষণ প্রক্রিয়া ও আধুনিক মতবাদসমূহ',
            'প্রস্বেদন, পত্ররন্ধ্রের গঠন বর্ণনা ...': 'প্রস্বেদন, পত্ররন্ধ্রের গঠন বর্ণনা ও পত্ররন্ধ্র উন্মুক্ত ও বন্ধ হওয়ার কৌশল এবং পত্ররন্ধ্রীয় প্রস্বেদন প্রক্রিয়া',
            'সালোকসংশ্লেষণ প্রক্রিয়া ও লিমি...': 'সালোকসংশ্লেষণ প্রক্রিয়া ও লিমিটিং ফ্যাক্টর',
            'প্রজাতি, জীবগোষ্ঠী ও জীবসম্প্রদা...': 'প্রজাতি, জীবগোষ্ঠী ও জীবসম্প্রদায় এবং ইকোলজিক্যাল পিরামিড',
            'জলজ, মরুজ ও লবনাক্ত পরিবে...': 'জলজ, মরুজ ও লবনাক্ত পরিবেশে জীবের অভিযোজন প্রক্রিয়া',
            'বাংলাদেশের বনাঞ্চল ও বনাঞ্চলে...': 'বাংলাদেশের বনাঞ্চল ও বনাঞ্চলের উদ্ভিদ ও প্রাণী',
            'বিলুপ্তপ্রায় জীব, বিলুপ্তির কারণ ...': 'বিলুপ্তপ্রায় জীব, বিলুপ্তির কারণ ও বিলুপ্তপ্রায় জীব সংরক্ষণ',
            'জিনোম সিকোয়েন্সিং ও জীব প্রযুক্তির...': 'জিনোম সিকোয়েন্সিং ও জীব প্রযুক্তির গুরুত্ব',

            // Zoology (Biology 2nd Paper)
            'প্রাণিজগতের ভিন্নতা, শ্রেণিবিন্যাসে...': 'প্রাণিজগতের ভিন্নতা, শ্রেণিবিন্যাসের ভিত্তি ও নীতি এবং এর প্রয়োজনীয়তা',
            'আর্থ্রোপোডা, একাইনোডার্মাটা ...': 'আর্থ্রোপোডা, একাইনোডার্মাটা ও কর্ডাটা',
            'কর্ডাটা পর্বের শ্রেণিবিন্যাস ...': 'কর্ডাটা পর্বের শ্রেণিবিন্যাস ও উপপর্বের বৈশিষ্ট্য',
            'হাইড্রার চলন ও জনন পদ্ধতি এ...': 'হাইড্রার চলন ও জনন পদ্ধতি এবং হাইড্রার মিথোজীবিতা',
            'ঘাসফড়িংএর চলন,শ্রমবন্টন,পরিপা...': 'ঘাসফড়িং এর চলন, শ্রমবন্টন, পরিপাক তন্ত্র ও পরিপাক পদ্ধতি',
            'ঘাসফড়িং এর সংবহন, শ্বসন ও রেচ...': 'ঘাসফড়িং এর সংবহন, শ্বসন ও রেচন পদ্ধতি',
            'ঘাসফড়িং এর প্রজনন প্রক্রিয়া ...': 'ঘাসফড়িং এর প্রজনন প্রক্রিয়া ও রূপান্তর এবং পুঞ্জাক্ষীর গঠন ও দর্শন কৌশল',
            'রুই মাছের রক্ত সংবহন তন্ত্র, শ্বসনত...': 'রুই মাছের রক্ত সংবহন তন্ত্র, শ্বসনতন্ত্র ও বায়ুথলির গঠন',
            'প্রকৃতিতে রুই মাছের প্রজনন, নিষে...': 'প্রকৃতিতে রুই মাছের প্রজনন, নিষেক ও রুই মাছের সংরক্ষণ',
            'পরিপাক, মুখগহ্বর ও পাকস্থলীর খা...': 'পরিপাক, মুখগহ্বর ও পাকস্থলীর খাদ্য পরিপাক প্রক্রিয়া ও লালাগ্রন্থি',
            'যকৃত ,এর সঞ্চয়ী এবং বিপাকী...': 'যকৃত, এর সঞ্চয়ী এবং বিপাকীয় ভূমিকা',
            'অগ্ন্যাশয়ের কার্যক্রম ও গ্যাস্ট্রিক জু...': 'অগ্ন্যাশয়ের কার্যক্রম ও গ্যাস্ট্রিক জুস নিঃসরণে স্নায়ুতন্ত্র এবং গ্যাস্ট্রিক হরমোনের ভূমিকা',
            'খাদ্যদ্রব্য পরিপাকে ও শোষণে ক্ষুদ্রা...': 'খাদ্যদ্রব্য পরিপাকে ও শোষণে ক্ষুদ্রান্ত্র এবং বৃহদন্ত্রের ভূমিকা এবং স্থূলতা ও পৌষ্টিকতন্ত্রের রোগ',
            'জাংশনাল টিস্যু ও ব্যারোরিসেপ্টর এ...': 'জাংশনাল টিস্যু ও ব্যারোরিসেপ্টর এবং রক্ত সংবহন পদ্ধতি',
            'মানুষের শ্বসন তন্ত্রের বিভিন্ন অংশে...': 'মানুষের শ্বসন তন্ত্রের বিভিন্ন অংশের গঠন ও কাজ',
            'প্রশ্বাস নিঃশ্বাস এবং অক্সিজেন ও কা...': 'প্রশ্বাস নিঃশ্বাস এবং অক্সিজেন ও কার্বন ডাইঅক্সাইড পরিবহন এবং শ্বাসরঞ্জক',
            'শ্বাসনালীর সংক্রমণের কারণ, লক্ষ...': 'শ্বাসনালীর সংক্রমণের কারণ, লক্ষণ এবং প্রতিকার',
            'বৃক্কের গঠন ও কাজ,রেচনে...': 'বৃক্কের গঠন ও কাজ, রেচনে শরীরবৃত্ত',
            'মূত্র,বৃক্ক বিকল,ডায়ালাইসিস,বৃ...': 'মূত্র, বৃক্ক বিকল, ডায়ালাইসিস, বৃক্ক প্রতিস্থাপন , হরমোনাল ক্রিয়া',
            'মানুষের কঙ্কালতন্ত্রের কা...': 'মানুষের কঙ্কালতন্ত্রের কাজ, প্রকারভেদ ও অস্থিসমূহ (অক্ষীয় ও উপাঙ্গীয় কঙ্কাল)',
            'পেশির গঠন, প্রকারভেদ ও কাজ এ...': 'পেশির গঠন, প্রকারভেদ ও কাজ এবং লডস ও লিভার',
            'অস্থিভঙ্গ ও অস্থিসন্ধিতে আঘাত এ...': 'অস্থিভঙ্গ ও অস্থিসন্ধিতে আঘাত এবং এদের প্রাথমিক চিকিৎসা',
            'নিউরন, স্নায়ুতন্ত্রে...': 'নিউরন, স্নায়ুতন্ত্রের শ্রেনিবিন্যাস, মস্তিষ্কের গঠন ও কাজ',
            'অন্তঃক্ষরা গ্রন্থিসমূহের অবস্তা...': 'অন্তঃক্ষরা গ্রন্থিসমূহের অবস্থান, নিঃসরণ ও ক্রিয়া',
            'পুরুষ ও স্ত্রী প্রজননতন্ত্র ও এ...': 'পুরুষ ও স্ত্রী প্রজননতন্ত্র ও এর হরমোনাল ক্রিয়া',
            'প্রজননের বিভিন্ন পর্যায় ও দ...': 'প্রজননের বিভিন্ন পর্যায় ও দশা (বয়ঃসন্ধিকাল, রজঃচক্র, গ্যামেট সৃষ্টি)',
            'গর্ভাবস্থায় করণীয়তা, গর্ভনিরোধ...': 'গর্ভাবস্থায় করণীয়তা, গর্ভনিরোধক পদ্ধতি ও আইভিএফ পদ্ধতি',
            'প্রজনন জনিত সমস্যা, যৌনবাহি...': 'প্রজনন জনিত সমস্যা, যৌনবাহিত রোগসমূহের লক্ষণ ও প্রতিকার',
            'মানবদেহের প্রতিরক্ষা ব্যবস্থার ধার...': 'মানবদেহের প্রতিরক্ষা ব্যবস্থার ধারণা (প্রথম, দ্বিতীয়, তৃতীয়)',
            'ম্যাক্রোফেজ,নিউট্রোফিলস ...': 'ম্যাক্রোফেজ, নিউট্রোফিলস ও ফ্যাগোসাইটোসিস',
            'মানবদেহের সহজাত ওর্জি...': 'মানবদেহের সহজাত ও অর্জিত প্রতিরক্ষা',
            'মেন্ডেলিয়ান ইনহেরিট্যান্স সূত্রাব...': 'মেন্ডেলিয়ান ইনহেরিট্যান্স সূত্রাবলী ব্যাখ্যা ও ক্রোমোসোম তত্ত্ব',
            'মেন্ডেলের সূত্রের ব্যতিক্রমসমূহ ...': 'মেন্ডেলের সূত্রের ব্যতিক্রমসমূহ ও পলিজেনিক ইনহেরিট্যান্স',
            'লিঙ্গ নির্ধারণ নীতি, সেক্সলিঙ্ক...': 'লিঙ্গ নির্ধারণ নীতি, সেক্সলিঙ্কড ডিসঅর্ডার ও রক্তের গ্রুপ ও বংশগতি জনিত সমস্যা',
            'বিবর্তনতত্ত্বের ধারণা ও বিবর্তনে...': 'বিবর্তনতত্ত্বের ধারণা ও বিবর্তনের মতবাদসমূহ',
            'আচরণের প্রকৃতি ও সহজাত আচরণ...': 'আচরণের প্রকৃতি ও সহজাত আচরণ (ট্যাক্সিস, রিফ্লেক্স)',
            'কুকুরের লালার প্রতিবর্তী ক্রিয়া...': 'কুকুরের লালার প্রতিবর্তী ক্রিয়ার (Reflexes) উপর Pavlov বর্ণনা ও মৌমাছির সামাজিক সংগঠন।'
        };

        let totalQUpdated = 0;
        let totalMUpdated = 0;

        // Iterate through mapping and perform updates
        for (const [oldName, newName] of Object.entries(mapping)) {
            // Update Question Bank
            const qRes = await QuestionBank.updateMany(
                { topic: oldName }, // Use topic field for mapping
                { $set: { topic: newName } }
            );
            totalQUpdated += qRes.modifiedCount;

            // Update Mistakes
            const mRes = await Mistake.updateMany(
                { topic: oldName },
                { $set: { topic: newName } }
            );
            totalMUpdated += mRes.modifiedCount;
        }

        return res.json({
            success: true,
            totalTopicsProcessed: Object.keys(mapping).length,
            questionsUpdated: totalQUpdated,
            mistakesUpdated: totalMUpdated
        });

    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

// --- CHEMISTRY MIGRATION ROUTE ---
app.post('/api/admin/fix-chemistry-names', async (req, res) => {
    try {
        if (!isDbConnected()) {
            return res.status(400).json({ error: "Only available in MongoDB mode" });
        }

        const mapping = {
            // Chemistry 1st Paper
            '১.১ - পোশাক,নিরাপদ গ্লাস,মাস্ক ...': '১.১ - পোশাক, নিরাপদ গ্লাস, মাস্ক ও হ্যান্ড গ্লাভস',
            '১.২- গ্লাস সামগ্রী ব্যবহার এর নিরাপ...': '১.২- গ্লাস সামগ্রী ব্যবহারের নিরাপদ কৌশল',
            '১.৩- ল্যাবরেটরি, যন্ত্রপাতি ও গ্লা...': '১.৩- ল্যাবরেটরি, যন্ত্রপাতি ও গ্লাস সামগ্রী পরিষ্কার করার কৌশল',
            '১.১০- ল্যাবরেটরি এর নিরাপত্তা ...': '১.১০- ল্যাবরেটরির নিরাপত্তা সামগ্রী ও ব্যবহার বিধি',
            'পরমাণুর ভর ও আপেক্ষিক পারমাণবি...': 'পরমাণুর ভর ও আপেক্ষিক পারমাণবিক ভর',
            'মৌলের তেজস্ক্রিয়তা ও তেজস্ক্রী...': 'মৌলের তেজস্ক্রিয়তা ও তেজস্ক্রিয় আইসোটোপ',
            '২.২ কোয়ান্টাম সংখ্যা, উপস্ত...': '২.২ কোয়ান্টাম সংখ্যা, উপস্তর, ইলেকট্রন ধারণ ক্ষমতা',
            '২.৫তড়িৎ চৌম্বক বর্ণালী, পরমাণু রে...': '২.৫ তড়িৎ চৌম্বক বর্ণালী, পরমাণু রেখা বর্ণালী',
            '২.৭ UV রশি, জাল টাকা, IR র...': '২.৭ UV রশি, জাল টাকা, IR রশি, এবং এদের ব্যবহার, MRI',
            '৩.১ ইলেকট্রন বিন্যাস এর ভিত্তি...': '৩.১ ইলেকট্রন বিন্যাস এর ভিত্তিতে মৌলের শ্রেণী বিভাগ',
            '৩.৪ আয়নিকরণ শক্তি, ইলেক্ট্র...': '৩.৪ আয়নিকরণ শক্তি, ইলেকট্রন আসক্তি, তড়িৎ ঋণাত্মকতা',
            '৩.৬ মৌলের পর্যায় বৃত্ত ধর্ম এ...': '৩.৬ মৌলের পর্যায়বৃত্ত ধর্ম এবং রাসায়নিক বন্ধন এর সম্পর্ক',
            '৩.১১ সংকর অরবিটাল এর সা...': '৩.১১ সংকর অরবিটাল এর সাথে সমযোজী যৌগের আকৃতি সম্পর্ক',
            '৩.১২ অণুর আকৃতি ও বন্ধন কোণে...': '৩.১২ অণুর আকৃতি ও বন্ধন কোণের উপর মুক্তজোড় ইলেকট্রন এর প্রভাব',
            '৩.১৩ নিঃসঙ্গ ইলেকট্রন জোড় ...': '৩.১৩ নিঃসঙ্গ ইলেকট্রন জোড় ও লিগ্যান্ড',
            '৩.১৬ সমযোজী এর আয়নুিক ...': '৩.১৬ সমযোজী এর আয়নিক ও আয়নিক এর সমযোজী বৈশিষ্ট্য',
            '৪.১ রাসায়নিক বিক্রিয়া ও গ্রি...': '৪.১ রাসায়নিক বিক্রিয়া ও গ্রিন কেমিস্ট্রি',
            '৪.৪ সাম্যাবস্থা ও সাম্যাবস্থা এ...': '৪.৪ সাম্যাবস্থা ও সাম্যাবস্থা এর গতিশীলতা',
            '৪.৫ লা শাতেলিয় নীতি ও শি...': '৪.৫ লা শাতেলিয় নীতি ও শিল্প উৎপাদন',
            '৪.৭ সাম্য ধ্রুবক ও Kc,Kp এর ম...': '৪.৭ সাম্য ধ্রুবক ও Kc,Kp এর মধ্যে সম্পর্ক',
            '৪.৯ অ্যাসিড ও ক্ষার বিয়োজ...': '৪.৯ অ্যাসিড ও ক্ষার বিয়োজন ধ্রুবক (Ka,Kb)',
            '৪.১১ অ্যাসিড ক্ষার তীব্রতা ও বিয়োজ...': '৪.১১ অ্যাসিড ক্ষার তীব্রতা ও বিয়োজন ধ্রুবক',
            '৪.১৪ মানুষের রক্ত, কৃষি, রসায়ন শি...': '৪.১৪ মানুষের রক্ত, কৃষি, রসায়ন শিল্প, ঔষধ সেবনে pH scale',
            '৪.১৮ তীব্র অ্যাসিড ও তীব্র ক্ষার প্রশ...': '৪.১৮ তীব্র অ্যাসিড ও তীব্র ক্ষার প্রশমন তাপ',
            '৫.২ অনুমোদিত প্রিজারভেটিভস এ...': '৫.২ অনুমোদিত প্রিজারভেটিভস এর খাদ্য সংরক্ষণ',
            '৫.৪ দেশী ফলের, মাছ মাংস, টমে...': '৫.৪ দেশী ফলের, মাছ মাংস, টমেটো কৌটাজাতকরণ',
            '৫.৮ গ্লাস ক্লিনার, টয়লেট ক্লিনার প্রস্ত...': '৫.৮ গ্লাস ক্লিনার, টয়লেট ক্লিনার প্রস্তুতি এবং ব্যবহার',
            '৫.১১ ভিনেগার এর খাদ্য সংরক্ষ...': '৫.১১ ভিনেগার এর খাদ্য সংরক্ষণ কৌশল',
            '৫.১২ খাদ্যদ্রব্য সংরক্ষণে ভিনেগার এ...': '৫.১২ খাদ্যদ্রব্য সংরক্ষণে ভিনেগার এর গুরুত্ব',

            // Chemistry 2nd Paper
            '১.৪ বয়েল, চার্লস ও avogadro এ...': '১.৪ বয়েল, চার্লস ও avogadro এর সূত্র',
            '১.৫ বয়েল চার্লস এর সমন্বয় সূ...': '১.৫ বয়েল চার্লস এর সমন্বয় সূত্র, আদর্শ গ্যাস সূত্র',
            '১.৬ গ্যাস এর আংশিক চাপ ও ডাল্ট...': '১.৬ গ্যাস এর আংশিক চাপ ও ডাল্টন এর সূত্র',
            '১.৭ গ্রাহাম এর সূত্র : গ্যাস এর ব্যাপ...': '১.৭ গ্রাহাম এর সূত্র : গ্যাস এর ব্যাপন ও অনু ব্যাপন',
            '১.৮ গ্যাস এর আণবিক গতিত...': '১.৮ গ্যাস এর আণবিক গতিতত্ত্ব: বর্গমূল গড় বর্গ বেগ ও অন্যান্য গতিবেগ',
            '১.১০ আমাগা লেখচিত্র ...': '১.১০ আমাগা লেখচিত্র ও সংকোচনশীলতা গুণাংক',
            '১.১২ গ্যাস সিলিন্ডার করণে গ্যা...': '১.১২ গ্যাস সিলিন্ডার করণে গ্যাস সূত্রের প্রয়োগ',
            '১.১৩ বজ্রপাত এ বায়ুমণ্ডল ও মাটি...': '১.১৩ বজ্রপাত এ বায়ুমণ্ডল ও মাটিতে N ফিক্সেশন',
            '১.১৪ শিল্পের গ্যাসীয় বর্জ্য ও গ্রি...': '১.১৪ শিল্পের গ্যাসীয় বর্জ্য ও গ্রিন হাউস ইফেক্ট',
            '১.১৫ CFC গ্যাস ও ওজন স্ত...': '১.১৫ CFC গ্যাস ও ওজন স্তর, এসিড বৃষ্টি ও প্রতিকার',
            '১.১৬ আরহেনিয়াস সমীকরণের...': '১.১৬ আরহেনিয়াস সমীকরণ, ব্রনস্টেড- লাউরি তত্ত্ব',
            '১.১৮ মিঠা পানি, পানি দূষণ,পানি...': '১.১৮ মিঠা পানি, পানি দূষণ, পানির বিশুদ্ধতার মানদণ্ড',
            '২.১ জৈব যৌগ, অজৈব যৌগ, কার্ব...': '২.১ জৈব যৌগ, অজৈব যৌগ, কার্বন এর sp,sp 2, sp 3 সংকরায়ণ',
            '২.২ কার্যকরী মূলক , কার্যকরী মূলকে...': '২.২ কার্যকরী মূলক , কার্যকরী মূলকের ভিত্তিতে জৈবযৌগের শ্রেণিকরণ',
            '২.৪ সমানুকরণ : জ্যামিতিক ...': '২.৪ সমানুকরণ : জ্যামিতিক ও আলোক সমানুতা',
            '২.৫ বন্ধন বিভাজন, বিকার...': '২.৫ বন্ধন বিভাজন, বিকারক, অ্যালিফেটিক হাইড্রোকার্বন, অ্যালকেন, অ্যালকিন, অ্যালকাইন',
            '২.৬ aromaticity ও হাকেল ত...': '২.৬ aromaticity ও হাকেল তত্ত্ব, বেনজিন',
            '২.৭ বেনজিন চক্রে প্রতিস্থাপক এ...': '২.৭ বেনজিন চক্রে প্রতিস্থাপক এর প্রভাব(inductive, মেসোমেরিক, অর্থ, প্যারা , মেটা নির্দেশক)',
            '২.৯ alkyl halide+ SN1,SN 2, E ...': '২.৯ alkyl halide+ SN1,SN 2, E 1, E 2',
            '২.১০ হ্যালোফরম ,অ্যালকোহ...': '২.১০ হ্যালোফরম ,অ্যালকোহল, গ্লিসারিন, ফেনল, এস্টার',
            '২.১১ ইথার, কার্বনিল যৌ...': '২.১১ ইথার, কার্বনিল যৌগ: অ্যালডিহাইড, কিটোন',
            '২.১৪ nitro গ্লিসারিন, TNT, ডেট...': '২.১৪ nitro গ্লিসারিন, TNT, ডেটোল, প্যারাসিটামল',
            '৩.১ রাসায়নিক গণনা ও গ্যাসে...': '৩.১ রাসায়নিক গণনা ও গ্যাসের মোলার আয়তন',
            '৩.২ রাসায়নিক সমীকরণ থেকে উৎপ...': '৩.২ রাসায়নিক সমীকরণ থেকে উৎপাদ গ্যাস এর আয়তন নির্ণয়',
            '৩.৩ বিক্রিয়ক এর ভর থেকে উৎপা...': '৩.৩ বিক্রিয়ক এর ভর থেকে উৎপাদ গ্যাসের ভর ও আয়তন নির্ণয়',
            '৩.৪ মোলার ঘনমাত্রা বা মোলারি...': '৩.৪ মোলার ঘনমাত্রা বা মোলারিটি ( একক এর পরিবর্তন)',
            '৩.৫ অ্যাসিড ক্ষার প্রশমন বিক্রিয়া ...': '৩.৫ অ্যাসিড ক্ষার প্রশমন বিক্রিয়া ও প্রশমন বিন্দু',
            '৩.৭ জারণ সংখ্যা , জারণ ক্ষমতা ...': '৩.৭ জারণ সংখ্যা , জারণ ক্ষমতা , জারণ বিজারণ অর্ধ বিক্রিয়া , আয়ন সহগোর সাহায্যে রাসায়নিক সমতা',
            '৪.৬ তড়িৎ দার বিভব এবং ধাতু...': '৪.৬ তড়িৎ দার বিভব এবং ধাতুর সক্রিয়তা সিরিজ',
            '৪.৭ redox বিক্রিয়া, কোষ বিভব ...': '৪.৭ redox বিক্রিয়া, কোষ বিভব ও প্রমাণ কোষ বিভব',
            '৪.৮ তড়িৎ দার ও কোষের বিভ...': '৪.৮ তড়িৎ দার ও কোষের বিভব সংক্রান্ত nernst ইকুয়েশন',
            '৪.১০ এক ও দুই প্রকোষ্ঠ বিশিষ্ট তড়ি...': '৪.১০ এক ও দুই প্রকোষ্ঠ বিশিষ্ট তড়িৎ কোষ',
            '৪.১২ লেড স্টোরেজ ও লিথিয়া...': '৪.১২ লেড স্টোরেজ ও লিথিয়াম ব্যাটারি',
            '৫.৩ জ্বালানি সম্পদের এর প্রেক্ষি...': '৫.৩ জ্বালানি সম্পদের এর প্রেক্ষিতে বাংলাদেশ শিল্পায়ন',
            '৫.৪ বাংলাদেশে উল্লেখযোগ্য রসায়...': '৫.৪ বাংলাদেশে উল্লেখযোগ্য রসায়ন শিল্প পরিচিতি',
            '৫.৫ ইউরিয়া, কাঁচ, সিরামিক, pul...': '৫.৫ ইউরিয়া, কাঁচ, সিরামিক, pulp পেপার সিমেন্ট উৎপাদন',
            '৫.৭ সিমেন্ট,ইউরিয়া,চামড়া, টেক্সটাই...': '৫.৭ সিমেন্ট,ইউরিয়া,চামড়া, টেক্সটাইল ও ডাইং শিল্পের দূষক',
            '৫.৯ আয়রন,অ্যালুমিনিয়াম, কপা...': '৫.৯ আয়রন,অ্যালুমিনিয়াম, কপার, কাঁচ, গ্লাস এর রিসাইক্লিং প্রণালী'
        };

        let totalQUpdated = 0;
        let totalMUpdated = 0;

        // Iterate through mapping and perform updates
        for (const [oldName, newName] of Object.entries(mapping)) {
            // Update Question Bank
            const qRes = await QuestionBank.updateMany(
                { topic: oldName }, // Use topic field for mapping
                { $set: { topic: newName } }
            );
            totalQUpdated += qRes.modifiedCount;

            // Update Mistakes
            const mRes = await Mistake.updateMany(
                { topic: oldName },
                { $set: { topic: newName } }
            );
            totalMUpdated += mRes.modifiedCount;
        }

        return res.json({
            success: true,
            totalTopicsProcessed: Object.keys(mapping).length,
            questionsUpdated: totalQUpdated,
            mistakesUpdated: totalMUpdated
        });

    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

// --- REVERT ALL NAMES ROUTE ---
app.post('/api/admin/revert-all-names', async (req, res) => {
    try {
        if (!isDbConnected()) {
            return res.status(400).json({ error: "Only available in MongoDB mode" });
        }

        // Full names mapped back to their truncated versions
        const reverseMapping = {
            // Biology 1st Paper
            'এন্ডোপ্লাজমিক রেটিকুলাম, কোষীয় কঙ্কাল ও মাইটোকন্ড্রিয়া': 'এন্ডোপ্লাজমিক রেটিকুলাম, কোষী...',
            'ক্রোমোজোম, নিউক্লিক এসিড, DNA ও RNA': 'ক্রোমোজোম,নিউক্লিক এসিড, DNA...',
            'DNA রেপ্লিকেশন, ট্রান্সক্রিপশন ও ট্রান্সলেশন': 'DNA রেপ্লিকেশন, ট্রান্সক্রিপশন ও...',
            'অ্যামাইটোসিস, মাইটোসিস, কোষ চক্র': 'অ্যামাইটোসিস,মাইটোসিস,কোষ চক্র',
            'ভাইরাসের বৈশিষ্ট্য, গঠন প্রকারভেদ ও গুরুত্ব': 'ভাইরাসের বৈশিষ্ট্য, গঠন প্রকারভেদ ...',
            'ব্যাকটেরিওফাজ ও ভাইরাসজনিত রোগের লক্ষণ, প্রতিকার ও প্রতিরোধের উপায়': 'ব্যাকটেরিওফাজ ও ভাইরাসজনিত...',
            'ব্যাকটেরিয়ার গঠন, প্রকারভেদ ও জনন': 'ব্যাকটেরিয়ার গঠন,প্রকারভেদ ...',
            'ব্যাকটেরিয়ার উপকারিতা, অপকারিতা ব্যাকটেরিয়াজনিত রোগের লক্ষণ ও প্রতিরোধ': 'ব্যাকটেরিয়ার উপকারিতা, অপকারিতা...',
            'শৈবালের বৈশিষ্ট্য, জনন , গঠন প্রকারভেদ ও গুরুত্ব': 'শৈবালের বৈশিষ্ট্য, জনন , গঠন...',
            'ছত্রাকের বৈশিষ্ট্য, গঠন, প্রজনন ও গুরুত্ব': 'ছত্রাকের বৈশিষ্ট্য, গঠন, প্রজনন ...',
            'Agaricus এর আবাস, গঠন , জনন ও অর্থনৈতিক গুরুত্ব': 'Agaricus এর আবাস,গঠন , জনন ...',
            'ছত্রাকঘটিত রোগের কারণ, লক্ষণ, প্রতিকার': 'ছত্রাকঘটিত রোগের কারণ, লক্ষণ...',
            'ব্রায়োফাইটা এবং Riccia এর আবাস, গঠন ও শনাক্তকারী বৈশিষ্ট্য': 'ব্রায়োফাইটা এবং Riccia এর আবা...',
            'টেরিডোফাইটা এবং Pteris এর আবাস, গঠন ও জনন': 'টেরিডোফাইটা এবং Pteris এ...',
            'নগ্নবীজী উদ্ভিদ এবং Cycas গঠন ও শনাক্তকারী বৈশিষ্ট্য': 'নগ্নবীজী উদ্ভিদ এবং Cycas গঠন ...',
            'আবৃতবীজী উদ্ভিদ, স্বরূপ ,মূল কান্ড ও পাতা': 'আবৃতবীজী উদ্ভিদ,স্বরূপ ,মূল কান্ড ...',
            'পুষ্পপত্রবিন্যাস, পুষ্পপুট, অমরাবিন্যাস ও ফল': 'পুষ্পপত্রবিন্যাস,পুষ্পপুট,অমরাবিন্যাস...',
            'Poaceae ও Malvaceae গোত্রের শনাক্তকারী বৈশিষ্ট্য': 'Poaceae ও Malvaceae গোত্রে...',
            'এপিডার্মাল, গ্রাউন্ড টিস্যুতন্ত্রের অবস্থান, গঠন ও কাজ': 'এপিডার্মাল, গ্রাউন্ড টিস্যুতন্ত্রে...',
            'একবীজপত্রী ও দ্বিবীজপত্রী উদ্ভিদের মূল ও কান্ডের শনাক্তকারী বৈশিষ্ট্য': 'একবীজপত্রী ও দ্বিবীজপত্রী উদ্ভিদে...',
            'উদ্ভিদের খনিজ লবণ শোষণ প্রক্রিয়া ও আধুনিক মতবাদসমূহ': 'উদ্ভিদের খনিজ লবণ শোষণ প্রক্রি...',
            'প্রস্বেদন, পত্ররন্ধ্রের গঠন বর্ণনা ও পত্ররন্ধ্র উন্মুক্ত ও বন্ধ হওয়ার কৌশল এবং পত্ররন্ধ্রীয় প্রস্বেদন প্রক্রিয়া': 'প্রস্বেদন, পত্ররন্ধ্রের গঠন বর্ণনা ...',
            'সালোকসংশ্লেষণ প্রক্রিয়া ও লিমিটিং ফ্যাক্টর': 'সালোকসংশ্লেষণ প্রক্রিয়া ও লিমি...',
            'প্রজাতি, জীবগোষ্ঠী ও জীবসম্প্রদায় এবং ইকোলজিক্যাল পিরামিড': 'প্রজাতি, জীবগোষ্ঠী ও জীবসম্প্রদা...',
            'জলজ, মরুজ ও লবনাক্ত পরিবেশে জীবের অভিযোজন প্রক্রিয়া': 'জলজ, মরুজ ও লবনাক্ত পরিবে...',
            'বাংলাদেশের বনাঞ্চল ও বনাঞ্চলের উদ্ভিদ ও প্রাণী': 'বাংলাদেশের বনাঞ্চল ও বনাঞ্চলে...',
            'বিলুপ্তপ্রায় জীব, বিলুপ্তির কারণ ও বিলুপ্তপ্রায় জীব সংরক্ষণ': 'বিলুপ্তপ্রায় জীব, বিলুপ্তির কারণ ...',
            'জিনোম সিকোয়েন্সিং ও জীব প্রযুক্তির গুরুত্ব': 'জিনোম সিকোয়েন্সিং ও জীব প্রযুক্তির...',

            // Biology 2nd Paper
            'প্রাণিজগতের ভিন্নতা, শ্রেণিবিন্যাসের ভিত্তি ও নীতি এবং এর প্রয়োজনীয়তা': 'প্রাণিজগতের ভিন্নতা, শ্রেণিবিন্যাসে...',
            'আর্থ্রোপোডা, একাইনোডার্মাটা ও কর্ডাটা': 'আর্থ্রোপোডা, একাইনোডার্মাটা ...',
            'কর্ডাটা পর্বের শ্রেণিবিন্যাস ও উপপর্বের বৈশিষ্ট্য': 'কর্ডাটা পর্বের শ্রেণিবিন্যাস ...',
            'হাইড্রার চলন ও জনন পদ্ধতি এবং হাইড্রার মিথোজীবিতা': 'হাইড্রার চলন ও জনন পদ্ধতি এ...',
            'ঘাসফড়িং এর চলন, শ্রমবন্টন, পরিপাক তন্ত্র ও পরিপাক পদ্ধতি': 'ঘাসফড়িংএর চলন,শ্রমবন্টন,পরিপা...',
            'ঘাসফড়িং এর সংবহন, শ্বসন ও রেচন পদ্ধতি': 'ঘাসফড়িং এর সংবহন, শ্বসন ও রেচ...',
            'ঘাসফড়িং এর প্রজনন প্রক্রিয়া ও রূপান্তর এবং পুঞ্জাক্ষীর গঠন ও দর্শন কৌশল': 'ঘাসফড়িং এর প্রজনন প্রক্রিয়া ...',
            'রুই মাছের রক্ত সংবহন তন্ত্র, শ্বসনতন্ত্র ও বায়ুথলির গঠন': 'রুই মাছের রক্ত সংবহন তন্ত্র, শ্বসনত...',
            'প্রকৃতিতে রুই মাছের প্রজনন, নিষেক ও রুই মাছের সংরক্ষণ': 'প্রকৃতিতে রুই মাছের প্রজনন, নিষে...',
            'পরিপাক, মুখগহ্বর ও পাকস্থলীর খাদ্য পরিপাক প্রক্রিয়া ও লালাগ্রন্থি': 'পরিপাক, মুখগহ্বর ও পাকস্থলীর খা...',
            'যকৃত, এর সঞ্চয়ী এবং বিপাকীয় ভূমিকা': 'যকৃত ,এর সঞ্চয়ী এবং বিপাকী...',
            'অগ্ন্যাশয়ের কার্যক্রম ও গ্যাস্ট্রিক জুস নিঃসরণে স্নায়ুতন্ত্র এবং গ্যাস্ট্রিক হরমোনের ভূমিকা': 'অগ্ন্যাশয়ের কার্যক্রম ও গ্যাস্ট্রিক জু...',
            'খাদ্যদ্রব্য পরিপাকে ও শোষণে ক্ষুদ্রান্ত্র এবং বৃহদন্ত্রের ভূমিকা এবং স্থূলতা ও পৌষ্টিকতন্ত্রের রোগ': 'খাদ্যদ্রব্য পরিপাকে ও শোষণে ক্ষুদ্রা...',
            'জাংশনাল টিস্যু ও ব্যারোরিসেপ্টর এবং রক্ত সংবহন পদ্ধতি': 'জাংশনাল টিস্যু ও ব্যারোরিসেপ্টর এ...',
            'মানুষের শ্বসন তন্ত্রের বিভিন্ন অংশের গঠন ও কাজ': 'মানুষের শ্বসন তন্ত্রের বিভিন্ন অংশে...',
            'প্রশ্বাস নিঃশ্বাস এবং অক্সিজেন ও কার্বন ডাইঅক্সাইড পরিবহন এবং শ্বাসরঞ্জক': 'প্রশ্বাস নিঃশ্বাস এবং অক্সিজেন ও কা...',
            'শ্বাসনালীর সংক্রমণের কারণ, লক্ষণ এবং প্রতিকার': 'শ্বাসনালীর সংক্রমণের কারণ, লক্ষ...',
            'বৃক্কের গঠন ও কাজ, রেচনে শরীরবৃত্ত': 'বৃক্কের গঠন ও কাজ,রেচনে...',
            'মূত্র, বৃক্ক বিকল, ডায়ালাইসিস, বৃক্ক প্রতিস্থাপন , হরমোনাল ক্রিয়া': 'মূত্র,বৃক্ক বিকল,ডায়ালাইসিস,বৃ...',
            'মানুষের কঙ্কালতন্ত্রের কাজ, প্রকারভেদ ও অস্থিসমূহ (অক্ষীয় ও উপাঙ্গীয় কঙ্কাল)': 'মানুষের কঙ্কালতন্ত্রের কা...',
            'পেশির গঠন, প্রকারভেদ ও কাজ এবং লডস ও লিভার': 'পেশির গঠন, প্রকারভেদ ও কাজ এ...',
            'অস্থিভঙ্গ ও অস্থিসন্ধিতে আঘাত এবং এদের প্রাথমিক চিকিৎসা': 'অস্থিভঙ্গ ও অস্থিসন্ধিতে আঘাত এ...',
            'নিউরন, স্নায়ুতন্ত্রের শ্রেনিবিন্যাস, মস্তিষ্কের গঠন ও কাজ': 'নিউরন, স্নায়ুতন্ত্রে...',
            'অন্তঃক্ষরা গ্রন্থিসমূহের অবস্থান, নিঃসরণ ও ক্রিয়া': 'অন্তঃক্ষরা গ্রন্থিসমূহের অবস্তা...',
            'পুরুষ ও স্ত্রী প্রজননতন্ত্র ও এর হরমোনাল ক্রিয়া': 'পুরুষ ও স্ত্রী প্রজননতন্ত্র ও এ...',
            'প্রজননের বিভিন্ন পর্যায় ও দশা (বয়ঃসন্ধিকাল, রজঃচক্র, গ্যামেট সৃষ্টি)': 'প্রজননের বিভিন্ন পর্যায় ও দ...',
            'গর্ভাবস্থায় করণীয়তা, গর্ভনিরোধক পদ্ধতি ও আইভিএফ পদ্ধতি': 'গর্ভাবস্থায় করণীয়তা, গর্ভনিরোধ...',
            'প্রজনন জনিত সমস্যা, যৌনবাহিত রোগসমূহের লক্ষণ ও প্রতিকার': 'প্রজনন জনিত সমস্যা, যৌনবাহি...',
            'মানবদেহের প্রতিরক্ষা ব্যবস্থার ধারণা (প্রথম, দ্বিতীয়, তৃতীয়)': 'মানবদেহের প্রতিরক্ষা ব্যবস্থার ধার...',
            'ম্যাক্রোফেজ, নিউট্রোফিলস ও ফ্যাগোসাইটোসিস': 'ম্যাক্রোফেজ,নিউট্রোফিলস ...',
            'মানবদেহের সহজাত ও অর্জিত প্রতিরক্ষা': 'মানবদেহের সহজাত ওর্জি...',
            'মেন্ডেলিয়ান ইনহেরিট্যান্স সূত্রাবলী ব্যাখ্যা ও ক্রোমোসোম তত্ত্ব': 'মেন্ডেলিয়ান ইনহেরিট্যান্স সূত্রাব...',
            'মেন্ডেলের সূত্রের ব্যতিক্রমসমূহ ও পলিজেনিক ইনহেরিট্যান্স': 'মেন্ডেলের সূত্রের ব্যতিক্রমসমূহ ...',
            'লিঙ্গ নির্ধারণ নীতি, সেক্সলিঙ্কড ডিসঅর্ডার ও রক্তের গ্রুপ ও বংশগতি জনিত সমস্যা': 'লিঙ্গ নির্ধারণ নীতি, সেক্সলিঙ্ক...',
            'বিবর্তনতত্ত্বের ধারণা ও বিবর্তনের মতবাদসমূহ': 'বিবর্তনতত্ত্বের ধারণা ও বিবর্তনে...',
            'আচরণের প্রকৃতি ও সহজাত আচরণ (ট্যাক্সিস, রিফ্লেক্স)': 'আচরণের প্রকৃতি ও সহজাত আচরণ...',
            'কুকুরের লালার প্রতিবর্তী ক্রিয়ার (Reflexes) উপর Pavlov বর্ণনা ও মৌমাছির সামাজিক সংগঠন।': 'কুকুরের লালার প্রতিবর্তী ক্রিয়ার...',

            // Chemistry 1st Paper
            '১.১ - পোশাক, নিরাপদ গ্লাস, মাস্ক ও হ্যান্ড গ্লাভস': '১.১ - পোশাক,নিরাপদ গ্লাস,মাস্ক ...',
            '১.২- গ্লাস সামগ্রী ব্যবহারের নিরাপদ কৌশল': '১.২- গ্লাস সামগ্রী ব্যবহার এর নিরাপ...',
            '১.৩- ল্যাবরেটরি, যন্ত্রপাতি ও গ্লাস সামগ্রী পরিষ্কার করার কৌশল': '১.৩- ল্যাবরেটরি, যন্ত্রপাতি ও গ্লা...',
            '১.১০- ল্যাবরেটরির নিরাপত্তা সামগ্রী ও ব্যবহার বিধি': '১.১০- ল্যাবরেটরি এর নিরাপত্তা ...',
            'পরমাণুর ভর ও আপেক্ষিক পারমাণবিক ভর': 'পরমাণুর ভর ও আপেক্ষিক পারমাণবি...',
            'মৌলের তেজস্ক্রিয়তা ও তেজস্ক্রিয় আইসোটোপ': 'মৌলের তেজস্ক্রিয়তা ও তেজস্ক্রী...',
            '২.২ কোয়ান্টাম সংখ্যা, উপস্তর, ইলেকট্রন ধারণ ক্ষমতা': '২.২ কোয়ান্টাম সংখ্যা, উপস্ত...',
            '২.৫ তড়িৎ চৌম্বক বর্ণালী, পরমাণু রেখা বর্ণালী': '২.৫তড়িৎ চৌম্বক বর্ণালী, পরমাণু রে...',
            '২.৭ UV রশি, জাল টাকা, IR রশি, এবং এদের ব্যবহার, MRI': '২.৭ UV রশি, জাল টাকা, IR র...',
            '৩.১ ইলেকট্রন বিন্যাস এর ভিত্তিতে মৌলের শ্রেণী বিভাগ': '৩.১ ইলেকট্রন বিন্যাস এর ভিত্তি...',
            '৩.৪ আয়নিকরণ শক্তি, ইলেকট্রন আসক্তি, তড়িৎ ঋণাত্মকতা': '৩.৪ আয়নিকরণ শক্তি, ইলেক্ট্র...',
            '৩.৬ মৌলের পর্যায়বৃত্ত ধর্ম এবং রাসায়নিক বন্ধন এর সম্পর্ক': '৩.৬ মৌলের পর্যায় বৃত্ত ধর্ম এ...',
            '৩.১১ সংকর অরবিটাল এর সাথে সমযোজী যৌগের আকৃতি সম্পর্ক': '৩.১১ সংকর অরবিটাল এর সা...',
            '৩.১২ অণুর আকৃতি ও বন্ধন কোণের উপর মুক্তজোড় ইলেকট্রন এর প্রভাব': '৩.১২ অণুর আকৃতি ও বন্ধন কোণে...',
            '৩.১৩ নিঃসঙ্গ ইলেকট্রন জোড় ও লিগ্যান্ড': '৩.১৩ নিঃসঙ্গ ইলেকট্রন জোড় ...',
            '৩.১৬ সমযোজী এর আয়নিক ও আয়নিক এর সমযোজী বৈশিষ্ট্য': '৩.১৬ সমযোজী এর আয়নুিক ...',
            '৪.১ রাসায়নিক বিক্রিয়া ও গ্রিন কেমিস্ট্রি': '৪.১ রাসায়নিক বিক্রিয়া ও গ্রি...',
            '৪.৪ সাম্যাবস্থা ও সাম্যাবস্থা এর গতিশীলতা': '৪.৪ সাম্যাবস্থা ও সাম্যাবস্থা এ...',
            '৪.৫ লা শাতেলিয় নীতি ও শিল্প উৎপাদন': '৪.৫ লা শাতেলিয় নীতি ও শি...',
            '৪.৭ সাম্য ধ্রুবক ও Kc,Kp এর মধ্যে সম্পর্ক': '৪.৭ সাম্য ধ্রুবক ও Kc,Kp এর ম...',
            '৪.৯ অ্যাসিড ও ক্ষার বিয়োজন ধ্রুবক (Ka,Kb)': '৪.৯ অ্যাসিড ও ক্ষার বিয়োজ...',
            '৪.১১ অ্যাসিড ক্ষার তীব্রতা ও বিয়োজন ধ্রুবক': '৪.১১ অ্যাসিড ক্ষার তীব্রতা ও বিয়োজ...',
            '৪.১৪ মানুষের রক্ত, কৃষি, রসায়ন শিল্প, ঔষধ সেবনে pH scale': '৪.১৪ মানুষের রক্ত, কৃষি, রসায়ন শি...',
            '৪.১৮ তীব্র অ্যাসিড ও তীব্র ক্ষার প্রশমন তাপ': '৪.১৮ তীব্র অ্যাসিড ও তীব্র ক্ষার প্রশ...',
            '৫.২ অনুমোদিত প্রিজারভেটিভস এর খাদ্য সংরক্ষণ': '৫.২ অনুমোদিত প্রিজারভেটিভস এ...',
            '৫.৪ দেশী ফলের, মাছ মাংস, টমেটো কৌটাজাতকরণ': '৫.৪ দেশী ফলের, মাছ মাংস, টমে...',
            '৫.৮ গ্লাস ক্লিনার, টয়লেট ক্লিনার প্রস্তুতি এবং ব্যবহার': '৫.৮ গ্লাস ক্লিনার, টয়লেট ক্লিনার প্রস্ত...',
            '৫.১১ ভিনেগার এর খাদ্য সংরক্ষণ কৌশল': '৫.১১ ভিনেগার এর খাদ্য সংরক্ষ...',
            '৫.১২ খাদ্যদ্রব্য সংরক্ষণে ভিনেগার এর গুরুত্ব': '৫.১২ খাদ্যদ্রব্য সংরক্ষণে ভিনেগার এ...',

            // Chemistry 2nd Paper
            '১.৪ বয়েল, চার্লস ও avogadro এর সূত্র': '১.৪ বয়েল, চার্লস ও avogadro এ...',
            '১.৫ বয়েল চার্লস এর সমন্বয় সূত্র, আদর্শ গ্যাস সূত্র': '১.৫ বয়েল চার্লস এর সমন্বয় সূ...',
            '১.৬ গ্যাস এর আংশিক চাপ ও ডাল্টন এর সূত্র': '১.৬ গ্যাস এর আংশিক চাপ ও ডাল্ট...',
            '১.৭ গ্রাহাম এর সূত্র : গ্যাস এর ব্যাপন ও অনু ব্যাপন': '১.৭ গ্রাহাম এর সূত্র : গ্যাস এর ব্যাপ...',
            '১.৮ গ্যাস এর আণবিক গতিতত্ত্ব: বর্গমূল গড় বর্গ বেগ ও অন্যান্য গতিবেগ': '১.৮ গ্যাস এর আণবিক গতিত...',
            '১.১০ আমাগা লেখচিত্র ও সংকোচনশীলতা গুণাংক': '১.১০ আমাগা লেখচিত্র ...',
            '১.১২ গ্যাস সিলিন্ডার করণে গ্যাস সূত্রের প্রয়োগ': '১.১২ গ্যাস সিলিন্ডার করণে গ্যা...',
            '১.১৩ বজ্রপাত এ বায়ুমণ্ডল ও মাটিতে N ফিক্সেশন': '১.১৩ বজ্রপাত এ বায়ুমণ্ডল ও মাটি...',
            '১.১৪ শিল্পের গ্যাসীয় বর্জ্য ও গ্রিন হাউস ইফেক্ট': '১.১৪ শিল্পের গ্যাসীয় বর্জ্য ও গ্রি...',
            '১.১৫ CFC গ্যাস ও ওজন স্তর, এসিড বৃষ্টি ও প্রতিকার': '১.১৫ CFC গ্যাস ও ওজন স্ত...',
            '১.১৬ আরহেনিয়াস সমীকরণ, ব্রনস্টেড- লাউরি তত্ত্ব': '১.১৬ আরহেনিয়াস সমীকরণের...',
            '১.১৮ মিঠা পানি, পানি দূষণ, পানির বিশুদ্ধতার মানদণ্ড': '১.১৮ মিঠা পানি, পানি দূষণ,পানি...',
            '২.১ জৈব যৌগ, অজৈব যৌগ, কার্বন এর sp,sp 2, sp 3 সংকরায়ণ': '২.১ জৈব যৌগ, অজৈব যৌগ, কার্ব...',
            '২.২ কার্যকরী মূলক , কার্যকরী মূলকের ভিত্তিতে জৈবযৌগের শ্রেণিকরণ': '২.২ কার্যকরী মূলক , কার্যকরী মূলকে...',
            '২.৪ সমানুকরণ : জ্যামিতিক ও আলোক সমানুতা': '২.৪ সমানুকরণ : জ্যামিতিক ...',
            '২.৫ বন্ধন বিভাজন, বিকারক, অ্যালিফেটিক হাইড্রোকার্বন, অ্যালকেন, অ্যালকিন, অ্যালকাইন': '২.৫ বন্ধন বিভাজন, বিকার...',
            '২.৬ aromaticity ও হাকেল তত্ত্ব, বেনজিন': '২.৬ aromaticity ও হাকেল ত...',
            '২.৭ বেনজিন চক্রে প্রতিস্থাপক এর প্রভাব(inductive, মেসোমেরিক, অর্থ, প্যারা , মেটা নির্দেশক)': '২.৭ বেনজিন চক্রে প্রতিস্থাপক এ...',
            '২.৯ alkyl halide+ SN1,SN 2, E 1, E 2': '২.৯ alkyl halide+ SN1,SN 2, E ...',
            '২.১০ হ্যালোফরম ,অ্যালকোহল, গ্লিসারিন, ফেনল, এস্টার': '২.১০ হ্যালোফরম ,অ্যালকোহ...',
            '২.১১ ইথার, কার্বনিল যৌগ: অ্যালডিহাইড, কিটোন': '২.১১ ইথার, কার্বনিল যৌ...',
            '২.১৪ nitro গ্লিসারিন, TNT, ডেটোল, প্যারাসিটামল': '২.১৪ nitro গ্লিসারিন, TNT, ডেট...',
            '৩.১ রাসায়নিক গণনা ও গ্যাসের মোলার আয়তন': '৩.১ রাসায়নিক গণনা ও গ্যাসে...',
            '৩.২ রাসায়নিক সমীকরণ থেকে উৎপাদ গ্যাস এর আয়তন নির্ণয়': '৩.২ রাসায়নিক সমীকরণ থেকে উৎপ...',
            '৩.৩ বিক্রিয়ক এর ভর থেকে উৎপাদ গ্যাসের ভর ও আয়তন নির্ণয়': '৩.৩ বিক্রিয়ক এর ভর থেকে উৎপা...',
            '৩.৪ মোলার ঘনমাত্রা বা মোলারিটি ( একক এর পরিবর্তন)': '৩.৪ মোলার ঘনমাত্রা বা মোলারি...',
            '৩.৫ অ্যাসিড ক্ষার প্রশমন বিক্রিয়া ও প্রশমন বিন্দু': '৩.৫ অ্যাসিড ক্ষার প্রশমন বিক্রিয়া ...',
            '৩.৭ জারণ সংখ্যা , জারণ ক্ষমতা , জারণ বিজারণ অর্ধ বিক্রিয়া , আয়ন সহগোর সাহায্যে রাসায়নিক সমতা': '৩.৭ জারণ সংখ্যা , জারণ ক্ষমতা ...',
            '৪.৬ তড়িৎ দার বিভব এবং ধাতুর সক্রিয়তা সিরিজ': '৪.৬ তড়িৎ দার বিভব এবং ধাতু...',
            '৪.৭ redox বিক্রিয়া, কোষ বিভব ও প্রমাণ কোষ বিভব': '৪.৭ redox বিক্রিয়া, কোষ বিভব ...',
            '৪.৮ তড়িৎ দার ও কোষের বিভব সংক্রান্ত nernst ইকুয়েশন': '৪.৮ তড়িৎ দার ও কোষের বিভ...',
            '৪.১০ এক ও দুই প্রকোষ্ঠ বিশিষ্ট তড়িৎ কোষ': '৪.১০ এক ও দুই প্রকোষ্ঠ বিশিষ্ট তড়ি...',
            '৪.১২ লেড স্টোরেজ ও লিথিয়াম ব্যাটারি': '৪.১২ লেড স্টোরেজ ও লিথিয়া...',
            '৫.৩ জ্বালানি সম্পদের এর প্রেক্ষিতে বাংলাদেশ শিল্পায়ন': '৫.৩ জ্বালানি সম্পদের এর প্রেক্ষি...',
            '৫.৪ বাংলাদেশে উল্লেখযোগ্য রসায়ন শিল্প পরিচিতি': '৫.৪ বাংলাদেশে উল্লেখযোগ্য রসায়...',
            '৫.৫ ইউরিয়া, কাঁচ, সিরামিক, pulp পেপার সিমেন্ট উৎপাদন': '৫.৫ ইউরিয়া, কাঁচ, সিরামিক, pul...',
            '৫.৭ সিমেন্ট,ইউরিয়া,চামড়া, টেক্সটাইল ও ডাইং শিল্পের দূষক': '৫.৭ সিমেন্ট,ইউরিয়া,চামড়া, টেক্সটাই...',
            '৫.৯ আয়রন,অ্যালুমিনিয়াম, কপার, কাঁচ, গ্লাস এর রিসাইক্লিং প্রণালী': '৫.৯ আয়রন,অ্যালুমিনিয়াম, কপা...'
        };

        let totalQUpdated = 0;
        let totalMUpdated = 0;

        // Iterate through mapping and perform updates
        for (const [fullName, truncatedName] of Object.entries(reverseMapping)) {
            // Update Question Bank (Find by Full Name, Set to Truncated)
            const qRes = await QuestionBank.updateMany(
                { topic: fullName }, 
                { $set: { topic: truncatedName } }
            );
            totalQUpdated += qRes.modifiedCount;

            // Update Mistakes
            const mRes = await Mistake.updateMany(
                { topic: fullName },
                { $set: { topic: truncatedName } }
            );
            totalMUpdated += mRes.modifiedCount;
        }

        return res.json({
            success: true,
            totalTopicsProcessed: Object.keys(reverseMapping).length,
            questionsUpdated: totalQUpdated,
            mistakesUpdated: totalMUpdated
        });

    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
