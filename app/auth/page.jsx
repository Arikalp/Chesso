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
import { useToast } from "@/components/Toast";
import Footer from "@/components/Footer";
import styles from "./auth.module.css";

export default function AuthPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState("login");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [signupName, setSignupName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [showLoginPw, setShowLoginPw] = useState(false);
  const [showSignupPw, setShowSignupPw] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      router.replace("/lobby");
    }
  }, [user, loading, router]);

  async function handleLogin() {
    if (!loginEmail || !loginPassword) {
      toast.warning("Please fill in all fields");
      return;
    }
    setIsSubmitting(true);
    try {
      await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
      toast.success("Welcome back!");
      router.push("/lobby");
    } catch (error) {
      const msg = getFriendlyError(error.code);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSignup() {
    if (!signupName || !signupEmail || !signupPassword) {
      toast.warning("Please fill in all fields");
      return;
    }
    if (signupPassword.length < 6) {
      toast.warning("Password must be at least 6 characters");
      return;
    }
    setIsSubmitting(true);
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

      toast.success("Account created successfully!");
      router.push("/lobby");
    } catch (error) {
      const msg = getFriendlyError(error.code);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleGoogleSignIn() {
    const provider = new GoogleAuthProvider();
    setIsSubmitting(true);
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
      toast.success(`Welcome, ${result.user.displayName}!`);
      router.push("/lobby");
    } catch (error) {
      if (error.code !== "auth/popup-closed-by-user") {
        const msg = getFriendlyError(error.code);
        toast.error(msg);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  function getFriendlyError(code) {
    const errorMap = {
      "auth/email-already-in-use": "This email is already registered. Try logging in instead.",
      "auth/invalid-email": "Please enter a valid email address.",
      "auth/user-not-found": "No account found with this email.",
      "auth/wrong-password": "Incorrect password. Please try again.",
      "auth/invalid-credential": "Invalid email or password. Please try again.",
      "auth/too-many-requests": "Too many attempts. Please wait a moment and try again.",
      "auth/weak-password": "Password is too weak. Use at least 6 characters.",
      "auth/network-request-failed": "Network error. Check your internet connection.",
      "auth/popup-blocked": "Pop-up blocked. Please allow pop-ups for this site.",
    };
    return errorMap[code] || "Something went wrong. Please try again.";
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
                disabled={isSubmitting}
              />
              <div className={styles.passwordContainer}>
                <input
                  type={showLoginPw ? "text" : "password"}
                  placeholder="Password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                  disabled={isSubmitting}
                />
                <button
                  type="button"
                  className={styles.togglePassword}
                  onClick={() => setShowLoginPw(!showLoginPw)}
                >
                  {showLoginPw ? "🙈" : "👁️"}
                </button>
              </div>
              <button onClick={handleLogin} disabled={isSubmitting}>
                {isSubmitting ? "Logging in..." : "Login"}
              </button>
            </div>
          )}

          {activeTab === "signup" && (
            <div className={styles.authForm}>
              <input
                type="text"
                placeholder="Display Name"
                value={signupName}
                onChange={(e) => setSignupName(e.target.value)}
                disabled={isSubmitting}
              />
              <input
                type="email"
                placeholder="Email"
                value={signupEmail}
                onChange={(e) => setSignupEmail(e.target.value)}
                disabled={isSubmitting}
              />
              <div className={styles.passwordContainer}>
                <input
                  type={showSignupPw ? "text" : "password"}
                  placeholder="Password"
                  value={signupPassword}
                  onChange={(e) => setSignupPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSignup()}
                  disabled={isSubmitting}
                />
                <button
                  type="button"
                  className={styles.togglePassword}
                  onClick={() => setShowSignupPw(!showSignupPw)}
                >
                  {showSignupPw ? "🙈" : "👁️"}
                </button>
              </div>
              <button onClick={handleSignup} disabled={isSubmitting}>
                {isSubmitting ? "Creating account..." : "Sign Up"}
              </button>
            </div>
          )}

          <div className={styles.divider}>
            <span>or</span>
          </div>

          <button
            className={styles.googleBtn}
            onClick={handleGoogleSignIn}
            disabled={isSubmitting}
          >
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
