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
const btnExportFolder = document.getElementById('btn-export-folder');
const btnTriggerZip = document.getElementById('btn-trigger-zip');
const zipInput = document.getElementById('zip-input');
const btnTriggerFiles = document.getElementById('btn-trigger-files');
const fileInput = document.getElementById('file-input');

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

// 📄 笔记双链复制按钮与打包导出全部按钮
const btnCopyNoteTag = document.getElementById('btn-copy-note-tag');
const btnExportZip = document.getElementById('btn-export-zip');

// 快捷到顶 / 到底按钮节点
const btnScrollTop = document.getElementById('btn-scroll-top');
const btnScrollBottom = document.getElementById('btn-scroll-bottom');

const imageModal = document.getElementById('image-modal');
const modalImg = document.getElementById('modal-img');
const modalClose = document.getElementById('modal-close');
const modalCounter = document.getElementById('modal-counter');

// 保存与导出按钮节点
const btnSave = document.getElementById('btn-save');
const btnExport = document.getElementById('btn-export');

const modeToggleGroup = document.getElementById('mode-toggle-group');
const btnModeEdit = document.getElementById('btn-mode-edit');
const btnModePreview = document.getElementById('btn-mode-preview');

// ==================== 全局状态与正则定义 ====================
const IMG_REGEX = /\.(png|jpg|jpeg|webp|gif|svg)$/i;
const VIDEO_REGEX = /\.(mp4|webm|mkv|mov|avi)$/i;

// 数据映射表（规范化的全相对路径映射）
const fileDataMap = new Map();      
const mediaUrlsMap = new Map(); 
const mediaPathsMap = new Map(); // 记录媒体原始相对路径

// 短文件名快速索引表
const fileShortNameMap = new Map();
const mediaShortNameMap = new Map();

// 目录树根节点结构
let mdTree = { name: 'root', isFolder: true, children: new Map() };
let mediaTree = { name: 'root', isFolder: true, children: new Map() };

let currentFileKey = '';
let currentMode = 'edit';
let activeMediaPath = ''; // 记录当前选中的媒体相对路径

// 媒体列表与上下翻页支持
let currentMediaList = [];
let currentMediaIndex = -1;
let lastRenderedText = '';

// 防抖定时器句柄
let searchDebounceTimer = null;
let saveDebounceTimer = null; // 自动保存防抖定时器

// ==================== 实时保存与同步机制 ====================
/**
 * 强制立即同步当前编辑器内容到内存 (轻量级赋值)
 */
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

/**
 * 300ms 防抖同步触发器
 */
function triggerDebouncedSave() {
    if (saveDebounceTimer) clearTimeout(saveDebounceTimer);
    saveDebounceTimer = setTimeout(() => {
        syncCurrentContent();
    }, 300);
}

// 绑定编辑器的打字输入事件
if (editor) {
    editor.addEventListener('input', triggerDebouncedSave);
}

// ==================== 基础辅助函数 ====================
function truncateName(name, maxLength = 10) {
    return name.length > maxLength ? name.slice(0, maxLength) + '...' : name;
}

// 释放内存 Blob URL 并重置索引
function clearMediaCache() {
    mediaUrlsMap.forEach(url => URL.revokeObjectURL(url));
    mediaUrlsMap.clear();
    mediaPathsMap.clear();
    mediaShortNameMap.clear();
    fileShortNameMap.clear();
}

// ==================== 侧边栏 UI 与自动折叠控制 ====================
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
    syncCurrentContent(); // 离场即存：点击打开侧边栏抽屉时强制同步
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

// ==================== 树状数据逻辑构建与 DOM 渲染 ====================
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

function checkFolderExistsInTree(treeRoot, relativeFolderPath) {
    if (!relativeFolderPath || !treeRoot) return false;
    const parts = relativeFolderPath.split('/').filter(Boolean);
    let current = treeRoot;
    for (const part of parts) {
        if (current.children && current.children.has(part)) {
            current = current.children.get(part);
        } else {
            return false;
        }
    }
    return current.isFolder;
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

// ==================== 检索与防抖搜索逻辑 ====================
function performSearch() {
    const query = searchInput.value.toLowerCase().trim();

    if (!query) {
        document.querySelectorAll('.tree-folder, .tree-file').forEach(el => el.style.display = '');
        resetTreeCollapse();
        return;
    }

    document.querySelectorAll('.tree-folder, .tree-file').forEach(el => el.style.display = 'none');

    document.querySelectorAll('.tree-folder').forEach(folderLi => {
        const folderName = folderLi.dataset.folderName || '';

        if (folderName.includes(query)) {
            folderLi.style.display = 'block';

            let parent = folderLi.parentElement;
            while (parent) {
                if (parent.classList.contains('tree-folder')) {
                    parent.style.display = 'block';
                    const parentUl = parent._ensureRendered ? parent._ensureRendered() : parent.querySelector(':scope > ul');
                    if (parentUl) parentUl.style.display = 'block';
                    const arrow = parent.querySelector(':scope > .folder-header .arrow');
                    if (arrow) arrow.textContent = '▼';
                }
                if (parent.classList.contains('tree-node')) parent.style.display = 'block';
                parent = parent.parentElement;
            }
        }
    });

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
                    const arrow = parent.querySelector(':scope > .folder-header .arrow');
                    if (arrow) arrow.textContent = '▼';
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

searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        clearTimeout(searchDebounceTimer);
        performSearch();
    }
});

