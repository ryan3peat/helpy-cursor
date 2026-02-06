package com.helpyfam.app;

import android.os.Bundle;
import android.webkit.CookieManager;
import android.webkit.WebSettings;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Enable third-party cookies for OAuth flows (Clerk, Google, etc.)
        CookieManager cookieManager = CookieManager.getInstance();
        cookieManager.setAcceptCookie(true);
        cookieManager.setAcceptThirdPartyCookies(getBridge().getWebView(), true);
        
        // Flush cookies to ensure they persist
        cookieManager.flush();
        
        // Configure WebView for OAuth compatibility
        WebView webView = getBridge().getWebView();
        WebSettings webSettings = webView.getSettings();
        webSettings.setJavaScriptEnabled(true);
        webSettings.setDomStorageEnabled(true);
        webSettings.setDatabaseEnabled(true);
        webSettings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        webSettings.setAllowFileAccess(true);
        webSettings.setAllowContentAccess(true);
        
        // Critical for OAuth: allow redirects and popups
        webSettings.setJavaScriptCanOpenWindowsAutomatically(true);
        webSettings.setSupportMultipleWindows(false);
        
        // User agent – strip the '; wv' marker that Android adds to WebView UA strings.
        // Google detects this marker and blocks OAuth consent inside embedded WebViews.
        // Removing it allows the full redirect-based OAuth flow (Clerk → Google → Clerk)
        // to complete inside the Capacitor WebView without being rejected by Google.
        String userAgent = webSettings.getUserAgentString();
        userAgent = userAgent.replace("; wv", "");
        webSettings.setUserAgentString(userAgent + " HelpyApp/1.0");
    }
}
