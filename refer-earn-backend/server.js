
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const nodemailer = require('nodemailer');
const cors = require('cors');

const prisma = new PrismaClient();
const app = express();

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  methods: ['GET', 'POST'],
  credentials: true
}));
app.use(express.json());

// Configure nodemailer
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK',
    timestamp: new Date(),
    service: 'Refer & Earn API',
    databaseConnection: prisma ? 'Connected' : 'Not Connected'
  });
});

// Get all referrals endpoint
app.get('/api/referrals', async (req, res) => {
  try {
    const referrals = await prisma.referral.findMany({
      orderBy: {
        createdAt: 'desc'
      }
    });
    res.json(referrals);
  } catch (error) {
    console.error('Error fetching referrals:', error);
    res.status(500).json({ error: 'Failed to fetch referrals' });
  }
});

// POST endpoint for creating a new referral
app.post('/api/referrals', async (req, res) => {
  try {
    const { referrerName, referrerEmail, refereeName, refereeEmail, course } = req.body;
    console.log('Received referral request:', { referrerName, referrerEmail, refereeName, refereeEmail, course });

    // Validate required fields
    if (!referrerName || !referrerEmail || !refereeName || !refereeEmail || !course) {
      console.log('Validation failed: Missing required fields');
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Create referral in database
    const referral = await prisma.referral.create({
      data: {
        referrerName,
        referrerEmail,
        refereeName,
        refereeEmail,
        course,
        status: 'PENDING'
      },
    });
    console.log('Referral created:', referral);

    // Send email to referee
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: refereeEmail,
      subject: `${referrerName} has referred you to a course!`,
      html: `
        <h1>You've been referred to a course!</h1>
        <p>Hello ${refereeName},</p>
        <p>${referrerName} thinks you might be interested in our ${course} course.</p>
        <p>Click the link below to learn more:</p>
        <a href="http://yourwebsite.com/courses/${course}">View Course</a>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log('Email sent successfully to:', refereeEmail);

    res.status(201).json({ 
      message: 'Referral created successfully',
      referral 
    });
  } catch (error) {
    console.error('Error processing referral:', error);
    res.status(500).json({ error: 'Failed to process referral' });
  }
});

// Server startup and database connection test
const startServer = async () => {
  try {
    // Test database connection
    await prisma.$connect();
    console.log('✅ Database connection established');

    const PORT = process.env.PORT || 3001;
    app.listen(PORT, () => {
      console.log(`
🚀 Server is running!
⭐️ Server Details:
   - Port: ${PORT}
   - Environment: ${process.env.NODE_ENV || 'development'}
   - Database: Connected
   - Email Service: Configured

📝 Available Endpoints:
   - GET  /health         - Check server status
   - GET  /api/referrals  - List all referrals
   - POST /api/referrals  - Create new referral

💡 Try these curl commands to test:
   curl http://localhost:${PORT}/health
   curl http://localhost:${PORT}/api/referrals
      `);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received. Closing HTTP server and database connection...');
  await prisma.$disconnect();
  process.exit(0);
});