// ==================== 文件/ZIP 导入处理 ====================
btnTriggerZip.addEventListener('click', () => {
    zipInput.value = '';
    zipInput.click();
});

btnTriggerFiles.addEventListener('click', () => {
    fileInput.value = '';
    fileInput.click();
});

zipInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
        syncCurrentContent();

        editor.style.display = 'block';
        preview.style.display = 'none';
        mediaViewer.style.display = 'none';

        fileTitle.textContent = "解压中...";
        editor.value = "⏳ 正在解压并载入笔记，请稍候...\n（文件较多时可能需要几秒钟）";

        const zip = await JSZip.loadAsync(file);

        mdTree = { name: 'root', isFolder: true, children: new Map() };
        mediaTree = { name: 'root', isFolder: true, children: new Map() };
        fileDataMap.clear();
        clearMediaCache();

        for (const [relativePath, zipEntry] of Object.entries(zip.files)) {
            if (zipEntry.dir || relativePath.startsWith('__MACOSX/')) continue;

            const fileName = relativePath.split('/').pop();
            const lowerPath = relativePath.replace(/\\/g, '/').toLowerCase();
            const lowerFileName = fileName.toLowerCase();

            if (IMG_REGEX.test(fileName) || VIDEO_REGEX.test(fileName)) {
                const blob = await zipEntry.async('blob');
                const mediaUrl = URL.createObjectURL(blob);
                const isVideo = VIDEO_REGEX.test(fileName);

                mediaUrlsMap.set(lowerPath, mediaUrl);
                mediaPathsMap.set(lowerPath, relativePath);
                if (!mediaShortNameMap.has(lowerFileName)) {
                    mediaShortNameMap.set(lowerFileName, lowerPath);
                }

                insertPathToTree(mediaTree, relativePath, {
                    keyLower: lowerPath,
                    path: relativePath,
                    isMedia: true,
                    isVideo: isVideo
                });
            } else {
                const text = await zipEntry.async('string');
                const itemObj = { text, path: relativePath, name: fileName };

                fileDataMap.set(lowerPath, itemObj);
                if (!fileShortNameMap.has(lowerFileName)) {
                    fileShortNameMap.set(lowerFileName, lowerPath);
                }

                insertPathToTree(mdTree, relativePath, {
                    keyLower: lowerPath,
                    path: relativePath,
                    isMedia: false
                });
            }
        }

        refreshTrees();
        fileTitle.textContent = file.name;
        editor.value = "ZIP 载入完成";

    } catch (err) {
        editor.value = "❌ 解压失败，请确保选择的是标准 .zip 格式文件！";
        alert("解压失败，请确保选择的是标准 .zip 格式文件！");
        console.error(err);
    }
});

fileInput.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    syncCurrentContent();

    const readPromises = [];

    files.forEach(file => {
        const relativePath = file.name;
        const lowerPath = relativePath.replace(/\\/g, '/').toLowerCase();
        const lowerFileName = file.name.toLowerCase();

        if (IMG_REGEX.test(file.name) || VIDEO_REGEX.test(file.name)) {
            const mediaUrl = URL.createObjectURL(file);
            const isVideo = VIDEO_REGEX.test(file.name);

            mediaUrlsMap.set(lowerPath, mediaUrl);
            mediaPathsMap.set(lowerPath, relativePath);
            if (!mediaShortNameMap.has(lowerFileName)) {
                mediaShortNameMap.set(lowerFileName, lowerPath);
            }

            insertPathToTree(mediaTree, relativePath, {
                keyLower: lowerPath,
                path: relativePath,
                isMedia: true,
                isVideo: isVideo
            });
        } else {
            const promise = new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = (evt) => {
                    const itemObj = { text: evt.target.result, path: relativePath, name: file.name };
                    fileDataMap.set(lowerPath, itemObj);
                    if (!fileShortNameMap.has(lowerFileName)) {
                        fileShortNameMap.set(lowerFileName, lowerPath);
                    }

                    insertPathToTree(mdTree, relativePath, {
                        keyLower: lowerPath,
                        path: relativePath,
                        isMedia: false
                    });
                    resolve();
                };
                reader.readAsText(file);
            });
            readPromises.push(promise);
        }
    });

    await Promise.all(readPromises);
    refreshTrees();
});

