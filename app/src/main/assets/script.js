// ==================== DOM 节点获取 ====================
const bottomSheet = document.getElementById('bottom-sheet');
const drawerOverlay = document.getElementById('drawer-overlay');
const btnOpenDrawer = document.getElementById('btn-open-drawer');
const btnCloseDrawer = document.getElementById('btn-close-drawer');

const btnCreateFile = document.getElementById('btn-create-file');
const btnCreateFolder = document.getElementById('btn-create-folder');
const btnRenameFile = document.getElementById('btn-rename-file');
const btnRenameFolder = document.getElementById('btn-rename-folder');
const btnDeleteFile = document.getElementById('btn-delete-file');
const btnDeleteFolder = document.getElementById('btn-delete-folder');
const btnTriggerFolder = document.getElementById('btn-trigger-folder');

const mdList = document.getElementById('md-list');
const mediaList = document.getElementById('media-list');
const mdCount = document.getElementById('md-count');
const mediaCount = document.getElementById('media-count');
const totalCount = document.getElementById('total-count');

const searchInput = document.getElementById('search-input');
const btnSearch = document.getElementById('btn-search');

const fileTitle = document.getElementById('file-title');
const editor = document.getElementById('editor');
const preview = document.getElementById('preview');
const mediaViewer = document.getElementById('media-viewer');
const imgDisplay = document.getElementById('img-display');
const videoDisplay = document.getElementById('video-display');
const btnCopyTag = document.getElementById('btn-copy-tag');
const btnZoomImg = document.getElementById('btn-zoom-img');

const btnCopyNoteTag = document.getElementById('btn-copy-note-tag');

const btnScrollTop = document.getElementById('btn-scroll-top');
const btnScrollBottom = document.getElementById('btn-scroll-bottom');

const imageModal = document.getElementById('image-modal');
const modalImg = document.getElementById('modal-img');
const modalClose = document.getElementById('modal-close');
const modalCounter = document.getElementById('modal-counter');

const btnSave = document.getElementById('btn-save');
const btnExport = document.getElementById('btn-export');

const modeToggleGroup = document.getElementById('mode-toggle-group');
const btnModeEdit = document.getElementById('btn-mode-edit');
const btnModePreview = document.getElementById('btn-mode-preview');

// ==================== 全局状态与正则定义 ====================
const IMG_REGEX = /\.(png|jpg|jpeg|webp|gif|svg)$/i;
const VIDEO_REGEX = /\.(mp4|webm|mkv|mov|avi)$/i;

const fileDataMap = new Map();      
const mediaUrlsMap = new Map(); 
const mediaPathsMap = new Map();

const fileShortNameMap = new Map();
const mediaShortNameMap = new Map();

let mdTree = { name: 'root', isFolder: true, children: new Map() };
let mediaTree = { name: 'root', isFolder: true, children: new Map() };

let currentFileKey = '';
let currentMode = 'edit';
let activeMediaPath = ''; 
let currentRootFolderPath = ''; // 当前打开的物理文件夹根路径

let currentMediaList = [];
let currentMediaIndex = -1;
let lastRenderedText = '';

let searchDebounceTimer = null;
let saveDebounceTimer = null; 

// ==================== 实时保存与同步机制 ====================
function syncCurrentContent() {
    if (saveDebounceTimer) {
        clearTimeout(saveDebounceTimer);
        saveDebounceTimer = null;
    }
    if (!currentFileKey) return;
    const item = fileDataMap.get(currentFileKey);
    if (item && editor) {
        item.text = editor.value;
    }
}

function triggerDebouncedSave() {
    if (saveDebounceTimer) clearTimeout(saveDebounceTimer);
    saveDebounceTimer = setTimeout(() => {
        syncCurrentContent();
        saveCurrentFile(); // 自动打字防抖实时写入本地磁盘
    }, 500);
}

if (editor) {
    editor.addEventListener('input', triggerDebouncedSave);
}

function truncateName(name, maxLength = 10) {
    return name.length > maxLength ? name.slice(0, maxLength) + '...' : name;
}

function clearMediaCache() {
    mediaUrlsMap.clear();
    mediaPathsMap.clear();
    mediaShortNameMap.clear();
    fileShortNameMap.clear();
}

