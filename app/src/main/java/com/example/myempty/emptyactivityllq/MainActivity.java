package com.example.myempty.emptyactivityllq;

import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.Settings;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Paths;

public class MainActivity extends AppCompatActivity {

    private WebView webView;
    private ValueCallback<Uri[]> uploadMessage;
    private final static int FILECHOOSER_RESULTCODE = 1;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        webView = new WebView(this);
        setContentView(webView);

        requestStoragePermission();

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setAllowFileAccessFromFileURLs(true);
        settings.setAllowUniversalAccessFromFileURLs(true);

        webView.setWebViewClient(new WebViewClient());

        // 🔑 绑定 JSBridge 原生文件读写接口对象
        webView.addJavascriptInterface(new AndroidFS(), "AndroidFS");

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
        });

        // 🔑 只有全新启动时加载 URL，避免销毁重建或恢复时强制刷新页面
        if (savedInstanceState == null) {
            webView.loadUrl("file:///android_asset/index.html");
        } else {
            webView.restoreState(savedInstanceState);
        }
    }

    // 🔑 保存 WebView 内部状态
    @Override
    protected void onSaveInstanceState(@NonNull Bundle outState) {
        super.onSaveInstanceState(outState);
        if (webView != null) {
            webView.saveState(outState);
        }
    }

    // 🔑 重写返回键：页面不能后退时直接切入后台（不销毁 Activity）
    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            // 将当前 Task 移到后台，保持 Activity 存活
            moveTaskToBack(true);
        }
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
        }
    }

    // ==================== JSBridge 原生文件系统接口类 ====================
    public class AndroidFS {

        // 递归扫描指定目录
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

        // 读取绝对路径文本内容
        @JavascriptInterface
        public String readFile(String fullPath) {
            try {
                return new String(Files.readAllBytes(Paths.get(fullPath)), StandardCharsets.UTF_8);
            } catch (Exception e) {
                return "";
            }
        }

        // 直接写回绝对路径文件
        @JavascriptInterface
        public boolean writeFile(String fullPath, String content) {
            try {
                File file = new File(fullPath);
                if (!file.getParentFile().exists()) {
                    file.getParentFile().mkdirs();
                }
                Files.write(Paths.get(fullPath), content.getBytes(StandardCharsets.UTF_8));
                return true;
            } catch (Exception e) {
                return false;
            }
        }

        // 删除文件或文件夹
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

        // 重命名或移动路径
        @JavascriptInterface
        public boolean renameFileOrFolder(String oldPath, String newPath) {
            try {
                File oldFile = new File(oldPath);
                File newFile = new File(newPath);
                if (!newFile.getParentFile().exists()) {
                    newFile.getParentFile().mkdirs();
                }
                return oldFile.renameTo(newFile);
            } catch (Exception e) {
                return false;
            }
        }

        // 新建文件夹
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
    }
}