// ==================== 新建 / 重命名 / 删除 文件与文件夹 ====================
btnCreateFile.addEventListener('click', () => {
    syncCurrentContent();
    const inputPath = prompt('请输入新文件路径或文件名（例如: 笔记/随笔.md 或 test.md）：');
    if (!inputPath || !inputPath.trim()) return;

    let relativePath = inputPath.trim().replace(/\\/g, '/');
    
    if (!/\.[a-zA-Z0-9]+$/.test(relativePath)) {
        relativePath += '.md';
    }

    const lowerPath = relativePath.toLowerCase();
    const fileName = relativePath.split('/').pop();
    const lowerFileName = fileName.toLowerCase();

    if (fileDataMap.has(lowerPath)) {
        alert('该文件路径已存在！');
        return;
    }

    fileDataMap.set(lowerPath, { text: '', path: relativePath, name: fileName });
    if (!fileShortNameMap.has(lowerFileName)) {
        fileShortNameMap.set(lowerFileName, lowerPath);
    }

    insertPathToTree(mdTree, relativePath, {
        keyLower: lowerPath,
        path: relativePath,
        isMedia: false
    });

    refreshTrees();
    loadMdContent(lowerPath);
    if (currentMode === 'edit') editor.focus();
});

btnCreateFolder.addEventListener('click', () => {
    const inputPath = prompt('请输入新文件夹路径（例如: 分类/子目录）：');
    if (!inputPath || !inputPath.trim()) return;

    const folderPath = inputPath.trim().replace(/\\/g, '/');
    
    insertFolderToTree(mdTree, folderPath);
    refreshTrees();
});

// 重命名文件
if (btnRenameFile) {
    btnRenameFile.addEventListener('click', () => {
        syncCurrentContent();
        let oldKey = '';
        let isMedia = false;
        let oldPath = '';

        if (mediaViewer.style.display !== 'none' && activeMediaPath) {
            oldKey = activeMediaPath.toLowerCase();
            isMedia = true;
            oldPath = activeMediaPath;
        } else if (currentFileKey) {
            oldKey = currentFileKey;
            isMedia = false;
            const item = fileDataMap.get(currentFileKey);
            oldPath = item ? item.path : currentFileKey;
        }

        if (!oldKey) {
            alert('请先选择要重命名的文件！');
            return;
        }

        const inputPath = prompt('请输入新的文件路径或文件名：', oldPath);
        if (!inputPath || !inputPath.trim()) return;

        let newPath = inputPath.trim().replace(/\\/g, '/');
        if (!isMedia && !/\.[a-zA-Z0-9]+$/.test(newPath)) {
            newPath += '.md';
        }

        const newKey = newPath.toLowerCase();
        const newFileName = newPath.split('/').pop();
        const newShortName = newFileName.toLowerCase();

        if (newKey === oldKey) return;

        if (fileDataMap.has(newKey) || mediaUrlsMap.has(newKey)) {
            alert('目标文件名或路径已存在！');
            return;
        }

        if (isMedia) {
            const url = mediaUrlsMap.get(oldKey);
            const isVideo = VIDEO_REGEX.test(newFileName);

            mediaUrlsMap.delete(oldKey);
            mediaPathsMap.delete(oldKey);
            for (const [sName, path] of mediaShortNameMap.entries()) {
                if (path === oldKey) mediaShortNameMap.delete(sName);
            }
            deletePathFromTree(mediaTree, oldPath);

            mediaUrlsMap.set(newKey, url);
            mediaPathsMap.set(newKey, newPath);
            if (!mediaShortNameMap.has(newShortName)) {
                mediaShortNameMap.set(newShortName, newKey);
            }
            insertPathToTree(mediaTree, newPath, {
                keyLower: newKey,
                path: newPath,
                isMedia: true,
                isVideo: isVideo
            });

            activeMediaPath = newPath;
            fileTitle.textContent = `${isVideo ? '🎬' : '🖼️'} ${newPath}`;
        } else {
            const item = fileDataMap.get(oldKey);
            item.path = newPath;
            item.name = newFileName;

            fileDataMap.delete(oldKey);
            for (const [sName, path] of fileShortNameMap.entries()) {
                if (path === oldKey) fileShortNameMap.delete(sName);
            }
            deletePathFromTree(mdTree, oldPath);

            fileDataMap.set(newKey, item);
            if (!fileShortNameMap.has(newShortName)) {
                fileShortNameMap.set(newShortName, newKey);
            }
            insertPathToTree(mdTree, newPath, {
                keyLower: newKey,
                path: newPath,
                isMedia: false
            });

            currentFileKey = newKey;
            fileTitle.textContent = newPath;
        }

        refreshTrees();
        alert('文件重命名成功！');
    });
}

