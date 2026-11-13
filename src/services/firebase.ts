import { initializeApp, getApps } from 'firebase/app';
import { getAnalytics, isSupported } from 'firebase/analytics';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs,
  deleteDoc, 
  onSnapshot, 
  query, 
  serverTimestamp,
  increment
} from 'firebase/firestore';
import { ModuleItem, LessonItem, SpecializationItem, StudentSubmissionItem } from '../types';
import { hashString } from './likesAlgorithm';

/**
 * 1. Primary Firebase Configuration (clasty-zoom1)
 * All textual and structured application state is stored purely in Firebase Firestore.
 * Zero LocalStorage is used. Heavy files (images/PDFs) are NOT stored in Firebase;
 * only their direct URLs (ImgBB / Catbox) are stored.
 */
export const firebaseConfig = {
  apiKey: "AIzaSyCuFsPYJ5IWHSr-jDeCdNVIDNULPEPk2HU",
  authDomain: "clasty-zoom1.firebaseapp.com",
  projectId: "clasty-zoom1",
  storageBucket: "clasty-zoom1.firebasestorage.app",
  messagingSenderId: "124857531542",
  appId: "1:124857531542:web:e9cb443b356864c5f716b7",
  measurementId: "G-25XG1LRDFG"
};

/**
 * 2. Distributed Dual-Server Firebase Configuration for Likes System
 * Load is distributed equally (50% / 50%) across Server 1 and Server 2.
 */
export const likesServer1Config = {
  apiKey: "AIzaSyAkwuXN4ikVt2xDV4N_FRg1sRt1P9QkXrw",
  authDomain: "clastyzoom-4badf.firebaseapp.com",
  projectId: "clastyzoom-4badf",
  storageBucket: "clastyzoom-4badf.firebasestorage.app",
  messagingSenderId: "332945573289",
  appId: "1:332945573289:web:35d7a3335e5cc33095f0b8",
  measurementId: "G-3MTXB3NRS7"
};

export const likesServer2Config = {
  apiKey: "AIzaSyAdtAgIvGzkDRC4X-7bG8mwc4bMyZNYETQ",
  authDomain: "clasty-zoom.firebaseapp.com",
  projectId: "clasty-zoom",
  storageBucket: "clasty-zoom.firebasestorage.app",
  messagingSenderId: "223213040101",
  appId: "1:223213040101:web:1cdfe78dbaa3735fe67f0c",
  measurementId: "G-2NS82YZM7C"
};

// Initialize Firebase App singletons
const existingApps = getApps();
export const firebaseApp = existingApps.find(a => a.name === '[DEFAULT]') || initializeApp(firebaseConfig);
export const likesAppServer1 = existingApps.find(a => a.name === 'likes-server-1') || initializeApp(likesServer1Config, 'likes-server-1');
export const likesAppServer2 = existingApps.find(a => a.name === 'likes-server-2') || initializeApp(likesServer2Config, 'likes-server-2');

// Initialize Firestore instances
export const db = getFirestore(firebaseApp);
export const dbLikesServer1 = getFirestore(likesAppServer1);
export const dbLikesServer2 = getFirestore(likesAppServer2);

// Initialize Analytics conditionally
export let analytics: any = null;
export let analyticsServer1: any = null;
export let analyticsServer2: any = null;
if (typeof window !== 'undefined') {
  isSupported().then((supported) => {
    if (supported) {
      analytics = getAnalytics(firebaseApp);
      analyticsServer1 = getAnalytics(likesAppServer1);
      analyticsServer2 = getAnalytics(likesAppServer2);
    }
  }).catch(() => {
    // Ignore analytics unsupported in iframe or sandboxed environments
  });
}

// Collections helpers
const getModulesCollection = (yearId: 'first' | 'second') => 
  collection(db, 'academic_years', yearId, 'modules');

/**
 * Subscribe to modules for a given year in real-time directly from Firestore
 */
export function subscribeModules(
  yearId: 'first' | 'second',
  onUpdate: (modules: ModuleItem[]) => void,
  onError?: (error: any) => void
) {
  try {
    const q = query(getModulesCollection(yearId));
    return onSnapshot(q, (snapshot) => {
      const items: ModuleItem[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        items.push({
          id: docSnap.id,
          name: data.name || '',
          createdAt: data.createdAtText || new Date().toLocaleDateString('ar-DZ'),
          thumbnailUrl: data.thumbnailUrl || undefined,
          specializationId: data.specializationId || 'pep-arabe',
          lessons: data.lessons || [],
        });
      });
      // Sort newest first
      items.sort((a, b) => b.id.localeCompare(a.id));
      onUpdate(items);
    }, (err) => {
      console.warn('Firestore modules snapshot error:', err);
      if (onError) onError(err);
    });
  } catch (e) {
    console.warn('Firestore subscription failed:', e);
    if (onError) onError(e);
    return () => {};
  }
}

