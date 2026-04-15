package com.privdo.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONObject;

public class PrivdoWidget extends AppWidgetProvider {

    private static final String PREFS_NAME = "group.com.privdo.app";
    private static final String KEY = "widgetTask";

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            updateWidget(context, appWidgetManager, appWidgetId);
        }
    }

    private void updateWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_privdo);

        // Read task from SharedPreferences
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String json = prefs.getString(KEY, null);

        String taskText = "No active tasks";
        String deadline = null;
        boolean completed = false;

        if (json != null) {
            try {
                // The value is a JSON string stored as a string, so it might be double-encoded
                // The bridge plugin stores it as setItem value (string)
                JSONObject task = new JSONObject(json);
                taskText = task.optString("text", "No active tasks");
                completed = task.optBoolean("completed", false);
                deadline = task.optString("deadline", null);
                if (deadline != null && deadline.equals("null")) {
                    deadline = null;
                }
            } catch (Exception e) {
                taskText = "Open Privdo to add tasks";
            }
        }

        views.setTextViewText(R.id.widget_task_text, taskText);

        if (completed) {
            views.setImageViewResource(R.id.widget_checkbox, android.R.drawable.checkbox_on_background);
        } else {
            views.setImageViewResource(R.id.widget_checkbox, android.R.drawable.checkbox_off_background);
        }

        if (deadline != null && !deadline.isEmpty()) {
            views.setTextViewText(R.id.widget_deadline, formatDeadline(deadline));
            views.setViewVisibility(R.id.widget_deadline, View.VISIBLE);
        } else {
            views.setViewVisibility(R.id.widget_deadline, View.GONE);
        }

        // Tap to open the app
        Intent intent = new Intent(context, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pendingIntent = PendingIntent.getActivity(
                context, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        views.setOnClickPendingIntent(R.id.widget_root, pendingIntent);

        appWidgetManager.updateAppWidget(appWidgetId, views);
    }

    private String formatDeadline(String deadline) {
        try {
            // Parse datetime-local format "yyyy-MM-ddTHH:mm"
            java.text.SimpleDateFormat input = new java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm", java.util.Locale.US);
            java.text.SimpleDateFormat output = new java.text.SimpleDateFormat("MMM d, h:mm a", java.util.Locale.US);
            java.util.Date date = input.parse(deadline);
            if (date != null) {
                return output.format(date);
            }
        } catch (Exception e) {
            // Fall through
        }
        return deadline;
    }
}
