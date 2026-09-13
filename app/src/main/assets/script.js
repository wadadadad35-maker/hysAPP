// ==================== DOM 节点获取 ====================
const bottomSheet = document.getElementById('bottom-sheet');
const drawerOverlay = document.getElementById('drawer-overlay');
const btnOpenDrawer = document.getElementById('btn-open-drawer');
const btnCloseDrawer = document.getElementById('btn-close-drawer');

const btnCreateFile = document.getElementById('btn-create-file');
const btnCreateFolder = document.getElementById('btn-create-folder');
const btnImportFile = document.getElementById('btn-import-file');
const importFileInput = document.getElementById('import-file-input');

const btnCut = document.getElementById('btn-cut');
const btnPaste = document.getElementById('btn-paste');
const btnRenameFile = document.getElementById('btn-rename-file');
const btnRenameFolder = document.getElementById('btn-rename-folder');
const btnDeleteFile = document.getElementById('btn-delete-file');
const btnDeleteFolder = document.getElementById('btn-delete-folder');
const btnTriggerFolder = document.getElementById('btn-trigger-folder');
const btnLastProgress = document.getElementById('btn-last-progress');
const btnSwitchResource = document.getElementById('btn-switch-resource');

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
const btnFullscreenLandscape = document.getElementById('btn-fullscreen-landscape');
const btnFullscreenPortrait = document.getElementById('btn-fullscreen-portrait');
/** 当前期望的全屏方向：'landscape' | 'portrait' | '' */
let preferredFullscreenOrientation = '';

const btnCopyNoteTag = document.getElementById('btn-copy-note-tag');

const btnScrollTop = document.getElementById('btn-scroll-top');
const btnScrollBottom = document.getElementById('btn-scroll-bottom');

const imageModal = document.getElementById('image-modal');
const modalImg = document.getElementById('modal-img');
const modalClose = document.getElementById('modal-close');
const modalCounter = document.getElementById('modal-counter');

// Modal 双视图与模式切换节点
const btnModalPaged = document.getElementById('btn-modal-paged');
const btnModalStream = document.getElementById('btn-modal-stream');
const modalPagedView = document.getElementById('modal-paged-view');
const modalStreamView = document.getElementById('modal-stream-view');

// 路径输入自定义弹窗 DOM 节点
const customPathModal = document.getElementById('custom-path-modal');
const modalPathInput = document.getElementById('modal-path-input');
const btnModalCancel = document.getElementById('btn-modal-cancel');
const btnModalConfirm = document.getElementById('btn-modal-confirm');

// 最近路径 DOM 节点
const btnShowRecent = document.getElementById('btn-show-recent');
const recentPathsList = document.getElementById('recent-paths-list');

const btnSave = document.getElementById('btn-save');
const btnRefresh = document.getElementById('btn-refresh');

const modeToggleGroup = document.getElementById('mode-toggle-group');
const btnModeEdit = document.getElementById('btn-mode-edit');
const btnModePreview = document.getElementById('btn-mode-preview');

// 当前笔记内搜索 DOM 节点
const noteSearchInput = document.getElementById('note-search-input');
const btnNoteSearch = document.getElementById('btn-note-search');
const noteSearchCount = document.getElementById('note-search-count');
const btnSearchPrev = document.getElementById('btn-search-prev');
const btnSearchNext = document.getElementById('btn-search-next');
const btnSearchExit = document.getElementById('btn-search-exit');

// ==================== 全局状态与配置参数 ====================
const PREV_TOUCH_RATIO = 0.3; 

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
let currentFolderPath = ''; 
let currentMode = 'edit';
let activeMediaPath = ''; 
let currentRootFolderPath = ''; 

let currentMediaList = [];
let currentMediaIndex = -1;
let currentModalMode = 'paged';
let streamObserver = null;
let lastRenderedText = '';

let saveDebounceTimer = null;
let isFileDirty = false;
let isSavingFile = false;

// 剪贴板全局状态
let clipboardItem = null;

// 笔记内搜索全局状态
let noteSearchMatches = [];
let currentNoteSearchIndex = -1;

// ==================== 进度记忆（双轨） ====================
// 1. __last__：整个根目录「最后一次看的内容」（文章或图片），用于重新打开应用时恢复
// 2. 子文件夹 key：只记图片/视频，用于「📍 上次进度」按钮换漫画
const FOLDER_VIEW_STATE_KEY = 'folder_view_states_v2';
const MAX_FOLDER_VIEW_STATES = 70;

function normalizeRootFolderPath(path) {
    return (path || '').replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
}

function normalizeFolderKey(path) {
    return (path || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '').toLowerCase();
}

/** 当前媒体所在相对文件夹（仅媒体） */
function getCurrentMediaFolderPath() {
    if (!activeMediaPath) return '';
    const parts = activeMediaPath.replace(/\\/g, '/').split('/').filter(Boolean);
    parts.pop();
    return parts.join('/');
}

function makeStateCompositeKey(rootPath, folderPath) {
    const rootKey = normalizeRootFolderPath(rootPath);
    const folderKey = normalizeFolderKey(folderPath);
    return rootKey + '::' + folderKey;
}

function getFolderViewStates() {
    try {
        const json = localStorage.getItem(FOLDER_VIEW_STATE_KEY);
        const data = json ? JSON.parse(json) : {};
        return (data && typeof data === 'object' && !Array.isArray(data)) ? data : {};
    } catch (e) {
        return {};
    }
}

/**
 * 保存进度：
 * - 始终更新 __last__（文章或图片都可以，用于重新打开应用）
 * - 只有正在看图片/视频时，才额外写入该子文件夹的媒体进度（给「上次进度」按钮用）
 */
function saveFolderViewState() {
    if (!currentRootFolderPath) return;

    syncCurrentContent();

    const rootKey = normalizeRootFolderPath(currentRootFolderPath);
    if (!rootKey) return;

    // 当前是否在看媒体
    const isViewingMedia = !!(activeMediaPath && mediaViewer && mediaViewer.style.display !== 'none');

    try {
        const states = getFolderViewStates();

        // —— 1. 始终保存「最后一次」整体进度（文章 + 图片都记）——
        const lastState = {
            fileKey: currentFileKey || '',
            mediaPath: isViewingMedia ? (activeMediaPath || '') : '',
            mode: currentMode || 'edit',
            editorScrollTop: editor ? editor.scrollTop : 0,
            previewScrollTop: preview ? preview.scrollTop : 0,
            videoCurrentTime: (isViewingMedia && videoDisplay) ? videoDisplay.currentTime : 0,
            isMedia: isViewingMedia,
            updatedAt: Date.now()
        };
        states[rootKey + '::__last__'] = lastState;

        // —— 2. 仅当正在看媒体时，写入该子文件夹的媒体进度 ——
        if (isViewingMedia) {
            const folderPath = getCurrentMediaFolderPath();
            const compositeKey = makeStateCompositeKey(currentRootFolderPath, folderPath);
            states[compositeKey] = {
                fileKey: currentFileKey || '',
                mediaPath: activeMediaPath || '',
                videoCurrentTime: videoDisplay ? videoDisplay.currentTime : 0,
                isMedia: true,
                updatedAt: Date.now()
            };
        }

        const entries = Object.entries(states)
            .sort((a, b) => (b[1]?.updatedAt || 0) - (a[1]?.updatedAt || 0))
            .slice(0, MAX_FOLDER_VIEW_STATES);

        localStorage.setItem(FOLDER_VIEW_STATE_KEY, JSON.stringify(Object.fromEntries(entries)));
    } catch (e) {
        console.error('保存阅读进度失败:', e);
    }
}

function getFolderViewState(rootPath, folderPath) {
    const states = getFolderViewStates();
    const rootKey = normalizeRootFolderPath(rootPath);

    // 未指定子文件夹 / 空字符串 → 取整体最后一次（重新打开应用用）
    if (folderPath === undefined || folderPath === null || folderPath === '') {
        return states[rootKey + '::__last__'] || states[rootKey] || null;
    }

    // 指定了子文件夹 → 只取该文件夹的媒体进度
    const compositeKey = makeStateCompositeKey(rootPath, folderPath);
    return states[compositeKey] || null;
}

function clearFolderViewState(rootPath, folderPath) {
    try {
        const states = getFolderViewStates();
        if (folderPath !== undefined && folderPath !== null && folderPath !== '') {
            const compositeKey = makeStateCompositeKey(rootPath, folderPath);
            delete states[compositeKey];
        } else {
            const rootKey = normalizeRootFolderPath(rootPath);
            Object.keys(states).forEach(k => {
                if (k === rootKey || k.startsWith(rootKey + '::')) {
                    delete states[k];
                }
            });
        }
        localStorage.setItem(FOLDER_VIEW_STATE_KEY, JSON.stringify(states));
    } catch (e) {
        console.error('清除阅读进度失败:', e);
    }
}

// ==================== 最近路径读写逻辑 ====================
function getRecentPaths() {
    try {
        const json = localStorage.getItem('recent_folder_paths');
        return json ? JSON.parse(json) : [];
    } catch (e) {
        return [];
    }
}

function saveRecentPath(newPath) {
    if (!newPath) return;
    let paths = getRecentPaths();
    
    const cleanNew = newPath.toLowerCase().replace(/\/+$/, '');
    paths = paths.filter(p => p.toLowerCase().replace(/\/+$/, '') !== cleanNew);
    
    paths.unshift(newPath);
    paths = paths.slice(0, 3);
    
    try {
        localStorage.setItem('recent_folder_paths', JSON.stringify(paths));
    } catch (e) {
        console.error('保存最近路径失败:', e);
    }
}

function renderRecentPaths() {
    if (!recentPathsList) return;
    const paths = getRecentPaths();
    recentPathsList.innerHTML = '';

    if (paths.length === 0) {
        recentPathsList.innerHTML = '<div class="recent-path-empty">暂无历史路径记录</div>';
        return;
    }

    paths.forEach(path => {
        const itemEl = document.createElement('div');
        itemEl.className = 'recent-path-item';
        itemEl.innerHTML = `<span style="font-size:12px;">📂</span><span style="flex:1;">${path}</span>`;
        
        itemEl.addEventListener('click', () => {
            if (modalPathInput) modalPathInput.value = path;
            hidePathModal();
            executeFolderScan(path);
        });

        recentPathsList.appendChild(itemEl);
    });
}

// ==================== 自动防抖保存机制 ====================
function syncCurrentContent() {
    if (!currentFileKey) return;
    const item = fileDataMap.get(currentFileKey);
    if (item && editor) {
        item.text = editor.value;
    }
}

function cancelPendingSave() {
    if (saveDebounceTimer) {
        clearTimeout(saveDebounceTimer);
        saveDebounceTimer = null;
    }
}

function markFileDirty() {
    isFileDirty = true;
    if (btnSave) {
        btnSave.textContent = '保存中…';
    }
}

function triggerDebouncedSave() {
    cancelPendingSave();
    saveDebounceTimer = setTimeout(() => {
        saveDebounceTimer = null;
        saveCurrentFile();
    }, 400);
}