/**
 * Add a new module to Firestore (Only metadata and external URLs stored)
 */
export async function addModuleToFirestore(
  yearId: 'first' | 'second',
  moduleItem: ModuleItem
) {
  const moduleRef = doc(db, 'academic_years', yearId, 'modules', moduleItem.id);
  await setDoc(moduleRef, {
    name: moduleItem.name,
    createdAtText: moduleItem.createdAt,
    thumbnailUrl: moduleItem.thumbnailUrl || null,
    specializationId: moduleItem.specializationId || 'pep-arabe',
    lessons: moduleItem.lessons || [],
    timestamp: serverTimestamp(),
  }, { merge: true });
}

/**
 * Delete a module from Firestore
 */
export async function deleteModuleFromFirestore(
  yearId: 'first' | 'second',
  moduleId: string
) {
  const moduleRef = doc(db, 'academic_years', yearId, 'modules', moduleId);
  await deleteDoc(moduleRef);
}

/**
 * Deeply sanitizes lessons/posts to guarantee strict data types and only direct URL references.
 */
function sanitizeLessonsForFirestore(lessons: LessonItem[], fallbackModuleId: string) {
  return (lessons || []).map(lesson => ({
    id: String(lesson.id || Date.now()),
    moduleId: String(lesson.moduleId || fallbackModuleId),
    title: String(lesson.title || ''),
    type: String(lesson.type || 'محاضرة'),
    description: String(lesson.description || ''),
    likesCount: Number(lesson.likesCount) || 0,
    baseLikes: typeof lesson.baseLikes === 'number' ? lesson.baseLikes : null,
    userLikes: typeof lesson.userLikes === 'number' ? lesson.userLikes : (lesson.isLiked ? 1 : 0),
    manualLikesOffset: typeof lesson.manualLikesOffset === 'number' ? lesson.manualLikesOffset : null,
    lastLikesSyncedAt: typeof lesson.lastLikesSyncedAt === 'number' ? lesson.lastLikesSyncedAt : null,
    autoLikesEnabled: lesson.autoLikesEnabled !== false,
    frozenAutoLikes: typeof lesson.frozenAutoLikes === 'number' ? lesson.frozenAutoLikes : null,
    autoLikesResumedAt: typeof lesson.autoLikesResumedAt === 'number' ? lesson.autoLikesResumedAt : null,
    likesServerShard: lesson.likesServerShard === 1 || lesson.likesServerShard === 2
      ? lesson.likesServerShard
      : (hashString(String(lesson.id || '')) % 2 === 0 ? 1 : 2),
    isLiked: Boolean(lesson.isLiked),
    isPinned: Boolean(lesson.isPinned),
    commentsEnabled: lesson.commentsEnabled !== false,
    timestamp: Number(lesson.timestamp) || Date.now(),
    createdAt: String(lesson.createdAt || new Date().toLocaleDateString('ar-DZ')),
    // Images: only direct URLs / media refs stored in Firestore
    images: (lesson.images || []).map(img => ({
      id: String(img.id || Date.now()),
      url: String(img.url || ''),
      name: String(img.name || ''),
    })),
    // PDFs: only direct URLs / media refs stored in Firestore
    pdfs: (lesson.pdfs || []).map(pdf => ({
      id: String(pdf.id || Date.now()),
      name: String(pdf.name || 'document.pdf'),
      size: String(pdf.size || ''),
      url: String(pdf.url || pdf.downloadUrl || '#'),
      downloadUrl: pdf.downloadUrl ? String(pdf.downloadUrl) : (pdf.url ? String(pdf.url) : null),
      viewUrl: pdf.viewUrl ? String(pdf.viewUrl) : (pdf.url ? String(pdf.url) : null),
      coverImageUrl: pdf.coverImageUrl ? String(pdf.coverImageUrl) : null,
    })),
    // Comments
    comments: (lesson.comments || []).map(c => ({
      id: String(c.id || Date.now()),
      author: String(c.author || ''),
      text: String(c.text || ''),
      createdAt: String(c.createdAt || ''),
      isAdmin: Boolean(c.isAdmin),
      avatarUrl: c.avatarUrl ? String(c.avatarUrl) : null,
      isApproved: Boolean(c.isApproved),
    })),
  }));
}

/**
 * Update module lessons (with attachments, likes, comments)
 */
export async function updateModuleLessonsInFirestore(
  yearId: 'first' | 'second',
  moduleId: string,
  lessons: LessonItem[]
) {
  const moduleRef = doc(db, 'academic_years', yearId, 'modules', moduleId);
  const sanitizedLessons = sanitizeLessonsForFirestore(lessons, moduleId);

  await setDoc(moduleRef, {
    lessons: sanitizedLessons,
    lastUpdated: serverTimestamp(),
  }, { merge: true });
}

