import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import { deleteExpiredSessions } from './firebase';
import axios from 'axios';
import { config } from './config';

export const CLEANUP_TASK = 'prinstax.cleanup.expired';

TaskManager.defineTask(CLEANUP_TASK, async () => {
  try {
    const removed = await deleteExpiredSessions();
    try {
      await axios.post(`${config.serverUrl}/api/cleanup`, undefined, { timeout: 5000 });
    } catch {
      // server may be offline; firestore-side cleanup still ran
    }
    return removed > 0
      ? BackgroundFetch.BackgroundFetchResult.NewData
      : BackgroundFetch.BackgroundFetchResult.NoData;
  } catch {
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

export async function registerCleanupTask(): Promise<void> {
  const status = await BackgroundFetch.getStatusAsync();
  if (status === BackgroundFetch.BackgroundFetchStatus.Restricted ||
      status === BackgroundFetch.BackgroundFetchStatus.Denied) {
    return;
  }
  const isRegistered = await TaskManager.isTaskRegisteredAsync(CLEANUP_TASK);
  if (isRegistered) return;
  await BackgroundFetch.registerTaskAsync(CLEANUP_TASK, {
    minimumInterval: 60 * 60,
    stopOnTerminate: false,
    startOnBoot: true,
  });
}

export async function runCleanupNow(): Promise<number> {
  return deleteExpiredSessions();
}
