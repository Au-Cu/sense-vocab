import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

const MAX_BATCHES = 10;
const BATCH_SIZE = 100;
const FEEDBACK_BUCKET = "feedback-images";

type RetentionJob = {
  id: string;
  imagePaths?: string[];
  attempt?: number;
};

function safeError(error: unknown): string {
  if (error instanceof Error) return error.message.slice(0, 500);
  return String(error ?? "unknown retention error").slice(0, 500);
}

export default {
  fetch: withSupabase({ auth: ["secret"] }, async (request, context) => {
    if (request.method !== "POST") {
      return Response.json({ error: "method_not_allowed" }, { status: 405 });
    }

    const workerId = crypto.randomUUID();
    let claimed = 0;
    let deleted = 0;
    let failed = 0;

    for (let batch = 0; batch < MAX_BATCHES; batch += 1) {
      const { data, error } = await context.supabaseAdmin.rpc(
        "retention_claim_feedback_batch",
        { p_worker_id: workerId, p_limit: BATCH_SIZE },
      );
      if (error) throw error;

      const jobs = Array.isArray(data) ? data as RetentionJob[] : [];
      if (!jobs.length) break;
      claimed += jobs.length;
      const feedbackIds = jobs.map((job) => job.id);
      const imagePaths = [...new Set(jobs.flatMap((job) =>
        Array.isArray(job.imagePaths) ? job.imagePaths : []
      ))];

      try {
        for (let start = 0; start < imagePaths.length; start += BATCH_SIZE) {
          const { error: storageError } = await context.supabaseAdmin.storage
            .from(FEEDBACK_BUCKET)
            .remove(imagePaths.slice(start, start + BATCH_SIZE));
          if (storageError) throw storageError;
        }
        const { data: finalizeData, error: finalizeError } =
          await context.supabaseAdmin.rpc("retention_finalize_feedback_batch", {
            p_worker_id: workerId,
            p_feedback_ids: feedbackIds,
          });
        if (finalizeError) throw finalizeError;
        deleted += Number(finalizeData?.deleted ?? 0);
      } catch (batchError) {
        failed += jobs.length;
        await context.supabaseAdmin.rpc("retention_fail_feedback_batch", {
          p_worker_id: workerId,
          p_feedback_ids: feedbackIds,
          p_error: safeError(batchError),
        });
      }

      if (jobs.length < BATCH_SIZE) break;
    }

    return Response.json({ ok: failed === 0, claimed, deleted, failed }, {
      status: failed === 0 ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    });
  }),
};
