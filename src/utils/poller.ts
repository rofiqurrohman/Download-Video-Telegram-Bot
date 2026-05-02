import { getJobStatus, JobStatus } from '../services/ytdlp';

/**
 * Poll status job download hingga completed/failed atau timeout.
 *
 * @param jobId         - ID job dari yt-dlp service
 * @param intervalMs    - Interval polling dalam ms (default: 3000)
 * @param timeoutMs     - Timeout maksimal dalam ms (default: 300000 = 5 menit)
 * @returns             - JobStatus saat completed
 * @throws              - Error jika timeout atau status failed
 */
export async function pollJob(jobId: string, intervalMs = 3000, timeoutMs = 1_800_000): Promise<JobStatus> {
  const startTime = Date.now();

  while (true) {
    // Cek timeout
    if (Date.now() - startTime > timeoutMs) {
      throw new Error('Download terlalu lama. Coba lagi atau gunakan URL lain.');
    }

    let job: JobStatus;
    try {
      job = await getJobStatus(jobId);
    } catch (err) {
      console.error(`[poller] Error saat cek status job ${jobId}:`);
      // Jika API error, tunggu lalu coba lagi
      await sleep(intervalMs);
      continue;
    }

    if (job.status === 'completed') {
      return job;
    }

    if (job.status === 'failed') {
      const errMsg = job.logs?.join('\n') ?? job.error ?? 'Download gagal tanpa pesan error.';
      throw new Error(`Download gagal: ${errMsg}`);
    }

    // Masih pending/processing → tunggu
    await sleep(intervalMs);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
