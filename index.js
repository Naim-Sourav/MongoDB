
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
  groups: [],
  groupMessages: [],
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
    mode: String,
    questionCount: Number,
    timePerQuestion: Number
  },
  players: [{
    uid: String,
    name: String,
    avatar: String,
    score: { type: Number, default: 0 },
    team: { type: String, default: 'NONE' }
  }]
});
const Battle = mongoose.model('Battle', battleSchema);

const questionSchema = new mongoose.Schema({
  question: String,
  options: [String],
  correctAnswerIndex: Number,
  explanation: String,
  subject: String,
  chapter: String,
  topic: String,
  difficulty: String,
  createdAt: { type: Number, default: Date.now }
});
const Question = mongoose.model('Question', questionSchema);

const savedQuestionSchema = new mongoose.Schema({
  userId: String,
  questionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Question' },
  savedAt: { type: Number, default: Date.now }
});
const SavedQuestion = mongoose.model('SavedQuestion', savedQuestionSchema);

const mistakeSchema = new mongoose.Schema({
  userId: String,
  question: String,
  options: [String],
  correctAnswerIndex: Number,
  explanation: String,
  subject: String,
  chapter: String,
  topic: String,
  wrongCount: { type: Number, default: 1 },
  lastWrongAt: { type: Number, default: Date.now }
});
const Mistake = mongoose.model('Mistake', mistakeSchema);

const examResultSchema = new mongoose.Schema({
  userId: String,
  subject: String,
  score: Number,
  totalQuestions: Number,
  correct: Number,
  wrong: Number,
  skipped: Number,
  date: { type: Number, default: Date.now }
});
const ExamResult = mongoose.model('ExamResult', examResultSchema);

const groupSchema = new mongoose.Schema({
  name: { type: String, required: true },
  subject: String,
  description: String,
  createdBy: String,
  members: [{ uid: String, name: String, avatar: String }],
  memberCount: { type: Number, default: 1 },
  createdAt: { type: Number, default: Date.now }
});
const Group = mongoose.model('Group', groupSchema);

const groupMessageSchema = new mongoose.Schema({
  groupId: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', required: true },
  userId: String,
  userName: String,
  userAvatar: String,
  text: String,
  timestamp: { type: Number, default: Date.now }
});
const GroupMessage = mongoose.model('GroupMessage', groupMessageSchema);

// --- ROUTES ---