// ==================== 抽屉与树形 UI 渲染 ====================
function resetTreeCollapse() {
    document.querySelectorAll('#bottom-sheet .tree-folder > ul').forEach(ul => {
        ul.style.display = 'none';
    });
    document.querySelectorAll('#bottom-sheet .tree-folder > .folder-header .arrow').forEach(arrow => {
        arrow.textContent = '▶';
    });
}

function expandAndHighlightPath(keyLower, containerEl) {
    if (!keyLower || !containerEl) return;
    const normalizedKey = keyLower.replace(/\\/g, '/').toLowerCase();
    const parts = normalizedKey.split('/').filter(Boolean);
    
    let currentUl = containerEl.querySelector(':scope > ul.tree-node');
    if (!currentUl) return;

    for (let i = 0; i < parts.length - 1; i++) {
        const folderName = parts[i];
        const folderLis = currentUl.querySelectorAll(':scope > li.tree-folder');
        let matchedFolderLi = null;

        for (const li of folderLis) {
            if (li.dataset.folderName === folderName) {
                matchedFolderLi = li;
                break;
            }
        }

        if (matchedFolderLi) {
            const childrenUl = matchedFolderLi._ensureRendered 
                ? matchedFolderLi._ensureRendered() 
                : matchedFolderLi.querySelector(':scope > ul');

            if (childrenUl) {
                childrenUl.style.display = 'block';
                const arrow = matchedFolderLi.querySelector(':scope > .folder-header .arrow');
                if (arrow) arrow.textContent = '▼';
                currentUl = childrenUl;
            } else {
                break;
            }
        } else {
            break;
        }
    }

    const fileLis = currentUl.querySelectorAll(':scope > li.tree-file');
    let targetLi = null;

    for (const li of fileLis) {
        if (li.dataset.key === normalizedKey) {
            targetLi = li;
            break;
        }
    }

    if (targetLi) {
        document.querySelectorAll('.tree-file').forEach(el => el.classList.remove('active'));
        targetLi.classList.add('active');
        setTimeout(() => {
            targetLi.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }, 100);
    }
}

function autoExpandCurrentFile() {
    if (mediaViewer.style.display !== 'none' && activeMediaPath) {
        expandAndHighlightPath(activeMediaPath, mediaList);
    } else if (currentFileKey) {
        expandAndHighlightPath(currentFileKey, mdList);
    }
}

function openDrawer() {
    syncCurrentContent();
    resetTreeCollapse();
    bottomSheet.classList.add('active');
    drawerOverlay.classList.add('active');
    autoExpandCurrentFile();
}

function closeDrawer() {
    bottomSheet.classList.remove('active');
    drawerOverlay.classList.remove('active');
    bottomSheet.style.transform = '';
}

btnOpenDrawer.addEventListener('click', openDrawer);
btnCloseDrawer.addEventListener('click', closeDrawer);
drawerOverlay.addEventListener('click', closeDrawer);

// ==================== 目录数据逻辑 ====================
function insertPathToTree(treeRoot, relativePath, fileInfo) {
    const parts = relativePath.split('/').filter(Boolean);
    let current = treeRoot;

    for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const partLower = part.toLowerCase();
        const isLast = (i === parts.length - 1);

        if (isLast) {
            current.children.set(partLower, {
                name: part,
                isFolder: false,
                ...fileInfo
            });
        } else {
            if (!current.children.has(partLower)) {
                current.children.set(partLower, {
                    name: part,
                    isFolder: true,
                    children: new Map()
                });
            }
            current = current.children.get(partLower);
        }
    }
}

function insertFolderToTree(treeRoot, folderPath) {
    const parts = folderPath.replace(/\\/g, '/').split('/').filter(Boolean);
    let current = treeRoot;
    for (const part of parts) {
        const partLower = part.toLowerCase();
        if (!current.children.has(partLower)) {
            current.children.set(partLower, {
                name: part,
                isFolder: true,
                children: new Map()
            });
        }
        current = current.children.get(partLower);
    }
}

function deletePathFromTree(treeRoot, relativePath) {
    if (!relativePath || !treeRoot) return;
    const parts = relativePath.replace(/\\/g, '/').split('/').filter(Boolean);
    let current = treeRoot;

    for (let i = 0; i < parts.length - 1; i++) {
        const partLower = parts[i].toLowerCase();
        if (current.children && current.children.has(partLower)) {
            current = current.children.get(partLower);
        } else {
            return;
        }
    }

    const lastPartLower = parts[parts.length - 1].toLowerCase();
    if (current.children) {
        current.children.delete(lastPartLower);
    }
}

