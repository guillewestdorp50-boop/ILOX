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
