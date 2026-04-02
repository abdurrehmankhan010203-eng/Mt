@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=Noto+Nastaliq+Urdu:wght@400;500;600;700&display=swap');
@import "tailwindcss";

@font-face {
  font-family: 'Jameel Noori Nastaleeq';
  src: url('https://cdn.jsdelivr.net/gh/nafeesalvi/urdu-fonts/fonts/JameelNooriNastaleeq.ttf') format('truetype');
  font-weight: normal;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: 'Al Majeed Quranic Font';
  src: url('https://cdn.jsdelivr.net/gh/nafeesalvi/urdu-fonts/fonts/AlQalamQuranMajeed.ttf') format('truetype');
  font-weight: normal;
  font-style: normal;
  font-display: swap;
}

@theme {
  --font-sans: "Inter", ui-sans-serif, system-ui, sans-serif;
  --font-serif: "Playfair Display", serif;
  --font-urdu: "Jameel Noori Nastaleeq", "Noto Nastaliq Urdu", serif;
  --font-quran: "Al Majeed Quranic Font", "Amiri", serif;
  --animate-spin-slow: spin 3s linear infinite;
}

@layer base {
  :root {
    --bg-primary: #FFFFFF;
    --bg-secondary: #F8F9FA;
    --accent: var(--color-accent, #2E7D32);
    --accent-rgb: 46, 125, 50;
    --accent-hover: #1B5E20;
    --text-primary: #000000;
    --text-secondary: #424242;
    --border-color: #000000;
    --card-bg: #E5E7EB;
    --card-hover: #D1D5DB;
    --card-text: #000000;
    --card-text-secondary: #374151;
    --texture-color: #000000;
    --glow-color: rgba(0, 0, 0, 0.1);
    --heading-color: #000000;
    --box-glow: rgba(0, 0, 0, 0.2);
    --heading-bg: transparent;
    --hero-bg: #111827;
    --hero-text: #FFFFFF;
    --hero-overlay: rgba(0, 0, 0, 0.6);
    --font-main: 'Inter', sans-serif;
  }

  .dark {
    --bg-primary: #000000;
    --bg-secondary: #0A0A0A;
    --accent: var(--color-accent, #FF4500);
    --accent-rgb: 255, 69, 0;
    --accent-hover: #E65100;
    --text-primary: #E0E0E0;
    --text-secondary: #A0A0A0;
    --border-color: #1C1C1C;
    --card-bg: #1A1A1A;
    --card-hover: #2D2D2D;
    --card-text: #E0E0E0;
    --card-text-secondary: #A0A0A0;
    --texture-color: #FFFFFF;
    --glow-color: rgba(255, 69, 0, 0.1);
    --heading-color: #E0E0E0;
    --box-glow: rgba(249, 115, 22, 0.4);
    --heading-bg: transparent;
    --hero-bg: #000000;
    --hero-text: #FFFFFF;
    --hero-overlay: rgba(0, 0, 0, 0.85);
  }

  html {
    scroll-behavior: smooth;
  }
  body {
    font-family: var(--font-body, var(--font-main));
    background-color: var(--bg-primary);
    color: var(--text-primary);
    transition: background-color 0.3s ease, color 0.3s ease, border-color 0.3s ease;
  }
  h1, h2, h3, h4, h5, h6 {
    font-family: var(--font-heading, var(--font-serif));
  }
  .font-urdu {
    font-family: var(--font-urdu, "Jameel Noori Nastaleeq", "Noto Nastaliq Urdu", serif) !important;
    line-height: 1.8 !important;
    letter-spacing: 0.02em !important;
    font-style: normal !important;
  }
  .font-quran {
    font-family: "Al Majeed Quranic Font", "Amiri", serif !important;
  }

  .quran-hadith-box {
    background-color: #333333 !important;
    color: #FFFFFF !important;
    border-radius: 1.5rem; /* 24px - matching rounded-3xl */
    padding: 1.5rem; /* Default padding, will be overridden by tailwind classes if needed */
  }

  .quran-hadith-box .text-theme-primary {
    color: #FFFFFF !important;
  }

  .quran-hadith-box .text-theme-secondary {
    color: #D1D5DB !important; /* Light grey for secondary text */
  }

  .quran-hadith-box .h-px {
    background-color: rgba(255, 255, 255, 0.2) !important;
  }
}

@layer utilities {
  /* Custom Scrollbar for Admin Panel */
  .custom-scrollbar::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }
  .custom-scrollbar::-webkit-scrollbar-track {
    background: transparent;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: #d1d5db;
    border-radius: 10px;
  }
  .dark .custom-scrollbar::-webkit-scrollbar-thumb {
    background: #374151;
  }
}

/* Admin Panel Layout Utilities */
.admin-card {
  @apply bg-white dark:bg-stone-900 p-6 rounded-3xl border border-stone-200 dark:border-stone-800 shadow-sm transition-all hover:shadow-md;
}

.admin-button-primary {
  @apply bg-orange-600 text-white px-6 py-2 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-orange-600/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed;
}

.admin-button-secondary {
  @apply bg-stone-100 dark:bg-stone-800 text-stone-900 dark:text-white px-6 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-stone-200 dark:hover:bg-stone-700 transition-all;
}

.admin-input {
  @apply w-full px-4 py-3 rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-black text-stone-900 dark:text-white focus:ring-2 focus:ring-orange-500/20 outline-none transition-all;
}

.admin-label {
  @apply block text-xs font-bold text-stone-500 uppercase tracking-widest mb-2;
}

/* Responsive Grid for Admin Cards */
.admin-grid {
  @apply grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6;
}

/* Modal Content Scrollbar */
.modal-content {
  @apply max-h-[75vh] overflow-y-auto pr-4;
}

/* Quill RTL Support */
.quill-rtl .ql-editor {
  text-align: right;
  direction: rtl;
}

/* Themed Utilities */
.bg-theme-primary { background-color: var(--bg-primary); }
.bg-theme-secondary { background-color: var(--bg-secondary); }
.bg-theme-card { background-color: var(--card-bg); }
.text-theme-primary { color: var(--text-primary); }
.text-theme-secondary { color: var(--text-secondary); }
.text-theme-accent { color: var(--accent); }
.border-theme { border-color: var(--border-color); }

/* Alternating Backgrounds for Verses */
.verse-bg-even {
  background-color: var(--bg-secondary);
}
.verse-bg-odd {
  background-color: var(--bg-primary);
}

/* Sticky Settings Bar */
.settings-bar-blur {
  backdrop-filter: blur(12px);
  background-color: var(--bg-primary);
  opacity: 0.95;
  border-top: 1px solid var(--border-color);
}

/* Texture effect for hero background */
.hero-texture {
  background-image: url("https://www.transparenttextures.com/patterns/black-linen.png");
  opacity: 0.15;
  position: absolute;
  inset: 0;
  pointer-events: none;
}

/* Custom range input styling for volume bar fill */
input[type='range'].volume-slider {
  @apply appearance-none bg-stone-700 h-1 rounded-full overflow-hidden;
}

input[type='range'].volume-slider::-webkit-slider-runnable-track {
  @apply h-1 rounded-full;
}

input[type='range'].volume-slider::-webkit-slider-thumb {
  @apply appearance-none w-0 h-0 shadow-[-100px_0_0_100px_white];
}


.hero-gradient {
  background: linear-gradient(var(--hero-overlay), var(--hero-overlay)), url('https://images.unsplash.com/photo-1584285420379-34ba8dc240a5?ixlib=rb-1.2.1&auto=format&fit=crop&w=1920&q=80') no-repeat center center/cover;
}