if (editor) {
    editor.addEventListener('input', () => {
        editor.classList.remove('is-searching');
        syncCurrentContent();
        markFileDirty();
        triggerDebouncedSave();
    });
    
    editor.addEventListener('touchstart', () => {
        editor.classList.remove('is-searching');
        editor.removeAttribute('inputmode');
    });
    editor.addEventListener('mousedown', () => {
        editor.classList.remove('is-searching');
        editor.removeAttribute('inputmode');
    });
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

// ==================== 目录静默重扫 ====================
function rescanDirectorySilently() {
    if (!currentRootFolderPath || typeof window.AndroidFS === 'undefined') return;

    const filesJson = window.AndroidFS.scanDirectory(currentRootFolderPath);
    let files = [];
    try {
        files = JSON.parse(filesJson);
    } catch(e) {
        return;
    }

    fileDataMap.clear();
    clearMediaCache();
    mdTree = { name: 'root', isFolder: true, children: new Map() };
    mediaTree = { name: 'root', isFolder: true, children: new Map() };

    files.forEach(f => {
        if (f.isFolder) {
            insertFolderToTree(mdTree, f.relativePath);
            return;
        }

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

function expandAndHighlightPath(keyLower, containerEl, shouldHighlight = true) {
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
            matchedFolderLi.style.display = 'block';
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
        targetLi.style.display = 'flex';
        if (shouldHighlight) {
            document.querySelectorAll('.tree-file').forEach(el => el.classList.remove('active'));
            targetLi.classList.add('active');
            setTimeout(() => {
                targetLi.scrollIntoView({ block: 'center', behavior: 'smooth' });
            }, 100);
        }
    }
}

function autoExpandCurrentFile() {
    if (mediaViewer.style.display !== 'none' && activeMediaPath) {
        expandAndHighlightPath(activeMediaPath, mediaList, true);
    } else if (currentFileKey) {
        expandAndHighlightPath(currentFileKey, mdList, true);
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

// ==================== 目录结构解析 ====================
function insertPathToTree(treeRoot, relativePath, fileInfo) {
    const parts = relativePath.split('/').filter(Boolean);
    let current = treeRoot;
    let currentPath = '';

    for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const partLower = part.toLowerCase();
        const isLast = (i === parts.length - 1);
        currentPath = currentPath ? `${currentPath}/${part}` : part;

        if (isLast) {
            current.children.set(partLower, {
                name: part,
                path: relativePath,
                isFolder: false,
                ...fileInfo
            });
        } else {
            if (!current.children.has(partLower)) {
                current.children.set(partLower, {
                    name: part,
                    path: currentPath,
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
    let currentPath = '';

    for (const part of parts) {
        const partLower = part.toLowerCase();
        currentPath = currentPath ? `${currentPath}/${part}` : part;

        if (!current.children.has(partLower)) {
            current.children.set(partLower, {
                name: part,
                path: currentPath,
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
    const fragment = document.createDocumentFragment();

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
            if (item.path) li.dataset.folderPath = item.path;

            const folderHeader = document.createElement('div');
            folderHeader.className = 'folder-header';
            
            const folderDisplayName = truncateName(item.name, 10);
            folderHeader.innerHTML = `
                <span class="arrow">▶</span>
                <span class="folder-icon">📁</span>
                <span class="folder-name" title="${item.name}">${folderDisplayName}</span>
            `;

            li.appendChild(folderHeader);
            li._folderData = item;
            li._ensureRendered = () => {
                let childrenUl = li.querySelector(':scope > ul');
                if (!childrenUl) {
                    childrenUl = createTreeUl(item);
                    childrenUl.style.display = 'none';
                    li.appendChild(childrenUl);
                }
                return childrenUl;
            };

        } else {
            li.className = 'tree-file';
            li.dataset.key = item.keyLower;
            li.dataset.fileName = item.name.toLowerCase();
            li._fileItem = item;

            const icon = item.isMedia ? (item.isVideo ? '🎬' : '🖼️') : '📄';
            li.innerHTML = `
                <span class="file-icon">${icon}</span>
                <span class="file-name" title="${item.name}">${item.name}</span>
            `;
        }

        fragment.appendChild(li);
    }

    ul.appendChild(fragment);
    return ul;
}

function setupTreeDelegation(containerEl) {
    if (!containerEl) return;
    containerEl.addEventListener('click', (e) => {
        const folderHeader = e.target.closest('.folder-header');
        if (folderHeader) {
            e.stopPropagation();
            const li = folderHeader.parentElement;

            if (li && li.dataset.folderPath) {
                currentFolderPath = li.dataset.folderPath;
                currentFileKey = '';
                document.querySelectorAll('.tree-file').forEach(el => el.classList.remove('active'));
                document.querySelectorAll('.folder-header').forEach(el => el.classList.remove('active'));
                folderHeader.classList.add('active');
            }

            if (li && li._ensureRendered) {
                const childrenUl = li._ensureRendered();
                const isHidden = childrenUl.style.display === 'none';
                childrenUl.style.display = isHidden ? 'block' : 'none';
                const arrow = folderHeader.querySelector('.arrow');
                if (arrow) arrow.textContent = isHidden ? '▼' : '▶';
            }
            return;
        }

        const fileLi = e.target.closest('.tree-file');
        if (fileLi && fileLi._fileItem) {
            e.stopPropagation();
            currentFolderPath = '';
            document.querySelectorAll('.folder-header').forEach(el => el.classList.remove('active'));

            const item = fileLi._fileItem;
            if (item.isMedia) {
                previewMedia(item.keyLower, item.name, item.path, item.isVideo);
            } else {
                loadMdContent(item.keyLower);
            }
        }
    });
}

setupTreeDelegation(mdList);
setupTreeDelegation(mediaList);

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

// ==================== 扫描与加载本地文件夹 ====================
function showPathModal() {
    if (modalPathInput) {
        modalPathInput.value = currentRootFolderPath || "/sdcard/Documents/";
    }
    if (recentPathsList) {
        recentPathsList.style.display = 'none';
    }
    if (customPathModal) {
        customPathModal.classList.add('active');
        setTimeout(() => {
            if (modalPathInput) modalPathInput.focus();
        }, 100);
    }
}

function hidePathModal() {
    if (customPathModal) {
        customPathModal.classList.remove('active');
    }
}

function executeFolderScan(inputPath, isSilent = false) {
    if (!inputPath || !inputPath.trim()) return;

    const folderPath = inputPath.trim().replace(/\\/g, '/').replace(/\/+$/, '');
    const previousRootFolderPath = currentRootFolderPath;
    const isSwitchingFolder = !!previousRootFolderPath &&
        normalizeRootFolderPath(previousRootFolderPath) !== normalizeRootFolderPath(folderPath);

    // 切换目录前保存当前目录的状态
    if (isSwitchingFolder) {
        flushCurrentFileBeforeLeave();
        saveFolderViewState();
    } else {
        syncCurrentContent();
    }

    if (typeof window.AndroidFS === 'undefined') {
        if (!isSilent) alert("未检测到 Android 原生桥接环境，请在 Android App 内运行！");
        return;
    }

    currentRootFolderPath = folderPath;
    currentFolderPath = '';
    currentFileKey = '';
    activeMediaPath = '';

    try {
        localStorage.setItem('last_folder_path', folderPath);
        saveRecentPath(folderPath);
    } catch (e) {
        console.error('无法保存路径到缓存:', e);
    }

    rescanDirectorySilently();
    refreshTrees();
    fileTitle.textContent = folderPath;
    closeDrawer();

    // 回到这个目录时恢复上次打开的文件/媒体及阅读位置
    restoreFolderViewState(folderPath);

    if (!isSilent) {
        alert(`成功加载目录！`);
    }
}

btnTriggerFolder.addEventListener('click', showPathModal);

if (btnShowRecent) {
    btnShowRecent.addEventListener('click', () => {
        const isHidden = recentPathsList.style.display === 'none';
        if (isHidden) {
            renderRecentPaths();
            recentPathsList.style.display = 'flex';
        } else {
            recentPathsList.style.display = 'none';
        }
    });
}

if (btnModalCancel) {
    btnModalCancel.addEventListener('click', hidePathModal);
}

if (btnModalConfirm) {
    btnModalConfirm.addEventListener('click', () => {
        const val = modalPathInput ? modalPathInput.value : '';
        hidePathModal();
        executeFolderScan(val);
    });
}

if (modalPathInput) {
    modalPathInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const val = modalPathInput.value;
            hidePathModal();
            executeFolderScan(val);
        }
    });
}

if (customPathModal) {
    customPathModal.addEventListener('click', (e) => {
        if (e.target === customPathModal) {
            hidePathModal();
        }
    });
}

btnRefresh.addEventListener('click', () => {
    if (!currentRootFolderPath) {
        alert("请先打开本地文件夹！");
        return;
    }
    flushCurrentFileBeforeLeave();
    rescanDirectorySilently();
    alert("目录已成功扫描刷新！");
});

// ==================== 文件物理读写 ====================
/**
 * 恢复进度
 * - folderPath 为空：恢复 __last__（文章或图片都可以，重新打开应用用）
 * - folderPath 有值：只恢复该文件夹的媒体进度（「上次进度」按钮用）
 */
function restoreFolderViewState(rootPath, folderPath) {
    const state = getFolderViewState(rootPath, folderPath);
    if (!state) return false;

    const isFolderSpecific = !!(folderPath !== undefined && folderPath !== null && folderPath !== '');
    // 子文件夹恢复：强制只走媒体
    const forceMediaOnly = isFolderSpecific;

    // 决定要打开的 key
    let targetKey = '';
    let isMedia = false;

    if (forceMediaOnly || state.isMedia || state.mediaPath) {
        // 优先媒体
        const mediaKey = (state.mediaPath || state.fileKey || '').toLowerCase().replace(/\\/g, '/');
        if (mediaKey && mediaUrlsMap.has(mediaKey)) {
            targetKey = mediaKey;
            isMedia = true;
        } else if (state.fileKey && mediaUrlsMap.has(state.fileKey)) {
            targetKey = state.fileKey;
            isMedia = true;
        }
    }

    if (!isMedia && !forceMediaOnly) {
        // 整体恢复且不是媒体 → 尝试文章
        if (state.fileKey && fileDataMap.has(state.fileKey)) {
            targetKey = state.fileKey;
            isMedia = false;
        }
    }

    if (!targetKey) return false;

    if (isMedia) {
        return restoreMediaByKey(targetKey, state);
    }

    // 恢复文章 + 滚动位置
    loadMdContent(targetKey);

    if (state.mode === 'preview') {
        currentMode = 'preview';
        btnModePreview.classList.add('active');
        btnModeEdit.classList.remove('active');
        mediaViewer.style.display = 'none';
        editor.style.display = 'none';
        preview.style.display = 'block';
        renderMarkdown();
    }

    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            if (state.mode === 'preview') {
                preview.scrollTop = Math.max(0, Number(state.previewScrollTop) || 0);
            } else {
                editor.scrollTop = Math.max(0, Number(state.editorScrollTop) || 0);
            }
        });
    });
    return true;
}

function restoreMediaByKey(keyLower, state) {
    const displayPath = mediaPathsMap.get(keyLower) || state.mediaPath;
    if (!displayPath) return false;

    const fileName = displayPath.split('/').pop();
    const isVideo = VIDEO_REGEX.test(fileName);

    previewMedia(keyLower, fileName, displayPath, isVideo);

    if (isVideo && Number(state.videoCurrentTime) > 0) {
        const restoreVideoTime = () => {
            try {
                videoDisplay.currentTime = Number(state.videoCurrentTime) || 0;
            } catch (e) {}
        };
        if (videoDisplay.readyState >= 1) {
            restoreVideoTime();
        } else {
            videoDisplay.addEventListener('loadedmetadata', restoreVideoTime, { once: true });
        }
    }
    return true;
}

function loadMdContent(keyLower) {
    // 离开视频时退出伪全屏
    if (isVideoPseudoFullscreen) exitPseudoFullscreen();

    if (currentFileKey && currentFileKey !== keyLower) {
        // 切换文件前先取消防抖并立即把旧文件落盘，避免粘贴后立刻切换导致内容丢失。
        flushCurrentFileBeforeLeave();
    } else {
        syncCurrentContent();
    }

    if (currentRootFolderPath && currentFileKey && currentFileKey !== keyLower) {
        // 切换文件前保存旧文件的滚动位置
        saveFolderViewState();
    }

    lastRenderedText = ''; 
    
    document.querySelectorAll('.tree-file').forEach(el => {
        el.classList.toggle('active', el.dataset.key === keyLower);
    });
    
    videoDisplay.pause();
    mediaViewer.style.display = 'none';
    activeMediaPath = ''; // 切到文章，清空媒体路径，避免进度判断出错
    modeToggleGroup.style.display = 'flex';
    btnSave.style.display = 'block';
    if (btnCopyNoteTag) btnCopyNoteTag.style.display = 'inline-flex';

    const item = fileDataMap.get(keyLower);
    if (!item) return;

    currentFileKey = keyLower;
    fileTitle.textContent = item.path;

    try {
        localStorage.setItem('last_file_key', keyLower);
    } catch (e) {
        console.error('保存打开文件记录失败:', e);
    }

    if (window.AndroidFS && item.fullPath) {
        item.text = window.AndroidFS.readFile(item.fullPath);
    }

    editor.value = item.text || "";
    isFileDirty = false;
    cancelPendingSave();
    editor.removeAttribute('readonly');
    btnSave.removeAttribute('disabled');

    if (currentMode === 'preview') {
        editor.style.display = 'none';
        preview.style.display = 'block';
        renderMarkdown();
    } else {
        editor.style.display = 'block';
        preview.style.display = 'none';
    }

    resetNoteSearch();

    if (currentRootFolderPath) {
        saveFolderViewState();
    }
}

function saveCurrentFile(options = {}) {
    const force = !!options.force;
    cancelPendingSave();
    syncCurrentContent();

    const item = fileDataMap.get(currentFileKey);
    if (!item || !item.fullPath || !editor) return false;
    if (!force && !isFileDirty) return true;

    if (isSavingFile) return false;
    isSavingFile = true;

    let writeSuccess = false;
    try {
        if (window.AndroidFS && typeof window.AndroidFS.writeFile === 'function') {
            writeSuccess = window.AndroidFS.writeFile(item.fullPath, editor.value);
        }
    } catch (e) {
        console.error('保存文件失败:', e);
    } finally {
        isSavingFile = false;
    }

    if (writeSuccess) {
        isFileDirty = false;
        btnSave.textContent = '已保存！';
        btnSave.style.background = '#0e639c';
        setTimeout(() => {
            if (!isFileDirty) {
                btnSave.textContent = '保存';
                btnSave.style.background = '#28a745';
            }
        }, 1200);
    } else {
        btnSave.textContent = '保存失败';
        alert('写入物理磁盘失败！');
    }
    return writeSuccess;
}

// 在切换文件、目录或离开 WebView 前，必须把当前编辑器内容立即落盘。
function flushCurrentFileBeforeLeave() {
    return saveCurrentFile({ force: true });
}

btnSave.addEventListener('click', () => saveCurrentFile({ force: true }));

// Android WebView 切到后台/锁屏/离开页面时立即落盘。
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
        flushCurrentFileBeforeLeave();
        saveFolderViewState();
    }
});

window.addEventListener('pagehide', () => {
    flushCurrentFileBeforeLeave();
    saveFolderViewState();
});

window.addEventListener('beforeunload', () => {
    flushCurrentFileBeforeLeave();
});

// ==================== 新建 / 重命名 / 删除文件及文件夹 ====================
btnCreateFile.addEventListener('click', () => {
    if (!currentRootFolderPath) {
        alert("请先打开本地文件夹！");
        return;
    }
    syncCurrentContent();

    let targetFolder = '';
    if (currentFolderPath) {
        targetFolder = currentFolderPath;
    } else if (currentFileKey && currentFileKey.includes('/')) {
        targetFolder = currentFileKey.substring(0, currentFileKey.lastIndexOf('/'));
    }

    const promptMsg = targetFolder 
        ? `在 [ ${targetFolder} ] 中新建文件，请输入文件名：` 
        : '在根目录下新建文件，请输入文件名：';

    const inputName = prompt(promptMsg);
    if (!inputName || !inputName.trim()) return;

    let cleanName = inputName.trim().replace(/\\/g, '/');
    if (!/\.[a-zA-Z0-9]+$/.test(cleanName)) cleanName += '.md';

    const relativePath = targetFolder ? `${targetFolder}/${cleanName}` : cleanName;
    const lowerPath = relativePath.toLowerCase();
    const fileName = cleanName.split('/').pop();
    const fullPath = currentRootFolderPath + '/' + relativePath;

    if (fileDataMap.has(lowerPath)) {
        alert('文件已存在！');
        return;
    }

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
        alert("请先打开本地文件夹！");
        return;
    }

    let targetFolder = '';
    if (currentFolderPath) {
        targetFolder = currentFolderPath;
    } else if (currentFileKey && currentFileKey.includes('/')) {
        targetFolder = currentFileKey.substring(0, currentFileKey.lastIndexOf('/'));
    }

    const promptMsg = targetFolder 
        ? `在 [ ${targetFolder} ] 中新建子文件夹，请输入文件夹名：` 
        : '在根目录下新建文件夹，请输入文件夹名：';

    const inputName = prompt(promptMsg);
    if (!inputName || !inputName.trim()) return;

    const folderName = inputName.trim().replace(/\\/g, '/');
    const folderPath = targetFolder ? `${targetFolder}/${folderName}` : folderName;
    const fullPath = currentRootFolderPath + '/' + folderPath;

    if (window.AndroidFS) {
        window.AndroidFS.createFolder(fullPath);
    }

    insertFolderToTree(mdTree, folderPath);
    refreshTrees();
});

