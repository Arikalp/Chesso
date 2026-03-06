"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  updateProfile,
} from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { useAuth } from "@/components/AuthProvider";
import { useTheme } from "@/components/ThemeProvider";
import Footer from "@/components/Footer";
import styles from "./auth.module.css";

export default function AuthPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [activeTab, setActiveTab] = useState("login");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [signupName, setSignupName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [showLoginPw, setShowLoginPw] = useState(false);
  const [showSignupPw, setShowSignupPw] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      router.replace("/lobby");
    }
  }, [user, loading, router]);

  async function handleLogin() {
    if (!loginEmail || !loginPassword) {
      alert("Please fill in all fields");
      return;
    }
    try {
      await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
      router.push("/lobby");
    } catch (error) {
      alert("Login failed: " + error.message);
    }
  }

  async function handleSignup() {
    if (!signupName || !signupEmail || !signupPassword) {
      alert("Please fill in all fields");
      return;
    }
    try {
      const result = await createUserWithEmailAndPassword(
        auth,
        signupEmail,
        signupPassword
      );
      await updateProfile(result.user, { displayName: signupName });

      await setDoc(doc(db, "users", result.user.uid), {
        name: signupName,
        email: signupEmail,
        createdAt: serverTimestamp(),
        isOnline: true,
      });

      router.push("/lobby");
    } catch (error) {
      alert("Signup failed: " + error.message);
    }
  }

  async function handleGoogleSignIn() {
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      await setDoc(
        doc(db, "users", result.user.uid),
        {
          name: result.user.displayName,
          email: result.user.email,
          createdAt: serverTimestamp(),
          isOnline: true,
        },
        { merge: true }
      );
      router.push("/lobby");
    } catch (error) {
      alert("Google sign-in failed: " + error.message);
    }
  }

  if (loading || user) {
    return (
      <div className={styles.authContainer}>
        <div className={styles.authCard}>
          <h1>♔ Chesso ♛</h1>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className={styles.authContainer}>
        <div className={styles.authCard}>
          <div className={styles.headerRow}>
            <h1>♔ Chesso ♛</h1>
            <button onClick={toggleTheme} className={styles.themeBtn}>
              {theme === "dark" ? "☀️" : "🌙"}
            </button>
          </div>

          <div className={styles.authTabs}>
            <button
              className={`${styles.tabBtn} ${activeTab === "login" ? styles.active : ""}`}
              onClick={() => setActiveTab("login")}
            >
              Login
            </button>
            <button
              className={`${styles.tabBtn} ${activeTab === "signup" ? styles.active : ""}`}
              onClick={() => setActiveTab("signup")}
            >
              Sign Up
            </button>
          </div>

          {activeTab === "login" && (
            <div className={styles.authForm}>
              <input
                type="email"
                placeholder="Email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              />
              <div className={styles.passwordContainer}>
                <input
                  type={showLoginPw ? "text" : "password"}
                  placeholder="Password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                />
                <button
                  type="button"
                  className={styles.togglePassword}
                  onClick={() => setShowLoginPw(!showLoginPw)}
                >
                  {showLoginPw ? "🙈" : "👁️"}
                </button>
              </div>
              <button onClick={handleLogin}>Login</button>
            </div>
          )}

          {activeTab === "signup" && (
            <div className={styles.authForm}>
              <input
                type="text"
                placeholder="Display Name"
                value={signupName}
                onChange={(e) => setSignupName(e.target.value)}
              />
              <input
                type="email"
                placeholder="Email"
                value={signupEmail}
                onChange={(e) => setSignupEmail(e.target.value)}
              />
              <div className={styles.passwordContainer}>
                <input
                  type={showSignupPw ? "text" : "password"}
                  placeholder="Password"
                  value={signupPassword}
                  onChange={(e) => setSignupPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSignup()}
                />
                <button
                  type="button"
                  className={styles.togglePassword}
                  onClick={() => setShowSignupPw(!showSignupPw)}
                >
                  {showSignupPw ? "🙈" : "👁️"}
                </button>
              </div>
              <button onClick={handleSignup}>Sign Up</button>
            </div>
          )}

          <div className={styles.divider}>
            <span>or</span>
          </div>

          <button className={styles.googleBtn} onClick={handleGoogleSignIn}>
            <img
              src="https://developers.google.com/identity/images/g-logo.png"
              alt="Google"
              width={20}
              height={20}
            />
            Continue with Google
          </button>
        </div>
      </div>
      <Footer />
    </>
  );
}
