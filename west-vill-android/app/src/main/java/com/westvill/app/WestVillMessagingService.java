package com.westvill.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.net.Uri;
import android.os.Build;

import androidx.core.app.NotificationCompat;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;

public class WestVillMessagingService extends FirebaseMessagingService {
    private static final AtomicInteger NEXT_ID = new AtomicInteger(1000);

    @Override
    public void onNewToken(String token) {
        getSharedPreferences("westvill_fcm", MODE_PRIVATE).edit()
                .putString("latest_token", token).apply();
    }

    @Override
    public void onMessageReceived(RemoteMessage message) {
        Map<String, String> data = message.getData();
        String title = data.get("title");
        String body = data.get("body");
        if (title == null || title.trim().isEmpty()) title = "WEST-VILL";
        if (body == null || body.trim().isEmpty()) body = "Tenés una nueva actualización.";
        String target = data.get("url");
        showNotification(title, body, target);
    }

    private void showNotification(String title, String body, String target) {
        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null) return;
        createChannel(manager);

        Intent open = new Intent(this, MainActivity.class);
        open.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        if (target != null && target.startsWith("https://west-vill-production.onrender.com/")) {
            open.putExtra(MainActivity.EXTRA_TARGET_URL, target);
        }
        PendingIntent pending = PendingIntent.getActivity(
                this, NEXT_ID.get(), open,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        String channelId = MainActivity.notificationChannelId(MainActivity.selectedSoundId(this));
        Notification notification = new NotificationCompat.Builder(this, channelId)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setCategory(NotificationCompat.CATEGORY_MESSAGE)
                .setAutoCancel(true)
                .setContentIntent(pending)
                .build();
        manager.notify(NEXT_ID.getAndIncrement(), notification);
    }

    private void createChannel(NotificationManager manager) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        String soundId = MainActivity.selectedSoundId(this);
        String channelId = MainActivity.notificationChannelId(soundId);
        if (manager.getNotificationChannel(channelId) != null) return;
        NotificationChannel channel = new NotificationChannel(
                channelId, "Alertas WEST-VILL — " + soundId, NotificationManager.IMPORTANCE_HIGH);
        channel.setDescription("Mensajes y avisos de viajes de WEST-VILL");
        channel.enableVibration(true);
        channel.setSound(Uri.parse("android.resource://" + getPackageName() + "/" +
                        MainActivity.soundResourceId(this, soundId)),
                new AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build());
        manager.createNotificationChannel(channel);
    }
}
