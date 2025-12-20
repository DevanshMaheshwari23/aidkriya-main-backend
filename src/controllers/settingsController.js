const Settings = require('../models/Settings');
const { successResponse, errorResponse } = require('../utils/responseHelper');

const getOrCreateSettings = async (userId) => {
  let settings = await Settings.findOne({ userId });
  if (!settings) {
    settings = await Settings.create({ userId });
  }
  return settings;
};

exports.getPrivacy = async (req, res) => {
  try {
    const settings = await getOrCreateSettings(req.user._id);
    successResponse(res, 200, 'Privacy settings retrieved', settings.privacy);
  } catch (error) {
    errorResponse(res, 500, 'Error fetching privacy settings', error.message);
  }
};

exports.updatePrivacy = async (req, res) => {
  try {
    const settings = await getOrCreateSettings(req.user._id);
    const payload = req.body || {};
    settings.privacy = {
      hidePersonalInfo: payload.hidePersonalInfo ?? settings.privacy.hidePersonalInfo,
      showEmail: payload.showEmail ?? settings.privacy.showEmail,
      showPhone: payload.showPhone ?? settings.privacy.showPhone,
      locationSharing: {
        enabled: payload.locationSharing?.enabled ?? settings.privacy.locationSharing.enabled,
        accuracy: payload.locationSharing?.accuracy ?? settings.privacy.locationSharing.accuracy
      }
    };
    await settings.save();
    successResponse(res, 200, 'Privacy settings updated', settings.privacy);
  } catch (error) {
    errorResponse(res, 500, 'Error updating privacy settings', error.message);
  }
};

exports.getNotifications = async (req, res) => {
  try {
    const settings = await getOrCreateSettings(req.user._id);
    successResponse(res, 200, 'Notification settings retrieved', settings.notifications);
  } catch (error) {
    errorResponse(res, 500, 'Error fetching notification settings', error.message);
  }
};

exports.updateNotifications = async (req, res) => {
  try {
    const settings = await getOrCreateSettings(req.user._id);
    const payload = req.body || {};
    settings.notifications = {
      push: { enabled: payload.push?.enabled ?? settings.notifications.push.enabled },
      inApp: {
        sound: payload.inApp?.sound ?? settings.notifications.inApp.sound,
        vibration: payload.inApp?.vibration ?? settings.notifications.inApp.vibration
      },
      email: {
        weeklySummary: payload.email?.weeklySummary ?? settings.notifications.email.weeklySummary,
        securityAlerts: payload.email?.securityAlerts ?? settings.notifications.email.securityAlerts,
        newsletters: payload.email?.newsletters ?? settings.notifications.email.newsletters
      },
      dnd: {
        enabled: payload.dnd?.enabled ?? settings.notifications.dnd.enabled,
        startMinutes: payload.dnd?.startMinutes ?? settings.notifications.dnd.startMinutes,
        endMinutes: payload.dnd?.endMinutes ?? settings.notifications.dnd.endMinutes
      }
    };
    await settings.save();
    successResponse(res, 200, 'Notification settings updated', settings.notifications);
  } catch (error) {
    errorResponse(res, 500, 'Error updating notification settings', error.message);
  }
};
