
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
  users: [
    // Titan (100k+)
    { uid: 'titan1', displayName: 'Ayman Sadiq', photoURL: 'https://api.dicebear.com/7.x/avataaars/svg?seed=King', points: 150000, college: 'IBA', target: 'Business', role: 'student' },
    { uid: 'titan2', displayName: 'Dr. Strange', photoURL: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Wizard', points: 110000, college: 'Kamar-Taj', target: 'Medical', role: 'student' },
    
    // Grandmaster (50k+)
    { uid: 'gm1', displayName: 'Tahmid Khan', photoURL: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix', points: 85000, college: 'NDC', target: 'Engineering', role: 'student' },
    { uid: 'gm2', displayName: 'Sadia Islam', photoURL: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sadia', points: 62000, college: 'Viqarunnisa', target: 'Medical', role: 'student' },
    
    // Master (25k+)
    { uid: 'm1', displayName: 'Rafiqul Islam', photoURL: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Jack', points: 45000, college: 'Dhaka College', target: 'Varsity', role: 'student' },
    { uid: 'm2', displayName: 'Karim Benzema', photoURL: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Karim', points: 32000, college: 'Rajuk', target: 'Engineering', role: 'student' },
    
    // Elite (10k+)
    { uid: 'e1', displayName: 'Sarah Ahmed', photoURL: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Aneka', points: 18000, college: 'Holy Cross', target: 'Medical', role: 'student' },
    { uid: 'e2', displayName: 'John Doe', photoURL: 'https://api.dicebear.com/7.x/avataaars/svg?seed=John', points: 12500, college: 'Residential', target: 'Varsity', role: 'student' },
    
    // Scholar (4k+)
    { uid: 's1', displayName: 'Abir Hasan', photoURL: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Abir', points: 7500, college: 'City College', target: 'Engineering', role: 'student' },
    { uid: 's2', displayName: 'Mitu Roy', photoURL: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Mitu', points: 5200, college: 'Eden College', target: 'Medical', role: 'student' },
    
    // Apprentice (1k+)
    { uid: 'a2', displayName: 'Newbie User', photoURL: 'https://api.dicebear.com/7.x/avataaars/svg?seed=New', points: 1200, college: 'Unknown', target: 'Medical', role: 'student' },
    
    // Novice (<1k)
    { uid: 'n1', displayName: 'Guest User', photoURL: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Guest', points: 450, college: 'Unknown', target: 'Varsity', role: 'student' }
  ],
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
  res.send(`🚀 Shikkha Shohayok API Running! Mode: ${isDbConnected() ? 'MongoDB' : 'Memory'}`);
});

// Quest Helper
const getQuestsFromPool = async (category, count) => {
    // Simplified logic
    return [];
};

// ... (Other routes remain same, except Leaderboard) ...

// --- LEADERBOARD ROUTE UPDATED ---
app.get('/api/leaderboard', async (req, res) => {
    try {
        if(isDbConnected()) {
            const users = await User.find().sort({ points: -1 }).limit(50).select('uid displayName photoURL points college hscBatch target department');
            // FIX: If DB is empty, return memory users for testing frames
            if (users.length === 0) {
                 return res.json(memoryDb.users.sort((a,b) => b.points - a.points).slice(0, 50));
            }
            res.json(users);
        } else {
            res.json(memoryDb.users.sort((a,b) => b.points - a.points).slice(0, 50));
        }
    } catch(e) { res.status(500).json({error: e.message}); }
});

// ... (Rest of existing routes) ...
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

app.post('/api/users/sync', async (req, res) => {
  try {
    const { uid, email, displayName, photoURL, college, hscBatch, department, target } = req.body;
    const updateData = { uid, email, displayName, photoURL, lastLogin: Date.now(), college, hscBatch, department, target };
    Object.keys(updateData).forEach(key => updateData[key] === undefined && delete updateData[key]);

    if (isDbConnected()) {
      let user = await User.findOneAndUpdate({ uid }, updateData, { upsert: true, new: true });
      return res.json(user);
    } else {
      let user = memoryDb.users.find(u => u.uid === uid);
      if (!user) { user = { ...updateData, points: 0, stats: { totalCorrect:0 } }; memoryDb.users.push(user); } 
      else { Object.assign(user, updateData); }
      return res.json(user);
    }
  } catch (e) { res.status(500).json({error: 'Sync failed'}); }
});

app.post('/api/quests/update', async (req, res) => {
    res.json({ success: true });
});

app.post('/api/quests/claim', async (req, res) => {
    res.json({ success: true, points: 100 });
});

app.get('/api/admin/stats', async (req, res) => {
  res.json({ totalUsers: memoryDb.users.length, totalRevenue: 0 });
});

app.get('/api/admin/payments', async (req, res) => {
    res.json(memoryDb.payments);
});

app.post('/api/payments', async (req, res) => {
    memoryDb.payments.push({ ...req.body, status: 'PENDING', id: Date.now().toString() });
    res.json({ success: true });
});

app.put('/api/admin/payments/:id', async (req, res) => {
    const p = memoryDb.payments.find(x => x.id === req.params.id);
    if(p) p.status = req.body.status;
    res.json({ success: true });
});

app.delete('/api/admin/payments/:id', async (req, res) => {
    memoryDb.payments = memoryDb.payments.filter(x => x.id !== req.params.id);
    res.json({ success: true });
});

app.get('/api/notifications', async (req, res) => {
    res.json(memoryDb.notifications);
});

app.post('/api/admin/notifications', async (req, res) => {
    memoryDb.notifications.unshift({ ...req.body, _id: Date.now().toString() });
    res.json({ success: true });
});

app.get('/api/exam-packs', async (req, res) => {
    res.json(memoryDb.examPacks);
});

app.get('/api/users/:userId/enrollments', async (req, res) => {
    res.json([]);
});

app.get('/api/users/:userId/stats', async (req, res) => {
    res.json({ points: 0 });
});

app.post('/api/users/:userId/exam-results', async (req, res) => {
    res.json({ success: true });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
