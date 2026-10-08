package com.sensevocab.android;

import android.app.Activity;
import android.os.Bundle;
import android.widget.TextView;

public final class MainActivity extends Activity {
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        TextView view = new TextView(this);
        view.setText("Sense Vocab\nOffline vocabulary and local learning storage are initialized by the native layer.");
        view.setPadding(32, 64, 32, 32);
        setContentView(view);
    }
}