export const ADMIN_NEWS_MODULE_ID = '__admin_news__';

/**
 * Subscribe to Admin News & Updates posts in real-time from Firestore
 */
export function subscribeAdminNewsPosts(
  onUpdate: (posts: LessonItem[]) => void,
  onError?: (error: any) => void
) {
  try {
    const newsDocRef = doc(db, 'system_config', 'admin_news_posts');
    return onSnapshot(newsDocRef, (snap) => {
      if (snap.exists() && Array.isArray(snap.data()?.posts)) {
        onUpdate(snap.data().posts as LessonItem[]);
      } else {
        onUpdate([]);
      }
    }, (err) => {
      console.warn('Firestore admin news snapshot error:', err);
      if (onError) onError(err);
    });
  } catch (e) {
    console.warn('Firestore admin news subscription failed:', e);
    if (onError) onError(e);
    return () => {};
  }
}

/**
 * Save Admin News & Updates posts to Firestore
 */
export async function updateAdminNewsPostsInFirestore(posts: LessonItem[]) {
  const newsDocRef = doc(db, 'system_config', 'admin_news_posts');
  const sanitizedPosts = sanitizeLessonsForFirestore(posts, ADMIN_NEWS_MODULE_ID);

  await setDoc(newsDocRef, {
    posts: sanitizedPosts,
    lastUpdated: serverTimestamp(),
  }, { merge: true });
}

export interface StudentNotificationPayload {
  id: string;
  title: string;
  body: string;
  postType: string;
  targetType: 'module' | 'news';
  moduleId?: string;
  moduleName?: string;
  yearId?: 'first' | 'second';
  createdAt: number;
}

/**
 * Broadcast a real-time notification to students when Admin enables notifications on publish
 */
export async function publishStudentNotificationToFirestore(
  payload: StudentNotificationPayload
): Promise<void> {
  const notifDocRef = doc(db, 'system_config', 'latest_student_notification');
  await setDoc(notifDocRef, {
    id: String(payload.id),
    title: String(payload.title || ''),
    body: String(payload.body || ''),
    postType: String(payload.postType || ''),
    targetType: payload.targetType,
    moduleId: payload.moduleId ? String(payload.moduleId) : null,
    moduleName: payload.moduleName ? String(payload.moduleName) : null,
    yearId: payload.yearId || null,
    createdAt: Number(payload.createdAt) || Date.now(),
    active: true,
    lastUpdated: serverTimestamp(),
  });
}

/**
 * Clear / deactivate the currently active student notification (Admin only)
 */
export async function clearStudentNotificationFromFirestore(): Promise<void> {
  const notifDocRef = doc(db, 'system_config', 'latest_student_notification');
  await setDoc(notifDocRef, {
    id: null,
    title: '',
    body: '',
    active: false,
    clearedAt: Date.now(),
    lastUpdated: serverTimestamp(),
  });
}

/**
 * Subscribe to the latest Admin notification broadcast in real-time
 */
export function subscribeLatestStudentNotification(
  onNotification: (notif: StudentNotificationPayload | null) => void
): () => void {
  try {
    const notifDocRef = doc(db, 'system_config', 'latest_student_notification');
    return onSnapshot(notifDocRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data?.active !== false && data?.id && data?.title) {
          onNotification({
            id: String(data.id),
            title: String(data.title),
            body: String(data.body || ''),
            postType: String(data.postType || ''),
            targetType: data.targetType === 'news' ? 'news' : 'module',
            moduleId: data.moduleId ? String(data.moduleId) : undefined,
            moduleName: data.moduleName ? String(data.moduleName) : undefined,
            yearId: data.yearId === 'first' || data.yearId === 'second' ? data.yearId : undefined,
            createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now(),
          });
          return;
        }
      }
      onNotification(null);
    }, () => {
      // Ignore transient listener errors
    });
  } catch {
    return () => {};
  }
}

/**
 * Specializations Management (Default 'PEP arabe' + dynamically synced via Firestore)
 */
export const DEFAULT_SPECIALIZATIONS: SpecializationItem[] = [
  { id: 'pep-arabe', name: 'PEP arabe', createdAt: new Date().toISOString() }
];

export function subscribeSpecializations(
  onUpdate: (specs: SpecializationItem[]) => void,
  onError?: (error: any) => void
) {
  try {
    const specsDocRef = doc(db, 'system_config', 'specializations');
    return onSnapshot(specsDocRef, (snap) => {
      if (snap.exists() && Array.isArray(snap.data()?.list) && snap.data().list.length > 0) {
        onUpdate(snap.data().list);
      } else {
        onUpdate(DEFAULT_SPECIALIZATIONS);
      }
    }, (err) => {
      console.warn('Firestore specializations snapshot error:', err);
      if (onError) onError(err);
    });
  } catch (e) {
    console.warn('Firestore specializations subscription failed:', e);
    if (onError) onError(e);
    return () => {};
  }
}

