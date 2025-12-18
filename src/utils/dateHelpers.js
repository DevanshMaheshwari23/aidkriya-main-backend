// Calculate duration in minutes
const calculateDurationMinutes = (startTime, endTime) => {
  const start = new Date(startTime);
  const end = new Date(endTime);
  const diffMs = end - start;
  const diffMinutes = Math.floor(diffMs / 1000 / 60);
  return diffMinutes;
};

// Check if date is expired
const isExpired = (expiryDate) => {
  return new Date() > new Date(expiryDate);
};

// Add minutes to date
const addMinutes = (date, minutes) => {
  return new Date(date.getTime() + minutes * 60000);
};

// Format date to readable string
const formatDate = (date) => {
  return new Date(date).toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

// Format time to readable string
const formatTime = (date) => {
  return new Date(date).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit'
  });
};

// Get relative time (e.g., "2 hours ago")
const getRelativeTime = (date) => {
  const now = new Date();
  const past = new Date(date);
  const diffMs = now - past;
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 30) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  return formatDate(date);
};

module.exports = {
  calculateDurationMinutes,
  isExpired,
  addMinutes,
  formatDate,
  formatTime,
  getRelativeTime
};
