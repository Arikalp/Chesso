"use client";

import styles from "./Footer.module.css";

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <p>
        Developed by{" "}
        <a 
          href="https://arikalp.vercel.app" 
          target="_blank" 
          rel="noopener noreferrer"
          className={styles.gradientLink}
        >
          Sankalp
        </a>{" "}
        with ❤️
      </p>
    </footer>
  );
}