function getSameFolderMediaList(targetKeyLower) {
    if (!targetKeyLower) return [];
    const normalizedKey = targetKeyLower.replace(/\\/g, '/').toLowerCase();
    const parts = normalizedKey.split('/').filter(Boolean);
    
    let folderNode = mediaTree;
    for (let i = 0; i < parts.length - 1; i++) {
        if (folderNode && folderNode.children && folderNode.children.has(parts[i])) {
            folderNode = folderNode.children.get(parts[i]);
        } else {
            folderNode = null;
            break;
        }
    }

    if (!folderNode || !folderNode.children) return [];

    const list = [];
    const sorted = Array.from(folderNode.children.values()).sort((a, b) => {
        if (a.isFolder && !b.isFolder) return -1;
        if (!a.isFolder && b.isFolder) return 1;
        return a.name.localeCompare(b.name, 'zh-CN', { numeric: true });
    });

    for (const child of sorted) {
        if (!child.isFolder && child.isMedia) {
            list.push(child);
        }
    }
    return list;
}

function renderTreeToDOM(treeNode, containerEl) {
    containerEl.innerHTML = '';
    const rootUl = createTreeUl(treeNode);
    containerEl.appendChild(rootUl);
}

function createTreeUl(folderNode) {
    const ul = document.createElement('ul');
    ul.className = 'tree-node';

    const sortedItems = Array.from(folderNode.children.values()).sort((a, b) => {
        if (a.isFolder && !b.isFolder) return -1;
        if (!a.isFolder && b.isFolder) return 1;
        return a.name.localeCompare(b.name, 'zh-CN', { numeric: true });
    });

    for (const item of sortedItems) {
        const li = document.createElement('li');

        if (item.isFolder) {
            li.className = 'tree-folder';
            li.dataset.folderName = item.name.toLowerCase();

            const folderHeader = document.createElement('div');
            folderHeader.className = 'folder-header';
            
            const folderDisplayName = truncateName(item.name, 10);
            folderHeader.innerHTML = `
                <span class="arrow">▶</span>
                <span class="folder-icon">📁</span>
                <span class="folder-name" title="${item.name}">${folderDisplayName}</span>
            `;

            li.appendChild(folderHeader);

            let childrenUl = null;
            let isRendered = false;

            folderHeader.addEventListener('click', (e) => {
                e.stopPropagation();
                if (!isRendered) {
                    childrenUl = createTreeUl(item);
                    childrenUl.style.display = 'none';
                    li.appendChild(childrenUl);
                    isRendered = true;
                }
                const isHidden = childrenUl.style.display === 'none';
                childrenUl.style.display = isHidden ? 'block' : 'none';
                folderHeader.querySelector('.arrow').textContent = isHidden ? '▼' : '▶';
            });

            li._folderData = item;
            li._ensureRendered = () => {
                if (!isRendered) {
                    childrenUl = createTreeUl(item);
                    li.appendChild(childrenUl);
                    isRendered = true;
                }
                return childrenUl;
            };

        } else {
            li.className = 'tree-file';
            li.dataset.key = item.keyLower;
            li.dataset.fileName = item.name.toLowerCase();

            const icon = item.isMedia ? (item.isVideo ? '🎬' : '🖼️') : '📄';
            li.innerHTML = `
                <span class="file-icon">${icon}</span>
                <span class="file-name" title="${item.name}">${item.name}</span>
            `;

            li.addEventListener('click', (e) => {
                e.stopPropagation();
                if (item.isMedia) {
                    previewMedia(item.keyLower, item.name, item.path, item.isVideo);
                } else {
                    loadMdContent(item.keyLower);
                }
            });
        }

        ul.appendChild(li);
    }

    return ul;
}

function refreshTrees() {
    renderTreeToDOM(mdTree, mdList);
    renderTreeToDOM(mediaTree, mediaList);
    updateCounts();
}

function updateCounts() {
    mdCount.textContent = fileDataMap.size;
    mediaCount.textContent = mediaUrlsMap.size;
    totalCount.textContent = fileDataMap.size + mediaUrlsMap.size;
}

