import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation, Outlet } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { io, Socket } from 'socket.io-client';
import { 
  BookOpen, 
  Video, 
  FileText, 
  Mail, 
  Phone, 
  Youtube, 
  Facebook, 
  Twitter,
  MessageCircle,
  ChevronRight,
  Menu,
  X,
  Search,
  Book,
  User,
  Quote,
  ArrowLeft,
  Eye,
  Share2,
  Clock,
  Calendar,
  Home as HomeIcon,
  Download,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Play,
  Pause,
  FileDown,
  ChevronLeft,
  ExternalLink,
  Maximize,
  Minimize,
  Sun,
  Moon,
  Plus,
  Edit,
  Trash2,
  LogOut,
  Settings,
  Image as ImageIcon,
  Save,
  AlertCircle,
  Lock,
  Check,
  Upload,
  Bot
} from 'lucide-react';
import { useParams, useNavigate, Navigate } from 'react-router-dom';
import LoadingSpinner from './components/LoadingSpinner';
import ChatWidget from './components/ChatWidget';
import { auth, db, storage, handleFirestoreError, OperationType } from './firebase';
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  signOut, 
  User as FirebaseUser 
} from 'firebase/auth';
import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  onSnapshot, 
  query, 
  orderBy, 
  serverTimestamp,
  getDoc,
  setDoc,
  where,
  limit
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import AdminPanel from './AdminPanel';

// --- Language Context ---

type SiteLanguage = 'en' | 'ur';

const LanguageContext = createContext<{
  language: SiteLanguage;
  setLanguage: (lang: SiteLanguage) => void;
}>({ language: 'en', setLanguage: () => {} });

const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<SiteLanguage>('en');
  
  useEffect(() => {
    // Apply font-urdu class to body if language is Urdu
    if (language === 'ur') {
      document.body.classList.add('font-urdu-active');
    } else {
      document.body.classList.remove('font-urdu-active');
    }
  }, [language]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage }}>
      <div className={language === 'ur' ? 'font-urdu' : ''}>
        {children}
      </div>
    </LanguageContext.Provider>
  );
};

const useLanguage = () => useContext(LanguageContext);

// --- Theme Context ---

export type Theme = 'light' | 'dark';

const ThemeContext = createContext<{
  theme: Theme;
  toggleTheme: () => void;
}>({ theme: 'dark', toggleTheme: () => {} });

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('theme');
    return (saved as Theme) || 'dark';
  });

  useEffect(() => {
    localStorage.setItem('theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);

// --- Settings Context ---

interface SiteSettings {
  homeHeading: string;
  homeHeadingUrdu: string;
  homeSubheading: string;
  homeSubheadingUrdu: string;
  homeText: string;
  homeTextUrdu: string;
  homeImageUrl: string;
  bioText: string;
  bioTextUrdu: string;
  bioImageUrl: string;
  fontFamily: string; // Global
  headingFont: string;
  bodyFont: string;
  urduFont: string;
  themeColor: string;
  textSize: string;
  customFonts: { name: string; url: string; family: string; type: 'english' | 'urdu' }[];
}

const defaultSettings: SiteSettings = {
  homeHeading: "Mufti Munir Shakir Shaheed",
  homeHeadingUrdu: "مفتی منیر شاکر شہید",
  homeSubheading: "Islamic Scholar & Spiritual Guide",
  homeSubheadingUrdu: "اسلامی سکالر اور روحانی پیشوا",
  homeText: "Dedicated to spreading the message of Islam through the Qur’an, reason, logic, and authentic sources.",
  homeTextUrdu: "قرآن، عقل، منطق اور مستند ذرائع کے ذریعے اسلام کا پیغام پھیلانے کے لیے وقف۔",
  homeImageUrl: "https://picsum.photos/seed/islamic/1920/1080",
  bioText: "Mufti Munir Shakir Shaheed was a renowned Islamic scholar...",
  bioTextUrdu: "مفتی منیر شاکر شہید ایک معروف اسلامی سکالر تھے...",
  bioImageUrl: "https://picsum.photos/seed/mufti/400/400",
  fontFamily: "'Inter', sans-serif",
  headingFont: "'Inter', sans-serif",
  bodyFont: "'Inter', sans-serif",
  urduFont: "'Noto Naskh Arabic', serif",
  themeColor: "#ea580c", // orange-600
  textSize: "medium",
  customFonts: []
};

const SettingsContext = createContext<{
  settings: SiteSettings;
  updateSettings: (newSettings: Partial<SiteSettings>) => Promise<void>;
  loading: boolean;
}>({ settings: defaultSettings, updateSettings: async () => {}, loading: true });

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<SiteSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'config', 'main'), (docSnap) => {
      if (docSnap.exists()) {
        setSettings({ ...defaultSettings, ...docSnap.data() });
      }
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'config/main');
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const updateSettings = async (newSettings: Partial<SiteSettings>) => {
    try {
      await setDoc(doc(db, 'config', 'main'), newSettings, { merge: true });
    } catch (error) {
      console.error("Error updating settings:", error);
    }
  };

  useEffect(() => {
    // Apply fonts
    document.documentElement.style.setProperty('--font-main', settings.fontFamily);
    document.documentElement.style.setProperty('--font-heading', settings.headingFont || settings.fontFamily);
    document.documentElement.style.setProperty('--font-body', settings.bodyFont || settings.fontFamily);
    document.documentElement.style.setProperty('--font-urdu', settings.urduFont || "'Noto Naskh Arabic', serif");
    
    // Apply theme color
    document.documentElement.style.setProperty('--color-accent', settings.themeColor);

    // Inject custom fonts
    const styleId = 'custom-fonts-style';
    let styleEl = document.getElementById(styleId) as HTMLStyleElement;
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = styleId;
      document.head.appendChild(styleEl);
    }
    
    const fontFaces = settings.customFonts?.map(f => `
      @font-face {
        font-family: '${f.family}';
        src: url('${f.url}');
        font-display: swap;
      }
    `).join('\n') || '';

    const alQalamFont = `
      @font-face {
        font-family: 'Al Qalam Quran Majeed Web Regular';
        src: url('https://cdn.jsdelivr.net/gh/nafeesalvi/urdu-fonts/fonts/AlQalamQuranMajeed.ttf') format('truetype');
        font-display: swap;
      }
    `;
    
    styleEl.textContent = fontFaces + alQalamFont;
  }, [settings]);

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, loading }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => useContext(SettingsContext);

// --- Auth Context ---

interface AuthContextType {
  user: FirebaseUser | null;
  isAdmin: boolean;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, isAdmin: false, loading: true });

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // Check if user is admin in Firestore or by email
        const adminEmail = "muhammadshakir3098@gmail.com";
        if (currentUser.email === adminEmail) {
          setIsAdmin(true);
        } else {
          try {
            const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
            if (userDoc.exists() && userDoc.data().role === 'admin') {
              setIsAdmin(true);
            } else {
              setIsAdmin(false);
            }
          } catch (error) {
            console.error("Error checking admin status:", error);
            setIsAdmin(false);
          }
        }
      } else {
        setIsAdmin(false);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, isAdmin, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

const useAuth = () => useContext(AuthContext);

const ThemeToggle = () => {
  const { theme, toggleTheme } = useTheme();
  return (
    <button 
      onClick={toggleTheme}
      className="p-2 rounded-xl bg-stone-900 border border-stone-800 text-stone-400 hover:text-orange-500 transition-all shadow-sm flex items-center justify-center"
      title={theme === 'dark' ? 'Switch to Day Mode' : 'Switch to Night Mode'}
    >
      {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
};

type TranslationLanguage = 'en' | 'ur' | 'both';

// --- Real-time Views Context ---

const ViewsContext = createContext<{
  views: Record<string, number>;
  trackView: (id: string) => void;
}>({ views: {}, trackView: () => {} });

const ViewsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [views, setViews] = useState<Record<string, number>>({});
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    const newSocket = io();
    setSocket(newSocket);

    newSocket.on('views:update', (updatedViews: Record<string, number>) => {
      setViews(updatedViews);
    });

    return () => {
      newSocket.close();
    };
  }, []);

  const trackView = (id: string) => {
    if (socket) {
      socket.emit('view:article', id);
    }
  };

  return (
    <ViewsContext.Provider value={{ views, trackView }}>
      {children}
    </ViewsContext.Provider>
  );
};

const useViews = () => useContext(ViewsContext);

// --- Data ---

const getCurrentDateTime = () => {
  // Using the current time from metadata: 2026-03-02T01:12:01-08:00
  const d = new Date('2026-03-02T01:12:01-08:00');
  const day = d.getDate();
  const month = d.toLocaleString('en-US', { month: 'long' });
  const year = d.getFullYear();
  const time = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  return { date: `${day} ${month} ${year}`, time };
};

interface Article {
  id: string;
  title: string;
  urduTitle: string;
  date: string;
  time: string;
  excerpt: string;
  urduContent: string;
  englishContent: string;
  imageUrl?: string;
  createdAt?: any;
}

// --- Components ---

const TextSizeControls: React.FC<{ 
  fontSize: 'small' | 'medium' | 'large' | 'xlarge', 
  setFontSize: (size: 'small' | 'medium' | 'large' | 'xlarge') => void 
}> = ({ fontSize, setFontSize }) => {
  const { theme } = useTheme();
  const sizes: ('small' | 'medium' | 'large' | 'xlarge')[] = ['small', 'medium', 'large', 'xlarge'];
  
  const increaseSize = () => {
    const currentIndex = sizes.indexOf(fontSize);
    if (currentIndex < sizes.length - 1) {
      setFontSize(sizes[currentIndex + 1]);
    }
  };

  const decreaseSize = () => {
    const currentIndex = sizes.indexOf(fontSize);
    if (currentIndex > 0) {
      setFontSize(sizes[currentIndex - 1]);
    }
  };

  const bgColor = theme === 'dark' ? 'bg-stone-900 border-stone-800 text-stone-400 hover:text-white hover:border-orange-600' : 'bg-white border-black text-black hover:text-[#2E7D32] hover:border-[#2E7D32]';

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-1.5">
        <button 
          onClick={decreaseSize}
          className={`w-8 h-8 rounded-lg ${bgColor} border flex items-center justify-center text-[10px] transition-all`}
        >
          A-
        </button>
        <div className={`flex items-center ${theme === 'dark' ? 'bg-stone-900 border-stone-800' : 'bg-white border-black'} rounded-lg p-0.5 border`}>
          {sizes.map((size) => (
            <button
              key={size}
              onClick={() => setFontSize(size)}
              className={`relative px-2 py-1 rounded-md text-[9px] font-bold transition-all ${
                fontSize === size 
                  ? (theme === 'dark' ? 'text-orange-400 bg-orange-900/20' : 'text-white bg-[#2E7D32]')
                  : (theme === 'dark' ? 'text-stone-500 hover:text-stone-300' : 'text-stone-600 hover:text-black')
              }`}
            >
              {size.charAt(0).toUpperCase()}
            </button>
          ))}
        </div>
        <button 
          onClick={increaseSize}
          className={`w-8 h-8 rounded-lg ${bgColor} border flex items-center justify-center text-[10px] transition-all`}
        >
          A+
        </button>
      </div>
    </div>
  );
};

const ViewControls: React.FC<{
  viewMode: 'ayat' | 'paragraph',
  setViewMode: (mode: 'ayat' | 'paragraph') => void,
  language: TranslationLanguage,
  setLanguage: (lang: TranslationLanguage) => void,
  hidePara?: boolean
}> = ({ viewMode, setViewMode, language, setLanguage, hidePara }) => {
  const { theme } = useTheme();
  const accentColor = theme === 'dark' ? 'bg-orange-600' : 'bg-[#2E7D32]';
  const bgColor = theme === 'dark' ? 'bg-stone-900 border-stone-800' : 'bg-white border-black';
  const textColor = theme === 'dark' ? 'text-stone-500 hover:text-stone-300' : 'text-stone-600 hover:text-black';

  return (
    <div className="flex items-center gap-4">
      {/* View Mode Toggle */}
      <div className={`flex ${bgColor} p-0.5 rounded-lg border`}>
        <button
          onClick={() => setViewMode('ayat')}
          className={`px-3 py-1.5 rounded-md text-[10px] font-bold transition-all ${
            viewMode === 'ayat' ? `${accentColor} text-white shadow-sm` : textColor
          }`}
        >
          Ayat
        </button>
        {!hidePara && (
          <button
            onClick={() => setViewMode('paragraph')}
            className={`px-3 py-1.5 rounded-md text-[10px] font-bold transition-all ${
              viewMode === 'paragraph' ? `${accentColor} text-white shadow-sm` : textColor
            }`}
          >
            Para
          </button>
        )}
      </div>

      {/* Language Selection */}
      <div className={`flex ${bgColor} p-0.5 rounded-lg border`}>
        {(['en', 'ur', 'both'] as const).map((lang) => (
          <button
            key={lang}
            onClick={() => setLanguage(lang)}
            className={`px-3 py-1.5 rounded-md text-[10px] font-bold transition-all ${
              language === lang ? `${accentColor} text-white shadow-sm` : textColor
            }`}
          >
            {lang === 'both' ? 'Both' : lang.toUpperCase()}
          </button>
        ))}
      </div>
    </div>
  );
};

const StickySettingsBar: React.FC<{
  fontSize?: 'small' | 'medium' | 'large' | 'xlarge',
  setFontSize?: (size: 'small' | 'medium' | 'large' | 'xlarge') => void,
  viewMode: 'ayat' | 'paragraph',
  setViewMode: (mode: 'ayat' | 'paragraph') => void,
  language: TranslationLanguage,
  setLanguage: (lang: TranslationLanguage) => void,
  showFontSize?: boolean,
  hidePara?: boolean
}> = (props) => {
  const { theme } = useTheme();
  return (
    <div className={`fixed bottom-0 left-0 right-0 z-50 settings-bar-blur border-t ${theme === 'dark' ? 'border-stone-800' : 'border-black'} py-3 px-4 shadow-2xl`}>
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <ViewControls 
            viewMode={props.viewMode} 
            setViewMode={props.setViewMode} 
            language={props.language} 
            setLanguage={props.setLanguage} 
            hidePara={props.hidePara}
          />
        </div>
        {props.showFontSize && props.fontSize && props.setFontSize && (
          <TextSizeControls fontSize={props.fontSize} setFontSize={props.setFontSize} />
        )}
      </div>
    </div>
  );
};

