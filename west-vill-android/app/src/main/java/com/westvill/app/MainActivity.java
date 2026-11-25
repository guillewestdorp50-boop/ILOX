package com.westvill.app;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.media.MediaPlayer;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.media.AudioAttributes;
import android.os.Build;
import android.os.Bundle;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;
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
    private static final String PREF_SOUND_ID = "notification_sound_id";
    private static final String[] SOUND_IDS = {"pichon"};
    private static final String[] SOUND_NAMES = {"Pichón de WEST-VILL"};
    private final ExecutorService network = Executors.newSingleThreadExecutor();
    private WebView webView;

    public class PushBridge {
        @JavascriptInterface
        public void registerSessionToken(String accessToken) {
            if (accessToken == null || accessToken.length() < 40 || accessToken.length() > 10000) return;
            FirebaseMessaging.getInstance().getToken().addOnSuccessListener(fcmToken ->
                    network.execute(() -> registerFcmToken(accessToken, fcmToken)));
        }

        @JavascriptInterface
        public void openSoundPicker() {
            runOnUiThread(() -> MainActivity.this.showSoundPicker());
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
                adaptNativeNotificationsUi(view);
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

    private void adaptNativeNotificationsUi(WebView view) {
        // En Android se usa el selector nativo. Ocultar el aviso y la activación
        // push de navegador, pero conservar el botón original de sonido.
        String script = "(function(){if(window.__wvNativeUiObserver)return;window.__wvNativeUiObserver=true;"
                + "var apply=function(){"
                + "var status=document.getElementById('wv-admin-push-status');"
                + "var enable=document.getElementById('wv-admin-push-enable');"
                + "var sound=document.getElementById('wv-admin-sound-preview');"
                + "if(status)status.style.display='none';"
                + "if(enable)enable.style.display='none';"
                + "if(sound){if(sound.textContent!=='ESCUCHAR Y SELECCIONAR SONIDO')sound.textContent='ESCUCHAR Y SELECCIONAR SONIDO';"
                + "if(sound.dataset.wvNativeSoundBound!=='1'){sound.dataset.wvNativeSoundBound='1';"
                + "sound.addEventListener('click',function(e){e.preventDefault();e.stopImmediatePropagation();"
                + "try{if(window.WestVillPushBridge)window.WestVillPushBridge.openSoundPicker();}"
                + "catch(err){console.warn('Selector de sonido nativo:',err);}},true);}}"
                + "};"
                + "var observer=new MutationObserver(apply);"
                + "observer.observe(document.documentElement,{childList:true,subtree:true});"
                + "apply();})();";
        view.evaluateJavascript(script, null);
    }

    static String selectedSoundId(android.content.Context context) {
        return context.getSharedPreferences("westvill_fcm", MODE_PRIVATE)
                .getString(PREF_SOUND_ID, "pichon");
    }

    static String notificationChannelId(String soundId) {
        return "westvill_alerts_sound_" + soundId + "_v1";
    }

    static int soundResourceId(android.content.Context context, String soundId) {
        return R.raw.westvill_pichon;
    }

    private void showSoundPicker() {
        LinearLayout content = new LinearLayout(this);
        content.setOrientation(LinearLayout.VERTICAL);
        int pad = (int) (20 * getResources().getDisplayMetrics().density);
        content.setPadding(pad, pad / 2, pad, 0);

        TextView description = new TextView(this);
        description.setText("Escuchá cada sonido y elegí cuál querés para tus alertas de viajes.");
        description.setTextSize(15);
        content.addView(description);

        String selected = selectedSoundId(this);
        for (int i = 0; i < SOUND_IDS.length; i++) {
            final String soundId = SOUND_IDS[i];
            final String soundName = SOUND_NAMES[i];
            LinearLayout item = new LinearLayout(this);
            item.setOrientation(LinearLayout.VERTICAL);
            item.setPadding(0, pad / 2, 0, pad / 2);

            TextView name = new TextView(this);
            name.setText(soundName + (soundId.equals(selected) ? "  ✓ SELECCIONADO" : ""));
            name.setTextSize(16);
            name.setTypeface(null, android.graphics.Typeface.BOLD);
            item.addView(name);

            LinearLayout actions = new LinearLayout(this);
            actions.setOrientation(LinearLayout.HORIZONTAL);
            Button listen = new Button(this);
            listen.setText("ESCUCHAR");
            Button choose = new Button(this);
            choose.setText("ELEGIR");
            actions.addView(listen, new LinearLayout.LayoutParams(0,
                    ViewGroup.LayoutParams.WRAP_CONTENT, 1));
            actions.addView(choose, new LinearLayout.LayoutParams(0,
                    ViewGroup.LayoutParams.WRAP_CONTENT, 1));
            item.addView(actions);
            content.addView(item);

            listen.setOnClickListener(v -> playSoundPreview(soundId));
            choose.setOnClickListener(v -> {
                getSharedPreferences("westvill_fcm", MODE_PRIVATE).edit()
                        .putString(PREF_SOUND_ID, soundId).apply();
                createNotificationChannel();
                Toast.makeText(this, soundName + " seleccionado", Toast.LENGTH_SHORT).show();
                ((android.app.Dialog) content.getTag()).dismiss();
            });
        }

        AlertDialog dialog = new AlertDialog.Builder(this)
                .setTitle("SONIDOS WEST-VILL")
                .setView(content)
                .setNegativeButton("CERRAR", null)
                .create();
        content.setTag(dialog);
        dialog.show();
    }

    private void playSoundPreview(String soundId) {
        try {
            MediaPlayer player = MediaPlayer.create(this, soundResourceId(this, soundId));
            if (player == null) return;
            player.setOnCompletionListener(MediaPlayer::release);
            player.setOnErrorListener((mp, what, extra) -> {
                mp.release();
                return true;
            });
            player.start();
        } catch (Exception error) {
            Toast.makeText(this, "No se pudo reproducir el sonido", Toast.LENGTH_SHORT).show();
        }
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager == null) return;
        String soundId = selectedSoundId(this);
        String channelId = notificationChannelId(soundId);
        if (manager.getNotificationChannel(channelId) != null) return;
        NotificationChannel channel = new NotificationChannel(
                channelId, "Alertas WEST-VILL — " + soundId, NotificationManager.IMPORTANCE_HIGH);
        channel.setDescription("Mensajes y avisos de viajes de WEST-VILL");
        channel.enableVibration(true);
        channel.setSound(
                Uri.parse("android.resource://" + getPackageName() + "/" + soundResourceId(this, soundId)),
                new AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build());
        manager.createNotificationChannel(channel);
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
