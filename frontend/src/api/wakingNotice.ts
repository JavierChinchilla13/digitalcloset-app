import type { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { create } from 'zustand';

// Audit H11: the free API sleeps after about 15 minutes without a request, and the first request after that can take up to a minute.
// Without a word of explanation the person sees a spinner (or, at the end, an error). So when a request has not been answered after
// a few seconds, and the server has not been heard from recently, a calm message says it is waking up. The message only reads
// requests: it never repeats, delays or changes one, so there is no retry (the requests that retry today are the only ones that do).

// How long a request may stay unanswered before the message shows.
export const WAKING_DELAY_MS = 4000;
// The server counts as awake for this long after any answer from it (it sleeps after 15 idle minutes). A tab left open for longer
// than this gets the message again on its next slow request.
export const AWAKE_FOR_MS = 10 * 60 * 1000;

interface WakingState {
  // True while a request has waited longer than WAKING_DELAY_MS and the server has not answered.
  visible: boolean;
}

export const useWakingStore = create<WakingState>(() => ({ visible: false }));

let nextId = 0;
// request config -> id, so the response (or the error) of a request finds the timer that was started for it.
const ids = new WeakMap<object, number>();
const timers = new Map<number, ReturnType<typeof setTimeout>>();
const slow = new Set<number>();
let lastAnswerAt: number | null = null;

const refresh = () => useWakingStore.setState({ visible: slow.size > 0 });

const isAsleep = () => lastAnswerAt === null || Date.now() - lastAnswerAt > AWAKE_FOR_MS;

const start = (config: InternalAxiosRequestConfig) => {
  if (!isAsleep()) return;
  const id = ++nextId;
  ids.set(config, id);
  timers.set(
    id,
    setTimeout(() => {
      timers.delete(id);
      // The server may have answered another request in the meantime.
      if (isAsleep()) {
        slow.add(id);
        refresh();
      }
    }, WAKING_DELAY_MS),
  );
};

const finish = (config: object | undefined, answered: boolean) => {
  if (answered) {
    // Any answer, even an error status, means the server is awake: nothing else is worth waiting for a message about.
    lastAnswerAt = Date.now();
    timers.forEach((timer) => clearTimeout(timer));
    timers.clear();
    slow.clear();
    refresh();
    return;
  }
  const id = config ? ids.get(config) : undefined;
  if (id === undefined) return;
  const timer = timers.get(id);
  if (timer !== undefined) clearTimeout(timer);
  timers.delete(id);
  slow.delete(id);
  refresh();
};

// Watches the requests of one axios instance. Added after the instance's own interceptors, and never changes a request or a response.
export function watchForSlowServer(instance: AxiosInstance): void {
  instance.interceptors.request.use((config) => {
    start(config);
    return config;
  });
  instance.interceptors.response.use(
    (response) => {
      finish(response.config, true);
      return response;
    },
    (error) => {
      // A response with a status (even a 4xx or 5xx) is an answer; a timeout or a dropped connection is not.
      finish(error?.config, Boolean(error?.response));
      return Promise.reject(error);
    },
  );
}

// For the tests: forgets everything.
export function resetWakingNotice(): void {
  timers.forEach((timer) => clearTimeout(timer));
  timers.clear();
  slow.clear();
  lastAnswerAt = null;
  refresh();
}