// 1. User Routes
app.post('/api/users/sync', async (req, res) => {
  const userData = req.body;
  
  if (isDbConnected()) {
    try {
      const user = await User.findOneAndUpdate(
        { uid: userData.uid },
        { 
          $set: userData, 
          $setOnInsert: { createdAt: Date.now(), points: 0 } 
        },
        { upsert: true, new: true }
      );
      return res.json(user);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  } else {
    // Memory fallback
    let user = memoryDb.users.find(u => u.uid === userData.uid);
    if (user) {
      Object.assign(user, userData);
    } else {
      user = { ...userData, points: 0, createdAt: Date.now() };
      memoryDb.users.push(user);
    }
    return res.json(user);
  }
});

app.get('/api/users/:uid/stats', async (req, res) => {
  const { uid } = req.params;
  
  if (isDbConnected()) {
    try {
      const user = await User.findOne({ uid });
      if (!user) return res.status(404).json({ error: "User not found" });
      
      const results = await ExamResult.find({ userId: uid }).sort({ date: -1 });
      
      // Calculate weak/strong areas
      // This is a simplified calculation for demo
      return res.json({ 
        user,
        points: user.points,
        totalExams: user.totalExams,
        totalCorrect: user.stats.totalCorrect,
        totalWrong: user.stats.totalWrong
      });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  } else {
    const user = memoryDb.users.find(u => u.uid === uid) || { points: 0, totalExams: 0, stats: { totalCorrect: 0, totalWrong: 0 }};
    return res.json(user);
  }
});

// 2. Groups Routes
app.get('/api/groups', async (req, res) => {
  if (isDbConnected()) {
    try {
      const groups = await Group.find().sort({ createdAt: -1 });
      res.json(groups);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  } else {
    res.json(memoryDb.groups);
  }
});

app.post('/api/groups', async (req, res) => {
  const { name, subject, description, createdBy, creatorName, creatorAvatar } = req.body;
  if (isDbConnected()) {
    try {
      const group = new Group({
        name, subject, description, createdBy,
        members: [{ uid: createdBy, name: creatorName, avatar: creatorAvatar }],
        memberCount: 1
      });
      await group.save();
      res.json(group);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  } else {
    const group = {
      _id: Date.now().toString(),
      name, subject, description, createdBy,
      members: [{ uid: createdBy, name: creatorName, avatar: creatorAvatar }],
      memberCount: 1,
      createdAt: Date.now()
    };
    memoryDb.groups.push(group);
    res.json(group);
  }
});

app.post('/api/groups/:id/join', async (req, res) => {
  const { uid, name, avatar } = req.body;
  const groupId = req.params.id;

  if (isDbConnected()) {
    try {
      const group = await Group.findById(groupId);
      if (!group) return res.status(404).json({ error: 'Group not found' });
      
      const isMember = group.members.some(m => m.uid === uid);
      if (!isMember) {
        group.members.push({ uid, name, avatar });
        group.memberCount += 1;
        await group.save();
      }
      res.json(group);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  } else {
    const group = memoryDb.groups.find(g => g._id === groupId);
    if (!group) return res.status(404).json({ error: 'Group not found' });
    const isMember = group.members.some(m => m.uid === uid);
    if (!isMember) {
      group.members.push({ uid, name, avatar });
      group.memberCount += 1;
    }
    res.json(group);
  }
});

app.get('/api/groups/:id/messages', async (req, res) => {
  const groupId = req.params.id;
  if (isDbConnected()) {
    try {
      const messages = await GroupMessage.find({ groupId }).sort({ timestamp: 1 }).limit(100);
      res.json(messages);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  } else {
    const messages = memoryDb.groupMessages.filter(m => m.groupId === groupId).sort((a, b) => a.timestamp - b.timestamp);
    res.json(messages);
  }
});

app.post('/api/groups/:id/message', async (req, res) => {
  const { userId, userName, userAvatar, text } = req.body;
  const groupId = req.params.id;

  if (isDbConnected()) {
    try {
      const msg = new GroupMessage({ groupId, userId, userName, userAvatar, text });
      await msg.save();
      res.json(msg);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  } else {
    const msg = {
      _id: Date.now().toString(),
      groupId, userId, userName, userAvatar, text,
      timestamp: Date.now()
    };
    memoryDb.groupMessages.push(msg);
    res.json(msg);
  }
});

// 3. Payment Routes
app.get('/api/admin/payments', async (req, res) => {
  if (isDbConnected()) {
    const payments = await Payment.find().sort({ timestamp: -1 });
    res.json(payments);
  } else {
    res.json(memoryDb.payments);
  }
});

app.post('/api/payments', async (req, res) => {
  const paymentData = req.body;
  if (isDbConnected()) {
    try {
      const payment = new Payment(paymentData);
      await payment.save();
      res.json(payment);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  } else {
    const payment = { ...paymentData, _id: Date.now().toString(), status: 'PENDING', timestamp: Date.now() };
    memoryDb.payments.push(payment);
    res.json(payment);
  }
});

app.put('/api/admin/payments/:id', async (req, res) => {
  const { status } = req.body;
  if (isDbConnected()) {
    await Payment.findByIdAndUpdate(req.params.id, { status });
    res.json({ success: true });
  } else {
    const p = memoryDb.payments.find(p => p._id === req.params.id);
    if (p) p.status = status;
    res.json({ success: true });
  }
});

// 4. Notifications
app.get('/api/notifications', async (req, res) => {
  if (isDbConnected()) {
    const notifs = await Notification.find().sort({ date: -1 }).limit(20);
    res.json(notifs);
  } else {
    res.json(memoryDb.notifications);
  }
});

app.post('/api/admin/notifications', async (req, res) => {
  const notifData = req.body;
  if (isDbConnected()) {
    const n = new Notification(notifData);
    await n.save();
    res.json(n);
  } else {
    const n = { ...notifData, _id: Date.now().toString(), date: Date.now() };
    memoryDb.notifications.unshift(n);
    res.json(n);
  }
});

// 5. Exam Packs
app.get('/api/exam-packs', (req, res) => {
  res.json(memoryDb.examPacks);
});

// 6. User Enrollments (Simple check based on approved payments)
app.get('/api/users/:userId/enrollments', async (req, res) => {
  const { userId } = req.params;
  // Logic: Find approved payments for this user
  let approved = [];
  if (isDbConnected()) {
    approved = await Payment.find({ userId, status: 'APPROVED' });
  } else {
    approved = memoryDb.payments.filter(p => p.userId === userId && p.status === 'APPROVED');
  }
  
  const enrollments = approved.map(p => ({
    id: p.courseId,
    title: p.courseTitle,
    progress: Math.floor(Math.random() * 100) // Mock progress
  }));
  res.json(enrollments);
});

// 7. Battle Routes (Simplified)
app.post('/api/battles/create', async (req, res) => {
  // Logic to create room
  const { userId, userName, avatar, config } = req.body;
  const roomId = Math.floor(100000 + Math.random() * 900000).toString();
  
  const battleData = {
    roomId,
    hostId: userId,
    config,
    players: [{ uid: userId, name: userName, avatar, score: 0 }],
    status: 'WAITING',
    createdAt: Date.now()
  };

  if (isDbConnected()) {
    const battle = new Battle(battleData);
    await battle.save();
  } else {
    memoryDb.battles.push(battleData);
  }
  res.json({ roomId });
});

app.post('/api/battles/join', async (req, res) => {
  const { roomId, userId, userName, avatar } = req.body;
  if (isDbConnected()) {
    const battle = await Battle.findOne({ roomId });
    if (battle && battle.status === 'WAITING') {
      battle.players.push({ uid: userId, name: userName, avatar, score: 0 });
      await battle.save();
      res.json({ success: true });
    } else {
      res.status(404).json({ error: "Room not found or started" });
    }
  } else {
    const battle = memoryDb.battles.find(b => b.roomId === roomId);
    if (battle && battle.status === 'WAITING') {
      battle.players.push({ uid: userId, name: userName, avatar, score: 0 });
      res.json({ success: true });
    } else {
      res.status(404).json({ error: "Room not found" });
    }
  }
});

app.get('/api/battles/:roomId', async (req, res) => {
  const { roomId } = req.params;
  if (isDbConnected()) {
    const battle = await Battle.findOne({ roomId });
    res.json(battle || null);
  } else {
    const battle = memoryDb.battles.find(b => b.roomId === roomId);
    res.json(battle || null);
  }
});

// Admin Stats
app.get('/api/admin/stats', async (req, res) => {
  let stats = {
    totalRevenue: 0,
    approvedEnrollments: 0,
    pendingPayments: 0,
    totalUsers: 0,
    totalQuestions: 0,
    totalExams: 0
  };

  if (isDbConnected()) {
    const payments = await Payment.find();
    stats.totalRevenue = payments.filter(p => p.status === 'APPROVED').reduce((sum, p) => sum + (p.amount || 0), 0);
    stats.approvedEnrollments = payments.filter(p => p.status === 'APPROVED').length;
    stats.pendingPayments = payments.filter(p => p.status === 'PENDING').length;
    stats.totalUsers = await User.countDocuments();
    stats.totalQuestions = await Question.countDocuments();
    stats.totalExams = await ExamResult.countDocuments();
  } else {
    stats.totalRevenue = memoryDb.payments.filter(p => p.status === 'APPROVED').reduce((sum, p) => sum + (p.amount || 0), 0);
    stats.approvedEnrollments = memoryDb.payments.filter(p => p.status === 'APPROVED').length;
    stats.pendingPayments = memoryDb.payments.filter(p => p.status === 'PENDING').length;
    stats.totalUsers = memoryDb.users.length;
    stats.totalQuestions = memoryDb.questions.length;
    stats.totalExams = memoryDb.examResults.length;
  }
  
  res.json(stats);
});

// Question Bank Routes
app.post('/api/admin/questions/bulk', async (req, res) => {
  const { questions } = req.body;
  if (isDbConnected()) {
    await Question.insertMany(questions);
    res.json({ success: true });
  } else {
    questions.forEach(q => memoryDb.questions.push({ ...q, _id: Date.now().toString() }));
    res.json({ success: true });
  }
});

app.get('/api/admin/questions', async (req, res) => {
  const { page = 1, limit = 10, subject, chapter } = req.query;
  const query = {};
  if (subject) query.subject = subject;
  if (chapter) query.chapter = chapter;

  if (isDbConnected()) {
    const questions = await Question.find(query)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });
    const total = await Question.countDocuments(query);
    res.json({ questions, total });
  } else {
    let filtered = memoryDb.questions;
    if (subject) filtered = filtered.filter(q => q.subject === subject);
    if (chapter) filtered = filtered.filter(q => q.chapter === chapter);
    
    const start = (page - 1) * limit;
    const paginated = filtered.slice(start, start + parseInt(limit));
    res.json({ questions: paginated, total: filtered.length });
  }
});

app.delete('/api/admin/questions/:id', async (req, res) => {
  if (isDbConnected()) {
    await Question.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } else {
    memoryDb.questions = memoryDb.questions.filter(q => q._id !== req.params.id);
    res.json({ success: true });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