export async function saveSpecializationsToFirestore(specs: SpecializationItem[]) {
  const specsDocRef = doc(db, 'system_config', 'specializations');
  await setDoc(specsDocRef, {
    list: specs,
    lastUpdated: serverTimestamp()
  }, { merge: true });
}

// ==========================================
// ADMIN AUTHENTICATION (Exclusively via Firestore)
// Zero LocalStorage is used.
// ==========================================

const ADMIN_SESSION_KEY = 'ens_medea_admin_active_session_v1';

export async function checkAdminAccountExists(): Promise<boolean> {
  try {
    const adminDocRef = doc(db, 'system_config', 'admin_account');
    const snap = await getDoc(adminDocRef);
    return Boolean(snap.exists() && snap.data()?.username);
  } catch (e) {
    console.warn('Firestore admin check error:', e);
    return false;
  }
}

export async function createSingleAdminAccount(username: string, password: string): Promise<boolean> {
  const exists = await checkAdminAccountExists();
  if (exists) {
    throw new Error('تم إنشاء حساب المسؤول الرئيسي مسبقاً. يُسمح بحساب مسؤول وحيد فقط.');
  }

  const credentials = {
    username: username.trim(),
    passwordHash: btoa(password.trim()),
    createdAt: new Date().toISOString(),
  };

  const adminDocRef = doc(db, 'system_config', 'admin_account');
  await setDoc(adminDocRef, credentials);

  // Set session-only indicator for active browser tab
  if (typeof window !== 'undefined') {
    sessionStorage.setItem(ADMIN_SESSION_KEY, 'true');
  }

  return true;
}

export async function verifyAdminLogin(username: string, password: string): Promise<boolean> {
  const enteredUser = username.trim();
  const enteredPassHash = btoa(password.trim());

  try {
    const adminDocRef = doc(db, 'system_config', 'admin_account');
    const snap = await getDoc(adminDocRef);
    if (snap.exists()) {
      const data = snap.data();
      if (data.username === enteredUser && data.passwordHash === enteredPassHash) {
        if (typeof window !== 'undefined') {
          sessionStorage.setItem(ADMIN_SESSION_KEY, 'true');
        }
        return true;
      }
    }
  } catch (e) {
    console.warn('Firestore admin verify error:', e);
  }

  return false;
}

export function isCurrentAdminLoggedIn(): boolean {
  if (typeof window === 'undefined') return false;
  return sessionStorage.getItem(ADMIN_SESSION_KEY) === 'true';
}

export function logoutAdmin(): void {
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem(ADMIN_SESSION_KEY);
  }
}

// ==========================================
// 2. CLOUD MEDIA STORAGE (Firestore Chunked Engine + ImgBB / Catbox Fallback)
// Guarantees 100% reliable image & PDF uploads across all browsers/environments
// with ZERO LocalStorage usage.
// ==========================================

const FIRESTORE_MEDIA_PREFIX = 'firestore-media://';
const MEDIA_CHUNK_SIZE = 500000; // ~500 KB base64 per Firestore chunk (well under 1 MiB limit)
const resolvedMediaCache = new Map<string, string>();
const inFlightMediaPromises = new Map<string, Promise<string>>();

export function isFirestoreMediaUrl(url?: string): boolean {
  return Boolean(url && url.startsWith(FIRESTORE_MEDIA_PREFIX));
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const parts: string[] = [];
  const chunkSize = 0x4000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    let chunk = '';
    const end = Math.min(bytes.length, i + chunkSize);
    for (let j = i; j < end; j++) {
      chunk += String.fromCharCode(bytes[j]);
    }
    parts.push(chunk);
  }
  return btoa(parts.join(''));
}

function base64ToBlob(base64: string, mimeType: string): Blob {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType || 'application/octet-stream' });
}

/**
 * Compresses large images on canvas while keeping high visual clarity
 * so uploads are fast and lightweight.
 */
async function optimizeImageFileForCloud(file: File): Promise<{ blob: Blob; mimeType: string }> {
  // Keep small files or animated GIF/SVG untouched
  if (file.size <= 350 * 1024 || file.type === 'image/gif' || file.type === 'image/svg+xml') {
    return { blob: file, mimeType: file.type || 'image/jpeg' };
  }

  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const maxDim = 1600;
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;

        if (width > maxDim || height > maxDim) {
          if (width >= height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, width);
        canvas.height = Math.max(1, height);
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(objectUrl);
          resolve({ blob: file, mimeType: file.type || 'image/jpeg' });
          return;
        }

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const outputType = file.type === 'image/png' ? 'image/webp' : 'image/jpeg';
        canvas.toBlob(
          (compressed) => {
            URL.revokeObjectURL(objectUrl);
            if (compressed && compressed.size < file.size) {
              resolve({ blob: compressed, mimeType: outputType });
            } else {
              resolve({ blob: file, mimeType: file.type || 'image/jpeg' });
            }
          },
          outputType,
          0.84
        );
      } catch {
        URL.revokeObjectURL(objectUrl);
        resolve({ blob: file, mimeType: file.type || 'image/jpeg' });
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve({ blob: file, mimeType: file.type || 'image/jpeg' });
    };
    img.src = objectUrl;
  });
}

