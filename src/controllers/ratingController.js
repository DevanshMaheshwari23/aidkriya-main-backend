const Rating = require('../models/Rating');
const Profile = require('../models/Profile');
const WalkSession = require('../models/WalkSession');
const Feedback = require('../models/Feedback');
const { successResponse, errorResponse } = require('../utils/responseHelper');
const { sendNotification, notificationTemplates } = require('../utils/notificationHelper');

const safeImage = (url) => {
  const val = String(url || '');
  if (!val) return '';
  return /ui-avatars\.com/i.test(val) ? '' : val;
};

// @desc    Submit rating
// @route   POST /api/rating/submit
// @access  Private
exports.submitRating = async (req, res) => {
  try {
    const {
      walk_session_id,
      reviewer_id,
      reviewed_user_id,
      rating,
      review_text,
      tags
    } = req.body;

    // Validate rating value
    if (!rating || rating < 1 || rating > 5) {
      return errorResponse(res, 400, 'Rating must be between 1 and 5');
    }

    // Check if walk session exists
    const walkSession = await WalkSession.findById(walk_session_id);
    if (!walkSession) {
      return errorResponse(res, 404, 'Walk session not found');
    }

    if (walkSession.status !== 'COMPLETED') {
      return errorResponse(res, 400, 'Can only rate completed walks');
    }

    // Check if already rated
    const existingRating = await Rating.findOne({
      walkSessionId: walk_session_id,
      reviewerId: reviewer_id
    });

    if (existingRating) {
      return errorResponse(res, 400, 'You have already rated this walk');
    }

    // Create rating
    const newRating = await Rating.create({
      walkSessionId: walk_session_id,
      reviewerId: reviewer_id,
      reviewedUserId: reviewed_user_id,
      rating: parseFloat(rating),
      reviewText: review_text,
      tags
    });

    // Update reviewed user's average rating
    await updateUserRating(reviewed_user_id);

    // Send notification
    const reviewerProfile = await Profile.findOne({ userId: reviewer_id });
    const notification = notificationTemplates.newRating(
      rating,
      reviewerProfile?.name || 'Someone'
    );
    await sendNotification(
      reviewed_user_id,
      notification.title,
      notification.message,
      { ratingId: newRating._id },
      { type: notification.type, relatedId: newRating._id, relatedModel: 'Rating' }
    );

    successResponse(res, 201, 'Rating submitted successfully', {
      id: newRating._id,
      walk_session_id: newRating.walkSessionId,
      reviewer_id: newRating.reviewerId,
      reviewed_user_id: newRating.reviewedUserId,
      rating: newRating.rating,
      review_text: newRating.reviewText,
      tags: newRating.tags,
      created_at: newRating.createdAt
    });
  } catch (error) {
    console.error('Submit rating error:', error);
    errorResponse(res, 500, 'Error submitting rating', error.message);
  }
};

// @desc    Get user ratings
// @route   GET /api/rating/user/:userId
// @access  Public
exports.getUserRatings = async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const skip = (page - 1) * limit;

    const [ratings, total] = await Promise.all([
      Rating.find({ reviewedUserId: userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('reviewerId', 'name')
        .populate({
          path: 'reviewerId',
          populate: {
            path: 'userId',
            select: 'name',
            model: 'User'
          }
        }),
      Rating.countDocuments({ reviewedUserId: userId })
    ]);

    // Get reviewer profiles for images
    const reviewsWithProfiles = await Promise.all(
      ratings.map(async (rating) => {
        const reviewerProfile = await Profile.findOne({ userId: rating.reviewerId });
        
        return {
          id: rating._id,
          reviewer_id: rating.reviewerId._id,
          reviewer_name: reviewerProfile?.name || 'Anonymous',
          reviewer_image: safeImage(reviewerProfile?.profileImage || ''),
          rating: rating.rating,
          review_text: rating.reviewText || '',
          tags: rating.tags || [],
          created_at: rating.createdAt
        };
      })
    );

    successResponse(res, 200, 'User ratings retrieved', {
      ratings: reviewsWithProfiles,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total
      }
    });
  } catch (error) {
    console.error('Get user ratings error:', error);
    errorResponse(res, 500, 'Error fetching user ratings', error.message);
  }
};

// @desc    Get average rating for user
// @route   GET /api/rating/average/:userId
// @access  Public
exports.getAverageRating = async (req, res) => {
  try {
    const { userId } = req.params;

    const feedbacks = await Feedback.find({ partnerId: userId });
    const values = feedbacks
      .map(f => Number(f.rating) || 0)
      .filter(v => v >= 1 && v <= 5);

    if (values.length === 0) {
      return successResponse(res, 200, 'No ratings found', {
        average_rating: 0,
        total_ratings: 0,
        rating_distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
      });
    }

    const sum = values.reduce((acc, curr) => acc + curr, 0);
    const average = sum / values.length;

    const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    values.forEach(v => {
      const star = Math.min(5, Math.max(1, Math.round(v)));
      distribution[star] = (distribution[star] || 0) + 1;
    });

    successResponse(res, 200, 'Average rating calculated', {
      average_rating: parseFloat(average.toFixed(2)),
      total_ratings: values.length,
      rating_distribution: distribution
    });
  } catch (error) {
    console.error('Get average rating error:', error);
    errorResponse(res, 500, 'Error calculating average rating', error.message);
  }
};

// @desc    Check if session has been rated
// @route   GET /api/rating/check/:sessionId/:userId
// @access  Private
exports.hasRatedSession = async (req, res) => {
  try {
    const { sessionId, userId } = req.params;

    const rating = await Rating.findOne({
      walkSessionId: sessionId,
      reviewerId: userId
    });

    successResponse(res, 200, 'Rating status checked', {
      has_rated: !!rating
    });
  } catch (error) {
    console.error('Check rating error:', error);
    errorResponse(res, 500, 'Error checking rating status', error.message);
  }
};

// @desc    Report a review
// @route   POST /api/rating/report
// @access  Private
exports.reportReview = async (req, res) => {
  try {
    const { rating_id, reason } = req.body;

    const rating = await Rating.findById(rating_id);

    if (!rating) {
      return errorResponse(res, 404, 'Rating not found');
    }

    rating.isReported = true;
    rating.reportReason = reason;
    await rating.save();

    // In production, notify admin/moderation team

    successResponse(res, 200, 'Review reported successfully');
  } catch (error) {
    console.error('Report review error:', error);
    errorResponse(res, 500, 'Error reporting review', error.message);
  }
};

// Helper function to update user's average rating
async function updateUserRating(userId) {
  try {
    const feedbacks = await Feedback.find({ partnerId: userId });
    const values = feedbacks
      .map(f => Number(f.rating) || 0)
      .filter(v => v >= 1 && v <= 5);

    const profile = await Profile.findOne({ userId });
    if (profile) {
      if (values.length === 0) {
        profile.rating = 0;
      } else {
        const sum = values.reduce((acc, curr) => acc + curr, 0);
        const average = sum / values.length;
        profile.rating = parseFloat(average.toFixed(2));
      }
      await profile.save();
    }
  } catch (error) {
    console.error('Update user rating error:', error);
  }
}

exports.updateUserRating = updateUserRating;
