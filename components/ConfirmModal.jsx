"use client";

import { useState } from "react";
import styles from "./ConfirmModal.module.css";

export default function ConfirmModal({
  isOpen,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "default",
  onConfirm,
  onCancel,
}) {
  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onCancel}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <span className={styles.headerIcon}>
            {variant === "danger" ? "⚠️" : variant === "success" ? "✅" : "❓"}
          </span>
          <h3 className={styles.title}>{title}</h3>
        </div>
        <p className={styles.message}>{message}</p>
        <div className={styles.actions}>
          <button className={styles.cancelBtn} onClick={onCancel}>
            {cancelText}
          </button>
          <button
            className={`${styles.confirmBtn} ${variant === "danger" ? styles.danger : variant === "success" ? styles.successBtn : ""}`}
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
