import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, 
  X, 
  FileText, 
  Trash2, 
  Download, 
  Heart, 
  MessageCircle, 
  ChevronLeft, 
  ChevronRight, 
  Upload, 
  ImageIcon, 
  FileUp, 
  Send, 
  Lock, 
  ShieldCheck, 
  LogOut, 
  Loader2, 
  CheckCircle2, 
  Pin,
  Pencil,
  Search,
  Check,
  ImagePlus,
  Pause,
  Play,
  Home,
  Bell,
  BellRing,
  BellOff,
  Inbox,
  SlidersHorizontal,
  Megaphone
} from 'lucide-react';
import {
  AttachedImage,
  AttachedPdf,
  CommentItem,
  LessonItem,
  ModuleItem,
  SpecializationItem,
  StudentSubmissionItem,
  AnnouncementBannerConfig,
  AnnouncementBannerImage,
  AutoLikesRateUnit
} from './types';
import logoAsset from './assets/logo.png';
import avatarAsset from './assets/avatar.jpg';
import { 
  subscribeModules, 
  addModuleToFirestore, 
  deleteModuleFromFirestore, 
  updateModuleLessonsInFirestore, 
  checkAdminAccountExists, 
  createSingleAdminAccount, 
  verifyAdminLogin, 
  isCurrentAdminLoggedIn, 
  logoutAdmin, 
  uploadImageToImgBB,
  DEFAULT_SPECIALIZATIONS,
  subscribeSpecializations,
  saveSpecializationsToFirestore,
  uploadPdfToCatbox,
  assignBalancedLikesShard,
  syncLessonLikesToShard,
  updateRealUserLikeOnShard,
  subscribeLessonLikesFromShards,
  resolveMediaUrl,
  resolveMediaBlob,
  resolveMediaDataUrl,
  isFirestoreMediaUrl,
  subscribeAdminNewsPosts,
  updateAdminNewsPostsInFirestore,
  ADMIN_NEWS_MODULE_ID,
  publishStudentNotificationToFirestore,
  clearStudentNotificationFromFirestore,
  subscribeLatestStudentNotification,
  StudentNotificationPayload,
  subscribeStudentSubmissions,
  addStudentSubmissionToFirestore,
  markStudentSubmissionReadInFirestore,
  deleteStudentSubmissionFromFirestore,
  subscribeAnnouncementBanner,
  saveAnnouncementBannerToFirestore
} from './services/firebase';
import { CloudImage } from './components/CloudImage';
import { 
  calculateAutomatedLikes, 
  applyAutomatedLikesToLessons,
  getSimulatedAutoLikesOnly
} from './services/likesAlgorithm';

const NEW_LOGO_URL = 'https://i.ibb.co/zTZcJ8zq/Screenshot-20261110-131301-Chrome.png';
const ADMIN_AVATAR_URL = 'https://i.ibb.co/d4NCmpYL/1785099526878.jpg';