// ==================== 打开本地物理文件夹逻辑 ====================
btnTriggerFolder.addEventListener('click', () => {
    const inputPath = prompt(
        "请输入手机本地文件夹绝对路径（例如: /sdcard/Documents/Notes）：",
        currentRootFolderPath || "/sdcard/Documents/"
    );
    if (!inputPath || !inputPath.trim()) return;

    const folderPath = inputPath.trim().replace(/\\/g, '/').replace(/\/+$/, '');
    currentRootFolderPath = folderPath;

    if (typeof window.AndroidFS === 'undefined') {
        alert("未检测到 Android 原生桥接环境，请在 Android App 内运行！");
        return;
    }

    syncCurrentContent();

    fileDataMap.clear();
    clearMediaCache();
    mdTree = { name: 'root', isFolder: true, children: new Map() };
    mediaTree = { name: 'root', isFolder: true, children: new Map() };

    // 🔑 调用 Android 原生接口扫描文件
    const filesJson = window.AndroidFS.scanDirectory(folderPath);
    let files = [];
    try {
        files = JSON.parse(filesJson);
    } catch(e) {
        alert("扫描文件夹出错: " + e.message);
        return;
    }

    if (files.length === 0) {
        alert(`未在路径 "${folderPath}" 下找到任何文件或目录不存在！`);
        return;
    }

    files.forEach(f => {
        const lowerPath = f.relativePath.toLowerCase();
        const lowerFileName = f.name.toLowerCase();

        if (IMG_REGEX.test(f.name) || VIDEO_REGEX.test(f.name)) {
            const fileUrl = "file://" + f.fullPath;
            const isVideo = VIDEO_REGEX.test(f.name);

            mediaUrlsMap.set(lowerPath, fileUrl);
            mediaPathsMap.set(lowerPath, f.relativePath);
            if (!mediaShortNameMap.has(lowerFileName)) {
                mediaShortNameMap.set(lowerFileName, lowerPath);
            }

            insertPathToTree(mediaTree, f.relativePath, {
                keyLower: lowerPath,
                path: f.relativePath,
                fullPath: f.fullPath,
                isMedia: true,
                isVideo: isVideo
            });
        } else {
            fileDataMap.set(lowerPath, { 
                path: f.relativePath, 
                fullPath: f.fullPath, 
                name: f.name,
                text: "" 
            });

            if (!fileShortNameMap.has(lowerFileName)) {
                fileShortNameMap.set(lowerFileName, lowerPath);
            }

            insertPathToTree(mdTree, f.relativePath, {
                keyLower: lowerPath,
                path: f.relativePath,
                fullPath: f.fullPath,
                isMedia: false
            });
        }
    });

    refreshTrees();
    fileTitle.textContent = folderPath;
    alert(`成功加载文件夹，共扫描到 ${files.length} 个文件！`);
});

// ==================== 物理读取与直接保存文件 ====================
function loadMdContent(keyLower) {
    syncCurrentContent();
    lastRenderedText = ''; 
    
    document.querySelectorAll('.tree-file').forEach(el => {
        el.classList.toggle('active', el.dataset.key === keyLower);
    });
    
    videoDisplay.pause();
    mediaViewer.style.display = 'none';
    modeToggleGroup.style.display = 'flex';
    btnSave.style.display = 'block';
    btnExport.style.display = 'block';
    if (btnCopyNoteTag) btnCopyNoteTag.style.display = 'inline-flex';

    const item = fileDataMap.get(keyLower);
    if (!item) return;

    currentFileKey = keyLower;
    fileTitle.textContent = item.path;

    // 🔑 从磁盘读取最新的文本内容
    if (window.AndroidFS && item.fullPath) {
        item.text = window.AndroidFS.readFile(item.fullPath);
    }

    editor.value = item.text || "";
    editor.removeAttribute('readonly');
    btnSave.removeAttribute('disabled');
    btnExport.removeAttribute('disabled');

    if (currentMode === 'preview') {
        editor.style.display = 'none';
        preview.style.display = 'block';
        renderMarkdown();
    } else {
        editor.style.display = 'block';
        preview.style.display = 'none';
    }
}

