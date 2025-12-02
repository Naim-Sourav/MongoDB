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

mongoose.connect(MONGODB_URI)
  .then(() => console.log('✅ Connected to MongoDB Atlas'))
  .catch(err => console.error('❌ Could not connect to MongoDB:', err));

// --- Schemas & Models ---

// Payment Schema
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

// Notification Schema
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
  res.send('🚀 Shikkha Shohayok API is Running!');
});

// 1. Submit Payment Request
app.post('/api/payments', async (req, res) => {
  try {
    const newPayment = new Payment(req.body);
    const savedPayment = await newPayment.save();
    res.status(201).json(savedPayment);
  } catch (error) {
    res.status(500).json({ error: 'Failed to submit payment', details: error.message });
  }
});

// 2. Get All Payments (Admin)
app.get('/api/admin/payments', async (req, res) => {
  try {
    // Sort by latest first
    const payments = await Payment.find().sort({ timestamp: -1 });
    res.json(payments);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch payments' });
  }
});

// 3. Update Payment Status (Approve/Reject)
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

// 4. Delete Payment Request
app.delete('/api/admin/payments/:id', async (req, res) => {
  try {
    await Payment.findByIdAndDelete(req.params.id);
    res.json({ message: 'Payment deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete payment' });
  }
});

// 5. Send Notification
app.post('/api/admin/notifications', async (req, res) => {
  try {
    const newNotif = new Notification(req.body);
    await newNotif.save();
    res.status(201).json(newNotif);
  } catch (error) {
    res.status(500).json({ error: 'Failed to send notification' });
  }
});

// 6. Get Notifications (For Users)
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
