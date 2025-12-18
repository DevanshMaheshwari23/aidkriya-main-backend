const WalkSession = require('../models/WalkSession');
const Feedback = require('../models/Feedback');
const { successResponse, errorResponse } = require('../utils/responseHelper');

exports.createFeedback = async (req, res) => {
  console.log('[Feedback] ENDPOINT HIT - Request received');
  console.log('[Feedback] User ID:', req.user?._id || req.user?.id);
  console.log('[Feedback] Body:', req.body);
  try {
    const { sessionId, rating, message } = req.body;
    const userId = req.user._id;

    if (!sessionId || !rating) {
      console.log('[Feedback] ❌ Missing required fields');
      return res.status(400).json({ success: false, message: 'Session ID and rating are required' });
    }
    if (rating < 1 || rating > 5) {
      console.log('[Feedback] ❌ Invalid rating');
      return res.status(400).json({ success: false, message: 'Rating must be between 1 and 5' });
    }

    console.log('[Feedback] Attempting to find session:', sessionId);
    const session = await WalkSession.findById(sessionId).exec();
    if (!session) {
      console.log('[Feedback] ⚠️ Session not found, allowing feedback anyway');
      const existingFeedback = await Feedback.findOne({ sessionId, userId });
      if (existingFeedback) {
        console.log('[Feedback] ❌ Duplicate feedback');
        return res.status(400).json({ success: false, message: 'Feedback already submitted' });
      }
      const feedback = new Feedback({
        sessionId,
        userId,
        userRole: 'UNKNOWN',
        partnerId: null,
        rating,
        message: message || null,
      });
      await feedback.save();
      console.log('[Feedback] ✅ Feedback saved without session reference');
      return res.status(201).json({ success: true, message: 'Feedback submitted successfully', data: { feedbackId: feedback._id, rating: feedback.rating } });
    }

    console.log('[Feedback] ✅ Session found');
    const isWalker = session.walkerId?.toString() === userId.toString();
    const partnerId = isWalker ? session.wandererId : session.walkerId;

    const existingFeedback = await Feedback.findOne({ sessionId, userId });
    if (existingFeedback) {
      console.log('[Feedback] ❌ Duplicate feedback');
      return res.status(400).json({ success: false, message: 'You have already submitted feedback for this walk' });
    }
    const feedback = new Feedback({
      sessionId,
      userId,
      userRole: isWalker ? 'WALKER' : 'WANDERER',
      partnerId,
      rating,
      message: message || null,
    });
    await feedback.save();
    console.log('[Feedback] ✅ Feedback saved successfully with session:', feedback._id);
    return res.status(201).json({ success: true, message: 'Feedback submitted successfully', data: { feedbackId: feedback._id, rating: feedback.rating } });
  } catch (error) {
    console.error('[Feedback] ❌ Error:', error.message, error.stack);
    return res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  }
};