// 重命名文件夹
if (btnRenameFolder) {
    btnRenameFolder.addEventListener('click', () => {
        syncCurrentContent();
        const oldFolderInput = prompt('请输入要重命名的文件夹路径（例如: 随笔 或 笔记/随笔）：');
        if (!oldFolderInput || !oldFolderInput.trim()) return;

        const oldFolderPath = oldFolderInput.trim().replace(/\\/g, '/').replace(/\/+$/, '');
        const oldLowerFolderPath = oldFolderPath.toLowerCase();
        const oldLowerPrefix = oldLowerFolderPath + '/';

        let matchedFiles = [];
        let matchedMedias = [];

        for (const [key, item] of fileDataMap.entries()) {
            if (key === oldLowerFolderPath || key.startsWith(oldLowerPrefix)) {
                matchedFiles.push({ key, item });
            }
        }
        for (const [key, url] of mediaUrlsMap.entries()) {
            if (key === oldLowerFolderPath || key.startsWith(oldLowerPrefix)) {
                matchedMedias.push({ key, url });
            }
        }

        const inMdTree = checkFolderExistsInTree(mdTree, oldLowerFolderPath);
        const inMediaTree = checkFolderExistsInTree(mediaTree, oldLowerFolderPath);

        if (matchedFiles.length === 0 && matchedMedias.length === 0 && !inMdTree && !inMediaTree) {
            alert(`未找到文件夹 "${oldFolderPath}"！`);
            return;
        }

        const newFolderInput = prompt(`请输入文件夹 "${oldFolderPath}" 的新路径或新名称：`, oldFolderPath);
        if (!newFolderInput || !newFolderInput.trim()) return;

        const newFolderPath = newFolderInput.trim().replace(/\\/g, '/').replace(/\/+$/, '');
        const newLowerFolderPath = newFolderPath.toLowerCase();

        if (oldLowerFolderPath === newLowerFolderPath) return;

        deletePathFromTree(mdTree, oldFolderPath);
        deletePathFromTree(mediaTree, oldFolderPath);

        matchedFiles.forEach(({ key, item }) => {
            fileDataMap.delete(key);
            for (const [sName, p] of fileShortNameMap.entries()) {
                if (p === key) fileShortNameMap.delete(sName);
            }

            const subPath = item.path.substring(oldFolderPath.length);
            const newPath = newFolderPath + subPath;
            const newKey = newPath.toLowerCase();
            const newFileName = newPath.split('/').pop();
            const newShortName = newFileName.toLowerCase();

            item.path = newPath;
            item.name = newFileName;
            fileDataMap.set(newKey, item);

            if (!fileShortNameMap.has(newShortName)) {
                fileShortNameMap.set(newShortName, newKey);
            }

            insertPathToTree(mdTree, newPath, {
                keyLower: newKey,
                path: newPath,
                isMedia: false
            });

            if (currentFileKey === key) {
                currentFileKey = newKey;
                fileTitle.textContent = newPath;
            }
        });

        matchedMedias.forEach(({ key, url }) => {
            const realPath = mediaPathsMap.get(key) || key;
            const subPath = realPath.substring(oldFolderPath.length);
            const newPath = newFolderPath + subPath;
            const newKey = newPath.toLowerCase();
            const newFileName = newPath.split('/').pop();
            const newShortName = newFileName.toLowerCase();
            const isVideo = VIDEO_REGEX.test(newFileName);

            mediaUrlsMap.delete(key);
            mediaPathsMap.delete(key);
            for (const [sName, p] of mediaShortNameMap.entries()) {
                if (p === key) mediaShortNameMap.delete(sName);
            }

            mediaUrlsMap.set(newKey, url);
            mediaPathsMap.set(newKey, newPath);
            if (!mediaShortNameMap.has(newShortName)) {
                mediaShortNameMap.set(newShortName, newKey);
            }

            insertPathToTree(mediaTree, newPath, {
                keyLower: newKey,
                path: newPath,
                isMedia: true,
                isVideo: isVideo
            });

            if (activeMediaPath.toLowerCase() === key) {
                activeMediaPath = newPath;
                fileTitle.textContent = `${isVideo ? '🎬' : '🖼️'} ${newPath}`;
            }
        });

        if (matchedFiles.length === 0 && matchedMedias.length === 0) {
            insertFolderToTree(mdTree, newFolderPath);
        }

        refreshTrees();
        alert(`文件夹已成功重命名为 "${newFolderPath}"！`);
    });
}

