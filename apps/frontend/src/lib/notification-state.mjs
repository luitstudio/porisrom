export function upsertNotificationById(notifications, notification) {
  return notifications.some((existing) => existing.id === notification.id)
    ? notifications
    : [notification, ...notifications];
}

export function unreadNotificationCount(notifications) {
  return notifications.filter((notification) => !notification.isRead).length;
}

export function markNotificationRead(notifications, id) {
  return notifications.map((notification) =>
    notification.id === id ? { ...notification, isRead: true } : notification,
  );
}
