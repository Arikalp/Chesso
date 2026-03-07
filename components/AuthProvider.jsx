"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";

const AuthContext = createContext({ user: null, loading: true });

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        // Enforce 1-week session limit
        const lastSignInTime = new Date(firebaseUser.metadata.lastSignInTime).getTime();
        const currentTime = new Date().getTime();
        const oneWeekInMs = 7 * 24 * 60 * 60 * 1000;

        if (currentTime - lastSignInTime > oneWeekInMs) {
          import("firebase/auth").then(({ signOut }) => {
            signOut(auth);
          });
          return;
        }

        setUser(firebaseUser);
        setLoading(false);

        localStorage.setItem("userToken", firebaseUser.accessToken);
        localStorage.setItem("userId", firebaseUser.uid);
        localStorage.setItem(
          "userName",
          firebaseUser.displayName || firebaseUser.email
        );
      } else {
        setUser(null);
        setLoading(false);

        localStorage.removeItem("userToken");
        localStorage.removeItem("userId");
        localStorage.removeItem("userName");
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