// 删除文件
btnDeleteFile.addEventListener('click', () => {
    syncCurrentContent();
    let targetKey = '';
    let isMedia = false;
    let displayPath = '';

    if (mediaViewer.style.display !== 'none' && activeMediaPath) {
        targetKey = activeMediaPath.toLowerCase();
        isMedia = true;
        displayPath = activeMediaPath;
    } else if (currentFileKey) {
        targetKey = currentFileKey;
        isMedia = false;
        const item = fileDataMap.get(currentFileKey);
        displayPath = item ? item.path : currentFileKey;
    }

    if (!targetKey) {
        alert('请先选择要删除的文件！');
        return;
    }

    if (!confirm(`确定要删除文件 "${displayPath}" 吗？此操作无法撤销。`)) {
        return;
    }

    if (isMedia) {
        if (mediaUrlsMap.has(targetKey)) {
            URL.revokeObjectURL(mediaUrlsMap.get(targetKey));
            mediaUrlsMap.delete(targetKey);
        }
        mediaPathsMap.delete(targetKey);

        for (const [sName, path] of mediaShortNameMap.entries()) {
            if (path === targetKey) {
                mediaShortNameMap.delete(sName);
                break;
            }
        }

        deletePathFromTree(mediaTree, displayPath);
        activeMediaPath = '';

        mediaViewer.style.display = 'none';
        fileTitle.textContent = '未选择文件';
        imgDisplay.src = '';
        videoDisplay.pause();
        videoDisplay.src = '';
    } else {
        fileDataMap.delete(targetKey);

        for (const [sName, path] of fileShortNameMap.entries()) {
            if (path === targetKey) {
                fileShortNameMap.delete(sName);
                break;
            }
        }

        deletePathFromTree(mdTree, displayPath);
        currentFileKey = '';

        editor.value = '';
        editor.setAttribute('readonly', 'true');

        preview.innerHTML = '';
        fileTitle.textContent = '未选择文件';
        btnSave.setAttribute('disabled', 'true');
        btnExport.setAttribute('disabled', 'true');
        if (btnCopyNoteTag) btnCopyNoteTag.style.display = 'none';
    }

    refreshTrees();
});

// 删除文件夹
btnDeleteFolder.addEventListener('click', () => {
    syncCurrentContent();
    const inputPath = prompt('请输入要删除的文件夹路径（例如: 随笔 或 笔记/随笔）：');
    if (!inputPath || !inputPath.trim()) return;

    let folderPath = inputPath.trim().replace(/\\/g, '/').replace(/\/+$/, '');
    let lowerFolderPath = folderPath.toLowerCase();
    let lowerPrefix = lowerFolderPath + '/';

    let hasMatchedFiles = false;
    for (const key of fileDataMap.keys()) {
        if (key === lowerFolderPath || key.startsWith(lowerPrefix)) {
            hasMatchedFiles = true;
            break;
        }
    }
    if (!hasMatchedFiles) {
        for (const key of mediaUrlsMap.keys()) {
            if (key === lowerFolderPath || key.startsWith(lowerPrefix)) {
                hasMatchedFiles = true;
                break;
            }
        }
    }

    let inMdTree = checkFolderExistsInTree(mdTree, lowerFolderPath);
    let inMediaTree = checkFolderExistsInTree(mediaTree, lowerFolderPath);

    if (!hasMatchedFiles && !inMdTree && !inMediaTree) {
        alert(`未找到文件夹 "${folderPath}"！`);
        return;
    }

    if (!confirm(`确定要删除文件夹 "${folderPath}" 及其内部的所有文件吗？此操作无法撤销。`)) {
        return;
    }

    for (const [key, item] of Array.from(fileDataMap.entries())) {
        if (key === lowerFolderPath || key.startsWith(lowerPrefix)) {
            fileDataMap.delete(key);
            for (const [sName, path] of fileShortNameMap.entries()) {
                if (path === key) fileShortNameMap.delete(sName);
            }
            if (currentFileKey === key) {
                currentFileKey = '';
                editor.value = '';
                editor.setAttribute('readonly', 'true');
                preview.innerHTML = '';
                fileTitle.textContent = '未选择文件';
                btnSave.setAttribute('disabled', 'true');
                btnExport.setAttribute('disabled', 'true');
                if (btnCopyNoteTag) btnCopyNoteTag.style.display = 'none';
            }
        }
    }

    for (const [key, url] of Array.from(mediaUrlsMap.entries())) {
        if (key === lowerFolderPath || key.startsWith(lowerPrefix)) {
            URL.revokeObjectURL(url);
            mediaUrlsMap.delete(key);
            mediaPathsMap.delete(key);
            for (const [sName, path] of mediaShortNameMap.entries()) {
                if (path === key) mediaShortNameMap.delete(sName);
            }
            if (activeMediaPath.toLowerCase() === key) {
                activeMediaPath = '';
                mediaViewer.style.display = 'none';
                imgDisplay.src = '';
                videoDisplay.pause();
                videoDisplay.src = '';
                fileTitle.textContent = '未选择文件';
            }
        }
    }

    deletePathFromTree(mdTree, folderPath);
    deletePathFromTree(mediaTree, folderPath);

    refreshTrees();
    alert(`文件夹 "${folderPath}" 已成功删除！`);
});