const SearchBar: React.FC<{ 
  placeholder?: string; 
  value?: string; 
  onChange?: (val: string) => void;
}> = ({ placeholder, value = "", onChange }) => {
  const { language } = useLanguage();
  const { theme } = useTheme();
  const [isExpanded, setIsExpanded] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const history = JSON.parse(localStorage.getItem('search_history') || '[]');
    setSuggestions(history);
  }, []);

  const toggleSearch = () => {
    setIsExpanded(!isExpanded);
    if (!isExpanded) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (onChange) onChange(val);
    setShowSuggestions(val.length > 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && value) {
      const history = JSON.parse(localStorage.getItem('search_history') || '[]');
      const filteredHistory = history.filter((h: string) => h !== value);
      const newHistory = [value, ...filteredHistory].slice(0, 5);
      localStorage.setItem('search_history', JSON.stringify(newHistory));
      setSuggestions(newHistory);
      setShowSuggestions(false);
    }
  };

  const selectSuggestion = (s: string) => {
    if (onChange) onChange(s);
    setShowSuggestions(false);
  };

  const alignmentClass = language === 'both' ? 'justify-center' : 'justify-start';

  return (
    <div className={`flex ${alignmentClass} mb-12 relative`}>
      <div 
        className="relative group flex items-center cursor-pointer"
        onMouseEnter={() => setIsExpanded(true)}
        onMouseLeave={() => {
          if (!value) setIsExpanded(false);
          setShowSuggestions(false);
        }}
        onClick={toggleSearch}
      >
        <div className={`flex items-center ${theme === 'dark' ? 'bg-stone-900 border-stone-800' : 'bg-white border-black'} rounded-full transition-all duration-500 overflow-hidden h-12 ${isExpanded ? 'w-64 md:w-80 shadow-lg border-orange-900/50' : 'w-12'}`}>
          <div className="flex items-center justify-center w-12 h-12 flex-shrink-0">
            <Search className="text-stone-500" size={20} />
          </div>
          <input 
            ref={inputRef}
            type="text" 
            value={value}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={() => setShowSuggestions(true)}
            placeholder={placeholder || (language === 'ur' ? 'تلاش کریں...' : 'Search...')}
            className={`bg-transparent border-none focus:outline-none text-sm w-full transition-all duration-500 ${theme === 'dark' ? 'text-stone-100' : 'text-black'} ${isExpanded ? 'opacity-100 pr-4 pl-4' : 'opacity-0 w-0'}`}
            dir={language === 'ur' ? 'rtl' : 'ltr'}
            onClick={(e) => e.stopPropagation()}
          />
        </div>

        {/* Suggestions Dropdown */}
        <AnimatePresence>
          {showSuggestions && isExpanded && suggestions.length > 0 && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className={`absolute top-full left-0 right-0 mt-2 ${theme === 'dark' ? 'bg-stone-900 border-stone-800' : 'bg-white border-black'} rounded-2xl shadow-xl z-50 overflow-hidden`}
            >
              <div className="p-3 border-b border-theme/10">
                <p className="text-[10px] font-bold text-stone-500 uppercase tracking-widest">Recent Searches</p>
              </div>
              <div className="max-h-60 overflow-y-auto">
                {suggestions.filter(s => s.toLowerCase().includes(value.toLowerCase())).map((s, i) => (
                  <button 
                    key={i}
                    onClick={(e) => {
                      e.stopPropagation();
                      selectSuggestion(s);
                    }}
                    className={`w-full text-left px-6 py-3 text-sm flex items-center gap-3 transition-colors ${theme === 'dark' ? 'text-stone-400 hover:bg-orange-900/20 hover:text-orange-400' : 'text-stone-700 hover:bg-stone-50'}`}
                  >
                    <Clock size={14} className="text-stone-500" />
                    <span>{s}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

const VideoCard: React.FC<{ id: string, title: string, description: string, image: string, youtubeUrl?: string }> = ({ id, title, description, image, youtubeUrl }) => {
  const { language } = useLanguage();
  const { theme } = useTheme();
  const navigate = useNavigate();

  const glowColor = theme === 'dark' ? 'rgba(249, 115, 22, 0.4)' : 'rgba(0, 0, 0, 0.2)';
  const borderColor = 'border-theme';
  const hoverBorderColor = theme === 'dark' ? 'hover:border-orange-500/50' : 'hover:border-black';
  const bgColor = 'bg-theme-card';
  const titleColor = 'text-[var(--card-text)]';
  const textColor = 'text-[var(--card-text-secondary)]';

  const handleWatch = () => {
    if (youtubeUrl) {
      window.open(youtubeUrl, "_blank");
    } else {
      navigate(`/videos/${id}`);
    }
  };

  return (
    <motion.div 
      whileHover={{ y: -12, scale: 1.02, boxShadow: `0 20px 40px -10px ${glowColor}` }}
      whileTap={{ scale: 0.98, y: -4 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      className={`${bgColor} rounded-2xl overflow-hidden shadow-sm border ${borderColor} ${hoverBorderColor} cursor-pointer ${language === 'ur' ? 'text-right' : ''}`}
      dir={language === 'ur' ? 'rtl' : 'ltr'}
      onClick={handleWatch}
    >
      <div className="relative aspect-video">
        {image ? (
          <img src={image} alt={title} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" referrerPolicy="no-referrer" />
        ) : (
          <div className="w-full h-full bg-stone-100 dark:bg-stone-800 flex items-center justify-center text-stone-400">
            <Video size={48} />
          </div>
        )}
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
          <div className={`w-12 h-12 ${theme === 'dark' ? 'bg-orange-600' : 'bg-[#2E7D32]'} rounded-full flex items-center justify-center text-white`}>
            <Video size={24} />
          </div>
        </div>
      </div>
      <div className="p-6">
        <h3 className={`font-bold mb-2 ${language === 'ur' ? 'font-urdu text-[30px]' : 'font-serif text-xl'} ${titleColor}`}>{title}</h3>
        <p className={`${textColor} text-sm mb-6 leading-relaxed ${language === 'ur' ? 'font-urdu text-xl' : ''}`}>{description}</p>
        <button className={`w-full py-2.5 ${theme === 'dark' ? 'bg-orange-900/20 text-orange-400 border-orange-900/30' : 'bg-stone-800 text-stone-300 border-stone-700'} font-semibold rounded-lg hover:bg-opacity-40 transition-colors flex items-center justify-center gap-2 border`}>
          <span className={language === 'ur' ? 'font-urdu' : ''}>{language === 'ur' ? 'ابھی دیکھیں' : 'Watch Now'}</span>
          {language === 'ur' ? <ChevronRight size={18} className="rotate-180" /> : <ChevronRight size={18} />}
        </button>
      </div>
    </motion.div>
  );
};

const BookCard: React.FC<{ title: string, urduTitle?: string, description: string, urduDescription?: string, pdfUrl?: string, coverUrl?: string }> = ({ title, urduTitle, description, urduDescription, pdfUrl, coverUrl }) => {
  const { language } = useLanguage();
  const { theme } = useTheme();
  
  const displayTitle = language === 'ur' ? (urduTitle || title) : (language === 'both' ? `${title} (${urduTitle})` : title);
  const displayDescription = language === 'ur' ? (urduDescription || description) : description;

  const glowColor = theme === 'dark' ? 'rgba(249, 115, 22, 0.4)' : 'rgba(0, 0, 0, 0.2)';
  const borderColor = 'border-theme';
  const hoverBorderColor = theme === 'dark' ? 'hover:border-orange-500/50' : 'hover:border-black';
  const bgColor = 'bg-theme-card';
  const titleColor = 'text-[var(--card-text)]';
  const textColor = 'text-[var(--card-text-secondary)]';

  const handleDownload = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (pdfUrl) {
      try {
        const response = await fetch(pdfUrl);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `${title}.pdf`);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
      } catch (error) {
        console.error('Download failed:', error);
        window.open(pdfUrl, '_blank');
      }
    } else {
      alert('Download link not available.');
    }
  };

  return (
    <motion.div 
      whileHover={{ y: -12, scale: 1.02, boxShadow: `0 20px 40px -10px ${glowColor}` }}
      whileTap={{ scale: 0.98, y: -4 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      className={`${bgColor} p-8 rounded-2xl border ${borderColor} ${hoverBorderColor} hover:bg-opacity-50 transition-colors shadow-sm ${language === 'ur' ? 'text-right' : ''}`}
      dir={language === 'ur' ? 'rtl' : 'ltr'}
    >
      <div className="relative h-64 mb-6 rounded-xl overflow-hidden group">
        {coverUrl ? (
          <img src={coverUrl} alt={title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" referrerPolicy="no-referrer" />
        ) : (
          <div className={`w-full h-full ${theme === 'dark' ? 'bg-stone-800' : 'bg-stone-100'} flex items-center justify-center text-stone-400`}>
            <BookOpen size={48} />
          </div>
        )}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
          <a 
            href={pdfUrl} 
            target="_blank" 
            rel="noopener noreferrer"
            className="p-3 bg-white text-black rounded-full hover:scale-110 transition-transform"
            title="Read Online"
          >
            <Eye size={24} />
          </a>
          <button 
            onClick={handleDownload}
            className="p-3 bg-white text-black rounded-full hover:scale-110 transition-transform"
            title="Download PDF"
          >
            <Download size={24} />
          </button>
        </div>
      </div>
      <h3 className={`text-center font-bold mb-3 ${language === 'ur' ? 'font-urdu text-[40px]' : 'font-serif text-2xl'} ${titleColor}`}>{displayTitle}</h3>
      <p className={`${textColor} mb-8 leading-relaxed ${language === 'ur' ? 'font-urdu text-xl' : ''}`}>{displayDescription}</p>
      <div className={`flex flex-wrap gap-4 ${language === 'ur' ? 'justify-start' : 'justify-start'}`}>
        <a 
          href={pdfUrl} 
          target="_blank" 
          rel="noopener noreferrer"
          className={`inline-flex items-center ${theme === 'dark' ? 'text-orange-500 hover:text-orange-400' : 'text-green-400 hover:text-green-300'} font-semibold transition-colors group gap-1`}
        >
          <span className={language === 'ur' ? 'font-urdu' : ''}>{language === 'ur' ? 'آن لائن پڑھیں' : 'Read Online'}</span>
          {language === 'ur' ? <ChevronRight className="mr-1 transform group-hover:-translate-x-1 transition-transform rotate-180" size={18} /> : <ChevronRight className="ml-1 transform group-hover:translate-x-1 transition-transform" size={18} />}
        </a>
        <button 
          onClick={handleDownload}
          className="inline-flex items-center text-stone-500 font-semibold hover:text-stone-300 transition-colors group gap-2"
        >
          <Download size={18} />
          <span className={language === 'ur' ? 'font-urdu' : ''}>{language === 'ur' ? 'ڈاؤن لوڈ کریں' : 'Download PDF'}</span>
        </button>
      </div>
    </motion.div>
  );
};

const ArticleCard: React.FC<{ id: string, title: string, urduTitle: string, date: string, number?: string }> = ({ id, title, urduTitle, date, number }) => {
  const { views } = useViews();
  const { language } = useLanguage();
  const { theme } = useTheme();
  const count = views[id] || 0;

  const glowColor = theme === 'dark' ? 'rgba(249, 115, 22, 0.4)' : 'rgba(0, 0, 0, 0.2)';
  const borderColor = 'border-theme';
  const hoverBorderColor = theme === 'dark' ? 'hover:border-orange-500/50' : 'hover:border-black';
  const bgColor = 'bg-theme-card';
  const titleColor = 'text-[var(--card-text)]';
  const textColor = 'text-[var(--card-text-secondary)]';

  return (
    <Link to={`/articles/${id}`}>
      <motion.div 
        whileHover={{ y: -12, scale: 1.02, boxShadow: `0 20px 40px -10px ${glowColor}` }}
        whileTap={{ scale: 0.98, y: -4 }}
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
        className={`group flex gap-6 items-start p-6 ${bgColor} rounded-2xl border ${borderColor} ${hoverBorderColor} shadow-sm cursor-pointer h-full ${language === 'ur' ? 'flex-row-reverse text-right' : ''}`}
        dir={language === 'ur' ? 'rtl' : 'ltr'}
      >
        <div className={`flex-shrink-0 w-12 h-12 ${theme === 'dark' ? 'bg-stone-800' : 'bg-stone-800'} group-hover:bg-theme-accent/10 rounded-xl flex items-center justify-center text-stone-400 group-hover:text-theme-accent transition-colors font-serif text-lg`}>
          {number || <FileText size={20} />}
        </div>
        <div className="flex-grow">
          {(language === 'en' || language === 'both') && (
            <div className="mb-4">
              <h3 className={`text-xl font-bold ${titleColor} font-serif group-hover:text-theme-accent transition-colors`}>{title}</h3>
            </div>
          )}
          {(language === 'ur' || language === 'both') && (
            <p className={`text-[30px] font-urdu ${titleColor} mb-3 group-hover:text-theme-accent transition-colors`}>{urduTitle}</p>
          )}
          <div className={`flex items-center justify-between text-[10px] sm:text-xs ${textColor} uppercase tracking-wider sm:tracking-widest ${language === 'ur' ? 'flex-row-reverse' : ''}`}>
            <span dir="ltr">{date}</span>
            <span className="flex items-center gap-1">
              <Eye size={10} className="sm:w-3 sm:h-3" /> {count}
            </span>
          </div>
        </div>
      </motion.div>
    </Link>
  );
};

const SurahCard: React.FC<{ number: number, name: string, englishName: string, verses: number }> = ({ number, name, englishName, verses }) => {
  const { language } = useLanguage();
  const { theme } = useTheme();
  const navigate = useNavigate();

  const glowColor = theme === 'dark' ? 'rgba(249, 115, 22, 0.4)' : 'rgba(0, 0, 0, 0.2)';
  const borderColor = 'border-theme';
  const hoverBorderColor = theme === 'dark' ? 'hover:border-orange-500/50' : 'hover:border-black';
  const bgColor = 'bg-theme-card';
  const titleColor = 'text-[var(--card-text)]';
  const textColor = 'text-[var(--card-text-secondary)]';
  const arabicColor = theme === 'dark' ? 'text-theme-accent' : 'text-green-400';

  return (
    <motion.div 
      whileHover={{ y: -12, scale: 1.02, boxShadow: `0 20px 40px -10px ${glowColor}` }}
      whileTap={{ scale: 0.98, y: -4 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      className={`relative z-10 p-6 ${bgColor} rounded-2xl border ${borderColor} flex justify-between items-center ${hoverBorderColor} transition-colors cursor-pointer group shadow-sm ${language === 'ur' ? 'flex-row-reverse text-right' : ''}`} 
      dir={language === 'ur' ? 'rtl' : 'ltr'}
      onClick={() => navigate(`/quran/${number}`)}
    >
      <div className={`flex items-center gap-4 ${language === 'ur' ? 'flex-row-reverse' : ''}`}>
        <span className={`w-10 h-10 ${theme === 'dark' ? 'bg-stone-800' : 'bg-stone-800'} group-hover:bg-theme-accent/10 rounded-lg flex items-center justify-center text-stone-400 group-hover:text-theme-accent font-serif transition-colors`}>{number}</span>
        <div>
          {(language === 'en' || language === 'both') && (
            <h3 className={`font-bold ${titleColor} group-hover:text-theme-accent transition-colors`}>{englishName}</h3>
          )}
          {language === 'both' && (
            <p className={`${textColor} text-xs uppercase tracking-widest`}>{englishName}</p>
          )}
        </div>
      </div>
      <div className={language === 'ur' ? 'text-left' : 'text-right'}>
        {(language === 'ur' || language === 'both') && (
          <p className={`text-[40px] font-quran ${arabicColor} group-hover:text-theme-accent transition-colors`}>{name}</p>
        )}
        <p className={`text-xs ${textColor}`}>{verses} {language === 'ur' ? <span className="font-urdu">آیات</span> : 'Verses'}</p>
      </div>
    </motion.div>
  );
};

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const { language, setLanguage } = useLanguage();
  const { theme } = useTheme();

  const navLinks = [
    { name: language === 'ur' ? 'ہوم' : 'Home', path: '/', icon: <HomeIcon size={16} /> },
    { name: language === 'ur' ? 'مضامین' : 'Articles', path: '/articles', icon: <FileText size={16} /> },
    { name: language === 'ur' ? 'ویڈیوز' : 'Videos', path: '/videos', icon: <Video size={16} /> },
    { name: language === 'ur' ? 'قرآن' : 'Quran', path: '/quran', icon: <Book size={16} /> },
    { name: language === 'ur' ? 'حدیث' : 'Hadith', path: '/hadith', icon: <Quote size={16} /> },
    { name: language === 'ur' ? 'کتب' : 'Books', path: '/books', icon: <BookOpen size={16} /> },
    { name: language === 'ur' ? 'سوانح' : 'Bio', path: '/bio', icon: <User size={16} /> },
  ];

  const activeLinkColor = theme === 'light' ? 'text-white' : 'text-white';
  const inactiveLinkColor = theme === 'light' ? 'text-black hover:text-black hover:bg-black/5' : 'text-theme-secondary hover:text-theme-accent';
  const indicatorColor = theme === 'light' ? 'bg-[#2E7D32]' : 'bg-theme-accent';

  return (
    <header className="fixed top-0 left-0 right-0 bg-theme-primary/80 backdrop-blur-md z-50 border-b border-theme transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 relative">
          <div className="flex-shrink-0 flex items-center z-10">
            <Link to="/" className={`font-bold text-theme-accent font-serif whitespace-nowrap ${language === 'ur' ? 'text-[35px]' : 'text-base sm:text-lg md:text-xl lg:text-2xl'}`}>
              {language === 'ur' ? <span className="font-urdu">مفتی منیر شاکر</span> : 'Mufti Munir Shakir'}
            </Link>
          </div>
          
          <nav className="hidden xl:flex items-center space-x-1 lg:space-x-2 absolute left-1/2 -translate-x-1/2">
            {navLinks.map((link) => (
              <Link 
                key={link.name}
                to={link.path} 
                className={`relative group px-4 py-2 rounded-xl transition-all flex items-center gap-2 font-medium uppercase tracking-wider whitespace-nowrap z-10 hover:scale-110 active:scale-95 ${
                  language === 'ur' ? 'text-[25px]' : 'text-[10px] lg:text-xs'
                } ${
                  location.pathname === link.path ? activeLinkColor : inactiveLinkColor
                }`}
              >
                <span className="relative z-20 flex items-center gap-2 transition-transform duration-300 group-hover:scale-110">
                  {link.icon}
                  {link.name}
                </span>

                {/* Magic Slide Indicator */}
                {location.pathname === link.path && (
                  <motion.div 
                    layoutId="nav-indicator"
                    className={`absolute inset-0 ${indicatorColor} rounded-xl -z-10 shadow-md`}
                    transition={{ type: "spring", stiffness: 350, damping: 30 }}
                  />
                )}
              </Link>
            ))}
          </nav>

          <div className="flex-shrink-0 flex items-center gap-2 sm:gap-4 z-10">
            <ThemeToggle />
            
            {/* Language Switcher */}
            <div className={`hidden xl:flex items-center ${theme === 'light' ? 'bg-stone-100' : 'bg-theme-secondary'} p-1 rounded-lg border border-theme relative`}>
              {(['en', 'ur'] as const).map((lang) => (
                <button
                  key={lang}
                  onClick={() => setLanguage(lang)}
                  className={`relative z-10 px-4 py-1.5 text-[10px] uppercase tracking-widest font-bold rounded-md transition-all ${
                    language === lang 
                      ? 'text-white' 
                      : (theme === 'light' ? 'text-black hover:text-theme-accent' : 'text-theme-secondary hover:text-theme-primary')
                  }`}
                >
                  {language === lang && (
                    <motion.div 
                      layoutId="lang-indicator"
                      className={`absolute inset-0 ${indicatorColor} rounded-md -z-10 shadow-sm`}
                      transition={{ type: "spring", stiffness: 350, damping: 30 }}
                    />
                  )}
                  {lang === 'en' ? 'English' : 'Urdu'}
                </button>
              ))}
            </div>

            <div className="xl:hidden">
              <button onClick={() => setIsOpen(!isOpen)} className="text-theme-secondary p-2 hover:bg-theme-secondary rounded-lg transition-colors">
                {isOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Mobile menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="xl:hidden bg-theme-primary border-b border-theme overflow-hidden shadow-xl"
          >
            <div className="px-4 pt-2 pb-6 space-y-2">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] uppercase tracking-widest font-bold text-theme-secondary">Theme</span>
                <ThemeToggle />
              </div>
              
              {/* Mobile Language Switcher */}
              <div className="flex items-center justify-center gap-2 mb-4 p-2 bg-theme-secondary rounded-xl border border-theme">
                {(['en', 'ur'] as const).map((lang) => (
                  <button
                    key={lang}
                    onClick={() => {
                      setLanguage(lang);
                      setIsOpen(false);
                    }}
                    className={`flex-1 py-2 text-xs uppercase tracking-widest font-bold rounded-lg transition-all ${
                      language === lang 
                        ? 'bg-theme-accent text-white shadow-md' 
                        : 'text-theme-secondary hover:bg-theme-primary'
                    }`}
                  >
                    {lang === 'en' ? 'English' : 'Urdu'}
                  </button>
                ))}
              </div>

              {navLinks.map((link) => (
                <Link 
                  key={link.name}
                  to={link.path} 
                  onClick={() => setIsOpen(false)}
                  className={`flex items-center gap-4 px-4 py-3 rounded-xl transition-colors ${
                    location.pathname === link.path ? 'bg-theme-accent/10 text-theme-accent font-bold' : 'text-theme-secondary hover:bg-theme-secondary'
                  }`}
                >
                  <span className={location.pathname === link.path ? 'text-theme-accent' : 'text-theme-secondary'}>
                    {link.icon}
                  </span>
                  {link.name}
                </Link>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
};

const Footer = () => {
  const { language } = useLanguage();
  return (
    <footer className="bg-theme-secondary border-t border-theme py-16 transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className={`grid grid-cols-1 md:grid-cols-3 gap-12 mb-12 ${language === 'ur' ? 'text-right' : ''}`} dir={language === 'ur' ? 'rtl' : 'ltr'}>
          <div className={language === 'ur' ? 'text-right' : ''}>
            <h3 className={`text-theme-primary font-bold mb-6 font-serif ${language === 'ur' ? 'text-[25px]' : 'text-xl'}`}>
              {language === 'ur' ? <span className="font-urdu">مفتی منیر شاکر</span> : 'Mufti Munir Shakir'}
            </h3>
            <div className="space-y-4">
              {(language === 'en' || language === 'both') && (
                <p className="text-sm leading-relaxed text-theme-secondary">
                  Dedicated to spreading the message of Islam through the Qur’an, reason, logic, and authentic sources.
                </p>
              )}
              {(language === 'ur' || language === 'both') && (
                <p className="text-lg leading-relaxed font-urdu text-theme-secondary">
                  قرآن، عقل، منطق اور مستند ذرائع کے ذریعے اسلام کا پیغام پھیلانے کے لیے وقف۔
                </p>
              )}
            </div>
          </div>
          <div className={`${language === 'ur' ? 'text-center order-2' : ''}`}>
            <h3 className={`text-theme-primary font-bold mb-6 font-serif ${language === 'ur' ? 'font-urdu text-[25px]' : 'text-xl'}`}>
              {language === 'ur' ? 'ہم سے رابطہ کریں' : 'Contact Us'}
            </h3>
            <div className={`space-y-4 ${language === 'ur' ? 'flex flex-col items-center' : ''}`}>
              <a 
                href="mailto:ahmadshakir4466@gmail.com" 
                className={`flex items-center hover:text-theme-accent transition-colors gap-4 group ${language === 'ur' ? 'flex-row-reverse' : ''}`}
              >
                <Mail size={18} className="text-theme-accent group-hover:scale-110 transition-transform" />
                <span className="text-theme-secondary">ahmadshakir4466@gmail.com</span>
              </a>
              <a 
                href="tel:+923069326504" 
                className={`flex items-center hover:text-theme-accent transition-colors gap-4 group ${language === 'ur' ? 'flex-row-reverse' : ''}`}
              >
                <Phone size={18} className="text-theme-accent group-hover:scale-110 transition-transform" />
                <span dir="ltr" className="text-theme-secondary">+92 306 9326504</span>
              </a>
            </div>
          </div>
          <div className={`${language === 'ur' ? 'text-left order-3' : ''}`}>
            <h3 className={`text-theme-primary font-bold mb-6 font-serif ${language === 'ur' ? 'font-urdu text-[25px]' : 'text-xl'}`}>
              {language === 'ur' ? 'ہمیں فالو کریں' : 'Follow Us'}
            </h3>
            <div className={`flex gap-8 ${language === 'ur' ? 'flex-row-reverse justify-start' : ''}`}>
              <a 
                href="https://youtube.com/@muftimunirshakirofficial?si=5tl4FG0_kTo2mQZu" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="hover:text-[#FF0000] transition-colors duration-300 text-theme-secondary hover:scale-125"
              >
                <Youtube size={24} />
              </a>
              <a 
                href="https://www.facebook.com/share/1Cw1G2Sad4/" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="hover:text-[#1877F2] transition-colors duration-300 text-theme-secondary hover:scale-125"
              >
                <Facebook size={24} />
              </a>
              <a 
                href="https://x.com/MuftiMunir2025" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="hover:text-[#000000] transition-colors duration-300 text-theme-secondary hover:scale-125"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
              </a>
              <a 
                href="https://wa.me/923069326504" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="hover:text-[#25D366] transition-colors duration-300 text-theme-secondary hover:scale-125"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.72.94 3.659 1.437 5.634 1.437h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
              </a>
            </div>
          </div>
        </div>
        <div className="pt-8 border-t border-theme flex flex-col md:flex-row justify-center items-center gap-4 text-sm text-theme-secondary">
          <p className="text-center font-medium">&copy; 2026 Mufti Munir Shakir. All Rights Reserved.</p>
        </div>
      </div>
    </footer>
  );
};

const Layout = () => (
  <div className="min-h-screen flex flex-col bg-theme-primary text-theme-primary transition-colors duration-300">
    <Navbar />
    <main className="flex-grow pt-16">
      <Outlet />
    </main>
    <Footer />
  </div>
);

const TextureOverlay = () => {
  const { theme } = useTheme();
  const textureColor = theme === 'dark' ? '%23ffffff' : '%23000000';
  const opacity = theme === 'dark' ? 'opacity-[0.05]' : 'opacity-[0.03]';
  return (
    <div 
      className={`absolute inset-0 ${opacity} pointer-events-none`} 
      style={{ 
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M54.627 0l.83.83L0 55.457V54.627L54.627 0zm5.373 0v.83L.83 60H0v-.83L59.17 0h.83zM30 0l30 30-30 30L0 30 30 0zm0 2.121L2.121 30 30 57.879 57.879 30 30 2.121zM10.586 0L60 49.414v.83L0 1.414V0h10.586zM60 10.586V11.414L11.414 60H10.586L60 10.586zM0 49.414L49.414 0h1.66L0 51.074v-1.66zM0 10.586L10.586 0h1.66L0 12.246v-1.66zM30 10.586L49.414 30 30 49.414 10.586 30 30 10.586zm0 2.121L12.707 30 30 47.293 47.293 30 30 12.707z' fill='${textureColor}' fill-opacity='1' fill-rule='evenodd'/%3E%3C/svg%3E")`
      }} 
    />
  );
};

const GlowingDivider = () => {
  const { theme } = useTheme();
  const colorClass = theme === 'dark' ? 'via-orange-500/40' : 'via-green-500/40';
  const flareClass = theme === 'dark' ? 'via-orange-500' : 'via-green-500';
  const spotClass = theme === 'dark' ? 'bg-orange-500/10' : 'bg-green-500/10';

  return (
    <div className="relative w-full h-px flex items-center justify-center z-20">
      {/* Main fading line */}
      <div className={`w-full h-[1px] bg-gradient-to-r from-transparent ${colorClass} to-transparent`}></div>
      {/* Brighter center flare */}
      <div className={`absolute w-1/2 h-[2px] bg-gradient-to-r from-transparent ${flareClass} to-transparent blur-[1px]`}></div>
      {/* Core white highlight */}
      <div className="absolute w-1/4 h-[1px] bg-gradient-to-r from-transparent via-white to-transparent blur-[0.5px]"></div>
      {/* Center glow spot */}
      <div className={`absolute w-12 h-12 ${spotClass} blur-3xl rounded-full pointer-events-none`}></div>
    </div>
  );
};

const GlowingHeading = ({ children, className = "", urdu = false }: { children: React.ReactNode, className?: string, urdu?: boolean }) => {
  const { theme } = useTheme();
  return (
    <div className="relative inline-block group">
      <h2 className={`${className} relative z-10 ${theme === 'light' ? 'text-black' : ''}`}>
        {children}
      </h2>
    </div>
  );
};

const GlowingHeadingLine = ({ language }: { language: string }) => {
  const { theme } = useTheme();
  const colorClass = theme === 'dark' ? 'bg-orange-600' : 'bg-[#2E7D32]';
  const glowClass1 = theme === 'dark' ? 'bg-orange-500' : 'bg-[#2E7D32]';
  const glowClass2 = theme === 'dark' ? 'bg-orange-400' : 'bg-[#2E7D32]';

  return (
    <div className={`relative w-24 h-1.5 mt-2 ${language === 'ur' ? 'mr-0 ml-auto' : ''}`}>
      <div className={`absolute inset-0 ${colorClass} rounded-full`}></div>
      <div className={`absolute inset-0 ${glowClass1} rounded-full blur-[3px] opacity-70 animate-pulse`}></div>
      <div className={`absolute inset-0 ${glowClass2} rounded-full blur-[6px] opacity-30`}></div>
    </div>
  );
};

const PageHeader = ({ title, subtitle }: { title: React.ReactNode, subtitle?: React.ReactNode }) => {
  const { theme } = useTheme();
  return (
    <section className={`relative ${theme === 'light' ? 'bg-[#2E7D32]' : 'bg-theme-primary'} py-24 text-center overflow-hidden border-b border-theme transition-colors duration-300`}>
      <TextureOverlay />
      
      {/* Decorative light effects */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full bg-[radial-gradient(circle_at_center,rgba(var(--accent-rgb),0.1)_0%,transparent_70%)] pointer-events-none" />
      <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-orange-600/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -top-24 -right-24 w-96 h-96 bg-orange-600/5 rounded-full blur-3xl pointer-events-none" />

      <div className="relative max-w-4xl mx-auto px-4 z-10">
        <div className="relative inline-block group mb-6">
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`text-4xl md:text-6xl font-bold tracking-tight leading-tight ${theme === 'light' ? 'text-white' : 'text-theme-primary'} relative z-10`}
          >
            {title}
          </motion.h1>
          <div className="absolute -inset-x-8 -inset-y-4 bg-theme-accent/10 rounded-3xl opacity-40 group-hover:opacity-80 transition-all duration-700 -z-10 border border-theme blur-md" />
        </div>
        {subtitle && (
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className={`${theme === 'light' ? 'text-stone-100' : 'text-theme-accent/80'} text-lg md:text-xl max-w-2xl mx-auto`}
          >
            {subtitle}
          </motion.p>
        )}
      </div>
    </section>
  );
};

// --- Pages ---

const Home = () => {
  const { language } = useLanguage();
  const { theme } = useTheme();
  const { settings } = useSettings();
  const [articles, setArticles] = useState<any[]>([]);
  const [videos, setVideos] = useState<any[]>([]);
  const [books, setBooks] = useState<any[]>([]);
  const [hadiths, setHadiths] = useState<any[]>([]);
  const [surahs, setSurahs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const collections = ['articles', 'videos', 'books', 'hadith', 'quran_verses'];
    const unsubscribes: (() => void)[] = [];

    const fetchAll = async () => {
      // Articles
      const qArticles = query(collection(db, 'articles'), orderBy('createdAt', 'desc'), limit(2));
      unsubscribes.push(onSnapshot(qArticles, (snapshot) => {
        setArticles(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }, (error) => handleFirestoreError(error, OperationType.LIST, 'articles')));

      // Videos
      const qVideos = query(collection(db, 'videos'), orderBy('createdAt', 'desc'), limit(3));
      unsubscribes.push(onSnapshot(qVideos, (snapshot) => {
        setVideos(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }, (error) => handleFirestoreError(error, OperationType.LIST, 'videos')));

      // Books
      const qBooks = query(collection(db, 'books'), orderBy('createdAt', 'desc'), limit(3));
      unsubscribes.push(onSnapshot(qBooks, (snapshot) => {
        setBooks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }, (error) => handleFirestoreError(error, OperationType.LIST, 'books')));

      // Hadith
      const qHadith = query(collection(db, 'hadith'), orderBy('createdAt', 'desc'), limit(3));
      unsubscribes.push(onSnapshot(qHadith, (snapshot) => {
        setHadiths(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }, (error) => handleFirestoreError(error, OperationType.LIST, 'hadith')));

      // Quran Verses (to derive Surahs)
      const qQuran = query(collection(db, 'quran_verses'), orderBy('createdAt', 'desc'));
      unsubscribes.push(onSnapshot(qQuran, (snapshot) => {
        const verses = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const surahMap = new Map();
        verses.forEach((v: any) => {
          if (!surahMap.has(v.surahNumber)) {
            surahMap.set(v.surahNumber, {
              number: v.surahNumber,
              name: v.surahNameUrdu,
              englishName: v.surahName,
              verses: verses.filter((v2: any) => v2.surahNumber === v.surahNumber).length
            });
          }
        });
        setSurahs(Array.from(surahMap.values()).slice(0, 4));
        setLoading(false);
      }, (error) => handleFirestoreError(error, OperationType.LIST, 'quran_verses')));
    };

    fetchAll();
    return () => unsubscribes.forEach(unsub => unsub());
  }, []);

  return (
    <>
      <section className="relative min-h-[90vh] py-20 flex items-center justify-center text-center px-4 hero-gradient overflow-hidden">
        <div className="hero-texture"></div>
        <div className="max-w-4xl relative z-10">
          <TextureOverlay />
          {/* Pronounced Glow Effects */}
          <div className="absolute -top-40 -left-40 w-[500px] h-[500px] bg-[var(--glow-color)] rounded-full blur-[120px] pointer-events-none -z-10"></div>
          <div className="absolute -bottom-40 -right-40 w-[500px] h-[500px] bg-[var(--glow-color)] rounded-full blur-[120px] pointer-events-none -z-10"></div>
          
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-4xl md:text-6xl font-bold mb-8 font-serif leading-tight"
          >
            {language === 'ur' ? (
              <span className="font-urdu text-[var(--hero-text)]">{settings.homeHeading}</span>
            ) : (
              <span className="text-[var(--hero-text)]">{settings.homeHeading}</span>
            )}
          </motion.h1>

          {(language === 'en' || language === 'both') && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="mb-12"
            >
              <p className="text-base md:text-xl text-[var(--hero-text)] leading-relaxed text-justify md:text-center opacity-90">
                {settings.homeText}
              </p>
            </motion.div>
          )}

          {(language === 'ur' || language === 'both') && (
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="text-lg md:text-3xl lg:text-4xl text-[var(--hero-text)] leading-[1.8] font-urdu mb-8 text-justify md:text-center opacity-90"
            >
              {settings.homeText}
            </motion.p>
          )}

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="flex flex-col sm:flex-row gap-4 justify-center relative z-20"
          >
            <Link 
              to="/bio" 
              className={`px-8 py-4 ${theme === 'light' ? 'bg-[#2E7D32] hover:bg-green-700' : 'bg-orange-600 hover:bg-orange-700'} text-white rounded-full font-bold transition-all shadow-lg flex items-center justify-center gap-2`}
            >
              <User size={20} />
              <span className={language === 'ur' ? 'font-urdu' : ''}>{language === 'ur' ? 'سوانح حیات پڑھیں' : 'Read Biography'}</span>
            </Link>
          </motion.div>
        </div>
      </section>

      <GlowingDivider />

      {/* Video Section on Home */}
    <section className="py-24 bg-theme-primary transition-colors duration-300" dir={language === 'ur' ? 'rtl' : 'ltr'}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className={`flex justify-between items-end mb-12 ${language === 'ur' ? 'flex-row' : ''}`}>
          <div className={language === 'ur' ? 'text-right' : ''}>
            <GlowingHeading className={`text-3xl font-bold text-theme-primary mb-2 ${language === 'ur' ? 'font-urdu text-5xl' : 'font-serif'}`}>
              {language === 'ur' ? 'تازہ ترین ویڈیو پروگرامز' : 'Latest Video Programs'}
            </GlowingHeading>
            <GlowingHeadingLine language={language} />
          </div>
          <Link to="/videos" className={`text-theme-accent font-semibold hover:underline flex items-center gap-1 ${language === 'ur' ? 'font-urdu text-2xl' : ''}`}>
            {language === 'ur' ? <><ChevronRight size={18} className="rotate-180" /> سب دیکھیں</> : <>View All <ChevronRight size={18} /></>}
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {videos.length > 0 ? videos.map((video) => (
            <VideoCard 
              key={video.id}
              id={video.id}
              title={language === 'ur' ? (video.titleUrdu || video.title) : video.title}
              description={language === 'ur' ? (video.descriptionUrdu || video.description) : video.description}
              image={video.thumbnailUrl || "https://images.unsplash.com/photo-1542816417-0983c9c9ad53?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80"}
              youtubeUrl={video.youtubeUrl}
            />
          )) : (
            <div className="col-span-full text-center py-12 text-theme-secondary">
              {language === 'ur' ? 'کوئی ویڈیو نہیں ملی' : 'No videos found'}
            </div>
          )}
        </div>
      </div>
    </section>

    <GlowingDivider />

    {/* Books Section on Home */}
    <section className="py-24 bg-theme-secondary transition-colors duration-300" dir={language === 'ur' ? 'rtl' : 'ltr'}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className={`flex justify-between items-end mb-12 ${language === 'ur' ? 'flex-row' : ''}`}>
          <div className={language === 'ur' ? 'text-right' : ''}>
            <GlowingHeading className={`text-3xl font-bold text-theme-primary mb-2 ${language === 'ur' ? 'font-urdu text-5xl' : 'font-serif'}`}>
              {language === 'ur' ? 'نمایاں کتب' : 'Featured Books'}
            </GlowingHeading>
            <GlowingHeadingLine language={language} />
          </div>
          <Link to="/books" className={`text-theme-accent font-semibold hover:underline flex items-center gap-1 ${language === 'ur' ? 'font-urdu text-2xl' : ''}`}>
            {language === 'ur' ? <><ChevronRight size={18} className="rotate-180" /> سب دیکھیں</> : <>View All <ChevronRight size={18} /></>}
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {books.length > 0 ? books.map((book) => (
            <BookCard 
              key={book.id}
              title={book.title}
              urduTitle={book.titleUrdu}
              description={book.description}
              urduDescription={book.descriptionUrdu}
              coverUrl={book.coverUrl}
              pdfUrl={book.pdfUrl}
            />
          )) : (
            <div className="col-span-full text-center py-12 text-theme-secondary">
              {language === 'ur' ? 'کوئی کتاب نہیں ملی' : 'No books found'}
            </div>
          )}
        </div>
      </div>
    </section>

    <GlowingDivider />

    {/* Articles Section on Home */}
    <section className="py-24 bg-theme-primary" dir={language === 'ur' ? 'rtl' : 'ltr'}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className={`flex justify-between items-end mb-12 ${language === 'ur' ? 'flex-row' : ''}`}>
          <div className={language === 'ur' ? 'text-right' : ''}>
            <GlowingHeading className={`text-3xl font-bold mb-2 ${language === 'ur' ? 'font-urdu text-5xl' : 'font-serif'}`}>
              {language === 'ur' ? 'تازہ ترین مضامین' : 'Recent Articles'}
            </GlowingHeading>
            <GlowingHeadingLine language={language} />
          </div>
          <Link to="/articles" className={`text-theme-accent font-semibold hover:underline flex items-center gap-1 ${language === 'ur' ? 'font-urdu text-2xl' : ''}`}>
            {language === 'ur' ? <><ChevronRight size={18} className="rotate-180" /> سب دیکھیں</> : <>View All <ChevronRight size={18} /></>}
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {articles.length > 0 ? articles.map((article, index) => (
            <div key={article.id} className={index >= 2 ? 'hidden md:block' : ''}>
              <ArticleCard 
                id={article.id}
                title={article.title}
                urduTitle={article.titleUrdu}
                date={article.date || (article.createdAt?.toDate().toLocaleDateString())}
                number={(index + 1).toString().padStart(2, '0')}
              />
            </div>
          )) : (
            <div className="col-span-full text-center py-12 text-theme-secondary">
              {language === 'ur' ? 'کوئی مضمون نہیں ملا' : 'No articles found'}
            </div>
          )}
        </div>
      </div>
    </section>

    <GlowingDivider />

    {/* Hadith Section on Home */}
    <section className="py-24 bg-theme-secondary" dir={language === 'ur' ? 'rtl' : 'ltr'}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className={`flex justify-between items-end mb-12 ${language === 'ur' ? 'flex-row' : ''}`}>
          <div className={language === 'ur' ? 'text-right' : ''}>
            <GlowingHeading className={`text-3xl font-bold mb-2 ${language === 'ur' ? 'font-urdu text-5xl' : 'font-serif'}`}>
              {language === 'ur' ? 'حدیثِ مبارکہ' : 'Hadith Studies'}
            </GlowingHeading>
            <GlowingHeadingLine language={language} />
          </div>
          <Link to="/hadith" className={`text-theme-accent font-semibold hover:underline flex items-center gap-1 ${language === 'ur' ? 'font-urdu text-2xl' : ''}`}>
            {language === 'ur' ? <><ChevronRight size={18} className="rotate-180" /> سب دیکھیں</> : <>View All <ChevronRight size={18} /></>}
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {hadiths.length > 0 ? hadiths.map((hadith) => (
            <motion.div 
              key={hadith.id}
              whileHover={{ y: -12, scale: 1.02, boxShadow: `0 20px 40px -10px ${theme === 'dark' ? 'rgba(249, 115, 22, 0.4)' : 'rgba(0, 0, 0, 0.1)'}` }}
              whileTap={{ scale: 0.98, y: -4 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className="bg-[var(--card-bg)] border border-theme p-8 rounded-2xl shadow-sm transition-colors"
            >
              <Quote className="text-theme-accent mb-4" size={32} />
              <div className="space-y-4">
                {(language === 'ur' || language === 'both') && (
                  <p className="text-[var(--card-text)] font-urdu text-[40px] leading-[1.8] text-right" dir="rtl">
                    {hadith.textUrdu}
                  </p>
                )}
                {(language === 'en' || language === 'both') && (
                  <p className="text-[var(--card-text-secondary)] italic font-serif text-lg">
                    {hadith.text}
                  </p>
                )}
              </div>
              <p className="text-stone-500 text-sm mt-4">{language === 'ur' ? hadith.referenceUrdu : hadith.reference}</p>
            </motion.div>
          )) : (
            <div className="col-span-full text-center py-12 text-theme-secondary">
              {language === 'ur' ? 'کوئی حدیث نہیں ملی' : 'No hadith found'}
            </div>
          )}
        </div>
      </div>
    </section>

    <GlowingDivider />

    {/* Quran Section on Home */}
    <section className="py-24 bg-theme-primary" dir={language === 'ur' ? 'rtl' : 'ltr'}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className={`flex justify-between items-end mb-12 ${language === 'ur' ? 'flex-row' : ''}`}>
          <div className={language === 'ur' ? 'text-right' : ''}>
            <GlowingHeading className={`text-3xl font-bold mb-2 ${language === 'ur' ? 'font-urdu text-5xl' : 'font-serif'}`}>
              {language === 'ur' ? 'قرآنی مطالعہ' : 'Quranic Studies'}
            </GlowingHeading>
            <GlowingHeadingLine language={language} />
          </div>
          <Link to="/quran" className={`text-theme-accent font-semibold hover:underline flex items-center gap-1 ${language === 'ur' ? 'font-urdu text-2xl' : ''}`}>
            {language === 'ur' ? <><ChevronRight size={18} className="rotate-180" /> سب دیکھیں</> : <>View All <ChevronRight size={18} /></>}
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {surahs.length > 0 ? surahs.map((surah) => (
            <SurahCard 
              key={surah.number}
              number={surah.number}
              name={surah.name}
              englishName={surah.englishName}
              verses={surah.verses}
            />
          )) : (
            <div className="col-span-full text-center py-12 text-theme-secondary">
              {language === 'ur' ? 'کوئی قرآنی مطالعہ نہیں ملا' : 'No Quranic studies found'}
            </div>
          )}
        </div>
      </div>
    </section>
  </>
  );
};

const Articles = () => {
  const { views } = useViews();
  const { language } = useLanguage();
  const { theme } = useTheme();
  const [searchQuery, setSearchQuery] = useState("");
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'articles'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const articlesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Article[];
      // If Firestore is empty, we can show hardcoded data for now or just empty
      setArticles(articlesData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'articles');
      setArticles([]);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const getTitle = () => {
    if (language === 'ur') return <span className="font-urdu">مضامین</span>;
    if (language === 'both') return <span className="flex flex-col md:flex-row items-center justify-center gap-2 md:gap-4"><span>Articles</span> <span className="hidden md:inline text-orange-500/30">|</span> <span className="font-urdu">مضامین</span></span>;
    return "Articles";
  };

  const getSubtitle = () => {
    if (language === 'ur') return <span className="font-urdu">مصنف: مفتی منیر شاکر شہید</span>;
    if (language === 'both') return "Author: Mufti Munir Shakir Shaheed";
    return "Author: Mufti Munir Shakir Shaheed";
  };

  const filteredArticles = articles.filter(a => 
    a.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    a.urduTitle.includes(searchQuery)
  );
  
  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div dir={language === 'ur' ? 'rtl' : 'ltr'}>
      <PageHeader title={getTitle()} subtitle={getSubtitle()} />
      <section className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SearchBar value={searchQuery} onChange={setSearchQuery} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          {filteredArticles.map((article, i) => (
            <motion.div 
              key={article.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              whileHover={{ y: -12, scale: 1.02, boxShadow: `0 20px 40px -10px ${theme === 'dark' ? 'rgba(249, 115, 22, 0.4)' : 'rgba(0, 0, 0, 0.2)'}` }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              viewport={{ once: true }}
              className={`flex gap-6 items-start p-8 ${theme === 'dark' ? 'bg-stone-900 border-stone-800 hover:border-orange-500/50' : 'bg-white border-black hover:border-black'} rounded-2xl border shadow-sm hover:shadow-xl cursor-pointer ${language === 'ur' ? 'text-right' : ''}`}
            >
              <div className={`flex-shrink-0 w-16 h-16 ${theme === 'dark' ? 'bg-stone-800 border-stone-800' : 'bg-stone-100 border-stone-200'} rounded-xl flex items-center justify-center text-stone-500 font-serif text-2xl border group-hover:border-orange-900/30`}>
                {(i + 1).toString().padStart(2, '0')}
              </div>
              <div className="flex-grow">
                <Link to={`/articles/${article.id}`}>
                  {(language === 'en' || language === 'both') && (
                    <div className="mb-5">
                      <h3 className={`text-xl font-bold ${theme === 'dark' ? 'text-[#ff4500]' : 'text-black'} font-serif hover:text-orange-500 cursor-pointer transition-colors`}>
                        {article.title}
                      </h3>
                    </div>
                  )}
                  {(language === 'ur' || language === 'both') && (
                    <p className={`text-[30px] font-urdu ${theme === 'dark' ? 'text-[#ff4500]' : 'text-black'} mb-4 hover:text-orange-400 transition-colors`}>
                      {article.titleUrdu || article.urduTitle}
                    </p>
                  )}
                </Link>
                <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] sm:text-xs text-stone-400">
                  <span className={language === 'ur' ? 'text-right' : 'text-left'} dir="ltr">{article.date}</span>
                  <span className="flex items-center gap-1">
                    <Eye size={12} /> {views[article.id] || 0} <span className="hidden sm:inline">views</span>
                  </span>
                  <Link to={`/articles/${article.id}`} className={`text-orange-600 font-bold hover:underline ${language === 'ur' ? 'text-left' : 'text-right'}`}>
                    {language === 'ur' ? '← مضمون پڑھیں' : 'Read Article →'}
                  </Link>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </section>
    </div>
  );
};

const ArticleDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { views, trackView } = useViews();
  const { language } = useLanguage();
  const { theme } = useTheme();
  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const hasTracked = useRef<string | null>(null);
  const [fontSize, setFontSize] = useState<'small' | 'medium' | 'large' | 'xlarge'>('medium');

  const fontSizeMap = {
    small: { title: 'text-2xl md:text-4xl', content: 'text-base', urdu: 'text-lg md:text-xl' },
    medium: { title: 'text-3xl md:text-5xl', content: 'text-lg', urdu: 'text-xl md:text-2xl' },
    large: { title: 'text-4xl md:text-6xl', content: 'text-xl', urdu: 'text-2xl md:text-3xl' },
    xlarge: { title: 'text-5xl md:text-7xl', content: 'text-2xl', urdu: 'text-3xl md:text-4xl' }
  };

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [id]);

  useEffect(() => {
    if (!id) return;
    const docRef = doc(db, 'articles', id);
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        setArticle({ id: docSnap.id, ...docSnap.data() } as Article);
      } else {
        setArticle(null);
      }
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `articles/${id}`);
      setArticle(null);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [id]);

  useEffect(() => {
    if (id && hasTracked.current !== id) {
      trackView(id);
      hasTracked.current = id;
    }
  }, [id, trackView]);

  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const copyToClipboard = () => {
    navigator.clipboard.writeText(window.location.href);
    setToastMessage(language === 'ur' ? 'لنک کاپی ہو گیا!' : 'Link copied to clipboard!');
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  const handleShare = async () => {
    const shareData = {
      title: language === 'ur' ? (article?.titleUrdu || article?.urduTitle) : article?.title,
      text: language === 'ur' 
        ? `مفتی منیر شاکر کا یہ مضمون پڑھیں: ${article?.titleUrdu || article?.urduTitle}`
        : `Read this article by Mufti Munir Shakir: ${article?.title}`,
      url: window.location.href,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          console.error('Error sharing:', error);
          copyToClipboard();
        }
      }
    } else {
      copyToClipboard();
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!article) {
    return (
      <div className="py-40 text-center">
        <h2 className="text-2xl font-bold mb-4">Article not found</h2>
        <button onClick={() => navigate('/articles')} className="text-orange-600 font-bold">Back to Articles</button>
      </div>
    );
  }

  return (
    <div className={`${theme === 'dark' ? 'bg-black' : 'bg-theme-primary'} min-h-screen`}>
      <div className={`${theme === 'dark' ? 'bg-stone-950' : 'bg-theme-secondary'} py-16 text-white border-b ${theme === 'dark' ? 'border-stone-800' : 'border-black'} relative overflow-hidden`}>
        <TextureOverlay />
        <div className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 ${language === 'ur' ? 'text-right' : ''}`} dir={language === 'ur' ? 'rtl' : 'ltr'}>
          <div className="flex items-center justify-between mb-8">
            <button 
              onClick={() => navigate('/articles')}
              className={`flex items-center gap-2 ${theme === 'dark' ? 'text-orange-500 hover:text-orange-400' : 'text-[#2E7D32] hover:text-green-700'} transition-colors`}
            >
              {language === 'ur' ? <ChevronRight size={20} /> : <ArrowLeft size={20} />} 
              {language === 'ur' ? 'مضامین پر واپس جائیں' : 'Back to Articles'}
            </button>
            <button 
              onClick={handleShare}
              className={`flex items-center gap-2 p-2 rounded-xl ${theme === 'dark' ? 'bg-stone-900 border-stone-800 text-stone-400 hover:text-orange-500' : 'bg-white border-stone-200 text-stone-600 hover:text-[#2E7D32]'} border transition-all shadow-sm`}
              title={language === 'ur' ? 'شیئر کریں' : 'Share'}
            >
              <Share2 size={18} />
            </button>
          </div>
          {(language === 'en' || language === 'both') && (
            <GlowingHeading className={`${fontSizeMap[fontSize].title} font-bold font-serif mb-2`}>{article.title}</GlowingHeading>
          )}
          {(language === 'ur' || language === 'both') && (
            <GlowingHeading className={`${fontSizeMap[fontSize].urdu} font-urdu text-orange-500 mb-6`}>{article.titleUrdu || article.urduTitle}</GlowingHeading>
          )}
          {language !== 'both' && (
            <p className={`${theme === 'dark' ? 'text-stone-400' : 'text-stone-600'} text-lg mb-6 font-medium italic ${language === 'ur' ? 'text-right' : ''}`}>
              {language === 'ur' ? 'مصنف: مفتی منیر شاکر شہید' : 'Author: Mufti Munir Shakir Shaheed'}
            </p>
          )}
          <div className={`flex items-center gap-4 ${theme === 'dark' ? 'text-stone-400' : 'text-stone-600'} mb-8`}>
            <span className="flex items-center gap-1.5"><Calendar size={16} /> <span dir="ltr">{article.date}</span></span>
            <span>•</span>
            <span className="flex items-center gap-1.5"><Clock size={16} /> <span dir="ltr">{article.time}</span></span>
            <span>•</span>
            <span className="flex items-center gap-1.5">
              <Eye size={16} /> {views[article.id] || 0} views
            </span>
          </div>
        </div>
      </div>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div 
          className={`grid grid-cols-1 ${language === 'both' ? 'lg:grid-cols-2' : ''} gap-12 items-start`}
          dir={language === 'ur' ? 'rtl' : 'ltr'}
        >
          {(language === 'en' || language === 'both') && (
            <motion.div 
              initial={{ opacity: 0, x: language === 'both' ? -20 : 0 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-theme-card p-8 md:p-12 rounded-3xl shadow-sm border border-theme transition-colors duration-300 overflow-hidden"
              style={{ fontFamily: article.contentFont || undefined }}
            >
              <h2 className="text-3xl font-bold font-serif mb-8 text-theme-accent border-b border-white pb-4">English</h2>
              <div 
                className={`${fontSizeMap[fontSize].content} leading-relaxed text-theme-primary break-words`}
                dangerouslySetInnerHTML={{ __html: article.content || article.englishContent }}
              />
            </motion.div>
          )}

          {/* Urdu Content */}
          {(language === 'ur' || language === 'both') && (
            <motion.div 
              initial={{ opacity: 0, x: language === 'both' ? 20 : 0 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-theme-card p-8 md:p-12 rounded-3xl shadow-sm border border-theme transition-colors duration-300 overflow-hidden"
              dir="rtl"
              style={{ fontFamily: article.contentUrduFont || undefined }}
            >
              <h2 className="text-3xl font-bold font-urdu mb-8 text-theme-accent border-b border-white pb-4">اردو</h2>
              <div 
                className={`${fontSizeMap[fontSize].urdu} leading-[2.8] text-theme-primary font-urdu break-words`}
                dangerouslySetInnerHTML={{ __html: article.contentUrdu || article.urduContent }}
              />
            </motion.div>
          )}
        </div>

        {/* Share & Info Section at the bottom */}
        <div className="mt-16 pt-8 border-t border-stone-800 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex flex-col gap-2 text-stone-500 text-sm">
            <div className="flex items-center gap-2">
              <Calendar size={16} className="text-orange-600" />
              <span>Published on: <strong dir="ltr">{article.date}</strong></span>
            </div>
            <div className="flex items-center gap-2">
              <Clock size={16} className="text-orange-600" />
              <span>Time: <strong dir="ltr">{article.time}</strong></span>
            </div>
          </div>

          <button 
            onClick={handleShare}
            className={`flex items-center gap-2 px-8 py-4 ${theme === 'dark' ? 'bg-orange-600' : 'bg-[#2E7D32]'} text-white rounded-2xl font-bold shadow-lg ${theme === 'dark' ? 'shadow-orange-900/20' : 'shadow-green-900/20'} hover:opacity-90 hover:scale-105 transition-all active:scale-95`}
          >
            <Share2 size={20} /> 
            <span className={language === 'ur' ? 'font-urdu' : ''}>
              {language === 'ur' ? 'مضمون شیئر کریں' : 'Share Article'}
            </span>
          </button>
        </div>
      </section>

      {/* Toast Notification */}
      <AnimatePresence>
        {showToast && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[100] px-6 py-3 bg-stone-900 text-white rounded-full shadow-2xl flex items-center gap-3 border border-stone-800"
          >
            <div className="w-6 h-6 bg-orange-600 rounded-full flex items-center justify-center">
              <Check size={14} />
            </div>
            <span className={`text-sm font-medium ${language === 'ur' ? 'font-urdu' : ''}`}>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const Videos = () => {
  const { language } = useLanguage();
  const { theme } = useTheme();
  const [searchQuery, setSearchQuery] = useState("");
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState<any | null>(null);
  const [playlistVideos, setPlaylistVideos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [videosLoading, setVideosLoading] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'playlists'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setPlaylists(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!selectedPlaylist) {
      setPlaylistVideos([]);
      return;
    }
    setPlaylistVideos(selectedPlaylist.videos || []);
  }, [selectedPlaylist]);

  const getTitle = () => {
    if (selectedPlaylist) return language === 'ur' ? selectedPlaylist.titleUrdu : selectedPlaylist.title;
    if (language === 'ur') return <span className="font-urdu text-5xl md:text-6xl">ویڈیو لیکچرز</span>;
    if (language === 'both') return (
      <span className="flex flex-col md:flex-row items-center justify-center gap-2 md:gap-4">
        <span className="font-serif">Video Lectures</span>
        <span className="hidden md:inline text-orange-400/50">|</span>
        <span className="font-urdu text-5xl md:text-6xl">ویڈیو لیکچرز</span>
      </span>
    );
    return "Video Lectures";
  };

  const getSubtitle = () => {
    if (selectedPlaylist) return language === 'ur' ? 'پلے لسٹ ویڈیوز' : 'Playlist Videos';
    if (language === 'ur') return <span className="font-urdu text-2xl md:text-3xl">مفتی منیر شاکر کے بیانات</span>;
    if (language === 'both') return "Watch the latest programs and series by Mufti Munir Shakir.";
    return "Watch the latest programs and series by Mufti Munir Shakir.";
  };

  const filteredPlaylists = playlists.filter(p => 
    (p.title?.toLowerCase() || "").includes(searchQuery.toLowerCase()) || 
    (p.titleUrdu || "").includes(searchQuery)
  );

  if (loading) return <LoadingSpinner />;

  return (
    <div dir={language === 'ur' ? 'rtl' : 'ltr'}>
      <PageHeader title={getTitle()} subtitle={getSubtitle()} />
      <section className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {!selectedPlaylist ? (
          <>
            <SearchBar value={searchQuery} onChange={setSearchQuery} />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {filteredPlaylists.map((playlist) => (
                <motion.div 
                  key={playlist.id}
                  whileHover={{ y: -10, scale: 1.02 }}
                  className="bg-theme-card rounded-2xl overflow-hidden border border-theme cursor-pointer group"
                  onClick={() => setSelectedPlaylist(playlist)}
                >
                  <div className="relative aspect-video">
                    <img src={playlist.coverUrl} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Play size={48} className="text-white" />
                    </div>
                  </div>
                  <div className="p-6">
                    <h3 className={`font-bold ${language === 'ur' ? 'font-urdu text-3xl' : 'font-serif text-xl'} text-theme-primary`}>
                      {language === 'ur' ? playlist.titleUrdu : playlist.title}
                    </h3>
                  </div>
                </motion.div>
              ))}
            </div>
          </>
        ) : (
          <div className="max-w-4xl mx-auto">
            <button 
              onClick={() => setSelectedPlaylist(null)}
              className="mb-8 flex items-center gap-2 text-orange-500 font-bold hover:underline"
            >
              <ChevronLeft size={20} className={language === 'ur' ? 'rotate-180' : ''} />
              {language === 'ur' ? 'پلے لسٹس پر واپس جائیں' : 'Back to Playlists'}
            </button>
            
            {videosLoading ? (
              <LoadingSpinner />
            ) : (
              <div className="space-y-4">
                {playlistVideos.map((video, idx) => (
                  <motion.div 
                    key={video.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="bg-theme-card p-4 rounded-2xl border border-theme flex items-center justify-between group hover:border-orange-500/50 transition-all cursor-pointer"
                    onClick={() => window.open(video.youtubeUrl, "_blank")}
                  >
                    <div className="flex items-center gap-6">
                      <span className="text-2xl font-bold text-stone-400 w-8">{idx + 1}</span>
                      <div className="relative w-32 aspect-video rounded-lg overflow-hidden">
                        <img src={video.thumbnailUrl} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                          <Play size={20} className="text-white" />
                        </div>
                      </div>
                      <div>
                        <h4 className={`font-bold ${language === 'ur' ? 'font-urdu text-2xl' : 'text-lg'} text-theme-primary`}>
                          {language === 'ur' ? video.titleUrdu : video.title}
                        </h4>
                        <p className="text-xs text-stone-500 uppercase tracking-widest">YouTube Video</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <button className="p-3 bg-orange-600 text-white rounded-full shadow-lg shadow-orange-600/20 group-hover:scale-110 transition-all">
                        <ExternalLink size={20} />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
};

const Quran = () => {
  const { language } = useLanguage();
  const { theme } = useTheme();
  const [searchQuery, setSearchQuery] = useState("");
  const [surahs, setSurahs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const q = query(collection(db, 'quran_verses'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const verses = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const surahMap = new Map();
      verses.forEach((v: any) => {
        if (!surahMap.has(v.surahNumber)) {
          surahMap.set(v.surahNumber, {
            id: v.surahNumber,
            en: v.surahName,
            ur: v.surahNameUrdu,
            verses: verses.filter((v2: any) => v2.surahNumber === v.surahNumber).length,
            meaning: '' // Could be added to data model if needed
          });
        }
      });
      setSurahs(Array.from(surahMap.values()).sort((a, b) => a.id - b.id));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'quran_verses');
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const filteredSurahs = surahs.filter(s => 
    s.en.toLowerCase().includes(searchQuery.toLowerCase()) || 
    s.ur.includes(searchQuery)
  );

  const getTitle = () => {
    if (language === 'en') return <span className="font-serif">Quran</span>;
    if (language === 'ur') return <span className="font-urdu text-5xl md:text-6xl">قرآن</span>;
    return (
      <span className="flex flex-col md:flex-row items-center justify-center gap-2 md:gap-4">
        <span className="font-serif">Quran</span>
        <span className="hidden md:inline text-orange-400/50">|</span>
        <span className="font-urdu text-5xl md:text-6xl">قرآن</span>
      </span>
    );
  };

  const getSubtitle = () => {
    if (language === 'en') return <span className="md:text-2xl lg:text-3xl">Translation in English</span>;
    if (language === 'ur') return <span className="font-urdu text-2xl md:text-3xl lg:text-4xl">اردو میں ترجمہ</span>;
    return <span className="md:text-2xl lg:text-3xl">Translation in English And Urdu</span>;
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div dir={language === 'ur' ? 'rtl' : 'ltr'}>
      <PageHeader title={getTitle()} subtitle={getSubtitle()} />
      <section className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <SearchBar value={searchQuery} onChange={setSearchQuery} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredSurahs.map((surah) => (
              <motion.div 
                key={surah.id} 
                whileHover={{ y: -12, scale: 1.02, boxShadow: `0 20px 40px -10px ${theme === 'dark' ? 'rgba(249, 115, 22, 0.4)' : 'rgba(0, 0, 0, 0.2)'}` }}
                whileTap={{ scale: 0.98, y: -4 }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
                className={`p-6 ${theme === 'dark' ? 'bg-stone-900 border-stone-800 hover:border-orange-500/50' : 'bg-theme-card border-black hover:border-black'} rounded-2xl border flex justify-between items-center shadow-sm cursor-pointer group transition-colors`}
                onClick={() => navigate(`/quran/${surah.id}`)}
              >
                <div className="flex items-center gap-4">
                  <span className={`w-10 h-10 ${theme === 'dark' ? 'bg-black' : 'bg-stone-100'} rounded-lg flex items-center justify-center text-stone-500 font-serif`}>{surah.id}</span>
                  <div className={language === 'ur' ? 'text-right' : 'text-left'}>
                    {(language === 'en' || language === 'both') && (
                      <>
                        <h3 className={`font-bold ${theme === 'dark' ? 'text-stone-100' : 'text-black'}`}>{surah.en}</h3>
                        <p className="text-stone-500 text-xs uppercase tracking-widest">{surah.meaning}</p>
                      </>
                    )}
                    {language === 'ur' && (
                      <h3 className={`font-bold ${theme === 'dark' ? 'text-stone-100' : 'text-black'} font-quran text-2xl leading-relaxed`}>{surah.ur}</h3>
                    )}
                  </div>
                </div>
                <div className={language === 'ur' ? 'text-left' : 'text-right'}>
                  {language === 'both' && (
                    <p className="text-3xl font-quran text-orange-500 leading-relaxed">{surah.ur}</p>
                  )}
                  <p className="text-xs text-stone-500">{surah.verses} Verses</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

const Hadith = () => {
  const { language } = useLanguage();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");

  const getTitle = () => {
    if (language === 'ur') return <span className="font-urdu text-5xl md:text-6xl">ذخیرہ حدیث</span>;
    if (language === 'both') return (
      <span className="flex flex-col md:flex-row items-center justify-center gap-2 md:gap-4">
        <span className="font-serif">Hadith Repository</span>
        <span className="hidden md:inline text-orange-400/50">|</span>
        <span className="font-urdu text-5xl md:text-6xl">ذخیرہ حدیث</span>
      </span>
    );
    return "Hadith Repository";
  };

  const getSubtitle = () => {
    if (language === 'ur') return <span className="font-urdu text-2xl md:text-3xl">نبی اکرم ﷺ کی مستند روایات اور ارشادات۔</span>;
    if (language === 'both') return "Authentic traditions and sayings of the Prophet (PBUH).";
    return "Authentic traditions and sayings of the Prophet (PBUH).";
  };

  const books = [
    { id: 'sahih-bukhari', en: 'Sahih Bukhari', ur: 'صحیح بخاری' },
    { id: 'sahih-muslim', en: 'Sahih Muslim', ur: 'صحیح مسلم' },
    { id: 'sunan-abi-dawud', en: 'Sunan Abi Dawud', ur: 'سنن ابی داؤد' },
    { id: 'jami-at-tirmidhi', en: 'Jami at-Tirmidhi', ur: 'جامع ترمذی' }
  ];

  const filteredBooks = books.filter(b => 
    b.en.toLowerCase().includes(searchQuery.toLowerCase()) || 
    b.ur.includes(searchQuery)
  );

  return (
    <div dir={language === 'ur' ? 'rtl' : 'ltr'}>
      <PageHeader title={getTitle()} subtitle={getSubtitle()} />
      <section className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SearchBar value={searchQuery} onChange={setSearchQuery} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {filteredBooks.map((book) => (
            <motion.div 
              key={book.id} 
              whileHover={{ y: -12, scale: 1.02, boxShadow: `0 20px 40px -10px ${theme === 'dark' ? 'rgba(249, 115, 22, 0.4)' : 'rgba(0, 0, 0, 0.2)'}` }}
              whileTap={{ scale: 0.98, y: -4 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              className={`p-8 ${theme === 'dark' ? 'bg-stone-900 border-stone-800 hover:border-orange-500/50' : 'bg-theme-card border-black hover:border-black'} rounded-3xl border shadow-sm transition-colors cursor-pointer ${language === 'ur' ? 'text-right' : ''}`}
              onClick={() => navigate(`/hadith/${book.id}`)}
            >
              <Quote className={`${theme === 'dark' ? 'text-orange-900' : 'text-[#2E7D32]'} mb-6 ${language === 'ur' ? 'mr-0 ml-auto' : ''}`} size={40} />
              <h3 className={`text-2xl font-bold mb-4 ${language === 'ur' ? 'font-urdu text-4xl' : 'font-serif'} ${theme === 'dark' ? 'text-stone-100' : 'text-black'}`}>
                {language === 'ur' ? book.ur : book.en}
              </h3>
              <p className={`text-stone-400 mb-6 leading-relaxed ${language === 'ur' ? 'font-urdu text-xl' : ''}`}>
                {language === 'ur' 
                  ? 'جدید تشریح اور قرآنی اصولوں کے ساتھ مکمل مجموعہ تک رسائی حاصل کریں۔' 
                  : 'Access the complete collection with modern commentary and cross-referencing to Quranic principles.'}
              </p>
              <button className={`text-orange-500 font-bold hover:underline ${language === 'ur' ? 'font-urdu' : ''}`}>
                {language === 'ur' ? 'مجموعہ تلاش کریں ←' : 'Explore Collection →'}
              </button>
            </motion.div>
          ))}
        </div>
      </section>
    </div>
  );
};

const Books = () => {
  const { language } = useLanguage();
  const { theme } = useTheme();
  const [searchQuery, setSearchQuery] = useState("");
  const [books, setBooks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'books'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setBooks(docs);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'books');
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const getTitle = () => {
    if (language === 'ur') return <span className="font-urdu text-5xl md:text-6xl">کتب و مطبوعات</span>;
    if (language === 'both') return (
      <span className="flex flex-col md:flex-row items-center justify-center gap-2 md:gap-4">
        <span className="font-serif">Books & Publications</span>
        <span className="hidden md:inline text-orange-400/50">|</span>
        <span className="font-urdu text-5xl md:text-6xl">کتب و مطبوعات</span>
      </span>
    );
    return "Books & Publications";
  };

  const getSubtitle = () => {
    if (language === 'ur') return <span className="font-urdu text-2xl md:text-3xl">مفتی منیر شاکر کی اہم تصانیف اور مقالات۔</span>;
    if (language === 'both') return "Major works and treatises by Mufti Munir Shakir.";
    return "Major works and treatises by Mufti Munir Shakir.";
  };

  const filteredBooks = books.filter(b => 
    (b.title?.toLowerCase() || "").includes(searchQuery.toLowerCase()) || 
    (b.titleUrdu || "").includes(searchQuery)
  );

  if (loading) return <LoadingSpinner />;

  return (
    <div dir={language === 'ur' ? 'rtl' : 'ltr'}>
      <PageHeader title={getTitle()} subtitle={getSubtitle()} />
      <section className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SearchBar value={searchQuery} onChange={setSearchQuery} />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          {filteredBooks.map((book) => (
            <BookCard 
              key={book.id} 
              title={book.title} 
              urduTitle={book.titleUrdu}
              description={book.description} 
              urduDescription={book.descriptionUrdu}
              pdfUrl={book.pdfUrl}
              coverImage={book.coverImageUrl}
            />
          ))}
        </div>
      </section>
    </div>
  );
};

const Bio = () => {
  const { language } = useLanguage();
  const { theme } = useTheme();
  const [bioData, setBioData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'bio', 'site_profile'), (snapshot) => {
      if (snapshot.exists()) {
        setBioData(snapshot.data());
      }
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'bio/site_profile');
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const getTitle = () => {
    if (language === 'ur') return <span className="font-urdu text-5xl md:text-6xl text-white">سوانح حیات</span>;
    if (language === 'both') return (
      <span className="flex flex-col md:flex-row items-center justify-center gap-2 md:gap-4">
        <span className="font-serif text-white">Biography</span>
        <span className="hidden md:inline text-orange-500/30">|</span>
        <span className="font-urdu text-5xl md:text-6xl text-white">سوانح حیات</span>
      </span>
    );
    return "Biography";
  };

  const getSubtitle = () => {
    if (language === 'ur') return <span className="font-urdu text-2xl md:text-3xl text-orange-500/80">مفتی منیر شاکر کی زندگی، تعلیم اور مشن۔</span>;
    if (language === 'both') return "Life, education, and mission of Mufti Munir Shakir.";
    return "Life, education, and mission of Mufti Munir Shakir.";
  };

  if (loading) return <LoadingSpinner />;
  if (!bioData) return <div className="text-center py-20 text-stone-500">Biography not found.</div>;

  return (
    <div dir={language === 'ur' ? 'rtl' : 'ltr'} className={`${theme === 'dark' ? 'bg-black' : 'bg-theme-primary'} min-h-screen`}>
      <PageHeader title={getTitle()} subtitle={getSubtitle()} />
      <section className="py-20 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            className={`aspect-[4/5] ${theme === 'dark' ? 'bg-stone-900 border-stone-800' : 'bg-stone-100 border-black'} rounded-[40px] overflow-hidden shadow-2xl border relative group`}
          >
            <img 
              src={bioData.imageUrl || "https://picsum.photos/seed/bio/800/1000"} 
              alt="Mufti Munir Shakir" 
              className="w-full h-full object-cover grayscale hover:grayscale-0 transition-all duration-1000 opacity-90 group-hover:opacity-100"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-60"></div>
          </motion.div>
          
          <div className="space-y-10">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <h3 className={`text-4xl md:text-5xl font-bold ${language === 'ur' ? 'font-urdu' : 'font-serif'} text-theme-primary`}>
                {language === 'ur' ? bioData.titleUrdu : bioData.title}
              </h3>
              <div className="h-1.5 w-24 bg-orange-600 rounded-full"></div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className={`prose prose-xl ${theme === 'dark' ? 'prose-invert' : ''} max-w-none font-serif leading-relaxed text-theme-secondary`}
              dangerouslySetInnerHTML={{ __html: language === 'ur' ? bioData.contentUrdu : bioData.content }}
            />
          </div>
        </div>
      </section>
    </div>
  );
};

const QuranDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const [fontSize, setFontSize] = useState<'small' | 'medium' | 'large' | 'xlarge'>('medium');
  const [viewMode, setViewMode] = useState<'ayat' | 'paragraph'>('ayat');
  const [translationLanguage, setTranslationLanguage] = useState<TranslationLanguage>('both');
  const { language: siteLanguage } = useLanguage();
  const [verses, setVerses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fontSizeMap = {
    small: { quran: 'text-2xl md:text-3xl', translation: 'text-sm md:text-base', urdu: 'text-lg md:text-xl' },
    medium: { quran: 'text-3xl md:text-5xl', translation: 'text-base md:text-lg', urdu: 'text-xl md:text-2xl' },
    large: { quran: 'text-4xl md:text-6xl', translation: 'text-lg md:text-xl', urdu: 'text-2xl md:text-3xl' },
    xlarge: { quran: 'text-5xl md:text-7xl', translation: 'text-xl md:text-2xl', urdu: 'text-3xl md:text-4xl' }
  };

  useEffect(() => {
    window.scrollTo(0, 0);
    if (!id) return;
    const q = query(collection(db, 'quran_verses'), where('surahNumber', '==', parseInt(id)), orderBy('verseNumber', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setVerses(docs);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `quran_verses/${id}`);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [id]);

  const surah = verses.length > 0 ? {
    en: verses[0].surahName,
    ur: verses[0].surahNameUrdu
  } : { en: 'Loading...', ur: 'لوڈنگ...' };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="bg-theme-primary min-h-screen pb-24 transition-colors duration-300">
      <div className={`${theme === 'dark' ? 'bg-theme-secondary' : 'bg-white'} py-12 text-theme-primary border-b ${theme === 'dark' ? 'border-theme' : 'border-black'} relative overflow-hidden`}>
        <TextureOverlay />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8 mb-8">
            <div className="flex items-center gap-6 w-full md:w-auto justify-between md:justify-start">
              <button onClick={() => navigate('/quran')} className={`flex items-center gap-2 ${theme === 'dark' ? 'text-theme-accent hover:text-theme-accent/80' : 'text-[#2E7D32] hover:text-green-700'} transition-colors`}>
                <ChevronLeft size={20} /> Back
              </button>
            </div>

            <div className="text-center">
              <div className="relative inline-block group mb-2">
                <h2 className={`text-4xl md:text-6xl ${siteLanguage === 'ur' ? 'font-quran' : 'font-serif'} text-theme-primary relative z-10`}>
                  {siteLanguage === 'ur' ? surah.ur : surah.en}
                </h2>
                <div className={`absolute -bottom-4 left-1/2 -translate-x-1/2 w-2/3 h-1 ${theme === 'dark' ? 'bg-theme-accent' : 'bg-[#2E7D32]'} blur-[2px] rounded-full shadow-[0_0_15px_rgba(var(--accent-rgb),0.8)]`} />
              </div>
              <p className="text-theme-secondary uppercase tracking-widest text-sm mt-4">
                {siteLanguage === 'ur' ? surah.en : surah.ur}
              </p>
            </div>
            
            <div className="hidden md:block w-32"></div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="space-y-4">
          {viewMode === 'ayat' ? (
            verses.map((verse: any) => (
              <div 
                key={verse.id} 
                className={`grid grid-cols-1 md:grid-cols-2 gap-0 md:gap-12 items-stretch p-6 md:p-10 transition-colors quran-hadith-box border border-theme`}
              >
                {/* Left Side: Translation */}
                <div className="order-2 md:order-1 flex flex-col justify-center space-y-6 py-4">
                  {(translationLanguage === 'en' || translationLanguage === 'both') && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-4 mb-2">
                        <span className="text-xs font-bold text-theme-secondary uppercase tracking-widest whitespace-nowrap">English Translation</span>
                        <div className="h-px bg-theme-secondary flex-grow"></div>
                      </div>
                      <p className={`${fontSizeMap[fontSize].translation} text-theme-primary leading-relaxed font-serif`} style={{ fontFamily: verse.englishFont || undefined }}>
                        {verse.english}
                      </p>
                    </div>
                  )}
                  {(translationLanguage === 'ur' || translationLanguage === 'both') && (
                    <div className="space-y-2 text-right" dir="rtl">
                      <div className="flex items-center gap-4 mb-2">
                        <span className="text-lg font-bold text-theme-secondary uppercase tracking-widest font-urdu whitespace-nowrap">اردو ترجمہ</span>
                        <div className="h-px bg-theme-secondary flex-grow"></div>
                      </div>
                      <p className={`${fontSizeMap[fontSize].urdu} font-urdu leading-relaxed text-theme-primary`} style={{ fontFamily: verse.urduFont || undefined }}>
                        {verse.urdu}
                      </p>
                    </div>
                  )}
                </div>

                {/* Right Side: Arabic */}
                <div className={`order-1 md:order-2 flex flex-col items-center md:items-end justify-center py-4 border-b md:border-b-0 md:border-l ${theme === 'dark' ? 'border-white border-l-[1px]' : 'border-black/40'} md:pl-12 mb-6 md:mb-0`}>
                  <p 
                    className={`${fontSizeMap[fontSize].quran} font-quran leading-[2.2] text-theme-primary text-center md:text-right`} 
                    dir="rtl"
                    style={{ fontFamily: verse.arabicFont || undefined }}
                  >
                    {verse.arabic}
                    <span className="inline-flex items-center justify-center mx-1 w-5 h-5 rounded-full border border-orange-500/30 text-[8px] font-bold text-orange-500 bg-orange-500/5">
                      {verse.verseNumber}
                    </span>
                  </p>
                </div>
              </div>
            ))
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-start quran-hadith-box p-8 border border-theme">
              {/* Left Side: Continuous Translation */}
              <div className="order-2 md:order-1 space-y-12">
                {(translationLanguage === 'en' || translationLanguage === 'both') && (
                  <div className="space-y-4">
                    <h3 className="text-[10px] font-bold text-theme-secondary uppercase tracking-widest mb-6 border-b border-theme pb-2">English Translation</h3>
                    <p className={`${fontSizeMap[fontSize].translation} text-theme-primary leading-[2] font-serif text-justify`}>
                      {verses.map((v: any) => (
                        <span key={v.id} className="inline">
                          {v.translation}
                          <span className="text-theme-accent/30 text-[10px] font-bold mx-1">({v.verseNumber || v.id})</span>
                          {' '}
                        </span>
                      ))}
                    </p>
                  </div>
                )}
                {(translationLanguage === 'ur' || translationLanguage === 'both') && (
                  <div className="space-y-4 text-right" dir="rtl">
                    <h3 className="text-[10px] font-bold text-theme-secondary uppercase tracking-widest mb-6 border-b border-theme pb-2 font-urdu">اردو ترجمہ</h3>
                    <p className={`${fontSizeMap[fontSize].urdu} font-urdu leading-[2.8] text-theme-primary text-justify`}>
                      {verses.map((v: any) => (
                        <span key={v.id} className="inline">
                          {v.translationUrdu || v.urduTranslation}
                          <span className="text-theme-accent/30 text-[12px] font-bold mx-1">({v.verseNumber || v.id})</span>
                          {' '}
                        </span>
                      ))}
                    </p>
                  </div>
                )}
              </div>

              {/* Right Side: Continuous Arabic */}
              <div className="order-1 md:order-2">
                <h3 className="text-[10px] font-bold text-theme-secondary uppercase tracking-widest mb-8 border-b border-theme pb-2 text-right">Arabic Text</h3>
                <p 
                  className={`${fontSizeMap[fontSize].quran} font-quran leading-[3] text-theme-primary text-justify`} 
                  dir="rtl"
                >
                  {verses.map((v: any) => (
                    <span key={v.id} className="inline" style={{ fontFamily: v.arabicFont || undefined }}>
                      {v.arabic || v.text}
                      <span className="inline-flex items-center justify-center mx-1 w-4 h-4 rounded-full border border-theme-accent/30 text-[7px] font-bold text-theme-accent/60">
                        {v.verseNumber || v.id}
                      </span>
                    </span>
                  ))}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      <StickySettingsBar 
        fontSize={fontSize} 
        setFontSize={setFontSize} 
        viewMode={viewMode} 
        setViewMode={setViewMode} 
        language={translationLanguage} 
        setLanguage={setTranslationLanguage} 
        showFontSize={true}
        hidePara={true}
      />
    </div>
  );
};

const VideoPlayer = () => {
  const { videoId } = useParams();
  const navigate = useNavigate();
  const { language } = useLanguage();
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [video, setVideo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!videoId) return;
    const docRef = doc(db, 'videos', videoId);
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        setVideo({ id: docSnap.id, ...docSnap.data() });
      }
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `videos/${videoId}`);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [videoId]);

  useEffect(() => {
    const handleMouseMove = () => {
      setShowControls(true);
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
      controlsTimeoutRef.current = setTimeout(() => {
        if (isPlaying) setShowControls(false);
      }, 3000);
    };

    window.addEventListener('mousemove', handleMouseMove);
    
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, [isPlaying]);

  const isTogglingRef = useRef(false);

  const togglePlay = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const videoElement = videoRef.current;
    if (!videoElement || isTogglingRef.current) return;

    isTogglingRef.current = true;
    try {
      if (isPlaying) {
        videoElement.pause();
        setIsPlaying(false);
      } else {
        // Ensure the element is still connected before calling play()
        if (!videoElement.isConnected) {
          isTogglingRef.current = false;
          return;
        }

        const playPromise = videoElement.play();
        if (playPromise !== undefined) {
          await playPromise;
        }
        // Only update state if the element is still in the DOM and component is mounted
        if (videoRef.current && videoRef.current.isConnected) {
          setIsPlaying(true);
        }
      }
    } catch (error: any) {
      // The error "The play() request was interrupted because the media was removed from the document"
      // is an AbortError. We should ignore it as it's common in React on unmount.
      const isAbortError = error.name === 'AbortError' || 
                          (error.message && error.message.includes('interrupted')) ||
                          (error.message && error.message.includes('removed from the document'));
      
      if (!isAbortError) {
        console.error("Playback error:", error);
      }
      // If play failed, ensure state is correct
      if (videoRef.current && videoRef.current.isConnected) {
        setIsPlaying(false);
      }
    } finally {
      isTogglingRef.current = false;
    }
  };

  const toggleFullscreen = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!containerRef.current) return;

    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable full-screen mode: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  const skip = (e: React.MouseEvent, seconds: number) => {
    e.stopPropagation();
    if (videoRef.current) videoRef.current.currentTime += seconds;
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const current = videoRef.current.currentTime;
      const duration = videoRef.current.duration;
      if (duration > 0 && isFinite(duration)) {
        setProgress((current / duration) * 100);
      }
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (videoRef.current) {
      const val = Number(e.target.value);
      const duration = videoRef.current.duration;
      if (duration > 0 && isFinite(duration)) {
        const time = (val / 100) * duration;
        if (isFinite(time)) {
          videoRef.current.currentTime = time;
          setProgress(val);
        }
      }
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = Number(e.target.value);
    setVolume(newVolume);
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
      setIsMuted(newVolume === 0);
    }
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (videoRef.current) {
      const newMuteState = !isMuted;
      setIsMuted(newMuteState);
      videoRef.current.muted = newMuteState;
    }
  };

  const handleDownload = (e: React.MouseEvent, type: 'video' | 'audio') => {
    e.stopPropagation();
    if (!video) return;
    const url = type === 'video' ? video.videoUrl : (video.audioUrl || video.videoUrl);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', type === 'video' ? `video-${videoId}.mp4` : `audio-${videoId}.mp3`);
    link.setAttribute('target', '_blank');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) return <LoadingSpinner />;
  if (!video) return <div className="py-40 text-center"><h2 className="text-2xl font-bold mb-4">Video not found</h2><button onClick={() => navigate('/videos')} className="text-orange-600 font-bold">Back to Videos</button></div>;

  return (
    <div className="bg-black min-h-screen text-stone-100 pt-24 pb-12">
      <div className="max-w-6xl mx-auto px-4">
        <button onClick={() => navigate('/videos')} className="flex items-center gap-2 text-stone-500 hover:text-orange-500 mb-8 transition-colors">
          <ChevronLeft size={20} /> Back to Videos
        </button>

        <div 
          ref={containerRef}
          className={`relative bg-black rounded-3xl overflow-hidden shadow-2xl group cursor-pointer border border-stone-800 ${isFullscreen ? 'w-screen h-screen rounded-none' : 'aspect-video'}`}
          onClick={() => setShowControls(!showControls)}
        >
          <video 
            ref={videoRef}
            src={video.videoUrl} 
            className="w-full h-full object-contain"
            onTimeUpdate={handleTimeUpdate}
            playsInline
          />
          
          {/* Custom Controls - Desktop & Mobile Overlay */}
          <div className={`absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent transition-opacity flex flex-col justify-end p-4 md:p-6 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
            {/* Seek Bar */}
            <input 
              type="range" 
              min="0" 
              max="100" 
              value={progress} 
              onChange={handleSeek}
              onClick={(e) => e.stopPropagation()}
              className="w-full h-1 md:h-1.5 bg-stone-800 rounded-lg appearance-none cursor-pointer accent-orange-500 mb-3 md:mb-4"
            />
            
            {/* Buttons Row */}
            <div className="flex items-center justify-between gap-2 md:gap-4">
              <div className="flex items-center gap-2 md:gap-6">
                <button onClick={togglePlay} className="p-1.5 md:p-2 hover:bg-white/10 rounded-full transition-colors">
                  {isPlaying ? <Pause size={20} className="md:w-7 md:h-7 text-white" /> : <Play size={20} className="md:w-7 md:h-7 text-white" />}
                </button>
                <div className="flex items-center gap-1.5 md:gap-4">
                  <button onClick={(e) => skip(e, -10)} className="p-1.5 md:p-2 hover:bg-white/10 rounded-full transition-colors" title="Back 10s">
                    <SkipBack size={16} className="md:w-6 md:h-6 text-stone-400" />
                  </button>
                  <button onClick={(e) => skip(e, 10)} className="p-1.5 md:p-2 hover:bg-white/10 rounded-full transition-colors" title="Forward 10s">
                    <SkipForward size={16} className="md:w-6 md:h-6 text-stone-400" />
                  </button>
                </div>
                <div className="flex items-center gap-1.5 md:gap-4 ml-1 md:ml-4 border-l border-white/10 pl-3 md:pl-6">
                  <button onClick={toggleMute} className="p-1.5 md:p-2 hover:bg-white/10 rounded-full transition-colors">
                    {isMuted ? <VolumeX size={16} className="text-stone-500 md:w-5 md:h-5" /> : <Volume2 size={16} className="text-stone-400 md:w-5 md:h-5" />}
                  </button>
                  <input 
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={isMuted ? 0 : volume}
                    onChange={handleVolumeChange}
                    onClick={(e) => e.stopPropagation()}
                    className="w-12 md:w-24 volume-slider"
                  />
                </div>
              </div>

              <div className="flex items-center gap-1.5 md:gap-4">
                <button onClick={toggleFullscreen} className="p-1.5 md:p-2 hover:bg-white/10 rounded-full transition-colors">
                  {isFullscreen ? <Minimize size={16} className="md:w-5 md:h-5 text-stone-400" /> : <Maximize size={16} className="md:w-5 md:h-5 text-stone-400" />}
                </button>
                <div className="hidden sm:flex items-center gap-2">
                  <button 
                    onClick={(e) => handleDownload(e, 'audio')}
                    className="flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 bg-stone-800 hover:bg-stone-700 rounded-lg transition-colors text-[10px] md:text-sm font-bold text-white"
                  >
                    <Download size={14} className="md:w-[18px] md:h-[18px]" /> Audio
                  </button>
                  <button 
                    onClick={(e) => handleDownload(e, 'video')}
                    className="flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 bg-orange-600 hover:bg-orange-700 rounded-xl transition-colors text-[10px] md:text-sm font-bold text-white"
                  >
                    <Download size={14} className="md:w-[18px] md:h-[18px]" /> Video
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Download Buttons - Still outside for better accessibility but smaller */}
        <div className="sm:hidden mt-4 grid grid-cols-2 gap-3">
          <button 
            onClick={(e) => handleDownload(e, 'audio')}
            className="flex items-center justify-center gap-2 py-3 bg-stone-900 hover:bg-stone-800 rounded-xl transition-colors text-xs font-bold text-stone-300"
          >
            <Download size={14} /> Audio
          </button>
          <button 
            onClick={(e) => handleDownload(e, 'video')}
            className="flex items-center justify-center gap-2 py-3 bg-orange-600 hover:bg-orange-700 rounded-xl transition-colors text-xs font-bold text-white"
          >
            <Download size={14} /> Video
          </button>
        </div>

        <div className="mt-12">
          <GlowingHeading className={`text-3xl font-bold mb-4 ${language === 'ur' ? 'font-urdu text-5xl text-right' : 'font-serif'}`}>
            {language === 'ur' ? (video.titleUrdu || video.title) : video.title}
          </GlowingHeading>
          <p className={`text-stone-400 leading-relaxed max-w-3xl ${language === 'ur' ? 'font-urdu text-2xl text-right ml-auto' : ''}`}>
            {language === 'ur' 
              ? (video.descriptionUrdu || video.description) 
              : video.description}
          </p>
        </div>
      </div>
    </div>
  );
};

const HadithDetail = () => {
  const { bookId } = useParams();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const [fontSize, setFontSize] = useState<'small' | 'medium' | 'large' | 'xlarge'>('medium');
  const [viewMode, setViewMode] = useState<'ayat' | 'paragraph'>('ayat');
  const [translationLanguage, setTranslationLanguage] = useState<TranslationLanguage>('both');
  const { language: siteLanguage } = useLanguage();
  const [hadiths, setHadiths] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fontSizeMap = {
    small: { arabic: 'text-2xl md:text-3xl', translation: 'text-sm md:text-base', urdu: 'text-lg md:text-xl' },
    medium: { arabic: 'text-3xl md:text-5xl', translation: 'text-base md:text-lg', urdu: 'text-xl md:text-2xl' },
    large: { arabic: 'text-4xl md:text-6xl', translation: 'text-lg md:text-xl', urdu: 'text-2xl md:text-3xl' },
    xlarge: { arabic: 'text-5xl md:text-7xl', translation: 'text-xl md:text-2xl', urdu: 'text-3xl md:text-4xl' }
  };

  useEffect(() => {
    window.scrollTo(0, 0);
    if (!bookId) return;
    const q = query(collection(db, 'hadith'), where('bookId', '==', bookId), orderBy('hadithNumber', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setHadiths(docs);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `hadith/${bookId}`);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [bookId]);

  const bookNames: Record<string, { en: string, ur: string }> = {
    'sahih-bukhari': { en: 'Sahih Bukhari', ur: 'صحیح بخاری' },
    'sahih-muslim': { en: 'Sahih Muslim', ur: 'صحیح مسلم' },
    'sunan-abi-dawud': { en: 'Sunan Abi Dawud', ur: 'سنن ابی داؤد' },
    'jami-at-tirmidhi': { en: 'Jami at-Tirmidhi', ur: 'جامع ترمذی' }
  };

  const book = bookNames[bookId || 'sahih-bukhari'];

  if (loading) return <LoadingSpinner />;

  return (
    <div className="bg-theme-primary min-h-screen pb-24 transition-colors duration-300">
      <div className="bg-theme-secondary py-16 text-theme-primary border-b border-theme relative overflow-hidden">
        <TextureOverlay />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <button onClick={() => navigate('/hadith')} className="flex items-center gap-2 text-theme-accent hover:text-theme-accent/80 mb-12 transition-colors">
            <ChevronLeft size={20} /> Back to Books
          </button>
          
          <div className={`flex flex-col ${siteLanguage === 'ur' ? 'items-end' : 'items-start'} gap-4`}>
            <div className="relative inline-block group">
              <h2 className={`text-4xl md:text-7xl font-bold ${siteLanguage === 'ur' ? 'font-urdu text-right' : 'font-serif'} text-theme-primary relative z-10`}>
                {siteLanguage === 'ur' ? book.ur : book.en}
              </h2>
              {theme !== 'dark' && (
                <div className={`absolute -bottom-4 ${siteLanguage === 'ur' ? 'right-0' : 'left-0'} w-2/3 h-1.5 bg-[#2E7D32] blur-[2px] rounded-full shadow-[0_0_20px_rgba(46,125,50,0.9)]`} />
              )}
            </div>
            {siteLanguage === 'ur' && (
              <p className="text-theme-secondary text-xl md:text-2xl font-urdu mt-4" dir="rtl">{book.ur}</p>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="space-y-12">
          {viewMode === 'ayat' ? (
            hadiths.map((hadith) => (
              <div key={hadith.id} className="quran-hadith-box p-8 border border-theme hover:border-theme-accent/30 transition-all group">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-start">
                  {/* Left Side: Translations */}
                  <div className="order-2 md:order-1 space-y-8">
                    {(translationLanguage === 'en' || translationLanguage === 'both') && (
                      <div className="space-y-4">
                        <div className="flex items-center gap-4 mb-2">
                          <span className="text-[10px] font-bold text-theme-secondary uppercase tracking-widest whitespace-nowrap">English Translation</span>
                          <div className="h-px bg-theme-secondary flex-grow"></div>
                        </div>
                        <p className={`${fontSizeMap[fontSize].translation} text-theme-primary leading-relaxed italic font-serif`} style={{ fontFamily: hadith.englishFont || undefined }}>
                          {hadith.english || hadith.translation || hadith.text}
                        </p>
                      </div>
                    )}
                    {(translationLanguage === 'ur' || translationLanguage === 'both') && (
                      <div className="space-y-4 text-right" dir="rtl">
                        <div className="flex items-center gap-4 mb-2">
                          <span className="text-lg font-bold text-theme-secondary uppercase tracking-widest font-urdu whitespace-nowrap">اردو ترجمہ</span>
                          <div className="h-px bg-theme-secondary flex-grow"></div>
                        </div>
                        <p className={`${fontSizeMap[fontSize].urdu} font-urdu leading-[2] text-theme-primary`} style={{ fontFamily: hadith.urduFont || undefined }}>
                          {hadith.urdu || hadith.translationUrdu}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Right Side: Arabic */}
                  <div className={`order-1 md:order-2 flex flex-col items-center md:items-end justify-center py-4 border-b md:border-b-0 md:border-l ${theme === 'dark' ? 'border-white border-l-[1px]' : 'border-theme/20'} md:pl-12 mb-8 md:mb-0`}>
                    <p className={`${fontSizeMap[fontSize].arabic} font-quran leading-[1.8] ${theme === 'dark' ? 'text-white' : 'text-black'} text-center md:text-right`} dir="rtl" style={{ fontFamily: hadith.arabicFont || undefined }}>
                      {hadith.arabic}
                      <span className="inline-flex items-center justify-center mx-3 relative top-1">
                        <span className="text-theme-accent/20 text-4xl md:text-5xl font-serif">۝</span>
                        <span className="absolute inset-0 flex items-center justify-center text-[10px] md:text-xs font-bold text-theme-accent/60 mt-0.5">
                          {hadith.hadithNumber || hadith.id}
                        </span>
                      </span>
                    </p>
                  </div>
                </div>

                {/* Footnotes Section - Moved below the box */}
                {hadith.footnotes && (
                  <div className="mt-4 mb-8 px-6">
                    <div className="flex items-center gap-3 mb-2">
                      <Quote size={14} className="text-orange-600/50" />
                      <span className="text-[10px] font-bold text-stone-600 uppercase tracking-widest">Reference</span>
                    </div>
                    <p className="text-xs text-stone-500 italic font-serif leading-relaxed">
                      {hadith.footnotes}
                    </p>
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-start quran-hadith-box p-8 border border-theme">
              {/* Left Side: Continuous Translation */}
              <div className="order-2 md:order-1 space-y-12">
                {(translationLanguage === 'en' || translationLanguage === 'both') && (
                  <div className="space-y-4">
                    <h3 className="text-[10px] font-bold text-theme-secondary uppercase tracking-widest mb-6 border-b border-theme pb-2">English Translation</h3>
                    <p className={`${fontSizeMap[fontSize].translation} text-theme-primary leading-[2] font-serif text-justify`}>
                      {hadiths.map((h) => (
                        <span key={h.id} className="inline">
                          {h.text}
                          <span className="text-theme-accent/30 text-[10px] font-bold mx-1">({h.hadithNumber || h.id})</span>
                          {' '}
                        </span>
                      ))}
                    </p>
                  </div>
                )}
                {(translationLanguage === 'ur' || translationLanguage === 'both') && (
                  <div className="space-y-4 text-right" dir="rtl">
                    <h3 className="text-[10px] font-bold text-theme-secondary uppercase tracking-widest mb-6 border-b border-theme pb-2 font-urdu">اردو ترجمہ</h3>
                    <p className={`${fontSizeMap[fontSize].urdu} font-urdu leading-[2.8] text-theme-primary text-justify`}>
                      {hadiths.map((h) => (
                        <span key={h.id} className="inline">
                          {h.urdu}
                          <span className="text-theme-accent/30 text-[12px] font-bold mx-1">({h.hadithNumber || h.id})</span>
                          {' '}
                        </span>
                      ))}
                    </p>
                  </div>
                )}
              </div>

              {/* Right Side: Continuous Arabic */}
              <div className="order-1 md:order-2">
                <h3 className="text-[10px] font-bold text-theme-secondary uppercase tracking-widest mb-8 border-b border-theme pb-2 text-right">Arabic Text</h3>
                <p 
                  className={`${fontSizeMap[fontSize].arabic} font-quran leading-[3] text-theme-primary text-justify`} 
                  dir="rtl"
                >
                  {hadiths.map((h) => (
                    <span key={h.id} className="inline">
                      {h.arabic}
                      <span className="inline-flex items-center justify-center mx-2 relative top-1">
                        <span className="text-theme-accent/20 text-4xl font-serif">۝</span>
                        <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-theme-accent/50 mt-0.5">
                          {h.hadithNumber || h.id}
                        </span>
                      </span>
                    </span>
                  ))}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      <StickySettingsBar 
        fontSize={fontSize} 
        setFontSize={setFontSize} 
        viewMode={viewMode} 
        setViewMode={setViewMode} 
        language={translationLanguage} 
        setLanguage={setTranslationLanguage} 
        showFontSize={false}
      />
    </div>
  );
};

// --- App Root ---

// --- Admin Sub-components ---

const AdminQuran = () => {
  const { theme } = useTheme();
  const [verses, setVerses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVerse, setEditingVerse] = useState<any>(null);

  const [arabic, setArabic] = useState('');
  const [translation, setTranslation] = useState('');
  const [translationUrdu, setTranslationUrdu] = useState('');
  const [surahName, setSurahName] = useState('');
  const [surahNameUrdu, setSurahNameUrdu] = useState('');
  const [verseNumber, setVerseNumber] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'quran'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setVerses(docs);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'quran');
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const data = { 
        arabic, 
        translation, 
        translationUrdu,
        surahName, 
        surahNameUrdu,
        verseNumber, 
        updatedAt: serverTimestamp() 
      };
      if (editingVerse) {
        await updateDoc(doc(db, 'quran', editingVerse.id), data);
      } else {
        await addDoc(collection(db, 'quran'), { ...data, createdAt: serverTimestamp() });
      }
      closeModal();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Delete this verse?')) {
      await deleteDoc(doc(db, 'quran', id));
    }
  };

  const openModal = (verse?: any) => {
    if (verse) {
      setEditingVerse(verse);
      setArabic(verse.arabic || '');
      setTranslation(verse.translation || '');
      setTranslationUrdu(verse.translationUrdu || '');
      setSurahName(verse.surahName || '');
      setSurahNameUrdu(verse.surahNameUrdu || '');
      setVerseNumber(verse.verseNumber || '');
    } else {
      setEditingVerse(null);
      setArabic('');
      setTranslation('');
      setTranslationUrdu('');
      setSurahName('');
      setSurahNameUrdu('');
      setVerseNumber('');
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingVerse(null);
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-theme-primary">Manage Quran Verses</h3>
          <p className="text-theme-secondary text-sm">Add verses with Surah names and translations</p>
        </div>
        <button onClick={() => openModal()} className="px-6 py-3 bg-orange-600 text-white font-bold rounded-xl flex items-center gap-2 shadow-lg shadow-orange-600/20"><Plus size={20} /> Add Verse</button>
      </div>

      <div className="space-y-4">
        {verses.map(v => (
          <div key={v.id} className={`p-6 rounded-2xl border ${theme === 'dark' ? 'bg-stone-900 border-stone-800' : 'bg-white border-stone-200'} shadow-xl`}>
            <p className="text-right font-quran text-2xl text-theme-primary mb-4 leading-loose" dir="rtl">{v.arabic}</p>
            <p className="text-theme-secondary text-sm mb-4">{v.translation}</p>
            <div className="flex items-center justify-between pt-4 border-t border-theme/10">
              <span className="text-xs font-bold text-orange-500 uppercase tracking-widest">{v.surahName} : {v.verseNumber}</span>
              <div className="flex gap-2">
                <button onClick={() => openModal(v)} className="p-2 rounded-lg bg-blue-500/10 text-blue-500 hover:bg-blue-500 hover:text-white transition-all"><Edit size={16} /></button>
                <button onClick={() => handleDelete(v.id)} className="p-2 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all"><Trash2 size={16} /></button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={closeModal} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className={`relative w-full max-w-2xl p-8 rounded-3xl border ${theme === 'dark' ? 'bg-stone-900 border-stone-800' : 'bg-white border-stone-200'} shadow-2xl`}>
              <h2 className="text-2xl font-bold text-theme-primary mb-6">{editingVerse ? 'Edit Verse' : 'Add Verse'}</h2>
              <form onSubmit={handleSave} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-theme-secondary uppercase mb-2">Arabic Text</label>
                  <textarea rows={4} required value={arabic} onChange={(e) => setArabic(e.target.value)} className={`w-full px-4 py-3 rounded-xl border font-quran text-xl text-right ${theme === 'dark' ? 'bg-black border-stone-800 text-white' : 'bg-stone-50 border-stone-200 text-black'}`} dir="rtl" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-theme-secondary uppercase mb-2">Translation (English)</label>
                    <textarea rows={3} required value={translation} onChange={(e) => setTranslation(e.target.value)} className={`w-full px-4 py-3 rounded-xl border ${theme === 'dark' ? 'bg-black border-stone-800 text-white' : 'bg-stone-50 border-stone-200 text-black'}`} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-theme-secondary uppercase mb-2">Translation (Urdu)</label>
                    <textarea rows={3} required value={translationUrdu} onChange={(e) => setTranslationUrdu(e.target.value)} className={`w-full px-4 py-3 rounded-xl border font-urdu text-right ${theme === 'dark' ? 'bg-black border-stone-800 text-white' : 'bg-stone-50 border-stone-200 text-black'}`} dir="rtl" />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-theme-secondary uppercase mb-2">Surah Name (English)</label>
                    <input type="text" required value={surahName} onChange={(e) => setSurahName(e.target.value)} className={`w-full px-4 py-3 rounded-xl border ${theme === 'dark' ? 'bg-black border-stone-800 text-white' : 'bg-stone-50 border-stone-200 text-black'}`} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-theme-secondary uppercase mb-2">Surah Name (Urdu)</label>
                    <input type="text" required value={surahNameUrdu} onChange={(e) => setSurahNameUrdu(e.target.value)} className={`w-full px-4 py-3 rounded-xl border font-urdu text-right ${theme === 'dark' ? 'bg-black border-stone-800 text-white' : 'bg-stone-50 border-stone-200 text-black'}`} dir="rtl" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-theme-secondary uppercase mb-2">Verse Number</label>
                    <input type="text" required value={verseNumber} onChange={(e) => setVerseNumber(e.target.value)} className={`w-full px-4 py-3 rounded-xl border ${theme === 'dark' ? 'bg-black border-stone-800 text-white' : 'bg-stone-50 border-stone-200 text-black'}`} />
                  </div>
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <button type="button" onClick={closeModal} className="px-6 py-3 font-bold text-theme-secondary">Cancel</button>
                  <button type="submit" disabled={saving} className="px-8 py-3 bg-orange-600 text-white font-bold rounded-xl shadow-lg shadow-orange-600/20">{saving ? 'Saving...' : 'Save Verse'}</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const AdminBooks = () => {
  const { theme } = useTheme();
  const [books, setBooks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBook, setEditingBook] = useState<any>(null);

  const [title, setTitle] = useState('');
  const [titleUrdu, setTitleUrdu] = useState('');
  const [author, setAuthor] = useState('');
  const [authorUrdu, setAuthorUrdu] = useState('');
  const [description, setDescription] = useState('');
  const [descriptionUrdu, setDescriptionUrdu] = useState('');
  const [coverImageUrl, setCoverImageUrl] = useState('');
  const [pdfUrl, setPdfUrl] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'books'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setBooks(docs);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'books');
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const data = { 
        title, 
        titleUrdu,
        author, 
        authorUrdu,
        description, 
        descriptionUrdu,
        coverImageUrl, 
        pdfUrl, 
        updatedAt: serverTimestamp() 
      };
      if (editingBook) {
        await updateDoc(doc(db, 'books', editingBook.id), data);
      } else {
        await addDoc(collection(db, 'books'), { ...data, createdAt: serverTimestamp() });
      }
      closeModal();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'cover' | 'pdf') => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const storageRef = ref(storage, `books/${type}s/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      if (type === 'cover') setCoverImageUrl(url);
      else setPdfUrl(url);
    } catch (error) {
      console.error(error);
    }
  };

  const openModal = (book?: any) => {
    if (book) {
      setEditingBook(book);
      setTitle(book.title || '');
      setTitleUrdu(book.titleUrdu || '');
      setAuthor(book.author || '');
      setAuthorUrdu(book.authorUrdu || '');
      setDescription(book.description || '');
      setDescriptionUrdu(book.descriptionUrdu || '');
      setCoverImageUrl(book.coverImageUrl || '');
      setPdfUrl(book.pdfUrl || '');
    } else {
      setEditingBook(null);
      setTitle('');
      setTitleUrdu('');
      setAuthor('');
      setAuthorUrdu('');
      setDescription('');
      setDescriptionUrdu('');
      setCoverImageUrl('');
      setPdfUrl('');
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingBook(null);
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-theme-primary">Manage Books</h3>
          <p className="text-theme-secondary text-sm">Upload book covers and PDF files</p>
        </div>
        <button onClick={() => openModal()} className="px-6 py-3 bg-orange-600 text-white font-bold rounded-xl flex items-center gap-2 shadow-lg shadow-orange-600/20"><Plus size={20} /> Add Book</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {books.map(book => (
          <div key={book.id} className={`p-6 rounded-2xl border ${theme === 'dark' ? 'bg-stone-900 border-stone-800' : 'bg-white border-stone-200'} shadow-xl flex gap-4`}>
            <img src={book.coverImageUrl || book.coverUrl} className="w-20 h-28 object-cover rounded-lg shadow-md" referrerPolicy="no-referrer" />
            <div className="flex-grow">
              <h4 className="font-bold text-theme-primary text-sm line-clamp-1">{book.title}</h4>
              <p className="text-theme-secondary text-[10px] mb-2">{book.author}</p>
              <div className="flex gap-2">
                <button onClick={() => openModal(book)} className="p-1.5 rounded-lg bg-blue-500/10 text-blue-500 hover:bg-blue-500 hover:text-white transition-all"><Edit size={14} /></button>
                <button onClick={() => deleteDoc(doc(db, 'books', book.id))} className="p-1.5 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all"><Trash2 size={14} /></button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={closeModal} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className={`relative w-full max-w-lg p-8 rounded-3xl border ${theme === 'dark' ? 'bg-stone-900 border-stone-800' : 'bg-white border-stone-200'} shadow-2xl`}>
              <h2 className="text-2xl font-bold text-theme-primary mb-6">{editingBook ? 'Edit Book' : 'Add Book'}</h2>
              <form onSubmit={handleSave} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-theme-secondary uppercase mb-2">Title (English)</label>
                      <input type="text" required value={title} onChange={(e) => setTitle(e.target.value)} className={`w-full px-4 py-3 rounded-xl border ${theme === 'dark' ? 'bg-black border-stone-800 text-white' : 'bg-stone-50 border-stone-200 text-black'}`} />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-theme-secondary uppercase mb-2">Title (Urdu)</label>
                      <input type="text" required value={titleUrdu} onChange={(e) => setTitleUrdu(e.target.value)} className={`w-full px-4 py-3 rounded-xl border font-urdu text-right ${theme === 'dark' ? 'bg-black border-stone-800 text-white' : 'bg-stone-50 border-stone-200 text-black'}`} dir="rtl" />
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-theme-secondary uppercase mb-2">Author (English)</label>
                      <input type="text" required value={author} onChange={(e) => setAuthor(e.target.value)} className={`w-full px-4 py-3 rounded-xl border ${theme === 'dark' ? 'bg-black border-stone-800 text-white' : 'bg-stone-50 border-stone-200 text-black'}`} />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-theme-secondary uppercase mb-2">Author (Urdu)</label>
                      <input type="text" required value={authorUrdu} onChange={(e) => setAuthorUrdu(e.target.value)} className={`w-full px-4 py-3 rounded-xl border font-urdu text-right ${theme === 'dark' ? 'bg-black border-stone-800 text-white' : 'bg-stone-50 border-stone-200 text-black'}`} dir="rtl" />
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-theme-secondary uppercase mb-2">Cover Image</label>
                    <label className="w-full px-4 py-3 rounded-xl border-2 border-dashed border-theme/20 flex flex-col items-center justify-center cursor-pointer hover:bg-theme/5">
                      <Upload size={20} className="text-theme-secondary" />
                      <span className="text-[10px] font-bold mt-1">{coverImageUrl ? 'Change Cover' : 'Upload Cover'}</span>
                      <input type="file" className="hidden" onChange={(e) => handleFileUpload(e, 'cover')} accept="image/*" />
                    </label>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-theme-secondary uppercase mb-2">PDF File</label>
                    <label className="w-full px-4 py-3 rounded-xl border-2 border-dashed border-theme/20 flex flex-col items-center justify-center cursor-pointer hover:bg-theme/5">
                      <FileText size={20} className="text-theme-secondary" />
                      <span className="text-[10px] font-bold mt-1">{pdfUrl ? 'Change PDF' : 'Upload PDF'}</span>
                      <input type="file" className="hidden" onChange={(e) => handleFileUpload(e, 'pdf')} accept="application/pdf" />
                    </label>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-theme-secondary uppercase mb-2">Description (English)</label>
                    <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} className={`w-full px-4 py-3 rounded-xl border ${theme === 'dark' ? 'bg-black border-stone-800 text-white' : 'bg-stone-50 border-stone-200 text-black'}`} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-theme-secondary uppercase mb-2">Description (Urdu)</label>
                    <textarea rows={3} value={descriptionUrdu} onChange={(e) => setDescriptionUrdu(e.target.value)} className={`w-full px-4 py-3 rounded-xl border font-urdu text-right ${theme === 'dark' ? 'bg-black border-stone-800 text-white' : 'bg-stone-50 border-stone-200 text-black'}`} dir="rtl" />
                  </div>
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <button type="button" onClick={closeModal} className="px-6 py-3 font-bold text-theme-secondary">Cancel</button>
                  <button type="submit" disabled={saving} className="px-8 py-3 bg-orange-600 text-white font-bold rounded-xl shadow-lg shadow-orange-600/20">{saving ? 'Saving...' : 'Save Book'}</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const AdminBio = () => {
  const { theme } = useTheme();
  const [bioSegments, setBioSegments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSegment, setEditingSegment] = useState<any>(null);

  const [title, setTitle] = useState('');
  const [titleUrdu, setTitleUrdu] = useState('');
  const [content, setContent] = useState('');
  const [contentUrdu, setContentUrdu] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [order, setOrder] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'bio'), orderBy('order', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setBioSegments(docs);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'bio');
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const data = { 
        title, 
        titleUrdu, 
        content, 
        contentUrdu, 
        imageUrl, 
        order: Number(order),
        updatedAt: serverTimestamp() 
      };
      if (editingSegment) {
        await updateDoc(doc(db, 'bio', editingSegment.id), data);
      } else {
        await addDoc(collection(db, 'bio'), { ...data, createdAt: serverTimestamp() });
      }
      closeModal();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Delete this bio segment?')) {
      await deleteDoc(doc(db, 'bio', id));
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const storageRef = ref(storage, `bio/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      setImageUrl(url);
    } catch (error) {
      console.error(error);
    }
  };

  const openModal = (segment?: any) => {
    if (segment) {
      setEditingSegment(segment);
      setTitle(segment.title || '');
      setTitleUrdu(segment.titleUrdu || '');
      setContent(segment.content || '');
      setContentUrdu(segment.contentUrdu || '');
      setImageUrl(segment.imageUrl || '');
      setOrder(segment.order || 0);
    } else {
      setEditingSegment(null);
      setTitle('');
      setTitleUrdu('');
      setContent('');
      setContentUrdu('');
      setImageUrl('');
      setOrder(bioSegments.length);
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingSegment(null);
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-theme-primary">Manage Biography</h3>
          <p className="text-theme-secondary text-sm">Add milestones or segments to the biography</p>
        </div>
        <button onClick={() => openModal()} className="px-6 py-3 bg-orange-600 text-white font-bold rounded-xl flex items-center gap-2 shadow-lg shadow-orange-600/20"><Plus size={20} /> Add Segment</button>
      </div>

      <div className="space-y-4">
        {bioSegments.map(s => (
          <div key={s.id} className={`p-6 rounded-2xl border ${theme === 'dark' ? 'bg-stone-900 border-stone-800' : 'bg-white border-stone-200'} shadow-xl flex gap-6`}>
            {s.imageUrl && <img src={s.imageUrl} className="w-24 h-24 object-cover rounded-xl border border-theme/10" referrerPolicy="no-referrer" />}
            <div className="flex-grow">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-bold text-theme-primary">{s.title}</h4>
                <span className="text-xs font-bold text-theme-secondary">Order: {s.order}</span>
              </div>
              <p className="text-theme-secondary text-sm line-clamp-2 mb-4">{s.content}</p>
              <div className="flex justify-end gap-2">
                <button onClick={() => openModal(s)} className="p-2 rounded-lg bg-blue-500/10 text-blue-500 hover:bg-blue-500 hover:text-white transition-all"><Edit size={16} /></button>
                <button onClick={() => handleDelete(s.id)} className="p-2 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all"><Trash2 size={16} /></button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={closeModal} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className={`relative w-full max-w-4xl max-h-[90vh] overflow-y-auto p-8 rounded-3xl border ${theme === 'dark' ? 'bg-stone-900 border-stone-800' : 'bg-white border-stone-200'} shadow-2xl`}>
              <h2 className="text-2xl font-bold text-theme-primary mb-6">{editingSegment ? 'Edit Bio Segment' : 'Add Bio Segment'}</h2>
              <form onSubmit={handleSave} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-theme-secondary uppercase mb-2">Title (English)</label>
                        <input type="text" required value={title} onChange={(e) => setTitle(e.target.value)} className={`w-full px-4 py-3 rounded-xl border ${theme === 'dark' ? 'bg-black border-stone-800 text-white' : 'bg-stone-50 border-stone-200 text-black'}`} />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-theme-secondary uppercase mb-2">Title (Urdu)</label>
                        <input type="text" required value={titleUrdu} onChange={(e) => setTitleUrdu(e.target.value)} className={`w-full px-4 py-3 rounded-xl border font-urdu text-right ${theme === 'dark' ? 'bg-black border-stone-800 text-white' : 'bg-stone-50 border-stone-200 text-black'}`} dir="rtl" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-theme-secondary uppercase mb-2">Display Order</label>
                      <input type="number" required value={order} onChange={(e) => setOrder(Number(e.target.value))} className={`w-full px-4 py-3 rounded-xl border ${theme === 'dark' ? 'bg-black border-stone-800 text-white' : 'bg-stone-50 border-stone-200 text-black'}`} />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-theme-secondary uppercase mb-2">Image (Optional)</label>
                      <div className="flex items-center gap-4">
                        {imageUrl && <img src={imageUrl} className="w-16 h-16 object-cover rounded-lg" referrerPolicy="no-referrer" />}
                        <label className="flex-grow px-4 py-3 rounded-xl border-2 border-dashed border-theme/20 flex flex-col items-center justify-center cursor-pointer hover:bg-theme/5 transition-all">
                          <Upload size={20} className="text-theme-secondary" />
                          <span className="text-[10px] font-bold mt-1">Upload Image</span>
                          <input type="file" className="hidden" onChange={handleImageUpload} accept="image/*" />
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-bold text-theme-secondary uppercase mb-2">Content (English)</label>
                    <ReactQuill theme="snow" value={content} onChange={setContent} className={`${theme === 'dark' ? 'quill-dark' : ''}`} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-theme-secondary uppercase mb-2">Content (Urdu)</label>
                    <ReactQuill theme="snow" value={contentUrdu} onChange={setContentUrdu} className={`${theme === 'dark' ? 'quill-dark' : ''} font-urdu`} />
                  </div>
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <button type="button" onClick={closeModal} className="px-6 py-3 font-bold text-theme-secondary">Cancel</button>
                  <button type="submit" disabled={saving} className="px-8 py-3 bg-orange-600 text-white font-bold rounded-xl shadow-lg shadow-orange-600/20">{saving ? 'Saving...' : 'Save Segment'}</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const AdminArticles = () => {
  const { theme } = useTheme();
  const [articles, setArticles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingArticle, setEditingArticle] = useState<any>(null);

  const [title, setTitle] = useState('');
  const [titleUrdu, setTitleUrdu] = useState('');
  const [content, setContent] = useState('');
  const [contentUrdu, setContentUrdu] = useState('');
  const [category, setCategory] = useState('');
  const [categoryUrdu, setCategoryUrdu] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'articles'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setArticles(docs);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'articles');
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const articleData = {
        title,
        titleUrdu,
        content,
        contentUrdu,
        category,
        categoryUrdu,
        imageUrl,
        updatedAt: serverTimestamp(),
      };

      if (editingArticle) {
        await updateDoc(doc(db, 'articles', editingArticle.id), articleData);
      } else {
        await addDoc(collection(db, 'articles'), {
          ...articleData,
          createdAt: serverTimestamp(),
        });
      }
      closeModal();
    } catch (err) {
      console.error("Error saving article:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Delete this article?')) {
      await deleteDoc(doc(db, 'articles', id));
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const storageRef = ref(storage, `articles/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      setImageUrl(url);
    } catch (error) {
      console.error("Upload failed:", error);
    }
  };

  const openModal = (article?: any) => {
    if (article) {
      setEditingArticle(article);
      setTitle(article.title || '');
      setTitleUrdu(article.titleUrdu || '');
      setContent(article.content || '');
      setContentUrdu(article.contentUrdu || '');
      setCategory(article.category || '');
      setCategoryUrdu(article.categoryUrdu || '');
      setImageUrl(article.imageUrl || '');
    } else {
      setEditingArticle(null);
      setTitle('');
      setTitleUrdu('');
      setContent('');
      setContentUrdu('');
      setCategory('');
      setCategoryUrdu('');
      setImageUrl('');
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingArticle(null);
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-theme-primary">Manage Articles</h3>
          <p className="text-theme-secondary text-sm">Create and edit blog posts</p>
        </div>
        <button onClick={() => openModal()} className="px-6 py-3 bg-orange-600 text-white font-bold rounded-xl flex items-center gap-2 shadow-lg shadow-orange-600/20"><Plus size={20} /> Add Article</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {articles.map(article => (
          <div key={article.id} className={`p-6 rounded-2xl border ${theme === 'dark' ? 'bg-stone-900 border-stone-800' : 'bg-white border-stone-200'} shadow-xl`}>
            <img src={article.imageUrl || 'https://picsum.photos/seed/article/400/200'} className="w-full h-40 object-cover rounded-xl mb-4" referrerPolicy="no-referrer" />
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2 py-1 rounded-md bg-orange-500/10 text-orange-500 text-[10px] font-bold uppercase tracking-widest">{article.category}</span>
            </div>
            <h4 className="font-bold text-theme-primary mb-2 line-clamp-1">{article.title}</h4>
            <div className="flex justify-end gap-2">
              <button onClick={() => openModal(article)} className="p-2 rounded-lg bg-blue-500/10 text-blue-500 hover:bg-blue-500 hover:text-white transition-all"><Edit size={16} /></button>
              <button onClick={() => handleDelete(article.id)} className="p-2 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all"><Trash2 size={16} /></button>
            </div>
          </div>
        ))}
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={closeModal} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className={`relative w-full max-w-4xl max-h-[90vh] overflow-y-auto p-8 rounded-3xl border ${theme === 'dark' ? 'bg-stone-900 border-stone-800' : 'bg-white border-stone-200'} shadow-2xl`}>
              <h2 className="text-2xl font-bold text-theme-primary mb-6">{editingArticle ? 'Edit Article' : 'Add Article'}</h2>
              <form onSubmit={handleSave} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-theme-secondary uppercase mb-2">Title (English)</label>
                        <input type="text" required value={title} onChange={(e) => setTitle(e.target.value)} className={`w-full px-4 py-3 rounded-xl border ${theme === 'dark' ? 'bg-black border-stone-800 text-white' : 'bg-stone-50 border-stone-200 text-black'}`} />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-theme-secondary uppercase mb-2">Title (Urdu)</label>
                        <input type="text" required value={titleUrdu} onChange={(e) => setTitleUrdu(e.target.value)} className={`w-full px-4 py-3 rounded-xl border font-urdu text-right ${theme === 'dark' ? 'bg-black border-stone-800 text-white' : 'bg-stone-50 border-stone-200 text-black'}`} dir="rtl" />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-theme-secondary uppercase mb-2">Category (English)</label>
                        <input type="text" required value={category} onChange={(e) => setCategory(e.target.value)} className={`w-full px-4 py-3 rounded-xl border ${theme === 'dark' ? 'bg-black border-stone-800 text-white' : 'bg-stone-50 border-stone-200 text-black'}`} />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-theme-secondary uppercase mb-2">Category (Urdu)</label>
                        <input type="text" required value={categoryUrdu} onChange={(e) => setCategoryUrdu(e.target.value)} className={`w-full px-4 py-3 rounded-xl border font-urdu text-right ${theme === 'dark' ? 'bg-black border-stone-800 text-white' : 'bg-stone-50 border-stone-200 text-black'}`} dir="rtl" />
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-theme-secondary uppercase mb-2">Featured Image</label>
                    <div className="relative group h-32">
                      <img src={imageUrl || 'https://picsum.photos/seed/upload/400/200'} className="w-full h-full object-cover rounded-xl border border-theme/10" referrerPolicy="no-referrer" />
                      <label className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer rounded-xl">
                        <Upload size={24} className="text-white" />
                        <input type="file" className="hidden" onChange={handleImageUpload} accept="image/*" />
                      </label>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-bold text-theme-secondary uppercase mb-2">Content (English)</label>
                    <ReactQuill 
                      theme="snow"
                      value={content}
                      onChange={setContent}
                      className={`${theme === 'dark' ? 'quill-dark' : ''}`}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-theme-secondary uppercase mb-2">Content (Urdu)</label>
                    <ReactQuill 
                      theme="snow"
                      value={contentUrdu}
                      onChange={setContentUrdu}
                      className={`${theme === 'dark' ? 'quill-dark' : ''} font-urdu`}
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-3">
                  <button type="button" onClick={closeModal} className="px-6 py-3 font-bold text-theme-secondary">Cancel</button>
                  <button type="submit" disabled={saving} className="px-8 py-3 bg-orange-600 text-white font-bold rounded-xl shadow-lg shadow-orange-600/20">{saving ? 'Saving...' : 'Save Article'}</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const AdminVideos = () => {
  const { theme } = useTheme();
  const [videos, setVideos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVideo, setEditingVideo] = useState<any>(null);

  const [title, setTitle] = useState('');
  const [titleUrdu, setTitleUrdu] = useState('');
  const [description, setDescription] = useState('');
  const [descriptionUrdu, setDescriptionUrdu] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'videos'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setVideos(docs);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'videos');
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const videoData = {
        title,
        titleUrdu,
        description,
        descriptionUrdu,
        youtubeUrl,
        thumbnailUrl,
        updatedAt: serverTimestamp(),
      };

      if (editingVideo) {
        await updateDoc(doc(db, 'videos', editingVideo.id), videoData);
      } else {
        await addDoc(collection(db, 'videos'), {
          ...videoData,
          createdAt: serverTimestamp(),
        });
      }
      closeModal();
    } catch (err) {
      console.error("Error saving video:", err);
      alert("Failed to save video");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Delete this video?')) {
      await deleteDoc(doc(db, 'videos', id));
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const storageRef = ref(storage, `videos/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      setThumbnailUrl(url);
    } catch (error) {
      console.error("Upload failed:", error);
    }
  };

  const openModal = (video?: any) => {
    if (video) {
      setEditingVideo(video);
      setTitle(video.title || '');
      setTitleUrdu(video.titleUrdu || '');
      setDescription(video.description || '');
      setDescriptionUrdu(video.descriptionUrdu || '');
      setYoutubeUrl(video.youtubeUrl || '');
      setThumbnailUrl(video.thumbnailUrl || '');
    } else {
      setEditingVideo(null);
      setTitle('');
      setTitleUrdu('');
      setDescription('');
      setDescriptionUrdu('');
      setYoutubeUrl('');
      setThumbnailUrl('');
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingVideo(null);
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-theme-primary">Manage Videos</h3>
          <p className="text-theme-secondary text-sm">Add YouTube links and descriptions</p>
        </div>
        <button 
          onClick={() => openModal()}
          className="px-6 py-3 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-xl flex items-center gap-2 shadow-lg shadow-orange-600/20 transition-all"
        >
          <Plus size={20} />
          Add Video
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {videos.map(video => (
          <div key={video.id} className={`p-6 rounded-2xl border ${theme === 'dark' ? 'bg-stone-900 border-stone-800' : 'bg-white border-stone-200'} shadow-xl`}>
            <img src={video.thumbnailUrl} alt={video.title} className="w-full h-40 object-cover rounded-xl mb-4" referrerPolicy="no-referrer" />
            <h4 className="font-bold text-theme-primary mb-2 line-clamp-1">{video.title}</h4>
            <p className="text-theme-secondary text-xs line-clamp-2 mb-4">{video.description}</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => openModal(video)} className="p-2 rounded-lg bg-blue-500/10 text-blue-500 hover:bg-blue-500 hover:text-white transition-all"><Edit size={16} /></button>
              <button onClick={() => handleDelete(video.id)} className="p-2 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all"><Trash2 size={16} /></button>
            </div>
          </div>
        ))}
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={closeModal} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className={`relative w-full max-w-lg p-8 rounded-3xl border ${theme === 'dark' ? 'bg-stone-900 border-stone-800' : 'bg-white border-stone-200'} shadow-2xl`}>
              <h2 className="text-2xl font-bold text-theme-primary mb-6">{editingVideo ? 'Edit Video' : 'Add Video'}</h2>
              <form onSubmit={handleSave} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-theme-secondary uppercase mb-2">Title (English)</label>
                    <input type="text" required value={title} onChange={(e) => setTitle(e.target.value)} className={`w-full px-4 py-3 rounded-xl border ${theme === 'dark' ? 'bg-black border-stone-800 text-white' : 'bg-stone-50 border-stone-200 text-black'}`} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-theme-secondary uppercase mb-2">Title (Urdu)</label>
                    <input type="text" required value={titleUrdu} onChange={(e) => setTitleUrdu(e.target.value)} className={`w-full px-4 py-3 rounded-xl border font-urdu text-right ${theme === 'dark' ? 'bg-black border-stone-800 text-white' : 'bg-stone-50 border-stone-200 text-black'}`} dir="rtl" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-theme-secondary uppercase mb-2">YouTube URL</label>
                  <input type="url" required value={youtubeUrl} onChange={(e) => setYoutubeUrl(e.target.value)} className={`w-full px-4 py-3 rounded-xl border ${theme === 'dark' ? 'bg-black border-stone-800 text-white' : 'bg-stone-50 border-stone-200 text-black'}`} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-theme-secondary uppercase mb-2">Thumbnail</label>
                  <div className="flex items-center gap-4">
                    {thumbnailUrl && <img src={thumbnailUrl} className="w-16 h-16 object-cover rounded-lg" referrerPolicy="no-referrer" />}
                    <label className="flex-grow px-4 py-3 rounded-xl border-2 border-dashed border-theme/20 flex flex-col items-center justify-center cursor-pointer hover:bg-theme/5 transition-all">
                      <Upload size={20} className="text-theme-secondary" />
                      <span className="text-[10px] font-bold mt-1">Upload Thumbnail</span>
                      <input type="file" className="hidden" onChange={handleImageUpload} accept="image/*" />
                    </label>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-theme-secondary uppercase mb-2">Description (English)</label>
                    <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} className={`w-full px-4 py-3 rounded-xl border ${theme === 'dark' ? 'bg-black border-stone-800 text-white' : 'bg-stone-50 border-stone-200 text-black'}`} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-theme-secondary uppercase mb-2">Description (Urdu)</label>
                    <textarea rows={3} value={descriptionUrdu} onChange={(e) => setDescriptionUrdu(e.target.value)} className={`w-full px-4 py-3 rounded-xl border font-urdu text-right ${theme === 'dark' ? 'bg-black border-stone-800 text-white' : 'bg-stone-50 border-stone-200 text-black'}`} dir="rtl" />
                  </div>
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <button type="button" onClick={closeModal} className="px-6 py-3 font-bold text-theme-secondary">Cancel</button>
                  <button type="submit" disabled={saving} className="px-8 py-3 bg-orange-600 text-white font-bold rounded-xl shadow-lg shadow-orange-600/20">{saving ? 'Saving...' : 'Save Video'}</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const AdminHadith = () => {
  const { theme } = useTheme();
  const [hadiths, setHadiths] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingHadith, setEditingHadith] = useState<any>(null);

  const [arabic, setArabic] = useState('');
  const [translation, setTranslation] = useState('');
  const [translationUrdu, setTranslationUrdu] = useState('');
  const [reference, setReference] = useState('');
  const [referenceUrdu, setReferenceUrdu] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'hadith'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setHadiths(docs);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'hadith');
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const data = { 
        arabic, 
        translation, 
        translationUrdu,
        reference, 
        referenceUrdu,
        updatedAt: serverTimestamp() 
      };
      if (editingHadith) {
        await updateDoc(doc(db, 'hadith', editingHadith.id), data);
      } else {
        await addDoc(collection(db, 'hadith'), { ...data, createdAt: serverTimestamp() });
      }
      closeModal();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Delete this Hadith?')) {
      await deleteDoc(doc(db, 'hadith', id));
    }
  };

  const openModal = (hadith?: any) => {
    if (hadith) {
      setEditingHadith(hadith);
      setArabic(hadith.arabic || '');
      setTranslation(hadith.translation || '');
      setTranslationUrdu(hadith.translationUrdu || '');
      setReference(hadith.reference || '');
      setReferenceUrdu(hadith.referenceUrdu || '');
    } else {
      setEditingHadith(null);
      setArabic('');
      setTranslation('');
      setTranslationUrdu('');
      setReference('');
      setReferenceUrdu('');
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingHadith(null);
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-theme-primary">Manage Hadith</h3>
          <p className="text-theme-secondary text-sm">Add Hadith text with references</p>
        </div>
        <button onClick={() => openModal()} className="px-6 py-3 bg-orange-600 text-white font-bold rounded-xl flex items-center gap-2 shadow-lg shadow-orange-600/20"><Plus size={20} /> Add Hadith</button>
      </div>

      <div className="space-y-4">
        {hadiths.map(h => (
          <div key={h.id} className={`p-6 rounded-2xl border ${theme === 'dark' ? 'bg-stone-900 border-stone-800' : 'bg-white border-stone-200'} shadow-xl`}>
            <p className="text-right font-quran text-2xl text-theme-primary mb-4 leading-loose" dir="rtl">{h.arabic}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-xs font-bold text-theme-secondary uppercase mb-1">English</p>
                <p className="text-theme-primary text-sm line-clamp-3">{h.translation}</p>
              </div>
              <div>
                <p className="text-xs font-bold text-theme-secondary uppercase mb-1 text-right">Urdu</p>
                <p className="text-theme-primary text-sm line-clamp-3 font-urdu text-right" dir="rtl">{h.translationUrdu}</p>
              </div>
            </div>
            <div className="flex items-center justify-between pt-4 border-t border-theme/10">
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-orange-500 uppercase tracking-widest">{h.reference}</span>
                <span className="text-[10px] font-bold text-theme-secondary font-urdu text-right" dir="rtl">{h.referenceUrdu}</span>
              </div>
              <div className="flex gap-2">
                <button onClick={() => openModal(h)} className="p-2 rounded-lg bg-blue-500/10 text-blue-500 hover:bg-blue-500 hover:text-white transition-all"><Edit size={16} /></button>
                <button onClick={() => handleDelete(h.id)} className="p-2 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all"><Trash2 size={16} /></button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={closeModal} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className={`relative w-full max-w-2xl p-8 rounded-3xl border ${theme === 'dark' ? 'bg-stone-900 border-stone-800' : 'bg-white border-stone-200'} shadow-2xl`}>
              <h2 className="text-2xl font-bold text-theme-primary mb-6">{editingHadith ? 'Edit Hadith' : 'Add Hadith'}</h2>
              <form onSubmit={handleSave} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-theme-secondary uppercase mb-2">Arabic Text</label>
                  <textarea rows={4} required value={arabic} onChange={(e) => setArabic(e.target.value)} className={`w-full px-4 py-3 rounded-xl border font-quran text-xl text-right ${theme === 'dark' ? 'bg-black border-stone-800 text-white' : 'bg-stone-50 border-stone-200 text-black'}`} dir="rtl" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-theme-secondary uppercase mb-2">Translation (English)</label>
                    <textarea rows={3} required value={translation} onChange={(e) => setTranslation(e.target.value)} className={`w-full px-4 py-3 rounded-xl border ${theme === 'dark' ? 'bg-black border-stone-800 text-white' : 'bg-stone-50 border-stone-200 text-black'}`} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-theme-secondary uppercase mb-2">Translation (Urdu)</label>
                    <textarea rows={3} required value={translationUrdu} onChange={(e) => setTranslationUrdu(e.target.value)} className={`w-full px-4 py-3 rounded-xl border font-urdu text-right ${theme === 'dark' ? 'bg-black border-stone-800 text-white' : 'bg-stone-50 border-stone-200 text-black'}`} dir="rtl" />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-theme-secondary uppercase mb-2">Reference (English)</label>
                    <input type="text" required value={reference} onChange={(e) => setReference(e.target.value)} className={`w-full px-4 py-3 rounded-xl border ${theme === 'dark' ? 'bg-black border-stone-800 text-white' : 'bg-stone-50 border-stone-200 text-black'}`} placeholder="e.g. Sahih Bukhari: 1" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-theme-secondary uppercase mb-2">Reference (Urdu)</label>
                    <input type="text" required value={referenceUrdu} onChange={(e) => setReferenceUrdu(e.target.value)} className={`w-full px-4 py-3 rounded-xl border font-urdu text-right ${theme === 'dark' ? 'bg-black border-stone-800 text-white' : 'bg-stone-50 border-stone-200 text-black'}`} dir="rtl" placeholder="مثلاً صحیح بخاری: 1" />
                  </div>
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <button type="button" onClick={closeModal} className="px-6 py-3 font-bold text-theme-secondary">Cancel</button>
                  <button type="submit" disabled={saving} className="px-8 py-3 bg-orange-600 text-white font-bold rounded-xl shadow-lg shadow-orange-600/20">{saving ? 'Saving...' : 'Save Hadith'}</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const Toast = ({ message, type, onClose }: { message: string, type: 'success' | 'error' | 'warning', onClose: () => void }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const icons = {
    success: <Check className="text-green-500" size={20} />,
    error: <X className="text-red-500" size={20} />,
    warning: <AlertCircle className="text-yellow-500" size={20} />
  };

  const bgColors = {
    success: 'bg-green-50 border-green-200',
    error: 'bg-red-50 border-red-200',
    warning: 'bg-yellow-50 border-yellow-200'
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 50, x: '-50%' }}
      animate={{ opacity: 1, y: 0, x: '-50%' }}
      exit={{ opacity: 0, y: 50, x: '-50%' }}
      className={`fixed bottom-8 left-1/2 z-[10000] flex items-center gap-3 px-6 py-4 rounded-2xl border shadow-2xl ${bgColors[type]}`}
    >
      {icons[type]}
      <span className="text-stone-900 font-medium">{message}</span>
      <button onClick={onClose} className="ml-4 text-stone-400 hover:text-stone-600">
        <X size={16} />
      </button>
    </motion.div>
  );
};

const useToast = () => {
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' | 'warning' } | null>(null);
  const showToast = (message: string, type: 'success' | 'error' | 'warning' = 'success') => {
    setToast({ message, type });
  };
  const hideToast = () => setToast(null);
  return { toast, showToast, hideToast };
};

const AdminAssistant = () => {
  const { theme } = useTheme();
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'settings', 'assistant'), (snapshot) => {
      if (snapshot.exists()) {
        setSettings(snapshot.data());
      } else {
        setSettings({
          name: "Shakir AI Assistant",
          role: "Mufti Munir Shakir's AI Assistant",
          welcomeMessage: "Assalam-o-Alaikum! Main Mufti Sahab ka Shakir AI Assistant hoon. Aap mujhse koi bhi sawal pooch sakte hain.",
          systemInstruction: "Aap Mufti Sahab ke 'Shakir AI Assistant' hain. User ke lehje ke mutabiq apne aap ko dhalien. Agar user dostana hai, to aap bhi dostana baat karein. Agar user sanjida hai, to aap bhi sanjida aur professional rahein. Aapka naam 'Shakir AI Assistant' hai. User ki zaban (Urdu, English, Pashto, Arabic, Roman Urdu) khud pehchanein aur usi zaban mein jawab dein.",
          voice: "Male",
          mode: "Short"
        });
      }
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'settings/assistant');
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await setDoc(doc(db, 'settings', 'assistant'), settings, { merge: true });
      alert("Assistant settings updated");
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className={`p-8 rounded-3xl border ${theme === 'dark' ? 'bg-stone-900 border-stone-800' : 'bg-white border-stone-200'} shadow-xl`}>
      <div className="flex items-center gap-4 mb-8">
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${theme === 'dark' ? 'bg-orange-600/20 text-orange-500' : 'bg-green-600/20 text-green-600'}`}>
          <Bot size={28} />
        </div>
        <div>
          <h3 className="text-xl font-bold text-theme-primary">AI Assistant Configuration</h3>
          <p className="text-theme-secondary text-sm">Customize how the AI Assistant behaves and appears.</p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-theme-secondary uppercase mb-2">Assistant Name (English)</label>
              <input 
                type="text" 
                value={settings.name}
                onChange={e => setSettings({...settings, name: e.target.value})}
                className={`w-full px-4 py-3 rounded-xl border ${theme === 'dark' ? 'bg-stone-800 border-stone-700 text-white' : 'bg-stone-50 border-stone-200 text-black'} focus:outline-none focus:ring-2 focus:ring-orange-500/20`}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-theme-secondary uppercase mb-2">Assistant Name (Urdu)</label>
              <input 
                type="text" 
                value={settings.nameUrdu || ''}
                onChange={e => setSettings({...settings, nameUrdu: e.target.value})}
                className={`w-full px-4 py-3 rounded-xl border font-urdu text-right ${theme === 'dark' ? 'bg-stone-800 border-stone-700 text-white' : 'bg-stone-50 border-stone-200 text-black'} focus:outline-none focus:ring-2 focus:ring-orange-500/20`}
                dir="rtl"
              />
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-theme-secondary uppercase mb-2">Assistant Role (English)</label>
              <input 
                type="text" 
                value={settings.role}
                onChange={e => setSettings({...settings, role: e.target.value})}
                className={`w-full px-4 py-3 rounded-xl border ${theme === 'dark' ? 'bg-stone-800 border-stone-700 text-white' : 'bg-stone-50 border-stone-200 text-black'} focus:outline-none focus:ring-2 focus:ring-orange-500/20`}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-theme-secondary uppercase mb-2">Assistant Role (Urdu)</label>
              <input 
                type="text" 
                value={settings.roleUrdu || ''}
                onChange={e => setSettings({...settings, roleUrdu: e.target.value})}
                className={`w-full px-4 py-3 rounded-xl border font-urdu text-right ${theme === 'dark' ? 'bg-stone-800 border-stone-700 text-white' : 'bg-stone-50 border-stone-200 text-black'} focus:outline-none focus:ring-2 focus:ring-orange-500/20`}
                dir="rtl"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-xs font-bold text-theme-secondary uppercase mb-2">Welcome Message (English)</label>
            <textarea 
              rows={3}
              value={settings.welcomeMessage}
              onChange={e => setSettings({...settings, welcomeMessage: e.target.value})}
              className={`w-full px-4 py-3 rounded-xl border ${theme === 'dark' ? 'bg-stone-800 border-stone-700 text-white' : 'bg-stone-50 border-stone-200 text-black'} focus:outline-none focus:ring-2 focus:ring-orange-500/20`}
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-theme-secondary uppercase mb-2">Welcome Message (Urdu)</label>
            <textarea 
              rows={3}
              value={settings.welcomeMessageUrdu || ''}
              onChange={e => setSettings({...settings, welcomeMessageUrdu: e.target.value})}
              className={`w-full px-4 py-3 rounded-xl border font-urdu text-right ${theme === 'dark' ? 'bg-stone-800 border-stone-700 text-white' : 'bg-stone-50 border-stone-200 text-black'} focus:outline-none focus:ring-2 focus:ring-orange-500/20`}
              dir="rtl"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-theme-secondary uppercase mb-2">System Instructions (Personality & Behavior)</label>
          <textarea 
            rows={5}
            value={settings.systemInstruction}
            onChange={e => setSettings({...settings, systemInstruction: e.target.value})}
            className={`w-full px-4 py-3 rounded-xl border ${theme === 'dark' ? 'bg-stone-800 border-stone-700 text-white' : 'bg-stone-50 border-stone-200 text-black'} focus:outline-none focus:ring-2 focus:ring-orange-500/20`}
            placeholder="e.g. You are a helpful Islamic Assistant. Provide answers based on authentic Islamic teachings..."
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-xs font-bold text-theme-secondary uppercase mb-2">Default Voice</label>
            <select 
              value={settings.voice}
              onChange={e => setSettings({...settings, voice: e.target.value})}
              className={`w-full px-4 py-3 rounded-xl border ${theme === 'dark' ? 'bg-stone-800 border-stone-700 text-white' : 'bg-stone-50 border-stone-200 text-black'} focus:outline-none focus:ring-2 focus:ring-orange-500/20`}
            >
              <option value="Male">Male (Fenrir)</option>
              <option value="Female">Female (Kore)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-theme-secondary uppercase mb-2">Default Response Mode</label>
            <select 
              value={settings.mode}
              onChange={e => setSettings({...settings, mode: e.target.value})}
              className={`w-full px-4 py-3 rounded-xl border ${theme === 'dark' ? 'bg-stone-800 border-stone-700 text-white' : 'bg-stone-50 border-stone-200 text-black'} focus:outline-none focus:ring-2 focus:ring-orange-500/20`}
            >
              <option value="Short">Short & Direct</option>
              <option value="Think">Detailed Reasoning</option>
              <option value="Pro">Professional / Academic</option>
            </select>
          </div>
        </div>

        <div className="pt-8 border-t border-theme/10">
          <h4 className="text-sm font-bold text-theme-secondary uppercase mb-4">Live Preview</h4>
          <div className={`p-6 rounded-2xl border ${theme === 'dark' ? 'bg-black border-stone-800' : 'bg-stone-50 border-stone-200'} flex items-start gap-4`}>
            <div className="w-12 h-12 bg-orange-600 rounded-full flex items-center justify-center flex-shrink-0">
              <Bot className="text-white" size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-bold text-theme-primary">{settings.name}</span>
                <span className="text-[10px] px-2 py-0.5 bg-orange-500/10 text-orange-500 rounded-full font-bold uppercase tracking-widest">{settings.role}</span>
              </div>
              <div className={`p-4 rounded-2xl rounded-tl-none ${theme === 'dark' ? 'bg-stone-800' : 'bg-white shadow-sm'} text-sm text-theme-primary`}>
                {settings.welcomeMessage}
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button type="submit" disabled={saving} className="px-8 py-3 bg-orange-600 text-white font-bold rounded-xl shadow-lg shadow-orange-600/20 flex items-center gap-2">
            <Save size={20} />
            {saving ? 'Saving...' : 'Save Assistant Settings'}
          </button>
        </div>
      </form>
    </div>
  );
};

const AdminHome = () => {
  const { settings, updateSettings } = useSettings();
  const { theme } = useTheme();
  const [localSettings, setLocalSettings] = useState(settings);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await updateSettings(localSettings);
    setSaving(false);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    try {
      const storageRef = ref(storage, `home/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      setLocalSettings(prev => ({ ...prev, homeImageUrl: url }));
    } catch (error) {
      console.error("Upload failed:", error);
      alert("Image upload failed");
    }
  };

  return (
    <div className={`p-8 rounded-3xl border ${theme === 'dark' ? 'bg-stone-900 border-stone-800' : 'bg-white border-stone-200'} shadow-xl`}>
      <form onSubmit={handleSave} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-theme-secondary uppercase tracking-widest mb-2">Main Heading (English)</label>
              <input 
                type="text" 
                value={localSettings.homeHeading}
                onChange={(e) => setLocalSettings(prev => ({ ...prev, homeHeading: e.target.value }))}
                className={`w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition-all ${theme === 'dark' ? 'bg-black border-stone-800 text-white' : 'bg-stone-50 border-stone-200 text-black'}`}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-theme-secondary uppercase tracking-widest mb-2">Main Heading (Urdu)</label>
              <input 
                type="text" 
                value={localSettings.homeHeadingUrdu}
                onChange={(e) => setLocalSettings(prev => ({ ...prev, homeHeadingUrdu: e.target.value }))}
                className={`w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition-all font-urdu text-right ${theme === 'dark' ? 'bg-black border-stone-800 text-white' : 'bg-stone-50 border-stone-200 text-black'}`}
                dir="rtl"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-theme-secondary uppercase tracking-widest mb-2">Subheading (English)</label>
              <input 
                type="text" 
                value={localSettings.homeSubheading}
                onChange={(e) => setLocalSettings(prev => ({ ...prev, homeSubheading: e.target.value }))}
                className={`w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition-all ${theme === 'dark' ? 'bg-black border-stone-800 text-white' : 'bg-stone-50 border-stone-200 text-black'}`}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-theme-secondary uppercase tracking-widest mb-2">Subheading (Urdu)</label>
              <input 
                type="text" 
                value={localSettings.homeSubheadingUrdu}
                onChange={(e) => setLocalSettings(prev => ({ ...prev, homeSubheadingUrdu: e.target.value }))}
                className={`w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition-all font-urdu text-right ${theme === 'dark' ? 'bg-black border-stone-800 text-white' : 'bg-stone-50 border-stone-200 text-black'}`}
                dir="rtl"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-theme-secondary uppercase tracking-widest mb-2">Hero Image</label>
            <div className="relative group">
              <img 
                src={localSettings.homeImageUrl} 
                alt="Hero" 
                className="w-full h-64 object-cover rounded-2xl border border-theme/10"
                referrerPolicy="no-referrer"
              />
              <label className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer rounded-2xl">
                <div className="flex flex-col items-center text-white">
                  <Upload size={24} />
                  <span className="text-xs font-bold mt-2">Change Image</span>
                </div>
                <input type="file" className="hidden" onChange={handleImageUpload} accept="image/*" />
              </label>
            </div>
            {localSettings.homeImageUrl && (
              <button 
                type="button" 
                onClick={() => window.open(localSettings.homeImageUrl, '_blank')}
                className="mt-2 text-[10px] font-bold text-orange-500 hover:underline flex items-center gap-1"
              >
                <Download size={12} /> Download Hero Image
              </button>
            )}
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-xs font-bold text-theme-secondary uppercase tracking-widest mb-2">Introduction Text (English)</label>
            <textarea 
              rows={6}
              value={localSettings.homeText}
              onChange={(e) => setLocalSettings(prev => ({ ...prev, homeText: e.target.value }))}
              className={`w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition-all ${theme === 'dark' ? 'bg-black border-stone-800 text-white' : 'bg-stone-50 border-stone-200 text-black'}`}
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-theme-secondary uppercase tracking-widest mb-2">Introduction Text (Urdu)</label>
            <textarea 
              rows={6}
              value={localSettings.homeTextUrdu}
              onChange={(e) => setLocalSettings(prev => ({ ...prev, homeTextUrdu: e.target.value }))}
              className={`w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition-all font-urdu text-right ${theme === 'dark' ? 'bg-black border-stone-800 text-white' : 'bg-stone-50 border-stone-200 text-black'}`}
              dir="rtl"
            />
          </div>
        </div>
        <div className="flex justify-end">
          <button 
            type="submit"
            disabled={saving}
            className="px-8 py-3 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-xl flex items-center gap-2 shadow-lg shadow-orange-600/20 transition-all"
          >
            <Save size={20} />
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
};

const AdminSettings = () => {
  const { settings, updateSettings } = useSettings();
  const { theme } = useTheme();
  const [localSettings, setLocalSettings] = useState(settings);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await updateSettings(localSettings);
    setSaving(false);
    alert("Settings applied successfully!");
  };

  const handleFontUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'english' | 'urdu') => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const storageRef = ref(storage, `fonts/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      const family = file.name.split('.')[0].replace(/\s+/g, '-');
      setLocalSettings(prev => ({
        ...prev,
        customFonts: [...(prev.customFonts || []), { name: file.name, url, family, type }]
      }));
    } catch (error) {
      console.error(error);
    }
  };

  const fonts = [
    { name: 'Inter', value: "'Inter', sans-serif" },
    { name: 'Playfair Display', value: "'Playfair Display', serif" },
    { name: 'Space Grotesk', value: "'Space Grotesk', sans-serif" },
    { name: 'Outfit', value: "'Outfit', sans-serif" },
    { name: 'JetBrains Mono', value: "'JetBrains Mono', monospace" },
    ...(localSettings.customFonts || []).map(f => ({ name: f.name, value: `'${f.family}', sans-serif` }))
  ];

  const colors = [
    { name: 'Orange', value: '#ea580c' },
    { name: 'Green', value: '#166534' },
    { name: 'Blue', value: '#1e40af' },
    { name: 'Purple', value: '#6b21a8' },
    { name: 'Red', value: '#991b1b' },
  ];

  return (
    <div className={`p-8 rounded-3xl border ${theme === 'dark' ? 'bg-stone-900 border-stone-800' : 'bg-white border-stone-200'} shadow-xl`}>
      <form onSubmit={handleSave} className="space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Headings Font */}
          <div>
            <label className="block text-xs font-bold text-theme-secondary uppercase tracking-widest mb-4">Headings Font</label>
            <select 
              value={localSettings.headingFont}
              onChange={(e) => setLocalSettings(prev => ({ ...prev, headingFont: e.target.value }))}
              className={`w-full px-4 py-3 rounded-xl border ${theme === 'dark' ? 'bg-black border-stone-800 text-white' : 'bg-stone-50 border-stone-200 text-black'}`}
            >
              {fonts.map(f => <option key={f.value} value={f.value}>{f.name}</option>)}
            </select>
          </div>
          {/* Body Font */}
          <div>
            <label className="block text-xs font-bold text-theme-secondary uppercase tracking-widest mb-4">Body Font</label>
            <select 
              value={localSettings.bodyFont}
              onChange={(e) => setLocalSettings(prev => ({ ...prev, bodyFont: e.target.value }))}
              className={`w-full px-4 py-3 rounded-xl border ${theme === 'dark' ? 'bg-black border-stone-800 text-white' : 'bg-stone-50 border-stone-200 text-black'}`}
            >
              {fonts.map(f => <option key={f.value} value={f.value}>{f.name}</option>)}
            </select>
          </div>
          {/* Urdu Font */}
          <div>
            <label className="block text-xs font-bold text-theme-secondary uppercase tracking-widest mb-4">Urdu Font</label>
            <select 
              value={localSettings.urduFont}
              onChange={(e) => setLocalSettings(prev => ({ ...prev, urduFont: e.target.value }))}
              className={`w-full px-4 py-3 rounded-xl border ${theme === 'dark' ? 'bg-black border-stone-800 text-white' : 'bg-stone-50 border-stone-200 text-black'}`}
            >
              <option value="'Noto Nastaliq Urdu', serif">Noto Nastaliq Urdu</option>
              <option value="'Jameel Noori Nastaleeq', serif">Jameel Noori Nastaleeq</option>
              {fonts.map(f => <option key={f.value} value={f.value}>{f.name}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <label className="block text-xs font-bold text-theme-secondary uppercase tracking-widest mb-4">Upload Custom Font</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className={`p-6 border-2 border-dashed rounded-2xl text-center ${theme === 'dark' ? 'border-stone-800 hover:border-orange-500/50' : 'border-stone-200 hover:border-green-500/50'} transition-colors`}>
                <Upload className="mx-auto mb-2 text-theme-secondary" size={24} />
                <p className="text-[10px] text-theme-secondary mb-4 uppercase font-bold">English Font</p>
                <label className="px-4 py-2 bg-theme-secondary/10 text-theme-primary text-[10px] font-bold rounded-lg cursor-pointer hover:bg-theme-secondary/20 transition-all">
                  Choose File
                  <input type="file" className="hidden" onChange={(e) => handleFontUpload(e, 'english')} accept=".ttf,.otf,.woff,.woff2" />
                </label>
              </div>
              <div className={`p-6 border-2 border-dashed rounded-2xl text-center ${theme === 'dark' ? 'border-stone-800 hover:border-orange-500/50' : 'border-stone-200 hover:border-green-500/50'} transition-colors`}>
                <Upload className="mx-auto mb-2 text-theme-secondary" size={24} />
                <p className="text-[10px] text-theme-secondary mb-4 uppercase font-bold">Urdu Font</p>
                <label className="px-4 py-2 bg-theme-secondary/10 text-theme-primary text-[10px] font-bold rounded-lg cursor-pointer hover:bg-theme-secondary/20 transition-all">
                  Choose File
                  <input type="file" className="hidden" onChange={(e) => handleFontUpload(e, 'urdu')} accept=".ttf,.otf,.woff,.woff2" />
                </label>
              </div>
            </div>
            {localSettings.customFonts?.length > 0 && (
              <div className="mt-4 space-y-2">
                <p className="text-[10px] font-bold text-theme-secondary uppercase">Uploaded Fonts</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {localSettings.customFonts.map((f) => (
                    <div key={f.family} className="flex items-center justify-between p-3 rounded-xl bg-theme-secondary/5 text-xs border border-theme/5">
                      <div className="flex flex-col">
                        <span className="truncate font-bold">{f.name}</span>
                        <span className="text-[8px] uppercase text-orange-500 font-bold tracking-widest">{f.type}</span>
                      </div>
                      <Check size={14} className="text-green-500" />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-theme-secondary uppercase tracking-widest mb-4">Theme Accent Color</label>
            <div className="grid grid-cols-2 gap-3">
              {colors.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setLocalSettings(prev => ({ ...prev, themeColor: c.value }))}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${
                    localSettings.themeColor === c.value 
                      ? 'border-orange-500 bg-orange-500/10 text-orange-500' 
                      : 'border-theme/10 hover:border-theme/20'
                  }`}
                >
                  <div className="w-4 h-4 rounded-full" style={{ backgroundColor: c.value }}></div>
                  <span className="text-sm font-bold">{c.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="pt-6 border-t border-theme/10 flex justify-end gap-4">
          <div className="flex-grow flex items-center gap-4">
             <div className="p-4 rounded-xl border border-theme/10 bg-theme-secondary/5">
                <p className="text-[10px] uppercase font-bold text-theme-secondary mb-1">Preview</p>
                <h4 style={{ fontFamily: localSettings.headingFont }} className="text-lg font-bold">Heading Preview</h4>
                <p style={{ fontFamily: localSettings.bodyFont }} className="text-sm">Body text preview with selected font.</p>
                <p style={{ fontFamily: localSettings.urduFont }} className="text-lg mt-1">اردو متن کا نمونہ</p>
             </div>
          </div>
          <button 
            type="submit"
            disabled={saving}
            className="px-8 py-3 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-xl flex items-center gap-2 shadow-lg shadow-orange-600/20 transition-all"
          >
            <Save size={20} />
            {saving ? 'Applying Settings...' : 'Apply Global Settings'}
          </button>
        </div>
      </form>
    </div>
  );
};

const AdminLogin = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { theme } = useTheme();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate('/admin');
    } catch (err: any) {
      setError(err.message || 'Failed to login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-theme-primary flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`w-full max-w-md p-8 rounded-2xl border ${theme === 'dark' ? 'bg-stone-900 border-stone-800' : 'bg-white border-stone-200'} shadow-2xl`}
      >
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-orange-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Lock className="text-orange-500" size={32} />
          </div>
          <h2 className="text-2xl font-bold text-theme-primary">Admin Portal</h2>
          <p className="text-theme-secondary text-sm">Secure login for administrators</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 text-red-500 text-sm">
            <AlertCircle size={18} />
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-xs font-bold text-theme-secondary uppercase tracking-widest mb-2">Email Address</label>
            <input 
              type="email" 
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition-all ${theme === 'dark' ? 'bg-black border-stone-800 text-white' : 'bg-stone-50 border-stone-200 text-black'}`}
              placeholder="admin@example.com"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-theme-secondary uppercase tracking-widest mb-2">Password</label>
            <input 
              type="password" 
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition-all ${theme === 'dark' ? 'bg-black border-stone-800 text-white' : 'bg-stone-50 border-stone-200 text-black'}`}
              placeholder="••••••••"
            />
          </div>
          <button 
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-xl shadow-lg shadow-orange-600/20 transition-all flex items-center justify-center gap-2"
          >
            {loading ? 'Authenticating...' : 'Login to Dashboard'}
          </button>
        </form>
      </motion.div>
    </div>
  );
};

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isAdmin, loading } = useAuth();
  
  if (loading) {
    return <LoadingSpinner fullPage />;
  }
  
  if (!user || !isAdmin) {
    return <Navigate to="/admin/login" replace />;
  }
  
  return <>{children}</>;
};

const AppContent = () => {
  const { loading: settingsLoading } = useSettings();
  const { loading: authLoading } = useAuth();

  if (settingsLoading || authLoading) {
    return <LoadingSpinner fullPage />;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="articles" element={<Articles />} />
          <Route path="articles/:id" element={<ArticleDetail />} />
          <Route path="videos" element={<Videos />} />
          <Route path="videos/:videoId" element={<VideoPlayer />} />
          <Route path="quran" element={<Quran />} />
          <Route path="quran/:id" element={<QuranDetail />} />
          <Route path="hadith" element={<Hadith />} />
          <Route path="hadith/:bookId" element={<HadithDetail />} />
          <Route path="books" element={<Books />} />
          <Route path="bio" element={<Bio />} />
        </Route>
        <Route path="/admin/login" element={<AdminLogin />} />
          <Route 
            path="/admin" 
            element={
              <ProtectedRoute>
                <AdminPanel />
              </ProtectedRoute>
            } 
          />
      </Routes>
      <ChatWidget />
    </BrowserRouter>
  );
};

export default function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <SettingsProvider>
          <AuthProvider>
            <ViewsProvider>
              <AppContent />
            </ViewsProvider>
          </AuthProvider>
        </SettingsProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}
