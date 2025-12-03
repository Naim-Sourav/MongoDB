const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middleware
// Increase limit for bulk uploads to 50mb to handle large batches
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cors());

// --- MongoDB Connection Setup ---
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://<username>:<password>@cluster0.mongodb.net/shikkha-shohayok?retryWrites=true&w=majority';

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
  examResults: [] // New: Store exam results in memory
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
  points: { type: Number, default: 0 }, // Added Points
  totalExams: { type: Number, default: 0 }, // Added Exam Count
  lastLogin: { type: Number, default: Date.now },
  createdAt: { type: Number, default: Date.now }
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
  createdAt: { type: Number, default: Date.now },
  status: { type: String, enum: ['WAITING', 'ACTIVE', 'FINISHED'], default: 'WAITING' },
  startTime: Number, // When status becomes ACTIVE
  questions: Array, // Array of QuizQuestion
  player1: {
    uid: String,
    name: String,
    score: { type: Number, default: 0 },
    avatar: String
  },
  player2: {
    uid: String,
    name: String,
    score: { type: Number, default: 0 },
    avatar: String
  }
});
const Battle = mongoose.model('Battle', battleSchema);

const questionBankSchema = new mongoose.Schema({
  subject: { type: String, required: true },
  chapter: { type: String, required: true },
  topic: String,
  question: { type: String, required: true },
  options: { type: [String], required: true }, // Optimized array definition
  correctAnswerIndex: { type: Number, required: true },
  explanation: String,
  difficulty: { type: String, default: 'MEDIUM' },
  createdAt: { type: Number, default: Date.now }
});

// Compound Index for extremely fast retrieval based on hierarchy
questionBankSchema.index({ subject: 1, chapter: 1, topic: 1 });

const QuestionBank = mongoose.model('QuestionBank', questionBankSchema);

// Saved Question Schema (User Specific)
const savedQuestionSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  questionId: { type: mongoose.Schema.Types.ObjectId, ref: 'QuestionBank' }, // Reference
  savedAt: { type: Number, default: Date.now }
});
savedQuestionSchema.index({ userId: 1 });
const SavedQuestion = mongoose.model('SavedQuestion', savedQuestionSchema);

// Exam Result Schema (For Analytics)
const examResultSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  subject: { type: String, required: true }, // Primary subject
  totalQuestions: Number,
  correct: Number,
  wrong: Number,
  skipped: Number,
  score: Number,
  timestamp: { type: Number, default: Date.now }
});
examResultSchema.index({ userId: 1 });
const ExamResult = mongoose.model('ExamResult', examResultSchema);


// --- BATTLE QUESTION POOL (Static for Prototype) ---
const BATTLE_QUESTIONS = [
  { question: "নিচের কোনটি ভেক্টর রাশি?", options: ["কাজ", "শক্তি", "বেগ", "তাপমাত্রা"], correctAnswerIndex: 2 },
  { question: "পানির রাসায়নিক সংকেত কোনটি?", options: ["HO2", "H2O", "H2O2", "OH"], correctAnswerIndex: 1 },
  { question: "নিউটনের গতির সূত্র কয়টি?", options: ["২টি", "৩টি", "৪টি", "৫টি"], correctAnswerIndex: 1 },
  { question: "DNA এর পূর্ণরূপ কী?", options: ["Deoxyribonucleic Acid", "Dyno Acid", "Dual Acid", "None"], correctAnswerIndex: 0 },
  { question: "কোষের পাওয়ার হাউস কোনটি?", options: ["নিউক্লিয়াস", "মাইটোকন্ড্রিয়া", "প্লাস্টিড", "রাইবোজোম"], correctAnswerIndex: 1 },
  { question: "বাংলাদেশের জাতীয় ফুল কোনটি?", options: ["গোলাপ", "শাপলা", "জবা", "পদ্ম"], correctAnswerIndex: 1 },
  { question: "কম্পিউটারের মস্তিষ্ক কোনটি?", options: ["Mouse", "Keyboard", "CPU", "Monitor"], correctAnswerIndex: 2 },
  { question: "সর্বজনীন দাতা গ্রুপ কোনটি?", options: ["A+", "B+", "AB+", "O-"], correctAnswerIndex: 3 },
  { question: "আলোর বেগ কত (m/s)?", options: ["3x10^6", "3x10^8", "3x10^10", "3x10^5"], correctAnswerIndex: 1 },
  { question: "মানুষের শরীরে ক্রোমোজোম সংখ্যা কত?", options: ["23 জোড়া", "22 জোড়া", "20 জোড়া", "24 জোড়া"], correctAnswerIndex: 0 }
];

