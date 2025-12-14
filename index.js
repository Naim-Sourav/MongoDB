
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// --- MONGODB CONNECTION ---
// Replace with your actual connection string in .env file as MONGODB_URI
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/dhrubok_db";

mongoose.connect(MONGODB_URI)
  .then(() => console.log('MongoDB Connected'))
  .catch(err => console.log('MongoDB Connection Error:', err));

const isDbConnected = () => mongoose.connection.readyState === 1;

// --- SCHEMAS & MODELS ---

const UserSchema = new mongoose.Schema({
  uid: { type: String, required: true, unique: true },
  displayName: String,
  email: String,
  photoURL: String,
  phoneNumber: String,
  college: String,
  hscBatch: String,
  department: String,
  target: String,
  points: { type: Number, default: 0 },
  role: { type: String, default: 'student' }, // 'student', 'admin'
  
  // Progress Stats
  totalExams: { type: Number, default: 0 },
  totalCorrect: { type: Number, default: 0 },
  totalWrong: { type: Number, default: 0 },
  
  // Game Data
  quests: [{
    id: String,
    title: String,
    description: String,
    type: String,
    target: Number,
    progress: Number,
    reward: Number,
    completed: Boolean,
    claimed: Boolean,
    icon: String,
    category: String,
    lastUpdated: Number
  }],
  
  // Enrollments
  enrolledCourses: [{
    id: String,
    title: String,
    progress: Number,
    enrolledAt: Number
  }],

  // Saved Content
  savedQuestions: [{
    questionId: { type: mongoose.Schema.Types.ObjectId, ref: 'QuestionBank' },
    folder: { type: String, default: 'All' },
    savedAt: { type: Number, default: Date.now }
  }],

  // Mistakes Log
  mistakes: [{
    questionId: { type: mongoose.Schema.Types.ObjectId, ref: 'QuestionBank' },
    wrongCount: { type: Number, default: 1 },
    lastMissed: { type: Number, default: Date.now }
  }]
}, { timestamps: true });

const QuestionBankSchema = new mongoose.Schema({
  question: String,
  options: [String],
  correctAnswerIndex: Number,
  explanation: String,
  subject: String,
  chapter: String,
  topic: String,
  difficulty: String, // EASY, MEDIUM, HARD
  examRef: String,    // e.g. 'medical_2023'
}, { timestamps: true });

const PaymentSchema = new mongoose.Schema({
  userId: String,
  userName: String,
  userEmail: String,
  courseId: String,
  courseTitle: String,
  amount: Number,
  trxId: String,
  senderNumber: String,
  status: { type: String, default: 'PENDING' }, // PENDING, APPROVED, REJECTED
  timestamp: { type: Number, default: Date.now }
});

const NotificationSchema = new mongoose.Schema({
  title: String,
  message: String,
  type: String, // INFO, SUCCESS, WARNING
  target: { type: String, default: 'ALL' }, // 'ALL' or specific UID
  date: { type: Number, default: Date.now }
});

const User = mongoose.model('User', UserSchema);
const QuestionBank = mongoose.model('QuestionBank', QuestionBankSchema);
const PaymentRequest = mongoose.model('PaymentRequest', PaymentSchema);
const Notification = mongoose.model('Notification', NotificationSchema);

// --- SYLLABUS STATS HELPER ---
async function getSyllabusStats() {
    // This aggregates question counts from DB
    const stats = {};
    const questions = await QuestionBank.find({}, 'subject chapter topic');
    
    questions.forEach(q => {
        if (!stats[q.subject]) {
            stats[q.subject] = { total: 0, chapters: {} };
        }
        stats[q.subject].total++;
        
        if (q.chapter) {
            if (!stats[q.subject].chapters[q.chapter]) {
                stats[q.subject].chapters[q.chapter] = { total: 0, topics: {} };
            }
            stats[q.subject].chapters[q.chapter].total++;
            
            if (q.topic) {
                if (!stats[q.subject].chapters[q.chapter].topics[q.topic]) {
                    stats[q.subject].chapters[q.chapter].topics[q.topic] = 0;
                }
                stats[q.subject].chapters[q.chapter].topics[q.topic]++;
            }
        }
    });
    return stats;
}

// --- API ROUTES ---

