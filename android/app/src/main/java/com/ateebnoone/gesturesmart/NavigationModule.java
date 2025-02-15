// android/app/src/main/java/com/yourapp/NavigationModule.java

package com.ateebnoone.gesturesmart;

import android.app.Activity;
import android.content.Intent;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

public class NavigationModule extends ReactContextBaseJavaModule {
    private final ReactApplicationContext reactContext;

    public NavigationModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
    }

    @Override
    public String getName() {
        return "NavigationModule";
    }

    @ReactMethod
    public void minimizeApp() {
        Activity activity = getCurrentActivity();
        if (activity != null) {
            Intent startMain = new Intent(Intent.ACTION_MAIN);
            startMain.addCategory(Intent.CATEGORY_HOME);
            startMain.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            activity.startActivity(startMain);
        }
    }
}