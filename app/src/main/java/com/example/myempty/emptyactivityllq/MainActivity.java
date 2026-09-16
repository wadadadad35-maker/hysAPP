package com.example.myempty.emptyactivityllq;

import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.DocumentsContract;
import android.provider.Settings;
import android.util.Base64;
import android.view.KeyEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Paths;

public class MainActivity extends AppCompatActivity {

    private WebView webView;
    private ValueCallback<Uri[]> uploadMessage;
    private final static int FILECHOOSER_RESULTCODE = 1;
    private final static int FOLDER_CHOOSER_RESULTCODE = 2;

    // ========== 视频全屏相关 ==========
    private View customView;                          // 全屏时系统给的 View
    private WebChromeClient.CustomViewCallback customViewCallback;
    private int originalSystemUiVisibility;
    private FrameLayout fullscreenContainer;          // 全屏容器
    /** 前端选择的全屏方向：landscape / portrait / auto */
    private String preferredFsOrientation = "auto";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // 根布局：普通时只放 WebView，全屏时再叠一层
        FrameLayout root = new FrameLayout(this);
        webView = new WebView(this);
        root.addView(webView, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT));
        setContentView(root);

        requestStoragePermission();

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setAllowFileAccessFromFileURLs(true);
        settings.setAllowUniversalAccessFromFileURLs(true);
        // 允许视频自动播放（减少手势限制）
        settings.setMediaPlaybackRequiresUserGesture(false);
        // 硬件加速对视频全屏很重要
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
            webView.setLayerType(View.LAYER_TYPE_HARDWARE, null);
        }

        webView.setWebViewClient(new WebViewClient());

        // 绑定 JSBridge
        webView.addJavascriptInterface(new AndroidFS(), "AndroidFS");

        // ========== 关键：完整 WebChromeClient，支持视频全屏 ==========
        webView.setWebChromeClient(new WebChromeClient() {

            @Override
            public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> filePathCallback, FileChooserParams fileChooserParams) {
                if (uploadMessage != null) {
                    uploadMessage.onReceiveValue(null);
                }
                uploadMessage = filePathCallback;

                Intent intent = fileChooserParams.createIntent();
                try {
                    startActivityForResult(intent, FILECHOOSER_RESULTCODE);
                } catch (Exception e) {
                    uploadMessage = null;
                    return false;
                }
                return true;
            }

            /**
             * HTML5 视频进入全屏时系统会回调这里
             */
            @Override
            public void onShowCustomView(View view, CustomViewCallback callback) {
                // 已经有全屏视图则先关掉
                if (customView != null) {
                    onHideCustomView();
                    return;
                }

                customView = view;
                customViewCallback = callback;

                // 按前端选择的方向进入全屏（横屏 / 竖屏 / 不强制）
                applyPreferredOrientation();

                // 隐藏系统状态栏 / 导航栏，进入沉浸式
                originalSystemUiVisibility = getWindow().getDecorView().getSystemUiVisibility();
                getWindow().getDecorView().setSystemUiVisibility(
                        View.SYSTEM_UI_FLAG_FULLSCREEN
                                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                                | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                                | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                );
                getWindow().addFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN);

                // 把全屏 View 加到最上层
                FrameLayout.LayoutParams params = new FrameLayout.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.MATCH_PARENT);
                ((FrameLayout) getWindow().getDecorView()).addView(customView, params);

                // 通知前端已进入真全屏
                if (webView != null) {
                    webView.evaluateJavascript(
                            "window.__nativeVideoFullscreen = true;" +
                            "if(typeof window.onNativeVideoFullscreen==='function')window.onNativeVideoFullscreen(true);",
                            null);
                }
            }

            /**
             * 退出全屏
             */
            @Override
            public void onHideCustomView() {
                if (customView == null) return;

                // 恢复系统 UI
                getWindow().getDecorView().setSystemUiVisibility(originalSystemUiVisibility);
                getWindow().clearFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN);

                // 恢复自动方向
                setRequestedOrientation(android.content.pm.ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED);

                // 移除全屏 View
                ((FrameLayout) getWindow().getDecorView()).removeView(customView);
                customView = null;

                if (customViewCallback != null) {
                    customViewCallback.onCustomViewHidden();
                    customViewCallback = null;
                }

                // 通知前端已退出真全屏
                if (webView != null) {
                    webView.evaluateJavascript(
                            "window.__nativeVideoFullscreen = false;" +
                            "if(typeof window.onNativeVideoFullscreen==='function')window.onNativeVideoFullscreen(false);",
                            null);
                }
            }
        });

        // 只有全新启动时加载 URL
        if (savedInstanceState == null) {
            webView.loadUrl("file:///android_asset/index.html");
        } else {
            webView.restoreState(savedInstanceState);
        }
    }

    @Override
    protected void onSaveInstanceState(@NonNull Bundle outState) {
        super.onSaveInstanceState(outState);
        if (webView != null) {
            webView.saveState(outState);
        }
    }

    /**
     * 返回键：优先退出视频全屏，其次 WebView 后退，最后移到后台
     */
    @Override
    public void onBackPressed() {
        // 1. 如果正在视频全屏，先退出全屏
        if (customView != null) {
            webView.getWebChromeClient().onHideCustomView();
            return;
        }
        // 2. WebView 可后退
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            moveTaskToBack(true);
        }
    }

    /**
     * 音量键逻辑：
     * - 视频处于【真全屏】时 → 不拦截，让系统正常调音量
     * - 其它情况（看图/普通媒体）→ 拦截并转发给 JS 做上下翻页
     */
    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_VOLUME_UP || keyCode == KeyEvent.KEYCODE_VOLUME_DOWN) {

            // ★ 真全屏时放行，让系统调音量
            if (customView != null) {
                return super.onKeyDown(keyCode, event);
            }

            // 非全屏：转发给前端做翻页
            String keyName = (keyCode == KeyEvent.KEYCODE_VOLUME_UP) ? "AudioVolumeUp" : "AudioVolumeDown";
            if (webView != null) {
                webView.evaluateJavascript(
                        "window.dispatchEvent(new KeyboardEvent('keydown', {key: '" + keyName + "', keyCode: " + keyCode + "}));",
                        null
                );
            }
            return true; // 拦截系统默认音量行为
        }
        return super.onKeyDown(keyCode, event);
    }

    /** 根据 preferredFsOrientation 设置 Activity 方向 */
    private void applyPreferredOrientation() {
        if ("landscape".equals(preferredFsOrientation)) {
            setRequestedOrientation(android.content.pm.ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE);
        } else if ("portrait".equals(preferredFsOrientation)) {
            setRequestedOrientation(android.content.pm.ActivityInfo.SCREEN_ORIENTATION_SENSOR_PORTRAIT);
        }
        // auto：不强制改方向
    }

    private void requestStoragePermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            if (!Environment.isExternalStorageManager()) {
                Intent intent = new Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION);
                intent.setData(Uri.parse("package:" + getPackageName()));
                startActivity(intent);
            }
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == FILECHOOSER_RESULTCODE) {
            if (uploadMessage == null) return;
            uploadMessage.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(resultCode, data));
            uploadMessage = null;
            return;
        }
        // 系统文件夹选择器回调
        if (requestCode == FOLDER_CHOOSER_RESULTCODE) {
            if (resultCode == RESULT_OK && data != null && data.getData() != null) {
                Uri treeUri = data.getData();
                // 持久化权限，方便以后再次访问
                final int takeFlags = data.getFlags()
                        & (Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
                try {
                    getContentResolver().takePersistableUriPermission(treeUri, takeFlags);
                } catch (Exception ignored) {}

                String realPath = resolveTreeUriToPath(treeUri);
                if (realPath != null && !realPath.isEmpty()) {
                    // 回调前端：window.onFolderPicked(path)
                    final String pathForJs = realPath.replace("\\", "\\\\").replace("'", "\\'");
                    if (webView != null) {
                        webView.post(() -> webView.evaluateJavascript(
                                "if(typeof window.onFolderPicked==='function')window.onFolderPicked('" + pathForJs + "');",
                                null));
                    }
                } else {
                    if (webView != null) {
                        webView.post(() -> webView.evaluateJavascript(
                                "if(typeof window.onFolderPicked==='function')window.onFolderPicked(null);" +
                                "alert('无法解析该文件夹的真实路径，请改用「手动输入路径」或选择内部存储下的目录。');",
                                null));
                    }
                }
            }
        }
    }

    /**
     * 将 ACTION_OPEN_DOCUMENT_TREE 返回的 content:// URI 尽量转成真实文件系统路径。
     * 在已授予 MANAGE_EXTERNAL_STORAGE 时，主存储上的路径通常可正确解析。
     */
    private String resolveTreeUriToPath(Uri uri) {
        if (uri == null) return null;
        try {
            String docId = DocumentsContract.getTreeDocumentId(uri);
            if (docId == null) return null;
            // 形如 primary:Documents/Notes  或  XXXX-XXXX:DCIM
            String[] split = docId.split(":", 2);
            if (split.length < 2) {
                // 有些机型可能只有 volume id
                if ("primary".equalsIgnoreCase(docId)) {
                    return Environment.getExternalStorageDirectory().getAbsolutePath();
                }
                return null;
            }
            String type = split[0];
            String relative = split[1];
            if ("primary".equalsIgnoreCase(type)) {
                File base = Environment.getExternalStorageDirectory();
                if (relative == null || relative.isEmpty()) {
                    return base.getAbsolutePath();
                }
                return new File(base, relative).getAbsolutePath();
            } else {
                // 外置 SD 卡等：/storage/<uuid>/<relative>
                File storageRoot = new File("/storage/" + type);
                if (relative == null || relative.isEmpty()) {
                    return storageRoot.getAbsolutePath();
                }
                return new File(storageRoot, relative).getAbsolutePath();
            }
        } catch (Exception e) {
            e.printStackTrace();
            return null;
        }
    }

    // ==================== JSBridge 原生文件系统接口类 ====================
    public class AndroidFS {

        @JavascriptInterface
        public String scanDirectory(String dirPath) {
            JSONArray result = new JSONArray();
            File root = new File(dirPath);
            if (root.exists() && root.isDirectory()) {
                scanRecursive(root, root.getAbsolutePath(), result);
            }
            return result.toString();
        }

        private void scanRecursive(File dir, String rootPath, JSONArray result) {
            File[] files = dir.listFiles();
            if (files == null) return;
            for (File f : files) {
                try {
                    JSONObject obj = new JSONObject();
                    obj.put("fullPath", f.getAbsolutePath());
                    obj.put("relativePath", f.getAbsolutePath().substring(rootPath.length() + 1).replace("\\", "/"));
                    obj.put("name", f.getName());

                    if (f.isDirectory()) {
                        obj.put("isFolder", true);
                        result.put(obj);
                        scanRecursive(f, rootPath, result);
                    } else {
                        obj.put("isFolder", false);
                        result.put(obj);
                    }
                } catch (Exception ignored) {}
            }
        }

        @JavascriptInterface
        public String readFile(String fullPath) {
            try {
                return new String(Files.readAllBytes(Paths.get(fullPath)), StandardCharsets.UTF_8);
            } catch (Exception e) {
                return "";
            }
        }

        @JavascriptInterface
        public boolean writeFile(String fullPath, String content) {
            try {
                File file = new File(fullPath);
                if (file.getParentFile() != null && !file.getParentFile().exists()) {
                    file.getParentFile().mkdirs();
                }
                Files.write(Paths.get(fullPath), content.getBytes(StandardCharsets.UTF_8));
                return true;
            } catch (Exception e) {
                return false;
            }
        }

        @JavascriptInterface
        public boolean writeBase64File(String fullPath, String base64Data) {
            try {
                File file = new File(fullPath);
                if (file.getParentFile() != null && !file.getParentFile().exists()) {
                    file.getParentFile().mkdirs();
                }
                if (base64Data != null && base64Data.contains(",")) {
                    base64Data = base64Data.split(",")[1];
                }
                byte[] bytes = Base64.decode(base64Data, Base64.DEFAULT);
                Files.write(Paths.get(fullPath), bytes);
                return true;
            } catch (Exception e) {
                e.printStackTrace();
                return false;
            }
        }

        @JavascriptInterface
        public boolean copyFile(String srcPath, String destPath) {
            try {
                File srcFile = new File(srcPath);
                File destFile = new File(destPath);
                if (!srcFile.exists()) return false;
                if (destFile.getParentFile() != null && !destFile.getParentFile().exists()) {
                    destFile.getParentFile().mkdirs();
                }
                try (InputStream in = new FileInputStream(srcFile);
                     OutputStream out = new FileOutputStream(destFile)) {
                    byte[] buffer = new byte[8192];
                    int bytesRead;
                    while ((bytesRead = in.read(buffer)) != -1) {
                        out.write(buffer, 0, bytesRead);
                    }
                }
                return true;
            } catch (Exception e) {
                e.printStackTrace();
                return false;
            }
        }

        @JavascriptInterface
        public boolean deleteFileOrFolder(String fullPath) {
            try {
                File file = new File(fullPath);
                if (!file.exists()) return true;
                return deleteRecursive(file);
            } catch (Exception e) {
                return false;
            }
        }

        private boolean deleteRecursive(File fileOrDir) {
            if (fileOrDir.isDirectory()) {
                File[] children = fileOrDir.listFiles();
                if (children != null) {
                    for (File child : children) {
                        deleteRecursive(child);
                    }
                }
            }
            return fileOrDir.delete();
        }

        @JavascriptInterface
        public boolean renameFileOrFolder(String oldPath, String newPath) {
            try {
                File oldFile = new File(oldPath);
                File newFile = new File(newPath);
                if (newFile.getParentFile() != null && !newFile.getParentFile().exists()) {
                    newFile.getParentFile().mkdirs();
                }
                return oldFile.renameTo(newFile);
            } catch (Exception e) {
                return false;
            }
        }

        @JavascriptInterface
        public boolean createFolder(String fullPath) {
            try {
                File folder = new File(fullPath);
                if (!folder.exists()) {
                    return folder.mkdirs();
                }
                return true;
            } catch (Exception e) {
                return false;
            }
        }

        /**
         * 打开系统文件夹选择器（ACTION_OPEN_DOCUMENT_TREE）
         * 选中后会通过 window.onFolderPicked(path) 回调前端真实路径
         */
        @JavascriptInterface
        public void pickFolder() {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    try {
                        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
                        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION
                                | Intent.FLAG_GRANT_WRITE_URI_PERMISSION
                                | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);
                        startActivityForResult(intent, FOLDER_CHOOSER_RESULTCODE);
                    } catch (Exception e) {
                        e.printStackTrace();
                        if (webView != null) {
                            webView.evaluateJavascript(
                                    "alert('无法打开系统文件夹选择器，请改用手动输入路径。');",
                                    null);
                        }
                    }
                }
            });
        }

        /**
         * 前端选择全屏方向：landscape / portrait / auto
         * 必须在 UI 线程改 orientation
         */
        @JavascriptInterface
        public void setFullscreenOrientation(final String mode) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    if (mode == null || mode.isEmpty() || "auto".equals(mode)) {
                        preferredFsOrientation = "auto";
                        setRequestedOrientation(android.content.pm.ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED);
                    } else if ("landscape".equals(mode)) {
                        preferredFsOrientation = "landscape";
                        setRequestedOrientation(android.content.pm.ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE);
                    } else if ("portrait".equals(mode)) {
                        preferredFsOrientation = "portrait";
                        setRequestedOrientation(android.content.pm.ActivityInfo.SCREEN_ORIENTATION_SENSOR_PORTRAIT);
                    }
                }
            });
        }
    }
}