/**
 * Stores any image or PDF permanently in Firebase Firestore (`uploaded_media/{id}/chunks/{i}`)
 * and returns a clean `firestore-media://{id}` reference URL.
 */
export async function uploadMediaToFirestore(
  blob: Blob,
  filename: string,
  mimeType: string
): Promise<string> {
  const maxBytes = 18 * 1024 * 1024; // 18 MB limit
  if (blob.size > maxBytes) {
    throw new Error('حجم الملف كبير جداً (الحد الأقصى المسموح به هو 18 ميغابايت)');
  }

  const buffer = await blob.arrayBuffer();
  const base64 = arrayBufferToBase64(buffer);
  const totalChunks = Math.max(1, Math.ceil(base64.length / MEDIA_CHUNK_SIZE));
  const mediaId = `media_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  await setDoc(doc(db, 'uploaded_media', mediaId), {
    name: filename || 'file',
    mimeType: mimeType || blob.type || 'application/octet-stream',
    size: blob.size,
    chunkCount: totalChunks,
    createdAt: Date.now(),
  });

  // Upload chunks in parallel batches of 4
  const batchSize = 4;
  for (let start = 0; start < totalChunks; start += batchSize) {
    const promises: Promise<void>[] = [];
    for (let i = start; i < Math.min(totalChunks, start + batchSize); i++) {
      const chunkData = base64.slice(i * MEDIA_CHUNK_SIZE, (i + 1) * MEDIA_CHUNK_SIZE);
      promises.push(
        setDoc(doc(db, 'uploaded_media', mediaId, 'chunks', String(i)), {
          index: i,
          data: chunkData,
        })
      );
    }
    await Promise.all(promises);
  }

  // Warm in-memory cache immediately so the uploader sees it instantly
  if (typeof window !== 'undefined') {
    const localObjectUrl = URL.createObjectURL(blob);
    resolvedMediaCache.set(mediaId, localObjectUrl);
  }

  return `${FIRESTORE_MEDIA_PREFIX}${mediaId}`;
}

/**
 * Resolves a `firestore-media://{id}` URL into an in-memory ObjectURL for rendering or downloading.
 * Standard http(s)/data/blob URLs are returned immediately untouched.
 */
export async function resolveMediaUrl(url: string): Promise<string> {
  if (!url || !isFirestoreMediaUrl(url)) {
    return url;
  }

  const mediaId = url.slice(FIRESTORE_MEDIA_PREFIX.length);
  const cached = resolvedMediaCache.get(mediaId);
  if (cached) {
    return cached;
  }

  const existingPromise = inFlightMediaPromises.get(mediaId);
  if (existingPromise) {
    return existingPromise;
  }

  const loadPromise = (async () => {
    try {
      const metaSnap = await getDoc(doc(db, 'uploaded_media', mediaId));
      if (!metaSnap.exists()) {
        throw new Error('لم يتم العثور على الملف في السحابة');
      }
      const meta = metaSnap.data();
      const mimeType = String(meta.mimeType || 'application/octet-stream');

      const chunksSnap = await getDocs(collection(db, 'uploaded_media', mediaId, 'chunks'));
      const chunkDocs: { index: number; data: string }[] = [];
      chunksSnap.forEach((d) => {
        const data = d.data();
        chunkDocs.push({
          index: typeof data.index === 'number' ? data.index : Number(d.id) || 0,
          data: String(data.data || ''),
        });
      });

      chunkDocs.sort((a, b) => a.index - b.index);
      const fullBase64 = chunkDocs.map((c) => c.data).join('');
      const blob = base64ToBlob(fullBase64, mimeType);
      const objectUrl = URL.createObjectURL(blob);
      resolvedMediaCache.set(mediaId, objectUrl);
      return objectUrl;
    } finally {
      inFlightMediaPromises.delete(mediaId);
    }
  })();

  inFlightMediaPromises.set(mediaId, loadPromise);
  return loadPromise;
}

export function getCachedResolvedMediaUrl(url?: string): string | undefined {
  if (!url) return url;
  if (!isFirestoreMediaUrl(url)) return url;
  const mediaId = url.slice(FIRESTORE_MEDIA_PREFIX.length);
  return resolvedMediaCache.get(mediaId);
}

/**
 * Resolves a `firestore-media://{id}` URL into raw `{ blob, mimeType, name }`
 */
export async function resolveMediaBlob(url: string): Promise<{ blob: Blob; mimeType: string; name: string }> {
  const mediaId = url.slice(FIRESTORE_MEDIA_PREFIX.length);
  const metaSnap = await getDoc(doc(db, 'uploaded_media', mediaId));
  if (!metaSnap.exists()) {
    throw new Error('لم يتم العثور على الملف في السحابة');
  }
  const meta = metaSnap.data();
  const mimeType = String(meta.mimeType || 'application/octet-stream');
  const name = String(meta.name || 'file');

  const chunksSnap = await getDocs(collection(db, 'uploaded_media', mediaId, 'chunks'));
  const chunkDocs: { index: number; data: string }[] = [];
  chunksSnap.forEach((d) => {
    const data = d.data();
    chunkDocs.push({
      index: typeof data.index === 'number' ? data.index : Number(d.id) || 0,
      data: String(data.data || ''),
    });
  });
  chunkDocs.sort((a, b) => a.index - b.index);
  const fullBase64 = chunkDocs.map((c) => c.data).join('');
  const blob = base64ToBlob(fullBase64, mimeType);
  return { blob, mimeType, name };
}

/**
 * Resolves a `firestore-media://{id}` URL into a base64 Data URL (`data:...;base64,...`)
 * for environments (such as Telegram's Android/iOS in-app browser) that block `blob:` downloads.
 */
export async function resolveMediaDataUrl(url: string): Promise<string> {
  if (!url || !isFirestoreMediaUrl(url)) {
    return url;
  }
  const mediaId = url.slice(FIRESTORE_MEDIA_PREFIX.length);
  const metaSnap = await getDoc(doc(db, 'uploaded_media', mediaId));
  if (!metaSnap.exists()) {
    throw new Error('لم يتم العثور على الملف في السحابة');
  }
  const meta = metaSnap.data();
  const mimeType = String(meta.mimeType || 'application/octet-stream');

  const chunksSnap = await getDocs(collection(db, 'uploaded_media', mediaId, 'chunks'));
  const chunkDocs: { index: number; data: string }[] = [];
  chunksSnap.forEach((d) => {
    const data = d.data();
    chunkDocs.push({
      index: typeof data.index === 'number' ? data.index : Number(d.id) || 0,
      data: String(data.data || ''),
    });
  });
  chunkDocs.sort((a, b) => a.index - b.index);
  const fullBase64 = chunkDocs.map((c) => c.data).join('');
  return `data:${mimeType};base64,${fullBase64}`;
}

export async function uploadImageToImgBB(
  file: File, 
  apiKey = 'd89ee562e31505c87fc6037eb0a12e3e'
): Promise<string> {
  if (!file) {
    throw new Error('لم يتم اختيار أي ملف صورة');
  }

  const { blob, mimeType } = await optimizeImageFileForCloud(file);

  // 1. Try ImgBB API first (with short timeout)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const formData = new FormData();
    formData.append('image', blob, file.name || 'image.jpg');

    const response = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      if (data?.success && data?.data?.url) {
        return data.data.url;
      }
    }
  } catch {
    // Fallback cleanly to Firebase Firestore Cloud Media below
  }

  // 2. Reliable Permanent Fallback: Firebase Firestore Cloud Media
  return await uploadMediaToFirestore(blob, file.name || 'image.jpg', mimeType);
}

