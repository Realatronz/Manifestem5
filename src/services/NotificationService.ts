import { db, collection, addDoc, serverTimestamp, doc, setDoc, query, where, orderBy, onSnapshot, updateDoc, deleteDoc, getDoc } from '../firebase';

export type NotificationType = 'like' | 'reply' | 'repost' | 'mention' | 'follow' | 'message';

export interface Notification {
  id: string;
  type: NotificationType;
  from: {
    id: string;
    name: string;
    avatar: string;
  };
  postId?: string;
  content?: string;
  read: boolean;
  createdAt: any;
}

export const NotificationService = {
  // Create a notification for a user
  async createNotification(userId: string, notification: Omit<Notification, 'id' | 'createdAt' | 'read'>) {
    try {
      // Check target user's notification preferences for in-app channel
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (userDoc.exists()) {
        const profile = userDoc.data();
        const prefs = profile?.notificationPrefs?.inApp;
        
        if (prefs) {
          // Map NotificationType to preference key
          const typeMap: Record<string, string> = {
            'like': 'likes',
            'reply': 'replies',
            'mention': 'mentions',
            'follow': 'follows'
          };
          
          const prefKey = typeMap[notification.type];
          if (prefKey && prefs[prefKey] === false) {
             return; // Opted out of this in-app notification
          }
        }
      }

      const notificationsRef = collection(db, 'users', userId, 'notifications');
      await addDoc(notificationsRef, {
        ...notification,
        read: false,
        createdAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error creating notification:', error);
    }
  },

  // Listen for notifications for a user
  subscribeToNotifications(userId: string, callback: (notifications: Notification[]) => void) {
    const notificationsRef = collection(db, 'users', userId, 'notifications');
    const q = query(notificationsRef, orderBy('createdAt', 'desc'));

    return onSnapshot(q, (snapshot) => {
      const notifications = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Notification[];
      callback(notifications);
    });
  },

  // Mark a notification as read
  async markAsRead(userId: string, notificationId: string) {
    try {
      const notificationRef = doc(db, 'users', userId, 'notifications', notificationId);
      await updateDoc(notificationRef, { read: true });
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  },

  // Mark all notifications as read
  async markAllAsRead(userId: string, notifications: Notification[]) {
    try {
      const unread = notifications.filter(n => !n.read);
      const promises = unread.map(n => this.markAsRead(userId, n.id));
      await Promise.all(promises);
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  },

  // Delete a notification
  async deleteNotification(userId: string, notificationId: string) {
    try {
      const notificationRef = doc(db, 'users', userId, 'notifications', notificationId);
      await deleteDoc(notificationRef);
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  },

  // Save FCM token
  async saveFCMToken(userId: string, token: string) {
    try {
      const tokenRef = doc(db, 'users', userId, 'fcm_tokens', token);
      await setDoc(tokenRef, {
        token,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error saving FCM token:', error);
    }
  }
};
