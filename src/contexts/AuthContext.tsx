import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import {
  auth,
  db,
  googleProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  fbSignOut,
  sendPasswordResetEmail,
  onAuthStateChanged,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  FirebaseUser,
} from "@/lib/firebase";
import { UserProfile } from "@/types/models";

interface AuthContextType {
  user: FirebaseUser | null;
  profile: UserProfile | null;
  loading: boolean;
  profileLoading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, pass: string) => Promise<void>;
  signUpWithEmail: (email: string, pass: string, fullName?: string) => Promise<void>;
  logout: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  updateProfile: (data: Partial<UserProfile>) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);

  const fetchProfile = useCallback(async (uid: string) => {
    setProfileLoading(true);
    try {
      const profileRef = doc(db, "users", uid, "profile", "main");
      const snap = await getDoc(profileRef);
      if (snap.exists()) {
        setProfile(snap.data() as UserProfile);
      } else {
        setProfile(null);
      }
    } catch (err) {
      console.error("[Auth] Error fetching profile:", err);
      setProfile(null);
    } finally {
      setProfileLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!isMounted) return;
      setUser(currentUser);
      if (currentUser) {
        // Ensure root user document exists
        try {
          const userDocRef = doc(db, "users", currentUser.uid);
          await setDoc(
            userDocRef,
            {
              userId: currentUser.uid,
              email: currentUser.email || "",
              updatedAt: new Date().toISOString(),
            },
            { merge: true },
          );
        } catch (e) {
          console.warn("[Auth] Failed to sync root user doc:", e);
        }
        if (isMounted) {
          await fetchProfile(currentUser.uid);
        }
      } else if (isMounted) {
        setProfile(null);
      }
      if (isMounted) {
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [fetchProfile]);

  const signInWithGoogle = async () => {
    setLoading(true);
    try {
      const res = await signInWithPopup(auth, googleProvider);
      if (res.user) {
        // Check if profile exists, if not initialize with Google display name / email
        const profileRef = doc(db, "users", res.user.uid, "profile", "main");
        const snap = await getDoc(profileRef);
        if (!snap.exists()) {
          const newProfile: UserProfile = {
            fullName: res.user.displayName || "",
            headline: "",
            location: "",
            photoURL: res.user.photoURL || "",
            email: res.user.email || "",
            updatedAt: new Date().toISOString(),
            completenessScore: 20,
          };
          await setDoc(profileRef, newProfile);
          setProfile(newProfile);
        } else {
          setProfile(snap.data() as UserProfile);
        }
      }
    } catch (error) {
      console.error("[Auth] Google Sign-In error:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signInWithEmail = async (email: string, pass: string) => {
    setLoading(true);
    try {
      const res = await signInWithEmailAndPassword(auth, email, pass);
      if (res.user) {
        await fetchProfile(res.user.uid);
      }
    } catch (error) {
      console.error("[Auth] Email Sign-In error:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signUpWithEmail = async (email: string, pass: string, fullName?: string) => {
    setLoading(true);
    try {
      const res = await createUserWithEmailAndPassword(auth, email, pass);
      if (res.user) {
        const userDocRef = doc(db, "users", res.user.uid);
        await setDoc(userDocRef, {
          userId: res.user.uid,
          email: res.user.email || email,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        const newProfile: UserProfile = {
          fullName: fullName || "",
          headline: "",
          location: "",
          email: email,
          updatedAt: new Date().toISOString(),
          completenessScore: 10,
        };
        const profileRef = doc(db, "users", res.user.uid, "profile", "main");
        await setDoc(profileRef, newProfile);
        setProfile(newProfile);
      }
    } catch (error) {
      console.error("[Auth] Email Sign-Up error:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await fbSignOut(auth);
      setUser(null);
      setProfile(null);
    } catch (error) {
      console.error("[Auth] Logout error:", error);
      throw error;
    }
  };

  const sendPasswordReset = async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (error) {
      console.error("[Auth] Password reset error:", error);
      throw error;
    }
  };

  const updateProfile = async (data: Partial<UserProfile>) => {
    if (!user) throw new Error("User must be logged in to update profile");
    const profileRef = doc(db, "users", user.uid, "profile", "main");

    // Calculate completeness score based on filled fields
    const updated: UserProfile = {
      ...(profile || {
        fullName: "",
        headline: "",
        location: "",
        email: user.email || "",
      }),
      ...data,
      updatedAt: new Date().toISOString(),
    };

    let score = 0;
    if (updated.fullName) score += 15;
    if (updated.headline) score += 15;
    if (updated.location) score += 10;
    if (updated.photoURL) score += 10;
    if (updated.about) score += 15;
    if (updated.linkedinURL) score += 10;
    if (updated.skills && updated.skills.length > 0) score += 10;
    if (updated.experience && updated.experience.length > 0) score += 15;
    updated.completenessScore = Math.min(100, score);

    await setDoc(profileRef, updated, { merge: true });
    setProfile(updated);
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.uid);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        profileLoading,
        signInWithGoogle,
        signInWithEmail,
        signUpWithEmail,
        logout,
        sendPasswordReset,
        updateProfile,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