const getRandomQuestions = (count) => {
  const shuffled = [...BATTLE_QUESTIONS].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
};

// --- Routes ---

app.get('/', (req, res) => {
  const mode = isDbConnected() ? 'MongoDB (Persistent)' : 'Memory (Temporary)';
  res.send(`🚀 Shikkha Shohayok API Running! Mode: ${mode}`);
});

// --- USER ROUTES ---

app.post('/api/users/sync', async (req, res) => {
  try {
    const { uid, email, displayName, photoURL } = req.body;
    
    if (isDbConnected()) {
      const user = await User.findOneAndUpdate(
        { uid: uid },
        { uid, email, displayName, photoURL, lastLogin: Date.now() },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      return res.json(user);
    } else {
      // Fallback
      let user = memoryDb.users.find(u => u.uid === uid);
      if (user) {
        user = { ...user, email, displayName, photoURL, lastLogin: Date.now() };
        memoryDb.users = memoryDb.users.map(u => u.uid === uid ? user : u);
      } else {
        user = { uid, email, displayName, photoURL, role: 'student', points: 0, totalExams: 0, lastLogin: Date.now(), createdAt: Date.now() };
        memoryDb.users.push(user);
      }
      return res.json(user);
    }
  } catch (error) {
    console.error("User Sync Error:", error);
    res.status(500).json({ error: 'Failed to sync user' });
  }
});

app.get('/api/users/:userId/enrollments', async (req, res) => {
  try {
    const { userId } = req.params;
    let approvedPayments;

    if (isDbConnected()) {
      approvedPayments = await Payment.find({ userId: userId, status: 'APPROVED' });
    } else {
      approvedPayments = memoryDb.payments.filter(p => p.userId === userId && p.status === 'APPROVED');
    }
    
    const enrollments = approvedPayments.map(p => ({
      id: p.courseId,
      title: p.courseTitle,
      progress: 0
    }));

    res.json(enrollments);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch enrollments' });
  }
});

app.get('/api/users/:userId/stats', async (req, res) => {
  try {
    const { userId } = req.params;
    let user, examResults;

    if (isDbConnected()) {
      user = await User.findOne({ uid: userId });
      examResults = await ExamResult.find({ userId });
    } else {
      user = memoryDb.users.find(u => u.uid === userId);
      examResults = memoryDb.examResults.filter(r => r.userId === userId);
    }

    if (!user) return res.status(404).json({ error: 'User not found' });

    // Calculate Aggregates
    let totalCorrect = 0;
    let totalWrong = 0;
    let totalSkipped = 0;
    const subjectStats = {};

    examResults.forEach(r => {
      totalCorrect += r.correct;
      totalWrong += r.wrong;
      totalSkipped += r.skipped;

      if (!subjectStats[r.subject]) {
        subjectStats[r.subject] = { total: 0, correct: 0 };
      }
      subjectStats[r.subject].total += r.totalQuestions;
      subjectStats[r.subject].correct += r.correct;
    });

    // Determine Weakness (Lowest Accuracy)
    const weaknessAnalysis = Object.keys(subjectStats).map(subj => {
      const { total, correct } = subjectStats[subj];
      const accuracy = total > 0 ? (correct / total) * 100 : 0;
      return { subject: subj, accuracy };
    }).sort((a, b) => a.accuracy - b.accuracy);

    const stats = {
      points: user.points || 0,
      totalExams: examResults.length,
      totalCorrect,
      totalWrong,
      totalSkipped,
      weakestSubject: weaknessAnalysis.length > 0 ? weaknessAnalysis[0] : null,
      strongestSubject: weaknessAnalysis.length > 0 ? weaknessAnalysis[weaknessAnalysis.length - 1] : null,
      subjectBreakdown: weaknessAnalysis
    };

    res.json(stats);

  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch user stats' });
  }
});

// --- LEADERBOARD ROUTE ---
app.get('/api/leaderboard', async (req, res) => {
  try {
    const limit = 100; // Top 100 users
    let users;

    if (isDbConnected()) {
      users = await User.find({})
        .sort({ points: -1 })
        .limit(limit)
        .select('uid displayName photoURL points');
    } else {
      users = memoryDb.users
        .sort((a, b) => b.points - a.points)
        .slice(0, limit)
        .map(u => ({ uid: u.uid, displayName: u.displayName, photoURL: u.photoURL, points: u.points }));
    }
    
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

// --- EXAM RESULTS & ANALYTICS ---

app.post('/api/users/:userId/exam-results', async (req, res) => {
  try {
    const { userId } = req.params;
    const { subject, totalQuestions, correct, wrong, skipped, score } = req.body;

    // Points Logic: 10 pts per correct answer + 20 bonus for completing exam
    const pointsEarned = (correct * 10) + 20;

    if (isDbConnected()) {
      // 1. Save Result
      const result = new ExamResult({ userId, subject, totalQuestions, correct, wrong, skipped, score });
      await result.save();

      // 2. Update User Points
      await User.findOneAndUpdate({ uid: userId }, { 
        $inc: { points: pointsEarned, totalExams: 1 } 
      });

      return res.status(201).json({ success: true, pointsEarned });
    } else {
      // Memory Fallback
      memoryDb.examResults.push({ userId, subject, totalQuestions, correct, wrong, skipped, score, timestamp: Date.now() });
      const user = memoryDb.users.find(u => u.uid === userId);
      if (user) {
        user.points = (user.points || 0) + pointsEarned;
        user.totalExams = (user.totalExams || 0) + 1;
      }
      return res.status(201).json({ success: true, pointsEarned });
    }
  } catch (error) {
    console.error("Exam Result Save Error:", error);
    res.status(500).json({ error: 'Failed to save exam result' });
  }
});


// --- SAVED QUESTIONS ROUTES ---

app.post('/api/users/:userId/saved-questions', async (req, res) => {
  try {
    const { userId } = req.params;
    const { questionId } = req.body; // Expecting ObjectId string

    if (isDbConnected()) {
      // Check if already saved
      const existing = await SavedQuestion.findOne({ userId, questionId });

      if (existing) {
        // Toggle: Delete
        await SavedQuestion.deleteOne({ _id: existing._id });
        return res.json({ status: 'removed' });
      } else {
        // Save new
        const newSaved = new SavedQuestion({ userId, questionId });
        await newSaved.save();
        return res.json({ status: 'saved' });
      }
    } else {
      // Memory fallback not fully supported for populate features in this snippet, simplistic version
      return res.json({ status: 'saved' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to toggle saved question' });
  }
});

app.get('/api/users/:userId/saved-questions', async (req, res) => {
  try {
    const { userId } = req.params;
    if (isDbConnected()) {
      const saved = await SavedQuestion.find({ userId })
        .populate('questionId') // Populate full question details
        .sort({ savedAt: -1 });
      res.json(saved);
    } else {
      res.json([]);
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch saved questions' });
  }
});

app.delete('/api/users/:userId/saved-questions/:id', async (req, res) => {
  try {
    if (isDbConnected()) {
      await SavedQuestion.findByIdAndDelete(req.params.id);
    } 
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete saved question' });
  }
});


// --- PAYMENT ROUTES ---

app.post('/api/payments', async (req, res) => {
  try {
    if (isDbConnected()) {
      const newPayment = new Payment(req.body);
      const savedPayment = await newPayment.save();
      return res.status(201).json(savedPayment);
    } else {
      const newPayment = { 
        ...req.body, 
        _id: 'mem_' + Date.now(), 
        status: 'PENDING', 
        timestamp: Date.now() 
      };
      memoryDb.payments.unshift(newPayment);
      return res.status(201).json(newPayment);
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to submit payment', details: error.message });
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
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch payments' });
  }
});

app.put('/api/admin/payments/:id', async (req, res) => {
  try {
    const { status } = req.body;
    
    if (isDbConnected()) {
      const updatedPayment = await Payment.findByIdAndUpdate(req.params.id, { status }, { new: true });
      if (!updatedPayment) return res.status(404).json({ error: 'Payment not found' });
      return res.json(updatedPayment);
    } else {
      const idx = memoryDb.payments.findIndex(p => p._id === req.params.id);
      if (idx === -1) return res.status(404).json({ error: 'Payment not found' });
      memoryDb.payments[idx].status = status;
      return res.json(memoryDb.payments[idx]);
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to update payment' });
  }
});

app.delete('/api/admin/payments/:id', async (req, res) => {
  try {
    if (isDbConnected()) {
      await Payment.findByIdAndDelete(req.params.id);
    } else {
      memoryDb.payments = memoryDb.payments.filter(p => p._id !== req.params.id);
    }
    res.json({ message: 'Payment deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete payment' });
  }
});

// --- QUESTION BANK ROUTES ---

app.post('/api/admin/questions/bulk', async (req, res) => {
  try {
    const { questions } = req.body; // Array of questions
    if (!Array.isArray(questions)) return res.status(400).json({ error: 'Invalid data format: Expected array of questions' });

    console.log(`Received bulk upload request for ${questions.length} questions.`);

    if (isDbConnected()) {
      // Use bulkWrite with upsert to prevent duplicates based on question text
      const operations = questions.map(q => ({
        updateOne: {
          filter: { question: q.question, subject: q.subject }, // Identifier
          update: { $set: q },
          upsert: true
        }
      }));

      await QuestionBank.bulkWrite(operations);
      console.log('Successfully saved/updated questions in MongoDB');
      return res.status(201).json({ message: 'Bulk write successful' });
    } else {
      console.log('Saving to In-Memory DB');
      // Simple loop check for memory db
      questions.forEach(q => {
        const exists = memoryDb.questions.find(mq => mq.question === q.question);
        if (!exists) {
           memoryDb.questions.push({ ...q, _id: 'q_' + Date.now() + Math.random() });
        }
      });
      return res.status(201).json({ message: 'Saved to memory' });
    }
  } catch (error) {
    console.error("Bulk Upload Error:", error.message);
    res.status(500).json({ error: 'Failed to save questions', details: error.message });
  }
});

// High Performance Quiz Generation from DB
app.post('/api/quiz/generate-from-db', async (req, res) => {
  try {
    const { subject, chapter, topics, count } = req.body;
    const limit = parseInt(count) || 10;
    
    // Normalize topics to ensure array
    const topicList = Array.isArray(topics) ? topics : [topics];

    if (isDbConnected()) {
      // Use Aggregation Pipeline for efficient random sampling
      const pipeline = [
        { 
          $match: { 
            subject: subject, 
            chapter: chapter,
            topic: { $in: topicList } 
          } 
        },
        { $sample: { size: limit } }
      ];

      const questions = await QuestionBank.aggregate(pipeline);
      return res.json(questions);
    } else {
      // Fallback for memory mode
      const filtered = memoryDb.questions.filter(q => 
        q.subject === subject && 
        q.chapter === chapter && 
        topicList.includes(q.topic)
      );
      const shuffled = filtered.sort(() => 0.5 - Math.random());
      return res.json(shuffled.slice(0, limit));
    }
  } catch (error) {
    console.error("Quiz DB Generation Error:", error);
    res.status(500).json({ error: 'Failed to generate quiz from database' });
  }
});

// Get Question Stats (Syllabus Structure with counts)
app.get('/api/quiz/syllabus-stats', async (req, res) => {
  try {
    if (isDbConnected()) {
      // Aggregation to count questions by Subject > Chapter > Topic
      const stats = await QuestionBank.aggregate([
        { 
          $group: { 
            _id: { subject: "$subject", chapter: "$chapter", topic: "$topic" }, 
            count: { $sum: 1 } 
          } 
        },
        {
          $group: {
            _id: { subject: "$_id.subject", chapter: "$_id.chapter" },
            topics: { $push: { topic: "$_id.topic", count: "$count" } },
            chapterTotal: { $sum: "$count" }
          }
        },
        {
          $group: {
            _id: "$_id.subject",
            chapters: { 
              $push: { 
                chapter: "$_id.chapter", 
                topics: "$topics",
                total: "$chapterTotal"
              } 
            },
            subjectTotal: { $sum: "$chapterTotal" }
          }
        }
      ]);
      
      // Transform into a cleaner object structure: { Subject: { Chapter: { Topic: Count } } }
      const formattedStats = {};
      stats.forEach(sub => {
        formattedStats[sub._id] = { total: sub.subjectTotal, chapters: {} };
        sub.chapters.forEach(chap => {
          const topicCounts = {};
          chap.topics.forEach(t => topicCounts[t.topic] = t.count);
          formattedStats[sub._id].chapters[chap.chapter] = {
            total: chap.total,
            topics: topicCounts
          };
        });
      });

      res.json(formattedStats);
    } else {
      // Fallback Stats from Memory DB
      const stats = {};
      memoryDb.questions.forEach(q => {
        if (!stats[q.subject]) stats[q.subject] = { total: 0, chapters: {} };
        if (!stats[q.subject].chapters[q.chapter]) stats[q.subject].chapters[q.chapter] = { total: 0, topics: {} };
        if (!stats[q.subject].chapters[q.chapter].topics[q.topic]) stats[q.subject].chapters[q.chapter].topics[q.topic] = 0;
        
        stats[q.subject].total++;
        stats[q.subject].chapters[q.chapter].total++;
        stats[q.subject].chapters[q.chapter].topics[q.topic]++;
      });
      res.json(stats);
    }
  } catch (error) {
    console.error("Stats Error:", error);
    res.status(500).json({ error: 'Failed to fetch syllabus stats' });
  }
});

// --- NOTIFICATION ROUTES ---

app.post('/api/admin/notifications', async (req, res) => {
  try {
    if (isDbConnected()) {
      const newNotif = new Notification(req.body);
      await newNotif.save();
      return res.status(201).json(newNotif);
    } else {
      const newNotif = { ...req.body, _id: 'n_' + Date.now(), date: Date.now() };
      memoryDb.notifications.unshift(newNotif);
      return res.status(201).json(newNotif);
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to send notification' });
  }
});

app.get('/api/notifications', async (req, res) => {
  try {
    if (isDbConnected()) {
      const notifs = await Notification.find().sort({ date: -1 }).limit(20);
      res.json(notifs);
    } else {
      res.json(memoryDb.notifications);
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// --- BATTLE ROUTES ---

app.post('/api/battles/create', async (req, res) => {
  try {
    const { userId, userName, avatar } = req.body;
    const roomId = Math.floor(100000 + Math.random() * 900000).toString(); // 6 Digit Code
    const questions = getRandomQuestions(5); // 5 Questions Match

    const battleData = {
      roomId,
      questions,
      player1: { uid: userId, name: userName, score: 0, avatar },
      player2: null,
      status: 'WAITING'
    };

    if (isDbConnected()) {
      const battle = new Battle(battleData);
      await battle.save();
      res.json({ roomId });
    } else {
      memoryDb.battles.push(battleData);
      res.json({ roomId });
    }
  } catch (e) {
    res.status(500).json({ error: 'Failed to create battle' });
  }
});

app.post('/api/battles/join', async (req, res) => {
  try {
    const { roomId, userId, userName, avatar } = req.body;

    const updateData = {
      player2: { uid: userId, name: userName, score: 0, avatar },
      status: 'ACTIVE',
      startTime: Date.now()
    };

    if (isDbConnected()) {
      const battle = await Battle.findOneAndUpdate(
        { roomId, status: 'WAITING' },
        updateData,
        { new: true }
      );
      if (!battle) return res.status(404).json({ error: 'Room not found or full' });
      res.json({ success: true });
    } else {
      const battle = memoryDb.battles.find(b => b.roomId === roomId && b.status === 'WAITING');
      if (!battle) return res.status(404).json({ error: 'Room not found or full' });
      battle.player2 = updateData.player2;
      battle.status = 'ACTIVE';
      battle.startTime = updateData.startTime;
      res.json({ success: true });
    }
  } catch (e) {
    res.status(500).json({ error: 'Failed to join battle' });
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
    const { userId, isCorrect } = req.body; // isCorrect logic handled on client for prototype simplicity
    
    // Increment 10 points for correct answer
    const inc = isCorrect ? 10 : 0;
    
    if (isDbConnected()) {
      // Need to check if user is p1 or p2 to update correct field
      const battle = await Battle.findOne({ roomId });
      if (!battle) return res.status(404).json({ error: 'Battle not found' });
      
      if (battle.player1.uid === userId) {
         battle.player1.score += inc;
      } else if (battle.player2 && battle.player2.uid === userId) {
         battle.player2.score += inc;
      }
      await battle.save();
      res.json({ success: true });
    } else {
      const battle = memoryDb.battles.find(b => b.roomId === roomId);
      if (!battle) return res.status(404).json({ error: 'Battle not found' });
       if (battle.player1.uid === userId) {
         battle.player1.score += inc;
      } else if (battle.player2 && battle.player2.uid === userId) {
         battle.player2.score += inc;
      }
      res.json({ success: true });
    }
  } catch (e) {
    res.status(500).json({ error: 'Failed to submit answer' });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