// ==================== 导入外部文件/图片/笔记 ====================
if (btnImportFile && importFileInput) {
    btnImportFile.addEventListener('click', () => {
        if (!currentRootFolderPath) {
            alert("请先打开本地文件夹！");
            return;
        }
        importFileInput.click();
    });

    importFileInput.addEventListener('change', async (e) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        const targetFolder = currentFolderPath ? currentFolderPath : '';
        let successCount = 0;

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const targetRelativePath = targetFolder ? `${targetFolder}/${file.name}` : file.name;
            const fullPath = currentRootFolderPath + '/' + targetRelativePath;

            try {
                await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    const isText = /\.(md|txt|json|js|html|css|xml|yaml|yml|csv)$/i.test(file.name);

                    if (isText) {
                        reader.readAsText(file);
                        reader.onload = () => {
                            if (window.AndroidFS) {
                                window.AndroidFS.writeFile(fullPath, reader.result);
                            }
                            resolve();
                        };
                    } else {
                        reader.readAsDataURL(file);
                        reader.onload = () => {
                            if (window.AndroidFS) {
                                if (typeof window.AndroidFS.writeBase64File === 'function') {
                                    const base64Data = reader.result.split(',')[1];
                                    window.AndroidFS.writeBase64File(fullPath, base64Data);
                                } else {
                                    window.AndroidFS.writeFile(fullPath, reader.result);
                                }
                            }
                            resolve();
                        };
                    }
                    reader.onerror = reject;
                });
                successCount++;
            } catch (err) {
                console.error('导入文件失败:', file.name, err);
            }
        }

        alert(`成功导入 ${successCount} 个文件！`);
        importFileInput.value = ''; 
        rescanDirectorySilently(); 
    });
}

btnRenameFile.addEventListener('click', () => {
    syncCurrentContent();
    if (!currentFileKey) {
        alert('请先选择要重命名的文件！');
        return;
    }

    const item = fileDataMap.get(currentFileKey);
    const newFileName = prompt('请输入新文件名（包含后缀）：', item.name);
    if (!newFileName || newFileName.trim() === '' || newFileName === item.name) return;

    const newPathParts = item.path.split('/');
    newPathParts[newPathParts.length - 1] = newFileName.trim();
    const newRelativePath = newPathParts.join('/');
    const newFullPath = currentRootFolderPath + '/' + newRelativePath;
    const newLowerKey = newRelativePath.toLowerCase();

    if (fileDataMap.has(newLowerKey)) {
        alert('同名文件已存在！');
        return;
    }

    if (window.AndroidFS && window.AndroidFS.renameFileOrFolder(item.fullPath, newFullPath)) {
        fileDataMap.delete(currentFileKey);
        deletePathFromTree(mdTree, item.path);

        item.name = newFileName.trim();
        item.path = newRelativePath;
        item.fullPath = newFullPath;

        fileDataMap.set(newLowerKey, item);
        insertPathToTree(mdTree, newRelativePath, { keyLower: newLowerKey, path: newRelativePath, fullPath: newFullPath, isMedia: false });

        currentFileKey = newLowerKey;
        try {
            localStorage.setItem('last_file_key', newLowerKey);
        } catch (e) {}

        refreshTrees();
        fileTitle.textContent = newRelativePath;
        alert('重命名成功！');
    } else {
        alert('重命名失败！');
    }
});

btnRenameFolder.addEventListener('click', () => {
    if (!currentFolderPath) {
        alert('请先点击选择要重命名的文件夹！');
        return;
    }

    const pathParts = currentFolderPath.replace(/\\/g, '/').split('/').filter(Boolean);
    const oldFolderName = pathParts[pathParts.length - 1];
    const newFolderName = prompt('请输入新文件夹名称：', oldFolderName);
    
    if (!newFolderName || !newFolderName.trim() || newFolderName === oldFolderName) return;

    pathParts[pathParts.length - 1] = newFolderName.trim();
    const newFolderPath = pathParts.join('/');
    
    const oldFullPath = currentRootFolderPath + '/' + currentFolderPath;
    const newFullPath = currentRootFolderPath + '/' + newFolderPath;

    if (window.AndroidFS && window.AndroidFS.renameFileOrFolder(oldFullPath, newFullPath)) {
        alert('文件夹重命名成功！');
        currentFolderPath = '';
        rescanDirectorySilently();
    } else {
        alert('文件夹重命名失败！');
    }
});

