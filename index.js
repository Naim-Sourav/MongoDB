
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
  groups: [], // NEW: Store groups here
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

// --- NEW GROUP SCHEMA ---
const studyGroupSchema = new mongoose.Schema({
  joinCode: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  hostId: { type: String, required: true },
  targetHours: { type: Number, default: 6 },
  allowedSubjects: [String],
  createdAt: { type: Number, default: Date.now },
  members: [{
    uid: String,
    displayName: String,
    photoURL: String,
    isStudying: { type: Boolean, default: false },
    currentSubject: String,
    startTime: Number, // Timestamp when they hit 'Start'
    totalStudyTimeToday: { type: Number, default: 0 }, // Seconds
    lastActive: { type: Number, default: Date.now }
  }]
});
const StudyGroup = mongoose.model('StudyGroup', studyGroupSchema);
// ------------------------

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
  topicStats: [{
    topic: String,
    correct: Number,
    total: Number
  }],
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

// --- NEW GROUP ROUTES ---

app.post('/api/groups/create', async (req, res) => {
  try {
    const { name, hostId, targetHours, allowedSubjects, hostName, hostAvatar } = req.body;
    const joinCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    const newGroup = {
      joinCode,
      name,
      hostId,
      targetHours,
      allowedSubjects,
      createdAt: Date.now(),
      members: [{
        uid: hostId,
        displayName: hostName,
        photoURL: hostAvatar,
        isStudying: false,
        totalStudyTimeToday: 0,
        lastActive: Date.now()
      }]
    };

    if (isDbConnected()) {
      const group = new StudyGroup(newGroup);
      await group.save();
      return res.json(group);
    } else {
      newGroup._id = Date.now().toString();
      memoryDb.groups.push(newGroup);
      return res.json(newGroup);
    }
  } catch (e) {
    res.status(500).json({ error: 'Group creation failed' });
  }
});

app.post('/api/groups/join', async (req, res) => {
  try {
    const { joinCode, userId, userName, userAvatar } = req.body;
    
    if (isDbConnected()) {
      const group = await StudyGroup.findOne({ joinCode });
      if (!group) return res.status(404).json({ error: 'Group not found' });
      
      const exists = group.members.find(m => m.uid === userId);
      if (!exists) {
        group.members.push({
          uid: userId,
          displayName: userName,
          photoURL: userAvatar,
          isStudying: false,
          totalStudyTimeToday: 0,
          lastActive: Date.now()
        });
        await group.save();
      }
      return res.json({ success: true, groupId: group._id });
    } else {
      const group = memoryDb.groups.find(g => g.joinCode === joinCode);
      if (!group) return res.status(404).json({ error: 'Group not found' });
      const exists = group.members.find(m => m.uid === userId);
      if (!exists) {
        group.members.push({
          uid: userId,
          displayName: userName,
          photoURL: userAvatar,
          isStudying: false,
          totalStudyTimeToday: 0,
          lastActive: Date.now()
        });
      }
      return res.json({ success: true, groupId: group._id });
    }
  } catch (e) {
    res.status(500).json({ error: 'Failed to join group' });
  }
});

app.get('/api/groups/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    if (isDbConnected()) {
      const groups = await StudyGroup.find({ "members.uid": userId });
      return res.json(groups);
    } else {
      const groups = memoryDb.groups.filter(g => g.members.some(m => m.uid === userId));
      return res.json(groups);
    }
  } catch (e) { res.status(500).json({ error: 'Failed to fetch groups' }); }
});

app.get('/api/groups/:groupId', async (req, res) => {
  try {
    const { groupId } = req.params;
    if (isDbConnected()) {
      const group = await StudyGroup.findById(groupId);
      return res.json(group);
    } else {
      const group = memoryDb.groups.find(g => g._id === groupId);
      return res.json(group);
    }
  } catch (e) { res.status(500).json({ error: 'Failed to fetch group' }); }
});

app.post('/api/groups/:groupId/status', async (req, res) => {
  try {
    const { groupId } = req.params;
    const { userId, isStudying, subject, elapsedIncrease } = req.body; // elapsedIncrease: seconds to add
    
    if (isDbConnected()) {
      const group = await StudyGroup.findById(groupId);
      if (!group) return res.status(404).json({ error: 'Group not found' });
      
      const member = group.members.find(m => m.uid === userId);
      if (member) {
        member.isStudying = isStudying;
        member.currentSubject = isStudying ? subject : undefined;
        member.lastActive = Date.now();
        if (isStudying) {
            // If just started, set startTime
            if (!member.startTime && !member.isStudying) member.startTime = Date.now();
        } else {
            member.startTime = undefined;
        }
        
        if (elapsedIncrease) {
            member.totalStudyTimeToday = (member.totalStudyTimeToday || 0) + elapsedIncrease;
        }
        
        await group.save();
      }
      return res.json({ success: true });
    } else {
      const group = memoryDb.groups.find(g => g._id === groupId);
      if (!group) return res.status(404).json({ error: 'Group not found' });
      const member = group.members.find(m => m.uid === userId);
      if (member) {
        member.isStudying = isStudying;
        member.currentSubject = isStudying ? subject : undefined;
        member.lastActive = Date.now();
        if (elapsedIncrease) {
            member.totalStudyTimeToday = (member.totalStudyTimeToday || 0) + elapsedIncrease;
        }
      }
      return res.json({ success: true });
    }
  } catch (e) { res.status(500).json({ error: 'Update status failed' }); }
});

// ------------------------

// ... (Existing routes from previous file - User, Payment, Notifications, etc.)
// Re-implementing necessary routes for full context

app.post('/api/users/sync', async (req, res) => {
  try {
    const { uid, email, displayName, photoURL, college, hscBatch, department, target } = req.body;
    const updateData = { 
        uid, email, displayName, photoURL, lastLogin: Date.now(),
        college, hscBatch, department, target 
    };
    
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

        let subjectBreakdown = [];
        let topicBreakdown = [];

        const subjStatsObj = user.stats?.subjectStats instanceof Map 
            ? Object.fromEntries(user.stats.subjectStats) 
            : (user.stats?.subjectStats || {});
            
        const topicStatsObj = user.stats?.topicStats instanceof Map 
            ? Object.fromEntries(user.stats.topicStats) 
            : (user.stats?.topicStats || {});

        subjectBreakdown = Object.keys(subjStatsObj).map(s => ({
            subject: s,
            accuracy: (subjStatsObj[s].correct / subjStatsObj[s].total) * 100
        })).sort((a,b) => b.accuracy - a.accuracy);

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

// ... (Rest of existing routes for Exams, Questions, Admin, etc.) ...
// Keeping them concise for file update, assuming they persist

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
            }
        }
        res.json({ success: true });
    } catch (e) { 
        console.error(e);
        res.status(500).json({ error: 'Failed' }); 
    }
});

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

app.get('/api/exam-packs', async (req, res) => {
    try {
        if (isDbConnected()) {
            const packs = await ExamPack.find();
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

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