const formatPostTime = (timestamp?: number, fallbackId?: string): string => {
  let ts = timestamp && !isNaN(timestamp) ? timestamp : 0;
  if (!ts && fallbackId) {
    const parsedPrefix = Number(String(fallbackId).split('-')[0]);
    if (!isNaN(parsedPrefix) && parsedPrefix > 1000000000000) {
      ts = parsedPrefix;
    }
  }
  if (!ts) return '';
  try {
    return new Date(ts).toLocaleTimeString('ar-DZ', {
      timeZone: 'Africa/Algiers',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  } catch {
    const d = new Date(ts);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
};

const getTimeInputFromTimestamp = (timestamp?: number): string => {
  const ts = timestamp && !isNaN(timestamp) ? timestamp : Date.now();
  try {
    const parts = new Date(ts).toLocaleTimeString('en-GB', {
      timeZone: 'Africa/Algiers',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    return /^\d{2}:\d{2}$/.test(parts) ? parts : '12:00';
  } catch {
    const d = new Date(ts);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
};

const detectTelegramInAppBrowser = (): boolean => {
  if (typeof window === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const w = window as any;
  return (
    /Telegram/i.test(ua) ||
    Boolean(w.TelegramWebviewProxy || w.TelegramWebview || w.Telegram?.WebView) ||
    /t\.me/i.test(document.referrer || '')
  );
};

const getExternalBrowserHref = (url: string): string => {
  if (typeof navigator === 'undefined') return url;
  const ua = navigator.userAgent || '';
  if (/Android/i.test(ua)) {
    if (url.startsWith('https://') || url.startsWith('http://')) {
      const scheme = url.startsWith('http://') ? 'http' : 'https';
      const stripped = url.replace(/^https?:\/\//i, '');
      return `intent://${stripped}#Intent;scheme=${scheme};package=com.android.chrome;action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;S.browser_fallback_url=${encodeURIComponent(url)};end`;
    }
  }
  if (/iPhone|iPad|iPod/i.test(ua) && /OS (1[7-9]|[2-9]\d)_/i.test(ua)) {
    if (url.startsWith('https://') || url.startsWith('http://')) {
      return `x-safari-${url}`;
    }
  }
  return url;
};

// Anonymous session ID generator for non-admin public visitors (e.g. مجهول الهوية #4821)
const getSessionAnonId = (): string => {
  try {
    let id = sessionStorage.getItem('ens_anon_session_id');
    if (!id) {
      id = String(Math.floor(1000 + Math.random() * 9000));
      sessionStorage.setItem('ens_anon_session_id', id);
    }
    return id;
  } catch {
    return '1234';
  }
};

const getInitialNavParams = () => {
  if (typeof window === 'undefined') {
    return {
      year: 'second' as const,
      spec: 'pep-arabe',
      moduleId: null as string | null,
      isNews: false,
      isSubmissions: false,
    };
  }
  const params = new URLSearchParams(window.location.search);
  const view = params.get('view');
  const yearParam = params.get('year');
  const specParam = params.get('spec');
  const moduleParam = params.get('module');
  const isNews = view === 'news';
  const isSubmissions = view === 'submit';
  return {
    year: yearParam === 'first' ? ('first' as const) : ('second' as const),
    spec: specParam || 'pep-arabe',
    moduleId: (isNews || isSubmissions) ? null : (moduleParam || null),
    isNews,
    isSubmissions,
  };
};

export default function App() {
  const initialNav = getInitialNavParams();
  const [selectedYear, setSelectedYear] = useState<'first' | 'second'>(initialNav.year);
  const [activeModuleId, setActiveModuleId] = useState<string | null>(initialNav.moduleId);
  const [isNewsView, setIsNewsView] = useState<boolean>(initialNav.isNews);
  const [isSubmissionsView, setIsSubmissionsView] = useState<boolean>(initialNav.isSubmissions);

  // Telegram In-App Browser detection & Download loading state
  const [isTelegramBrowser] = useState<boolean>(() => detectTelegramInAppBrowser());
  const isDownloadingInTelegramRef = useRef(false);
  const [activeDownloadKeys, setActiveDownloadKeys] = useState<Record<string, boolean>>({});

  // Admin Authentication state
  const [isAdmin, setIsAdmin] = useState<boolean>(() => isCurrentAdminLoggedIn());
  const [logoTapCount, setLogoTapCount] = useState<number>(0);
  const logoTapTimeoutRef = useRef<any>(null);

  // Admin Modals
  const [isAdminSetupModalOpen, setIsAdminSetupModalOpen] = useState(false);
  const [isAdminLoginModalOpen, setIsAdminLoginModalOpen] = useState(false);
  const [adminUsernameInput, setAdminUsernameInput] = useState('');
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [adminAuthError, setAdminAuthError] = useState<string | null>(null);
  const [adminAuthLoading, setAdminAuthLoading] = useState(false);
  const [adminSuccessNotification, setAdminSuccessNotification] = useState<string | null>(null);

  // Modules stored per year (Exclusively synced from Firebase Firestore - Zero LocalStorage)
  const [year1Modules, setYear1Modules] = useState<ModuleItem[]>([]);
  const [year2Modules, setYear2Modules] = useState<ModuleItem[]>([]);
  const [isYear1Loaded, setIsYear1Loaded] = useState(false);
  const [isYear2Loaded, setIsYear2Loaded] = useState(false);

  // Admin News & Updates Posts (Home icon feed - synced from Firebase Firestore)
  const [adminNewsPosts, setAdminNewsPosts] = useState<LessonItem[]>([]);
  const [isNewsLoaded, setIsNewsLoaded] = useState(false);

  // Student Submissions to Admin (Send icon feed - synced from Firebase Firestore)
  const [studentSubmissions, setStudentSubmissions] = useState<StudentSubmissionItem[]>([]);
  const [isSubmissionsLoaded, setIsSubmissionsLoaded] = useState(false);
  const [subSenderName, setSubSenderName] = useState('');
  const [subYearLabel, setSubYearLabel] = useState('السنة الثانية');
  const [subModuleName, setSubModuleName] = useState('');
  const [subTitle, setSubTitle] = useState('');
  const [subDescription, setSubDescription] = useState('');
  const [subImages, setSubImages] = useState<AttachedImage[]>([]);
  const [subPdfs, setSubPdfs] = useState<AttachedPdf[]>([]);
  const [isUploadingSubImages, setIsUploadingSubImages] = useState(false);
  const [isUploadingSubPdfs, setIsUploadingSubPdfs] = useState(false);
  const [isSubmittingStudentContent, setIsSubmittingStudentContent] = useState(false);
  const [subFormError, setSubFormError] = useState<string | null>(null);
  const [subFormSuccess, setSubFormSuccess] = useState<string | null>(null);
  const subDescRef = useRef<HTMLTextAreaElement>(null);

  // Specializations (Default 'PEP arabe' + dynamically synced from Firebase Firestore)
  const [specializations, setSpecializations] = useState<SpecializationItem[]>(DEFAULT_SPECIALIZATIONS);
  const [selectedSpecializationId, setSelectedSpecializationId] = useState<string>(initialNav.spec);
  const [isAddSpecializationModalOpen, setIsAddSpecializationModalOpen] = useState(false);
  const [newSpecializationName, setNewSpecializationName] = useState('');

  // Top Search & Lessons Type Filter states
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [moduleSearchQuery, setModuleSearchQuery] = useState('');
  const [lessonTypeFilter, setLessonTypeFilter] = useState<'all' | 'cour' | 'td' | 'exercises'>('all');
  const [newsTypeFilter, setNewsTypeFilter] = useState<'all' | 'news' | 'updates' | 'announcements'>('all');

  // Student Notifications on Post Publish
  const [notifyStudentsOnPublish, setNotifyStudentsOnPublish] = useState(false);
  const [activeStudentNotif, setActiveStudentNotif] = useState<StudentNotificationPayload | null>(null);
  const [incomingStudentNotif, setIncomingStudentNotif] = useState<StudentNotificationPayload | null>(null);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | 'unsupported'>(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission;
    }
    return 'unsupported';
  });

  // Persist current route/page in URL query params so refreshing NEVER forces back to home page (Zero LocalStorage)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    params.set('year', selectedYear);
    if (selectedSpecializationId && selectedSpecializationId !== 'pep-arabe') {
      params.set('spec', selectedSpecializationId);
    } else {
      params.delete('spec');
    }

    if (isSubmissionsView) {
      params.set('view', 'submit');
      params.delete('module');
    } else if (isNewsView) {
      params.set('view', 'news');
      params.delete('module');
    } else if (activeModuleId) {
      params.delete('view');
      params.set('module', activeModuleId);
    } else {
      params.delete('view');
      params.delete('module');
    }

    const qs = params.toString();
    const nextUrl = `${window.location.pathname}${qs ? `?${qs}` : ''}${window.location.hash || ''}`;
    const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash || ''}`;
    if (nextUrl !== currentUrl) {
      window.history.replaceState(null, '', nextUrl);
    }
  }, [selectedYear, selectedSpecializationId, activeModuleId, isNewsView, isSubmissionsView]);

  // Silent, immediate external browser handoff when opened inside Telegram in-app browser
  useEffect(() => {
    if (!isTelegramBrowser || typeof window === 'undefined') return;
    if (window.top !== window.self) return;

    const externalHref = getExternalBrowserHref(window.location.href);
    if (externalHref === window.location.href) return;

    try {
      if (sessionStorage.getItem('ens_tg_auto_external_tried') !== 'true') {
        sessionStorage.setItem('ens_tg_auto_external_tried', 'true');
        window.location.replace(externalHref);
      }
    } catch {}

    // Silent one-time user-gesture fallback for WebViews that block non-gesture intent:// redirects
    const handleSilentGestureRedirect = () => {
      if (isDownloadingInTelegramRef.current) return;
      try {
        if (sessionStorage.getItem('ens_tg_gesture_redirected') === '1') return;
        sessionStorage.setItem('ens_tg_gesture_redirected', '1');
      } catch {}
      document.removeEventListener('click', handleSilentGestureRedirect);
      const targetHref = getExternalBrowserHref(window.location.href);
      if (targetHref !== window.location.href) {
        window.location.href = targetHref;
      }
    };

    document.addEventListener('click', handleSilentGestureRedirect);
    return () => {
      document.removeEventListener('click', handleSilentGestureRedirect);
    };
  }, [isTelegramBrowser]);

  // Handle browser Back/Forward navigation cleanly
  useEffect(() => {
    const handlePopState = () => {
      const nav = getInitialNavParams();
      setSelectedYear(nav.year);
      setSelectedSpecializationId(nav.spec);
      setActiveModuleId(nav.moduleId);
      setIsNewsView(nav.isNews);
      setIsSubmissionsView(nav.isSubmissions);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Real-time Firebase Firestore Subscription for Specializations
  useEffect(() => {
    const unsubSpecs = subscribeSpecializations((specs) => {
      if (specs && specs.length > 0) {
        setSpecializations(specs);
      }
    });
    return () => unsubSpecs();
  }, []);

  // Scroll strictly to top whenever entering/switching a Module page, News view, or Submissions view
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    }
  }, [activeModuleId, isNewsView, isSubmissionsView]);

  // Real-time Firebase Firestore Subscription for Modules, Admin News Posts & Student Submissions
  useEffect(() => {
    const processLessonsList = (incLessons: LessonItem[], now: number): LessonItem[] => {
      return incLessons.map(l => {
        const automatedLikes = calculateAutomatedLikes(l, now);
        return {
          ...l,
          likesCount: (l.autoLikesEnabled === false || typeof l.manualLikesOffset === 'number')
            ? automatedLikes
            : Math.max(l.likesCount || 0, automatedLikes),
        };
      });
    };

    const processIncomingModules = (incoming: ModuleItem[]): ModuleItem[] => {
      if (!incoming) return [];
      const now = Date.now();
      return incoming.map(inc => {
        const incLessons = (inc && Array.isArray(inc.lessons)) ? inc.lessons : [];
        return {
          ...inc,
          lessons: processLessonsList(incLessons, now),
        };
      });
    };

    const unsubYear1 = subscribeModules('first', (modules) => {
      if (modules) {
        setYear1Modules(processIncomingModules(modules));
      }
      setIsYear1Loaded(true);
    }, () => {
      setIsYear1Loaded(true);
    });

    const unsubYear2 = subscribeModules('second', (modules) => {
      if (modules) {
        setYear2Modules(processIncomingModules(modules));
      }
      setIsYear2Loaded(true);
    }, () => {
      setIsYear2Loaded(true);
    });

    const unsubNews = subscribeAdminNewsPosts((posts) => {
      const now = Date.now();
      setAdminNewsPosts(processLessonsList(posts || [], now));
      setIsNewsLoaded(true);
    }, () => {
      setIsNewsLoaded(true);
    });

    const unsubSubmissions = subscribeStudentSubmissions((items) => {
      setStudentSubmissions(items || []);
      setIsSubmissionsLoaded(true);
    }, () => {
      setIsSubmissionsLoaded(true);
    });

    const unsubBanner = subscribeAnnouncementBanner((config) => {
      setBannerConfig(config);
    });

    return () => {
      unsubYear1();
      unsubYear2();
      unsubNews();
      unsubSubmissions();
      unsubBanner();
    };
  }, []);

  // Real-time Student Notification Broadcast Subscription
  useEffect(() => {
    const unsubNotif = subscribeLatestStudentNotification((notif) => {
      setActiveStudentNotif(notif);
      if (!notif) {
        setIncomingStudentNotif(null);
      }
    });

    return () => unsubNotif();
  }, []);

  // Strictly synchronize active/incoming notification with actual live posts in Firestore:
  // If a post or its module was deleted, clear the notification immediately and never show it.
  useEffect(() => {
    if (!activeStudentNotif) {
      setIncomingStudentNotif(null);
      return;
    }

    if (!isYear1Loaded || !isYear2Loaded || !isNewsLoaded) {
      return;
    }

    const targetId = String(activeStudentNotif.id);
    const existsInPosts =
      activeStudentNotif.targetType === 'news'
        ? adminNewsPosts.some(p => String(p.id) === targetId)
        : [...year1Modules, ...year2Modules].some(mod =>
            (mod.lessons || []).some(l => String(l.id) === targetId)
          );

    if (!existsInPosts) {
      setActiveStudentNotif(null);
      setIncomingStudentNotif(null);
      clearStudentNotificationFromFirestore().catch(() => {});
      return;
    }

    if (isAdmin || isCurrentAdminLoggedIn()) {
      setIncomingStudentNotif(null);
      return;
    }

    const ageMs = Date.now() - (activeStudentNotif.createdAt || 0);
    if (ageMs > 1000 * 60 * 60 * 12) {
      setIncomingStudentNotif(null);
      return;
    }

    try {
      if (sessionStorage.getItem('ens_dismissed_notif_id') === activeStudentNotif.id) {
        setIncomingStudentNotif(null);
        return;
      }
    } catch {}

    setIncomingStudentNotif(activeStudentNotif);

    if (
      typeof window !== 'undefined' &&
      'Notification' in window &&
      Notification.permission === 'granted' &&
      ageMs < 120000
    ) {
      let alreadyNative = false;
      try {
        alreadyNative = sessionStorage.getItem('ens_native_notified_id') === activeStudentNotif.id;
        if (!alreadyNative) {
          sessionStorage.setItem('ens_native_notified_id', activeStudentNotif.id);
        }
      } catch {}

      if (!alreadyNative) {
        try {
          new Notification(
            activeStudentNotif.targetType === 'news'
              ? `خبر جديد: ${activeStudentNotif.title}`
              : `منشور جديد في ${activeStudentNotif.moduleName || 'المقياس'}: ${activeStudentNotif.title}`,
            {
              body: activeStudentNotif.body || 'انقر لفتح المنصة ومشاهدة المنشور الجديد',
              icon: NEW_LOGO_URL,
            }
          );
        } catch {}
      }
    }
  }, [activeStudentNotif, adminNewsPosts, year1Modules, year2Modules, isYear1Loaded, isYear2Loaded, isNewsLoaded, isAdmin]);

  // Refs for latest state to prevent race conditions during async Firestore edits & auto-likes sync
  const year1ModulesRef = useRef<ModuleItem[]>(year1Modules);
  const year2ModulesRef = useRef<ModuleItem[]>(year2Modules);
  const adminNewsPostsRef = useRef<LessonItem[]>(adminNewsPosts);
  const isMutatingLessonsRef = useRef<boolean>(false);
  year1ModulesRef.current = year1Modules;
  year2ModulesRef.current = year2Modules;
  adminNewsPostsRef.current = adminNewsPosts;

  // Modals state for content creation
  const [isAddModuleModalOpen, setIsAddModuleModalOpen] = useState(false);
  const [newModuleName, setNewModuleName] = useState('');
  const [newModuleThumbnailUrl, setNewModuleThumbnailUrl] = useState('');
  const [isUploadingModuleThumbnail, setIsUploadingModuleThumbnail] = useState(false);
  const moduleInputRef = useRef<HTMLInputElement>(null);

  // Edit Module state (Admin only)
  const [editingModule, setEditingModule] = useState<ModuleItem | null>(null);
  const [editModuleName, setEditModuleName] = useState('');
  const [editModuleThumbnailUrl, setEditModuleThumbnailUrl] = useState('');
  const [isUploadingEditModuleThumbnail, setIsUploadingEditModuleThumbnail] = useState(false);

  const [isAddLessonModalOpen, setIsAddLessonModalOpen] = useState(false);
  const [newLessonTitle, setNewLessonTitle] = useState('');
  const [newLessonType, setNewLessonType] = useState('');
  const [newLessonDescription, setNewLessonDescription] = useState('');
  const [newLessonCommentsEnabled, setNewLessonCommentsEnabled] = useState(false);
  const [newAutoLikesMode, setNewAutoLikesMode] = useState<'default' | 'custom'>('default');
  const [newAutoLikesCount, setNewAutoLikesCount] = useState<number>(5);
  const [newAutoLikesInterval, setNewAutoLikesInterval] = useState<number>(1);
  const [newAutoLikesUnit, setNewAutoLikesUnit] = useState<AutoLikesRateUnit>('hour');
  
  const [newLessonDate, setNewLessonDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [newLessonTime, setNewLessonTime] = useState(() => getTimeInputFromTimestamp(Date.now()));
  
  // Staged attachments & upload state for adding lessons
  const [stagedImages, setStagedImages] = useState<AttachedImage[]>([]);
  const [isUploadingImages, setIsUploadingImages] = useState(false);
  const [isSubmittingLesson, setIsSubmittingLesson] = useState(false);
  const [stagedPdfs, setStagedPdfs] = useState<AttachedPdf[]>([]);
  const [isUploadingPdfs, setIsUploadingPdfs] = useState(false);
  const [customPdfCoverUrl, setCustomPdfCoverUrl] = useState('');
  const [lessonUploadError, setLessonUploadError] = useState<string | null>(null);
  const [moduleUploadError, setModuleUploadError] = useState<string | null>(null);
  const lessonTitleInputRef = useRef<HTMLInputElement>(null);
  const addLessonDescRef = useRef<HTMLTextAreaElement>(null);

  // Edit Lesson state (Admin only)
  const [editingLesson, setEditingLesson] = useState<LessonItem | null>(null);
  const [editLessonTitle, setEditLessonTitle] = useState('');
  const [editLessonType, setEditLessonType] = useState('Cour');
  const [editLessonDescription, setEditLessonDescription] = useState('');
  const [editLessonCommentsEnabled, setEditLessonCommentsEnabled] = useState(true);
  const [editAutoLikesMode, setEditAutoLikesMode] = useState<'default' | 'custom'>('default');
  const [editAutoLikesCount, setEditAutoLikesCount] = useState<number>(5);
  const [editAutoLikesInterval, setEditAutoLikesInterval] = useState<number>(1);
  const [editAutoLikesUnit, setEditAutoLikesUnit] = useState<AutoLikesRateUnit>('hour');
  const [editLessonDate, setEditLessonDate] = useState('');
  const [editLessonTime, setEditLessonTime] = useState('12:00');
  const [editStagedImages, setEditStagedImages] = useState<AttachedImage[]>([]);
  const [editStagedPdfs, setEditStagedPdfs] = useState<AttachedPdf[]>([]);
  const [isUploadingEditImages, setIsUploadingEditImages] = useState(false);
  const [isUploadingEditPdfs, setIsUploadingEditPdfs] = useState(false);
  const [isSavingEditLesson, setIsSavingEditLesson] = useState(false);
  const [editLessonUploadError, setEditLessonUploadError] = useState<string | null>(null);
  const editLessonTitleInputRef = useRef<HTMLInputElement>(null);
  const editLessonDescRef = useRef<HTMLTextAreaElement>(null);

  // Announcement Banner state & Admin editor
  const [bannerConfig, setBannerConfig] = useState<AnnouncementBannerConfig>({
    images: [],
    intervalSeconds: 4,
    enabled: true,
  });
  const [bannerSlideIndex, setBannerSlideIndex] = useState(0);
  const [isBannerAdminModalOpen, setIsBannerAdminModalOpen] = useState(false);
  const [draftBannerImages, setDraftBannerImages] = useState<AnnouncementBannerImage[]>([]);
  const [draftBannerInterval, setDraftBannerInterval] = useState<number>(4);
  const [draftBannerEnabled, setDraftBannerEnabled] = useState<boolean>(true);
  const [isUploadingBannerImage, setIsUploadingBannerImage] = useState(false);
  const [isSavingBanner, setIsSavingBanner] = useState(false);
  const [bannerError, setBannerError] = useState<string | null>(null);

  // Per-post & Multi-post Likes Rate & Count Modal (Admin only)
  const [likesControlLesson, setLikesControlLesson] = useState<LessonItem | null>(null);
  const [selectedLikesPostIds, setSelectedLikesPostIds] = useState<string[]>([]);
  const [ctrlLikesDelta, setCtrlLikesDelta] = useState<number>(0);
  const [ctrlLikesMode, setCtrlLikesMode] = useState<'default' | 'custom'>('default');
  const [ctrlLikesCount, setCtrlLikesCount] = useState<number>(5);
  const [ctrlLikesInterval, setCtrlLikesInterval] = useState<number>(1);
  const [ctrlLikesUnit, setCtrlLikesUnit] = useState<AutoLikesRateUnit>('hour');
  const [ctrlLikesEnabled, setCtrlLikesEnabled] = useState<boolean>(true);
  const [isSavingLikesRate, setIsSavingLikesRate] = useState(false);

  // Auto-rotate Announcement Banner images based on Admin-configured interval
  useEffect(() => {
    const count = bannerConfig.images.length;
    if (count === 0) {
      setBannerSlideIndex(0);
      return;
    }
    if (bannerSlideIndex >= count) {
      setBannerSlideIndex(0);
    }
    if (count <= 1 || !bannerConfig.enabled) return;

    const ms = Math.max(1, Number(bannerConfig.intervalSeconds) || 4) * 1000;
    const timer = setInterval(() => {
      setBannerSlideIndex(prev => (prev + 1) % count);
    }, ms);
    return () => clearInterval(timer);
  }, [bannerConfig.images.length, bannerConfig.intervalSeconds, bannerConfig.enabled, bannerSlideIndex]);

  // Periodic Automated Like Growth Sync (every 15 seconds)
  // Safely skipped while Admin is adding/editing/mutating lessons to guarantee zero race conditions!
  useEffect(() => {
    const syncAutomatedLikes = () => {
      if (isMutatingLessonsRef.current || isAddLessonModalOpen || Boolean(editingLesson)) {
        return;
      }
      const now = Date.now();

      // Check year1 modules
      const prevY1 = year1ModulesRef.current;
      let y1Changed = false;
      const nextY1 = prevY1.map(mod => {
        const { updatedLessons, hasChanges } = applyAutomatedLikesToLessons(mod.lessons || [], now);
        if (hasChanges) {
          y1Changed = true;
          updateModuleLessonsInFirestore('first', mod.id, updatedLessons).catch(() => {});
          updatedLessons.forEach((l, idx) => {
            if (l.likesCount !== (mod.lessons || [])[idx]?.likesCount) {
              syncLessonLikesToShard(l).catch(() => {});
            }
          });
          return { ...mod, lessons: updatedLessons };
        }
        return mod;
      });
      if (y1Changed) setYear1Modules(nextY1);

      // Check year2 modules
      const prevY2 = year2ModulesRef.current;
      let y2Changed = false;
      const nextY2 = prevY2.map(mod => {
        const { updatedLessons, hasChanges } = applyAutomatedLikesToLessons(mod.lessons || [], now);
        if (hasChanges) {
          y2Changed = true;
          updateModuleLessonsInFirestore('second', mod.id, updatedLessons).catch(() => {});
          updatedLessons.forEach((l, idx) => {
            if (l.likesCount !== (mod.lessons || [])[idx]?.likesCount) {
              syncLessonLikesToShard(l).catch(() => {});
            }
          });
          return { ...mod, lessons: updatedLessons };
        }
        return mod;
      });
      if (y2Changed) setYear2Modules(nextY2);

      // Check Admin News posts
      const prevNews = adminNewsPostsRef.current;
      const { updatedLessons: nextNews, hasChanges: newsChanged } = applyAutomatedLikesToLessons(prevNews || [], now);
      if (newsChanged) {
        setAdminNewsPosts(nextNews);
        updateAdminNewsPostsInFirestore(nextNews).catch(() => {});
        nextNews.forEach((l, idx) => {
          if (l.likesCount !== prevNews[idx]?.likesCount) {
            syncLessonLikesToShard(l).catch(() => {});
          }
        });
      }
    };

    const timeoutId = setTimeout(syncAutomatedLikes, 3000);
    const intervalId = setInterval(syncAutomatedLikes, 15000);

    return () => {
      clearTimeout(timeoutId);
      clearInterval(intervalId);
    };
  }, [isAddLessonModalOpen, editingLesson]);

  // Search in module lessons
  const [lessonSearchQuery, setLessonSearchQuery] = useState('');

  // Lightbox / Carousel viewer state
  const [lightboxImages, setLightboxImages] = useState<AttachedImage[] | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number>(0);

  // Instagram-style Slide-up / Pop-up Comments Modal
  const [commentsModalLesson, setCommentsModalLesson] = useState<LessonItem | null>(null);
  const [modalCommentInput, setModalCommentInput] = useState<string>('');
  const [commentPendingNotice, setCommentPendingNotice] = useState<string | null>(null);

  // Focus modal inputs
  useEffect(() => {
    if (isAddModuleModalOpen) {
      setTimeout(() => moduleInputRef.current?.focus(), 60);
    }
  }, [isAddModuleModalOpen]);

  useEffect(() => {
    if (isAddLessonModalOpen) {
      setTimeout(() => lessonTitleInputRef.current?.focus(), 60);
    }
  }, [isAddLessonModalOpen]);

  // Handle keyboard events (ESC, Arrow keys for Lightbox)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (lightboxImages) {
          setLightboxImages(null);
        } else if (commentsModalLesson) {
          setCommentsModalLesson(null);
        } else if (likesControlLesson) {
          setLikesControlLesson(null);
        } else if (isBannerAdminModalOpen) {
          setIsBannerAdminModalOpen(false);
        } else if (editingLesson) {
          setEditingLesson(null);
        } else if (editingModule) {
          setEditingModule(null);
        } else {
          setIsAddModuleModalOpen(false);
          setIsAddLessonModalOpen(false);
          setIsAdminLoginModalOpen(false);
          setIsAdminSetupModalOpen(false);
        }
      } else if (lightboxImages) {
        if (e.key === 'ArrowRight') {
          handleNextLightboxImage();
        } else if (e.key === 'ArrowLeft') {
          handlePrevLightboxImage();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxImages, lightboxIndex, commentsModalLesson, editingLesson, editingModule]);

  // Secret Admin Trigger Fix (7-Tap Gesture): COMPLETELY SILENT AND INVISIBLE
  const handleLogoTap = async () => {
    if (logoTapTimeoutRef.current) {
      clearTimeout(logoTapTimeoutRef.current);
    }

    const nextCount = logoTapCount + 1;

    if (nextCount >= 7) {
      setLogoTapCount(0);
      setAdminAuthError(null);
      setAdminUsernameInput('');
      setAdminPasswordInput('');

      if (isAdmin) {
        return;
      }

      const exists = await checkAdminAccountExists();
      if (!exists) {
        setIsAdminSetupModalOpen(true);
      } else {
        setIsAdminLoginModalOpen(true);
      }
    } else {
      setLogoTapCount(nextCount);
      logoTapTimeoutRef.current = setTimeout(() => {
        setLogoTapCount(0);
      }, 2500);
    }
  };

  // Submit Admin Account Creation
  const handleCreateAdminAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminUsernameInput.trim() || !adminPasswordInput.trim()) {
      setAdminAuthError('يرجى ملء اسم المستخدم وكلمة المرور');
      return;
    }

    setAdminAuthLoading(true);
    setAdminAuthError(null);

    try {
      await createSingleAdminAccount(adminUsernameInput, adminPasswordInput);
      setIsAdmin(true);
      setIsAdminSetupModalOpen(false);
    } catch (err: any) {
      setAdminAuthError(err.message || 'حدث خطأ أثناء إنشاء حساب المسؤول');
    } finally {
      setAdminAuthLoading(false);
    }
  };

  // Submit Admin Login
  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminUsernameInput.trim() || !adminPasswordInput.trim()) {
      setAdminAuthError('يرجى إدخال اسم المستخدم وكلمة المرور');
      return;
    }

    setAdminAuthLoading(true);
    setAdminAuthError(null);

    try {
      const isValid = await verifyAdminLogin(adminUsernameInput, adminPasswordInput);
      if (isValid) {
        setIsAdmin(true);
        setIsAdminLoginModalOpen(false);
      } else {
        setAdminAuthError('بيانات الدخول غير صحيحة. يرجى التحقق وإعادة المحاولة.');
      }
    } catch (err) {
      setAdminAuthError('فشل التحقق من حساب المسؤول');
    } finally {
      setAdminAuthLoading(false);
    }
  };

  const handleAdminLogout = () => {
    logoutAdmin();
    setIsAdmin(false);
  };

  const currentModules = (selectedYear === 'first' ? year1Modules : year2Modules)
    .filter(m => {
      const modSpec = m.specializationId || 'pep-arabe';
      if (modSpec !== selectedSpecializationId) return false;

      // Search Filter on main page
      if (moduleSearchQuery.trim()) {
        const q = moduleSearchQuery.toLowerCase().trim();
        const nameMatch = (m.name || '').toLowerCase().includes(q);
        const lessonMatch = (m.lessons || []).some(l => 
          (l.title || '').toLowerCase().includes(q) || 
          (l.description || '').toLowerCase().includes(q)
        );
        if (!nameMatch && !lessonMatch) return false;
      }

      return true;
    })
    .sort((a, b) => String(b.id).localeCompare(String(a.id)));
  const allModules = [...year1Modules, ...year2Modules];
  const activeModule = (!isNewsView && !isSubmissionsView)
    ? (allModules.find(m => String(m.id) === String(activeModuleId)) || null)
    : null;
  const isResolvingDeepModule = Boolean(!isNewsView && !isSubmissionsView && activeModuleId && !activeModule && (!isYear1Loaded || !isYear2Loaded));
  const activeSpecialization = specializations.find(s => s.id === selectedSpecializationId) || specializations[0] || { id: 'pep-arabe', name: 'PEP arabe' };
  const unreadSubmissionsCount = studentSubmissions.filter(s => !s.isRead).length;
  const isCurrentYearLoaded = selectedYear === 'first' ? isYear1Loaded : isYear2Loaded;

  // Clear invalid moduleId only after both Firestore years have finished loading
  useEffect(() => {
    if (activeModuleId && !activeModule && isYear1Loaded && isYear2Loaded) {
      setActiveModuleId(null);
    }
  }, [activeModuleId, activeModule, isYear1Loaded, isYear2Loaded]);

  // Lessons strictly associated with active module OR Admin News posts
  const activeModuleLessons: LessonItem[] = (() => {
    if (!activeModule) return [];
    const directLessons = Array.isArray(activeModule.lessons) ? activeModule.lessons : [];
    return directLessons.filter(l => !l.moduleId || String(l.moduleId) === String(activeModule.id));
  })();

  const activeFeedLessons: LessonItem[] = isNewsView ? adminNewsPosts : activeModuleLessons;

  // Real-time Dual-Server Likes Subscription (50% Server 1: clastyzoom-4badf / 50% Server 2: clasty-zoom)
  const activeLessonIdsKey = activeFeedLessons.map(l => `${l.id}:${l.likesServerShard || ''}`).join(',');
  const activeFeedContextKey = isNewsView ? ADMIN_NEWS_MODULE_ID : (activeModule?.id || '');
  useEffect(() => {
    if ((!activeModule && !isNewsView) || activeFeedLessons.length === 0) return;

    const unsub = subscribeLessonLikesFromShards(activeFeedLessons, (lessonId, shardState) => {
      const now = Date.now();
      const applyLessonPatch = (l: LessonItem): { item: LessonItem; changed: boolean } => {
        if (String(l.id) !== String(lessonId)) return { item: l, changed: false };
        const mergedLesson: LessonItem = {
          ...l,
          userLikes: typeof shardState.userLikes === 'number' ? shardState.userLikes : l.userLikes,
          manualLikesOffset: typeof shardState.manualLikesOffset === 'number' ? shardState.manualLikesOffset : l.manualLikesOffset,
          autoLikesEnabled: typeof shardState.autoLikesEnabled === 'boolean' ? shardState.autoLikesEnabled : l.autoLikesEnabled,
          frozenAutoLikes: typeof shardState.frozenAutoLikes === 'number' ? shardState.frozenAutoLikes : l.frozenAutoLikes,
          autoLikesResumedAt: typeof shardState.autoLikesResumedAt === 'number' ? shardState.autoLikesResumedAt : l.autoLikesResumedAt,
          autoLikesMode: shardState.autoLikesMode || l.autoLikesMode,
          autoLikesCustomCount: typeof shardState.autoLikesCustomCount === 'number' ? shardState.autoLikesCustomCount : l.autoLikesCustomCount,
          autoLikesCustomInterval: typeof shardState.autoLikesCustomInterval === 'number' ? shardState.autoLikesCustomInterval : l.autoLikesCustomInterval,
          autoLikesCustomUnit: shardState.autoLikesCustomUnit || l.autoLikesCustomUnit,
          autoLikesBaselineLikes: typeof shardState.autoLikesBaselineLikes === 'number' ? shardState.autoLikesBaselineLikes : l.autoLikesBaselineLikes,
          autoLikesBaselineAt: typeof shardState.autoLikesBaselineAt === 'number' ? shardState.autoLikesBaselineAt : l.autoLikesBaselineAt,
          likesServerShard: shardState.serverShard || l.likesServerShard,
        };
        const recalculated = calculateAutomatedLikes(mergedLesson, now);
        const nextLikesCount = (mergedLesson.autoLikesEnabled === false || typeof mergedLesson.manualLikesOffset === 'number')
          ? recalculated
          : Math.max(shardState.likesCount ?? 0, recalculated);

        if (
          mergedLesson.userLikes !== l.userLikes ||
          mergedLesson.manualLikesOffset !== l.manualLikesOffset ||
          mergedLesson.autoLikesEnabled !== l.autoLikesEnabled ||
          mergedLesson.frozenAutoLikes !== l.frozenAutoLikes ||
          mergedLesson.autoLikesMode !== l.autoLikesMode ||
          mergedLesson.autoLikesCustomCount !== l.autoLikesCustomCount ||
          mergedLesson.autoLikesCustomInterval !== l.autoLikesCustomInterval ||
          mergedLesson.autoLikesCustomUnit !== l.autoLikesCustomUnit ||
          nextLikesCount !== l.likesCount
        ) {
          return { item: { ...mergedLesson, likesCount: nextLikesCount }, changed: true };
        }
        return { item: l, changed: false };
      };

      if (isNewsView) {
        setAdminNewsPosts(prev => {
          let anyChanged = false;
          const next = prev.map(l => {
            const res = applyLessonPatch(l);
            if (res.changed) anyChanged = true;
            return res.item;
          });
          return anyChanged ? next : prev;
        });
        return;
      }

      if (!activeModule) return;
      const applyShardPatch = (mods: ModuleItem[]) =>
        mods.map(mod => {
          if (String(mod.id) !== String(activeModule.id)) return mod;
          let changed = false;
          const nextLessons = (mod.lessons || []).map(l => {
            const res = applyLessonPatch(l);
            if (res.changed) changed = true;
            return res.item;
          });
          return changed ? { ...mod, lessons: nextLessons } : mod;
        });

      setYear1Modules(prev => applyShardPatch(prev));
      setYear2Modules(prev => applyShardPatch(prev));
    });

    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFeedContextKey, activeLessonIdsKey]);

  // Year Switch Handler
  const handleSelectYear = (year: 'first' | 'second') => {
    setSelectedYear(year);
    setActiveModuleId(null);
    setIsNewsView(false);
    setIsSubmissionsView(false);
    setLessonSearchQuery('');
  };

  // Specialization Handlers (Admin Only)
  const handleAddSpecialization = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!isAdmin) return;
    const trimmed = newSpecializationName.trim();
    if (!trimmed) return;

    const newSpec: SpecializationItem = {
      id: `spec-${Date.now()}`,
      name: trimmed,
      createdAt: new Date().toISOString(),
    };

    const updated = [...specializations, newSpec];
    setSpecializations(updated);
    setSelectedSpecializationId(newSpec.id);
    setActiveModuleId(null);
    setNewSpecializationName('');
    setIsAddSpecializationModalOpen(false);
    setAdminSuccessNotification(`تمت إضافة تخصص (${trimmed}) بنجاح`);
    setTimeout(() => setAdminSuccessNotification(null), 3000);

    try {
      await saveSpecializationsToFirestore(updated);
    } catch (err) {
      console.warn('Firebase save specializations error:', err);
    }
  };

  const handleDeleteSpecialization = async (specId: string, specName: string) => {
    if (!isAdmin || specId === 'pep-arabe') return;
    const updated = specializations.filter(s => s.id !== specId);
    setSpecializations(updated);
    if (selectedSpecializationId === specId) {
      setSelectedSpecializationId('pep-arabe');
      setActiveModuleId(null);
    }
    setAdminSuccessNotification(`تم حذف تخصص (${specName}) بنجاح`);
    setTimeout(() => setAdminSuccessNotification(null), 3000);

    try {
      await saveSpecializationsToFirestore(updated);
    } catch (err) {
      console.warn('Firebase delete specialization error:', err);
    }
  };

  // Upload thumbnail for module creation
  const handleModuleThumbnailFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    setIsUploadingModuleThumbnail(true);
    setModuleUploadError(null);
    try {
      const url = await uploadImageToImgBB(file);
      if (url) {
        setNewModuleThumbnailUrl(url);
      }
    } catch (err: any) {
      console.warn('Module thumbnail upload error:', err);
      setModuleUploadError(err?.message || 'تعذر رفع صورة الغلاف، يرجى المحاولة مرة أخرى');
    } finally {
      setIsUploadingModuleThumbnail(false);
      e.target.value = '';
    }
  };

  // Upload thumbnail for module editing
  const handleEditModuleThumbnailFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    setIsUploadingEditModuleThumbnail(true);
    setModuleUploadError(null);
    try {
      const url = await uploadImageToImgBB(file);
      if (url) {
        setEditModuleThumbnailUrl(url);
      }
    } catch (err: any) {
      console.warn('Edit module thumbnail upload error:', err);
      setModuleUploadError(err?.message || 'تعذر رفع صورة الغلاف، يرجى المحاولة مرة أخرى');
    } finally {
      setIsUploadingEditModuleThumbnail(false);
      e.target.value = '';
    }
  };

  // 5. Add Module with Optional Thumbnail (Admin only)
  const handleAddModule = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!isAdmin) return;
    const trimmed = newModuleName.trim();
    if (!trimmed) return;

    const newModule: ModuleItem = {
      id: `${Date.now()}`,
      name: trimmed,
      createdAt: new Date().toLocaleDateString('ar-DZ'),
      thumbnailUrl: newModuleThumbnailUrl.trim() || undefined,
      specializationId: selectedSpecializationId,
      lessons: [],
    };

    if (selectedYear === 'first') {
      setYear1Modules(prev => [newModule, ...prev]);
    } else {
      setYear2Modules(prev => [newModule, ...prev]);
    }

    setNewModuleName('');
    setNewModuleThumbnailUrl('');
    setIsAddModuleModalOpen(false);

    try {
      await addModuleToFirestore(selectedYear, newModule);
    } catch (err) {
      console.warn('Firebase add module error, kept in local cache:', err);
    }
  };

  // Open Edit Module Modal
  const handleOpenEditModule = (e: React.MouseEvent, mod: ModuleItem) => {
    e.stopPropagation();
    if (!isAdmin) return;
    setEditingModule(mod);
    setEditModuleName(mod.name);
    setEditModuleThumbnailUrl(mod.thumbnailUrl || '');
  };

  // Save Edited Module (Admin only)
  const handleSaveEditedModule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingModule || !isAdmin) return;
    const trimmed = editModuleName.trim();
    if (!trimmed) return;

    const updatedMod: ModuleItem = {
      ...editingModule,
      name: trimmed,
      thumbnailUrl: editModuleThumbnailUrl.trim() || undefined,
    };

    if (selectedYear === 'first') {
      setYear1Modules(prev => prev.map(m => m.id === updatedMod.id ? updatedMod : m));
    } else {
      setYear2Modules(prev => prev.map(m => m.id === updatedMod.id ? updatedMod : m));
    }

    setEditingModule(null);
    setAdminSuccessNotification('تم تعديل بيانات المقياس والغلاف بنجاح');
    setTimeout(() => setAdminSuccessNotification(null), 3000);

    try {
      await addModuleToFirestore(selectedYear, updatedMod);
    } catch (err) {
      console.warn('Firebase update module error:', err);
    }
  };

  // Delete Module (Admin only)
  const handleDeleteModule = async (e: React.MouseEvent, moduleId: string) => {
    e.stopPropagation();
    if (!isAdmin) return;

    const targetModules = selectedYear === 'first' ? year1Modules : year2Modules;
    const deletedMod = targetModules.find(m => String(m.id) === String(moduleId));
    const activeBelongsToDeletedModule = Boolean(
      activeStudentNotif &&
      (
        String(activeStudentNotif.moduleId || '') === String(moduleId) ||
        (deletedMod?.lessons || []).some(l => String(l.id) === String(activeStudentNotif.id))
      )
    );

    if (selectedYear === 'first') {
      setYear1Modules(prev => prev.filter(m => m.id !== moduleId));
    } else {
      setYear2Modules(prev => prev.filter(m => m.id !== moduleId));
    }
    if (activeModuleId === moduleId) {
      setActiveModuleId(null);
      setLessonSearchQuery('');
    }

    if (activeBelongsToDeletedModule) {
      setActiveStudentNotif(null);
      setIncomingStudentNotif(null);
      clearStudentNotificationFromFirestore().catch(() => {});
    }

    try {
      await deleteModuleFromFirestore(selectedYear, moduleId);
    } catch (err) {
      console.warn('Firebase delete module error:', err);
    }
  };

  // Helper to persist updated lessons/posts into Firestore and state (supports both Modules and Admin News)
  const syncModuleLessons = async (newLessons: LessonItem[], throwOnError = false) => {
    if (isNewsView) {
      const taggedPosts = newLessons.map(l => ({
        ...l,
        moduleId: ADMIN_NEWS_MODULE_ID,
      }));
      adminNewsPostsRef.current = taggedPosts;
      setAdminNewsPosts(taggedPosts);
      try {
        await updateAdminNewsPostsInFirestore(taggedPosts);
      } catch (err) {
        console.warn('Firebase admin news update notice:', err);
        if (throwOnError) throw err;
      }
      return;
    }

    if (!activeModuleId) return;

    const targetIdStr = String(activeModuleId);

    // 1. Tag all lessons strictly with current module ID
    const taggedLessons = newLessons.map(l => ({
      ...l,
      moduleId: targetIdStr,
    }));

    const updateModuleList = (modules: ModuleItem[]) =>
      modules.map(mod => {
        if (String(mod.id) === targetIdStr) {
          return {
            ...mod,
            lessons: taggedLessons,
          };
        }
        return mod;
      });

    // 2. Immediately update React state and refs for responsive feedback
    year1ModulesRef.current = updateModuleList(year1ModulesRef.current);
    year2ModulesRef.current = updateModuleList(year2ModulesRef.current);
    setYear1Modules(prev => updateModuleList(prev));
    setYear2Modules(prev => updateModuleList(prev));

    // 3. Accurately identify which year collection the module belongs to
    const targetYear = year1ModulesRef.current.some(m => String(m.id) === targetIdStr) ? 'first' : 'second';

    // 4. Sync directly to Firebase Firestore
    try {
      await updateModuleLessonsInFirestore(targetYear, targetIdStr, taggedLessons);
    } catch (err) {
      console.warn('Firebase lessons update notice:', err);
      if (throwOnError) throw err;
    }
  };

  // Cloud Upload Handler for Multiple Images (Add Modal)
  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setIsUploadingImages(true);
    setLessonUploadError(null);

    try {
      for (const file of files) {
        try {
          const imgUrl = await uploadImageToImgBB(file);
          if (imgUrl) {
            setStagedImages(prev => [
              ...prev,
              {
                id: `${Date.now()}-${Math.random()}`,
                url: imgUrl,
                name: file.name || 'image.jpg',
              },
            ]);
          }
        } catch (err: any) {
          console.warn('Image upload error:', err);
          setLessonUploadError(err?.message || `فشل رفع الصورة (${file.name})، يرجى المحاولة مجدداً`);
        }
      }
    } finally {
      setIsUploadingImages(false);
      e.target.value = '';
    }
  };

  // Staged PDF File Input Handler (Add Modal) - Cloud Upload
  const handlePdfFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setIsUploadingPdfs(true);
    setLessonUploadError(null);

    try {
      for (const file of files) {
        const sizeStr = file.size > 1024 * 1024 
          ? `${(file.size / (1024 * 1024)).toFixed(1)} MB` 
          : `${Math.round(file.size / 1024)} KB`;

        try {
          const uploadResult = await uploadPdfToCatbox(file);
          setStagedPdfs(prev => [
            ...prev,
            {
              id: `${Date.now()}-${Math.random()}`,
              name: file.name || 'document.pdf',
              size: sizeStr,
              url: uploadResult.downloadUrl,
              downloadUrl: uploadResult.downloadUrl,
              viewUrl: uploadResult.viewUrl,
              coverImageUrl: customPdfCoverUrl.trim() || undefined,
            },
          ]);
        } catch (err: any) {
          console.warn('PDF upload error:', err);
          setLessonUploadError(err?.message || `فشل رفع ملف PDF (${file.name})، يرجى المحاولة مجدداً`);
        }
      }
      setCustomPdfCoverUrl('');
    } finally {
      setIsUploadingPdfs(false);
      e.target.value = '';
    }
  };

  // Open Add Post Modal (Module Lesson OR Admin News Post)
  const openAddPostModal = () => {
    setNewLessonTitle('');
    setNewLessonDescription('');
    setNewLessonType('');
    setNewLessonCommentsEnabled(false);
    setNewAutoLikesMode('default');
    setNewAutoLikesCount(5);
    setNewAutoLikesInterval(1);
    setNewAutoLikesUnit('hour');
    setNewLessonDate(new Date().toISOString().split('T')[0]);
    setNewLessonTime(getTimeInputFromTimestamp(Date.now()));
    setStagedImages([]);
    setStagedPdfs([]);
    setCustomPdfCoverUrl('');
    setLessonUploadError(null);
    setNotifyStudentsOnPublish(false);
    setIsAddLessonModalOpen(true);
  };

  const handleDismissStudentNotif = (notifId?: string) => {
    if (notifId) {
      try {
        sessionStorage.setItem('ens_dismissed_notif_id', notifId);
      } catch {}
    }
    setIncomingStudentNotif(null);
  };

  const handleOpenNotifiedPost = (notif: StudentNotificationPayload) => {
    if (notif.targetType === 'news') {
      setIsNewsView(true);
      setActiveModuleId(null);
      setLessonSearchQuery('');
      setNewsTypeFilter('all');
    } else if (notif.moduleId) {
      setIsNewsView(false);
      if (notif.yearId === 'first' || notif.yearId === 'second') {
        setSelectedYear(notif.yearId);
      }
      setActiveModuleId(notif.moduleId);
      setLessonSearchQuery('');
      setLessonTypeFilter('all');
    }
    handleDismissStudentNotif(notif.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleRequestBrowserNotifications = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    try {
      const result = await Notification.requestPermission();
      setNotifPermission(result);
    } catch {}
  };

  const handleClearActivePostNotification = async () => {
    if (!isAdmin) return;
    try {
      await clearStudentNotificationFromFirestore();
      setActiveStudentNotif(null);
      setIncomingStudentNotif(null);
      setAdminSuccessNotification('تم نزع إشعار المنشور للطلبة بنجاح');
      setTimeout(() => setAdminSuccessNotification(null), 3000);
    } catch {
      setAdminSuccessNotification('تعذر نزع الإشعار حالياً، يرجى إعادة المحاولة');
      setTimeout(() => setAdminSuccessNotification(null), 3000);
    }
  };

  const handleActivatePostNotification = async (lesson: LessonItem) => {
    if (!isAdmin) return;
    try {
      await publishStudentNotificationToFirestore({
        id: String(lesson.id),
        title: lesson.title,
        body:
          lesson.description?.trim() ||
          (isNewsView
            ? 'نُشر خبر جديد في قسم أخبار الإدارة'
            : `تم نشر ${lesson.type || 'درس'} في مقياس ${activeModule?.name || ''}`),
        postType: lesson.type || '',
        targetType: isNewsView ? 'news' : 'module',
        moduleId: isNewsView ? undefined : (activeModule?.id ? String(activeModule.id) : lesson.moduleId),
        moduleName: activeModule?.name,
        yearId: selectedYear,
        createdAt: Date.now(),
      });
      setAdminSuccessNotification('تم تفعيل وإرسال إشعار هذا المنشور للطلبة بنجاح');
      setTimeout(() => setAdminSuccessNotification(null), 3000);
    } catch {
      setAdminSuccessNotification('تعذر تفعيل الإشعار حالياً، يرجى إعادة المحاولة');
      setTimeout(() => setAdminSuccessNotification(null), 3000);
    }
  };

  // Add Lesson or Admin News Post (Admin only)
  const handleAddLesson = async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!isAdmin || (!activeModuleId && !isNewsView) || isSubmittingLesson) return;

    const rawTitle = lessonTitleInputRef.current?.value ?? newLessonTitle;
    const trimmedTitle = rawTitle.trim();
    if (!trimmedTitle) return;

    const trimmedType = newLessonType.trim();
    if (!trimmedType) {
      setLessonUploadError(
        isNewsView
          ? 'يرجى اختيار تصنيف المنشور أولاً'
          : 'يرجى اختيار فئة المنشور أولاً (مثل Cour أو TD أو تمارين)'
      );
      return;
    }

    const rawDescription = addLessonDescRef.current?.value ?? newLessonDescription;
    const trimmedDescription = rawDescription.trim();

    setIsSubmittingLesson(true);
    isMutatingLessonsRef.current = true;

    try {
      const targetIdStr = isNewsView ? ADMIN_NEWS_MODULE_ID : String(activeModuleId);
      const targetModule = !isNewsView
        ? (
            year1ModulesRef.current.find(m => String(m.id) === targetIdStr) ||
            year2ModulesRef.current.find(m => String(m.id) === targetIdStr) ||
            activeModule
          )
        : null;

      const existingLessons = isNewsView
        ? adminNewsPostsRef.current
        : ((targetModule && Array.isArray(targetModule.lessons))
            ? targetModule.lessons
            : activeModuleLessons);

      // Exact publication timestamp (date + time)
      const todayStr = new Date().toISOString().split('T')[0];
      const nowMs = Date.now();
      const currentTimeStr = getTimeInputFromTimestamp(nowMs);
      let chosenTimestamp = nowMs;
      let chosenDateText = new Date(nowMs).toLocaleDateString('ar-DZ');

      if (newLessonDate && (newLessonDate !== todayStr || (newLessonTime && newLessonTime !== currentTimeStr))) {
        const timePart = newLessonTime && /^\d{2}:\d{2}$/.test(newLessonTime) ? newLessonTime : currentTimeStr;
        const parsed = new Date(`${newLessonDate}T${timePart}:00`);
        if (!isNaN(parsed.getTime())) {
          chosenTimestamp = parsed.getTime();
          chosenDateText = parsed.toLocaleDateString('ar-DZ');
        }
      }

      const tempLessonId = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const assignedShard = assignBalancedLikesShard(existingLessons.length);

      const newLesson: LessonItem = {
        id: tempLessonId,
        moduleId: targetIdStr,
        title: trimmedTitle,
        type: trimmedType,
        description: trimmedDescription,
        images: Array.isArray(stagedImages) ? [...stagedImages] : [],
        pdfs: Array.isArray(stagedPdfs) ? [...stagedPdfs] : [],
        likesCount: 0,
        userLikes: 0,
        autoLikesEnabled: true,
        frozenAutoLikes: 0,
        autoLikesMode: newAutoLikesMode,
        autoLikesCustomCount: Math.max(0, Number(newAutoLikesCount) || 0),
        autoLikesCustomInterval: Math.max(1, Number(newAutoLikesInterval) || 1),
        autoLikesCustomUnit: newAutoLikesUnit,
        autoLikesBaselineLikes: 0,
        autoLikesBaselineAt: chosenTimestamp,
        likesServerShard: assignedShard,
        isLiked: false,
        isPinned: false,
        commentsEnabled: newLessonCommentsEnabled,
        timestamp: chosenTimestamp,
        comments: [],
        createdAt: chosenDateText,
      };

      const updatedLessons = [newLesson, ...existingLessons];

      await syncModuleLessons(updatedLessons, true);
      syncLessonLikesToShard(newLesson).catch(() => {});

      const shouldNotifyStudents = notifyStudentsOnPublish;
      if (shouldNotifyStudents) {
        publishStudentNotificationToFirestore({
          id: tempLessonId,
          title: trimmedTitle,
          body:
            trimmedDescription ||
            (isNewsView
              ? 'نُشر خبر جديد في قسم أخبار الإدارة'
              : `تم نشر ${newLesson.type} جديد في مقياس ${activeModule?.name || ''}`),
          postType: newLesson.type,
          targetType: isNewsView ? 'news' : 'module',
          moduleId: isNewsView ? undefined : targetIdStr,
          moduleName: activeModule?.name,
          yearId: selectedYear,
          createdAt: Date.now(),
        }).catch(() => {});
      }

      // Clean up form state and close modal cleanly
      setNewLessonTitle('');
      setNewLessonDescription('');
      setNewLessonCommentsEnabled(false);
      setNewAutoLikesMode('default');
      setNewAutoLikesCount(5);
      setNewAutoLikesInterval(1);
      setNewAutoLikesUnit('hour');
      setNewLessonDate(new Date().toISOString().split('T')[0]);
      setNewLessonTime(getTimeInputFromTimestamp(Date.now()));
      setStagedImages([]);
      setStagedPdfs([]);
      setCustomPdfCoverUrl('');
      setLessonUploadError(null);
      setNotifyStudentsOnPublish(false);
      setIsAddLessonModalOpen(false);

      setAdminSuccessNotification(
        shouldNotifyStudents
          ? (isNewsView ? 'تم نشر الخبر وإرسال إشعار للطلبة بنجاح' : 'تم نشر الدرس وإرسال إشعار للطلبة بنجاح')
          : (isNewsView ? 'تم نشر الخبر في منشورات المدير بنجاح' : 'تم نشر الدرس بنجاح في المقياس')
      );
      setTimeout(() => setAdminSuccessNotification(null), 3500);
    } catch (err: any) {
      console.error('Error publishing lesson:', err);
      setLessonUploadError(err?.message || 'حدث خطأ أثناء حفظ ونشر المنشور، يرجى إعادة المحاولة');
    } finally {
      isMutatingLessonsRef.current = false;
      setIsSubmittingLesson(false);
    }
  };

  // Delete Lesson or News Post (Admin only)
  const handleDeleteLesson = async (lessonId: string) => {
    if (!isAdmin || (!activeModuleId && !isNewsView)) return;
    const targetIdStr = String(lessonId);
    const updatedLessons = activeFeedLessons.filter(l => String(l.id) !== targetIdStr);
    if (String(activeStudentNotif?.id || '') === targetIdStr) {
      setActiveStudentNotif(null);
      setIncomingStudentNotif(null);
      await clearStudentNotificationFromFirestore().catch(() => {});
    }
    await syncModuleLessons(updatedLessons);
    if (commentsModalLesson && String(commentsModalLesson.id) === targetIdStr) {
      setCommentsModalLesson(null);
    }
  };

  // Pin / Unpin Post (Admin only)
  const handleTogglePinLesson = async (lessonId: string) => {
    if (!isAdmin || (!activeModuleId && !isNewsView)) return;
    const targetIdStr = String(lessonId);
    const updatedLessons = activeFeedLessons.map(l => {
      if (String(l.id) === targetIdStr) {
        return {
          ...l,
          isPinned: !l.isPinned,
        };
      }
      return l;
    });
    await syncModuleLessons(updatedLessons);
  };

  // Toggle Comments ON/OFF Per Post (Admin only) without harming comment icon aesthetics
  const handleToggleLessonComments = async (lessonId: string) => {
    if (!isAdmin || (!activeModuleId && !isNewsView)) return;
    const targetIdStr = String(lessonId);
    let nextEnabled = true;

    const updatedLessons = activeFeedLessons.map(l => {
      if (String(l.id) === targetIdStr) {
        nextEnabled = l.commentsEnabled === false;
        return {
          ...l,
          commentsEnabled: nextEnabled,
        };
      }
      return l;
    });

    await syncModuleLessons(updatedLessons);
    if (commentsModalLesson && String(commentsModalLesson.id) === targetIdStr) {
      const updated = updatedLessons.find(l => String(l.id) === targetIdStr);
      if (updated) setCommentsModalLesson(updated);
    }

    setAdminSuccessNotification(
      nextEnabled ? 'تم تشغيل التعليقات على هذا المنشور' : 'تم إيقاف التعليقات على هذا المنشور'
    );
    setTimeout(() => setAdminSuccessNotification(null), 3000);
  };

  // Admin Increment / Decrement Post Likes (+ / -)
  const handleAdminAdjustLikes = async (lessonId: string, delta: number) => {
    if (!isAdmin || (!activeModuleId && !isNewsView)) return;
    const targetIdStr = String(lessonId);
    const now = Date.now();
    let updatedLessonRef: LessonItem | null = null;

    const currentFeed = isNewsView
      ? adminNewsPostsRef.current
      : (
          year1ModulesRef.current.find(m => String(m.id) === String(activeModuleId))?.lessons ||
          year2ModulesRef.current.find(m => String(m.id) === String(activeModuleId))?.lessons ||
          activeFeedLessons
        );

    const updatedLessons = currentFeed.map(l => {
      if (String(l.id) === targetIdStr) {
        const currentDisplayed = typeof l.likesCount === 'number' ? l.likesCount : 0;
        const targetLikes = Math.max(0, currentDisplayed + delta);
        const currentAuto = getSimulatedAutoLikesOnly(l, now);
        const currentReal = typeof l.userLikes === 'number' ? Math.max(0, l.userLikes) : (l.isLiked ? 1 : 0);
        const nextManualOffset = targetLikes - (currentAuto + currentReal);

        updatedLessonRef = {
          ...l,
          manualLikesOffset: nextManualOffset,
          likesCount: targetLikes,
        };
        return updatedLessonRef;
      }
      return l;
    });

    await syncModuleLessons(updatedLessons);
    if (updatedLessonRef) {
      syncLessonLikesToShard(updatedLessonRef).catch(() => {});
    }
  };

  // OPEN EDIT LESSON MODAL (Admin only)
  const handleOpenEditLesson = (lesson: LessonItem) => {
    if (!isAdmin) return;
    setEditingLesson(lesson);
    setEditLessonTitle(lesson.title || '');
    setEditLessonType(
      isNewsView
        ? (lesson.type || 'خبر هام')
        : (['Cour', 'TD', 'تمارين'].includes(lesson.type) ? lesson.type : 'Cour')
    );
    setEditLessonDescription(lesson.description || '');
    setEditLessonCommentsEnabled(lesson.commentsEnabled !== false);
    setEditAutoLikesMode(lesson.autoLikesMode === 'custom' ? 'custom' : 'default');
    setEditAutoLikesCount(typeof lesson.autoLikesCustomCount === 'number' ? lesson.autoLikesCustomCount : 5);
    setEditAutoLikesInterval(typeof lesson.autoLikesCustomInterval === 'number' ? Math.max(1, lesson.autoLikesCustomInterval) : 1);
    setEditAutoLikesUnit(lesson.autoLikesCustomUnit || 'hour');
    setEditStagedImages([...(lesson.images || [])]);
    setEditStagedPdfs([...(lesson.pdfs || [])]);
    setEditLessonUploadError(null);

    // Pre-fill date & time pickers with post publication date/time
    if (lesson.timestamp && !isNaN(lesson.timestamp)) {
      try {
        setEditLessonDate(new Date(lesson.timestamp).toISOString().split('T')[0]);
        setEditLessonTime(getTimeInputFromTimestamp(lesson.timestamp));
      } catch {
        setEditLessonDate(new Date().toISOString().split('T')[0]);
        setEditLessonTime(getTimeInputFromTimestamp(Date.now()));
      }
    } else {
      setEditLessonDate(new Date().toISOString().split('T')[0]);
      setEditLessonTime(getTimeInputFromTimestamp(Date.now()));
    }
  };

  // Upload Images inside Edit Modal
  const handleEditImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setIsUploadingEditImages(true);
    setEditLessonUploadError(null);

    for (const file of files) {
      try {
        const imgUrl = await uploadImageToImgBB(file);
        if (imgUrl) {
          setEditStagedImages(prev => [
            ...prev,
            {
              id: `${Date.now()}-${Math.random()}`,
              url: imgUrl,
              name: file.name,
            },
          ]);
        }
      } catch (err: any) {
        console.warn('Edit image upload error:', err);
        setEditLessonUploadError(err?.message || `فشل رفع الصورة (${file.name})`);
      }
    }

    setIsUploadingEditImages(false);
    e.target.value = '';
  };

  // Staged PDF File Input Handler (Edit Modal) - Cloud Upload
  const handleEditPdfFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setIsUploadingEditPdfs(true);
    setEditLessonUploadError(null);

    try {
      for (const file of files) {
        const sizeStr = file.size > 1024 * 1024 
          ? `${(file.size / (1024 * 1024)).toFixed(1)} MB` 
          : `${Math.round(file.size / 1024)} KB`;

        try {
          const uploadResult = await uploadPdfToCatbox(file);
          setEditStagedPdfs(prev => [
            ...prev,
            {
              id: `${Date.now()}-${Math.random()}`,
              name: file.name,
              size: sizeStr,
              url: uploadResult.downloadUrl,
              downloadUrl: uploadResult.downloadUrl,
              viewUrl: uploadResult.viewUrl,
            },
          ]);
        } catch (err: any) {
          console.warn('Edit PDF upload error:', err);
          setEditLessonUploadError(err?.message || `فشل رفع ملف PDF (${file.name})`);
        }
      }
    } finally {
      setIsUploadingEditPdfs(false);
      e.target.value = '';
    }
  };

  // SAVE EDITED LESSON / NEWS POST (Admin only)
  const handleSaveEditedLesson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLesson || (!activeModuleId && !isNewsView) || isSavingEditLesson) return;

    const rawTitle = editLessonTitleInputRef.current?.value ?? editLessonTitle;
    const trimmedTitle = rawTitle.trim();
    if (!trimmedTitle) return;

    const rawDescription = editLessonDescRef.current?.value ?? editLessonDescription;
    const trimmedDescription = rawDescription.trim();

    setIsSavingEditLesson(true);
    isMutatingLessonsRef.current = true;

    const originalDateStr =
      editingLesson.timestamp && !isNaN(editingLesson.timestamp)
        ? new Date(editingLesson.timestamp).toISOString().split('T')[0]
        : '';
    const originalTimeStr = getTimeInputFromTimestamp(editingLesson.timestamp);
    let chosenTimestamp = editingLesson.timestamp || Date.now();
    let chosenDateText = editingLesson.createdAt;
    if (editLessonDate && (editLessonDate !== originalDateStr || (editLessonTime && editLessonTime !== originalTimeStr))) {
      const timePart = editLessonTime && /^\d{2}:\d{2}$/.test(editLessonTime) ? editLessonTime : originalTimeStr;
      const parsed = new Date(`${editLessonDate}T${timePart}:00`);
      if (!isNaN(parsed.getTime())) {
        chosenTimestamp = parsed.getTime();
        chosenDateText = parsed.toLocaleDateString('ar-DZ');
      }
    }

    const editIdStr = String(editingLesson.id);
    const latestFeed = isNewsView
      ? adminNewsPostsRef.current
      : (
          year1ModulesRef.current.find(m => String(m.id) === String(activeModuleId))?.lessons ||
          year2ModulesRef.current.find(m => String(m.id) === String(activeModuleId))?.lessons ||
          activeFeedLessons
        );

    const nowMs = Date.now();
    const updatedLessons = latestFeed.map(l => {
      if (String(l.id) === editIdStr) {
        const currentAuto = getSimulatedAutoLikesOnly(l, nowMs);
        const rateChanged =
          editAutoLikesMode !== (l.autoLikesMode || 'default') ||
          editAutoLikesCount !== (l.autoLikesCustomCount ?? 5) ||
          editAutoLikesInterval !== (l.autoLikesCustomInterval ?? 1) ||
          editAutoLikesUnit !== (l.autoLikesCustomUnit || 'hour');

        return {
          ...l,
          title: trimmedTitle,
          type: editLessonType,
          description: trimmedDescription,
          commentsEnabled: editLessonCommentsEnabled,
          images: editStagedImages,
          pdfs: editStagedPdfs,
          createdAt: chosenDateText,
          timestamp: chosenTimestamp,
          autoLikesMode: editAutoLikesMode,
          autoLikesCustomCount: Math.max(0, Number(editAutoLikesCount) || 0),
          autoLikesCustomInterval: Math.max(1, Number(editAutoLikesInterval) || 1),
          autoLikesCustomUnit: editAutoLikesUnit,
          autoLikesBaselineLikes: rateChanged ? currentAuto : l.autoLikesBaselineLikes,
          autoLikesBaselineAt: rateChanged ? nowMs : l.autoLikesBaselineAt,
          frozenAutoLikes: rateChanged && editAutoLikesMode === 'default' ? currentAuto : l.frozenAutoLikes,
          autoLikesResumedAt: rateChanged && editAutoLikesMode === 'default' ? nowMs : l.autoLikesResumedAt,
        };
      }
      return l;
    });

    try {
      await syncModuleLessons(updatedLessons, true);
      if (String(activeStudentNotif?.id || '') === editIdStr) {
        publishStudentNotificationToFirestore({
          id: editIdStr,
          title: trimmedTitle,
          body:
            trimmedDescription ||
            (isNewsView
              ? 'نُشر خبر جديد في قسم أخبار الإدارة'
              : `تم نشر ${editLessonType || 'درس'} في مقياس ${activeModule?.name || ''}`),
          postType: editLessonType,
          targetType: isNewsView ? 'news' : 'module',
          moduleId: isNewsView ? undefined : (activeModule?.id ? String(activeModule.id) : editingLesson.moduleId),
          moduleName: activeModule?.name,
          yearId: selectedYear,
          createdAt: activeStudentNotif?.createdAt || Date.now(),
        }).catch(() => {});
      }
      if (commentsModalLesson && String(commentsModalLesson.id) === editIdStr) {
        const updated = updatedLessons.find(l => String(l.id) === editIdStr);
        if (updated) setCommentsModalLesson(updated);
      }
      setEditLessonUploadError(null);
      setEditLessonDescription('');
      setEditingLesson(null);
      setAdminSuccessNotification('تم تعديل وحفظ بيانات المنشور بنجاح');
      setTimeout(() => setAdminSuccessNotification(null), 3000);
    } catch (err: any) {
      setEditLessonUploadError(err?.message || 'حدث خطأ أثناء حفظ التعديلات، يرجى إعادة المحاولة');
    } finally {
      isMutatingLessonsRef.current = false;
      setIsSavingEditLesson(false);
    }
  };

  // Student Submission Upload & Submit Handlers
  const handleSubImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setIsUploadingSubImages(true);
    setSubFormError(null);
    try {
      for (const file of files) {
        try {
          const imgUrl = await uploadImageToImgBB(file);
          if (imgUrl) {
            setSubImages(prev => [
              ...prev,
              { id: `${Date.now()}-${Math.random()}`, url: imgUrl, name: file.name || 'image.jpg' },
            ]);
          }
        } catch (err: any) {
          setSubFormError(err?.message || `فشل رفع الصورة (${file.name})`);
        }
      }
    } finally {
      setIsUploadingSubImages(false);
      e.target.value = '';
    }
  };

  const handleSubPdfFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setIsUploadingSubPdfs(true);
    setSubFormError(null);
    try {
      for (const file of files) {
        const sizeStr = file.size > 1024 * 1024
          ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
          : `${Math.round(file.size / 1024)} KB`;
        try {
          const uploadResult = await uploadPdfToCatbox(file);
          setSubPdfs(prev => [
            ...prev,
            {
              id: `${Date.now()}-${Math.random()}`,
              name: file.name || 'document.pdf',
              size: sizeStr,
              url: uploadResult.downloadUrl,
              downloadUrl: uploadResult.downloadUrl,
              viewUrl: uploadResult.viewUrl,
            },
          ]);
        } catch (err: any) {
          setSubFormError(err?.message || `فشل رفع ملف PDF (${file.name})`);
        }
      }
    } finally {
      setIsUploadingSubPdfs(false);
      e.target.value = '';
    }
  };

  const handleSubmitStudentContent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingStudentContent) return;

    const trimmedTitle = subTitle.trim();
    if (!trimmedTitle) {
      setSubFormError('يرجى كتابة عنوان الدرس أو المحتوى أولاً');
      return;
    }

    const rawSubDesc = subDescRef.current?.value ?? subDescription;
    setIsSubmittingStudentContent(true);
    setSubFormError(null);
    setSubFormSuccess(null);

    try {
      const nowMs = Date.now();
      const submission: StudentSubmissionItem = {
        id: `sub_${nowMs}_${Math.random().toString(36).slice(2, 7)}`,
        senderName: subSenderName.trim() || `طالب #${getSessionAnonId()}`,
        yearLabel: subYearLabel.trim() || 'عام',
        moduleName: subModuleName.trim() || 'غير محدد',
        title: trimmedTitle,
        description: rawSubDesc.trim(),
        images: [...subImages],
        pdfs: [...subPdfs],
        isRead: false,
        createdAt: new Date(nowMs).toLocaleDateString('ar-DZ'),
        timestamp: nowMs,
      };

      await addStudentSubmissionToFirestore(submission);
      setSubTitle('');
      setSubDescription('');
      setSubModuleName('');
      setSubImages([]);
      setSubPdfs([]);
      setSubFormSuccess('تم إرسال المحتوى إلى المدير بنجاح! سيطّلع عليه فور دخوله.');
      setTimeout(() => setSubFormSuccess(null), 6000);
    } catch (err: any) {
      setSubFormError(err?.message || 'حدث خطأ أثناء إرسال المحتوى، يرجى المحاولة مرة أخرى');
    } finally {
      setIsSubmittingStudentContent(false);
    }
  };

  const handleToggleSubmissionRead = async (sub: StudentSubmissionItem) => {
    if (!isAdmin) return;
    try {
      await markStudentSubmissionReadInFirestore(sub.id, !sub.isRead);
    } catch {}
  };

  const handleDeleteSubmission = async (subId: string) => {
    if (!isAdmin) return;
    try {
      await deleteStudentSubmissionFromFirestore(subId);
      setAdminSuccessNotification('تم حذف الرسالة بنجاح');
      setTimeout(() => setAdminSuccessNotification(null), 2500);
    } catch {}
  };

  // Admin Control: Pause or Resume Automated Generated Likes (Real user likes always keep working)
  const handleToggleAutoLikes = async (lessonId: string) => {
    if (!isAdmin || (!activeModuleId && !isNewsView)) return;

    const targetIdStr = String(lessonId);
    const now = Date.now();
    let changedLesson: LessonItem | null = null;
    let nextEnabledState = true;

    const updatedLessons = activeFeedLessons.map(l => {
      if (String(l.id) === targetIdStr) {
        const currentlyEnabled = l.autoLikesEnabled !== false;
        const realUserLikes = typeof l.userLikes === 'number' ? Math.max(0, l.userLikes) : (l.isLiked ? 1 : 0);

        if (currentlyEnabled) {
          // Pause automated likes and freeze current simulated count
          const currentAuto = getSimulatedAutoLikesOnly(l, now);
          nextEnabledState = false;
          changedLesson = {
            ...l,
            autoLikesEnabled: false,
            frozenAutoLikes: currentAuto,
            autoLikesResumedAt: undefined,
            likesCount: currentAuto + realUserLikes,
          };
          return changedLesson;
        } else {
          // Resume automated likes starting from frozen snapshot forward
          const frozenSnap = typeof l.frozenAutoLikes === 'number' ? Math.max(0, l.frozenAutoLikes) : 0;
          nextEnabledState = true;
          changedLesson = {
            ...l,
            autoLikesEnabled: true,
            frozenAutoLikes: frozenSnap,
            autoLikesResumedAt: now,
            autoLikesBaselineLikes: l.autoLikesMode === 'custom' ? frozenSnap : l.autoLikesBaselineLikes,
            autoLikesBaselineAt: l.autoLikesMode === 'custom' ? now : l.autoLikesBaselineAt,
            likesCount: frozenSnap + realUserLikes + (typeof l.manualLikesOffset === 'number' ? l.manualLikesOffset : 0),
          };
          return changedLesson;
        }
      }
      return l;
    });

    await syncModuleLessons(updatedLessons);
    if (changedLesson) {
      syncLessonLikesToShard(changedLesson).catch(() => {});
    }

    setAdminSuccessNotification(
      nextEnabledState
        ? 'تم تفعيل الإعجابات المولدة آلياً لهذا المنشور'
        : 'تم إيقاف الإعجابات المولدة آلياً (الإعجابات الحقيقية تبقى مستمرة)'
    );
    setTimeout(() => setAdminSuccessNotification(null), 3500);
  };

  // Open & Save Single or Multi-Post Likes Rate & Amount Control Modal (Admin only)
  const handleOpenLikesControlModal = (lesson: LessonItem, initialIds?: string[]) => {
    if (!isAdmin) return;
    setLikesControlLesson(lesson);
    setSelectedLikesPostIds(
      initialIds && initialIds.length > 0 ? initialIds.map(String) : [String(lesson.id)]
    );
    setCtrlLikesDelta(0);
    setCtrlLikesEnabled(lesson.autoLikesEnabled !== false);
    setCtrlLikesMode(lesson.autoLikesMode === 'custom' ? 'custom' : 'default');
    setCtrlLikesCount(typeof lesson.autoLikesCustomCount === 'number' ? lesson.autoLikesCustomCount : 5);
    setCtrlLikesInterval(typeof lesson.autoLikesCustomInterval === 'number' ? Math.max(1, lesson.autoLikesCustomInterval) : 1);
    setCtrlLikesUnit(lesson.autoLikesCustomUnit || 'hour');
  };

  const handleSavePostLikesRate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !isAdmin ||
      !likesControlLesson ||
      selectedLikesPostIds.length === 0 ||
      (!activeModuleId && !isNewsView) ||
      isSavingLikesRate
    ) {
      return;
    }

    setIsSavingLikesRate(true);
    isMutatingLessonsRef.current = true;
    const now = Date.now();
    const targetIdSet = new Set(selectedLikesPostIds.map(String));
    const updatedLessonRefs: LessonItem[] = [];

    try {
      const currentFeed = isNewsView
        ? adminNewsPostsRef.current
        : (
            year1ModulesRef.current.find(m => String(m.id) === String(activeModuleId))?.lessons ||
            year2ModulesRef.current.find(m => String(m.id) === String(activeModuleId))?.lessons ||
            activeFeedLessons
          );

      const updatedLessons = currentFeed.map(l => {
        if (targetIdSet.has(String(l.id))) {
          const currentAuto = getSimulatedAutoLikesOnly(l, now);
          const realLikes = typeof l.userLikes === 'number' ? Math.max(0, l.userLikes) : (l.isLiked ? 1 : 0);
          const prevManual = typeof l.manualLikesOffset === 'number' ? l.manualLikesOffset : 0;
          const hasManualChange = ctrlLikesDelta !== 0 || typeof l.manualLikesOffset === 'number';
          const nextManual = Math.max(-(currentAuto + realLikes), prevManual + ctrlLikesDelta);
          const preservedTotal = Math.max(
            0,
            currentAuto + realLikes + (hasManualChange ? nextManual : 0)
          );

          const nextLesson: LessonItem = {
            ...l,
            ...(hasManualChange ? { manualLikesOffset: nextManual } : {}),
            autoLikesEnabled: ctrlLikesEnabled,
            autoLikesMode: ctrlLikesMode,
            autoLikesCustomCount: Math.max(0, Number(ctrlLikesCount) || 0),
            autoLikesCustomInterval: Math.max(1, Number(ctrlLikesInterval) || 1),
            autoLikesCustomUnit: ctrlLikesUnit,
            autoLikesBaselineLikes: currentAuto,
            autoLikesBaselineAt: now,
            frozenAutoLikes: currentAuto,
            autoLikesResumedAt: now,
            likesCount: preservedTotal,
          };
          updatedLessonRefs.push(nextLesson);
          return nextLesson;
        }
        return l;
      });

      await syncModuleLessons(updatedLessons, true);
      if (updatedLessonRefs.length > 0) {
        await Promise.all(
          updatedLessonRefs.map(updatedRef => syncLessonLikesToShard(updatedRef).catch(() => {}))
        );
      }

      setLikesControlLesson(null);
      setSelectedLikesPostIds([]);
      setCtrlLikesDelta(0);
      setAdminSuccessNotification(
        updatedLessonRefs.length > 1
          ? `تم تطبيق إعدادات التفاعلات على ${updatedLessonRefs.length} منشورات بنجاح`
          : 'تم حفظ إعدادات ومعدل الإعجابات بنجاح'
      );
      setTimeout(() => setAdminSuccessNotification(null), 3000);
    } finally {
      isMutatingLessonsRef.current = false;
      setIsSavingLikesRate(false);
    }
  };

  // Announcement Banner Admin Handlers
  const handleOpenBannerAdminModal = () => {
    if (!isAdmin) return;
    setDraftBannerImages([...(bannerConfig.images || [])]);
    setDraftBannerInterval(Math.max(1, Number(bannerConfig.intervalSeconds) || 4));
    setDraftBannerEnabled(bannerConfig.enabled !== false);
    setBannerError(null);
    setIsBannerAdminModalOpen(true);
  };

  const handleBannerImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    setIsUploadingBannerImage(true);
    setBannerError(null);
    try {
      for (const file of files) {
        try {
          const url = await uploadImageToImgBB(file);
          if (url) {
            setDraftBannerImages(prev => [
              ...prev,
              { id: `ad_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, url, name: file.name || 'إعلان' },
            ]);
          }
        } catch (err: any) {
          setBannerError(err?.message || `فشل رفع الصورة (${file.name})`);
        }
      }
    } finally {
      setIsUploadingBannerImage(false);
      e.target.value = '';
    }
  };

  const handleSaveBannerConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin || isSavingBanner) return;
    setIsSavingBanner(true);
    setBannerError(null);
    try {
      const nextConfig: AnnouncementBannerConfig = {
        images: draftBannerImages,
        intervalSeconds: Math.max(1, Math.min(120, Number(draftBannerInterval) || 4)),
        enabled: draftBannerEnabled,
      };
      await saveAnnouncementBannerToFirestore(nextConfig);
      setBannerConfig(nextConfig);
      setIsBannerAdminModalOpen(false);
      setAdminSuccessNotification('تم حفظ إعدادات شريط الإعلانات بنجاح');
      setTimeout(() => setAdminSuccessNotification(null), 3000);
    } catch (err: any) {
      setBannerError(err?.message || 'حدث خطأ أثناء حفظ شريط الإعلانات');
    } finally {
      setIsSavingBanner(false);
    }
  };

  // Toggle Real User Like on Lesson / News Post (Open to all users; works whether auto-likes are active or paused)
  const handleToggleLike = async (lessonId: string) => {
    if (!activeModuleId && !isNewsView) return;

    const targetIdStr = String(lessonId);
    const now = Date.now();
    let updatedLessonRef: LessonItem | null = null;
    let likeDelta: 1 | -1 = 1;
    let finalLikesCount = 0;
    let finalUserLikes = 0;

    const updatedLessons = activeFeedLessons.map(l => {
      if (String(l.id) === targetIdStr) {
        const nextLiked = !l.isLiked;
        likeDelta = nextLiked ? 1 : -1;
        const currentUserLikes = typeof l.userLikes === 'number' ? Math.max(0, l.userLikes) : (l.isLiked ? 1 : 0);
        const nextUserLikes = nextLiked ? currentUserLikes + 1 : Math.max(0, currentUserLikes - 1);
        finalUserLikes = nextUserLikes;

        const currentAutoLikes = getSimulatedAutoLikesOnly(l, now);
        const computedTotal = currentAutoLikes + nextUserLikes;
        const previousLikes = typeof l.likesCount === 'number' ? l.likesCount : 0;

        const newLikesCount = (l.autoLikesEnabled === false || typeof l.manualLikesOffset === 'number')
          ? Math.max(nextUserLikes, computedTotal)
          : (nextLiked ? Math.max(previousLikes + 1, computedTotal) : Math.max(0, previousLikes - 1));

        finalLikesCount = newLikesCount;
        updatedLessonRef = {
          ...l,
          isLiked: nextLiked,
          userLikes: nextUserLikes,
          likesCount: newLikesCount,
        };
        return updatedLessonRef;
      }
      return l;
    });

    await syncModuleLessons(updatedLessons);
    if (updatedLessonRef) {
      updateRealUserLikeOnShard(updatedLessonRef, likeDelta, finalLikesCount, finalUserLikes).catch(() => {});
    }

    // If modal is open for this lesson, sync it
    if (commentsModalLesson && String(commentsModalLesson.id) === targetIdStr) {
      const updated = updatedLessons.find(l => String(l.id) === targetIdStr);
      if (updated) setCommentsModalLesson(updated);
    }
  };

  // COMMENTS SYSTEM: Admin ("KAOUANE fares") vs Visitor ("مجهول الهوية #XXXX" + Moderation Queue)
  const handleAddComment = async (lessonId: string, textToAdd: string) => {
    const commentText = textToAdd.trim();
    if (!commentText || (!activeModuleId && !isNewsView)) return;

    const targetIdStr = String(lessonId);
    const targetLesson = activeFeedLessons.find(l => String(l.id) === targetIdStr);
    if (!isAdmin && targetLesson?.commentsEnabled === false) {
      return;
    }

    const newComment: CommentItem = {
      id: `${Date.now()}-${Math.random()}`,
      author: isAdmin ? 'KAOUANE fares' : `مجهول الهوية #${getSessionAnonId()}`,
      text: commentText,
      createdAt: 'الآن',
      isAdmin: isAdmin,
      isApproved: isAdmin, // Admin comments are immediately approved; visitor comments require moderation
      avatarUrl: isAdmin ? ADMIN_AVATAR_URL : undefined,
    };

    const updatedLessons = activeFeedLessons.map(l => {
      if (String(l.id) === targetIdStr) {
        return {
          ...l,
          comments: [...(l.comments || []), newComment],
        };
      }
      return l;
    });

    await syncModuleLessons(updatedLessons);

    // Sync active comments modal
    if (commentsModalLesson && String(commentsModalLesson.id) === targetIdStr) {
      const updated = updatedLessons.find(l => String(l.id) === targetIdStr);
      if (updated) setCommentsModalLesson(updated);
    }

    if (!isAdmin) {
      setCommentPendingNotice('تم نشر تعليقك بنجاح — في انتظار قبول المدير');
      setTimeout(() => setCommentPendingNotice(null), 6000);
    }
  };

  // Admin approves a pending comment
  const handleApproveComment = async (lessonId: string, commentId: string) => {
    if (!isAdmin || (!activeModuleId && !isNewsView)) return;

    const targetIdStr = String(lessonId);
    const targetCommIdStr = String(commentId);
    const updatedLessons = activeFeedLessons.map(l => {
      if (String(l.id) === targetIdStr) {
        return {
          ...l,
          comments: (l.comments || []).map(c => {
            if (String(c.id) === targetCommIdStr) {
              return { ...c, isApproved: true };
            }
            return c;
          }),
        };
      }
      return l;
    });

    await syncModuleLessons(updatedLessons);
    if (commentsModalLesson && String(commentsModalLesson.id) === targetIdStr) {
      const updated = updatedLessons.find(l => String(l.id) === targetIdStr);
      if (updated) setCommentsModalLesson(updated);
    }
  };

  // Admin deletes a comment
  const handleDeleteComment = async (lessonId: string, commentId: string) => {
    if (!isAdmin || (!activeModuleId && !isNewsView)) return;

    const targetIdStr = String(lessonId);
    const targetCommIdStr = String(commentId);
    const updatedLessons = activeFeedLessons.map(l => {
      if (String(l.id) === targetIdStr) {
        return {
          ...l,
          comments: (l.comments || []).filter(c => String(c.id) !== targetCommIdStr),
        };
      }
      return l;
    });

    await syncModuleLessons(updatedLessons);
    if (commentsModalLesson && String(commentsModalLesson.id) === targetIdStr) {
      const updated = updatedLessons.find(l => String(l.id) === targetIdStr);
      if (updated) setCommentsModalLesson(updated);
    }
  };

  // Download Trigger Utility (Supports regular browsers AND silent Telegram In-App Browser downloads)
  const triggerDownload = async (url?: string, filename = 'document.pdf', downloadKey?: string) => {
    const trackingKey = downloadKey || url || filename;
    setActiveDownloadKeys(prev => ({ ...prev, [trackingKey]: true }));

    if (!url || url === '#') {
      try {
        const blob = new Blob([`ENS Medea Document: ${filename}`], { type: 'application/pdf' });
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
      } finally {
        setActiveDownloadKeys(prev => {
          const next = { ...prev };
          delete next[trackingKey];
          return next;
        });
      }
      return;
    }

    try {
      // Telegram In-App WebView silently ignores <a href="blob:..." download> and blocked popups.
      // Handle downloads cleanly with zero banners or modals via Web Share API, Chrome intent handoff, or direct URI.
      if (isTelegramBrowser) {
        isDownloadingInTelegramRef.current = true;
        const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
        const isAndroid = /Android/i.test(ua);

        if (isFirestoreMediaUrl(url)) {
          const { blob, mimeType, name } = await resolveMediaBlob(url);
          const finalName = filename || name || 'document.pdf';
          const file = new File([blob], finalName, { type: mimeType || 'application/octet-stream' });
          const navAny = navigator as any;

          if (
            typeof navAny.canShare === 'function' &&
            navAny.canShare({ files: [file] }) &&
            typeof navAny.share === 'function'
          ) {
            try {
              await navAny.share({ files: [file], title: finalName });
              return;
            } catch (shareErr: any) {
              if (shareErr?.name === 'AbortError') return;
            }
          }

          if (isAndroid) {
            try {
              sessionStorage.setItem('ens_tg_gesture_redirected', '1');
            } catch {}
            const handoffUrl = new URL(window.location.href);
            handoffUrl.searchParams.set('autoDownload', url);
            handoffUrl.searchParams.set('autoName', finalName);
            window.location.href = getExternalBrowserHref(handoffUrl.toString());
            return;
          }

          const dataUrl = await resolveMediaDataUrl(url);
          const a = document.createElement('a');
          a.href = dataUrl;
          a.download = finalName;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          return;
        }

        // Direct HTTP/HTTPS URL inside Telegram WebView:
        try {
          const resp = await fetch(url, { mode: 'cors' });
          if (resp.ok) {
            const blob = await resp.blob();
            const file = new File([blob], filename, { type: blob.type || 'application/octet-stream' });
            const navAny = navigator as any;
            if (
              typeof navAny.canShare === 'function' &&
              navAny.canShare({ files: [file] }) &&
              typeof navAny.share === 'function'
            ) {
              try {
                await navAny.share({ files: [file], title: filename });
                return;
              } catch (shareErr: any) {
                if (shareErr?.name === 'AbortError') return;
              }
            }
          }
        } catch {
          // Proceed to external/direct download handoff
        }

        if (isAndroid) {
          try {
            sessionStorage.setItem('ens_tg_gesture_redirected', '1');
          } catch {}
          window.location.href = getExternalBrowserHref(url);
          return;
        }

        window.location.assign(url);
        return;
      }

      // Standard browsers: fetch HTTP files into a local Blob when CORS permits so `download={filename}` forces direct download
      if (url.startsWith('http://') || url.startsWith('https://')) {
        try {
          const resp = await fetch(url, { mode: 'cors' });
          if (resp.ok) {
            const blob = await resp.blob();
            const blobUrl = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = blobUrl;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
            return;
          }
        } catch {
          // Fallback to direct anchor if remote server restricts CORS
        }
      }

      const finalUrl = await resolveMediaUrl(url);
      const a = document.createElement('a');
      a.href = finalUrl;
      a.download = filename;
      if (finalUrl.startsWith('http://') || finalUrl.startsWith('https://')) {
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
      }
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      console.warn('Download error:', err);
      setAdminSuccessNotification('تعذر تحميل الملف حالياً، يرجى المحاولة مرة أخرى');
      setTimeout(() => setAdminSuccessNotification(null), 3000);
    } finally {
      isDownloadingInTelegramRef.current = false;
      setActiveDownloadKeys(prev => {
        const next = { ...prev };
        delete next[trackingKey];
        return next;
      });
    }
  };

  // Auto-execute pending file download after Telegram WebView hands off to external browser
  useEffect(() => {
    if (typeof window === 'undefined' || isTelegramBrowser) return;
    const params = new URLSearchParams(window.location.search);
    const autoDownloadUrl = params.get('autoDownload');
    if (!autoDownloadUrl) return;
    const autoName = params.get('autoName') || 'document.pdf';
    params.delete('autoDownload');
    params.delete('autoName');
    const qs = params.toString();
    const cleanUrl = `${window.location.pathname}${qs ? `?${qs}` : ''}${window.location.hash || ''}`;
    window.history.replaceState(null, '', cleanUrl);
    void triggerDownload(autoDownloadUrl, autoName);
  }, [isTelegramBrowser]);

  // Multi-Image Sequential Download
  const handleDownloadAllPostImages = async (images: AttachedImage[], postTitle: string, downloadKey?: string) => {
    if (!images || images.length === 0) return;

    const bulkKey = downloadKey || `bulk_images:${postTitle}`;
    setActiveDownloadKeys(prev => ({ ...prev, [bulkKey]: true }));

    setAdminSuccessNotification(`جاري تحميل كافة الصور (${images.length} صور)...`);
    setTimeout(() => setAdminSuccessNotification(null), 3000);

    try {
      for (let i = 0; i < images.length; i++) {
        const img = images[i];
        const safeTitle = (postTitle || 'image').slice(0, 20).replace(/\s+/g, '_');
        const filename = img.name || `${safeTitle}_${i + 1}.jpg`;
        await triggerDownload(img.url, filename, `${bulkKey}:item:${i}`);
        if (i < images.length - 1) {
          await new Promise(res => setTimeout(res, 350));
        }
      }
    } finally {
      setActiveDownloadKeys(prev => {
        const next = { ...prev };
        delete next[bulkKey];
        return next;
      });
    }
  };

  // Lightbox Handlers
  const handleOpenLightbox = (images: AttachedImage[], index: number) => {
    setLightboxImages(images);
    setLightboxIndex(index);
  };

  const handleNextLightboxImage = () => {
    if (!lightboxImages) return;
    setLightboxIndex(prev => (prev + 1) % lightboxImages.length);
  };

  const handlePrevLightboxImage = () => {
    if (!lightboxImages) return;
    setLightboxIndex(prev => (prev - 1 + lightboxImages.length) % lightboxImages.length);
  };

  // Sort lessons/news dynamically: Pinned posts always on top, followed by newest to oldest
  const sortedLessons = (activeModule || isNewsView)
    ? [...activeFeedLessons].sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        const timeA = a.timestamp || Number(a.id) || 0;
        const timeB = b.timestamp || Number(b.id) || 0;
        return timeB - timeA;
      })
    : [];

  // Filter lessons or news posts by type and search query
  const filteredLessons = sortedLessons.filter(lesson => {
    if (isNewsView) {
      if (newsTypeFilter === 'news') {
        const t = (lesson.type || '').toLowerCase();
        if (!t.includes('خبر') && !t.includes('أخبار')) return false;
      } else if (newsTypeFilter === 'updates') {
        const t = (lesson.type || '').toLowerCase();
        if (!t.includes('مستجد') && !t.includes('توجيه') && !t.includes('تحديث')) return false;
      } else if (newsTypeFilter === 'announcements') {
        const t = (lesson.type || '').toLowerCase();
        if (!t.includes('إعلان') && !t.includes('تذكير')) return false;
      }
    } else {
      // 1. Filter by Post/Lesson Type
      if (lessonTypeFilter === 'cour') {
        const t = (lesson.type || '').toLowerCase();
        if (!t.includes('محاضرة') && !t.includes('cour') && !t.includes('درس')) return false;
      } else if (lessonTypeFilter === 'td') {
        const t = (lesson.type || '').toLowerCase();
        if (!t.includes('td') && !t.includes('أعمال موجهة')) return false;
      } else if (lessonTypeFilter === 'exercises') {
        const t = (lesson.type || '').toLowerCase();
        if (!t.includes('تمرين') && !t.includes('تمارين') && !t.includes('tp') && !t.includes('أعمال تطبيقية') && !t.includes('exercic')) return false;
      }
    }

    // 2. Filter by Search Query
    const effectiveSearch = (lessonSearchQuery || moduleSearchQuery || '').toLowerCase().trim();
    if (!effectiveSearch) return true;
    const titleMatch = (lesson.title || '').toLowerCase().includes(effectiveSearch);
    const descMatch = (lesson.description || '').toLowerCase().includes(effectiveSearch);
    const typeMatch = (lesson.type || '').toLowerCase().includes(effectiveSearch);
    const imgMatch = (lesson.images || []).some(img => (img.name || '').toLowerCase().includes(effectiveSearch));
    const pdfMatch = (lesson.pdfs || []).some(pdf => (pdf.name || '').toLowerCase().includes(effectiveSearch));
    return titleMatch || descMatch || typeMatch || imgMatch || pdfMatch;
  });

  return (
    <div className="min-h-screen w-full overflow-x-clip bg-white text-black font-['Cairo',sans-serif] selection:bg-black selection:text-white">
      
      {/* 1. Top Header Bar: Solid white sticky bar with clear icons & logo */}
      <header className="sticky top-0 z-40 bg-white border-b border-neutral-200 h-[64px] sm:h-[74px] shadow-2xs w-full">
        <div
          className={`w-full max-w-7xl mx-auto flex items-center ${
            isAdmin && (activeModule || isNewsView) ? 'justify-end' : 'justify-between'
          } gap-1.5 sm:gap-3 h-[64px] sm:h-[74px] px-2.5 sm:px-6`}
        >
          
          {/* Far Left Side: App Logo / Name (Hidden for Admin inside Lessons & News pages) */}
          {!(isAdmin && (activeModule || isNewsView)) && (
            <div className="flex items-center h-full shrink-0" dir="ltr">
              {/* Logo Image (7-Tap Hidden Trigger: COMPLETELY SILENT AND INVISIBLE) */}
              <div 
                onClick={handleLogoTap}
                className="flex items-center justify-center cursor-pointer select-none group relative h-full py-0"
                title="ENS Medea"
              >
                <img 
                  src={logoAsset} 
                  alt="ENS Medea Logo" 
                  className={`h-[52px] sm:h-[62px] md:h-[66px] w-auto ${
                    isAdmin && isSubmissionsView
                      ? 'max-w-[100px] sm:max-w-none'
                      : 'max-w-[140px] sm:max-w-none'
                  } mr-0 ml-0 mt-0 -mb-[5px] pt-0 pb-0 pr-[-80px] pl-[-100px] object-contain transition-transform duration-200 active:scale-95 hover:opacity-95 rounded-sm`}
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = NEW_LOGO_URL;
                  }}
                />
              </div>
            </div>
          )}

          {/* Far Right Side: Send-to-Admin (Black Cube w/ White Icon), Home, Search, Back & Admin Actions */}
          <div className="flex items-center gap-1 sm:gap-2 min-w-0 justify-end" dir="rtl">
            {/* Send Lesson/Content to Admin Button: Same colors as Home & Search (black icon on white cube by default, inverting when active) */}
            <button
              type="button"
              onClick={() => {
                if (isSubmissionsView) {
                  setIsSubmissionsView(false);
                } else {
                  setIsSubmissionsView(true);
                  setIsNewsView(false);
                  setActiveModuleId(null);
                  setLessonSearchQuery('');
                }
              }}
              className={`relative w-10 h-10 sm:w-11 sm:h-11 rounded-xl transition-all duration-150 cursor-pointer flex items-center justify-center shrink-0 border focus:outline-none ${
                isSubmissionsView
                  ? 'bg-black text-white border-black shadow-xs'
                  : 'bg-white text-black hover:bg-neutral-100 border-neutral-200 shadow-2xs'
              }`}
              title={isAdmin ? 'رسائل ومحتويات الطلبة المرسلة' : 'إرسال درس أو محتوى للمدير'}
              aria-label={isAdmin ? 'رسائل الطلبة' : 'إرسال للمدير'}
            >
              <Send className="w-6 h-6 sm:w-7 sm:h-7 stroke-[2.2] -rotate-45" />
              {isAdmin && unreadSubmissionsCount > 0 && (
                <span className="absolute -top-1.5 -left-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] font-bold font-mono flex items-center justify-center border-2 border-white shadow-xs">
                  {unreadSubmissionsCount}
                </span>
              )}
            </button>

            {/* Home Icon Button: Toggles between Admin News Feed and Modules & Year List */}
            <button
              type="button"
              onClick={() => {
                setIsSubmissionsView(false);
                if (isNewsView) {
                  setIsNewsView(false);
                  setActiveModuleId(null);
                  setLessonSearchQuery('');
                  setNewsTypeFilter('all');
                } else {
                  setIsNewsView(true);
                  setActiveModuleId(null);
                  setLessonSearchQuery('');
                  setNewsTypeFilter('all');
                }
              }}
              className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl transition-all duration-150 cursor-pointer flex items-center justify-center shrink-0 border ${
                isNewsView
                  ? 'bg-black text-white border-black shadow-xs'
                  : 'text-neutral-700 hover:text-black hover:bg-neutral-100 border-neutral-200 shadow-2xs'
              }`}
              title={isNewsView ? "العودة لقائمة المقاييس والسنة" : "منشورات المدير (الأخبار وآخر المستجدات)"}
              aria-label={isNewsView ? "العودة لقائمة المقاييس والسنة" : "منشورات المدير"}
            >
              <Home className="w-6 h-6 sm:w-7 sm:h-7 stroke-[2.2]" />
            </button>

            {/* Search Magnifying Glass Icon Button */}
            <button
              type="button"
              onClick={() => setIsSearchVisible(prev => !prev)}
              className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl transition-all duration-150 cursor-pointer flex items-center justify-center shrink-0 border ${
                isSearchVisible 
                  ? 'bg-black text-white border-black shadow-xs' 
                  : 'text-neutral-700 hover:text-black hover:bg-neutral-100 border-neutral-200 shadow-2xs'
              }`}
              title={isSearchVisible ? "إخفاء شريط البحث" : "البحث (عدسة مكبرة)"}
              aria-label="البحث"
            >
              <Search className="w-6 h-6 sm:w-7 sm:h-7 stroke-[2.2]" />
            </button>

            {/* Admin Status & Logout */}
            {isAdmin && (
              <div className="flex items-center gap-1 sm:gap-2 pr-1 sm:pr-2 border-r border-neutral-200 shrink-0">
                <span className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-neutral-100 text-black text-xs font-semibold border border-neutral-300">
                  <ShieldCheck className="w-3.5 h-3.5 text-black" />
                  <span>وضع الإدارة نشط</span>
                </span>

                <button
                  type="button"
                  onClick={handleAdminLogout}
                  className="p-1.5 sm:p-2 text-neutral-500 hover:text-black rounded-xl hover:bg-neutral-100 transition-colors border border-transparent hover:border-neutral-200 cursor-pointer"
                  title="تسجيل خروج المشرف (قفل الإدارة)"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* ADMIN-ONLY BUTTONS */}
            {isAdmin && (
              <>
                {/* Create Module Button: ONLY `+` ICON WITHOUT ANY WORDS */}
                <button
                  type="button"
                  onClick={() => setIsAddModuleModalOpen(true)}
                  className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center bg-black hover:bg-neutral-800 text-white rounded-xl text-sm font-semibold transition-all duration-150 shadow-xs cursor-pointer shrink-0 active:scale-95"
                  title="إنشاء مقياس جديد (+)"
                  aria-label="إنشاء مقياس جديد"
                >
                  <Plus className="w-4 h-4 stroke-[2.5]" />
                </button>

                {(activeModule || isNewsView) && (
                  <button
                    type="button"
                    onClick={openAddPostModal}
                    className="flex items-center gap-1 px-2 sm:px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-[11px] sm:text-xs font-semibold transition-all duration-150 shadow-xs cursor-pointer animate-in fade-in shrink-0 whitespace-nowrap"
                    title={isNewsView ? 'نشر خبر جديد' : 'نشر درس جديد'}
                  >
                    <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>{isNewsView ? 'نشر خبر' : 'نشر درس'}</span>
                  </button>
                )}
              </>
            )}

            {/* Return / Back Button: Placed on the far right when in active module, News view, or Submissions view */}
            {(activeModule || isNewsView || isSubmissionsView) && (
              <button
                type="button"
                onClick={() => {
                  setActiveModuleId(null);
                  setIsNewsView(false);
                  setIsSubmissionsView(false);
                  setLessonSearchQuery('');
                  setLessonTypeFilter('all');
                  setNewsTypeFilter('all');
                }}
                className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl text-black hover:bg-neutral-100 transition-all duration-150 cursor-pointer group flex items-center justify-center shrink-0 border border-neutral-200 shadow-2xs"
                title="العودة لقائمة المقاييس"
                aria-label="العودة"
              >
                <svg 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="2.5" 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  className="w-6 h-6 sm:w-7 sm:h-7 group-hover:translate-x-0.5 transition-transform"
                >
                  <path d="M15 14l5-5-5-5" />
                  <path d="M20 9H9.5A5.5 5.5 0 0 0 4 14.5v0A5.5 5.5 0 0 0 9.5 20H13" />
                </svg>
              </button>
            )}

          </div>

        </div>
      </header>

      {/* Top Search Bar (Toggled when user clicks the search icon in header) */}
      {isSearchVisible && !isSubmissionsView && (
        <div className="w-full max-w-xl mx-auto px-4 mt-3 mb-1 animate-in fade-in slide-in-from-top-2 duration-200" dir="rtl">
          <div className="relative flex items-center">
            <input
              type="text"
              value={(activeModule || isNewsView) ? lessonSearchQuery : moduleSearchQuery}
              onChange={(e) => {
                const val = e.target.value;
                if (activeModule || isNewsView) {
                  setLessonSearchQuery(val);
                } else {
                  setModuleSearchQuery(val);
                }
              }}
              placeholder={
                isNewsView
                  ? "ابحث في أخبار ومستجدات المدير..."
                  : activeModule
                    ? "ابحث في دروس ومطبوعات هذا المقياس..."
                    : "ابحث عن مقياس أو درس..."
              }
              className="w-full bg-white text-black pr-10 pl-10 py-2.5 rounded-2xl border border-neutral-300 shadow-xs text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-black transition-all"
              autoFocus
            />
            <Search className="w-4 h-4 text-neutral-400 absolute right-3 pointer-events-none" />
            {((activeModule || isNewsView) ? lessonSearchQuery : moduleSearchQuery) && (
              <button
                type="button"
                onClick={() => {
                  if (activeModule || isNewsView) {
                    setLessonSearchQuery('');
                  } else {
                    setModuleSearchQuery('');
                  }
                }}
                className="absolute left-3 text-neutral-400 hover:text-black p-1 transition-colors cursor-pointer"
                title="مسح البحث"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Admin Notification Banner */}
      {adminSuccessNotification && (
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 mt-4">
          <div className="p-3.5 bg-black text-white border border-neutral-800 rounded-2xl flex items-center justify-between text-xs animate-in fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-white shrink-0" />
              <span>{adminSuccessNotification}</span>
            </div>
          </div>
        </div>
      )}

      {/* Admin Active Student Notification Control Bar (Allows removing/deactivating active post notification from anywhere) */}
      {isAdmin && activeStudentNotif && (
        <div className="w-full max-w-7xl mx-auto px-2 sm:px-4 md:px-6 mt-3" dir="rtl">
          <div className="p-3 sm:p-3.5 bg-neutral-100 border border-neutral-300 rounded-2xl flex flex-wrap items-center justify-between gap-2.5 text-xs shadow-2xs">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <div className="w-8 h-8 rounded-xl bg-black text-white flex items-center justify-center shrink-0">
                <BellRing className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-black truncate">
                  إشعار منشور مفعّل للطلبة: {activeStudentNotif.title}
                </p>
                <p className="text-[11px] text-neutral-600 truncate">
                  {activeStudentNotif.targetType === 'news'
                    ? 'قسم أخبار المدير'
                    : `مقياس: ${activeStudentNotif.moduleName || 'مقياس دراسي'}`}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleClearActivePostNotification}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-black hover:bg-neutral-800 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer shrink-0"
              title="نزع وإلغاء إشعار هذا المنشور عن الطلبة"
            >
              <BellOff className="w-3.5 h-3.5" />
              <span>نزع الإشعار</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Page Container */}
      <main className="w-full max-w-7xl mx-auto px-2 sm:px-4 md:px-6 py-6 sm:py-8" dir="rtl">
        
        {/* Loading state while restoring deep-linked module after browser refresh */}
        {isResolvingDeepModule && (
          <div className="w-full py-24 flex flex-col items-center justify-center gap-3 text-neutral-500">
            <Loader2 className="w-7 h-7 animate-spin text-black" />
            <span className="text-xs font-medium">جاري تحديث بيانات الصفحة...</span>
          </div>
        )}

        {/* VIEW 1: MODULES GRID (when no module is opened, not on News view, and not on Submissions view) */}
        {!activeModule && !isNewsView && !isSubmissionsView && !isResolvingDeepModule && (
          <div className="space-y-8 animate-in fade-in duration-150">
            
            {/* Year Selection Tabs (Responsive across all screen sizes) */}
            <div className="flex items-center justify-center px-1">
              <div className="w-full max-w-sm flex items-center gap-1.5 sm:gap-2 bg-neutral-100 p-1 sm:p-1.5 rounded-2xl border border-neutral-200 shadow-2xs">
                <button
                  type="button"
                  onClick={() => handleSelectYear('second')}
                  className={`flex-1 px-3 sm:px-8 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-150 cursor-pointer ${
                    selectedYear === 'second'
                      ? 'bg-black text-white shadow-xs'
                      : 'text-neutral-600 hover:text-black hover:bg-neutral-200/60'
                  }`}
                >
                  السنة الثانية
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectYear('first')}
                  className={`flex-1 px-3 sm:px-8 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-150 cursor-pointer ${
                    selectedYear === 'first'
                      ? 'bg-black text-white shadow-xs'
                      : 'text-neutral-600 hover:text-black hover:bg-neutral-200/60'
                  }`}
                >
                  السنة الأولى
                </button>
              </div>
            </div>

            {/* 2. AUTO-ROTATING ANNOUNCEMENT BANNER (Centered exactly between Year Buttons and Modules Grid) */}
            {bannerConfig.enabled && bannerConfig.images.length > 0 ? (
              <div className="w-full max-w-2xl mx-auto px-1">
                <div
                  className="relative w-full aspect-[16/7] sm:aspect-[16/6] rounded-2xl sm:rounded-3xl overflow-hidden border border-neutral-200 bg-neutral-100 shadow-2xs select-none no-save-media"
                  onContextMenu={(e) => e.preventDefault()}
                  onDragStart={(e) => e.preventDefault()}
                >
                  {bannerConfig.images.map((img, idx) => (
                    <CloudImage
                      key={img.id}
                      src={img.url}
                      alt={img.name || 'إعلان'}
                      draggable={false}
                      referrerPolicy="no-referrer"
                      onContextMenu={(e) => e.preventDefault()}
                      onDragStart={(e) => e.preventDefault()}
                      className={`absolute inset-0 w-full h-full object-cover pointer-events-none select-none no-save-media transition-opacity duration-500 ${
                        idx === bannerSlideIndex ? 'opacity-100' : 'opacity-0'
                      }`}
                    />
                  ))}

                  {/* Full-coverage transparent interaction shield preventing student long-press/save/context-menu */}
                  <div
                    className="absolute inset-0 z-10 no-save-media"
                    onContextMenu={(e) => e.preventDefault()}
                    onDragStart={(e) => e.preventDefault()}
                  />

                  {/* Subtle slide indicators */}
                  {bannerConfig.images.length > 1 && (
                    <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 z-15 flex items-center gap-1.5 pointer-events-none">
                      {bannerConfig.images.map((img, idx) => (
                        <span
                          key={img.id}
                          className={`h-1.5 rounded-full transition-all duration-300 ${
                            idx === bannerSlideIndex ? 'w-5 bg-white shadow-xs' : 'w-1.5 bg-white/55'
                          }`}
                        />
                      ))}
                    </div>
                  )}

                  {/* Admin-only quick configure trigger */}
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={handleOpenBannerAdminModal}
                      className="absolute top-2.5 left-2.5 z-20 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-black/80 hover:bg-black text-white text-[11px] font-semibold backdrop-blur-xs border border-white/20 transition-colors cursor-pointer"
                      title="إدارة صور ومدة شريط الإعلانات"
                    >
                      <Megaphone className="w-3.5 h-3.5" />
                      <span>إدارة الإعلانات ({bannerConfig.intervalSeconds}ث)</span>
                    </button>
                  )}
                </div>
              </div>
            ) : isAdmin ? (
              <div className="w-full max-w-2xl mx-auto px-1">
                <button
                  type="button"
                  onClick={handleOpenBannerAdminModal}
                  className="w-full py-5 px-4 rounded-2xl sm:rounded-3xl border border-dashed border-neutral-300 bg-neutral-50 hover:bg-neutral-100 text-center flex flex-col items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Megaphone className="w-5 h-5 text-black" />
                  <span className="text-xs sm:text-sm font-bold text-black">
                    شريط الإعلانات التلقائي (اضغط لإضافة صور وتحديد المدة)
                  </span>
                  <span className="text-[11px] text-neutral-500">
                    يظهر هنا بين أزرار السنوات وشبكة المقاييس فور إضافة الصور
                  </span>
                </button>
              </div>
            ) : null}

            {/* Section Header: PEP arabe & Telegram Group Link */}
            <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-neutral-200">
              <h2 className="text-base sm:text-lg font-bold text-black font-sans">
                PEP arabe
              </h2>

              <a
                href="https://t.me/profArabe15"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-900 hover:bg-black text-white text-xs font-semibold transition-all duration-150 shadow-2xs group"
                title="مجموعتنا على تلغرام"
              >
                <svg 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  className="w-3.5 h-3.5 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-transform"
                >
                  <path d="m22 2-7 20-4-9-9-4Z" />
                  <path d="M22 2 11 13" />
                </svg>
                <span>مجموعتنا على تلغرام</span>
              </a>
            </div>

            {/* Admin Quick Control Bar on Modules View */}
            {isAdmin && (
              <div className="w-full bg-white rounded-2xl sm:rounded-3xl border border-neutral-200 p-3.5 sm:p-4 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-black text-white flex items-center justify-center shrink-0">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm font-bold text-black truncate">
                      إدارة المقاييس ({selectedYear === 'first' ? 'السنة الأولى' : 'السنة الثانية'})
                    </p>
                    <p className="text-[11px] text-neutral-500 truncate">
                      أنشئ مقياساً جديداً أو افتح أي مقياس لنشر الدروس والمنشورات
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => setIsAddModuleModalOpen(true)}
                    className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-black hover:bg-neutral-800 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer shadow-2xs"
                  >
                    <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>إنشاء مقياس جديد</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleOpenBannerAdminModal}
                    className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-neutral-100 hover:bg-neutral-200 text-black border border-neutral-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <Megaphone className="w-3.5 h-3.5" />
                    <span>شريط الإعلانات</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsNewsView(true);
                      setActiveModuleId(null);
                      setLessonSearchQuery('');
                      setNewsTypeFilter('all');
                    }}
                    className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-neutral-100 hover:bg-neutral-200 text-black border border-neutral-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <Home className="w-3.5 h-3.5" />
                    <span>نشر أخبار المدير</span>
                  </button>
                </div>
              </div>
            )}

            {/* Loading vs Empty State vs Modules Grid */}
            {!isCurrentYearLoaded && currentModules.length === 0 ? (
              <div className="w-full py-20 bg-neutral-50 rounded-3xl border border-neutral-200 flex flex-col items-center justify-center gap-3.5 text-center p-6">
                <Loader2 className="w-8 h-8 animate-spin text-black" />
                <div className="space-y-1">
                  <p className="text-sm font-bold text-black">جاري تحميل المقاييس، يرجى الانتظار...</p>
                  <p className="text-xs text-neutral-500">يتم جلب المقاييس والموارد من السحابة</p>
                </div>
              </div>
            ) : currentModules.length === 0 ? (
              <div className="space-y-6">
                <div 
                  onClick={() => {
                    if (isAdmin) setIsAddModuleModalOpen(true);
                  }}
                  className={`w-full h-56 bg-neutral-50 rounded-3xl border border-dashed border-neutral-300 flex flex-col items-center justify-center p-6 text-center ${
                    isAdmin ? 'cursor-pointer hover:bg-neutral-100' : ''
                  }`}
                >
                  <p className="text-sm font-bold text-neutral-800">لا توجد مقاييس مضافة في هذه السنة بعد</p>
                  <p className="text-xs text-neutral-500 mt-1 max-w-sm">
                    {isAdmin ? 'انقر هنا أو على زر "إنشاء مقياس" لإضافة أول مقياس' : 'سيتم نشر المقاييس والدروس من طرف المشرف قريباً'}
                  </p>
                </div>

                <div className="w-full h-56 bg-neutral-50/50 rounded-3xl border border-neutral-200" />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:gap-6">
                {currentModules.map((mod, index) => {
                  const hasCover = Boolean(mod.thumbnailUrl);

                  if (hasCover) {
                    {/* 5. Module Card WITH Full-Bleed Background Image Filling Entire Card Area */}
                    return (
                      <div
                        key={mod.id}
                        onClick={() => setActiveModuleId(mod.id)}
                        className="group relative rounded-2xl sm:rounded-3xl overflow-hidden min-h-[165px] sm:min-h-[225px] flex flex-col justify-between p-3.5 sm:p-6 shadow-2xs hover:shadow-md transition-transform duration-200 active:scale-[0.99] cursor-pointer border border-neutral-200 transform-gpu"
                      >
                        {/* Background image filling the entire card (Optimized with CloudImage) */}
                        <CloudImage 
                          src={mod.thumbnailUrl} 
                          alt={mod.name} 
                          loading="lazy"
                          decoding="async"
                          className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        {/* High-contrast gradient overlay ensuring crystal-clear text readability */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/55 to-black/30 group-hover:from-black/95 transition-colors" />

                        {/* Top Row: Index Badge + Admin Edit/Delete Actions */}
                        <div className="relative z-10 flex items-start justify-between gap-2">
                          <span className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-white/20 backdrop-blur-xs text-white font-mono text-[11px] sm:text-xs font-bold flex items-center justify-center border border-white/30 tabular-nums">
                            {index + 1}
                          </span>

                          {isAdmin && (
                            <div 
                              className="flex items-center gap-0.5 sm:gap-1 bg-black/55 p-0.5 sm:p-1 rounded-lg sm:rounded-xl border border-white/20" 
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                type="button"
                                onClick={(e) => handleOpenEditModule(e, mod)}
                                className="text-white/85 hover:text-white p-1 sm:p-1.5 rounded-lg hover:bg-white/20 transition-colors"
                                title="تعديل المقياس والغلاف"
                              >
                                <Pencil className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => handleDeleteModule(e, mod.id)}
                                className="text-white/85 hover:text-red-400 p-1 sm:p-1.5 rounded-lg hover:bg-white/20 transition-colors"
                                title="حذف المقياس"
                              >
                                <Trash2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Bottom Row: Title Only */}
                        <div className="relative z-10 mt-auto pt-4 sm:pt-8">
                          <h3 className="text-sm sm:text-xl font-bold text-white leading-snug drop-shadow-xs line-clamp-2">
                            {mod.name}
                          </h3>
                        </div>
                      </div>
                    );
                  }

                  {/* Clean Monochrome Module Card (No cover image attached) */}
                  return (
                    <div
                      key={mod.id}
                      onClick={() => setActiveModuleId(mod.id)}
                      className="group bg-white hover:bg-neutral-50 rounded-2xl sm:rounded-3xl border border-neutral-200 p-3.5 sm:p-6 flex flex-col justify-between shadow-2xs hover:shadow-md transition-transform duration-200 active:scale-[0.99] cursor-pointer min-h-[150px] sm:min-h-[185px] transform-gpu"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-neutral-100 text-black font-mono text-[11px] sm:text-xs font-bold flex items-center justify-center border border-neutral-200 tabular-nums">
                          {index + 1}
                        </span>

                        {isAdmin && (
                          <div className="flex items-center gap-0.5 sm:gap-1" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={(e) => handleOpenEditModule(e, mod)}
                              className="text-neutral-400 hover:text-black p-1 sm:p-1.5 rounded-lg hover:bg-neutral-100 transition-colors"
                              title="تعديل المقياس والغلاف"
                            >
                              <Pencil className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => handleDeleteModule(e, mod.id)}
                              className="text-neutral-300 hover:text-black p-1 sm:p-1.5 rounded-lg hover:bg-neutral-100 transition-colors"
                              title="حذف المقياس"
                            >
                              <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="mt-auto pt-4">
                        <h3 className="text-sm sm:text-lg font-bold text-black leading-snug line-clamp-2">
                          {mod.name}
                        </h3>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

          </div>
        )}

        {/* VIEW 3: STUDENT SUBMISSIONS TO ADMIN (Send icon view) */}
        {isSubmissionsView && (
          <div className="w-full max-w-3xl mx-auto space-y-6 animate-in fade-in duration-150" dir="rtl">
            {isAdmin ? (
              /* ADMIN INBOX VIEW: View all student-submitted lessons & content */
              <div className="space-y-5">
                <div className="bg-white rounded-3xl border border-neutral-200 p-5 sm:p-6 shadow-2xs flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-black text-white flex items-center justify-center shrink-0">
                      <Inbox className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-base sm:text-lg font-bold text-black">
                        المحتويات والدروس المرسلة من الطلبة
                      </h2>
                      <p className="text-xs text-neutral-500 mt-0.5">
                        {studentSubmissions.length > 0
                          ? `إجمالي الرسائل: ${studentSubmissions.length} · غير مقروءة: ${unreadSubmissionsCount}`
                          : 'تصلك هنا كل الدروس والملفات التي يرسلها الطلبة والمستخدمون'}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsSubmissionsView(false)}
                    className="px-3.5 py-2 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-black text-xs font-semibold transition-colors cursor-pointer"
                  >
                    العودة للمقاييس
                  </button>
                </div>

                {!isSubmissionsLoaded && studentSubmissions.length === 0 ? (
                  <div className="w-full py-20 bg-neutral-50 rounded-3xl border border-neutral-200 flex flex-col items-center justify-center gap-3 text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-black" />
                    <p className="text-xs font-semibold text-neutral-600">جاري تحميل رسائل الطلبة...</p>
                  </div>
                ) : studentSubmissions.length === 0 ? (
                  <div className="w-full py-20 bg-neutral-50 rounded-3xl border border-dashed border-neutral-300 flex flex-col items-center justify-center gap-2 text-center p-6">
                    <Inbox className="w-9 h-9 text-neutral-400" />
                    <p className="text-sm font-bold text-black">لا توجد محتويات مرسلة من الطلبة بعد</p>
                    <p className="text-xs text-neutral-500">عند قيام أي طالب أو مستخدم بإرسال درس أو ملف سيظهر لك هنا فوراً.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {studentSubmissions.map((sub) => (
                      <article
                        key={sub.id}
                        className={`bg-white rounded-3xl border p-4 sm:p-6 shadow-2xs space-y-4 transition-all ${
                          sub.isRead ? 'border-neutral-200' : 'border-black ring-1 ring-black/10'
                        }`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-neutral-100 pb-3">
                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center flex-wrap gap-2">
                              <span className="text-sm font-bold text-black">{sub.senderName}</span>
                              {!sub.isRead && (
                                <span className="px-2 py-0.5 rounded-lg bg-black text-white text-[10px] font-bold">
                                  جديد
                                </span>
                              )}
                              <span className="px-2 py-0.5 rounded-lg bg-neutral-100 text-neutral-700 text-[11px] font-semibold border border-neutral-200">
                                {sub.yearLabel}
                              </span>
                              {sub.moduleName && (
                                <span className="px-2 py-0.5 rounded-lg bg-neutral-100 text-neutral-700 text-[11px] font-semibold border border-neutral-200">
                                  {sub.moduleName}
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-neutral-500 font-mono flex items-center gap-1.5">
                              <span>{sub.createdAt}</span>
                              {formatPostTime(sub.timestamp) && (
                                <>
                                  <span>·</span>
                                  <span dir="ltr">{formatPostTime(sub.timestamp)}</span>
                                </>
                              )}
                            </p>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleToggleSubmissionRead(sub)}
                              className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-semibold border transition-colors cursor-pointer ${
                                sub.isRead
                                  ? 'bg-neutral-100 text-neutral-600 border-neutral-200 hover:bg-neutral-200'
                                  : 'bg-black text-white border-black hover:bg-neutral-800'
                              }`}
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>{sub.isRead ? 'مقروءة' : 'تمت القراءة'}</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteSubmission(sub.id)}
                              className="p-2 rounded-xl text-neutral-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                              title="حذف الرسالة"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <h3 className="text-base font-bold text-black">{sub.title}</h3>
                          {sub.description && (
                            <p className="text-sm text-neutral-700 leading-relaxed whitespace-pre-line">
                              {sub.description}
                            </p>
                          )}
                        </div>

                        {sub.images && sub.images.length > 0 && (
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                            {sub.images.map((img, idx) => (
                              <div
                                key={img.id}
                                onClick={() => handleOpenLightbox(sub.images, idx)}
                                className="relative aspect-4/3 rounded-2xl overflow-hidden border border-neutral-200 bg-neutral-100 cursor-pointer group"
                              >
                                <CloudImage
                                  src={img.url}
                                  alt={img.name}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                />
                              </div>
                            ))}
                          </div>
                        )}

                        {sub.pdfs && sub.pdfs.length > 0 && (
                          <div className="space-y-2">
                            {sub.pdfs.map((pdf) => (
                              <div
                                key={pdf.id}
                                className="flex items-center justify-between p-3 bg-neutral-50 rounded-2xl border border-neutral-200 gap-2"
                              >
                                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                  <div className="w-9 h-9 rounded-xl bg-neutral-200 text-black flex items-center justify-center shrink-0">
                                    <FileText className="w-4 h-4" />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className="text-xs font-bold text-black truncate font-mono">{pdf.name}</p>
                                    <p className="text-[11px] text-neutral-500 font-mono">{pdf.size} · PDF</p>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  disabled={Boolean(activeDownloadKeys[`inbox-pdf:${sub.id}:${pdf.id}`])}
                                  onClick={() => triggerDownload(pdf.url, pdf.name, `inbox-pdf:${sub.id}:${pdf.id}`)}
                                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-neutral-200 disabled:opacity-70 text-black text-xs font-semibold rounded-xl border border-neutral-300 cursor-pointer disabled:cursor-wait shrink-0"
                                >
                                  {activeDownloadKeys[`inbox-pdf:${sub.id}:${pdf.id}`] ? (
                                    <>
                                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                      <span>جاري التحميل...</span>
                                    </>
                                  ) : (
                                    <>
                                      <Download className="w-3.5 h-3.5" />
                                      <span>تحميل</span>
                                    </>
                                  )}
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </article>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              /* STUDENT / VISITOR SUBMISSION FORM */
              <div className="bg-white rounded-3xl border border-neutral-200 p-5 sm:p-7 shadow-2xs space-y-5">
                <div className="flex items-center gap-3 pb-4 border-b border-neutral-200">
                  <div className="w-11 h-11 rounded-2xl bg-black text-white flex items-center justify-center shrink-0">
                    <Send className="w-5 h-5 text-white -rotate-45" />
                  </div>
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-black">
                      إرسال دروس أو محتويات إلى المدير
                    </h2>
                    <p className="text-xs text-neutral-500 mt-0.5">
                      يمكن للطلبة والمستخدمين إرسال ملخصات، دروس، صور أو ملفات PDF ليراجعها المدير وينشرها.
                    </p>
                  </div>
                </div>

                {subFormSuccess && (
                  <div className="p-4 bg-black text-white rounded-2xl text-xs sm:text-sm font-semibold flex items-center gap-2.5 animate-in fade-in">
                    <CheckCircle2 className="w-5 h-5 text-white shrink-0" />
                    <span>{subFormSuccess}</span>
                  </div>
                )}

                {subFormError && (
                  <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-2xl text-xs font-semibold">
                    {subFormError}
                  </div>
                )}

                <form onSubmit={handleSubmitStudentContent} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block text-xs font-semibold text-neutral-800 mb-1.5">
                        اسمك (اختياري):
                      </label>
                      <input
                        type="text"
                        value={subSenderName}
                        onChange={(e) => setSubSenderName(e.target.value)}
                        placeholder="مثال: طالب سنة ثانية / اسمك..."
                        className="w-full px-4 py-2.5 bg-neutral-50 border border-neutral-300 rounded-2xl text-sm text-black placeholder-neutral-400 focus:outline-none focus:ring-1 focus:ring-black focus:bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-neutral-800 mb-1.5">
                        السنة الدراسية:
                      </label>
                      <select
                        value={subYearLabel}
                        onChange={(e) => setSubYearLabel(e.target.value)}
                        className="w-full px-4 py-2.5 bg-neutral-50 border border-neutral-300 rounded-2xl text-sm text-black focus:outline-none focus:ring-1 focus:ring-black focus:bg-white"
                      >
                        <option value="السنة الثانية">السنة الثانية</option>
                        <option value="السنة الأولى">السنة الأولى</option>
                        <option value="عام / أخبار">عام / أخبار</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-neutral-800 mb-1.5">
                      اسم المقياس (اختياري):
                    </label>
                    <input
                      type="text"
                      value={subModuleName}
                      onChange={(e) => setSubModuleName(e.target.value)}
                      placeholder="اكتب اسم المقياس (مثل: ديداكتيك، بيداغوجيا...)"
                      className="w-full px-4 py-2.5 bg-neutral-50 border border-neutral-300 rounded-2xl text-sm text-black placeholder-neutral-400 focus:outline-none focus:ring-1 focus:ring-black focus:bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-neutral-800 mb-1.5">
                      عنوان الدرس أو المحتوى (مطلوب):
                    </label>
                    <input
                      type="text"
                      value={subTitle}
                      onChange={(e) => setSubTitle(e.target.value)}
                      required
                      placeholder="مثال: ملخص المحاضرة الثالثة، سلسلة تمارين TD..."
                      className="w-full px-4 py-2.5 bg-neutral-50 border border-neutral-300 rounded-2xl text-sm text-black placeholder-neutral-400 focus:outline-none focus:ring-1 focus:ring-black focus:bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-neutral-800 mb-1.5">
                      المحتوى أو الملاحظات الموجهة للمدير:
                    </label>
                    <textarea
                      ref={subDescRef}
                      value={subDescription}
                      onChange={(e) => setSubDescription(e.target.value)}
                      rows={4}
                      placeholder="اكتب نص الدرس أو أي توضيح تود إيصاله للمدير..."
                      className="w-full px-4 py-2.5 bg-neutral-50 border border-neutral-300 rounded-2xl text-sm text-black placeholder-neutral-400 focus:outline-none focus:ring-1 focus:ring-black focus:bg-white resize-y"
                    />
                  </div>

                  {/* Attach Images */}
                  <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs font-bold text-black">
                        <ImageIcon className="w-4 h-4 text-black" />
                        <span>إرفاق صور ({subImages.length})</span>
                      </div>
                      <label className="flex items-center gap-2 px-3 py-1.5 bg-white hover:bg-neutral-100 border border-neutral-300 rounded-xl text-xs font-semibold text-black cursor-pointer transition-colors shadow-2xs">
                        {isUploadingSubImages ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-black" />
                        ) : (
                          <Upload className="w-3.5 h-3.5 text-black" />
                        )}
                        <span>{isUploadingSubImages ? 'جاري رفع الصور...' : 'اختيار صور'}</span>
                        <input
                          type="file"
                          multiple
                          accept="image/*"
                          onChange={handleSubImageFileChange}
                          disabled={isUploadingSubImages}
                          className="hidden"
                        />
                      </label>
                    </div>

                    {subImages.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {subImages.map((img) => (
                          <div key={img.id} className="relative w-16 h-16 rounded-xl overflow-hidden border border-neutral-300 group">
                            <CloudImage src={img.url} alt={img.name} className="w-full h-full object-cover" />
                            <button
                              type="button"
                              onClick={() => setSubImages(prev => prev.filter(item => item.id !== img.id))}
                              className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Attach PDFs */}
                  <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs font-bold text-black">
                        <FileUp className="w-4 h-4 text-black" />
                        <span>إرفاق ملفات PDF ({subPdfs.length})</span>
                      </div>
                      <label className="flex items-center gap-2 px-3 py-1.5 bg-white hover:bg-neutral-100 border border-neutral-300 rounded-xl text-xs font-semibold text-black cursor-pointer transition-colors shadow-2xs">
                        {isUploadingSubPdfs ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-black" />
                        ) : (
                          <Upload className="w-3.5 h-3.5 text-black" />
                        )}
                        <span>{isUploadingSubPdfs ? 'جاري رفع PDF...' : 'اختيار ملف PDF'}</span>
                        <input
                          type="file"
                          multiple
                          accept="application/pdf,.pdf"
                          onChange={handleSubPdfFileChange}
                          disabled={isUploadingSubPdfs}
                          className="hidden"
                        />
                      </label>
                    </div>

                    {subPdfs.length > 0 && (
                      <div className="space-y-2">
                        {subPdfs.map((pdf) => (
                          <div key={pdf.id} className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-neutral-200 text-xs">
                            <div className="flex items-center gap-2 truncate">
                              <FileText className="w-4 h-4 text-black shrink-0" />
                              <span className="font-mono text-black truncate">{pdf.name}</span>
                              <span className="text-neutral-400 text-[10px]">({pdf.size})</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => setSubPdfs(prev => prev.filter(item => item.id !== pdf.id))}
                              className="text-neutral-400 hover:text-black p-1"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                      type="submit"
                      disabled={!subTitle.trim() || isUploadingSubImages || isUploadingSubPdfs || isSubmittingStudentContent}
                      className="w-full sm:w-auto px-6 py-3 rounded-2xl text-xs sm:text-sm font-bold text-white bg-black hover:bg-neutral-800 disabled:opacity-40 transition-colors shadow-xs flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {isSubmittingStudentContent ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin text-white" />
                          <span>جاري الإرسال إلى المدير...</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4 text-white -rotate-45" />
                          <span>إرسال المحتوى للمدير</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        )}

        {/* 4. VIEW 2: DEDICATED MODULE PAGE OR ADMIN NEWS & UPDATES FEED */}
        {(activeModule || isNewsView) && !isSubmissionsView && (
          <div className="w-full max-w-5xl mx-auto space-y-5 sm:space-y-6 px-0.5 sm:px-2 animate-in fade-in duration-150">
            
            {/* Sticky Filter Bar: Solid white background pinned cleanly beneath the sticky top header on scroll */}
            {isNewsView ? (
              <div className="sticky top-[64px] sm:top-[74px] z-30 w-full py-2 bg-white mb-2" dir="rtl">
                <div className="w-full max-w-md mx-auto px-1 sm:px-2">
                  <div className="bg-black text-white p-1 sm:p-1.5 rounded-2xl shadow-lg border border-neutral-800 flex items-center justify-between gap-1 text-[11px] sm:text-sm">
                    <button
                      type="button"
                      onClick={() => setNewsTypeFilter('all')}
                      className={`flex-1 py-1.5 sm:py-2 px-1 rounded-xl text-center font-semibold transition-all duration-150 cursor-pointer ${
                        newsTypeFilter === 'all'
                          ? 'bg-white text-black shadow-xs font-bold'
                          : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
                      }`}
                    >
                      الكل
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewsTypeFilter('news')}
                      className={`flex-1 py-1.5 sm:py-2 px-1 rounded-xl text-center font-semibold transition-all duration-150 cursor-pointer ${
                        newsTypeFilter === 'news'
                          ? 'bg-white text-black shadow-xs font-bold'
                          : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
                      }`}
                    >
                      أخبار
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewsTypeFilter('updates')}
                      className={`flex-1 py-1.5 sm:py-2 px-1 rounded-xl text-center font-semibold transition-all duration-150 cursor-pointer ${
                        newsTypeFilter === 'updates'
                          ? 'bg-white text-black shadow-xs font-bold'
                          : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
                      }`}
                    >
                      مستجدات
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewsTypeFilter('announcements')}
                      className={`flex-1 py-1.5 sm:py-2 px-1 rounded-xl text-center font-semibold transition-all duration-150 cursor-pointer ${
                        newsTypeFilter === 'announcements'
                          ? 'bg-white text-black shadow-xs font-bold'
                          : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
                      }`}
                    >
                      إعلانات
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div 
                className="sticky top-[64px] sm:top-[74px] z-30 w-full py-2 bg-white mb-2"
                dir="rtl"
              >
                <div className="w-full max-w-md mx-auto px-1 sm:px-2">
                  <div className="bg-black text-white p-1 sm:p-1.5 rounded-2xl shadow-lg border border-neutral-800 flex items-center justify-between gap-1 text-[11px] sm:text-sm">
                    <button
                      type="button"
                      onClick={() => setLessonTypeFilter('all')}
                      className={`flex-1 py-1.5 sm:py-2 px-1 rounded-xl text-center font-semibold transition-all duration-150 cursor-pointer ${
                        lessonTypeFilter === 'all'
                          ? 'bg-white text-black shadow-xs font-bold'
                          : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
                      }`}
                    >
                      الكل
                    </button>

                    <button
                      type="button"
                      onClick={() => setLessonTypeFilter('cour')}
                      className={`flex-1 py-1.5 sm:py-2 px-1 rounded-xl text-center font-semibold transition-all duration-150 cursor-pointer ${
                        lessonTypeFilter === 'cour'
                          ? 'bg-white text-black shadow-xs font-bold'
                          : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
                      }`}
                    >
                      Cour
                    </button>

                    <button
                      type="button"
                      onClick={() => setLessonTypeFilter('td')}
                      className={`flex-1 py-1.5 sm:py-2 px-1 rounded-xl text-center font-semibold transition-all duration-150 cursor-pointer ${
                        lessonTypeFilter === 'td'
                          ? 'bg-white text-black shadow-xs font-bold'
                          : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
                      }`}
                    >
                      TD
                    </button>

                    <button
                      type="button"
                      onClick={() => setLessonTypeFilter('exercises')}
                      className={`flex-1 py-1.5 sm:py-2 px-1 rounded-xl text-center font-semibold transition-all duration-150 cursor-pointer ${
                        lessonTypeFilter === 'exercises'
                          ? 'bg-white text-black shadow-xs font-bold'
                          : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
                      }`}
                    >
                      تمارين
                    </button>
                  </div>
                </div>
              </div>
            )}
            
            {/* Admin Top Action / Publishing Trigger */}
            {isAdmin && (
              <div 
                onClick={openAddPostModal}
                className="w-full bg-white hover:bg-neutral-50 rounded-2xl sm:rounded-3xl border border-neutral-200 p-3.5 sm:p-5 flex items-center justify-between gap-2.5 sm:gap-4 cursor-pointer shadow-2xs hover:shadow-sm transition-all group mb-4"
              >
                <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                  <img
                    src={ADMIN_AVATAR_URL}
                    alt="KAOUANE fares"
                    className="w-9 h-9 sm:w-10 sm:h-10 rounded-full object-cover border border-neutral-200 shadow-2xs shrink-0"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = avatarAsset;
                    }}
                  />
                  <div className="text-right min-w-0 flex-1">
                    <p className="text-xs sm:text-sm font-semibold text-neutral-500 group-hover:text-black transition-colors leading-snug">
                      {isNewsView
                        ? 'انقر هنا لنشر خبر، مستجدات، إعلان، صور أو وثيقة PDF...'
                        : 'انقر هنا لنشر درس، محاضرة، صور أو وثيقة PDF في هذا المقياس...'}
                    </p>
                    <p className="text-[11px] text-neutral-400 font-mono truncate">
                      بصفتك المشرف: KAOUANE fares
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {activeFeedLessons.length > 0 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        const firstLesson = sortedLessons[0] || activeFeedLessons[0];
                        if (firstLesson) {
                          handleOpenLikesControlModal(
                            firstLesson,
                            activeFeedLessons.map(l => String(l.id))
                          );
                        }
                      }}
                      className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-black border border-neutral-300 rounded-xl text-[11px] sm:text-xs font-semibold transition-colors cursor-pointer"
                      title="ضبط وتوزيع التفاعلات لعدة منشورات أو منشور واحد"
                    >
                      <SlidersHorizontal className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">ضبط التفاعلات</span>
                    </button>
                  )}
                  <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 bg-black text-white rounded-xl text-xs font-semibold shadow-2xs">
                    <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>{isNewsView ? 'نشر خبر جديد' : 'نشر جديد'}</span>
                  </span>
                  <div className="sm:hidden w-8 h-8 rounded-xl bg-black text-white flex items-center justify-center">
                    <Plus className="w-4 h-4 stroke-[2.5]" />
                  </div>
                </div>
              </div>
            )}

            {/* 4. EXPANDED FULL-WIDTH INSTAGRAM-STYLE POSTS FEED */}
            <div className="space-y-7">
              
              {isNewsView && !isNewsLoaded && sortedLessons.length === 0 ? (
                <div className="w-full py-20 bg-neutral-50 rounded-3xl border border-neutral-200 flex flex-col items-center justify-center gap-3 text-center p-6">
                  <Loader2 className="w-8 h-8 animate-spin text-black" />
                  <p className="text-sm font-bold text-black">جاري تحميل الأخبار والمستجدات، يرجى الانتظار...</p>
                </div>
              ) : sortedLessons.length === 0 ? (
                /* Empty feed container */
                <div 
                  onClick={() => {
                    if (isAdmin) openAddPostModal();
                  }}
                  className={`w-full h-72 bg-neutral-50 rounded-3xl border border-dashed border-neutral-300 flex flex-col items-center justify-center p-8 text-center ${
                    isAdmin ? 'cursor-pointer hover:bg-neutral-100' : ''
                  }`}
                >
                  <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center text-black shadow-xs mb-3 border border-neutral-200">
                    <Plus className="w-6 h-6 stroke-[2.5]" />
                  </div>
                  <p className="text-base font-bold text-neutral-800">
                    {isNewsView ? 'لا توجد أخبار أو منشورات من الإدارة بعد' : 'لم يتم نشر أي درس بعد في هذا المقياس'}
                  </p>
                  <p className="text-xs text-neutral-500 mt-1 max-w-sm">
                    {isAdmin
                      ? (isNewsView
                          ? 'انقر هنا لنشر الأخبار، المستجدات، الصور وملفات PDF لجميع الطلبة'
                          : 'استخدم زر "نشر درس" في الأعلى لإرفاق المطبوعات البيداغوجية، الصور، وملفات PDF')
                      : (isNewsView
                          ? 'سيتم نشر الأخبار وآخر المستجدات هنا فور صدورها من طرف المدير'
                          : 'سيتم نشر المحتوى قريباً من طرف أستاذ المقياس')}
                  </p>
                </div>
              ) : filteredLessons.length === 0 ? (
                /* No search results */
                <div className="w-full py-16 bg-neutral-50 rounded-3xl border border-neutral-200 text-center p-6">
                  <Search className="w-8 h-8 text-neutral-400 mx-auto mb-2" />
                  <p className="text-sm font-bold text-black">لا توجد منشورات مطابقة لبحثك</p>
                  <p className="text-xs text-neutral-500 mt-1">جرب البحث بكلمات أخرى أو امسح شريط البحث</p>
                  <button
                    type="button"
                    onClick={() => {
                      setLessonSearchQuery('');
                      setLessonTypeFilter('all');
                      setNewsTypeFilter('all');
                    }}
                    className="mt-3 px-4 py-1.5 bg-black text-white rounded-xl text-xs font-semibold hover:bg-neutral-800 transition-colors"
                  >
                    إلغاء التصفية والبحث
                  </button>
                </div>
              ) : (
                filteredLessons.map((lesson) => {
                  const visibleCommentsCount = (lesson.comments || []).filter(c => isAdmin || c.isApproved || c.isAdmin).length;
                  const pendingCount = (lesson.comments || []).filter(c => !c.isApproved && !c.isAdmin).length;
                  const images = lesson.images || [];
                  const pdfs = lesson.pdfs || [];

                  return (
                    <article
                      key={lesson.id}
                      className="w-full bg-white rounded-3xl border border-neutral-200 overflow-hidden shadow-2xs hover:shadow-sm transition-all relative"
                    >
                      {/* Pinned Post Indicator: Clean pin icon ONLY without the word "مثبت" */}
                      {lesson.isPinned && (
                        <div 
                          className="absolute top-3 left-3.5 z-20 w-7 h-7 rounded-full bg-black text-white flex items-center justify-center shadow-xs select-none"
                          title="منشور مثبت"
                          aria-label="منشور مثبت"
                        >
                          <Pin className="w-3.5 h-3.5 fill-white text-white stroke-[2]" />
                        </div>
                      )}

                      {/* Post Header */}
                      <div className={`p-3.5 sm:p-5 ${isAdmin && lesson.isPinned ? 'pt-11 sm:pt-11' : ''} flex flex-wrap items-center justify-between gap-2.5 border-b border-neutral-100`}>
                        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                          <img
                            src={ADMIN_AVATAR_URL}
                            alt="KAOUANE fares"
                            className="w-10 h-10 rounded-full object-cover border border-neutral-200 shadow-2xs shrink-0"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              if (target.src !== avatarAsset) {
                                target.src = avatarAsset;
                              } else {
                                target.src = 'https://i.ibb.co/whnGcQmw/1785099526878.jpg';
                              }
                            }}
                          />
                          <div>
                            <div className="flex items-center gap-2">
                              {/* 3. Name KAOUANE fares ONLY (Verification badge removed) */}
                              <span className="text-sm font-bold text-black font-sans leading-tight">
                                KAOUANE fares
                              </span>
                            </div>

                            {/* 2. Date & Time Behavior for Pinned Posts */}
                            <div className="flex items-center flex-wrap gap-1.5 text-xs text-neutral-500 font-mono mt-0.5">
                              <span>{lesson.type}</span>
                              {!lesson.isPinned && (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span>{lesson.createdAt}</span>
                                  {formatPostTime(lesson.timestamp, lesson.id) && (
                                    <>
                                      <span aria-hidden="true">·</span>
                                      <span dir="ltr">{formatPostTime(lesson.timestamp, lesson.id)}</span>
                                    </>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Admin Action Menu: Remove Notification, Toggle Comments, Toggle Auto-Likes, Edit, Pin & Delete */}
                        {isAdmin && (
                          <div className="flex items-center flex-wrap gap-1.5">
                            {activeStudentNotif?.id === String(lesson.id) && (
                              <button
                                type="button"
                                onClick={handleClearActivePostNotification}
                                className="px-2 py-1.5 rounded-xl text-[11px] font-semibold transition-colors flex items-center gap-1 border bg-red-50 text-red-600 border-red-200 hover:bg-red-100 cursor-pointer"
                                title="نزع إشعار هذا المنشور الذي قمت بتفعيله للطلبة"
                              >
                                <BellOff className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">نزع الإشعار</span>
                              </button>
                            )}

                            {/* Toggle Comments ON/OFF (Admin only) */}
                            <button
                              type="button"
                              onClick={() => handleToggleLessonComments(lesson.id)}
                              className={`px-2 py-1.5 rounded-xl text-[11px] font-semibold transition-colors flex items-center gap-1 border cursor-pointer ${
                                lesson.commentsEnabled === false
                                  ? 'bg-neutral-100 text-neutral-600 border-neutral-300 hover:bg-neutral-200'
                                  : 'bg-white text-black border-neutral-300 hover:bg-neutral-100'
                              }`}
                              title={
                                lesson.commentsEnabled === false
                                  ? 'التعليقات متوقفة — انقر لإعادة تشغيل التعليقات'
                                  : 'إطفاء التعليقات على هذا المنشور'
                              }
                            >
                              {lesson.commentsEnabled === false ? (
                                <>
                                  <Lock className="w-3 h-3" />
                                  <span className="hidden sm:inline">تعليقات: متوقفة</span>
                                </>
                              ) : (
                                <>
                                  <MessageCircle className="w-3 h-3" />
                                  <span className="hidden sm:inline">تعليقات: مفعّلة</span>
                                </>
                              )}
                            </button>

                            {/* Pause / Resume Auto-Generated Likes Button (Admin only) */}
                            <button
                              type="button"
                              onClick={() => handleToggleAutoLikes(lesson.id)}
                              className={`px-2 py-1.5 rounded-xl text-[11px] font-semibold transition-colors flex items-center gap-1 border cursor-pointer ${
                                lesson.autoLikesEnabled === false
                                  ? 'bg-neutral-100 text-neutral-600 border-neutral-300 hover:bg-neutral-200'
                                  : 'bg-black text-white border-black hover:bg-neutral-800'
                              }`}
                              title={
                                lesson.autoLikesEnabled === false
                                  ? 'الإعجابات الآلية متوقفة (الحقيقية فقط) — انقر لإعادة التفعيل'
                                  : 'إيقاف الإعجابات المولدة آلياً (تبقى الإعجابات الحقيقية فقط)'
                              }
                            >
                              {lesson.autoLikesEnabled === false ? (
                                <>
                                  <Play className="w-3 h-3" />
                                  <span className="hidden sm:inline">آلي: متوقف</span>
                                </>
                              ) : (
                                <>
                                  <Pause className="w-3 h-3" />
                                  <span className="hidden sm:inline">آلي: نشط</span>
                                </>
                              )}
                            </button>

                            {/* Configure Per-Post Likes Rate (Admin only) */}
                            <button
                              type="button"
                              onClick={() => handleOpenLikesControlModal(lesson)}
                              className={`px-2 py-1.5 rounded-xl text-[11px] font-semibold transition-colors flex items-center gap-1 border cursor-pointer ${
                                lesson.autoLikesMode === 'custom'
                                  ? 'bg-black text-white border-black hover:bg-neutral-800'
                                  : 'bg-white text-neutral-700 border-neutral-300 hover:bg-neutral-100'
                              }`}
                              title="ضبط سرعة ومعدل الإعجابات لهذا المنشور"
                            >
                              <SlidersHorizontal className="w-3 h-3" />
                              <span className="hidden sm:inline">
                                {lesson.autoLikesMode === 'custom'
                                  ? `+${lesson.autoLikesCustomCount ?? 0}/${lesson.autoLikesCustomInterval ?? 1}${
                                      lesson.autoLikesCustomUnit === 'day'
                                        ? 'ي'
                                        : lesson.autoLikesCustomUnit === 'hour'
                                          ? 'س'
                                          : 'د'
                                    }`
                                  : 'معدل الإعجاب'}
                              </span>
                            </button>

                            {/* Edit Post Button (Admin only) */}
                            <button
                              type="button"
                              onClick={() => handleOpenEditLesson(lesson)}
                              className="p-2 rounded-xl text-neutral-500 hover:text-black hover:bg-neutral-100 transition-colors"
                              title="تعديل المنشور"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>

                            {/* Pin / Unpin Post Button (Admin control) */}
                            <button
                              type="button"
                              onClick={() => handleTogglePinLesson(lesson.id)}
                              className={`p-2 rounded-xl text-xs transition-colors flex items-center gap-1 ${
                                lesson.isPinned
                                  ? 'text-black bg-neutral-100 hover:bg-neutral-200 border border-neutral-300'
                                  : 'text-neutral-400 hover:text-black hover:bg-neutral-100'
                              }`}
                              title={lesson.isPinned ? 'إلغاء تثبيت المنشور (استعادة التاريخ)' : 'تثبيت المنشور في أعلى الخلاصة (إخفاء التاريخ)'}
                            >
                              <Pin className={`w-4 h-4 ${lesson.isPinned ? 'fill-black text-black' : ''}`} />
                            </button>

                            {/* Delete Post Button */}
                            <button
                              type="button"
                              onClick={() => handleDeleteLesson(lesson.id)}
                              className="text-neutral-300 hover:text-black p-2 rounded-xl hover:bg-neutral-100 transition-colors"
                              title="حذف الدرس"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Post Title */}
                      <div className="px-4 sm:px-6 pt-4 pb-2">
                        <h2 className="text-base sm:text-lg font-bold text-black leading-snug">
                          {lesson.title}
                        </h2>
                      </div>

                      {/* Text Description / Caption Content */}
                      {lesson.description && (
                        <div className="px-4 sm:px-6 pb-3 text-sm text-neutral-700 leading-relaxed whitespace-pre-line">
                          {lesson.description}
                        </div>
                      )}

                      {/* Spacious Media Section */}
                      {images.length > 0 && (
                        <div className="px-4 sm:px-6 pb-3">
                          {/* 1 Image: Full Wide Media */}
                          {images.length === 1 && (
                            <div 
                              onClick={() => handleOpenLightbox(images, 0)}
                              className="relative rounded-2xl overflow-hidden cursor-pointer max-h-[580px] bg-neutral-100 border border-neutral-200 group"
                            >
                              <CloudImage
                                src={images[0].url}
                                alt={images[0].name}
                                className="w-full h-full object-cover group-hover:scale-[1.01] transition-transform duration-200"
                              />
                            </div>
                          )}

                          {/* 2 Images: Side-by-Side */}
                          {images.length === 2 && (
                            <div className="grid grid-cols-2 gap-2 rounded-2xl overflow-hidden">
                              {images.map((img, idx) => (
                                <div
                                  key={img.id}
                                  onClick={() => handleOpenLightbox(images, idx)}
                                  className="relative aspect-4/3 overflow-hidden cursor-pointer bg-neutral-100 border border-neutral-200 group"
                                >
                                  <CloudImage
                                    src={img.url}
                                    alt={img.name}
                                    className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-200"
                                  />
                                </div>
                              ))}
                            </div>
                          )}

                          {/* 3 Images: 1 Top Banner + 2 Columns */}
                          {images.length === 3 && (
                            <div className="grid grid-cols-2 gap-2 rounded-2xl overflow-hidden">
                              <div
                                onClick={() => handleOpenLightbox(images, 0)}
                                className="col-span-2 relative aspect-16/9 overflow-hidden cursor-pointer bg-neutral-100 border border-neutral-200 group"
                              >
                                <CloudImage
                                  src={images[0].url}
                                  alt={images[0].name}
                                  className="w-full h-full object-cover group-hover:scale-[1.01] transition-transform duration-200"
                                />
                              </div>
                              {images.slice(1).map((img, idx) => (
                                <div
                                  key={img.id}
                                  onClick={() => handleOpenLightbox(images, idx + 1)}
                                  className="relative aspect-4/3 overflow-hidden cursor-pointer bg-neutral-100 border border-neutral-200 group"
                                >
                                  <CloudImage
                                    src={img.url}
                                    alt={img.name}
                                    className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-200"
                                  />
                                </div>
                              ))}
                            </div>
                          )}

                          {/* 4 or more Images: 2x2 Grid with +N Overlay on the 4th */}
                          {images.length >= 4 && (
                            <div className="grid grid-cols-2 gap-2 rounded-2xl overflow-hidden">
                              {images.slice(0, 3).map((img, idx) => (
                                <div
                                  key={img.id}
                                  onClick={() => handleOpenLightbox(images, idx)}
                                  className="relative aspect-square overflow-hidden cursor-pointer bg-neutral-100 border border-neutral-200 group"
                                >
                                  <CloudImage
                                    src={img.url}
                                    alt={img.name}
                                    className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-200"
                                  />
                                </div>
                              ))}

                              {/* 4th slot with "+N" remaining count */}
                              <div
                                onClick={() => handleOpenLightbox(images, 3)}
                                className="relative aspect-square overflow-hidden cursor-pointer bg-black border border-neutral-200 group"
                              >
                                <CloudImage
                                  src={images[3].url}
                                  alt={images[3].name}
                                  className="w-full h-full object-cover opacity-80 group-hover:scale-[1.02] transition-transform duration-200"
                                />
                                {images.length > 4 && (
                                  <div className="absolute inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center text-white text-3xl font-bold font-mono">
                                    +{images.length - 3}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* PDF Documents Preview Card */}
                      {pdfs.length > 0 && (
                        <div className="px-3.5 sm:px-6 pb-3 space-y-2.5">
                          {pdfs.map((pdf) => (
                            <div
                              key={pdf.id}
                              className="flex items-center justify-between p-3 sm:p-3.5 bg-neutral-50 hover:bg-neutral-100 rounded-2xl border border-neutral-200 transition-colors gap-2 sm:gap-3"
                            >
                              <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                                {pdf.coverImageUrl ? (
                                  <CloudImage
                                    src={pdf.coverImageUrl}
                                    alt={pdf.name}
                                    className="w-10 h-12 sm:w-12 sm:h-14 object-cover rounded-xl border border-neutral-200 shrink-0"
                                  />
                                ) : (
                                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-neutral-200 text-black flex flex-col items-center justify-center shrink-0 border border-neutral-300">
                                    <FileText className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2]" />
                                  </div>
                                )}

                                <div className="min-w-0 flex-1 text-right">
                                  <p className="text-xs sm:text-sm font-bold text-black truncate font-mono">
                                    {pdf.name}
                                  </p>
                                  <p className="text-[11px] text-neutral-500 font-mono mt-0.5">
                                    {pdf.size} · وثيقة PDF
                                  </p>
                                </div>
                              </div>

                              <button
                                type="button"
                                disabled={Boolean(activeDownloadKeys[`post-pdf:${lesson.id}:${pdf.id}`])}
                                onClick={() => triggerDownload(pdf.url, pdf.name, `post-pdf:${lesson.id}:${pdf.id}`)}
                                className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3.5 py-1.5 bg-white hover:bg-neutral-200 disabled:opacity-70 text-black text-xs font-semibold rounded-xl border border-neutral-300 transition-colors shrink-0 shadow-2xs cursor-pointer disabled:cursor-wait"
                                title="تحميل الملف"
                              >
                                {activeDownloadKeys[`post-pdf:${lesson.id}:${pdf.id}`] ? (
                                  <>
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    <span>جاري التحميل...</span>
                                  </>
                                ) : (
                                  <>
                                    <Download className="w-3.5 h-3.5" />
                                    <span>تحميل</span>
                                  </>
                                )}
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Instagram-Style Interactive Bottom Actions Bar */}
                      <div className="px-3.5 sm:px-6 py-3 border-t border-neutral-100 flex flex-wrap items-center justify-between gap-2 text-neutral-700">
                        
                        {/* Left: Like (+ Admin +/-), Comment (Clean icon without numeric count), Multi-Download */}
                        <div className="flex items-center gap-3 sm:gap-4">
                          <div className="flex items-center gap-1.5">
                            {/* Like Button (Red Heart) */}
                            <button
                              type="button"
                              onClick={() => handleToggleLike(lesson.id)}
                              className={`flex items-center gap-1.5 transition-transform active:scale-110 cursor-pointer ${
                                lesson.isLiked ? 'text-red-500 font-bold' : 'text-red-500/80 hover:text-red-500'
                              }`}
                              title="إعجاب"
                            >
                              <Heart className={`w-5 h-5 ${lesson.isLiked ? 'fill-red-500 text-red-500' : 'text-red-500'}`} />
                              <span className="text-xs font-mono tabular-nums text-neutral-700">{lesson.likesCount || 0}</span>
                            </button>

                            {/* Admin Likes Increment / Decrement (+/-) */}
                            {isAdmin && (
                              <div className="flex items-center gap-0.5 bg-neutral-100 border border-neutral-200 rounded-xl px-1 py-0.5">
                                <button
                                  type="button"
                                  onClick={() => handleAdminAdjustLikes(lesson.id, -1)}
                                  className="w-5 h-5 rounded-lg hover:bg-neutral-200 text-black font-bold text-xs flex items-center justify-center transition-colors cursor-pointer"
                                  title="إنقاص الإعجابات (-1)"
                                  aria-label="إنقاص الإعجابات"
                                >
                                  -
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleAdminAdjustLikes(lesson.id, 1)}
                                  className="w-5 h-5 rounded-lg hover:bg-neutral-200 text-black font-bold text-xs flex items-center justify-center transition-colors cursor-pointer"
                                  title="زيادة الإعجابات (+1)"
                                  aria-label="زيادة الإعجابات"
                                >
                                  +
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Comment Button (Clean aesthetic icon, numeric count hidden) */}
                          <button
                            type="button"
                            onClick={() => setCommentsModalLesson(lesson)}
                            className="flex items-center gap-1.5 text-neutral-500 hover:text-black transition-colors cursor-pointer"
                            title="التعليقات"
                            aria-label="التعليقات"
                          >
                            <MessageCircle className="w-5 h-5" />
                          </button>

                          {/* Multi-Download */}
                          {(images.length > 0 || pdfs.length > 0) && (
                            <button
                              type="button"
                              disabled={Boolean(activeDownloadKeys[`attachments:${lesson.id}`])}
                              onClick={async () => {
                                const attachKey = `attachments:${lesson.id}`;
                                setActiveDownloadKeys(prev => ({ ...prev, [attachKey]: true }));
                                try {
                                  if (images.length > 0) {
                                    await handleDownloadAllPostImages(images, lesson.title, `${attachKey}:imgs`);
                                  }
                                  if (pdfs.length > 0) {
                                    for (let pIdx = 0; pIdx < pdfs.length; pIdx++) {
                                      await triggerDownload(pdfs[pIdx].url, pdfs[pIdx].name, `${attachKey}:pdf:${pIdx}`);
                                    }
                                  }
                                } finally {
                                  setActiveDownloadKeys(prev => {
                                    const next = { ...prev };
                                    delete next[attachKey];
                                    return next;
                                  });
                                }
                              }}
                              className="flex items-center gap-1.5 text-neutral-500 hover:text-black disabled:opacity-70 transition-colors text-xs font-medium cursor-pointer disabled:cursor-wait"
                              title={`تحميل كافة المرفقات (${images.length} صور, ${pdfs.length} ملفات)`}
                            >
                              {activeDownloadKeys[`attachments:${lesson.id}`] ? (
                                <>
                                  <Loader2 className="w-5 h-5 animate-spin text-black" />
                                  <span className="hidden sm:inline text-xs text-black font-semibold">
                                    جاري التحميل...
                                  </span>
                                </>
                              ) : (
                                <>
                                  <Download className="w-5 h-5" />
                                  <span className="hidden sm:inline text-xs">
                                    تحميل المرفقات ({images.length + pdfs.length})
                                  </span>
                                </>
                              )}
                            </button>
                          )}
                        </div>

                        {/* Quick Comments Link (No comment counts displayed) */}
                        <button
                          type="button"
                          onClick={() => setCommentsModalLesson(lesson)}
                          className="text-xs text-neutral-400 hover:text-black transition-colors cursor-pointer"
                        >
                          {visibleCommentsCount > 0 || lesson.commentsEnabled === false
                            ? 'عرض التعليقات'
                            : 'أضف تعليقاً...'}
                        </button>
                      </div>

                    </article>
                  );
                })
              )}

            </div>

          </div>
        )}

      </main>

      {/* INSTAGRAM-STYLE COMMENTS POP-UP MODAL WITH ADMIN PINNING & MODERATION QUEUE */}
      {commentsModalLesson && (
        <div 
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150"
          onClick={() => setCommentsModalLesson(null)}
        >
          <div 
            className="bg-white rounded-t-3xl sm:rounded-3xl border border-neutral-200 w-full max-w-lg max-h-[85vh] sm:max-h-[80vh] flex flex-col shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            dir="rtl"
          >
            {/* Modal Header */}
            <div className="p-4 border-b border-neutral-100 flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-bold text-black">
                  التعليقات والمناقشات
                </h3>
                <p className="text-xs text-neutral-500 truncate max-w-xs">
                  {commentsModalLesson.title}
                </p>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => handleToggleLessonComments(commentsModalLesson.id)}
                    className={`px-2.5 py-1.5 rounded-xl text-[11px] font-semibold border transition-colors cursor-pointer flex items-center gap-1 ${
                      commentsModalLesson.commentsEnabled === false
                        ? 'bg-neutral-100 text-neutral-700 border-neutral-300 hover:bg-neutral-200'
                        : 'bg-black text-white border-black hover:bg-neutral-800'
                    }`}
                  >
                    {commentsModalLesson.commentsEnabled === false ? (
                      <>
                        <Lock className="w-3 h-3" />
                        <span>تشغيل التعليقات</span>
                      </>
                    ) : (
                      <>
                        <Lock className="w-3 h-3" />
                        <span>إيقاف التعليقات</span>
                      </>
                    )}
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setCommentsModalLesson(null)}
                  className="p-1.5 rounded-full hover:bg-neutral-100 text-neutral-400 hover:text-black transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Moderation Pending Notice for Visitor */}
            {commentPendingNotice && (
              <div className="px-4 py-2.5 bg-neutral-100 border-b border-neutral-200 text-xs text-black flex items-center gap-2 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 text-black shrink-0" />
                <span>{commentPendingNotice}</span>
              </div>
            )}

            {/* Comments Scrollable Body: Pinned Admin Comments Always First */}
            <div className="flex-1 p-4 overflow-y-auto space-y-3.5">
              {(() => {
                const allComments = commentsModalLesson.comments || [];
                const filtered = allComments.filter(c => isAdmin || c.isApproved || c.isAdmin);

                const sorted = [...filtered].sort((a, b) => {
                  const aIsAdmin = a.isAdmin || a.author === 'KAOUANE fares';
                  const bIsAdmin = b.isAdmin || b.author === 'KAOUANE fares';
                  if (aIsAdmin && !bIsAdmin) return -1;
                  if (!aIsAdmin && bIsAdmin) return 1;
                  if (isAdmin) {
                    const aPending = !a.isApproved && !a.isAdmin;
                    const bPending = !b.isApproved && !b.isAdmin;
                    if (aPending && !bPending) return -1;
                    if (!aPending && bPending) return 1;
                  }
                  return 0;
                });

                if (sorted.length === 0) {
                  return (
                    <div className="py-12 text-center text-neutral-400 text-xs">
                      <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-40 text-black" />
                      <p className="font-semibold text-neutral-800">لا توجد تعليقات معتمدة بعد</p>
                      <p className="text-[11px] mt-0.5 text-neutral-500">
                        {isAdmin ? 'لا توجد تعليقات في هذا المنشور' : 'كن أول من يطرح استفساره وسيقوم الأستاذ بالرد والموافقة'}
                      </p>
                    </div>
                  );
                }

                return sorted.map((comment) => {
                  const isCommentAdmin = comment.isAdmin || comment.author === 'KAOUANE fares';
                  const isPending = !comment.isApproved && !comment.isAdmin;

                  return (
                    <div 
                      key={comment.id} 
                      className={`flex items-start gap-3 text-xs p-3 rounded-2xl border transition-colors ${
                        isCommentAdmin 
                          ? 'bg-neutral-50 border-neutral-300' 
                          : isPending 
                            ? 'bg-neutral-100/70 border-dashed border-neutral-300' 
                            : 'bg-white border-neutral-200'
                      }`}
                    >
                      {/* Avatar */}
                      {isCommentAdmin ? (
                        <img
                          src={comment.avatarUrl || ADMIN_AVATAR_URL}
                          alt="KAOUANE fares"
                          className="w-8 h-8 rounded-full object-cover border border-neutral-200 shrink-0"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            if (target.src !== avatarAsset) {
                              target.src = avatarAsset;
                            } else {
                              target.src = 'https://i.ibb.co/whnGcQmw/1785099526878.jpg';
                            }
                          }}
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-neutral-100 border border-neutral-200 text-black flex items-center justify-center font-bold font-mono text-[11px] shrink-0">
                          {comment.author.includes('#') ? comment.author.split('#')[1]?.slice(0, 2) : 'زائر'}
                        </div>
                      )}

                      <div className="flex-1 space-y-1">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {/* 3. Clean Name KAOUANE fares (Verification badge removed) */}
                            <span className="font-bold text-black font-sans">
                              {comment.author}
                            </span>

                            {/* Pinned admin comment indicator */}
                            {isCommentAdmin && (
                              <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-black bg-neutral-200 px-1.5 py-0.2 rounded">
                                <Pin className="w-2.5 h-2.5 fill-black text-black" />
                                <span>مثبت</span>
                              </span>
                            )}

                            {/* Pending Review Badge (Admin view) */}
                            {isAdmin && isPending && (
                              <span className="text-[10px] font-semibold text-neutral-600 bg-neutral-200 px-1.5 py-0.2 rounded border border-neutral-300">
                                قيد المراجعة
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-neutral-400 font-mono text-[10px]">{comment.createdAt}</span>
                            {/* Admin Comment Deletion Capability (Full deletion permissions for any comment) */}
                            {isAdmin && (
                              <button
                                type="button"
                                onClick={() => handleDeleteComment(commentsModalLesson.id, comment.id)}
                                className="p-1 rounded-md text-neutral-400 hover:text-black hover:bg-neutral-200 transition-colors cursor-pointer"
                                title="حذف التعليق نهائياً"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        <p className="text-neutral-800 leading-relaxed text-xs">
                          {comment.text}
                        </p>

                        {/* Admin Moderation Actions for Visitor Comments */}
                        {isAdmin && !isCommentAdmin && (
                          <div className="pt-2 flex items-center gap-2 border-t border-neutral-200/60 mt-1.5">
                            {isPending && (
                              <button
                                type="button"
                                onClick={() => handleApproveComment(commentsModalLesson.id, comment.id)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-black text-white text-[11px] font-semibold hover:bg-neutral-800 transition-colors"
                                title="قبول ونشر التعليق"
                              >
                                <Check className="w-3 h-3 stroke-[2.5]" />
                                <span>قبول ونشر</span>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => handleDeleteComment(commentsModalLesson.id, comment.id)}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-neutral-500 hover:text-black hover:bg-neutral-200 transition-colors text-[11px]"
                              title="حذف التعليق"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>حذف</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>

            {/* Bottom Fixed Input Bar OR Disabled Comments Notice */}
            {commentsModalLesson.commentsEnabled === false && !isAdmin ? (
              <div className="p-4 border-t border-neutral-200 bg-neutral-50 flex items-center justify-center gap-2 text-xs font-semibold text-neutral-600">
                <Lock className="w-4 h-4 text-neutral-500 shrink-0" />
                <span>تم إيقاف التعليقات على هذا المنشور من طرف المدير</span>
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleAddComment(commentsModalLesson.id, modalCommentInput);
                  setModalCommentInput('');
                }}
                className="p-3 border-t border-neutral-200 bg-white space-y-2"
              >
                {commentsModalLesson.commentsEnabled === false && isAdmin && (
                  <div className="px-3 py-1.5 bg-neutral-100 border border-neutral-300 text-neutral-700 rounded-xl text-[11px] font-semibold flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 shrink-0" />
                    <span>التعليقات متوقفة للطلبة حالياً (يمكنك الرد كمسؤول أو إعادة تشغيلها)</span>
                  </div>
                )}

                {commentPendingNotice && (
                  <div className="px-3 py-2 bg-black text-white rounded-xl text-xs font-medium flex items-center gap-2 animate-in fade-in">
                    <CheckCircle2 className="w-4 h-4 text-white shrink-0" />
                    <span>{commentPendingNotice}</span>
                  </div>
                )}

                <div className="flex items-center justify-between text-[11px] text-neutral-500 px-1">
                  <span>
                    النشر بصفتك: <strong className="text-black">{isAdmin ? 'KAOUANE fares (أستاذ)' : `مجهول الهوية #${getSessionAnonId()}`}</strong>
                  </span>
                  {!isAdmin && (
                    <span className="text-neutral-400 text-[10px]">تخضع التعليقات لموافقة المدير</span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={modalCommentInput}
                    onChange={(e) => setModalCommentInput(e.target.value)}
                    placeholder={isAdmin ? "الرد بصفتك الأستاذ KAOUANE fares..." : "اكتب سؤالك أو استفسارك هنا..."}
                    className="flex-1 px-4 py-2.5 text-xs bg-neutral-50 border border-neutral-300 rounded-2xl focus:outline-none focus:ring-1 focus:ring-black focus:bg-white"
                  />
                  <button
                    type="submit"
                    disabled={!modalCommentInput.trim()}
                    className="p-2.5 bg-black hover:bg-neutral-800 disabled:opacity-40 text-white rounded-2xl transition-colors shrink-0 cursor-pointer"
                    title="إرسال"
                  >
                    <Send className="w-4 h-4 rotate-180" />
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* FULLSCREEN LIGHTBOX / CAROUSEL VIEWER (Monochrome) */}
      {lightboxImages && (
        <div 
          className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex flex-col justify-between pt-8 sm:pt-10 pb-5 px-4 sm:px-8"
          onClick={() => setLightboxImages(null)}
        >
          {/* Lightbox Top Bar with proper margins and safe-area padding */}
          <div 
            className="w-full flex items-center justify-between text-white pb-3 border-b border-white/10 shrink-0 select-none z-20"
            onClick={(e) => e.stopPropagation()}
            dir="rtl"
          >
            <div className="text-xs sm:text-sm font-mono text-neutral-300 truncate max-w-[50%]">
              {lightboxIndex + 1} / {lightboxImages.length} · {lightboxImages[lightboxIndex]?.name}
            </div>

            <div className="flex items-center gap-2 sm:gap-3 shrink-0" dir="ltr">
              {/* Individual Image Download */}
              <button
                type="button"
                disabled={Boolean(activeDownloadKeys[`lightbox-single:${lightboxIndex}`])}
                onClick={() =>
                  triggerDownload(
                    lightboxImages[lightboxIndex]?.url,
                    lightboxImages[lightboxIndex]?.name || `image_${lightboxIndex + 1}.jpg`,
                    `lightbox-single:${lightboxIndex}`
                  )
                }
                className="p-2 sm:p-2.5 px-3 rounded-xl bg-white/10 hover:bg-white/20 disabled:opacity-75 text-white text-xs flex items-center gap-1.5 transition-colors cursor-pointer disabled:cursor-wait border border-white/10"
                title="تحميل هذه الصورة"
              >
                {activeDownloadKeys[`lightbox-single:${lightboxIndex}`] ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="hidden sm:inline">جاري التحميل...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span className="hidden sm:inline">تحميل</span>
                  </>
                )}
              </button>

              {/* Multi-Image Bulk Download */}
              {lightboxImages.length > 1 && (
                <button
                  type="button"
                  disabled={Boolean(activeDownloadKeys['lightbox-all'])}
                  onClick={() => handleDownloadAllPostImages(lightboxImages, 'post_media', 'lightbox-all')}
                  className="p-2 sm:p-2.5 px-3 rounded-xl bg-white text-black hover:bg-neutral-200 disabled:opacity-75 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer disabled:cursor-wait shadow-xs"
                  title="تحميل كافة الصور"
                >
                  {activeDownloadKeys['lightbox-all'] ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="hidden sm:inline">جاري التحميل...</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      <span className="hidden sm:inline">تحميل الكل ({lightboxImages.length})</span>
                    </>
                  )}
                </button>
              )}

              {/* Prominent, Fully Visible Close Button */}
              <button
                type="button"
                onClick={() => setLightboxImages(null)}
                className="p-2 sm:p-2.5 rounded-xl bg-white/20 hover:bg-white/35 active:scale-95 text-white transition-all cursor-pointer border border-white/30 shadow-md flex items-center justify-center shrink-0 ml-1"
                title="إغلاق (Esc)"
                aria-label="إغلاق عارض الصور"
              >
                <X className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.5]" />
              </button>
            </div>
          </div>

          {/* Lightbox Center Image & Arrows */}
          <div 
            className="flex-1 relative flex items-center justify-center p-2 sm:p-6 select-none"
            onClick={(e) => e.stopPropagation()}
          >
            {lightboxImages.length > 1 && (
              <button
                type="button"
                onClick={handlePrevLightboxImage}
                className="absolute right-4 sm:right-8 z-10 p-3.5 rounded-full bg-white/15 hover:bg-white/30 text-white backdrop-blur-sm transition-transform hover:scale-105 cursor-pointer"
                title="الصورة السابقة"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            )}

            <CloudImage
              src={lightboxImages[lightboxIndex]?.url}
              alt={lightboxImages[lightboxIndex]?.name}
              className="max-h-[82vh] max-w-full object-contain rounded-2xl shadow-2xl transition-all duration-150"
            />

            {lightboxImages.length > 1 && (
              <button
                type="button"
                onClick={handleNextLightboxImage}
                className="absolute left-4 sm:left-8 z-10 p-3.5 rounded-full bg-white/15 hover:bg-white/30 text-white backdrop-blur-sm transition-transform hover:scale-105 cursor-pointer"
                title="الصورة التالية"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
            )}
          </div>

          {/* Lightbox Thumbnails Strip */}
          {lightboxImages.length > 1 && (
            <div 
              className="flex items-center justify-center gap-2 overflow-x-auto py-2"
              onClick={(e) => e.stopPropagation()}
            >
              {lightboxImages.map((img, i) => (
                <button
                  key={img.id}
                  type="button"
                  onClick={() => setLightboxIndex(i)}
                  className={`w-14 h-14 rounded-xl overflow-hidden border-2 transition-all shrink-0 cursor-pointer ${
                    i === lightboxIndex
                      ? 'border-white scale-105 shadow-md'
                      : 'border-transparent opacity-50 hover:opacity-100'
                  }`}
                >
                  <CloudImage src={img.url} alt={img.name} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MODAL 1: ADD MODULE WITH COVER IMAGE (Admin Only) */}
      {isAddModuleModalOpen && isAdmin && (
        <div 
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setIsAddModuleModalOpen(false)}
        >
          <div 
            className="bg-white rounded-3xl border border-neutral-200 w-full max-w-md p-6 sm:p-7 shadow-xl"
            onClick={(e) => e.stopPropagation()}
            dir="rtl"
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-bold text-black">
                إنشاء مقياس جديد ({selectedYear === 'first' ? 'السنة الأولى' : 'السنة الثانية'})
              </h3>
              <button
                type="button"
                onClick={() => setIsAddModuleModalOpen(false)}
                className="text-neutral-400 hover:text-black p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddModule} className="space-y-4">
              <div>
                <label htmlFor="module-name-input" className="block text-xs font-semibold text-neutral-800 mb-1.5">
                  اسم المقياس:
                </label>
                <input
                  id="module-name-input"
                  ref={moduleInputRef}
                  type="text"
                  value={newModuleName}
                  onChange={(e) => setNewModuleName(e.target.value)}
                  placeholder="اكتب اسم المقياس..."
                  className="w-full px-4 py-2.5 bg-neutral-50 border border-neutral-300 rounded-2xl text-sm text-black placeholder-neutral-400 focus:outline-none focus:ring-1 focus:ring-black focus:bg-white transition-all"
                />
              </div>

              {/* 5. Optional Cover Image Upload for Module (Fills the entire card) */}
              <div className="p-3.5 bg-neutral-50 rounded-2xl border border-neutral-200 space-y-2.5">
                <div className="flex items-center justify-between text-xs font-semibold text-neutral-800">
                  <div className="flex items-center gap-1.5">
                    <ImagePlus className="w-4 h-4 text-black" />
                    <span>صورة غلاف المقياس (تغطي البطاقة بالكامل)</span>
                  </div>
                  {newModuleThumbnailUrl && (
                    <button
                      type="button"
                      onClick={() => setNewModuleThumbnailUrl('')}
                      className="text-neutral-400 hover:text-black text-[11px]"
                    >
                      إزالة الصورة
                    </button>
                  )}
                </div>

                {newModuleThumbnailUrl ? (
                  <div className="relative w-full h-32 rounded-xl overflow-hidden border border-neutral-300">
                    <CloudImage 
                      src={newModuleThumbnailUrl} 
                      alt="غلاف المقياس" 
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-2 px-3.5 py-2 bg-white hover:bg-neutral-100 border border-neutral-300 rounded-xl text-xs font-semibold text-black cursor-pointer transition-colors shadow-2xs">
                      {isUploadingModuleThumbnail ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-black" />
                      ) : (
                        <Upload className="w-3.5 h-3.5 text-black" />
                      )}
                      <span>{isUploadingModuleThumbnail ? 'جاري رفع الغلاف...' : 'رفع صورة من الجهاز'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleModuleThumbnailFileChange}
                        disabled={isUploadingModuleThumbnail}
                        className="hidden"
                      />
                    </label>
                  </div>
                )}
                {moduleUploadError && (
                  <p className="text-[11px] text-red-600 font-medium">{moduleUploadError}</p>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsAddModuleModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-neutral-600 hover:bg-neutral-100 transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={!newModuleName.trim() || isUploadingModuleThumbnail}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-black hover:bg-neutral-800 disabled:opacity-40 transition-colors shadow-xs"
                >
                  إنشاء المقياس
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. MODAL 1.5: EDIT MODULE (Admin Only) */}
      {editingModule && isAdmin && (
        <div 
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setEditingModule(null)}
        >
          <div 
            className="bg-white rounded-3xl border border-neutral-200 w-full max-w-md p-6 sm:p-7 shadow-xl"
            onClick={(e) => e.stopPropagation()}
            dir="rtl"
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-bold text-black">
                تعديل بيانات المقياس والغلاف
              </h3>
              <button
                type="button"
                onClick={() => setEditingModule(null)}
                className="text-neutral-400 hover:text-black p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditedModule} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-800 mb-1.5">
                  اسم المقياس:
                </label>
                <input
                  type="text"
                  value={editModuleName}
                  onChange={(e) => setEditModuleName(e.target.value)}
                  required
                  placeholder="اسم المقياس..."
                  className="w-full px-4 py-2.5 bg-neutral-50 border border-neutral-300 rounded-2xl text-sm text-black placeholder-neutral-400 focus:outline-none focus:ring-1 focus:ring-black focus:bg-white transition-all"
                />
              </div>

              {/* Cover Image */}
              <div className="p-3.5 bg-neutral-50 rounded-2xl border border-neutral-200 space-y-2.5">
                <div className="flex items-center justify-between text-xs font-semibold text-neutral-800">
                  <div className="flex items-center gap-1.5">
                    <ImagePlus className="w-4 h-4 text-black" />
                    <span>صورة غلاف المقياس (تغطي البطاقة بالكامل)</span>
                  </div>
                  {editModuleThumbnailUrl && (
                    <button
                      type="button"
                      onClick={() => setEditModuleThumbnailUrl('')}
                      className="text-neutral-400 hover:text-black text-[11px]"
                    >
                      إزالة الغلاف
                    </button>
                  )}
                </div>

                {editModuleThumbnailUrl ? (
                  <div className="relative w-full h-32 rounded-xl overflow-hidden border border-neutral-300">
                    <CloudImage 
                      src={editModuleThumbnailUrl} 
                      alt="غلاف المقياس" 
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-2 px-3.5 py-2 bg-white hover:bg-neutral-100 border border-neutral-300 rounded-xl text-xs font-semibold text-black cursor-pointer transition-colors shadow-2xs">
                      {isUploadingEditModuleThumbnail ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-black" />
                      ) : (
                        <Upload className="w-3.5 h-3.5 text-black" />
                      )}
                      <span>{isUploadingEditModuleThumbnail ? 'جاري رفع الغلاف...' : 'رفع صورة غلاف جديدة'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleEditModuleThumbnailFileChange}
                        disabled={isUploadingEditModuleThumbnail}
                        className="hidden"
                      />
                    </label>
                  </div>
                )}
                {moduleUploadError && (
                  <p className="text-[11px] text-red-600 font-medium">{moduleUploadError}</p>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setEditingModule(null)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-neutral-600 hover:bg-neutral-100 transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={!editModuleName.trim() || isUploadingEditModuleThumbnail}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-black hover:bg-neutral-800 disabled:opacity-40 transition-colors shadow-xs"
                >
                  حفظ التعديلات
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: ADD LESSON OR ADMIN NEWS POST WITH MULTIPLE IMAGES & PDF UPLOADS (Admin Only) */}
      {isAddLessonModalOpen && (activeModule || isNewsView) && isAdmin && (
        <div 
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
          onClick={() => setIsAddLessonModalOpen(false)}
        >
          <div 
            className="bg-white rounded-3xl border border-neutral-200 w-full max-w-xl p-6 sm:p-7 shadow-xl my-8 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
            dir="rtl"
          >
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-neutral-200">
              <div>
                <h3 className="text-base font-bold text-black">
                  {isNewsView ? 'نشر خبر أو مستجدات جديدة' : 'نشر درس وموارد جديدة'}
                </h3>
                <span className="text-xs text-neutral-500">
                  {isNewsView
                    ? 'منشورات المدير — الأخبار وآخر المستجدات'
                    : `مقياس: ${activeModule?.name} (${selectedYear === 'first' ? 'السنة الأولى' : 'السنة الثانية'})`}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsAddLessonModalOpen(false)}
                className="text-neutral-400 hover:text-black p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddLesson} className="space-y-5">
              {/* Title */}
              <div>
                <label htmlFor="lesson-title-input" className="block text-xs font-semibold text-neutral-800 mb-1.5">
                  {isNewsView ? 'عنوان الخبر أو المنشور:' : 'عنوان الدرس أو المطبوعة:'}
                </label>
                <input
                  id="lesson-title-input"
                  ref={lessonTitleInputRef}
                  type="text"
                  value={newLessonTitle}
                  onChange={(e) => setNewLessonTitle(e.target.value)}
                  placeholder={isNewsView ? 'مثال: إعلان هام بخصوص رزنامة الامتحانات...' : 'مثال: مدخل إلى النقل الديداكتيكي، المحاضرة 1...'}
                  className="w-full px-4 py-2.5 bg-neutral-50 border border-neutral-300 rounded-2xl text-sm text-black placeholder-neutral-400 focus:outline-none focus:ring-1 focus:ring-black focus:bg-white"
                />
              </div>

              {/* Category / Type (Required) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-neutral-800">
                    {isNewsView ? 'تصنيف المنشور (مطلوب):' : 'فئة المنشور (مطلوب):'}
                  </label>
                  {!newLessonType && (
                    <span className="text-[11px] font-semibold text-red-600">
                      * يرجى اختيار الفئة
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {(isNewsView
                    ? ['خبر هام', 'مستجدات', 'إعلان إداري', 'توجيه بيداغوجي', 'تذكير']
                    : ['Cour', 'TD', 'تمارين']
                  ).map(type => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => {
                        setNewLessonType(type);
                        setLessonUploadError(null);
                      }}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                        newLessonType === type
                          ? 'bg-black text-white border-black shadow-2xs'
                          : 'bg-white text-neutral-700 border-neutral-300 hover:bg-neutral-100'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
                {!newLessonType && !isNewsView && (
                  <p className="text-[11px] text-neutral-500 mt-1.5">
                    اختر الفئة المناسبة للمنشور (Cour أو TD أو تمارين) ليتم فرزه للطلبة بدقة.
                  </p>
                )}
              </div>

              {/* Custom Publication Date & Time (Admin only) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="lesson-date-input" className="block text-xs font-semibold text-neutral-800 mb-1.5">
                    تاريخ النشر:
                  </label>
                  <input
                    id="lesson-date-input"
                    type="date"
                    value={newLessonDate}
                    onChange={(e) => setNewLessonDate(e.target.value)}
                    className="w-full px-4 py-2.5 bg-neutral-50 border border-neutral-300 rounded-2xl text-sm text-black focus:outline-none focus:ring-1 focus:ring-black focus:bg-white"
                  />
                </div>
                <div>
                  <label htmlFor="lesson-time-input" className="block text-xs font-semibold text-neutral-800 mb-1.5">
                    ساعة النشر:
                  </label>
                  <input
                    id="lesson-time-input"
                    type="time"
                    value={newLessonTime}
                    onChange={(e) => setNewLessonTime(e.target.value)}
                    className="w-full px-4 py-2.5 bg-neutral-50 border border-neutral-300 rounded-2xl text-sm text-black focus:outline-none focus:ring-1 focus:ring-black focus:bg-white"
                  />
                </div>
              </div>

              {/* Description (with dual ref capture for reliable mobile & IME saving) */}
              <div>
                <label htmlFor="lesson-desc-input" className="block text-xs font-semibold text-neutral-800 mb-1.5">
                  توصيف المحتوى والشرح (اختياري):
                </label>
                <textarea
                  id="lesson-desc-input"
                  ref={addLessonDescRef}
                  value={newLessonDescription}
                  onChange={(e) => setNewLessonDescription(e.target.value)}
                  onBlur={(e) => setNewLessonDescription(e.target.value)}
                  placeholder="اكتب توضيحات للطلبة أو محاور المحاضرة..."
                  rows={3}
                  dir="rtl"
                  className="w-full px-4 py-2.5 bg-neutral-50 border border-neutral-300 rounded-2xl text-sm text-black placeholder-neutral-400 focus:outline-none focus:ring-1 focus:ring-black focus:bg-white resize-y"
                />
              </div>

              {/* Comments Toggle on Publish (Defaults strictly to OFF) */}
              <button
                type="button"
                onClick={() => setNewLessonCommentsEnabled(prev => !prev)}
                className={`w-full flex items-center justify-between gap-3 px-4 py-2.5 rounded-2xl border text-xs font-semibold transition-colors cursor-pointer ${
                  newLessonCommentsEnabled
                    ? 'bg-neutral-50 text-black border-neutral-300 hover:bg-neutral-100'
                    : 'bg-neutral-100 text-neutral-600 border-neutral-300 hover:bg-neutral-200'
                }`}
              >
                <div className="flex items-center gap-2">
                  {newLessonCommentsEnabled ? (
                    <MessageCircle className="w-4 h-4 text-black" />
                  ) : (
                    <Lock className="w-4 h-4 text-neutral-600" />
                  )}
                  <span>إمكانية التعليق على هذا المنشور</span>
                </div>
                <span className={`px-2.5 py-0.5 rounded-lg text-[11px] font-bold ${newLessonCommentsEnabled ? 'bg-black text-white' : 'bg-white text-neutral-600 border border-neutral-300'}`}>
                  {newLessonCommentsEnabled ? 'مفعّلة' : 'مطفأة'}
                </span>
              </button>

              {/* Likes Growth Rate Control on Publish */}
              <div className="p-3.5 bg-neutral-50 rounded-2xl border border-neutral-200 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-black">
                    <SlidersHorizontal className="w-4 h-4 text-black" />
                    <span>معدل الإعجابات التلقائية لهذا المنشور</span>
                  </div>
                  <div className="flex items-center gap-1 bg-white p-0.5 rounded-xl border border-neutral-200 text-[11px] font-semibold">
                    <button
                      type="button"
                      onClick={() => setNewAutoLikesMode('default')}
                      className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                        newAutoLikesMode === 'default' ? 'bg-black text-white' : 'text-neutral-600 hover:text-black'
                      }`}
                    >
                      افتراضي
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewAutoLikesMode('custom')}
                      className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                        newAutoLikesMode === 'custom' ? 'bg-black text-white' : 'text-neutral-600 hover:text-black'
                      }`}
                    >
                      مخصص
                    </button>
                  </div>
                </div>

                {newAutoLikesMode === 'custom' && (
                  <div className="grid grid-cols-3 gap-2 pt-1">
                    <div>
                      <label className="block text-[11px] text-neutral-600 mb-1">عدد الإعجابات</label>
                      <input
                        type="number"
                        min={0}
                        value={newAutoLikesCount}
                        onChange={(e) => setNewAutoLikesCount(Math.max(0, Number(e.target.value) || 0))}
                        className="w-full px-3 py-1.5 bg-white border border-neutral-300 rounded-xl text-xs font-mono text-black focus:outline-none focus:ring-1 focus:ring-black"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-neutral-600 mb-1">كل</label>
                      <input
                        type="number"
                        min={1}
                        value={newAutoLikesInterval}
                        onChange={(e) => setNewAutoLikesInterval(Math.max(1, Number(e.target.value) || 1))}
                        className="w-full px-3 py-1.5 bg-white border border-neutral-300 rounded-xl text-xs font-mono text-black focus:outline-none focus:ring-1 focus:ring-black"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-neutral-600 mb-1">المدة الزمنية</label>
                      <select
                        value={newAutoLikesUnit}
                        onChange={(e) => setNewAutoLikesUnit(e.target.value as AutoLikesRateUnit)}
                        className="w-full px-2.5 py-1.5 bg-white border border-neutral-300 rounded-xl text-xs text-black focus:outline-none focus:ring-1 focus:ring-black"
                      >
                        <option value="minute">دقيقة</option>
                        <option value="hour">ساعة</option>
                        <option value="day">يوم</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* Multiple Images Upload */}
              <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-black">
                    <ImageIcon className="w-4 h-4 text-black" />
                    <span>إرفاق صور توضيحية متعددة</span>
                  </div>
                  <span className="text-[11px] text-neutral-500 font-mono">
                    {stagedImages.length} صور محددة
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 px-3.5 py-2 bg-white hover:bg-neutral-100 border border-neutral-300 rounded-xl text-xs font-semibold text-black cursor-pointer transition-colors shadow-2xs">
                    {isUploadingImages ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-black" />
                    ) : (
                      <Upload className="w-3.5 h-3.5 text-black" />
                    )}
                    <span>{isUploadingImages ? 'جاري رفع الصور...' : 'اختيار صور من الجهاز'}</span>
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={handleImageFileChange}
                      disabled={isUploadingImages}
                      className="hidden"
                    />
                  </label>
                </div>

                {stagedImages.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-2">
                    {stagedImages.map((img) => (
                      <div
                        key={img.id}
                        className="relative w-16 h-16 rounded-xl overflow-hidden border border-neutral-300 group"
                      >
                        <CloudImage src={img.url} alt={img.name} className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setStagedImages(prev => prev.filter(item => item.id !== img.id))}
                          className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* PDF Upload */}
              <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-black">
                    <FileUp className="w-4 h-4 text-black" />
                    <span>إرفاق ملفات ومستندات PDF</span>
                  </div>
                  <span className="text-[11px] text-neutral-500 font-mono">
                    {stagedPdfs.length} ملفات PDF
                  </span>
                </div>

                <div>
                  <label className="block text-[11px] text-neutral-600 mb-1">
                    رابط غلاف مخصص للمستند (اختياري):
                  </label>
                  <input
                    type="text"
                    value={customPdfCoverUrl}
                    onChange={(e) => setCustomPdfCoverUrl(e.target.value)}
                    placeholder="رابط صورة الغلاف (https://...)"
                    className="w-full px-3.5 py-1.5 text-xs bg-white border border-neutral-300 rounded-xl placeholder-neutral-400 focus:outline-none focus:ring-1 focus:ring-black"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 px-3.5 py-2 bg-white hover:bg-neutral-100 border border-neutral-300 rounded-xl text-xs font-semibold text-black cursor-pointer transition-colors shadow-2xs">
                    {isUploadingPdfs ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-black" />
                    ) : (
                      <Upload className="w-3.5 h-3.5 text-black" />
                    )}
                    <span>{isUploadingPdfs ? 'جاري رفع ملف PDF...' : 'اختيار ملف PDF من الجهاز'}</span>
                    <input
                      type="file"
                      multiple
                      accept="application/pdf,.pdf"
                      onChange={handlePdfFileChange}
                      disabled={isUploadingPdfs}
                      className="hidden"
                    />
                  </label>
                </div>

                {stagedPdfs.length > 0 && (
                  <div className="space-y-2 pt-2">
                    {stagedPdfs.map(pdf => (
                      <div
                        key={pdf.id}
                        className="flex items-center justify-between p-3 bg-white rounded-xl border border-neutral-200 text-xs"
                      >
                        <div className="flex items-center gap-2.5 truncate">
                          <FileText className="w-4 h-4 text-black shrink-0" />
                          <span className="font-mono text-black truncate">{pdf.name}</span>
                          <span className="text-neutral-400 text-[10px]">({pdf.size})</span>
                          {pdf.coverImageUrl && (
                            <span className="text-[10px] bg-neutral-100 text-neutral-700 px-1.5 py-0.5 rounded border border-neutral-300">
                              غلاف مخصص
                            </span>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => setStagedPdfs(prev => prev.filter(item => item.id !== pdf.id))}
                          className="text-neutral-400 hover:text-black p-1"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {lessonUploadError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-700 font-medium">
                  {lessonUploadError}
                </div>
              )}

              {/* Student Notification Toggle Button on Publish */}
              <button
                type="button"
                onClick={() => setNotifyStudentsOnPublish(prev => !prev)}
                className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-2xl border text-xs font-semibold transition-all cursor-pointer ${
                  notifyStudentsOnPublish
                    ? 'bg-black text-white border-black shadow-xs'
                    : 'bg-neutral-50 text-neutral-700 border-neutral-300 hover:bg-neutral-100'
                }`}
              >
                <div className="flex items-center gap-2.5 text-right min-w-0">
                  {notifyStudentsOnPublish ? (
                    <BellRing className="w-4 h-4 text-white shrink-0 animate-pulse" />
                  ) : (
                    <Bell className="w-4 h-4 text-neutral-600 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="font-bold">تفعيل إشعارات الطلبة</p>
                    <p className={`text-[11px] font-normal mt-0.5 ${notifyStudentsOnPublish ? 'text-neutral-300' : 'text-neutral-500'}`}>
                      {notifyStudentsOnPublish
                        ? 'مفعّل — سيصل إشعار فوري للطلبة عند نشر هذا المنشور'
                        : 'اضغط هنا لتفعيل إرسال إشعار للطلبة عند نشر المنشور'}
                    </p>
                  </div>
                </div>
                <span
                  className={`px-2.5 py-1 rounded-xl text-[11px] font-bold shrink-0 ${
                    notifyStudentsOnPublish
                      ? 'bg-white text-black'
                      : 'bg-white text-neutral-600 border border-neutral-300'
                  }`}
                >
                  {notifyStudentsOnPublish ? 'مفعّل' : 'غير مفعّل'}
                </span>
              </button>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-neutral-200">
                <button
                  type="button"
                  onClick={() => setIsAddLessonModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-neutral-600 hover:bg-neutral-100 transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={!newLessonTitle.trim() || !newLessonType.trim() || isUploadingImages || isUploadingPdfs || isSubmittingLesson}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-black hover:bg-neutral-800 disabled:opacity-40 transition-colors shadow-xs flex items-center gap-2 cursor-pointer"
                >
                  {isSubmittingLesson ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                      <span>جاري النشر...</span>
                    </>
                  ) : isUploadingImages || isUploadingPdfs ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                      <span>جاري رفع المرفقات...</span>
                    </>
                  ) : (
                    <span>{isNewsView ? 'نشر الخبر الآن' : 'نشر الدرس الآن'}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2.5: EDIT LESSON MODAL (Admin Only) */}
      {editingLesson && isAdmin && (
        <div 
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
          onClick={() => setEditingLesson(null)}
        >
          <div 
            className="bg-white rounded-3xl border border-neutral-200 w-full max-w-xl p-6 sm:p-7 shadow-xl my-8 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
            dir="rtl"
          >
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-neutral-200">
              <div>
                <h3 className="text-base font-bold text-black">
                  تعديل المنشور والموارد
                </h3>
                <span className="text-xs text-neutral-500">
                  تحديث بيانات الدرس والوسائط المرفقة
                </span>
              </div>
              <button
                type="button"
                onClick={() => setEditingLesson(null)}
                className="text-neutral-400 hover:text-black p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditedLesson} className="space-y-5">
              {/* Title */}
              <div>
                <label className="block text-xs font-semibold text-neutral-800 mb-1.5">
                  {isNewsView ? 'عنوان الخبر أو المنشور:' : 'عنوان الدرس:'}
                </label>
                <input
                  ref={editLessonTitleInputRef}
                  type="text"
                  value={editLessonTitle}
                  onChange={(e) => setEditLessonTitle(e.target.value)}
                  required
                  placeholder={isNewsView ? 'عنوان الخبر...' : 'عنوان الدرس...'}
                  className="w-full px-4 py-2.5 bg-neutral-50 border border-neutral-300 rounded-2xl text-sm text-black placeholder-neutral-400 focus:outline-none focus:ring-1 focus:ring-black focus:bg-white"
                />
              </div>

              {/* Type */}
              <div>
                <label className="block text-xs font-semibold text-neutral-800 mb-1.5">
                  {isNewsView ? 'تصنيف المنشور:' : 'فئة المنشور:'}
                </label>
                <div className="flex flex-wrap gap-2">
                  {(isNewsView
                    ? ['خبر هام', 'مستجدات', 'إعلان إداري', 'توجيه بيداغوجي', 'تذكير']
                    : ['Cour', 'TD', 'تمارين']
                  ).map(type => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setEditLessonType(type)}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                        editLessonType === type
                          ? 'bg-black text-white border-black'
                          : 'bg-white text-neutral-700 border-neutral-300 hover:bg-neutral-100'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Publication Date & Time (Admin only) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="edit-lesson-date-input" className="block text-xs font-semibold text-neutral-800 mb-1.5">
                    تاريخ النشر:
                  </label>
                  <input
                    id="edit-lesson-date-input"
                    type="date"
                    value={editLessonDate}
                    onChange={(e) => setEditLessonDate(e.target.value)}
                    className="w-full px-4 py-2.5 bg-neutral-50 border border-neutral-300 rounded-2xl text-sm text-black focus:outline-none focus:ring-1 focus:ring-black focus:bg-white"
                  />
                </div>
                <div>
                  <label htmlFor="edit-lesson-time-input" className="block text-xs font-semibold text-neutral-800 mb-1.5">
                    ساعة النشر:
                  </label>
                  <input
                    id="edit-lesson-time-input"
                    type="time"
                    value={editLessonTime}
                    onChange={(e) => setEditLessonTime(e.target.value)}
                    className="w-full px-4 py-2.5 bg-neutral-50 border border-neutral-300 rounded-2xl text-sm text-black focus:outline-none focus:ring-1 focus:ring-black focus:bg-white"
                  />
                </div>
              </div>

              {/* Description (with dual ref capture for guaranteed persistence) */}
              <div>
                <label htmlFor="edit-lesson-desc-input" className="block text-xs font-semibold text-neutral-800 mb-1.5">
                  توصيف المحتوى والشرح:
                </label>
                <textarea
                  id="edit-lesson-desc-input"
                  ref={editLessonDescRef}
                  value={editLessonDescription}
                  onChange={(e) => setEditLessonDescription(e.target.value)}
                  onBlur={(e) => setEditLessonDescription(e.target.value)}
                  rows={3}
                  dir="rtl"
                  placeholder="اكتب وصف المنشور..."
                  className="w-full px-4 py-2.5 bg-neutral-50 border border-neutral-300 rounded-2xl text-sm text-black placeholder-neutral-400 focus:outline-none focus:ring-1 focus:ring-black focus:bg-white resize-y"
                />
              </div>

              {/* Comments Toggle inside Edit Modal */}
              <button
                type="button"
                onClick={() => setEditLessonCommentsEnabled(prev => !prev)}
                className={`w-full flex items-center justify-between gap-3 px-4 py-2.5 rounded-2xl border text-xs font-semibold transition-colors cursor-pointer ${
                  editLessonCommentsEnabled
                    ? 'bg-neutral-50 text-black border-neutral-300 hover:bg-neutral-100'
                    : 'bg-neutral-100 text-neutral-600 border-neutral-300 hover:bg-neutral-200'
                }`}
              >
                <div className="flex items-center gap-2">
                  {editLessonCommentsEnabled ? (
                    <MessageCircle className="w-4 h-4 text-black" />
                  ) : (
                    <Lock className="w-4 h-4 text-neutral-600" />
                  )}
                  <span>إمكانية التعليق على هذا المنشور</span>
                </div>
                <span className={`px-2.5 py-0.5 rounded-lg text-[11px] font-bold ${editLessonCommentsEnabled ? 'bg-black text-white' : 'bg-white text-neutral-600 border border-neutral-300'}`}>
                  {editLessonCommentsEnabled ? 'مفعّلة' : 'مطفأة'}
                </span>
              </button>

              {/* Likes Growth Rate Control inside Edit Modal */}
              <div className="p-3.5 bg-neutral-50 rounded-2xl border border-neutral-200 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-black">
                    <SlidersHorizontal className="w-4 h-4 text-black" />
                    <span>معدل الإعجابات التلقائية</span>
                  </div>
                  <div className="flex items-center gap-1 bg-white p-0.5 rounded-xl border border-neutral-200 text-[11px] font-semibold">
                    <button
                      type="button"
                      onClick={() => setEditAutoLikesMode('default')}
                      className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                        editAutoLikesMode === 'default' ? 'bg-black text-white' : 'text-neutral-600 hover:text-black'
                      }`}
                    >
                      افتراضي
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditAutoLikesMode('custom')}
                      className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                        editAutoLikesMode === 'custom' ? 'bg-black text-white' : 'text-neutral-600 hover:text-black'
                      }`}
                    >
                      مخصص
                    </button>
                  </div>
                </div>

                {editAutoLikesMode === 'custom' && (
                  <div className="grid grid-cols-3 gap-2 pt-1">
                    <div>
                      <label className="block text-[11px] text-neutral-600 mb-1">عدد الإعجابات</label>
                      <input
                        type="number"
                        min={0}
                        value={editAutoLikesCount}
                        onChange={(e) => setEditAutoLikesCount(Math.max(0, Number(e.target.value) || 0))}
                        className="w-full px-3 py-1.5 bg-white border border-neutral-300 rounded-xl text-xs font-mono text-black focus:outline-none focus:ring-1 focus:ring-black"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-neutral-600 mb-1">كل</label>
                      <input
                        type="number"
                        min={1}
                        value={editAutoLikesInterval}
                        onChange={(e) => setEditAutoLikesInterval(Math.max(1, Number(e.target.value) || 1))}
                        className="w-full px-3 py-1.5 bg-white border border-neutral-300 rounded-xl text-xs font-mono text-black focus:outline-none focus:ring-1 focus:ring-black"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-neutral-600 mb-1">المدة الزمنية</label>
                      <select
                        value={editAutoLikesUnit}
                        onChange={(e) => setEditAutoLikesUnit(e.target.value as AutoLikesRateUnit)}
                        className="w-full px-2.5 py-1.5 bg-white border border-neutral-300 rounded-xl text-xs text-black focus:outline-none focus:ring-1 focus:ring-black"
                      >
                        <option value="minute">دقيقة</option>
                        <option value="hour">ساعة</option>
                        <option value="day">يوم</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* Manage Attached Images */}
              <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-black">
                    <ImageIcon className="w-4 h-4 text-black" />
                    <span>الصور المرفقة ({editStagedImages.length})</span>
                  </div>
                  <label className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-neutral-100 border border-neutral-300 rounded-xl text-xs font-semibold text-black cursor-pointer transition-colors shadow-2xs">
                    {isUploadingEditImages ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-black" />
                    ) : (
                      <Upload className="w-3.5 h-3.5 text-black" />
                    )}
                    <span>إضافة صور</span>
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={handleEditImageFileChange}
                      disabled={isUploadingEditImages}
                      className="hidden"
                    />
                  </label>
                </div>

                {editStagedImages.length > 0 ? (
                  <div className="flex flex-wrap gap-2 pt-2">
                    {editStagedImages.map((img) => (
                      <div
                        key={img.id}
                        className="relative w-16 h-16 rounded-xl overflow-hidden border border-neutral-300 group"
                      >
                        <CloudImage src={img.url} alt={img.name} className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setEditStagedImages(prev => prev.filter(item => item.id !== img.id))}
                          className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity"
                          title="حذف الصورة"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-neutral-400 text-center py-2">لا توجد صور مرفقة في هذا المنشور</p>
                )}
              </div>

              {/* Manage Attached PDFs */}
              <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-black">
                    <FileUp className="w-4 h-4 text-black" />
                    <span>ملفات PDF المرفقة ({editStagedPdfs.length})</span>
                  </div>
                  <label className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-neutral-100 border border-neutral-300 rounded-xl text-xs font-semibold text-black cursor-pointer transition-colors shadow-2xs">
                    {isUploadingEditPdfs ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-black" />
                    ) : (
                      <Upload className="w-3.5 h-3.5 text-black" />
                    )}
                    <span>{isUploadingEditPdfs ? 'جاري رفع PDF...' : 'إضافة PDF'}</span>
                    <input
                      type="file"
                      multiple
                      accept="application/pdf,.pdf"
                      onChange={handleEditPdfFileChange}
                      disabled={isUploadingEditPdfs}
                      className="hidden"
                    />
                  </label>
                </div>

                {editStagedPdfs.length > 0 ? (
                  <div className="space-y-2 pt-2">
                    {editStagedPdfs.map(pdf => (
                      <div
                        key={pdf.id}
                        className="flex items-center justify-between p-3 bg-white rounded-xl border border-neutral-200 text-xs"
                      >
                        <div className="flex items-center gap-2.5 truncate">
                          <FileText className="w-4 h-4 text-black shrink-0" />
                          <span className="font-mono text-black truncate">{pdf.name}</span>
                          <span className="text-neutral-400 text-[10px]">({pdf.size})</span>
                        </div>

                        <button
                          type="button"
                          onClick={() => setEditStagedPdfs(prev => prev.filter(item => item.id !== pdf.id))}
                          className="text-neutral-400 hover:text-black p-1"
                          title="حذف الملف"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-neutral-400 text-center py-2">لا توجد ملفات PDF مرفقة</p>
                )}
              </div>

              {editLessonUploadError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-700 font-medium">
                  {editLessonUploadError}
                </div>
              )}

              {/* Student Notification Status & Removal / Activation in Edit Modal */}
              <div className="p-3.5 bg-neutral-50 rounded-2xl border border-neutral-200 flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex items-center gap-2 min-w-0">
                  {activeStudentNotif?.id === String(editingLesson.id) ? (
                    <BellRing className="w-4 h-4 text-black shrink-0" />
                  ) : (
                    <Bell className="w-4 h-4 text-neutral-500 shrink-0" />
                  )}
                  <span className="text-xs font-semibold text-black">
                    {activeStudentNotif?.id === String(editingLesson.id)
                      ? 'إشعار الطلبة مفعّل حالياً لهذا المنشور'
                      : 'إشعار الطلبة غير مفعّل لهذا المنشور'}
                  </span>
                </div>

                {activeStudentNotif?.id === String(editingLesson.id) ? (
                  <button
                    type="button"
                    onClick={handleClearActivePostNotification}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <BellOff className="w-3.5 h-3.5" />
                    <span>نزع إشعار المنشور</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleActivatePostNotification(editingLesson)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black hover:bg-neutral-800 text-white text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <Bell className="w-3.5 h-3.5" />
                    <span>تفعيل إشعار المنشور</span>
                  </button>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-neutral-200">
                <button
                  type="button"
                  onClick={() => setEditingLesson(null)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-neutral-600 hover:bg-neutral-100 transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={!editLessonTitle.trim() || isUploadingEditImages || isUploadingEditPdfs || isSavingEditLesson}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-black hover:bg-neutral-800 disabled:opacity-40 transition-colors shadow-xs flex items-center gap-2 cursor-pointer"
                >
                  {isSavingEditLesson ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                      <span>جاري الحفظ...</span>
                    </>
                  ) : (
                    <span>حفظ التعديلات</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: FIRST-TIME ADMIN SETUP (7-Tap Trigger) */}
      {isAdminSetupModalOpen && (
        <div 
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setIsAdminSetupModalOpen(false)}
        >
          <div 
            className="bg-white rounded-3xl border border-neutral-200 w-full max-w-md p-6 sm:p-7 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            dir="rtl"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-black text-white flex items-center justify-center">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-black">
                  إعداد حساب المسؤول الرئيسي (Admin)
                </h3>
                <p className="text-xs text-neutral-500">
                  يُسمح بإنشاء حساب مسؤول واحد فقط للمنصة.
                </p>
              </div>
            </div>

            {adminAuthError && (
              <div className="mb-4 p-3 bg-neutral-100 border border-neutral-300 text-black text-xs rounded-xl">
                {adminAuthError}
              </div>
            )}

            <form onSubmit={handleCreateAdminAccount} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-800 mb-1">
                  اسم المستخدم أو البريد الإلكتروني:
                </label>
                <input
                  type="text"
                  value={adminUsernameInput}
                  onChange={(e) => setAdminUsernameInput(e.target.value)}
                  placeholder="admin"
                  required
                  className="w-full px-4 py-2.5 bg-neutral-50 border border-neutral-300 rounded-2xl text-sm focus:outline-none focus:ring-1 focus:ring-black"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-800 mb-1">
                  كلمة المرور السرية:
                </label>
                <input
                  type="password"
                  value={adminPasswordInput}
                  onChange={(e) => setAdminPasswordInput(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full px-4 py-2.5 bg-neutral-50 border border-neutral-300 rounded-2xl text-sm focus:outline-none focus:ring-1 focus:ring-black"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsAdminSetupModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-neutral-600 hover:bg-neutral-100"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={adminAuthLoading}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-black hover:bg-neutral-800 disabled:opacity-50 flex items-center gap-2"
                >
                  {adminAuthLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>تثبيت حساب المسؤول الوحيد</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: ADMIN LOGIN DIALOG (7-Tap Trigger) */}
      {isAdminLoginModalOpen && (
        <div 
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setIsAdminLoginModalOpen(false)}
        >
          <div 
            className="bg-white rounded-3xl border border-neutral-200 w-full max-w-md p-6 sm:p-7 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            dir="rtl"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-black text-white flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-black">
                    تسجيل دخول المسؤول (Admin)
                  </h3>
                  <p className="text-xs text-neutral-500">
                    أدخل بيانات المسؤول لفك قفل الصلاحيات
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsAdminLoginModalOpen(false)}
                className="text-neutral-400 hover:text-black p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {adminAuthError && (
              <div className="mb-4 p-3 bg-neutral-100 border border-neutral-300 text-black text-xs rounded-xl">
                {adminAuthError}
              </div>
            )}

            <form onSubmit={handleAdminLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-800 mb-1">
                  اسم المستخدم أو البريد:
                </label>
                <input
                  type="text"
                  value={adminUsernameInput}
                  onChange={(e) => setAdminUsernameInput(e.target.value)}
                  placeholder="اسم المستخدم..."
                  required
                  className="w-full px-4 py-2.5 bg-neutral-50 border border-neutral-300 rounded-2xl text-sm focus:outline-none focus:ring-1 focus:ring-black"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-800 mb-1">
                  كلمة المرور:
                </label>
                <input
                  type="password"
                  value={adminPasswordInput}
                  onChange={(e) => setAdminPasswordInput(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full px-4 py-2.5 bg-neutral-50 border border-neutral-300 rounded-2xl text-sm focus:outline-none focus:ring-1 focus:ring-black"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsAdminLoginModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-neutral-600 hover:bg-neutral-100"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={adminAuthLoading}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-black hover:bg-neutral-800 disabled:opacity-50 flex items-center gap-2"
                >
                  {adminAuthLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>تسجيل الدخول وفك القفل</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* FLOATING REAL-TIME STUDENT NOTIFICATION TOAST */}
      {incomingStudentNotif && !isAdmin && (
        <div
          className="fixed bottom-4 left-3 right-3 sm:left-auto sm:right-6 sm:w-96 z-50 bg-black text-white rounded-2xl p-4 shadow-2xl border border-neutral-800 animate-in fade-in slide-in-from-bottom-4 duration-200"
          dir="rtl"
        >
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-white text-black flex items-center justify-center shrink-0 mt-0.5">
              <BellRing className="w-4 h-4" />
            </div>

            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold text-neutral-300 truncate">
                  {incomingStudentNotif.targetType === 'news'
                    ? 'إشعار جديد · أخبار المدير'
                    : `إشعار جديد · ${incomingStudentNotif.moduleName || 'مقياس دراسي'}`}
                </span>
                <button
                  type="button"
                  onClick={() => handleDismissStudentNotif(incomingStudentNotif.id)}
                  className="text-neutral-400 hover:text-white p-0.5 rounded-lg transition-colors cursor-pointer shrink-0"
                  title="إغلاق الإشعار"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <h4 className="text-xs sm:text-sm font-bold text-white leading-snug truncate">
                {incomingStudentNotif.title}
              </h4>

              {incomingStudentNotif.body && (
                <p className="text-[11px] text-neutral-300 line-clamp-2 leading-relaxed">
                  {incomingStudentNotif.body}
                </p>
              )}

              <div className="flex items-center flex-wrap gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => handleOpenNotifiedPost(incomingStudentNotif)}
                  className="px-3 py-1.5 rounded-xl bg-white hover:bg-neutral-200 text-black text-[11px] font-bold transition-colors cursor-pointer"
                >
                  عرض المنشور
                </button>

                {notifPermission === 'default' && (
                  <button
                    type="button"
                    onClick={handleRequestBrowserNotifications}
                    className="px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white border border-neutral-700 text-[11px] font-medium transition-colors cursor-pointer"
                  >
                    تفعيل تنبيهات المتصفح
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: ANNOUNCEMENT BANNER MANAGEMENT (Admin Only) */}
      {isBannerAdminModalOpen && isAdmin && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
          onClick={() => setIsBannerAdminModalOpen(false)}
        >
          <div
            className="bg-white rounded-3xl border border-neutral-200 w-full max-w-lg p-6 sm:p-7 shadow-2xl my-8 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
            dir="rtl"
          >
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-neutral-200">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-black text-white flex items-center justify-center">
                  <Megaphone className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-black">إدارة شريط الإعلانات التلقائي</h3>
                  <p className="text-xs text-neutral-500">يظهر بين أزرار السنوات وشبكة المقاييس مع حماية الصور</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsBannerAdminModalOpen(false)}
                className="text-neutral-400 hover:text-black p-1 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveBannerConfig} className="space-y-4">
              {/* Toggle Banner Visibility */}
              <button
                type="button"
                onClick={() => setDraftBannerEnabled(prev => !prev)}
                className={`w-full flex items-center justify-between px-4 py-2.5 rounded-2xl border text-xs font-semibold transition-colors cursor-pointer ${
                  draftBannerEnabled
                    ? 'bg-neutral-50 text-black border-neutral-300'
                    : 'bg-neutral-100 text-neutral-600 border-neutral-300'
                }`}
              >
                <span>تفعيل عرض شريط الإعلانات للطلبة</span>
                <span className={`px-2.5 py-0.5 rounded-lg text-[11px] font-bold ${draftBannerEnabled ? 'bg-black text-white' : 'bg-white text-neutral-600 border border-neutral-300'}`}>
                  {draftBannerEnabled ? 'مفعّل' : 'مخفي'}
                </span>
              </button>

              {/* Interval Seconds Control */}
              <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-200 space-y-2.5">
                <label htmlFor="banner-interval-input" className="block text-xs font-bold text-black">
                  مدة تبديل كل صورة (بالثواني):
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="banner-interval-input"
                    type="number"
                    min={1}
                    max={120}
                    value={draftBannerInterval}
                    onChange={(e) => setDraftBannerInterval(Math.max(1, Math.min(120, Number(e.target.value) || 1)))}
                    className="w-24 px-3 py-2 bg-white border border-neutral-300 rounded-xl text-sm font-mono font-bold text-black focus:outline-none focus:ring-1 focus:ring-black"
                  />
                  <span className="text-xs text-neutral-600 font-semibold">ثانية</span>
                  <div className="flex items-center gap-1 mr-auto">
                    {[3, 4, 5, 8, 10].map(sec => (
                      <button
                        key={sec}
                        type="button"
                        onClick={() => setDraftBannerInterval(sec)}
                        className={`px-2 py-1 rounded-lg text-[11px] font-mono font-semibold border cursor-pointer ${
                          draftBannerInterval === sec
                            ? 'bg-black text-white border-black'
                            : 'bg-white text-neutral-700 border-neutral-300 hover:bg-neutral-100'
                        }`}
                      >
                        {sec}ث
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Upload Banner Images */}
              <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-black">صور الإعلانات ({draftBannerImages.length})</span>
                  <label className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-neutral-100 border border-neutral-300 rounded-xl text-xs font-semibold text-black cursor-pointer transition-colors shadow-2xs">
                    {isUploadingBannerImage ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-black" />
                    ) : (
                      <Upload className="w-3.5 h-3.5 text-black" />
                    )}
                    <span>{isUploadingBannerImage ? 'جاري الرفع...' : 'إضافة صور إعلانية'}</span>
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={handleBannerImageUpload}
                      disabled={isUploadingBannerImage}
                      className="hidden"
                    />
                  </label>
                </div>

                {draftBannerImages.length > 0 ? (
                  <div className="space-y-2">
                    {draftBannerImages.map((img, idx) => (
                      <div key={img.id} className="flex items-center justify-between gap-2.5 p-2 bg-white rounded-xl border border-neutral-200">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-16 h-10 rounded-lg overflow-hidden border border-neutral-200 shrink-0 bg-neutral-100">
                            <CloudImage src={img.url} alt={img.name} className="w-full h-full object-cover" />
                          </div>
                          <span className="text-xs font-medium text-black truncate">
                            {idx + 1}. {img.name || 'إعلان'}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setDraftBannerImages(prev => prev.filter(item => item.id !== img.id))}
                          className="p-1.5 rounded-lg text-neutral-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer shrink-0"
                          title="حذف الصورة"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-neutral-500 text-center py-3">لم يتم إضافة أي صور إعلانية بعد</p>
                )}
              </div>

              {bannerError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-700 font-medium">
                  {bannerError}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-neutral-200">
                <button
                  type="button"
                  onClick={() => setIsBannerAdminModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-neutral-600 hover:bg-neutral-100 cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isUploadingBannerImage || isSavingBanner}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-black hover:bg-neutral-800 disabled:opacity-40 flex items-center gap-2 cursor-pointer shadow-xs"
                >
                  {isSavingBanner && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>حفظ شريط الإعلانات</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 6: SINGLE OR MULTI-POST LIKES RATE & AMOUNT CONTROL (Admin Only) */}
      {likesControlLesson && isAdmin && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setLikesControlLesson(null)}
        >
          <div
            className="bg-white rounded-3xl border border-neutral-200 w-full max-w-lg max-h-[90vh] overflow-y-auto p-5 sm:p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            dir="rtl"
          >
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-neutral-200">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-black text-white flex items-center justify-center shrink-0">
                  <Heart className="w-4 h-4 fill-white" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm sm:text-base font-bold text-black truncate">التحكم بتفاعلات المنشورات</h3>
                  <p className="text-[11px] text-neutral-500 truncate">
                    {selectedLikesPostIds.length > 1
                      ? `محدد ${selectedLikesPostIds.length} منشورات للتطبيق الجماعي`
                      : likesControlLesson.title}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setLikesControlLesson(null)}
                className="text-neutral-400 hover:text-black p-1 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSavePostLikesRate} className="space-y-4">
              {/* Target Post Selector: Single, Multiple, or All Posts in Active Feed */}
              <div className="p-3.5 bg-neutral-50 rounded-2xl border border-neutral-200 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-black">
                    تطبيق على المنشورات ({selectedLikesPostIds.length}/{activeFeedLessons.length}):
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setSelectedLikesPostIds(activeFeedLessons.map(l => String(l.id)))}
                      className="px-2.5 py-1 rounded-lg bg-white hover:bg-neutral-100 border border-neutral-300 text-[11px] font-semibold text-black cursor-pointer"
                    >
                      تحديد الكل
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedLikesPostIds([])}
                      className="px-2.5 py-1 rounded-lg bg-white hover:bg-neutral-100 border border-neutral-300 text-[11px] font-semibold text-neutral-600 cursor-pointer"
                    >
                      إلغاء الكل
                    </button>
                  </div>
                </div>

                <div className="max-h-36 overflow-y-auto space-y-1.5 pr-0.5">
                  {[...activeFeedLessons]
                    .sort((a, b) => {
                      const aPin = a.isPinned ? 1 : 0;
                      const bPin = b.isPinned ? 1 : 0;
                      if (aPin !== bPin) return bPin - aPin;
                      return (b.timestamp || 0) - (a.timestamp || 0);
                    })
                    .map(post => {
                      const postIdStr = String(post.id);
                      const isSelected = selectedLikesPostIds.includes(postIdStr);
                      return (
                        <label
                          key={postIdStr}
                          className={`flex items-center justify-between gap-2.5 px-3 py-2 rounded-xl border text-xs cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-white border-black text-black shadow-2xs'
                              : 'bg-neutral-100/70 border-neutral-200 text-neutral-600 hover:bg-white'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {
                                setSelectedLikesPostIds(prev =>
                                  prev.includes(postIdStr)
                                    ? prev.filter(id => id !== postIdStr)
                                    : [...prev, postIdStr]
                                );
                              }}
                              className="w-4 h-4 accent-black rounded cursor-pointer shrink-0"
                            />
                            <span className="truncate font-semibold">{post.title}</span>
                          </div>
                          <span className="text-[11px] font-mono text-neutral-500 shrink-0 tabular-nums">
                            {post.likesCount || 0} ❤
                          </span>
                        </label>
                      );
                    })}
                </div>
              </div>

              {/* Direct Immediate Likes Adjustment (+/-) */}
              <div className="p-3.5 bg-neutral-50 rounded-2xl border border-neutral-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-black">تعديل فوري للإعجابات الحالية:</span>
                  <span className="text-xs font-mono font-bold text-black" dir="ltr">
                    {ctrlLikesDelta > 0 ? `+${ctrlLikesDelta}` : ctrlLikesDelta}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {[-10, -5, -1, 0, 1, 5, 10].map(val => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setCtrlLikesDelta(prev => (val === 0 ? 0 : prev + val))}
                      className={`px-2.5 py-1 rounded-lg border text-[11px] font-mono font-bold cursor-pointer transition-colors ${
                        val === 0
                          ? 'bg-white text-neutral-600 border-neutral-300 hover:bg-neutral-100'
                          : 'bg-white text-black border-neutral-300 hover:bg-black hover:text-white'
                      }`}
                      dir="ltr"
                    >
                      {val === 0 ? 'تصفير' : val > 0 ? `+${val}` : val}
                    </button>
                  ))}
                  <input
                    type="number"
                    value={ctrlLikesDelta}
                    onChange={(e) => setCtrlLikesDelta(parseInt(e.target.value, 10) || 0)}
                    className="w-20 px-2.5 py-1 bg-white border border-neutral-300 rounded-lg text-xs font-mono font-bold text-black text-center focus:outline-none focus:ring-1 focus:ring-black"
                    dir="ltr"
                  />
                </div>
              </div>

              {/* Toggle Automated Growth ON/OFF */}
              <button
                type="button"
                onClick={() => setCtrlLikesEnabled(prev => !prev)}
                className={`w-full flex items-center justify-between px-4 py-2.5 rounded-2xl border text-xs font-semibold transition-colors cursor-pointer ${
                  ctrlLikesEnabled
                    ? 'bg-neutral-50 text-black border-neutral-300'
                    : 'bg-neutral-100 text-neutral-600 border-neutral-300'
                }`}
              >
                <span>تشغيل النمو التلقائي للإعجابات</span>
                <span className={`px-2.5 py-0.5 rounded-lg text-[11px] font-bold ${ctrlLikesEnabled ? 'bg-black text-white' : 'bg-white text-neutral-600 border border-neutral-300'}`}>
                  {ctrlLikesEnabled ? 'نشط' : 'متوقف'}
                </span>
              </button>

              {/* Mode Selector */}
              <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-black">نمط الزيادة:</span>
                  <div className="flex items-center gap-1 bg-white p-0.5 rounded-xl border border-neutral-200 text-[11px] font-semibold">
                    <button
                      type="button"
                      onClick={() => setCtrlLikesMode('default')}
                      className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                        ctrlLikesMode === 'default' ? 'bg-black text-white' : 'text-neutral-600 hover:text-black'
                      }`}
                    >
                      تلقائي افتراضي
                    </button>
                    <button
                      type="button"
                      onClick={() => setCtrlLikesMode('custom')}
                      className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                        ctrlLikesMode === 'custom' ? 'bg-black text-white' : 'text-neutral-600 hover:text-black'
                      }`}
                    >
                      معدل مخصص
                    </button>
                  </div>
                </div>

                {ctrlLikesMode === 'custom' ? (
                  <div className="space-y-3 pt-1">
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-[11px] text-neutral-600 mb-1">عدد الإعجابات</label>
                        <input
                          type="number"
                          min={0}
                          value={ctrlLikesCount}
                          onChange={(e) => setCtrlLikesCount(Math.max(0, Number(e.target.value) || 0))}
                          className="w-full px-3 py-2 bg-white border border-neutral-300 rounded-xl text-xs font-mono font-bold text-black focus:outline-none focus:ring-1 focus:ring-black"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-neutral-600 mb-1">كل</label>
                        <input
                          type="number"
                          min={1}
                          value={ctrlLikesInterval}
                          onChange={(e) => setCtrlLikesInterval(Math.max(1, Number(e.target.value) || 1))}
                          className="w-full px-3 py-2 bg-white border border-neutral-300 rounded-xl text-xs font-mono font-bold text-black focus:outline-none focus:ring-1 focus:ring-black"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-neutral-600 mb-1">الوحدة</label>
                        <select
                          value={ctrlLikesUnit}
                          onChange={(e) => setCtrlLikesUnit(e.target.value as AutoLikesRateUnit)}
                          className="w-full px-2.5 py-2 bg-white border border-neutral-300 rounded-xl text-xs text-black focus:outline-none focus:ring-1 focus:ring-black"
                        >
                          <option value="minute">دقيقة</option>
                          <option value="hour">ساعة</option>
                          <option value="day">يوم</option>
                        </select>
                      </div>
                    </div>

                    {/* Quick Rate Presets */}
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { label: '+2 / دقيقة', count: 2, interval: 1, unit: 'minute' as const },
                        { label: '+5 / دقيقة', count: 5, interval: 1, unit: 'minute' as const },
                        { label: '+10 / ساعة', count: 10, interval: 1, unit: 'hour' as const },
                        { label: '+30 / ساعة', count: 30, interval: 1, unit: 'hour' as const },
                        { label: '+100 / يوم', count: 100, interval: 1, unit: 'day' as const },
                      ].map(preset => (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => {
                            setCtrlLikesCount(preset.count);
                            setCtrlLikesInterval(preset.interval);
                            setCtrlLikesUnit(preset.unit);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-white hover:bg-neutral-100 border border-neutral-300 text-[11px] font-semibold text-black cursor-pointer"
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>

                    <p className="text-[11px] text-neutral-600 leading-relaxed">
                      المعدل التقريبي: <span className="font-bold text-black">~{ctrlLikesCount} إعجاب كل {ctrlLikesInterval} {ctrlLikesUnit === 'minute' ? 'دقيقة' : ctrlLikesUnit === 'hour' ? 'ساعة' : 'يوم'}</span> — تتوزع الزيادة بشكل عشوائي غير منتظم ومتباين بين المنشورات.
                    </p>
                  </div>
                ) : (
                  <p className="text-[11px] text-neutral-500">
                    يعمل وفق المنحنى العشوائي الافتراضي للمنصة.
                  </p>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-neutral-200">
                <button
                  type="button"
                  onClick={() => setLikesControlLesson(null)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-neutral-600 hover:bg-neutral-100 cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSavingLikesRate || selectedLikesPostIds.length === 0}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-black hover:bg-neutral-800 disabled:opacity-40 flex items-center gap-2 cursor-pointer shadow-xs"
                >
                  {isSavingLikesRate && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>
                    {selectedLikesPostIds.length > 1
                      ? `تطبيق على (${selectedLikesPostIds.length}) منشورات`
                      : 'حفظ إعدادات التفاعل'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