btnDeleteFile.addEventListener('click', () => {
    syncCurrentContent();

    if (mediaViewer && mediaViewer.style.display !== 'none' && activeMediaPath) {
        const keyLower = activeMediaPath.toLowerCase();
        const fullPath = currentRootFolderPath + '/' + activeMediaPath;

        if (!confirm(`确定要彻底删除媒体文件 "${activeMediaPath}" 吗？`)) return;

        if (window.AndroidFS) {
            window.AndroidFS.deleteFileOrFolder(fullPath);
        }

        mediaUrlsMap.delete(keyLower);
        mediaPathsMap.delete(keyLower);
        deletePathFromTree(mediaTree, activeMediaPath);

        activeMediaPath = '';
        mediaViewer.style.display = 'none';
        fileTitle.textContent = '未选择文件';

        refreshTrees();
        alert('媒体文件已删除！');
        return;
    }

    if (!currentFileKey) {
        alert('请先选择要删除的文件！');
        return;
    }

    const item = fileDataMap.get(currentFileKey);
    if (!confirm(`确定要彻底删除本地文件 "${item.path}" 吗？`)) return;

    if (window.AndroidFS && item.fullPath) {
        window.AndroidFS.deleteFileOrFolder(item.fullPath);
    }

    fileDataMap.delete(currentFileKey);
    deletePathFromTree(mdTree, item.path);

    try {
        localStorage.removeItem('last_file_key');
    } catch (e) {}

    currentFileKey = '';
    editor.value = '';
    editor.setAttribute('readonly', 'true');
    preview.innerHTML = '';
    fileTitle.textContent = '未选择文件';

    refreshTrees();
});

btnDeleteFolder.addEventListener('click', () => {
    if (!currentFolderPath) {
        alert('请先点击选择要删除的文件夹！');
        return;
    }

    if (!confirm(`确定要彻底删除文件夹 "${currentFolderPath}" 及其包含的所有内容吗？`)) return;

    const fullPath = currentRootFolderPath + '/' + currentFolderPath;

    if (window.AndroidFS) {
        window.AndroidFS.deleteFileOrFolder(fullPath);
    }

    alert('文件夹已删除！');
    currentFolderPath = '';
    rescanDirectorySilently();
});

// ==================== 上次进度跳转（只恢复该文件夹的图片/媒体） ====================
if (btnLastProgress) {
    btnLastProgress.addEventListener('click', () => {
        if (!currentRootFolderPath) {
            alert('请先打开本地文件夹！');
            return;
        }

        // 优先使用树中选中的文件夹；否则用当前媒体所在文件夹
        let targetFolder = currentFolderPath || '';
        if (!targetFolder) {
            targetFolder = getCurrentMediaFolderPath();
        }

        if (!targetFolder) {
            // 没有选中子文件夹时，恢复整体最后一次（可能是文章或图片）
            const ok = restoreFolderViewState(currentRootFolderPath, '');
            if (ok) {
                closeDrawer();
                setTimeout(() => {
                    if (activeMediaPath) {
                        expandAndHighlightPath(activeMediaPath.toLowerCase(), mediaList, true);
                    } else if (currentFileKey) {
                        expandAndHighlightPath(currentFileKey, mdList, true);
                    }
                }, 50);
                alert('已跳转到上次阅读位置');
            } else {
                alert('暂无保存的进度记录');
            }
            return;
        }

        // 指定了文件夹 → 只恢复该文件夹下的图片进度
        const ok = restoreFolderViewState(currentRootFolderPath, targetFolder);
        if (ok) {
            closeDrawer();
            setTimeout(() => {
                if (activeMediaPath) {
                    expandAndHighlightPath(activeMediaPath.toLowerCase(), mediaList, true);
                }
            }, 50);
            alert(`已跳转到文件夹「${targetFolder}」的上次图片进度`);
        } else {
            alert(`文件夹「${targetFolder}」暂无保存的图片进度\n（进入该文件夹下的图片后会自动记住）`);
        }
    });
}

// ==================== 切换资源（笔记目录 ↔ 媒体资源 同一文件夹） ====================
/**
 * 根据相对路径展开并高亮目标树中的文件夹（不要求文件存在）
 * @param {string} folderPath 相对路径，如 "快乐文件夹" 或 "a/b"
 * @param {HTMLElement} containerEl mdList 或 mediaList
 * @returns {boolean} 是否成功展开
 */
function expandAndHighlightFolder(folderPath, containerEl) {
    if (!folderPath || !containerEl) return false;
    const normalized = folderPath.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '').toLowerCase();
    if (!normalized) return false;

    const parts = normalized.split('/').filter(Boolean);
    let currentUl = containerEl.querySelector(':scope > ul.tree-node');
    if (!currentUl) return false;

    let matchedFolderLi = null;

    for (let i = 0; i < parts.length; i++) {
        const folderName = parts[i];
        const folderLis = currentUl.querySelectorAll(':scope > li.tree-folder');
        matchedFolderLi = null;

        for (const li of folderLis) {
            if (li.dataset.folderName === folderName) {
                matchedFolderLi = li;
                break;
            }
        }

        if (!matchedFolderLi) return false;

        matchedFolderLi.style.display = 'block';
        const childrenUl = matchedFolderLi._ensureRendered
            ? matchedFolderLi._ensureRendered()
            : matchedFolderLi.querySelector(':scope > ul');

        if (childrenUl) {
            childrenUl.style.display = 'block';
            const arrow = matchedFolderLi.querySelector(':scope > .folder-header .arrow');
            if (arrow) arrow.textContent = '▼';
            currentUl = childrenUl;
        } else if (i < parts.length - 1) {
            return false;
        }
    }

    if (matchedFolderLi) {
        document.querySelectorAll('.tree-file').forEach(el => el.classList.remove('active'));
        document.querySelectorAll('.folder-header').forEach(el => el.classList.remove('active'));
        const header = matchedFolderLi.querySelector(':scope > .folder-header');
        if (header) {
            header.classList.add('active');
            currentFolderPath = matchedFolderLi.dataset.folderPath || folderPath;
            currentFileKey = '';
            setTimeout(() => {
                matchedFolderLi.scrollIntoView({ block: 'center', behavior: 'smooth' });
            }, 80);
        }
        return true;
    }
    return false;
}

/**
 * 获取当前选中项所属的相对文件夹路径
 * - 正在看媒体 → 媒体所在文件夹
 * - 正在看笔记 → 笔记所在文件夹
 * - 仅选中了文件夹 → 该文件夹本身
 */
function getCurrentSelectedFolderPath() {
    if (mediaViewer && mediaViewer.style.display !== 'none' && activeMediaPath) {
        return getCurrentMediaFolderPath();
    }
    if (currentFileKey) {
        const parts = currentFileKey.replace(/\\/g, '/').split('/').filter(Boolean);
        parts.pop();
        return parts.join('/');
    }
    if (currentFolderPath) {
        return currentFolderPath.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
    }
    return '';
}

/**
 * 判断当前侧是「媒体侧」还是「笔记侧」
 * 媒体侧：正在预览媒体，或在媒体树中选中了文件夹
 */
function isCurrentlyOnMediaSide() {
    if (mediaViewer && mediaViewer.style.display !== 'none' && activeMediaPath) {
        return true;
    }
    // 若当前选中的是文件夹，且该文件夹在媒体树中存在对应节点，则视为可从媒体侧切换
    // 这里以「最近一次点击的文件类型」为主：有 activeMediaPath 则媒体侧，有 currentFileKey 则笔记侧
    // 仅选文件夹时，根据抽屉内 active 的 folder-header 所在列表判断
    const activeFolderHeader = document.querySelector('#media-list .folder-header.active');
    if (activeFolderHeader) return true;
    return false;
}

if (btnSwitchResource) {
    btnSwitchResource.addEventListener('click', () => {
        if (!currentRootFolderPath) {
            alert('请先打开本地文件夹！');
            return;
        }

        const folderPath = getCurrentSelectedFolderPath();
        // 根目录时 folderPath 为空字符串，仍然允许切换两侧根节点

        const onMediaSide = isCurrentlyOnMediaSide();
        // 目标侧：当前在媒体侧 → 切到笔记目录；当前在笔记侧 → 切到媒体资源
        const targetContainer = onMediaSide ? mdList : mediaList;
        const sideName = onMediaSide ? '笔记目录' : '媒体资源';

        // 先重置折叠，再展开目标侧
        resetTreeCollapse();

        let ok = false;
        if (!folderPath) {
            // 根目录：直接滚动到对应列表顶部并清除文件选中
            document.querySelectorAll('.tree-file').forEach(el => el.classList.remove('active'));
            document.querySelectorAll('.folder-header').forEach(el => el.classList.remove('active'));
            currentFolderPath = '';
            currentFileKey = '';
            if (onMediaSide) {
                // 切到笔记：隐藏媒体预览，回到编辑区空状态
                if (mediaViewer) mediaViewer.style.display = 'none';
                activeMediaPath = '';
                if (modeToggleGroup) modeToggleGroup.style.display = 'flex';
                if (btnSave) btnSave.style.display = 'block';
                if (btnCopyNoteTag) btnCopyNoteTag.style.display = 'none';
                fileTitle.textContent = currentRootFolderPath || '未选择文件';
            }
            const sectionTitle = targetContainer.previousElementSibling;
            if (sectionTitle) {
                setTimeout(() => sectionTitle.scrollIntoView({ block: 'start', behavior: 'smooth' }), 50);
            }
            ok = true;
        } else {
            ok = expandAndHighlightFolder(folderPath, targetContainer);
            if (ok && onMediaSide) {
                // 从媒体切到笔记：关闭媒体预览，准备看笔记
                if (mediaViewer) mediaViewer.style.display = 'none';
                activeMediaPath = '';
                if (modeToggleGroup) modeToggleGroup.style.display = 'flex';
                if (btnSave) btnSave.style.display = 'block';
                if (btnCopyNoteTag) btnCopyNoteTag.style.display = 'none';
                fileTitle.textContent = folderPath || currentRootFolderPath || '未选择文件';
                editor.value = '';
                editor.setAttribute('readonly', 'true');
                preview.innerHTML = '';
            }
        }

        if (ok) {
            // 确保抽屉打开，方便用户看到另一侧
            if (!bottomSheet.classList.contains('active')) {
                openDrawer();
            }
            // 轻微提示
            const tip = folderPath
                ? `已切换到「${folderPath}」的${sideName}`
                : `已切换到根目录的${sideName}`;
            // 用短时 toast 式提示，避免打断操作；若环境无 toast 则静默
            if (typeof console !== 'undefined') console.log(tip);
        } else {
            alert(folderPath
                ? `在${sideName}中未找到文件夹「${folderPath}」`
                : `无法切换到${sideName}`);
        }
    });
}

// ==================== 剪切与粘贴功能 ====================
if (btnCut) {
    btnCut.addEventListener('click', () => {
        syncCurrentContent();

        if (clipboardItem) {
            const currentItem = currentFileKey ? fileDataMap.get(currentFileKey) : null;
            const isSameFile = currentItem && clipboardItem.type === 'file' && clipboardItem.relativePath === currentItem.path;
            const isSameFolder = !currentItem && currentFolderPath && clipboardItem.type === 'folder' && clipboardItem.relativePath === currentFolderPath;

            if (isSameFile || isSameFolder) {
                clipboardItem = null;
                if (btnPaste) {
                    btnPaste.setAttribute('disabled', 'true');
                    btnPaste.style.background = '';
                }
                alert('已取消剪切！');
                return;
            }
        }

        if (currentFileKey) {
            const item = fileDataMap.get(currentFileKey);
            clipboardItem = {
                type: 'file',
                relativePath: item.path,
                fullPath: item.fullPath,
                name: item.name
            };
            alert(`已剪切文件："${item.name}"\n再次点击可取消剪切；或选择目标文件夹后点击“粘贴”`);
        } else if (currentFolderPath) {
            const parts = currentFolderPath.split('/');
            const folderName = parts[parts.length - 1];
            clipboardItem = {
                type: 'folder',
                relativePath: currentFolderPath,
                fullPath: currentRootFolderPath + '/' + currentFolderPath,
                name: folderName
            };
            alert(`已剪切文件夹："${folderName}"\n再次点击可取消剪切；或选择目标文件夹后点击“粘贴”`);
        } else {
            alert('请先选择要剪切的文件或文件夹！');
            return;
        }

        if (btnPaste) {
            btnPaste.removeAttribute('disabled');
            btnPaste.style.background = '#0e639c';
        }
    });
}