function saveCurrentFile() {
    syncCurrentContent();
    const item = fileDataMap.get(currentFileKey);
    if (!item || !item.fullPath) return;

    let writeSuccess = false;

    // 🔑 直接写入手机本地物理文件
    if (window.AndroidFS) {
        writeSuccess = window.AndroidFS.writeFile(item.fullPath, editor.value);
    }

    if (writeSuccess) {
        btnSave.textContent = '已保存！';
        btnSave.style.background = '#0e639c';
        setTimeout(() => {
            btnSave.textContent = '保存';
            btnSave.style.background = '#28a745';
        }, 1200);
    } else {
        alert('写入本地物理磁盘失败！');
    }
}

btnSave.addEventListener('click', saveCurrentFile);

// ==================== 新建 / 重命名 / 删除 映射到磁盘 ====================
btnCreateFile.addEventListener('click', () => {
    if (!currentRootFolderPath) {
        alert("请先打开一个本地文件夹！");
        return;
    }
    syncCurrentContent();
    const inputPath = prompt('请输入新文件相对路径（例如: 随笔.md 或 分类/测试.md）：');
    if (!inputPath || !inputPath.trim()) return;

    let relativePath = inputPath.trim().replace(/\\/g, '/');
    if (!/\.[a-zA-Z0-9]+$/.test(relativePath)) relativePath += '.md';

    const lowerPath = relativePath.toLowerCase();
    const fileName = relativePath.split('/').pop();
    const fullPath = currentRootFolderPath + '/' + relativePath;

    if (fileDataMap.has(lowerPath)) {
        alert('该文件路径已存在！');
        return;
    }

    // 🔑 写入新文件到物理磁盘
    if (window.AndroidFS) {
        window.AndroidFS.writeFile(fullPath, "");
    }

    fileDataMap.set(lowerPath, { text: '', path: relativePath, fullPath: fullPath, name: fileName });
    fileShortNameMap.set(fileName.toLowerCase(), lowerPath);

    insertPathToTree(mdTree, relativePath, { keyLower: lowerPath, path: relativePath, fullPath: fullPath, isMedia: false });
    refreshTrees();
    loadMdContent(lowerPath);
});

btnCreateFolder.addEventListener('click', () => {
    if (!currentRootFolderPath) {
        alert("请先打开一个本地文件夹！");
        return;
    }
    const inputPath = prompt('请输入新文件夹名称或路径（例如: 子分类/笔记）：');
    if (!inputPath || !inputPath.trim()) return;

    const folderPath = inputPath.trim().replace(/\\/g, '/');
    const fullPath = currentRootFolderPath + '/' + folderPath;

    if (window.AndroidFS) {
        window.AndroidFS.createFolder(fullPath);
    }

    insertFolderToTree(mdTree, folderPath);
    refreshTrees();
});

btnDeleteFile.addEventListener('click', () => {
    syncCurrentContent();
    let targetKey = currentFileKey;
    let item = fileDataMap.get(targetKey);

    if (!item) {
        alert('请先选择要删除的文件！');
        return;
    }

    if (!confirm(`确定要彻底从磁盘删除文件 "${item.path}" 吗？`)) return;

    if (window.AndroidFS && item.fullPath) {
        window.AndroidFS.deleteFileOrFolder(item.fullPath);
    }

    fileDataMap.delete(targetKey);
    deletePathFromTree(mdTree, item.path);

    currentFileKey = '';
    editor.value = '';
    editor.setAttribute('readonly', 'true');
    preview.innerHTML = '';
    fileTitle.textContent = '未选择文件';

    refreshTrees();
});

// ==================== 搜索逻辑 ====================
function performSearch() {
    const query = searchInput.value.toLowerCase().trim();
    if (!query) {
        document.querySelectorAll('.tree-folder, .tree-file').forEach(el => el.style.display = '');
        resetTreeCollapse();
        return;
    }

    document.querySelectorAll('.tree-folder, .tree-file').forEach(el => el.style.display = 'none');

    document.querySelectorAll('.tree-file').forEach(fileLi => {
        const fileName = fileLi.dataset.fileName || '';
        if (fileName.includes(query)) {
            fileLi.style.display = 'flex';
            let parent = fileLi.parentElement;
            while (parent) {
                if (parent.classList.contains('tree-folder')) {
                    parent.style.display = 'block';
                    const parentUl = parent._ensureRendered ? parent._ensureRendered() : parent.querySelector(':scope > ul');
                    if (parentUl) parentUl.style.display = 'block';
                }
                if (parent.classList.contains('tree-node')) parent.style.display = 'block';
                parent = parent.parentElement;
            }
        }
    });
}

