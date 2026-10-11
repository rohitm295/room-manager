// RoomFlow shared utilities

// =============================================
// RoomFlow — Shared JavaScript Utilities
// Powered by Jatav Industries
// =============================================

"use strict";

// Firebase configuration — RoomFlow project
const ROOMFLOW_CONFIG = {
  apiKey: "AIzaSyCXFw-DrK_ulN3fUYtq2cT85E2mJa8RKUI",
  authDomain: "roomflow-6c920.firebaseapp.com",
  projectId: "roomflow-6c920",
  storageBucket: "roomflow-6c920.firebasestorage.app",
  messagingSenderId: "827966111309",
  appId: "1:827966111309:web:85a6bdb0b98f3a865a2604",
  measurementId: "G-1YGPS03PKC"
};

// ---------------------------------------------
// 1. Common helpers
// ---------------------------------------------

const RoomFlow = {
  appName: "RoomFlow",
  currency: "INR",

  // Format amount as Indian Rupees
  formatMoney(amount) {
    const value = Number(amount);

    if (!Number.isFinite(value)) {
      return "₹0.00";
    }

    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  },

  // Format date safely
  formatDate(dateValue) {
    if (!dateValue) return "—";

    let date;

    if (dateValue instanceof Date) {
      date = dateValue;
    } else if (
      typeof dateValue === "object" &&
      typeof dateValue.toDate === "function"
    ) {
      // Firestore Timestamp
      date = dateValue.toDate();
    } else {
      date = new Date(dateValue);
    }

    if (Number.isNaN(date.getTime())) {
      return "—";
    }

    return new Intl.DateTimeFormat("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    }).format(date);
  },

  // Today's date in YYYY-MM-DD format
  today() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  },

  // Generate a month key, e.g. 2026-10
  monthKey(dateValue = new Date()) {
    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
      return "";
    }

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");

    return `${year}-${month}`;
  },

  // Safely display a message
  showMessage(message, type = "info", containerId = "message") {
    let element = document.getElementById(containerId);

    if (!element) {
      element = document.createElement("div");
      element.id = containerId;
      element.className = "form-message";
      element.setAttribute("role", "status");

      const target =
        document.querySelector("main") ||
        document.querySelector(".app-content") ||
        document.body;

      target.prepend(element);
    }

    element.textContent = String(message);
    element.className = `form-message ${type}`;
    element.hidden = false;

    return element;
  },

  // Clear a message
  clearMessage(containerId = "message") {
    const element = document.getElementById(containerId);

    if (element) {
      element.textContent = "";
      element.hidden = true;
    }
  },

  // Read a query parameter
  getQueryParam(name) {
    return new URLSearchParams(window.location.search).get(name);
  },

  // Safe HTML escaping for text inserted into HTML templates
  escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => {
      const entities = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      };

      return entities[character];
    });
  },

  // Show or hide loading state on a button
  setButtonLoading(button, isLoading, loadingText = "Please wait...") {
    if (!button) return;

    if (isLoading) {
      if (!button.dataset.originalText) {
        button.dataset.originalText = button.textContent;
      }

      button.disabled = true;
      button.textContent = loadingText;
      button.setAttribute("aria-busy", "true");
    } else {
      button.disabled = false;
      button.textContent =
        button.dataset.originalText || button.textContent;

      delete button.dataset.originalText;
      button.removeAttribute("aria-busy");
    }
  },

  // Calculate the number of days between today and a due date
  daysUntil(dateValue) {
    if (!dateValue) return null;

    const dueDate = new Date(`${dateValue}T00:00:00`);
    if (Number.isNaN(dueDate.getTime())) return null;

    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);

    return Math.round(
      (dueDate.getTime() - todayDate.getTime()) /
      (1000 * 60 * 60 * 24)
    );
  },

  // Determine payment status from a due date
  getDueStatus(dateValue, isPaid = false) {
    if (isPaid) return "paid";

    const days = this.daysUntil(dateValue);

    if (days === null) return "pending";
    if (days < 0) return "overdue";
    if (days === 0) return "due-today";

    return "pending";
  },

  // Basic email validation for form feedback only
  isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      String(email || "").trim()
    );
  }
};

// ---------------------------------------------
// 2. Theme preference
// ---------------------------------------------