if (btnPaste) {
    btnPaste.addEventListener('click', () => {
        if (!clipboardItem) {
            alert('剪贴板为空！');
            return;
        }

        const targetFolder = currentFolderPath ? currentFolderPath : '';
        const newRelativePath = targetFolder ? `${targetFolder}/${clipboardItem.name}` : clipboardItem.name;
        const newFullPath = currentRootFolderPath + '/' + newRelativePath;

        if (clipboardItem.relativePath === newRelativePath) {
            alert('源路径与目标路径一致，无需移动！');
            return;
        }

        if (clipboardItem.type === 'folder' && newRelativePath.startsWith(clipboardItem.relativePath + '/')) {
            alert('不能将文件夹移动到其自身的子文件夹内！');
            return;
        }

        if (window.AndroidFS && window.AndroidFS.renameFileOrFolder(clipboardItem.fullPath, newFullPath)) {
            alert('移动成功！');
            
            clipboardItem = null;
            btnPaste.setAttribute('disabled', 'true');
            btnPaste.style.background = '';
            currentFolderPath = '';
            
            rescanDirectorySilently();
        } else {
            alert('移动失败，请检查文件系统权限或目标路径是否存在同名文件！');
        }
    });
}

// ==================== 视频全屏与封面辅助函数 ====================
/** 伪全屏状态（WebView 下 requestFullscreen 常失败，改用 CSS 伪全屏） */
let isVideoPseudoFullscreen = false;

/** 滑动快进状态 */
let seekTouchStartX = 0;
let seekTouchStartY = 0;
let seekTouchStartTime = 0;
let seekStartVideoTime = 0;
let isSeekingByGesture = false;
let seekIndicatorEl = null;
let seekHideTimer = null;

/**
 * 判断当前视频是否处于全屏状态（真全屏 或 伪全屏）
 */
function isVideoInFullscreen() {
    if (isVideoPseudoFullscreen) return true;
    if (window.__nativeVideoFullscreen) return true;
    const video = videoDisplay;
    if (!video) return false;
    return !!(
        document.fullscreenElement === video ||
        document.webkitFullscreenElement === video ||
        video.webkitDisplayingFullscreen === true
    );
}

/**
 * 确保存在快进提示层
 */
function ensureSeekIndicator() {
    if (seekIndicatorEl) return seekIndicatorEl;
    seekIndicatorEl = document.createElement('div');
    seekIndicatorEl.id = 'video-seek-indicator';
    seekIndicatorEl.innerHTML = '<span class="seek-icon"></span><span class="seek-text">0s</span>';
    document.body.appendChild(seekIndicatorEl);
    return seekIndicatorEl;
}

/**
 * 显示快进/后退提示
 */
function showSeekIndicator(deltaSec) {
    const el = ensureSeekIndicator();
    const abs = Math.abs(deltaSec);
    const sign = deltaSec >= 0 ? '+' : '-';
    el.querySelector('.seek-icon').textContent = deltaSec >= 0 ? '⏩' : '⏪';
    el.querySelector('.seek-text').textContent = `${sign}${abs.toFixed(0)}s`;
    el.classList.add('visible');
    el.classList.toggle('forward', deltaSec >= 0);
    el.classList.toggle('backward', deltaSec < 0);

    if (seekHideTimer) clearTimeout(seekHideTimer);
    seekHideTimer = setTimeout(() => {
        el.classList.remove('visible');
    }, 800);
}

/**
 * 对当前视频执行相对跳转
 */
function seekVideoBy(deltaSec) {
    const video = videoDisplay;
    if (!video || video.style.display === 'none') return;
    if (!isFinite(video.duration) || video.duration <= 0) return;

    let t = (video.currentTime || 0) + deltaSec;
    t = Math.max(0, Math.min(video.duration - 0.1, t));
    try {
        video.currentTime = t;
    } catch (e) {}
    showSeekIndicator(deltaSec);
}

/**
 * 绑定视频滑动快进 / 双击 ±10s（全屏或普通播放时都可用）
 */
function setupVideoSeekGestures() {
    const target = mediaViewer || videoDisplay;
    if (!target || target._seekGesturesBound) return;
    target._seekGesturesBound = true;

    const SWIPE_THRESHOLD = 40;      // 水平滑动超过多少像素开始判定为快进
    const VERTICAL_LIMIT = 80;       // 垂直位移过大则认为是滚动，不触发快进
    const DOUBLE_TAP_MS = 280;
    let lastTapTime = 0;
    let lastTapX = 0;

    target.addEventListener('touchstart', (e) => {
        if (!videoDisplay || videoDisplay.style.display === 'none') return;
        if (e.touches.length !== 1) return;
        // 点在控件按钮上时不处理
        if (e.target.closest('button') || e.target.closest('.media-actions')) return;

        const t = e.touches[0];
        seekTouchStartX = t.clientX;
        seekTouchStartY = t.clientY;
        seekTouchStartTime = Date.now();
        seekStartVideoTime = videoDisplay.currentTime || 0;
        isSeekingByGesture = false;
    }, { passive: true });

    target.addEventListener('touchmove', (e) => {
        if (!videoDisplay || videoDisplay.style.display === 'none') return;
        if (e.touches.length !== 1) return;

        const t = e.touches[0];
        const dx = t.clientX - seekTouchStartX;
        const dy = t.clientY - seekTouchStartY;

        // 垂直滑动优先，避免和页面滚动冲突
        if (Math.abs(dy) > VERTICAL_LIMIT && Math.abs(dy) > Math.abs(dx)) {
            return;
        }

        if (Math.abs(dx) > SWIPE_THRESHOLD) {
            isSeekingByGesture = true;
            // 每 8 像素 ≈ 1 秒，最大一次滑动 ±120 秒
            const deltaSec = Math.max(-120, Math.min(120, dx / 8));
            const newTime = Math.max(0, Math.min(
                (videoDisplay.duration || 0) - 0.1,
                seekStartVideoTime + deltaSec
            ));
            try {
                videoDisplay.currentTime = newTime;
            } catch (err) {}
            showSeekIndicator(deltaSec);

            // 全屏时阻止默认，避免误触系统手势
            if (isVideoInFullscreen() && e.cancelable) {
                e.preventDefault();
            }
        }
    }, { passive: false });

    target.addEventListener('touchend', (e) => {
        if (!videoDisplay || videoDisplay.style.display === 'none') return;

        const now = Date.now();
        const touch = e.changedTouches && e.changedTouches[0];
        const x = touch ? touch.clientX : 0;

        // 双击左右区域 ±10 秒（非滑动时）
        if (!isSeekingByGesture && touch) {
            if (now - lastTapTime < DOUBLE_TAP_MS && Math.abs(x - lastTapX) < 60) {
                const rect = target.getBoundingClientRect();
                const ratio = (x - rect.left) / rect.width;
                if (ratio < 0.35) {
                    seekVideoBy(-10);
                } else if (ratio > 0.65) {
                    seekVideoBy(10);
                }
                lastTapTime = 0;
            } else {
                lastTapTime = now;
                lastTapX = x;
            }
        }

        isSeekingByGesture = false;
    }, { passive: true });
}

// 页面加载后绑定手势
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupVideoSeekGestures);
} else {
    setupVideoSeekGestures();
}

/**
 * 尝试从视频第一帧生成封面（poster）
 */
function tryGenerateVideoPoster(videoEl) {
    if (!videoEl) return;
    videoEl.poster = ''; // 先清空

    const generate = () => {
        if (!videoEl.videoWidth || !videoEl.videoHeight) return;
        try {
            const maxW = 640;
            const ratio = videoEl.videoWidth / videoEl.videoHeight;
            const canvas = document.createElement('canvas');
            canvas.width = Math.min(videoEl.videoWidth, maxW);
            canvas.height = Math.round(canvas.width / ratio);

            const ctx = canvas.getContext('2d');
            ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
            videoEl.poster = canvas.toDataURL('image/jpeg', 0.75);
        } catch (err) {
            console.warn('生成视频封面失败:', err);
        }
    };

    const onSeeked = () => {
        videoEl.removeEventListener('seeked', onSeeked);
        generate();
        // 回到开头
        try {
            videoEl.currentTime = 0;
        } catch (e) {}
    };

    const onLoadedMeta = () => {
        videoEl.removeEventListener('loadedmetadata', onLoadedMeta);
        // 轻微 seek 确保有可用帧
        const seekTo = Math.min(0.15, (videoEl.duration || 1) * 0.05);
        videoEl.addEventListener('seeked', onSeeked, { once: true });
        try {
            videoEl.currentTime = seekTo;
        } catch (e) {
            // 如果 seek 失败，直接尝试生成
            generate();
        }
    };

    if (videoEl.readyState >= 1) {
        onLoadedMeta();
    } else {
        videoEl.addEventListener('loadedmetadata', onLoadedMeta, { once: true });
    }
}

/**
 * 通知原生设置全屏期望方向（landscape / portrait / auto）
 */
function setNativeFullscreenOrientation(mode) {
    preferredFullscreenOrientation = mode || '';
    try {
        if (window.AndroidFS && typeof window.AndroidFS.setFullscreenOrientation === 'function') {
            window.AndroidFS.setFullscreenOrientation(mode || 'auto');
        }
    } catch (e) {}
    // 同时尝试 Web Orientation API（部分环境可用）
    try {
        if (mode === 'landscape' && screen.orientation && screen.orientation.lock) {
            screen.orientation.lock('landscape').catch(() => {});
        } else if (mode === 'portrait' && screen.orientation && screen.orientation.lock) {
            screen.orientation.lock('portrait').catch(() => {});
        } else if (screen.orientation && screen.orientation.unlock) {
            screen.orientation.unlock();
        }
    } catch (e) {}
}

/**
 * 进入视频全屏
 * @param {'landscape'|'portrait'} orientation 用户选择的方向
 */
function enterVideoFullscreen(orientation) {
    const video = videoDisplay;
    if (!video || video.style.display === 'none') return;

    const mode = orientation === 'portrait' ? 'portrait' : 'landscape';
    setNativeFullscreenOrientation(mode);

    // 1. 先尝试系统 Fullscreen API
    const tryNative = () => {
        if (video.requestFullscreen) {
            return video.requestFullscreen().then(() => {
                // 成功进入真全屏
            }).catch(() => {
                enterPseudoFullscreen(mode);
            });
        } else if (video.webkitRequestFullscreen) {
            video.webkitRequestFullscreen();
            setTimeout(() => {
                if (!isVideoInFullscreen()) enterPseudoFullscreen(mode);
            }, 300);
            return;
        } else if (video.webkitEnterFullscreen) {
            try {
                video.webkitEnterFullscreen();
            } catch (e) {
                enterPseudoFullscreen(mode);
            }
            return;
        }
        enterPseudoFullscreen(mode);
    };

    tryNative();
}

