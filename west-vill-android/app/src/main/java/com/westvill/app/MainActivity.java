package com.westvill.app;

import android.Manifest;
import android.app.Activity;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;

import com.google.firebase.messaging.FirebaseMessaging;

import org.json.JSONObject;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class MainActivity extends Activity {
    private static final String APP_HOST = "west-vill-production.onrender.com";
    private static final String START_URL = "https://west-vill-production.onrender.com/?admin=1&native=1";
    private static final String SUPABASE_URL = "https://wihbxfebobfmohmqqhkt.supabase.co";
    private static final String SUPABASE_PUBLIC_KEY = "sb_publishable_CmPT-xSeIUUtTUArdIYDgA_jhXY8nuZ";
    static final String EXTRA_TARGET_URL = "westvill_target_url";
    private static final int REQUEST_POST_NOTIFICATIONS = 701;
    private final ExecutorService network = Executors.newSingleThreadExecutor();
    private WebView webView;

    public class PushBridge {
        @JavascriptInterface
        public void registerSessionToken(String accessToken) {
            if (accessToken == null || accessToken.length() < 40 || accessToken.length() > 10000) return;
            FirebaseMessaging.getInstance().getToken().addOnSuccessListener(fcmToken ->
                    network.execute(() -> registerFcmToken(accessToken, fcmToken)));
        }
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        CookieManager cookies = CookieManager.getInstance();
        cookies.setAcceptCookie(true);

        webView = new WebView(this);
        webView.setBackgroundColor(0xFF101E35);
        webView.setOverScrollMode(WebView.OVER_SCROLL_NEVER);
        webView.addJavascriptInterface(new PushBridge(), "WestVillPushBridge");

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setLoadsImagesAutomatically(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setSupportMultipleWindows(false);
        settings.setMediaPlaybackRequiresUserGesture(true);

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if ("https".equalsIgnoreCase(uri.getScheme()) && APP_HOST.equalsIgnoreCase(uri.getHost())) {
                    return false;
                }
                if ("http".equalsIgnoreCase(uri.getScheme()) || "https".equalsIgnoreCase(uri.getScheme())
                        || "tel".equalsIgnoreCase(uri.getScheme()) || "mailto".equalsIgnoreCase(uri.getScheme())) {
                    try { startActivity(new Intent(Intent.ACTION_VIEW, uri)); } catch (Exception ignored) { }
                    return true;
                }
                return true;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                Uri uri = Uri.parse(url);
                if (!APP_HOST.equalsIgnoreCase(uri.getHost())) return;
                installAuthListener();
                createNotificationChannel();
                requestNotificationPermission();
                String target = getIntent().getStringExtra(EXTRA_TARGET_URL);
                if (target != null && target.startsWith("https://" + APP_HOST + "/")) {
                    getIntent().removeExtra(EXTRA_TARGET_URL);
                    view.postDelayed(() -> view.loadUrl(target), 250);
                }
            }
        });
        webView.setWebChromeClient(new WebChromeClient());
        setContentView(webView);

        if (WebViewFeature.isFeatureSupported(WebViewFeature.SAFE_BROWSING_ENABLE)) {
            WebViewCompat.startSafeBrowsing(this, success -> loadApp());
        } else {
            loadApp();
        }
    }

    private void installAuthListener() {
        String script = "(function(){if(window.__wvNativeFcmHook)return;var tries=0;function attach(){"
                + "if(window.wvSupabase&&window.wvSupabase.auth&&window.WestVillPushBridge){"
                + "window.__wvNativeFcmHook=true;"
                + "var send=function(s){if(s&&s.access_token){try{window.WestVillPushBridge.registerSessionToken(s.access_token);}catch(e){}}};"
                + "window.wvSupabase.auth.getSession().then(function(r){send(r.data&&r.data.session);});"
                + "window.wvSupabase.auth.onAuthStateChange(function(e,s){send(s);});return;}"
                + "if(++tries<60)setTimeout(attach,500);}attach();})();";
        webView.evaluateJavascript(script, null);
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager != null && manager.getNotificationChannel("westvill_alerts_v1") == null) {
            NotificationChannel channel = new NotificationChannel(
                    "westvill_alerts_v1", "Alertas de WEST-VILL", NotificationManager.IMPORTANCE_HIGH);
            channel.setDescription("Mensajes y avisos de viajes de WEST-VILL");
            channel.enableVibration(true);
            channel.setSound(android.provider.Settings.System.DEFAULT_NOTIFICATION_URI, null);
            manager.createNotificationChannel(channel);
        }
    }

    private void requestNotificationPermission() {
        if (Build.VERSION.SDK_INT >= 33 &&
                ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
                        != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(this,
                    new String[]{Manifest.permission.POST_NOTIFICATIONS}, REQUEST_POST_NOTIFICATIONS);
        }
    }

    private void registerFcmToken(String accessToken, String fcmToken) {
        HttpURLConnection connection = null;
        try {
            URL endpoint = new URL(SUPABASE_URL + "/functions/v1/westvill-fcm-register");
            connection = (HttpURLConnection) endpoint.openConnection();
            connection.setRequestMethod("POST");
            connection.setConnectTimeout(10000);
            connection.setReadTimeout(10000);
            connection.setDoOutput(true);
            connection.setRequestProperty("Content-Type", "application/json");
            connection.setRequestProperty("apikey", SUPABASE_PUBLIC_KEY);
            connection.setRequestProperty("Authorization", "Bearer " + accessToken);
            JSONObject body = new JSONObject();
            body.put("token", fcmToken);
            body.put("platform", "android");
            byte[] bytes = body.toString().getBytes(StandardCharsets.UTF_8);
            try (OutputStream out = connection.getOutputStream()) { out.write(bytes); }
            int status = connection.getResponseCode();
            android.util.Log.i("WEST-VILL-FCM", "Token registration HTTP " + status);
        } catch (Exception error) {
            android.util.Log.w("WEST-VILL-FCM", "Token registration failed", error);
        } finally {
            if (connection != null) connection.disconnect();
        }
    }

    private void loadApp() {
        if (webView != null && webView.getUrl() == null) {
            String target = getIntent().getStringExtra(EXTRA_TARGET_URL);
            if (target != null && target.startsWith("https://" + APP_HOST + "/")) {
                webView.loadUrl(target);
                getIntent().removeExtra(EXTRA_TARGET_URL);
            } else {
                webView.loadUrl(START_URL);
            }
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        String target = intent.getStringExtra(EXTRA_TARGET_URL);
        if (target != null && target.startsWith("https://" + APP_HOST + "/") && webView != null) {
            webView.loadUrl(target);
        }
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onDestroy() {
        network.shutdown();
        if (webView != null) {
            webView.stopLoading();
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }
}