// ==================== 导出指定文件夹为 ZIP 压缩包 ====================
async function exportFolderToZip() {
    syncCurrentContent();

    if (fileDataMap.size === 0 && mediaUrlsMap.size === 0) {
        alert('当前没有任何文件可导出！');
        return;
    }

    const inputPath = prompt('请输入要打包导出的文件夹路径（例如: 随笔 或 笔记/日常）：');
    if (!inputPath || !inputPath.trim()) return;

    const folderPath = inputPath.trim().replace(/\\/g, '/').replace(/\/+$/, '');
    const lowerFolderPath = folderPath.toLowerCase();
    const lowerPrefix = lowerFolderPath + '/';

    const zip = new JSZip();
    let matchCount = 0;

    for (const [key, item] of fileDataMap.entries()) {
        if (key === lowerFolderPath || key.startsWith(lowerPrefix)) {
            zip.file(item.path, item.text);
            matchCount++;
        }
    }

    for (const [keyLower, mediaUrl] of mediaUrlsMap.entries()) {
        if (keyLower === lowerFolderPath || keyLower.startsWith(lowerPrefix)) {
            const realPath = mediaPathsMap.get(keyLower) || keyLower;
            const blob = await fetch(mediaUrl).then(res => res.blob());
            zip.file(realPath, blob);
            matchCount++;
        }
    }

    if (matchCount === 0) {
        alert(`未找到文件夹 "${folderPath}" 或该文件夹内部为空！`);
        return;
    }

    const originalBtnText = btnExportFolder.textContent;
    btnExportFolder.textContent = '⏳ 打包中...';
    btnExportFolder.setAttribute('disabled', 'true');

    try {
        const zipContent = await zip.generateAsync({ type: 'blob' });
        const downloadLink = document.createElement('a');
        downloadLink.href = URL.createObjectURL(zipContent);
        
        const folderName = folderPath.split('/').pop() || 'folder';
        const today = new Date().toISOString().split('T')[0];
        downloadLink.download = `${folderName}_${today}.zip`;
        
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        URL.revokeObjectURL(downloadLink.href);

        btnExportFolder.textContent = '✅ 打包导出成功！';
    } catch (err) {
        console.error('打包文件夹失败:', err);
        alert('打包导出时发生错误，请重试！');
    } finally {
        setTimeout(() => {
            btnExportFolder.textContent = originalBtnText;
            btnExportFolder.removeAttribute('disabled');
        }, 1500);
    }
}

if (btnExportFolder) {
    btnExportFolder.addEventListener('click', exportFolderToZip);
}

function updateCounts() {
    mdCount.textContent = fileDataMap.size;
    mediaCount.textContent = mediaUrlsMap.size;
    totalCount.textContent = fileDataMap.size + mediaUrlsMap.size;
}

// ==================== 媒体查看与大图翻页机制 ====================
function previewMedia(keyLower, fileName, displayPath, isVideo) {
    syncCurrentContent(); // 离场即存：从编辑模式切换到媒体查看时保存

    document.querySelectorAll('.tree-file').forEach(el => {
        el.classList.toggle('active', el.dataset.key === keyLower);
    });

    activeMediaPath = displayPath.replace(/\\/g, '/');

    currentMediaList = getSameFolderMediaList(keyLower);
    currentMediaIndex = currentMediaList.findIndex(item => item.keyLower === keyLower);

    const countInfo = (currentMediaIndex !== -1 && currentMediaList.length > 0) 
        ? `(${currentMediaIndex + 1}/${currentMediaList.length}) ` 
        : '';

    fileTitle.textContent = `${isVideo ? '🎬' : '🖼️'} ${countInfo}${displayPath}`;

    editor.style.display = 'none';
    preview.style.display = 'none';
    mediaViewer.style.display = 'flex';

    modeToggleGroup.style.display = 'none';
    btnSave.style.display = 'none';
    btnExport.style.display = 'none';

    if (btnCopyNoteTag) btnCopyNoteTag.style.display = 'none';

    const url = mediaUrlsMap.get(keyLower);

    if (isVideo) {
        imgDisplay.style.display = 'none';
        videoDisplay.style.display = 'block';
        btnZoomImg.style.display = 'none';
        videoDisplay.src = url;
    } else {
        videoDisplay.pause();
        videoDisplay.style.display = 'none';
        imgDisplay.style.display = 'block';
        btnZoomImg.style.display = 'inline-flex';
        imgDisplay.src = url;
    }
}

