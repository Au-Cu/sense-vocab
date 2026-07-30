import { createClient } from "@supabase/supabase-js";

function assertResult(result) {
  if (result?.error) throw result.error;
  return result?.data ?? null;
}

const FEEDBACK_BUCKET = "feedback-images";
const ANNOUNCEMENT_BUCKET = "announcement-images";
const FEEDBACK_IMAGE_TYPES = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);
const ANNOUNCEMENT_IMAGE_PATH =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/[1-4]\.(?:jpg|jpeg|png|webp)$/i;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function createUuid() {
  if (typeof crypto?.randomUUID === "function") return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (token) => {
    const value = Math.floor(Math.random() * 16);
    const nibble = token === "x" ? value : (value & 0x3) | 0x8;
    return nibble.toString(16);
  });
}

window.SenseVocabCloud = {
  create(config) {
    const supabaseUrl = String(config?.supabaseUrl ?? "").trim();
    const supabaseAnonKey = String(config?.supabaseAnonKey ?? "").trim();
    if (!supabaseUrl || !supabaseAnonKey) return null;

    const projectRef = new URL(supabaseUrl).hostname.split(".")[0] || "default";
    const client = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: `sense-vocab-auth-${projectRef}`,
      },
    });

    function hydrateAnnouncementImages(result) {
      const snapshot = result && typeof result === "object" ? result : {};
      return {
        ...snapshot,
        items: Array.isArray(snapshot.items)
          ? snapshot.items.map((item) => ({
            ...item,
            images: Array.isArray(item.imagePaths)
              ? item.imagePaths
                .map((path) => {
                  const normalizedPath = String(path ?? "").trim();
                  if (!ANNOUNCEMENT_IMAGE_PATH.test(normalizedPath)) return null;
                  const publicResult = client.storage
                    .from(ANNOUNCEMENT_BUCKET)
                    .getPublicUrl(normalizedPath);
                  const url = publicResult?.data?.publicUrl;
                  return url ? { path: normalizedPath, url } : null;
                })
                .filter(Boolean)
              : [],
          }))
          : [],
      };
    }

    async function recordAdminAccess(
      action,
      targetType = null,
      targetId = null,
      metadata = {},
    ) {
      assertResult(await client.rpc("admin_record_access", {
        p_action: action,
        p_target_type: targetType,
        p_target_id: targetId,
        p_metadata: metadata,
      }));
    }

    return {
      async getSession() {
        const data = assertResult(await client.auth.getSession());
        return data?.session ?? null;
      },

      onAuthStateChange(callback) {
        return client.auth.onAuthStateChange((event, session) => {
          callback(event, session);
        });
      },

      async signUp(email, password, invitationCode = "") {
        const redirectTo = `${window.location.origin}${window.location.pathname}`;
        const normalizedInvitationCode = String(invitationCode ?? "")
          .trim()
          .toUpperCase();
        return assertResult(await client.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: redirectTo,
            data: normalizedInvitationCode
              ? { invitation_code: normalizedInvitationCode }
              : {},
          },
        }));
      },

      async verifySignupOtp(email, token) {
        return assertResult(await client.auth.verifyOtp({
          email,
          token: String(token ?? "").trim(),
          type: "signup",
        }));
      },

      async resendSignupOtp(email) {
        const redirectTo = `${window.location.origin}${window.location.pathname}`;
        return assertResult(await client.auth.resend({
          type: "signup",
          email,
          options: {
            emailRedirectTo: redirectTo,
          },
        }));
      },

      async signIn(email, password) {
        return assertResult(await client.auth.signInWithPassword({ email, password }));
      },

      async sendPasswordRecoveryOtp(email) {
        const redirectTo = `${window.location.origin}${window.location.pathname}`;
        return assertResult(await client.auth.resetPasswordForEmail(email, {
          redirectTo,
        }));
      },

      async verifyRecoveryOtp(email, token) {
        return assertResult(await client.auth.verifyOtp({
          email,
          token: String(token ?? "").trim(),
          type: "recovery",
        }));
      },

      async updatePassword(password) {
        return assertResult(await client.auth.updateUser({ password }));
      },

      async signOut() {
        assertResult(await client.auth.signOut());
      },

      async loadLegalConsents() {
        return assertResult(await client.rpc("load_my_legal_consents"));
      },

      async recordLegalConsents() {
        return assertResult(await client.rpc("record_my_legal_consents", {
          p_terms_privacy: true,
          p_cross_border: true,
          p_age_14_or_over: true,
        }));
      },

      async validateInvitationCode(code) {
        return Boolean(assertResult(await client.rpc(
          "validate_invitation_code",
          { p_code: String(code ?? "").trim().toUpperCase() },
        )));
      },

      async loadRegistrationWelcome(userId) {
        return assertResult(await client.rpc("registration_welcome", {
          p_user_id: userId,
        }));
      },

      async loadAccountProfile() {
        return assertResult(await client.rpc("load_my_account_profile"));
      },

      async loadNotifications(limit = 100) {
        const result = assertResult(await client.rpc("load_my_notifications", {
          p_limit: limit,
        }));
        return hydrateAnnouncementImages(result);
      },

      async markNotificationRead(kind, id) {
        return assertResult(await client.rpc("mark_my_notification_read", {
          p_kind: kind,
          p_id: id,
        }));
      },

      async loadState() {
        return assertResult(await client.rpc("load_user_state"));
      },

      async saveState(state, expectedRevision = null) {
        return assertResult(await client.rpc("save_user_state", {
          p_state: state,
          p_expected_revision: expectedRevision,
          p_force: false,
        }));
      },

      async deleteAccount() {
        const paths = assertResult(
          await client.rpc("load_my_feedback_image_paths"),
        ) ?? [];
        for (let index = 0; index < paths.length; index += 1000) {
          assertResult(
            await client.storage
              .from(FEEDBACK_BUCKET)
              .remove(paths.slice(index, index + 1000)),
          );
        }
        return assertResult(await client.rpc("delete_my_account"));
      },

      async submitFeedback(message, files = [], context = null) {
        const normalizedMessage = String(message ?? "").trim();
        const images = Array.from(files ?? []);
        if (normalizedMessage.length < 3 || normalizedMessage.length > 4000) {
          throw new Error("问题描述需为 3 至 4000 个字符。");
        }
        if (images.length > 4) {
          throw new Error("每次最多上传 4 张图片。");
        }

        const feedbackId = createUuid();
        const uploadedPaths = [];
        try {
          const createdFeedback = assertResult(await client.rpc("submit_feedback", {
            p_feedback_id: feedbackId,
            p_message: normalizedMessage,
            p_image_paths: [],
            p_context: context && typeof context === "object" ? context : {},
          }));

          const sessionData = assertResult(await client.auth.getSession());
          const userId = sessionData?.session?.user?.id;
          if (!userId) throw new Error("请先登录账户。");

          for (const [index, file] of images.entries()) {
            const extension = FEEDBACK_IMAGE_TYPES.get(file.type);
            if (!extension) throw new Error("仅支持 JPG、PNG 或 WebP 图片。");
            if (file.size > 5 * 1024 * 1024) {
              throw new Error("每张图片不能超过 5 MB。");
            }
            const path = `${userId}/${feedbackId}/${index + 1}.${extension}`;
            assertResult(await client.storage.from(FEEDBACK_BUCKET).upload(path, file, {
              cacheControl: "3600",
              contentType: file.type,
              upsert: false,
            }));
            uploadedPaths.push(path);
          }

          if (uploadedPaths.length) {
            assertResult(await client.rpc("attach_feedback_images", {
              p_feedback_id: feedbackId,
              p_image_paths: uploadedPaths,
            }));
          }
          return createdFeedback;
        } catch (error) {
          if (uploadedPaths.length) {
            try {
              await client.storage.from(FEEDBACK_BUCKET).remove(uploadedPaths);
            } catch {
              // A failed cleanup remains private and can only be seen by its owner.
            }
          }
          try {
            await client.rpc("discard_empty_feedback", {
              p_feedback_id: feedbackId,
            });
          } catch {
            // Server-side limits and ownership rules keep an orphan private.
          }
          throw error;
        }
      },

      async isAdmin() {
        return Boolean(assertResult(await client.rpc("is_admin")));
      },

      async loadAdminDashboard() {
        await recordAdminAccess("dashboard.view", "dashboard");
        return assertResult(await client.rpc("admin_dashboard"));
      },

      async loadAdminUsers(search = "", limit = 100, offset = 0) {
        await recordAdminAccess("users.list", "user", null, {
          searchLength: String(search ?? "").length,
          limit,
          offset,
        });
        return assertResult(await client.rpc("admin_user_list", {
          p_search: search,
          p_limit: limit,
          p_offset: offset,
        }));
      },

      async loadAdminUserDetail(userId) {
        await recordAdminAccess("users.detail", "user", String(userId ?? ""));
        return assertResult(await client.rpc("admin_user_detail", {
          p_user_id: userId,
        }));
      },

      async loadAdminFeedback(status = null, limit = 100, offset = 0) {
        await recordAdminAccess("feedback.list", "feedback", null, {
          status,
          limit,
          offset,
        });
        for (let pass = 0; pass < 10; pass += 1) {
          const expired = assertResult(await client.rpc("admin_expired_feedback", {
            p_limit: 100,
          })) ?? [];
          if (!expired.length) break;
          const paths = [...new Set(
            expired.flatMap((item) =>
              Array.isArray(item.imagePaths) ? item.imagePaths : []),
          )];
          for (let index = 0; index < paths.length; index += 100) {
            assertResult(
              await client.storage
                .from(FEEDBACK_BUCKET)
                .remove(paths.slice(index, index + 100)),
            );
          }
          assertResult(await client.rpc("admin_delete_expired_feedback", {
            p_feedback_ids: expired.map((item) => item.id),
          }));
          if (expired.length < 100) break;
        }
        const result = assertResult(await client.rpc("admin_feedback_list", {
          p_status: status,
          p_limit: limit,
          p_offset: offset,
        })) ?? { items: [], total: 0 };
        const paths = [...new Set(
          (result.items ?? []).flatMap((item) =>
            Array.isArray(item.imagePaths) ? item.imagePaths : []),
        )];
        const urlsByPath = new Map();
        if (paths.length) {
          const signed = assertResult(
            await client.storage.from(FEEDBACK_BUCKET).createSignedUrls(paths, 3600),
          ) ?? [];
          paths.forEach((path, index) => {
            urlsByPath.set(path, signed[index]?.signedUrl ?? null);
          });
        }
        return {
          ...result,
          items: (result.items ?? []).map((item) => ({
            ...item,
            images: (item.imagePaths ?? [])
              .map((path) => ({ path, url: urlsByPath.get(path) }))
              .filter((image) => image.url),
          })),
        };
      },

      async updateFeedbackStatus(feedbackId, status) {
        const result = assertResult(await client.rpc("admin_update_feedback_status", {
          p_feedback_id: feedbackId,
          p_status: status,
        }));
        await recordAdminAccess(
          "feedback.status.update",
          "feedback",
          String(feedbackId ?? ""),
          { status },
        );
        return result;
      },

      async replyToFeedback(feedbackId, message) {
        return assertResult(await client.rpc("admin_reply_feedback", {
          p_feedback_id: feedbackId,
          p_message: message,
        }));
      },

      async loadAdminAnnouncements(limit = 100) {
        await recordAdminAccess("announcements.list", "announcement", null, {
          limit,
        });
        const result = assertResult(await client.rpc("admin_announcement_list", {
          p_limit: limit,
        }));
        return hydrateAnnouncementImages(result);
      },

      async publishAnnouncement(title, body, files = []) {
        const images = Array.from(files ?? []);
        if (images.length > 4) {
          throw new Error("每条公告最多上传 4 张图片。");
        }

        const announcementId = createUuid();
        const uploadedPaths = [];
        let rpcStarted = false;
        try {
          for (const [index, file] of images.entries()) {
            const extension = FEEDBACK_IMAGE_TYPES.get(file.type);
            if (!extension) throw new Error("仅支持 JPG、PNG 或 WebP 图片。");
            if (file.size > 5 * 1024 * 1024) {
              throw new Error("每张图片不能超过 5 MB。");
            }
            const path = `${announcementId}/${index + 1}.${extension}`;
            assertResult(
              await client.storage.from(ANNOUNCEMENT_BUCKET).upload(path, file, {
                cacheControl: "31536000",
                contentType: file.type,
                upsert: false,
              }),
            );
            uploadedPaths.push(path);
          }

          rpcStarted = true;
          return assertResult(await client.rpc("admin_publish_announcement", {
            p_title: title,
            p_body: body,
            p_announcement_id: announcementId,
            p_image_paths: uploadedPaths,
          }));
        } catch (error) {
          const commitMayHaveSucceeded = rpcStarted &&
            !error?.code &&
            !Number.isFinite(Number(error?.status));
          if (uploadedPaths.length && !commitMayHaveSucceeded) {
            try {
              await client.storage.from(ANNOUNCEMENT_BUCKET).remove(uploadedPaths);
            } catch {
              // Orphaned files remain unlisted and use an unguessable UUID path.
            }
          }
          throw error;
        }
      },

      async deleteAnnouncement(announcementId) {
        const normalizedId = String(announcementId ?? "").trim();
        if (!UUID_PATTERN.test(normalizedId)) {
          throw new Error("公告编号无效。");
        }

        const result = assertResult(
          await client.rpc("admin_delete_announcement", {
            p_announcement_id: normalizedId,
          }),
        );
        const imagePaths = Array.isArray(result?.imagePaths)
          ? result.imagePaths.filter((path) => {
            const normalizedPath = String(path ?? "").trim();
            return normalizedPath.startsWith(`${normalizedId}/`) &&
              ANNOUNCEMENT_IMAGE_PATH.test(normalizedPath);
          })
          : [];
        let imageCleanupFailed = false;
        if (result?.deleted && imagePaths.length) {
          try {
            assertResult(
              await client.storage
                .from(ANNOUNCEMENT_BUCKET)
                .remove(imagePaths),
            );
          } catch {
            imageCleanupFailed = true;
          }
        }
        return {
          ...result,
          imageCleanupFailed,
        };
      },

      async setUserMembershipDays(userId, days) {
        return assertResult(await client.rpc("admin_set_membership_days", {
          p_user_id: userId,
          p_days: days,
        }));
      },

      async extendAllMemberships() {
        return assertResult(await client.rpc("admin_extend_all_memberships"));
      },
    };
  },
};
