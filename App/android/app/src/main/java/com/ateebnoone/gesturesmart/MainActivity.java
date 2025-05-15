package com.ateebnoone.gesturesmart;

import android.app.PictureInPictureParams;
import android.content.res.Configuration;
import android.os.Build;
import android.os.Bundle;
import android.util.Rational;
import android.view.WindowManager;

import com.facebook.react.ReactActivity;
import com.facebook.react.ReactActivityDelegate;
import com.facebook.react.ReactRootView;
import com.facebook.react.modules.core.DeviceEventManagerModule;

import expo.modules.ReactActivityDelegateWrapper;

public class MainActivity extends ReactActivity {
    private boolean isInPipMode = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        setTheme(R.style.AppTheme);
        super.onCreate(null);
        
        // Keep screen on during PiP
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
    }

    @Override
    protected String getMainComponentName() {
        return "main";
    }

    @Override
    protected ReactActivityDelegate createReactActivityDelegate() {
        return new ReactActivityDelegateWrapper(this, BuildConfig.IS_NEW_ARCHITECTURE_ENABLED,
            new MainActivityDelegate(this, getMainComponentName())
        );
    }

    @Override
    public void onPictureInPictureModeChanged(boolean isInPictureInPictureMode, Configuration newConfig) {
        super.onPictureInPictureModeChanged(isInPictureInPictureMode, newConfig);
        isInPipMode = isInPictureInPictureMode;

        // Prevent activity recreation
        if (isInPictureInPictureMode) {
            // Minimize UI elements when in PiP
            if (getSupportActionBar() != null) {
                getSupportActionBar().hide();
            }
        } else {
            // Restore UI elements when exiting PiP
            if (getSupportActionBar() != null) {
                getSupportActionBar().show();
            }
        }
    }

    @Override
    public void onUserLeaveHint() {
        // Don't call super to prevent default behavior
        if (!isInPipMode && Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            try {
                Rational aspectRatio = new Rational(16, 9);
                PictureInPictureParams.Builder params = new PictureInPictureParams.Builder();
                params.setAspectRatio(aspectRatio);
                
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    params.setAutoEnterEnabled(true);
                }
                
                enterPictureInPictureMode(params.build());
            } catch (Exception e) {
                e.printStackTrace();
            }
        }
    }

    @Override
    public void onBackPressed() {
        if (isInPipMode) {
            // Do nothing when in PiP mode
            return;
        }
        super.onBackPressed();
    }

    @Override
    public void invokeDefaultOnBackPressed() {
        if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.R) {
            if (!isInPipMode) {
                if (!moveTaskToBack(false)) {
                    super.invokeDefaultOnBackPressed();
                }
            }
            return;
        }
        super.invokeDefaultOnBackPressed();
    }

    @Override
    protected void onStop() {
        // Don't finish the activity when going to background if in PiP mode
            super.onStop();

        if (!isInPipMode) {
            super.onStop();
        }
    }

    @Override
    protected void onPause() {
        // Don't pause the activity when in PiP mode
        if (!isInPipMode) {
            super.onPause();
        }
    }

    public static class MainActivityDelegate extends ReactActivityDelegate {
        public MainActivityDelegate(ReactActivity activity, String mainComponentName) {
            super(activity, mainComponentName);
        }

        @Override
        protected ReactRootView createRootView() {
            ReactRootView reactRootView = new ReactRootView(getContext());
            reactRootView.setIsFabric(BuildConfig.IS_NEW_ARCHITECTURE_ENABLED);
            return reactRootView;
        }

        @Override
        protected boolean isConcurrentRootEnabled() {
            return BuildConfig.IS_NEW_ARCHITECTURE_ENABLED;
        }
    }
}