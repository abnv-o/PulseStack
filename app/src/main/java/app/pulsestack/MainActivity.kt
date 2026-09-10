package app.pulsestack

import android.annotation.SuppressLint
import android.graphics.Color
import android.os.Bundle
import android.webkit.JavascriptInterface
import android.webkit.WebView
import androidx.activity.ComponentActivity
import androidx.activity.addCallback
import androidx.core.view.WindowCompat

/** The game is `assets/index.html`; this activity is a full-screen WebView around it. */
class MainActivity : ComponentActivity() {
    private lateinit var web: WebView

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        WindowCompat.setDecorFitsSystemWindows(window, false)
        window.statusBarColor = Color.TRANSPARENT
        window.navigationBarColor = Color.TRANSPARENT
        web = WebView(this).apply {
            setBackgroundColor(0xFF0B0F1A.toInt())
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true            // best score + options live in localStorage
            settings.mediaPlaybackRequiresUserGesture = false
            isHapticFeedbackEnabled = false
            addJavascriptInterface(Bridge(), "Android")
            loadUrl("file:///android_asset/index.html")
        }
        setContentView(web)
        onBackPressedDispatcher.addCallback(this) {
            web.evaluateJavascript("window.onBack && window.onBack()") { handled ->
                if (handled != "true") { isEnabled = false; onBackPressedDispatcher.onBackPressed(); isEnabled = true }
            }
        }
    }

    override fun onPause() { super.onPause(); web.onPause() }
    override fun onResume() { super.onResume(); web.onResume() }

    inner class Bridge {
        @JavascriptInterface fun version(): String = BuildConfig.VERSION_NAME
    }
}
