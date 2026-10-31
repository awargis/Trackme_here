import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  User,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleAuthProvider = new GoogleAuthProvider();

let cachedIdToken: string | null = null;

export const initFirebaseAuth = (
  onUserChange: (user: User | null, token: string | null) => void
) => {
  return onAuthStateChanged(auth, async (user) => {
    if (user) {
      try {
        cachedIdToken = await user.getIdToken();
        onUserChange(user, cachedIdToken);
      } catch {
        cachedIdToken = null;
        onUserChange(user, null);
      }
    } else {
      cachedIdToken = null;
      onUserChange(null, null);
    }
  });
};

export const signInWithGooglePopup = async (): Promise<{
  user: User;
  idToken: string;
}> => {
  const result = await signInWithPopup(auth, googleAuthProvider);
  const token = await result.user.getIdToken();
  cachedIdToken = token;
  return { user: result.user, idToken: token };
};

export const signOutUser = async () => {
  await auth.signOut();
  cachedIdToken = null;
};

export const signInWithGoogle = signInWithGooglePopup;
export const logout = signOutUser;

export const getCurrentIdToken = async (): Promise<string | null> => {
  if (auth.currentUser) {
    cachedIdToken = await auth.currentUser.getIdToken();
  }
  return cachedIdToken;
};