// 1. SYLLABUS STATS
app.get('/api/syllabus/stats', async (req, res) => {
    try {
        const stats = await getSyllabusStats();
        res.json(stats);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 2. QUIZ GENERATION (FROM DB)
app.post('/api/quiz/generate-db', async (req, res) => {
    try {
        const { subject, chapter, topics, count } = req.body;
        const query = { subject };
        if (chapter && chapter !== 'Full Syllabus') query.chapter = chapter;
        if (topics && topics.length > 0 && !topics.includes('পূর্ণাঙ্গ প্রস্তুতি (Full Syllabus)')) {
            query.topic = { $in: topics };
        }

        const questions = await QuestionBank.aggregate([
            { $match: query },
            { $sample: { size: Number(count) || 10 } }
        ]);
        
        res.json(questions);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 3. USER SYNC & PROFILE
app.post('/api/user/sync', async (req, res) => {
    try {
        const { user, additionalData } = req.body;
        if (!user || !user.uid) return res.status(400).send("No user data");

        const updateData = {
            uid: user.uid,
            displayName: user.displayName,
            email: user.email,
            photoURL: user.photoURL,
            ...additionalData
        };

        const result = await User.findOneAndUpdate(
            { uid: user.uid },
            { $set: updateData },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        res.json(result);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/user/:userId/stats', async (req, res) => {
    try {
        const user = await User.findOne({ uid: req.params.userId });
        if (!user) return res.status(404).json({ error: "User not found" });
        res.json(user);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/user/:userId/enrollments', async (req, res) => {
    try {
        const user = await User.findOne({ uid: req.params.userId });
        res.json(user ? user.enrolledCourses : []);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 4. EXAM RESULTS & GAMIFICATION
app.post('/api/user/:userId/exam-result', async (req, res) => {
    try {
        const { score, totalQuestions, correct, wrong, mistakes: newMistakes } = req.body;
        const user = await User.findOne({ uid: req.params.userId });
        if (!user) return res.status(404).send("User not found");

        // Update Stats
        user.totalExams += 1;
        user.totalCorrect += correct;
        user.totalWrong += wrong;
        user.points += score; // Add logic for bonus points if needed

        // Handle Mistakes
        if (newMistakes && newMistakes.length > 0) {
            for (const m of newMistakes) {
                // If question has _id (from DB), add to mistake log
                if (m._id) {
                    const existingIndex = user.mistakes.findIndex(item => item.questionId && item.questionId.toString() === m._id);
                    if (existingIndex > -1) {
                        user.mistakes[existingIndex].wrongCount += 1;
                        user.mistakes[existingIndex].lastMissed = Date.now();
                    } else {
                        user.mistakes.push({ questionId: m._id, wrongCount: 1 });
                    }
                }
            }
        }

        await user.save();
        res.json({ success: true, points: user.points });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/user/:userId/quest-progress', async (req, res) => {
    try {
        const { questType, amount } = req.body;
        const user = await User.findOne({ uid: req.params.userId });
        if (!user) return res.status(404).send("User not found");

        // Logic to initialize daily quests if empty or old
        const today = new Date().setHours(0,0,0,0);
        const lastUpdated = user.quests[0]?.lastUpdated || 0;
        
        if (lastUpdated < today) {
            // Reset Daily Quests
            user.quests = [
                { id: 'q1', title: 'Daily Warmup', description: 'Complete 1 Quiz', type: 'EXAM_COMPLETE', target: 1, progress: 0, reward: 50, completed: false, claimed: false, icon: 'Zap', category: 'DAILY', lastUpdated: Date.now() },
                { id: 'q2', title: 'Sharpshooter', description: 'Score 80% in a quiz', type: 'HIGH_SCORE', target: 1, progress: 0, reward: 100, completed: false, claimed: false, icon: 'Target', category: 'DAILY', lastUpdated: Date.now() },
                { id: 'q3', title: 'Knowledge Seeker', description: 'Study for 30 mins', type: 'STUDY_TIME', target: 30, progress: 0, reward: 150, completed: false, claimed: false, icon: 'Clock', category: 'DAILY', lastUpdated: Date.now() },
                { id: 'q4', title: 'Curious Mind', description: 'Ask AI Tutor', type: 'ASK_AI', target: 1, progress: 0, reward: 30, completed: false, claimed: false, icon: 'Bot', category: 'DAILY', lastUpdated: Date.now() },
                { id: 'q5', title: 'Collector', description: 'Save a Question', type: 'SAVE_QUESTION', target: 1, progress: 0, reward: 20, completed: false, claimed: false, icon: 'Bookmark', category: 'DAILY', lastUpdated: Date.now() }
            ];
        }

        // Update Progress
        let updated = false;
        user.quests.forEach(q => {
            if (q.type === questType && !q.completed) {
                q.progress += amount;
                if (q.progress >= q.target) {
                    q.progress = q.target;
                    q.completed = true;
                }
                updated = true;
            }
        });

        if (updated) await user.save();
        res.json({ success: true, quests: user.quests });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/user/:userId/claim-quest', async (req, res) => {
    try {
        const { questId } = req.body;
        const user = await User.findOne({ uid: req.params.userId });
        if (!user) return res.status(404).send("User not found");

        const quest = user.quests.find(q => q.id === questId);
        if (quest && quest.completed && !quest.claimed) {
            quest.claimed = true;
            user.points += quest.reward;
            await user.save();
            res.json({ success: true, points: user.points });
        } else {
            res.status(400).json({ success: false, message: "Cannot claim quest" });
        }
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 5. SAVED QUESTIONS & MISTAKES
app.get('/api/user/:userId/saved-questions', async (req, res) => {
    try {
        const user = await User.findOne({ uid: req.params.userId }).populate('savedQuestions.questionId');
        // Filter out nulls (deleted questions)
        const validSaved = user.savedQuestions.filter(sq => sq.questionId != null);
        res.json(validSaved);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/user/:userId/save-question', async (req, res) => {
    try {
        const { questionId } = req.body;
        const user = await User.findOne({ uid: req.params.userId });
        
        // Check duplicate
        if (!user.savedQuestions.some(sq => sq.questionId.toString() === questionId)) {
            user.savedQuestions.push({ questionId });
            await user.save();
        }
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.delete('/api/user/:userId/saved-questions/:id', async (req, res) => {
    try {
        const user = await User.findOne({ uid: req.params.userId });
        user.savedQuestions = user.savedQuestions.filter(sq => sq._id.toString() !== req.params.id);
        await user.save();
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/user/:userId/unsave-question', async (req, res) => {
    try {
        const { questionId } = req.body;
        const user = await User.findOne({ uid: req.params.userId });
        user.savedQuestions = user.savedQuestions.filter(sq => sq.questionId.toString() !== questionId);
        await user.save();
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.patch('/api/user/:userId/saved-questions/:id/folder', async (req, res) => {
    try {
        const { folder } = req.body;
        const user = await User.findOne({ uid: req.params.userId });
        const item = user.savedQuestions.id(req.params.id);
        if (item) {
            item.folder = folder;
            await user.save();
            res.json({ success: true });
        } else {
            res.status(404).send("Item not found");
        }
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/user/:userId/mistakes', async (req, res) => {
    try {
        const user = await User.findOne({ uid: req.params.userId }).populate('mistakes.questionId');
        // Flatten and clean
        const result = user.mistakes
            .filter(m => m.questionId != null)
            .map(m => ({
                _id: m._id,
                ...m.questionId.toObject(),
                wrongCount: m.wrongCount,
                lastMissed: m.lastMissed
            }));
        res.json(result);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.delete('/api/user/:userId/mistakes/:id', async (req, res) => {
    try {
        const user = await User.findOne({ uid: req.params.userId });
        user.mistakes = user.mistakes.filter(m => m._id.toString() !== req.params.id);
        await user.save();
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 6. ADMIN & PAYMENTS
app.post('/api/payments/submit', async (req, res) => {
    try {
        const newPayment = new PaymentRequest(req.body);
        await newPayment.save();
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/admin/payments', async (req, res) => {
    try {
        const payments = await PaymentRequest.find().sort({ timestamp: -1 });
        res.json(payments);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.patch('/api/admin/payments/:id/status', async (req, res) => {
    try {
        const { status } = req.body;
        const payment = await PaymentRequest.findByIdAndUpdate(req.params.id, { status }, { new: true });
        
        if (status === 'APPROVED' && payment) {
            // Auto Enroll User
            const user = await User.findOne({ uid: payment.userId });
            if (user) {
                // Check if already enrolled
                if (!user.enrolledCourses.some(c => c.id === payment.courseId)) {
                    user.enrolledCourses.push({
                        id: payment.courseId,
                        title: payment.courseTitle,
                        progress: 0,
                        enrolledAt: Date.now()
                    });
                    await user.save();
                }
            }
        }
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.delete('/api/admin/payments/:id', async (req, res) => {
    try {
        await PaymentRequest.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/admin/stats', async (req, res) => {
    try {
        const totalUsers = await User.countDocuments();
        const totalQuestions = await QuestionBank.countDocuments();
        
        const payments = await PaymentRequest.find();
        const totalRevenue = payments
            .filter(p => p.status === 'APPROVED')
            .reduce((sum, p) => sum + p.amount, 0);
        
        const pendingPayments = payments.filter(p => p.status === 'PENDING').length;
        const approvedEnrollments = payments.filter(p => p.status === 'APPROVED').length;

        // Mock total exams taken (sum of all users)
        // In real app, might want to optimize this aggregation
        const users = await User.find({}, 'totalExams');
        const totalExams = users.reduce((sum, u) => sum + (u.totalExams || 0), 0);

        res.json({
            totalUsers,
            totalQuestions,
            totalRevenue,
            pendingPayments,
            approvedEnrollments,
            totalExams
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 7. QUESTION BANK MANAGEMENT
app.post('/api/admin/questions', async (req, res) => {
    try {
        const { questions, metadata } = req.body;
        // Batch insert
        if (questions && Array.isArray(questions)) {
            await QuestionBank.insertMany(questions);
        }
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// GET: All Questions (Admin Viewer) with ExamRef Search
app.get('/api/admin/questions', async (req, res) => {
    try {
        const { page = 1, limit = 10, subject, chapter, examRef } = req.query;
        const query = {};
        if(subject) query.subject = subject;
        if(chapter) query.chapter = chapter;
        if(examRef) query.examRef = { $regex: examRef, $options: 'i' }; // Regex Search

        const questions = await QuestionBank.find(query)
            .skip((page-1)*limit)
            .limit(Number(limit))
            .sort({ createdAt: -1 });
            
        const total = await QuestionBank.countDocuments(query);
        res.json({ questions, total });
    } catch(e) { 
        res.status(500).json({error: e.message}); 
    }
});

app.delete('/api/admin/questions/:id', async (req, res) => {
    try {
        await QuestionBank.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 8. PAST PAPERS & PACKS
app.get('/api/question-papers', async (req, res) => {
    try {
        // Aggregate metadata from QuestionBank based on examRef
        const papers = await QuestionBank.aggregate([
            { $match: { examRef: { $exists: true, $ne: "" } } },
            { 
                $group: { 
                    _id: "$examRef", 
                    count: { $sum: 1 },
                    // Just take the first subject/source as sample, real app might have separate Paper collection
                    sampleSubject: { $first: "$subject" } 
                } 
            }
        ]);

        // Map aggregated data to QuestionPaperMetadata format
        const formatted = papers.map(p => {
            // Heuristic to determine source/title from ID (e.g. medical_2023)
            const parts = p._id.split('_');
            const year = parts[parts.length - 1];
            const source = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
            
            return {
                id: p._id,
                title: `${source} Admission Test`, // Generic Title, ideally stored in a Paper collection
                year: year,
                source: source, // e.g. Medical
                totalQuestions: p.count,
                time: 60 // Default
            };
        });

        res.json(formatted);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/questions/by-exam/:examRef', async (req, res) => {
    try {
        const questions = await QuestionBank.find({ examRef: req.params.examRef });
        res.json(questions);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/exam-packs', (req, res) => {
    // Static data for now, could be DB
    const PACKS = [
      { id: 'pack_medical_final', title: 'Medical Final Model Test', subtitle: '10 Full Sets', price: 500, originalPrice: 1000, totalExams: 10, features: ['Negative Marking', 'Merit List'], theme: 'emerald', tag: 'Medical' },
      { id: 'pack_eng_final', title: 'Engineering Final Prep', subtitle: 'BUET Standard', price: 600, originalPrice: 1200, totalExams: 8, features: ['Written + MCQ', 'Detailed Solution'], theme: 'blue', tag: 'Engineering' }
    ];
    res.json(PACKS);
});

// 9. LEADERBOARD
app.get('/api/leaderboard', async (req, res) => {
    try {
        const users = await User.find({}, 'uid displayName photoURL points college').sort({ points: -1 }).limit(50);
        res.json(users);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 10. NOTIFICATIONS
app.get('/api/notifications', async (req, res) => {
    try {
        const notifs = await Notification.find().sort({ date: -1 }).limit(20);
        res.json(notifs);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/admin/notifications', async (req, res) => {
    try {
        const notif = new Notification(req.body);
        await notif.save();
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Start Server
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