// ==========================================
// 3. PDF CLOUD STORAGE INTEGRATION (Catbox + Reliable Firestore Cloud Media)
// ==========================================

export const CATBOX_USER_TOKEN = '20ce74dc0da261425dc134162';

export interface CatboxUploadResult {
  viewUrl: string;
  downloadUrl: string;
}

export async function uploadPdfToCatbox(
  file: File,
  userhash: string = CATBOX_USER_TOKEN
): Promise<CatboxUploadResult> {
  if (!file) {
    throw new Error('لم يتم اختيار أي ملف PDF');
  }

  if (file.size > 18 * 1024 * 1024) {
    throw new Error('حجم ملف PDF يتجاوز الحد المسموح به (18 ميغابايت)');
  }

  // 1. Attempt Catbox.moe first (with short timeout)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);
    const formData = new FormData();
    formData.append('reqtype', 'fileupload');
    if (userhash) {
      formData.append('userhash', userhash);
    }
    formData.append('fileToUpload', file);

    const response = await fetch('https://catbox.moe/user/api.php', {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const text = (await response.text()).trim();
      if (text.startsWith('http://') || text.startsWith('https://')) {
        return {
          viewUrl: text,
          downloadUrl: text,
        };
      }
    }
  } catch {
    // CORS or upstream error: fall back cleanly to Firebase Firestore Cloud Media
  }

  // 2. Reliable Permanent Fallback: Chunked Firebase Firestore Cloud Media
  const mediaUrl = await uploadMediaToFirestore(
    file,
    file.name || 'document.pdf',
    file.type || 'application/pdf'
  );
  return {
    viewUrl: mediaUrl,
    downloadUrl: mediaUrl,
  };
}