function updateModalCounter() {
    if (currentMediaIndex !== -1 && currentMediaList.length > 0) {
        const currentItem = currentMediaList[currentMediaIndex];
        const countInfo = `(${currentMediaIndex + 1}/${currentMediaList.length})`;
        modalCounter.textContent = `${countInfo} ${currentItem.name}`;
    } else {
        modalCounter.textContent = '';
    }
}

function navigateMedia(direction) {
    if (currentMediaList.length === 0 || currentMediaIndex === -1) return;

    let newIndex = currentMediaIndex + direction;
    if (newIndex < 0 || newIndex >= currentMediaList.length) return;

    currentMediaIndex = newIndex;
    const target = currentMediaList[currentMediaIndex];

    if (target.isPreviewImg) {
        if (imageModal.classList.contains('active')) {
            modalImg.src = target.src;
            updateModalCounter();
        }
    } else {
        previewMedia(target.keyLower, target.name, target.path, target.isVideo);

        if (imageModal.classList.contains('active')) {
            if (!target.isVideo) {
                modalImg.src = mediaUrlsMap.get(target.keyLower);
                updateModalCounter();
            } else {
                closeImageModal();
            }
        }
    }
}

mediaViewer.addEventListener('click', (e) => {
    if (e.target.closest('button') || e.target.closest('video') || e.target.closest('img')) return;

    const rect = mediaViewer.getBoundingClientRect();
    const clickY = e.clientY - rect.top;
    const ratio = clickY / rect.height;

    if (ratio < 0.3) {
        navigateMedia(-1);
    } else {
        navigateMedia(1);
    }
});

function openImageModal(src) {
    if (!src) return;
    modalImg.src = src;
    imageModal.classList.add('active');

    for (let [key, url] of mediaUrlsMap.entries()) {
        if (url === src) {
            let foundIdx = currentMediaList.findIndex(item => item.keyLower === key);
            if (foundIdx === -1) {
                currentMediaList = getSameFolderMediaList(key);
                foundIdx = currentMediaList.findIndex(item => item.keyLower === key);
            }
            if (foundIdx !== -1) {
                currentMediaIndex = foundIdx;
            }
            break;
        }
    }
    updateModalCounter();
}

function openPreviewImageModal(targetImg) {
    if (!targetImg) return;

    const allImgs = Array.from(preview.querySelectorAll('img'));
    currentMediaList = allImgs.map((img, i) => {
        return {
            name: img.alt || img.title || `图片 ${i + 1}`,
            src: img.src,
            isPreviewImg: true,
            isVideo: false
        };
    });

    currentMediaIndex = allImgs.indexOf(targetImg);
    if (currentMediaIndex === -1) currentMediaIndex = 0;

    modalImg.src = targetImg.src;
    imageModal.classList.add('active');
    updateModalCounter();
}

function closeImageModal() {
    imageModal.classList.remove('active');
    modalImg.src = '';
    modalCounter.textContent = '';
}

btnZoomImg.addEventListener('click', (e) => {
    e.stopPropagation();
    openImageModal(imgDisplay.src);
});

imgDisplay.addEventListener('click', (e) => {
    e.stopPropagation();
    openImageModal(imgDisplay.src);
});

modalClose.addEventListener('click', (e) => {
    e.stopPropagation();
    closeImageModal();
});

imageModal.addEventListener('click', (e) => {
    if (e.target.closest('#modal-close')) {
        closeImageModal();
        return;
    }

    const rect = imageModal.getBoundingClientRect();
    const clickY = e.clientY - rect.top;
    const ratio = clickY / rect.height;

    if (ratio < 0.3) {
        navigateMedia(-1);
    } else {
        navigateMedia(1);
    }
});

// ==================== 标签与双链语法复制 ====================
btnCopyTag.addEventListener('click', () => {
    if (!activeMediaPath) return;
    const tag = `![[${activeMediaPath}]]`;
    navigator.clipboard.writeText(tag).then(() => {
        if (btnCopyTag._timer) clearTimeout(btnCopyTag._timer);

        btnCopyTag.textContent = '已复制标签！';
        
        btnCopyTag._timer = setTimeout(() => {
            btnCopyTag.textContent = '复制图片语法';
        }, 1500);
    });
});

if (btnCopyNoteTag) {
    btnCopyNoteTag.addEventListener('click', () => {
        if (!currentFileKey) return;
        const item = fileDataMap.get(currentFileKey);
        if (!item) return;

        const tag = `[[${item.path}]]`;
        navigator.clipboard.writeText(tag).then(() => {
            if (btnCopyNoteTag._timer) clearTimeout(btnCopyNoteTag._timer);

            btnCopyNoteTag.textContent = '已复制双链！';

            btnCopyNoteTag._timer = setTimeout(() => {
                btnCopyNoteTag.textContent = '复制笔记语法';
            }, 1500);
        });
    });
}