/**
 * 可靠的 CSS 伪全屏
 * @param {'landscape'|'portrait'} [mode]
 */
function enterPseudoFullscreen(mode) {
    if (isVideoPseudoFullscreen) return;
    isVideoPseudoFullscreen = true;
    if (mode) preferredFullscreenOrientation = mode;

    document.body.classList.add('video-pseudo-fs');
    if (mediaViewer) mediaViewer.classList.add('video-pseudo-fs');
    if (videoDisplay) {
        videoDisplay.classList.add('video-pseudo-fs');
        videoDisplay.style.objectFit = 'contain';
    }

    updateFullscreenButtonsUI(true);

    // 尝试锁定方向
    setNativeFullscreenOrientation(preferredFullscreenOrientation || mode || 'landscape');

    try {
        if (videoDisplay.paused) videoDisplay.play().catch(() => {});
    } catch (e) {}
}

/**
 * 退出伪全屏
 */
function exitPseudoFullscreen() {
    if (!isVideoPseudoFullscreen) return;
    isVideoPseudoFullscreen = false;

    document.body.classList.remove('video-pseudo-fs');
    if (mediaViewer) mediaViewer.classList.remove('video-pseudo-fs');
    if (videoDisplay) {
        videoDisplay.classList.remove('video-pseudo-fs');
        videoDisplay.style.objectFit = '';
    }

    updateFullscreenButtonsUI(false);
    setNativeFullscreenOrientation('auto');
    preferredFullscreenOrientation = '';
}

/**
 * 更新全屏按钮显示文案
 */
function updateFullscreenButtonsUI(inFullscreen) {
    if (inFullscreen) {
        // 全屏中：两个按钮都显示为「退出全屏」，点任意一个即可退出
        if (btnFullscreenLandscape) {
            btnFullscreenLandscape.textContent = '⛶ 退出全屏';
            btnFullscreenLandscape.style.display = 'inline-flex';
        }
        if (btnFullscreenPortrait) {
            btnFullscreenPortrait.textContent = '⛶ 退出全屏';
            btnFullscreenPortrait.style.display = 'inline-flex';
        }
    } else {
        if (btnFullscreenLandscape) {
            btnFullscreenLandscape.textContent = '⛶ 横屏全屏';
        }
        if (btnFullscreenPortrait) {
            btnFullscreenPortrait.textContent = '⛶ 竖屏全屏';
        }
    }
}

/**
 * 退出任意全屏
 */
function exitAnyFullscreen() {
    if (isVideoPseudoFullscreen) {
        exitPseudoFullscreen();
    } else if (document.fullscreenElement || document.webkitFullscreenElement) {
        if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
        else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
        setNativeFullscreenOrientation('auto');
        preferredFullscreenOrientation = '';
        updateFullscreenButtonsUI(false);
    }
}

/**
 * 点击横屏/竖屏按钮
 */
function onFullscreenButtonClick(orientation) {
    if (isVideoInFullscreen()) {
        exitAnyFullscreen();
    } else {
        enterVideoFullscreen(orientation);
    }
}

// ==================== 媒体预览、大图与上下触碰切图/流式查看 ====================
function previewMedia(keyLower, fileName, displayPath, isVideo) {
    if (currentFileKey && currentFileKey !== keyLower) {
        flushCurrentFileBeforeLeave();
    } else {
        syncCurrentContent();
    }

    if (currentRootFolderPath && currentFileKey && currentFileKey !== keyLower) {
        saveFolderViewState();
    }

    activeMediaPath = displayPath.replace(/\\/g, '/');
    currentFileKey = keyLower;
    currentMediaList = getSameFolderMediaList(keyLower);
    currentMediaIndex = currentMediaList.findIndex(item => item.keyLower === keyLower);

    const totalCount = currentMediaList.length;
    const progressText = totalCount > 0 ? ` (${currentMediaIndex + 1}/${totalCount})` : '';
    fileTitle.textContent = `${isVideo ? '🎬' : '🖼️'} ${displayPath}${progressText}`;

    try {
        localStorage.setItem('last_file_key', keyLower);
    } catch (e) {
        console.error('保存打开媒体文件记录失败:', e);
    }

    editor.style.display = 'none';
    preview.style.display = 'none';
    mediaViewer.style.display = 'flex';
    modeToggleGroup.style.display = 'none';
    btnSave.style.display = 'none';
    if (btnCopyNoteTag) btnCopyNoteTag.style.display = 'none';

    const url = mediaUrlsMap.get(keyLower);

    if (isVideo) {
        imgDisplay.style.display = 'none';
        btnZoomImg.style.display = 'none';
        if (btnFullscreenLandscape) btnFullscreenLandscape.style.display = 'inline-flex';
        if (btnFullscreenPortrait) btnFullscreenPortrait.style.display = 'inline-flex';
        updateFullscreenButtonsUI(false);
        videoDisplay.style.display = 'block';
        videoDisplay.src = url;
        // 生成封面
        tryGenerateVideoPoster(videoDisplay);
    } else {
        // 切到图片时退出伪全屏
        if (isVideoPseudoFullscreen) exitPseudoFullscreen();
        videoDisplay.pause();
        videoDisplay.style.display = 'none';
        if (btnFullscreenLandscape) btnFullscreenLandscape.style.display = 'none';
        if (btnFullscreenPortrait) btnFullscreenPortrait.style.display = 'none';
        imgDisplay.style.display = 'block';
        btnZoomImg.style.display = 'inline-flex';
        imgDisplay.src = url;
    }

    if (currentRootFolderPath) {
        saveFolderViewState();
    }
}

function openImageModal() {
    if (!currentMediaList || currentMediaList.length === 0 || currentMediaIndex === -1) return;
    const currentItem = currentMediaList[currentMediaIndex];
    if (currentItem && currentItem.isVideo) return;

    imageModal.style.display = 'flex';
    switchModalMode(currentModalMode);
}

function initStreamObserver() {
    if (streamObserver) {
        streamObserver.disconnect();
    }

    streamObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const idx = parseInt(entry.target.dataset.index, 10);
                if (!isNaN(idx) && idx !== currentMediaIndex) {
                    currentMediaIndex = idx;
                    updateModalCounter();
                }
            }
        });
    }, {
        root: modalStreamView,
        rootMargin: '-40% 0px -40% 0px',
        threshold: 0
    });

    const imgs = modalStreamView.querySelectorAll('img');
    imgs.forEach(img => streamObserver.observe(img));
}

function renderModalStreamView() {
    modalStreamView.innerHTML = '';
    if (!currentMediaList) return;

    currentMediaList.forEach((item, idx) => {
        if (item.isVideo) return;
        const url = item.srcUrl || mediaUrlsMap.get(item.keyLower) || '';
        const streamImg = document.createElement('img');
        streamImg.src = url;
        streamImg.dataset.index = idx;
        if (idx === currentMediaIndex) {
            streamImg.id = 'target-stream-img';
        }
        modalStreamView.appendChild(streamImg);
    });

    updateModalCounter();

    const targetEl = document.getElementById('target-stream-img');
    if (targetEl) {
        setTimeout(() => {
            targetEl.scrollIntoView({ behavior: 'auto', block: 'center' });
            initStreamObserver();
        }, 50);
    } else {
        initStreamObserver();
    }
}

function switchModalMode(mode) {
    currentModalMode = mode;
    if (mode === 'paged') {
        if (streamObserver) {
            streamObserver.disconnect();
            streamObserver = null;
        }

        btnModalPaged.classList.add('active');
        btnModalStream.classList.remove('active');
        modalPagedView.style.display = 'flex';
        modalStreamView.style.display = 'none';

        if (currentMediaList && currentMediaIndex >= 0) {
            const currentItem = currentMediaList[currentMediaIndex];
            const url = currentItem.srcUrl || mediaUrlsMap.get(currentItem.keyLower) || '';
            modalImg.src = url;
        }
        updateModalCounter();
    } else {
        btnModalStream.classList.add('active');
        btnModalPaged.classList.remove('active');
        modalPagedView.style.display = 'none';
        modalStreamView.style.display = 'flex';
        renderModalStreamView();
    }
}

btnModalPaged.addEventListener('click', (e) => {
    e.stopPropagation();
    switchModalMode('paged');
});

btnModalStream.addEventListener('click', (e) => {
    e.stopPropagation();
    switchModalMode('stream');
});

function updateModalCounter() {
    if (currentMediaList.length > 0) {
        modalCounter.textContent = `${currentMediaIndex + 1} / ${currentMediaList.length}`;
    }
}

