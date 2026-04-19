import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  auth, 
  onAuthStateChanged, 
  FirebaseUser, 
  signInWithPopup, 
  googleProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithPhoneNumber,
  RecaptchaVerifier,
  db,
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  handleFirestoreError,
  OperationType
} from './firebase';

export interface UserProfile {
  id?: string;
  name: string;
  handle: string;
  bio: string;
  location: string;
  website: string;
  avatar: string;
  cover: string | null;
  role: 'admin' | 'member' | 'guest';
  followedCreatorIds?: string[];
  followersCount?: number;
  followingCount?: number;
  isCreator?: boolean;
  isBusiness?: boolean;
  skills?: string[];
  links?: {
    github?: string;
    twitter?: string;
    instagram?: string;
    website?: string;
  };
  category?: string;
  ownerName?: string;
  description?: string;
  logo?: string;
  onboardingCompleted?: boolean;
  phone?: string;
  email?: string;
  notificationPrefs?: {
    push: {
      likes: boolean;
      replies: boolean;
      mentions: boolean;
      follows: boolean;
    };
    inApp: {
      likes: boolean;
      replies: boolean;
      mentions: boolean;
      follows: boolean;
    };
  };
}

interface AuthContextType {
  user: FirebaseUser | null;
  userProfile: UserProfile | null;
  loading: boolean;
  login: () => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  registerWithEmail: (email: string, password: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  setupRecaptcha: (elementId: string) => RecaptchaVerifier;
  loginWithPhone: (phoneNumber: string, appVerifier: RecaptchaVerifier) => Promise<any>;
  logout: () => Promise<void>;
  updateUserProfile: (data: Partial<UserProfile>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const FirebaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeProfile: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      
      if (user) {
        // Listen to user profile changes
        const userDocRef = doc(db, 'users', user.uid);
        unsubscribeProfile = onSnapshot(userDocRef, (docSnap) => {
          if (docSnap.exists()) {
            setUserProfile(docSnap.data() as UserProfile);
          } else {
            // Initialize profile if it doesn't exist
            const initialProfile: UserProfile = {
              name: user.displayName || 'New User',
              handle: `@${user.email?.split('@')[0] || 'user'}`,
              bio: '',
              location: '',
              website: '',
              avatar: user.photoURL || `https://i.pravatar.cc/150?u=${user.uid}`,
              cover: null,
              role: 'member',
              followedCreatorIds: [],
              followersCount: 0,
              followingCount: 0,
              onboardingCompleted: true,
              notificationPrefs: {
                push: {
                  likes: true,
                  replies: true,
                  mentions: true,
                  follows: true,
                },
                inApp: {
                  likes: true,
                  replies: true,
                  mentions: true,
                  follows: true,
                }
              }
            };
            setDoc(userDocRef, initialProfile).catch(err => handleFirestoreError(err, OperationType.CREATE, `users/${user.uid}`));
            setUserProfile(initialProfile);
          }
        }, (error) => {
          handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
        });
      } else {
        setUserProfile(null);
        if (unsubscribeProfile) unsubscribeProfile();
      }
      
      setLoading(false);
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, []);

  const updateUserProfile = async (data: Partial<UserProfile>) => {
    if (!user) return;
    const userDocRef = doc(db, 'users', user.uid);
    try {
      await setDoc(userDocRef, data, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
      throw error;
    }
  };

  const login = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Login failed:", error);
      throw error;
    }
  };

  const loginWithEmail = async (email: string, password: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      console.error("Email login failed:", error);
      throw error;
    }
  };

  const registerWithEmail = async (email: string, password: string) => {
    try {
      await createUserWithEmailAndPassword(auth, email, password);
    } catch (error) {
      console.error("Registration failed:", error);
      throw error;
    }
  };

  const resetPassword = async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (error) {
      console.error("Password reset failed:", error);
      throw error;
    }
  };

  const setupRecaptcha = (elementId: string) => {
    return new RecaptchaVerifier(auth, elementId, {
      'size': 'invisible',
      'callback': (response: any) => {
        // reCAPTCHA solved, allow signInWithPhoneNumber.
      }
    });
  };

  const loginWithPhone = async (phoneNumber: string, appVerifier: RecaptchaVerifier) => {
    try {
      return await signInWithPhoneNumber(auth, phoneNumber, appVerifier);
    } catch (error) {
      console.error("Phone login failed:", error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await auth.signOut();
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      userProfile,
      loading, 
      login, 
      loginWithEmail, 
      registerWithEmail, 
      resetPassword, 
      setupRecaptcha,
      loginWithPhone,
      logout,
      updateUserProfile
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within a FirebaseProvider');
  }
  return context;
};
