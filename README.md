# QR-Code Monitoring System

**Boarders' In-and-Out QR Code Monitoring System**

---

## Overview

**QR-Code Monitoring System** is a lightweight, offline-capable Progressive Web App (PWA) designed to streamline boarding house management, resident tracking, and curfew enforcement. Built with real-time Firestore database integration, it allows landlords and boarders to log time-in and time-out records seamlessly via QR code scanning.

Developed by **BSIT 2D - Group 5**.

---

## Key Features

* **Dashboard Overview:** Real-time statistics including active boarder statuses, current curfew state, late entry counters, and recent scan logs.
* **Integrated QR Scanner:** Point-and-scan interface using native camera feeds to log entries at the QR code (`BH_GATE_CHECKPOINT`).
* **Resident Management:** Search, view, assign, and manage boarder profiles isolated per boarding house.
* **Curfew & Note Tracking:** Dynamic curfew rules with automated late-entry flags and checkout destination logs.
* **Offline Persistence:** Local browser caching via IndexedDB ensuring continuous app function and scan logging without an active internet connection.
* **PWA & Mobile Ready:** Installable directly to mobile devices with full offline support and standalone app execution.

---

## Built With

* **HTML5** – Structure & Semantic Layout
* **CSS3** – Custom Styling & Responsive Theme Design
* **JavaScript (ES6+)** – Client-side Logic & DOM Rendering
* **Firebase Firestore (v10.8.0)** – Cloud Database & IndexedDB Persistence
* **jsQR & QRCode.js** – Mobile QR Code Decoding & Badge Rendering

---

## Getting Started

1. Clone or download this repository:
   ```bash
   git clone https://github.com/your-username/qr-code-monitoring-system.git
   ```
2. Open `index.html` or `login.html` in any modern web browser.