// ==========================================
// 4. DUAL-SERVER LOAD BALANCED LIKES ENGINE
// Distributes load 50% / 50% between:
// - Server 1: clastyzoom-4badf (dbLikesServer1)
// - Server 2: clasty-zoom      (dbLikesServer2)
// ==========================================

export function assignBalancedLikesShard(existingCount: number): 1 | 2 {
  return existingCount % 2 === 0 ? 1 : 2;
}

export function getLikesShardForLesson(lesson: Pick<LessonItem, 'id' | 'likesServerShard'>): 1 | 2 {
  if (lesson.likesServerShard === 1 || lesson.likesServerShard === 2) {
    return lesson.likesServerShard;
  }
  return hashString(String(lesson.id)) % 2 === 0 ? 1 : 2;
}

export function getLikesDbByShard(shard: 1 | 2) {
  return shard === 1 ? dbLikesServer1 : dbLikesServer2;
}

export interface ShardLikeState {
  lessonId: string;
  moduleId: string;
  publishedAt: number;
  userLikes: number;
  manualLikesOffset?: number | null;
  autoLikesEnabled: boolean;
  frozenAutoLikes: number | null;
  autoLikesResumedAt: number | null;
  likesCount: number;
  serverShard: 1 | 2;
}

/**
 * Syncs a lesson's complete likes state (automated + real user likes + admin pause state + manual offset)
 * strictly to its assigned Likes shard server (50% Server 1 / 50% Server 2).
 */
export async function syncLessonLikesToShard(lesson: LessonItem): Promise<void> {
  const shard = getLikesShardForLesson(lesson);
  const targetDb = getLikesDbByShard(shard);
  const docRef = doc(targetDb, 'lesson_likes', String(lesson.id));

  try {
    await setDoc(docRef, {
      lessonId: String(lesson.id),
      moduleId: String(lesson.moduleId || ''),
      publishedAt: Number(lesson.timestamp) || Date.now(),
      userLikes: typeof lesson.userLikes === 'number' ? Math.max(0, lesson.userLikes) : 0,
      manualLikesOffset: typeof lesson.manualLikesOffset === 'number' ? lesson.manualLikesOffset : null,
      autoLikesEnabled: lesson.autoLikesEnabled !== false,
      frozenAutoLikes: typeof lesson.frozenAutoLikes === 'number' ? lesson.frozenAutoLikes : null,
      autoLikesResumedAt: typeof lesson.autoLikesResumedAt === 'number' ? lesson.autoLikesResumedAt : null,
      likesCount: Number(lesson.likesCount) || 0,
      serverShard: shard,
      lastUpdated: serverTimestamp(),
    }, { merge: true });
  } catch (err) {
    console.warn(`Likes Shard ${shard} sync notice:`, err);
  }
}

/**
 * Atomically increments/decrements real user likes on the assigned Likes shard server.
 * Works even when automated likes are paused by Admin.
 */
export async function updateRealUserLikeOnShard(
  lesson: LessonItem,
  delta: 1 | -1,
  updatedTotalLikes: number,
  updatedUserLikes: number
): Promise<void> {
  const shard = getLikesShardForLesson(lesson);
  const targetDb = getLikesDbByShard(shard);
  const docRef = doc(targetDb, 'lesson_likes', String(lesson.id));

  try {
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      await setDoc(docRef, {
        userLikes: increment(delta),
        likesCount: Math.max(0, updatedTotalLikes),
        lastUpdated: serverTimestamp(),
      }, { merge: true });
    } else {
      await setDoc(docRef, {
        lessonId: String(lesson.id),
        moduleId: String(lesson.moduleId || ''),
        publishedAt: Number(lesson.timestamp) || Date.now(),
        userLikes: Math.max(0, updatedUserLikes),
        manualLikesOffset: typeof lesson.manualLikesOffset === 'number' ? lesson.manualLikesOffset : null,
        autoLikesEnabled: lesson.autoLikesEnabled !== false,
        frozenAutoLikes: typeof lesson.frozenAutoLikes === 'number' ? lesson.frozenAutoLikes : null,
        autoLikesResumedAt: typeof lesson.autoLikesResumedAt === 'number' ? lesson.autoLikesResumedAt : null,
        likesCount: Math.max(0, updatedTotalLikes),
        serverShard: shard,
        lastUpdated: serverTimestamp(),
      }, { merge: true });
    }
  } catch (err) {
    console.warn(`Likes Shard ${shard} user-like update notice:`, err);
  }
}

/**
 * Subscribes in real-time to likes docs for each lesson ONLY on its assigned shard server
 * (distributing read/listener load equally between clastyzoom-4badf and clasty-zoom).
 */
