# WEST-VILL Android

This is an isolated Android client for the existing WEST-VILL production PWA.

- Package ID: `com.westvill.app` (keep stable for all future releases).
- Start route: the existing production origin with `?admin=1&native=1`, which opens the current administrator login.
- Authentication and business data remain on the existing Supabase-backed WEST-VILL service.
- The PWA is not changed, disabled, or replaced by this project.
- The APK has its own WebView storage, so an administrator signs in once on each installation. The same username/password and account work on both clients.

## Release signing (required before distribution)

Never distribute a rotating debug-signed APK. Configure these GitHub Actions repository secrets before running the release workflow:

- `WV_ANDROID_KEYSTORE_BASE64`: base64-encoded, persistent release keystore.
- `WV_ANDROID_KEYSTORE_PASSWORD`
- `WV_ANDROID_KEY_ALIAS`
- `WV_ANDROID_KEY_PASSWORD`

Keep a secure offline backup of the keystore. Every future APK must use this exact key, package ID, and a higher `versionCode`, or Android may reject an in-place update.

## Push notifications — not enabled yet

The first Android shell does not yet receive native remote push. That requires a WEST-VILL Firebase project, the matching Android app registration, FCM configuration, and a server-side sender integrated with the existing authenticated message flow. Until that is configured and tested, the current PWA push path remains untouched and operational.

## Native push notification flow

- Android uses Firebase Cloud Messaging through `FirebaseMessagingService`.
- The WebView observes the existing Supabase Auth session and sends its short-lived access token to a JavaScript bridge; the bridge registers the current FCM device token with the authenticated `westvill-fcm-register` Edge Function.
- Device tokens are stored in `public.westvill_fcm_tokens`, protected by RLS and writable only by the Edge Function's service role.
- The existing `westvill-push` function keeps its Web Push delivery and additionally sends Android data messages when the `FCM_SERVICE_ACCOUNT_JSON` secret is configured in Supabase.
- Android 13+ asks the user for notification permission. The initial channel is `westvill_alerts_v1`; Android channel sound/importance can be changed by the device owner in system settings.

## Remaining server credential step

The Firebase service-account private key is **not** part of the Android app and must never be committed to GitHub or shipped in the APK. In Firebase Project Settings > Service Accounts, generate a private key for the `west-vill` project. Store the complete JSON securely as the Supabase Edge Function secret named `FCM_SERVICE_ACCOUNT_JSON` for project `wihbxfebobfmohmqqhkt`. Grant the service account the Firebase Cloud Messaging Admin role if it does not already have permission to send messages.

Until that secret is configured, PWA Web Push remains operational and the FCM sender safely reports itself as not configured.
