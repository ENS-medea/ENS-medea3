import { 
  AcademicYear, 
  AcademicYearId, 
  SupportLesson, 
  PedagogicalResource, 
  Subject, 
  CloudSyncState 
} from '../types';
import { ACADEMIC_YEARS, SUBJECTS, SUPPORT_LESSONS, PEDAGOGICAL_RESOURCES } from '../data/mockData';

const STORAGE_KEYS = {
  BOOKMARKS: 'ana_ostad_bookmarks_v1',
  COMPLETED_LESSONS: 'ana_ostad_completed_lessons_v1',
  USER_NOTES: 'ana_ostad_notes_v1',
  SYNC_STATE: 'ana_ostad_sync_state_v1',
};

class MockDatabaseService {
  private syncState: CloudSyncState = {
    isOnline: true,
    lastSyncedAt: new Date().toLocaleTimeString('ar-MA', { hour: '2-digit', minute: '2-digit' }),
    pendingSyncCount: 0,
    provider: 'Firestore (Firebase)',
    syncStatus: 'synced',
  };

  private listeners: (() => void)[] = [];

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.handleNetworkChange(true));
      window.addEventListener('offline', () => this.handleNetworkChange(false));
    }
  }

  private handleNetworkChange(isOnline: boolean) {
    this.syncState.isOnline = isOnline;
    this.syncState.syncStatus = isOnline ? 'synced' : 'idle';
    this.notify();
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notify() {
    this.listeners.forEach(fn => fn());
  }

  public getYears(): AcademicYear[] {
    return ACADEMIC_YEARS;
  }

  public getYearById(yearId: AcademicYearId): AcademicYear | undefined {
    return ACADEMIC_YEARS.find(y => y.id === yearId);
  }

  public getSubjects(): Subject[] {
    return SUBJECTS;
  }

  public getSubjectsForYear(yearId: AcademicYearId): Subject[] {
    return SUBJECTS.filter(s => s.years.includes(yearId));
  }

  public getLessons(yearId?: AcademicYearId, subjectId?: string): SupportLesson[] {
    return SUPPORT_LESSONS.filter(lesson => {
      if (yearId && lesson.academicYearId !== yearId) return false;
      if (subjectId && subjectId !== 'all' && lesson.subjectId !== subjectId) return false;
      return true;
    });
  }

  public getResources(yearId?: AcademicYearId, subjectId?: string): PedagogicalResource[] {
    const bookmarkedIds = this.getBookmarkedIds();
    return PEDAGOGICAL_RESOURCES
      .filter(resource => {
        if (yearId && resource.academicYearId !== yearId) return false;
        if (subjectId && subjectId !== 'all' && resource.subjectId !== subjectId) return false;
        return true;
      })
      .map(resource => ({
        ...resource,
        isBookmarked: bookmarkedIds.includes(resource.id),
      }));
  }

  private bookmarks: string[] = ['res-1', 'res-3'];
  private completedLessons: string[] = ['lesson-y1-math-1'];
  private userNotes: Record<string, string> = {};

  // --- Bookmarks Management ---
  public getBookmarkedIds(): string[] {
    return [...this.bookmarks];
  }

  public toggleBookmark(resourceId: string): boolean {
    const current = this.getBookmarkedIds();
    let isNowBookmarked = false;

    if (current.includes(resourceId)) {
      this.bookmarks = current.filter(id => id !== resourceId);
      isNowBookmarked = false;
    } else {
      this.bookmarks = [...current, resourceId];
      isNowBookmarked = true;
    }

    this.syncState.pendingSyncCount += 1;
    this.syncState.syncStatus = 'idle';
    this.notify();

    return isNowBookmarked;
  }

  // --- Completed Lessons Management ---
  public getCompletedLessonIds(): string[] {
    return [...this.completedLessons];
  }

  public toggleLessonCompleted(lessonId: string): boolean {
    const current = this.getCompletedLessonIds();
    let completed = false;

    if (current.includes(lessonId)) {
      this.completedLessons = current.filter(id => id !== lessonId);
      completed = false;
    } else {
      this.completedLessons = [...current, lessonId];
      completed = true;
    }

    this.syncState.pendingSyncCount += 1;
    this.notify();

    return completed;
  }

  // --- Study Notes ---
  public getNotesForLesson(lessonId: string): string {
    return this.userNotes[lessonId] || '';
  }

  public saveNotesForLesson(lessonId: string, notes: string) {
    this.userNotes[lessonId] = notes;
    this.syncState.pendingSyncCount += 1;
    this.notify();
  }

  // --- Cloud Sync Simulation ---
  public getSyncState(): CloudSyncState {
    return { ...this.syncState };
  }

  public triggerSync(): Promise<CloudSyncState> {
    this.syncState.syncStatus = 'syncing';
    this.notify();

    return new Promise(resolve => {
      setTimeout(() => {
        this.syncState.syncStatus = 'synced';
        this.syncState.pendingSyncCount = 0;
        this.syncState.lastSyncedAt = new Date().toLocaleTimeString('ar-MA', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        });
        this.notify();
        resolve(this.syncState);
      }, 900);
    });
  }

  public setBackendProvider(provider: 'Firestore (Firebase)' | 'Supabase (PostgreSQL)') {
    this.syncState.provider = provider;
    this.notify();
  }

  public getBackendSchemaManifest() {
    return {
      appName: 'ana ostad (أنا أستاذ)',
      version: '2.0-cloud-ready',
      databaseReadiness: {
        firebaseFirestore: {
          collections: [
            'academic_years/{yearId}',
            'academic_years/{yearId}/curricula/{branchId}',
            'subjects/{subjectId}',
            'support_lessons/{lessonId}',
            'support_lessons/{lessonId}/live_rooms/{roomId}',
            'pedagogical_resources/{resourceId}',
            'users/{userId}/bookmarks/{resourceId}',
            'users/{userId}/lesson_progress/{lessonId}',
          ],
          rulesEnforcement: 'RBAC: Student (read lessons/resources), Teacher (upload, host live), Inspector/Admin (validate).',
        },
        supabasePostgres: {
          tables: [
            'academic_years (id text primary key, title text, level_badge text)',
            'subjects (id text primary key, name text, icon text)',
            'support_lessons (id text primary key, year_id text references academic_years, title text, video_url text, is_live boolean)',
            'pedagogical_resources (id text primary key, title text, file_url text, downloads int default 0)',
            'user_progress (user_id uuid, lesson_id text, completed boolean, notes text, primary key(user_id, lesson_id))',
          ],
          rlsPolicy: 'Enable RLS; authenticated users can update user_progress where auth.uid() = user_id;',
        },
      },
    };
  }
}

export const dbService = new MockDatabaseService();
