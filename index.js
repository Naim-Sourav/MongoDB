const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middleware
app.use(express.json());
app.use(cors());

// MongoDB Connection
// Render এ Environment Variable এ MONGODB_URI সেট করতে হবে
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://<username>:<password>@cluster0.mongodb.net/shikkha-shohayok?retryWrites=true&w=majority';

// Connect with timeouts to fail fast if config is wrong
mongoose.connect(MONGODB_URI, {
  serverSelectionTimeoutMS: 5000, // Fail after 5 seconds if cannot connect
  socketTimeoutMS: 45000,
})
  .then(() => console.log('✅ Connected to MongoDB Atlas'))
  .catch(err => console.error('❌ Could not connect to MongoDB:', err));

// Middleware to check DB connection status before processing requests
app.use((req, res, next) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ error: 'Database not connected. Please try again later.' });
  }
  next();
});

// --- Schemas & Models ---

// 1. User Schema (Synced from Firebase)
const userSchema = new mongoose.Schema({
  uid: { type: String, required: true, unique: true },
  email: String,
  displayName: String,
  photoURL: String,
  role: { type: String, default: 'student' }, // student, admin
  lastLogin: { type: Number, default: Date.now },
  createdAt: { type: Number, default: Date.now }
});

const User = mongoose.model('User', userSchema);

// 2. Payment Schema
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

// 3. Notification Schema
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
  const dbStatus = mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected';
  res.send(`🚀 Shikkha Shohayok API is Running! DB Status: ${dbStatus}`);
});

// --- USER ROUTES ---

// Sync User (Upsert: Create if new, Update if exists)
app.post('/api/users/sync', async (req, res) => {
  try {
    const { uid, email, displayName, photoURL } = req.body;
    
    const user = await User.findOneAndUpdate(
      { uid: uid },
      { 
        uid, 
        email, 
        displayName, 
        photoURL, 
        lastLogin: Date.now() 
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    
    res.json(user);
  } catch (error) {
    console.error("User Sync Error:", error);
    res.status(500).json({ error: 'Failed to sync user' });
  }
});

// Get User Enrollments (Based on Approved Payments)
app.get('/api/users/:userId/enrollments', async (req, res) => {
  try {
    const { userId } = req.params;
    // Find all approved payments for this user
    const approvedPayments = await Payment.find({ userId: userId, status: 'APPROVED' });
    
    // Map to simple enrollment objects
    const enrollments = approvedPayments.map(p => ({
      id: p.courseId,
      title: p.courseTitle,
      progress: 0 // In future, we can have a separate Enrollment schema for tracking progress
    }));

    res.json(enrollments);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch enrollments' });
  }
});

// --- PAYMENT ROUTES ---

// Submit Payment Request
app.post('/api/payments', async (req, res) => {
  try {
    const newPayment = new Payment(req.body);
    const savedPayment = await newPayment.save();
    res.status(201).json(savedPayment);
  } catch (error) {
    res.status(500).json({ error: 'Failed to submit payment', details: error.message });
  }
});

// Get All Payments (Admin)
app.get('/api/admin/payments', async (req, res) => {
  try {
    const payments = await Payment.find().sort({ timestamp: -1 });
    res.json(payments);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch payments' });
  }
});

// Update Payment Status
app.put('/api/admin/payments/:id', async (req, res) => {
  try {
    const { status } = req.body;
    if (!['APPROVED', 'REJECTED'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const updatedPayment = await Payment.findByIdAndUpdate(
      req.params.id, 
      { status }, 
      { new: true }
    );

    if (!updatedPayment) return res.status(404).json({ error: 'Payment not found' });
    res.json(updatedPayment);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update payment' });
  }
});

// Delete Payment Request
app.delete('/api/admin/payments/:id', async (req, res) => {
  try {
    await Payment.findByIdAndDelete(req.params.id);
    res.json({ message: 'Payment deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete payment' });
  }
});

// --- NOTIFICATION ROUTES ---

// Send Notification
app.post('/api/admin/notifications', async (req, res) => {
  try {
    const newNotif = new Notification(req.body);
    await newNotif.save();
    res.status(201).json(newNotif);
  } catch (error) {
    res.status(500).json({ error: 'Failed to send notification' });
  }
});

// Get Notifications
app.get('/api/notifications', async (req, res) => {
  try {
    const notifs = await Notification.find().sort({ date: -1 }).limit(20);
    res.json(notifs);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