btnSearch.addEventListener('click', performSearch);
searchInput.addEventListener('input', () => {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(performSearch, 200);
});

// ==================== 媒体查看与 Markdown 渲染 ====================
function previewMedia(keyLower, fileName, displayPath, isVideo) {
    syncCurrentContent();
    activeMediaPath = displayPath.replace(/\\/g, '/');
    currentMediaList = getSameFolderMediaList(keyLower);
    currentMediaIndex = currentMediaList.findIndex(item => item.keyLower === keyLower);

    fileTitle.textContent = `${isVideo ? '🎬' : '🖼️'} ${displayPath}`;

    editor.style.display = 'none';
    preview.style.display = 'none';
    mediaViewer.style.display = 'flex';
    modeToggleGroup.style.display = 'none';
    btnSave.style.display = 'none';

    const url = mediaUrlsMap.get(keyLower);

    if (isVideo) {
        imgDisplay.style.display = 'none';
        videoDisplay.style.display = 'block';
        videoDisplay.src = url;
    } else {
        videoDisplay.pause();
        videoDisplay.style.display = 'none';
        imgDisplay.style.display = 'block';
        imgDisplay.src = url;
    }
}

function parseObsidianLinks(rawText) {
    return rawText.replace(/(!?)\[\[([\s\S]*?)\]\]/g, (match, isEmbed, inner) => {
        let target = inner;
        let alias = '';
        const pipeIndex = inner.indexOf('|');
        if (pipeIndex !== -1) {
            target = inner.substring(0, pipeIndex);
            alias = inner.substring(pipeIndex + 1);
        }

        const cleanTarget = target.trim();
        const normalizedTarget = cleanTarget.replace(/\\/g, '/').toLowerCase();
        const displayText = alias ? alias.trim() : cleanTarget;
        
        const isImgExt = IMG_REGEX.test(cleanTarget);
        const isVideoExt = VIDEO_REGEX.test(cleanTarget);

        if (isEmbed || isImgExt || isVideoExt) {
            let mediaUrl = mediaUrlsMap.get(normalizedTarget) 
                || mediaUrlsMap.get(mediaShortNameMap.get(normalizedTarget));

            if (mediaUrl) {
                return isVideoExt 
                    ? `<video src="${mediaUrl}" controls style="max-width:100%; border-radius:6px; margin: 8px 0;"></video>`
                    : `<img src="${mediaUrl}" alt="${displayText}" title="${displayText}" />`;
            }
            return `<span class="missing-link">📎 [媒体未找到: ${cleanTarget}]</span>`;
        } else {
            let matchedKey = fileDataMap.has(normalizedTarget) 
                ? normalizedTarget 
                : fileShortNameMap.get(normalizedTarget);

            if (!matchedKey) {
                let mdTarget = normalizedTarget + '.md';
                matchedKey = fileDataMap.has(mdTarget) 
                    ? mdTarget 
                    : fileShortNameMap.get(mdTarget);
            }

            if (matchedKey) {
                return `<a href="javascript:void(0)" data-key="${matchedKey}" class="wiki-link">📄 ${displayText}</a>`;
            }
            return `<span class="missing-link">📄 ${displayText} <small>(未找到页面)</small></span>`;
        }
    });
}

function renderMarkdown() {
    let rawText = editor.value;
    if (rawText === lastRenderedText) return; 

    let processedText = parseObsidianLinks(rawText);
    if (typeof marked !== 'undefined') {
        preview.innerHTML = marked.parse(processedText, { breaks: true });
    }
    lastRenderedText = rawText; 
}

// 模式切换绑定
btnModeEdit.addEventListener('click', () => {
    syncCurrentContent();
    currentMode = 'edit';
    btnModeEdit.classList.add('active');
    btnModePreview.classList.remove('active');
    mediaViewer.style.display = 'none';
    editor.style.display = 'block';
    preview.style.display = 'none';
});

btnModePreview.addEventListener('click', () => {
    syncCurrentContent();
    currentMode = 'preview';
    btnModePreview.classList.add('active');
    btnModeEdit.classList.remove('active');
    mediaViewer.style.display = 'none';
    editor.style.display = 'none';
    preview.style.display = 'block';
    renderMarkdown();
});
