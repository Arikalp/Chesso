"use client";

import { useId } from "react";
import Link from "next/link";
import styles from "./Logo.module.css";

export default function Logo({
  size = "md",
  showText = true,
  showTagline = false,
  taglineText = "Chess Reimagined",
  linkToLobby = false,
  className = "",
  onClick,
}) {
  const rawId = useId();
  const id = rawId.replace(/[^a-zA-Z0-9]/g, "");

  const sizeClass = {
    sm: styles.sizeSm,
    md: styles.sizeMd,
    lg: styles.sizeLg,
    xl: styles.sizeXl,
  }[size] || styles.sizeMd;

  const content = (
    <div
      className={`${styles.logoWrapper} ${sizeClass} ${linkToLobby || onClick ? styles.clickable : ""} ${className}`}
      onClick={onClick}
    >
      {/* ── Geometric Cyber-Knight Emblem (SVG) ── */}
      <div className={styles.emblemContainer}>
        <svg
          viewBox="0 0 100 100"
          className={styles.emblemSvg}
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <defs>
            {/* Hexagon Border Neon Gradient */}
            <linearGradient id={`hexGrad-${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#f5c542" />
              <stop offset="45%" stopColor="#ffd875" />
              <stop offset="70%" stopColor="#a855f7" />
              <stop offset="100%" stopColor="#c084fc" />
            </linearGradient>

            {/* Inner Shield Gradient */}
            <linearGradient id={`innerShield-${id}`} x1="50%" y1="0%" x2="50%" y2="100%">
              <stop offset="0%" stopColor="#1e1834" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#0d0d16" stopOpacity="0.98" />
            </linearGradient>

            {/* Gold Metallic Knight Gradient */}
            <linearGradient id={`goldKnight-${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ffe699" />
              <stop offset="40%" stopColor="#f5c542" />
              <stop offset="80%" stopColor="#c9932a" />
              <stop offset="100%" stopColor="#92620f" />
            </linearGradient>

            {/* Purple Facet Gradient */}
            <linearGradient id={`purpleFacet-${id}`} x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#6b21a8" />
              <stop offset="50%" stopColor="#a855f7" />
              <stop offset="100%" stopColor="#c084fc" />
            </linearGradient>

            {/* Core Glow Filter */}
            <filter id={`neonGlow-${id}`} x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2.5" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Hexagonal Outer Frame */}
          <polygon
            points="50,5 89,27 89,73 50,95 11,73 11,27"
            fill={`url(#innerShield-${id})`}
            stroke={`url(#hexGrad-${id})`}
            strokeWidth="3.2"
            strokeLinejoin="round"
          />

          {/* Inner Hex Tech Border */}
          <polygon
            points="50,11 83,30 83,70 50,89 17,70 17,30"
            fill="none"
            stroke="#a855f7"
            strokeWidth="0.8"
            strokeOpacity="0.45"
            strokeDasharray="4 2"
          />

          {/* Subtle Circuit Grid in Background */}
          <line x1="22" y1="36" x2="35" y2="36" stroke="#f5c542" strokeWidth="0.8" strokeOpacity="0.3" />
          <circle cx="35" cy="36" r="1.5" fill="#f5c542" fillOpacity="0.6" />
          <line x1="78" y1="64" x2="65" y2="64" stroke="#a855f7" strokeWidth="0.8" strokeOpacity="0.4" />
          <circle cx="65" cy="64" r="1.5" fill="#a855f7" fillOpacity="0.7" />

          {/* ── CROWN atop the Knight ── */}
          <g transform="translate(0, 0)">
            <polygon
              points="38,28 34,16 44,22 50,13 56,22 66,16 62,28"
              fill={"url(#goldKnight-" + id + ")"}
              stroke="#ffd875"
              strokeWidth="0.75"
              strokeLinejoin="round"
            />
            {/* Center Crown Gem */}
            <polygon points="50,18 52,21 50,24 48,21" fill="#fff" />
            <circle cx="50" cy="21" r="1" fill="#38bdf8" />
          </g>

          {/* ── GEOMETRIC CYBER KNIGHT ── */}
          <g>
            {/* Knight Base / Pedestal */}
            <path
              d="M32 78 L68 78 L65 73 L35 73 Z"
              fill={"url(#goldKnight-" + id + ")"}
              stroke="#ffd875"
              strokeWidth="0.8"
            />
            <line x1="37" y1="75.5" x2="63" y2="75.5" stroke="#fff" strokeWidth="0.6" strokeOpacity="0.7" />

            {/* Chest & Body Facets */}
            <polygon
              points="37,73 45,55 55,55 63,73"
              fill={"url(#purpleFacet-" + id + ")"}
              stroke="#c084fc"
              strokeWidth="0.6"
            />
            <polygon
              points="45,55 50,38 55,55"
              fill={"url(#goldKnight-" + id + ")"}
              stroke="#ffd875"
              strokeWidth="0.6"
            />

            {/* Back Mane / Tech Stepped Plates */}
            <polygon points="53,32 62,35 60,43 51,39" fill="#7e22ce" stroke="#a855f7" strokeWidth="0.5" />
            <polygon points="55,42 64,45 62,54 53,50" fill="#6b21a8" stroke="#a855f7" strokeWidth="0.5" />
            <polygon points="56,53 66,56 63,65 54,61" fill="#581c87" stroke="#a855f7" strokeWidth="0.5" />

            {/* Knight Head & Snout */}
            <polygon
              points="50,33 41,36 34,44 38,47 43,44 48,46 51,39"
              fill={"url(#goldKnight-" + id + ")"}
              stroke="#fff"
              strokeWidth="0.8"
              strokeLinejoin="round"
            />

            {/* Snout lower jaw */}
            <polygon
              points="34,44 38,47 41,52 38,51"
              fill="#92620f"
              stroke="#f5c542"
              strokeWidth="0.6"
            />

            {/* Cheek facet */}
            <polygon
              points="43,44 48,46 47,56 42,53"
              fill={"url(#purpleFacet-" + id + ")"}
              stroke="#c084fc"
              strokeWidth="0.5"
            />

            {/* Cybernetic Glowing Eye */}
            <polygon points="41,40 44,40 43,42 40,42" fill="#38bdf8" />
            <circle cx="42" cy="41" r="1.3" fill="#ffffff" filter={"url(#neonGlow-" + id + ")"} />

            {/* Tech Circuit Line across neck */}
            <path
              d="M48 46 L45 55 L42 66"
              fill="none"
              stroke="#ffd875"
              strokeWidth="0.9"
              strokeLinecap="round"
            />
            <circle cx="45" cy="55" r="1.2" fill="#f5c542" />
          </g>

          {/* Accent Mini-Stars on Shield Corners */}
          <circle cx="16" cy="29" r="1.2" fill="#f5c542" />
          <circle cx="84" cy="29" r="1.2" fill="#a855f7" />
          <circle cx="50" cy="91" r="1.5" fill="#f5c542" />
        </svg>
      </div>

      {/* ── Brand Typography ── */}
      {showText && (
        <div className={styles.textGroup}>
          <div className={styles.brandRow}>
            <span className={styles.crownIcon}>♔</span>
            <span className={styles.brandName}>
              <span className={styles.cyberWord}>CYBER</span>
              <span className={styles.chessWord}>CHESS</span>
            </span>
            <span className={styles.crownIcon}>♛</span>
          </div>
          {showTagline && (
            <div className={styles.tagline}>
              <span className={styles.taglineDot} />
              <span>{taglineText}</span>
              <span className={styles.taglineDot} />
            </div>
          )}
        </div>
      )}
    </div>
  );

  if (linkToLobby) {
    return (
      <Link href="/lobby" style={{ textDecoration: "none", display: "inline-flex" }}>
        {content}
      </Link>
    );
  }

  return content;
}