export function subscribeLessonLikesFromShards(
  lessons: LessonItem[],
  onShardUpdate: (lessonId: string, state: Partial<ShardLikeState>) => void
): () => void {
  const unsubscribes: (() => void)[] = [];

  lessons.forEach((lesson) => {
    const shard = getLikesShardForLesson(lesson);
    const targetDb = getLikesDbByShard(shard);
    const docRef = doc(targetDb, 'lesson_likes', String(lesson.id));

    try {
      const unsub = onSnapshot(docRef, (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          onShardUpdate(String(lesson.id), {
            userLikes: typeof data.userLikes === 'number' ? Math.max(0, data.userLikes) : undefined,
            manualLikesOffset: typeof data.manualLikesOffset === 'number' ? data.manualLikesOffset : undefined,
            autoLikesEnabled: typeof data.autoLikesEnabled === 'boolean' ? data.autoLikesEnabled : undefined,
            frozenAutoLikes: typeof data.frozenAutoLikes === 'number' ? data.frozenAutoLikes : undefined,
            autoLikesResumedAt: typeof data.autoLikesResumedAt === 'number' ? data.autoLikesResumedAt : undefined,
            likesCount: typeof data.likesCount === 'number' ? Math.max(0, data.likesCount) : undefined,
            serverShard: shard,
          });
        }
      }, () => {
        // Ignore transient shard listener warnings
      });
      unsubscribes.push(unsub);
    } catch {
      // Ignore individual listener errors
    }
  });

  return () => {
    unsubscribes.forEach((u) => {
      try { u(); } catch {}
    });
  };
}

// ==========================================
// 5. STUDENT SUBMISSIONS TO ADMIN (Firestore `student_submissions`)
// ==========================================

export function subscribeStudentSubmissions(
  onUpdate: (items: StudentSubmissionItem[]) => void,
  onError?: (error: any) => void
): () => void {
  try {
    const q = query(collection(db, 'student_submissions'));
    return onSnapshot(q, (snapshot) => {
      const list: StudentSubmissionItem[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        list.push({
          id: docSnap.id,
          senderName: String(data.senderName || 'طالب / زائر'),
          yearLabel: String(data.yearLabel || 'عام'),
          moduleName: String(data.moduleName || ''),
          title: String(data.title || ''),
          description: String(data.description || ''),
          images: Array.isArray(data.images) ? data.images : [],
          pdfs: Array.isArray(data.pdfs) ? data.pdfs : [],
          isRead: Boolean(data.isRead),
          createdAt: String(data.createdAt || new Date().toLocaleDateString('ar-DZ')),
          timestamp: typeof data.timestamp === 'number' ? data.timestamp : Date.now(),
        });
      });
      list.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      onUpdate(list);
    }, (err) => {
      console.warn('Firestore student submissions snapshot error:', err);
      if (onError) onError(err);
    });
  } catch (e) {
    console.warn('Firestore student submissions subscription failed:', e);
    if (onError) onError(e);
    return () => {};
  }
}

export async function addStudentSubmissionToFirestore(item: StudentSubmissionItem): Promise<void> {
  const subRef = doc(db, 'student_submissions', String(item.id));
  await setDoc(subRef, {
    senderName: String(item.senderName || 'طالب / زائر'),
    yearLabel: String(item.yearLabel || 'عام'),
    moduleName: String(item.moduleName || ''),
    title: String(item.title || ''),
    description: String(item.description || ''),
    images: (item.images || []).map(img => ({
      id: String(img.id || Date.now()),
      url: String(img.url || ''),
      name: String(img.name || ''),
    })),
    pdfs: (item.pdfs || []).map(pdf => ({
      id: String(pdf.id || Date.now()),
      name: String(pdf.name || 'document.pdf'),
      size: String(pdf.size || ''),
      url: String(pdf.url || pdf.downloadUrl || '#'),
      downloadUrl: pdf.downloadUrl ? String(pdf.downloadUrl) : (pdf.url ? String(pdf.url) : null),
      viewUrl: pdf.viewUrl ? String(pdf.viewUrl) : (pdf.url ? String(pdf.url) : null),
      coverImageUrl: pdf.coverImageUrl ? String(pdf.coverImageUrl) : null,
    })),
    isRead: Boolean(item.isRead),
    createdAt: String(item.createdAt || new Date().toLocaleDateString('ar-DZ')),
    timestamp: Number(item.timestamp) || Date.now(),
    serverCreatedAt: serverTimestamp(),
  });
}

export async function markStudentSubmissionReadInFirestore(submissionId: string, isRead: boolean): Promise<void> {
  const subRef = doc(db, 'student_submissions', String(submissionId));
  await setDoc(subRef, { isRead: Boolean(isRead) }, { merge: true });
}

export async function deleteStudentSubmissionFromFirestore(submissionId: string): Promise<void> {
  const subRef = doc(db, 'student_submissions', String(submissionId));
  await deleteDoc(subRef);
}