function switchMedia(direction) {
    if (!currentMediaList || currentMediaList.length === 0) return;

    let newIndex = currentMediaIndex + direction;

    if (newIndex < 0 || newIndex >= currentMediaList.length) return;

    currentMediaIndex = newIndex;
    const targetItem = currentMediaList[currentMediaIndex];

    if (mediaViewer.style.display !== 'none') {
        previewMedia(targetItem.keyLower, targetItem.name, targetItem.path, targetItem.isVideo);
    }

    if (imageModal.style.display === 'flex' && !targetItem.isVideo) {
        if (currentModalMode === 'paged') {
            const url = targetItem.srcUrl || mediaUrlsMap.get(targetItem.keyLower) || '';
            modalImg.src = url;
            updateModalCounter();
        } else if (currentModalMode === 'stream') {
            const targetImg = modalStreamView.querySelector(`img[data-index="${currentMediaIndex}"]`);
            if (targetImg) {
                targetImg.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            updateModalCounter();
        }
    }
}

imgDisplay.addEventListener('click', (e) => {
    e.stopPropagation();
    openImageModal();
});

btnZoomImg.addEventListener('click', openImageModal);

if (btnFullscreenLandscape) {
    btnFullscreenLandscape.addEventListener('click', (e) => {
        e.stopPropagation();
        onFullscreenButtonClick('landscape');
    });
}
if (btnFullscreenPortrait) {
    btnFullscreenPortrait.addEventListener('click', (e) => {
        e.stopPropagation();
        onFullscreenButtonClick('portrait');
    });
}

// 真全屏退出时同步状态
function syncFullscreenExitUI() {
    if (!document.fullscreenElement && !document.webkitFullscreenElement && !isVideoPseudoFullscreen) {
        preferredFullscreenOrientation = '';
        setNativeFullscreenOrientation('auto');
        updateFullscreenButtonsUI(false);
    }
}
document.addEventListener('fullscreenchange', syncFullscreenExitUI);
document.addEventListener('webkitfullscreenchange', syncFullscreenExitUI);

// 原生真全屏回调（MainActivity 里 evaluateJavascript）
window.onNativeVideoFullscreen = function (entering) {
    if (entering) {
        updateFullscreenButtonsUI(true);
    } else {
        preferredFullscreenOrientation = '';
        updateFullscreenButtonsUI(false);
    }
};


mediaViewer.addEventListener('click', (e) => {
    if (e.target.closest('button') || e.target.closest('.media-btn') || e.target.tagName === 'VIDEO' || e.target === imgDisplay) {
        return;
    }

    // 全屏时不响应上下触碰切图，避免误触
    if (isVideoInFullscreen()) return;

    const rect = mediaViewer.getBoundingClientRect();
    const clickRatio = (e.clientY - rect.top) / rect.height;

    if (clickRatio < PREV_TOUCH_RATIO) {
        switchMedia(-1);
    } else {
        switchMedia(1);
    }
});

imageModal.addEventListener('click', (e) => {
    if (e.target === modalClose) {
        if (streamObserver) {
            streamObserver.disconnect();
            streamObserver = null;
        }
        imageModal.style.display = 'none';
        return;
    }

    if (e.target.closest('.modal-mode-switch') || e.target.closest('.modal-close')) {
        return;
    }

    if (currentModalMode === 'paged') {
        const rect = imageModal.getBoundingClientRect();
        const clickRatio = (e.clientY - rect.top) / rect.height;

        if (clickRatio < PREV_TOUCH_RATIO) {
            switchMedia(-1);
        } else {
            switchMedia(1);
        }
    }
});

modalClose.addEventListener('click', () => {
    if (streamObserver) {
        streamObserver.disconnect();
        streamObserver = null;
    }
    imageModal.style.display = 'none';
});

// ==================== 音量键与方向键翻页监听 ====================
window.addEventListener('keydown', (e) => {
    const isModalOpen = imageModal && imageModal.style.display === 'flex';
    const isMediaOpen = mediaViewer && mediaViewer.style.display !== 'none';

    if (!isModalOpen && !isMediaOpen) return;

    const isUpKey = e.key === 'AudioVolumeUp' || 
                   e.key === 'VolumeUp' || 
                   e.code === 'AudioVolumeUp' || 
                   e.keyCode === 24 || 
                   e.key === 'ArrowUp' || 
                   e.key === 'ArrowLeft' || 
                   e.key === 'PageUp';

    const isDownKey = e.key === 'AudioVolumeDown' || 
                     e.key === 'VolumeDown' || 
                     e.code === 'AudioVolumeDown' || 
                     e.keyCode === 25 || 
                     e.key === 'ArrowDown' || 
                     e.key === 'ArrowRight' || 
                     e.key === 'PageDown';

    // ★ 关键：视频全屏时，音量键交给系统调节音量，不再拦截
    if (isVideoInFullscreen() && (isUpKey || isDownKey)) {
        // 不 preventDefault，让系统正常处理音量
        return;
    }

    if (isUpKey) {
        e.preventDefault();
        switchMedia(-1);
    } else if (isDownKey) {
        e.preventDefault();
        switchMedia(1);
    }
});

// ==================== 复制语法与顶/底滚动 ====================
btnCopyTag.addEventListener('click', () => {
    if (!activeMediaPath) return;
    const tag = `![[${activeMediaPath}]]`; 
    navigator.clipboard.writeText(tag).then(() => {
        alert(`已复制媒体语法: ${tag}`);
    });
});

if (btnCopyNoteTag) {
    btnCopyNoteTag.addEventListener('click', () => {
        if (!currentFileKey) return;
        const item = fileDataMap.get(currentFileKey);
        if (!item) return;
        const tag = `[[${item.path}]]`;
        navigator.clipboard.writeText(tag).then(() => {
            alert(`已复制笔记语法: ${tag}`);
        });
    });
}

btnScrollTop.addEventListener('click', () => {
    if (currentMode === 'edit') editor.scrollTop = 0;
    else preview.scrollTop = 0;
});

btnScrollBottom.addEventListener('click', () => {
    if (currentMode === 'edit') editor.scrollTop = editor.scrollHeight;
    else preview.scrollTop = preview.scrollHeight;
});

// ==================== 抽屉内目录搜索逻辑（已修改为兼容懒加载） ====================
function performSearch() {
    const query = searchInput.value.toLowerCase().trim();

    if (!query) {
        document.querySelectorAll('#bottom-sheet .tree-folder, #bottom-sheet .tree-file').forEach(el => el.style.display = '');
        resetTreeCollapse();
        return;
    }

    // 1. 先隐藏当前 DOM 树中所有的文件夹与文件
    document.querySelectorAll('#bottom-sheet .tree-folder').forEach(el => el.style.display = 'none');
    document.querySelectorAll('#bottom-sheet .tree-file').forEach(el => el.style.display = 'none');

    // 2. 检索 Markdown 笔记 Map 数据，匹配文件名或相对路径，自动展开并创建 DOM 节点
    fileDataMap.forEach((item, keyLower) => {
        if (item.name.toLowerCase().includes(query) || item.path.toLowerCase().includes(query)) {
            expandAndHighlightPath(keyLower, mdList, false);
        }
    });

    // 3. 检索媒体 Map 数据，匹配文件名或相对路径，自动展开并创建 DOM 节点
    mediaPathsMap.forEach((relativePath, keyLower) => {
        const fileName = relativePath.split('/').pop().toLowerCase();
        if (fileName.includes(query) || relativePath.toLowerCase().includes(query)) {
            expandAndHighlightPath(keyLower, mediaList, false);
        }
    });
}

btnSearch.addEventListener('click', performSearch);

searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        performSearch();
    }
});

// ==================== 当前笔记内文本搜索功能 ====================
function resetNoteSearch() {
    noteSearchMatches = [];
    currentNoteSearchIndex = -1;
    if (noteSearchCount) noteSearchCount.textContent = '';
    
    if (editor) editor.classList.remove('is-searching');
    
    removePreviewHighlights();
}

function exitNoteSearch() {
    if (noteSearchInput) noteSearchInput.value = '';
    resetNoteSearch();

    if (currentMode === 'edit' && editor) {
        const pos = editor.selectionEnd;
        editor.setSelectionRange(pos, pos);
        editor.removeAttribute('inputmode');
        editor.blur();
    }
}

function performNoteSearch() {
    const query = noteSearchInput ? noteSearchInput.value.trim() : '';
    noteSearchMatches = [];
    currentNoteSearchIndex = -1;

    if (!query || !currentFileKey || !editor) {
        resetNoteSearch();
        return;
    }

    const text = editor.value;
    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase();

    let pos = lowerText.indexOf(lowerQuery);
    while (pos !== -1) {
        noteSearchMatches.push(pos);
        pos = lowerText.indexOf(lowerQuery, pos + 1);
    }

    if (noteSearchMatches.length > 0) {
        currentNoteSearchIndex = 0;
        jumpToNoteMatch();
    } else {
        if (noteSearchCount) noteSearchCount.textContent = '0/0';
        removePreviewHighlights();
    }
}

function jumpToNoteMatch() {
    if (currentNoteSearchIndex < 0 || currentNoteSearchIndex >= noteSearchMatches.length) return;

    const query = noteSearchInput.value.trim();
    const matchStart = noteSearchMatches[currentNoteSearchIndex];
    const matchEnd = matchStart + query.length;

    if (noteSearchCount) {
        noteSearchCount.textContent = `${currentNoteSearchIndex + 1}/${noteSearchMatches.length}`;
    }

    if (currentMode === 'edit') {
        editor.classList.add('is-searching');
        editor.setAttribute('inputmode', 'none');

        editor.focus();
        editor.setSelectionRange(matchStart, matchEnd);

        const textBefore = editor.value.substring(0, matchStart);
        const lineNumber = textBefore.split('\n').length;
        const totalLines = editor.value.split('\n').length;
        const lineRatio = (lineNumber - 1) / Math.max(1, totalLines);
        
        editor.scrollTop = Math.max(0, lineRatio * editor.scrollHeight - (editor.clientHeight / 2));
    } else {
        highlightInPreview(query);
    }
}

