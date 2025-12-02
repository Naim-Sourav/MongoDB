const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middleware
app.use(express.json());
app.use(cors());

// --- MongoDB Connection Setup ---
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://<username>:<password>@cluster0.mongodb.net/shikkha-shohayok?retryWrites=true&w=majority';

// In-Memory Fallback Storage
const memoryDb = {
  users: [],
  payments: [],
  notifications: [
    { _id: '1', title: 'System', message: 'Running in fallback mode (Database disconnected)', type: 'WARNING', date: Date.now() }
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
        user = { uid, email, displayName, photoURL, role: 'student', lastLogin: Date.now(), createdAt: Date.now() };
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

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