RoomFlow.theme = {
  get() {
    try {
      return localStorage.getItem("roomflow-theme") || "light";
    } catch {
      return "light";
    }
  },

  set(theme) {
    const selectedTheme = theme === "dark" ? "dark" : "light";

    try {
      localStorage.setItem("roomflow-theme", selectedTheme);
    } catch {
      // Storage may be unavailable; still apply the theme.
    }

    document.documentElement.dataset.theme = selectedTheme;
    document.documentElement.classList.toggle(
      "dark-theme",
      selectedTheme === "dark"
    );

    return selectedTheme;
  },

  toggle() {
    return this.set(this.get() === "dark" ? "light" : "dark");
  },

  init() {
    this.set(this.get());

    document.querySelectorAll("[data-theme-toggle]").forEach(button => {
      button.addEventListener("click", () => {
        const nextTheme = this.toggle();
        button.setAttribute(
          "aria-label",
          `Switch to ${nextTheme === "dark" ? "dark" : "light"} theme`
        );
      });
    });
  }
};

// ---------------------------------------------
// 3. Firebase shared initialization
// ---------------------------------------------

// Firebase SDK modules must be imported by each HTML page.
// This helper uses an existing Firebase app if one is already
// initialized; it does not load the SDK automatically.

RoomFlow.getFirebase = async function () {
  if (!window.firebaseModules) {
    throw new Error(
      "Firebase modules are not loaded. Import Firebase in the HTML page first."
    );
  }

  const modules = window.firebaseModules;

  return {
    auth: modules.auth,
    db: modules.db,
    config: ROOMFLOW_CONFIG
  };
};

// ---------------------------------------------
// 4. Authentication helpers
// ---------------------------------------------

RoomFlow.requireLogin = function (auth, redirectTo = "login.html") {
  return new Promise((resolve, reject) => {
    if (!auth || typeof auth.onAuthStateChanged !== "function") {
      reject(new Error("Firebase Authentication is not initialized."));
      return;
    }

    let unsubscribe = () => {};

    unsubscribe = auth.onAuthStateChanged(
      user => {
        unsubscribe();

        if (!user) {
          const currentPage = window.location.pathname
            .split("/")
            .pop();

          const returnTo = currentPage
            ? `?next=${encodeURIComponent(currentPage)}`
            : "";

          window.location.href = `${redirectTo}${returnTo}`;
          resolve(null);
          return;
        }

        resolve(user);
      },
      error => {
        unsubscribe();
        reject(error);
      }
    );
  });
};

RoomFlow.logout = async function (auth, redirectTo = "login.html") {
  if (!auth || typeof auth.signOut !== "function") {
    throw new Error("Firebase Authentication is not initialized.");
  }

  await auth.signOut();
  window.location.href = redirectTo;
};

// ---------------------------------------------
// 5. User profile helpers
// ---------------------------------------------

RoomFlow.getUserProfile = async function (db, uid) {
  if (!db || !uid) {
    throw new Error("Database and user ID are required.");
  }

  const { doc, getDoc } = await import(
    "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js"
  );

  const profileRef = doc(db, "users", uid);
  const profileSnapshot = await getDoc(profileRef);

  if (!profileSnapshot.exists()) {
    return null;
  }

  return profileSnapshot.data();
};

RoomFlow.updateProfileName = async function (auth, fullName) {
  const cleanName = String(fullName || "").trim();

  if (!cleanName) {
    throw new Error("Please enter your name.");
  }

  if (!auth || !auth.currentUser) {
    throw new Error("Please log in first.");
  }

  const { updateProfile } = await import(
    "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js"
  );

  await updateProfile(auth.currentUser, {
    displayName: cleanName
  });
};

// ---------------------------------------------
// 6. Common page initialization
// ---------------------------------------------

document.addEventListener("DOMContentLoaded", () => {
  RoomFlow.theme.init();

  // Automatically update elements displaying today's date
  document.querySelectorAll("[data-today]").forEach(element => {
    element.textContent = RoomFlow.today();
  });

  // Format currency values
  document.querySelectorAll("[data-money]").forEach(element => {
    element.textContent = RoomFlow.formatMoney(
      element.dataset.money
    );
  });

  // Set the current year in the footer
  document.querySelectorAll("[data-current-year]").forEach(element => {
    element.textContent = new Date().getFullYear();
  });

  // Confirm before deleting items
  document.querySelectorAll("[data-confirm]").forEach(element => {
    element.addEventListener("click", event => {
      const message =
        element.dataset.confirm || "Are you sure you want to continue?";

      if (!window.confirm(message)) {
        event.preventDefault();
      }
    });
  });
});

// Expose shared helpers for other scripts
window.RoomFlow = RoomFlow;
window.ROOMFLOW_CONFIG = ROOMFLOW_CONFIG;