function highlightInPreview(query) {
    removePreviewHighlights();
    if (!query) return;

    const safeQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${safeQuery})`, 'gi');

    const walker = document.createTreeWalker(preview, NodeFilter.SHOW_TEXT, null, false);
    const nodesToReplace = [];
    
    while (walker.nextNode()) {
        const node = walker.currentNode;
        if (node.parentElement.tagName !== 'SCRIPT' && node.parentElement.tagName !== 'STYLE') {
            if (regex.test(node.nodeValue)) {
                nodesToReplace.push(node);
            }
        }
    }

    let matchCount = 0;
    nodesToReplace.forEach(node => {
        const span = document.createElement('span');
        span.innerHTML = node.nodeValue.replace(regex, (match) => {
            const isCurrent = matchCount === currentNoteSearchIndex;
            matchCount++;
            return `<mark class="search-highlight ${isCurrent ? 'active' : ''}">${match}</mark>`;
        });
        node.parentElement.replaceChild(span, node);
    });

    const activeMark = preview.querySelector('mark.search-highlight.active');
    if (activeMark) {
        activeMark.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
}

function removePreviewHighlights() {
    const marks = preview.querySelectorAll('mark.search-highlight');
    marks.forEach(mark => {
        const parent = mark.parentElement;
        parent.replaceChild(document.createTextNode(mark.textContent), mark);
        parent.normalize();
    });
}

if (btnNoteSearch) {
    btnNoteSearch.addEventListener('click', performNoteSearch);
}

if (noteSearchInput) {
    noteSearchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            performNoteSearch();
        }
    });
}

if (btnSearchPrev) {
    btnSearchPrev.addEventListener('click', () => {
        if (noteSearchMatches.length === 0) return;
        currentNoteSearchIndex = (currentNoteSearchIndex - 1 + noteSearchMatches.length) % noteSearchMatches.length;
        jumpToNoteMatch();
    });
}

if (btnSearchNext) {
    btnSearchNext.addEventListener('click', () => {
        if (noteSearchMatches.length === 0) return;
        currentNoteSearchIndex = (currentNoteSearchIndex + 1) % noteSearchMatches.length;
        jumpToNoteMatch();
    });
}

if (btnSearchExit) {
    btnSearchExit.addEventListener('click', exitNoteSearch);
}

// ==================== Markdown 渲染与 Wiki 语法解析 ====================
function parseObsidianLinks(rawText) {
    let currentFolderPrefix = '';
    if (currentFileKey && currentFileKey.includes('/')) {
        currentFolderPrefix = currentFileKey.substring(0, currentFileKey.lastIndexOf('/') + 1);
    }

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
            const sameFolderTarget = currentFolderPrefix + normalizedTarget;

            let keyLowerToUse = '';
            if (mediaUrlsMap.has(normalizedTarget)) keyLowerToUse = normalizedTarget;
            else if (mediaUrlsMap.has(sameFolderTarget)) keyLowerToUse = sameFolderTarget;
            else if (mediaShortNameMap.has(normalizedTarget)) keyLowerToUse = mediaShortNameMap.get(normalizedTarget);

            let mediaUrl = keyLowerToUse ? mediaUrlsMap.get(keyLowerToUse) : null;

            if (mediaUrl) {
                return isVideoExt 
                    ? `<video src="${mediaUrl}" data-key="${keyLowerToUse}" controls style="max-width:100%; border-radius:6px; margin: 8px 0;"></video>`
                    : `<img src="${mediaUrl}" data-key="${keyLowerToUse}" alt="${displayText}" title="${displayText}" style="cursor: pointer;" />`;
            }
            return `<span class="missing-link">📎 [未找到媒体: ${cleanTarget}]</span>`;
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

preview.addEventListener('click', (e) => {
    const wikiLink = e.target.closest('a.wiki-link');
    if (wikiLink && wikiLink.dataset.key) {
        e.preventDefault();
        loadMdContent(wikiLink.dataset.key);
        return;
    }

    const clickedImg = e.target.closest('img');
    if (clickedImg) {
        e.stopPropagation();
        const allPreviewImgs = Array.from(preview.querySelectorAll('img'));
        if (allPreviewImgs.length === 0) return;

        currentMediaList = allPreviewImgs.map(img => {
            const kLower = img.dataset.key || '';
            const displayPath = mediaPathsMap.get(kLower) || img.alt || '图片';
            const fileName = displayPath.split('/').pop();
            return {
                keyLower: kLower,
                name: fileName,
                path: displayPath,
                isFolder: false,
                isMedia: true,
                isVideo: false,
                srcUrl: img.src
            };
        });

        currentMediaIndex = allPreviewImgs.indexOf(clickedImg);
        if (currentMediaIndex !== -1) {
            openImageModal();
        }
    }
});

btnModeEdit.addEventListener('click', () => {
    syncCurrentContent();
    currentMode = 'edit';
    btnModeEdit.classList.add('active');
    btnModePreview.classList.remove('active');
    mediaViewer.style.display = 'none';
    editor.style.display = 'block';
    preview.style.display = 'none';

    if (currentRootFolderPath) {
        saveFolderViewState();
    }
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

    requestAnimationFrame(() => {
        if (currentRootFolderPath) {
            saveFolderViewState();
        }
    });
});

// 编辑器/预览滚动时低频保存阅读进度
let viewStateSaveTimer = null;

function scheduleSaveFolderViewState() {
    if (viewStateSaveTimer) return;

    viewStateSaveTimer = setTimeout(() => {
        viewStateSaveTimer = null;
        saveFolderViewState();
    }, 250);
}

if (editor) editor.addEventListener('scroll', scheduleSaveFolderViewState, { passive: true });
if (preview) preview.addEventListener('scroll', scheduleSaveFolderViewState, { passive: true });

document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
        saveFolderViewState();
    }
});

window.addEventListener('pagehide', saveFolderViewState);

// ==================== 页面初始化与状态自动恢复 ====================
window.addEventListener('DOMContentLoaded', () => {
    const savedPath = localStorage.getItem('last_folder_path');

    if (savedPath) {
        executeFolderScan(savedPath, true);

        // 兼容旧版本：若当前目录还没有独立状态，则迁移旧的 last_file_key
        if (!getFolderViewState(savedPath)) {
            const savedFileKey = localStorage.getItem('last_file_key');

            if (savedFileKey) {
                if (fileDataMap.has(savedFileKey)) {
                    loadMdContent(savedFileKey);
                } else if (mediaUrlsMap.has(savedFileKey)) {
                    const displayPath = mediaPathsMap.get(savedFileKey);

                    if (displayPath) {
                        const fileName = displayPath.split('/').pop();
                        const isVideo = VIDEO_REGEX.test(fileName);
                        previewMedia(savedFileKey, fileName, displayPath, isVideo);
                    }
                }
            }
        }
    }
});

// ==================== 全局文字搜索（右侧滑出面板） ====================
const globalSearchOverlay = document.getElementById('global-search-overlay');
const globalSearchPanel = document.getElementById('global-search-panel');
const btnGlobalSearch = document.getElementById('btn-global-search');
const btnCloseGlobalSearch = document.getElementById('btn-close-global-search');
const globalSearchInput = document.getElementById('global-search-input');
const btnDoGlobalSearch = document.getElementById('btn-do-global-search');
const globalSearchStatus = document.getElementById('global-search-status');
const globalSearchResults = document.getElementById('global-search-results');

let globalSearchInProgress = false;

function openGlobalSearchPanel() {
    if (globalSearchPanel) globalSearchPanel.classList.add('active');
    if (globalSearchOverlay) globalSearchOverlay.classList.add('active');
    setTimeout(() => {
        if (globalSearchInput) {
            globalSearchInput.focus();
            globalSearchInput.select();
        }
    }, 280);
}

function closeGlobalSearchPanel() {
    if (globalSearchPanel) globalSearchPanel.classList.remove('active');
    if (globalSearchOverlay) globalSearchOverlay.classList.remove('active');
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/**
 * 从文本中截取包含关键词的上下文片段，并高亮关键词
 */
function buildSnippet(text, query, maxLen = 120) {
    if (!text || !query) return '';
    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase();
    const idx = lowerText.indexOf(lowerQuery);
    if (idx === -1) return escapeHtml(text.slice(0, maxLen)) + (text.length > maxLen ? '…' : '');

    const half = Math.floor((maxLen - query.length) / 2);
    let start = Math.max(0, idx - half);
    let end = Math.min(text.length, idx + query.length + half);

    // 尽量在词边界截断
    if (start > 0) {
        const space = text.lastIndexOf(' ', start + 10);
        if (space > start - 20) start = space + 1;
    }
    if (end < text.length) {
        const space = text.indexOf(' ', end - 10);
        if (space !== -1 && space < end + 20) end = space;
    }

    let snippet = text.slice(start, end);
    const prefix = start > 0 ? '…' : '';
    const suffix = end < text.length ? '…' : '';

    // 高亮所有匹配（不区分大小写）
    const safeQ = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp('(' + safeQ + ')', 'gi');
    const highlighted = escapeHtml(snippet).replace(re, '<mark>$1</mark>');
    return prefix + highlighted + suffix;
}

/**
 * 统计文本中关键词出现次数
 */
function countMatches(text, query) {
    if (!text || !query) return 0;
    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase();
    let count = 0;
    let pos = 0;
    while ((pos = lowerText.indexOf(lowerQuery, pos)) !== -1) {
        count++;
        pos += lowerQuery.length;
    }
    return count;
}

/**
 * 确保文件内容已加载到 fileDataMap（必要时通过 AndroidFS 读取）
 */
function ensureFileTextLoaded(item) {
    if (!item) return '';
    if (item.text !== undefined && item.text !== null && item.text !== '') {
        return item.text;
    }
    // 当前正在编辑的文件，优先用编辑器内容
    if (currentFileKey && fileDataMap.get(currentFileKey) === item && editor) {
        item.text = editor.value;
        return item.text;
    }
    if (window.AndroidFS && item.fullPath && typeof window.AndroidFS.readFile === 'function') {
        try {
            item.text = window.AndroidFS.readFile(item.fullPath) || '';
        } catch (e) {
            console.error('读取文件失败:', item.path, e);
            item.text = '';
        }
    } else {
        item.text = item.text || '';
    }
    return item.text;
}

/**
 * 执行全局搜索
 */
function performGlobalSearch() {
    if (globalSearchInProgress) return;
    const query = (globalSearchInput ? globalSearchInput.value : '').trim();
    if (!query) {
        if (globalSearchStatus) globalSearchStatus.textContent = '请输入要搜索的关键词';
        if (globalSearchResults) globalSearchResults.innerHTML = '';
        return;
    }
    if (!currentRootFolderPath || fileDataMap.size === 0) {
        if (globalSearchStatus) globalSearchStatus.textContent = '请先打开本地文件夹';
        return;
    }

    globalSearchInProgress = true;
    if (globalSearchStatus) globalSearchStatus.textContent = `正在扫描 ${fileDataMap.size} 个笔记…`;
    if (globalSearchResults) {
        globalSearchResults.innerHTML = '<div class="gs-loading">⏳ 正在搜索，请稍候…</div>';
    }

    // 用 requestAnimationFrame / setTimeout 让 UI 先刷新，再同步扫描
    setTimeout(() => {
        const results = [];
        let scanned = 0;
        const total = fileDataMap.size;

        fileDataMap.forEach((item, keyLower) => {
            scanned++;
            const text = ensureFileTextLoaded(item);
            if (!text) return;
            const lowerText = text.toLowerCase();
            const lowerQuery = query.toLowerCase();
            if (lowerText.indexOf(lowerQuery) !== -1) {
                const matchCount = countMatches(text, query);
                const snippet = buildSnippet(text, query);
                results.push({
                    keyLower,
                    path: item.path,
                    name: item.name,
                    matchCount,
                    snippet
                });
            }
        });

        // 按匹配次数降序，再按路径排序
        results.sort((a, b) => {
            if (b.matchCount !== a.matchCount) return b.matchCount - a.matchCount;
            return a.path.localeCompare(b.path, 'zh-CN');
        });

        renderGlobalSearchResults(results, query, scanned);
        globalSearchInProgress = false;
    }, 30);
}

function renderGlobalSearchResults(results, query, scanned) {
    if (!globalSearchResults) return;

    if (globalSearchStatus) {
        globalSearchStatus.textContent = results.length > 0
            ? `找到 ${results.length} 篇含「${query}」的笔记（已扫描 ${scanned} 个）`
            : `未找到含「${query}」的笔记（已扫描 ${scanned} 个）`;
    }

    if (results.length === 0) {
        globalSearchResults.innerHTML = '<div class="gs-empty">没有匹配的笔记<br>试试其他关键词</div>';
        return;
    }

    const fragment = document.createDocumentFragment();
    results.forEach(r => {
        const div = document.createElement('div');
        div.className = 'gs-result-item';
        div.dataset.key = r.keyLower;
        div.innerHTML = `
            <div class="gs-result-path">
                <span>📄 ${escapeHtml(r.path)}</span>
                <span class="gs-match-count">${r.matchCount} 处</span>
            </div>
            <div class="gs-result-snippet">${r.snippet}</div>
        `;
        div.addEventListener('click', () => {
            closeGlobalSearchPanel();
            // 打开笔记，并在编辑模式下跳到第一个匹配位置
            loadMdContent(r.keyLower);
            // 若当前是预览模式，切换到编辑以便定位；或直接用笔记内搜索
            setTimeout(() => {
                if (noteSearchInput) {
                    noteSearchInput.value = query;
                }
                // 触发笔记内搜索定位
                if (typeof performNoteSearch === 'function') {
                    // 确保在编辑模式以便 setSelectionRange
                    if (currentMode !== 'edit' && btnModeEdit) {
                        btnModeEdit.click();
                    }
                    setTimeout(() => {
                        performNoteSearch();
                    }, 80);
                }
            }, 120);
        });
        fragment.appendChild(div);
    });
    globalSearchResults.innerHTML = '';
    globalSearchResults.appendChild(fragment);
}

// 事件绑定
if (btnGlobalSearch) {
    btnGlobalSearch.addEventListener('click', () => {
        openGlobalSearchPanel();
    });
}
if (btnCloseGlobalSearch) {
    btnCloseGlobalSearch.addEventListener('click', closeGlobalSearchPanel);
}
if (globalSearchOverlay) {
    globalSearchOverlay.addEventListener('click', closeGlobalSearchPanel);
}
if (btnDoGlobalSearch) {
    btnDoGlobalSearch.addEventListener('click', performGlobalSearch);
}
if (globalSearchInput) {
    globalSearchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            performGlobalSearch();
        }
    });
}