// ==================== Markdown 渲染与 Obsidian 双链解析 ====================
function loadMdContent(keyLower) {
    syncCurrentContent(); // 离场即存：在加载/切换至新笔记前，先保存上一份笔记
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
    editor.value = item.text;
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

preview.addEventListener('click', (e) => {
    if (e.target.tagName === 'IMG') {
        openPreviewImageModal(e.target); 
        return;
    }
    const link = e.target.closest('.wiki-link');
    if (link && link.dataset.key) {
        loadMdContent(link.dataset.key);
    }
});

// ==================== 模式切换与文件保存/导出 ====================
btnModeEdit.addEventListener('click', () => {
    syncCurrentContent(); // 离场即存：切换编辑模式前保存
    currentMode = 'edit';
    btnModeEdit.classList.add('active');
    btnModePreview.classList.remove('active');
    mediaViewer.style.display = 'none';
    editor.style.display = 'block';
    preview.style.display = 'none';
});

btnModePreview.addEventListener('click', () => {
    syncCurrentContent(); // 离场即存：切换预览模式前保存
    currentMode = 'preview';
    btnModePreview.classList.add('active');
    btnModeEdit.classList.remove('active');
    mediaViewer.style.display = 'none';
    editor.style.display = 'none';
    preview.style.display = 'block';
    renderMarkdown();
});

function saveCurrentFile() {
    syncCurrentContent(); // 手动保存时立即同步变量
    const item = fileDataMap.get(currentFileKey);
    if (!item || btnSave.hasAttribute('disabled')) return;

    if (currentMode === 'preview') {
        renderMarkdown();
    }

    if (btnSave._saveTimer) clearTimeout(btnSave._saveTimer);

    btnSave.textContent = '已保存！';
    btnSave.style.background = '#0e639c';

    btnSave._saveTimer = setTimeout(() => {
        btnSave.textContent = '保存';
        btnSave.style.background = '#28a745';
    }, 1200);
}

function exportCurrentFile() {
    syncCurrentContent(); // 导出前同步最新输入内容
    const item = fileDataMap.get(currentFileKey);
    if (!item || btnExport.hasAttribute('disabled')) return;

    const blob = new Blob([editor.value], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = item.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);

    if (btnExport._exportTimer) clearTimeout(btnExport._exportTimer);

    btnExport.textContent = '已导出！';
    btnExport._exportTimer = setTimeout(() => {
        btnExport.textContent = '导出';
    }, 1200);
}

btnSave.addEventListener('click', saveCurrentFile);
btnExport.addEventListener('click', exportCurrentFile);

// ==================== 全量打包导出 ZIP 功能 ====================
async function exportAllToZip() {
    syncCurrentContent();

    if (fileDataMap.size === 0 && mediaUrlsMap.size === 0) {
        alert('当前没有可导出的文件！');
        return;
    }

    const originalBtnText = btnExportZip.textContent;
    btnExportZip.textContent = '⏳ 打包中...';
    btnExportZip.setAttribute('disabled', 'true');

    try {
        const zip = new JSZip();

        for (const [key, item] of fileDataMap.entries()) {
            zip.file(item.path, item.text);
        }

        for (const [keyLower, mediaUrl] of mediaUrlsMap.entries()) {
            const realPath = mediaPathsMap.get(keyLower) || keyLower;
            const blob = await fetch(mediaUrl).then(res => res.blob());
            zip.file(realPath, blob);
        }

        const zipContent = await zip.generateAsync({ type: 'blob' });
        const downloadLink = document.createElement('a');
        downloadLink.href = URL.createObjectURL(zipContent);
        
        const today = new Date().toISOString().split('T')[0];
        downloadLink.download = `notes_backup_${today}.zip`;
        
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        URL.revokeObjectURL(downloadLink.href);

        btnExportZip.textContent = '✅ 导出成功！';
    } catch (err) {
        console.error('打包导出失败:', err);
        alert('打包导出时发生错误，请重试！');
        btnExportZip.textContent = originalBtnText;
    } finally {
        setTimeout(() => {
            btnExportZip.textContent = originalBtnText;
            btnExportZip.removeAttribute('disabled');
        }, 1500);
    }
}

btnExportZip.addEventListener('click', exportAllToZip);

// ==================== 快捷到顶 / 到底功能 ====================
if (btnScrollTop) {
    btnScrollTop.addEventListener('click', () => {
        if (currentMode === 'edit') {
            editor.scrollTop = 0;
        } else {
            preview.scrollTop = 0;
        }
    });
}

if (btnScrollBottom) {
    btnScrollBottom.addEventListener('click', () => {
        if (currentMode === 'edit') {
            editor.scrollTop = editor.scrollHeight;
        } else {
            preview.scrollTop = preview.scrollHeight;
        }
    });
}
