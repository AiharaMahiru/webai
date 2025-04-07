<?php
/**
 * FileAPI - 高效文件管理API服务
 * 
 * 提供文件上传、下载和查询功能的RESTful API
 * 
 * 使用方法:
 * 1. 配置config.php文件中的参数
 * 2. 通过API端点访问服务:
 *    - POST /upload - 上传文件
 *    - GET /download/{file_id} - 下载文件
 *    - GET /files - 获取文件列表
 *    - GET /files/{file_id} - 获取特定文件信息
 *    - DELETE /files/{file_id} - 删除文件
 * 
 * @version 1.1
 */

declare(strict_types=1);

class FileAPI {
    private array $config;
    private string $storagePath;
    private array $allowedTypes;
    private int $maxFileSize;
    private PDO $db;
    private array $pagination;
    private string $logPath;
    private bool $loggingEnabled;
    private string $logLevel;
    private array $apiSecurity;
    private array $fileOrganization;

    /**
     * 构造函数 - 初始化API配置
     * 
     * @param string $configPath 配置文件路径
     */
    public function __construct(string $configPath = 'config.php') {
        // 加载配置文件
        if (!file_exists($configPath)) {
            $this->sendResponse(['error' => '配置文件不存在'], 500);
            exit;
        }

        $config = require $configPath;
        $this->config = $config;

        $this->storagePath = $this->config['storage_path'];
        $this->allowedTypes = $this->config['allowed_types'];
        $this->maxFileSize = $this->config['max_file_size'];
        $this->pagination = $this->config['api']['pagination'] ?? ['default_limit' => 10, 'max_limit' => 100];
        
        // API安全配置
        $this->apiSecurity = $this->config['api']['security'] ?? [
            'api_key_enabled' => false,
            'api_keys' => [],
            'api_key_header' => 'X-API-Key',
            'exempted_routes' => []
        ];
        
        // 文件自动整理配置
        $this->fileOrganization = $this->config['file_organization'] ?? [
            'enabled' => false,
            'strategy' => 'none',
            'date_format' => 'Y/m/d',
            'type_mapping' => [],
            'create_thumbs' => false,
            'thumb_size' => 200,
            'preserve_filename' => false
        ];
        
        // 日志配置
        $this->loggingEnabled = $this->config['logging']['enabled'] ?? false;
        $this->logPath = $this->config['logging']['path'] ?? __DIR__ . '/logs';
        $this->logLevel = $this->config['logging']['level'] ?? 'error';
        
        // 确保存储目录存在
        if (!is_dir($this->storagePath)) {
            mkdir($this->storagePath, 0755, true);
        }
        
        // 确保日志目录存在
        if ($this->loggingEnabled && !is_dir($this->logPath)) {
            mkdir($this->logPath, 0755, true);
        }
        
        // 初始化数据库连接
        $this->initDatabase();
        
        // 处理请求
        $this->handleRequest();
    }
    
    /**
     * 初始化数据库
     */
    private function initDatabase(): void {
        try {
            $this->db = new PDO(
                $this->config['db_connection']['dsn'],
                $this->config['db_connection']['username'],
                $this->config['db_connection']['password'],
                [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
            );
            
            // 创建文件表（如果不存在）
            $this->db->exec("
                CREATE TABLE IF NOT EXISTS files (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    original_name TEXT NOT NULL,
                    stored_name TEXT NOT NULL,
                    relative_path TEXT NOT NULL,
                    mime_type TEXT NOT NULL,
                    size INTEGER NOT NULL,
                    file_type TEXT,
                    has_thumbnail INTEGER DEFAULT 0,
                    created_at DATETIME NOT NULL
                )
            ");
        } catch (PDOException $e) {
            $this->sendResponse(['error' => '数据库初始化失败: ' . $e->getMessage()], 500);
            exit;
        }
    }
    
    /**
     * 处理API请求
     */
    private function handleRequest(): void {
        $method = $_SERVER['REQUEST_METHOD'] ?? '';
        $uri = $_SERVER['REQUEST_URI'] ?? '';
        $path = parse_url($uri, PHP_URL_PATH);
        $pathParts = explode('/', trim($path, '/'));
    
        // --- CORS 配置和头信息设置 (保持不变) ---
        $corsConfig = $this->config['api']['cors'] ?? [];
        $allowedOrigins = $corsConfig['allowed_origins'] ?? ['*'];
        $allowedMethods = $corsConfig['allowed_methods'] ?? ['GET', 'POST', 'DELETE', 'OPTIONS'];
        // ***** 重要：确保 allowed_headers 包含前端实际发送的所有自定义头 *****
        // 例如，如果前端发送了 'X-Requested-With' 或其他头，也要加进去
        $allowedHeaders = $corsConfig['allowed_headers'] ?? ['Content-Type', 'Authorization', 'X-API-Key'];
    
        $origin = $_SERVER['HTTP_ORIGIN'] ?? null; // 获取请求来源，不要默认为 '*'
    
        // 检查来源是否被允许
        $isOriginAllowed = false;
        if ($origin) {
            if (in_array('*', $allowedOrigins) && !($corsConfig['credentials'] ?? false)) { // '*' 不能与 credentials 一起使用
                $isOriginAllowed = true;
                header('Access-Control-Allow-Origin: *');
            } elseif (in_array($origin, $allowedOrigins)) {
                $isOriginAllowed = true;
                header('Access-Control-Allow-Origin: ' . $origin);
                // 如果你的前端请求需要发送凭据 (如 cookies)，需要设置这个
                // header('Access-Control-Allow-Credentials: true');
                // 同时 config.php 中的 allowed_origins 不能为 ['*']，必须是具体的域名列表
                header('Vary: Origin'); // 建议加上 Vary 头
            }
        }
        // 对于非跨域请求（同源）或者 OPTIONS 请求，我们依然需要设置下面的头
         if ($isOriginAllowed || !$origin || $method === 'OPTIONS') {
            header('Access-Control-Allow-Methods: ' . implode(', ', $allowedMethods));
            header('Access-Control-Allow-Headers: ' . implode(', ', $allowedHeaders));
            // 可以选择性地添加 Max-Age 来缓存预检结果 (单位：秒)
            // header('Access-Control-Max-Age: 86400'); // 缓存一天
         }
    
    
        // --- 处理 OPTIONS 请求 (修改后) ---
        if ($method === 'OPTIONS') {
            // 预检请求只需要正确的 CORS 头信息和成功的状态码
            // 上面已经设置了必要的 Access-Control-* 头
            // 如果来源不被允许，浏览器会自动处理错误，服务器端无需返回错误JSON
            if ($isOriginAllowed || !$origin) { // 允许来自配置的源或同源的预检
                 http_response_code(204); // 使用 204 No Content 更标准
            } else {
                 // 如果来源明确不被允许，可以返回 403 Forbidden，但通常浏览器会自行处理
                 http_response_code(403);
            }
            exit; // 直接退出，不调用 sendResponse
        }
    
        // --- API 密钥验证 (移到 OPTIONS 处理之后) ---
        if ($this->apiSecurity['api_key_enabled']) {
            // 注意：预检请求 OPTIONS 通常不携带自定义头（如 X-API-Key）或认证信息
            // 所以API Key验证应该在处理完 OPTIONS 之后进行
            $this->validateApiKey($method, $path);
        }
        
        // 路由请求到相应的处理方法
        try {
            $endpoint = $pathParts[0] ?? '';
            
            switch ($endpoint) {
                case 'upload':
                    if ($method === 'POST') {
                        $this->handleUpload();
                    } else {
                        throw new Exception('方法不允许', 405);
                    }
                    break;
                
                case 'download':
                    if ($method === 'GET' && isset($pathParts[1])) {
                        $this->handleDownload((int)$pathParts[1]);
                    } else {
                        throw new Exception('请求无效', 400);
                    }
                    break;
                    
                case 'thumbnail':
                    if ($method === 'GET' && isset($pathParts[1])) {
                        $this->serveThumbnail((int)$pathParts[1]);
                    } else {
                        throw new Exception('请求无效', 400);
                    }
                    break;
                
                case 'files':
                    if ($method === 'GET') {
                        if (isset($pathParts[1])) {
                            $this->getFileInfo((int)$pathParts[1]);
                        } else {
                            $this->listFiles();
                        }
                    } elseif ($method === 'DELETE' && isset($pathParts[1])) {
                        $this->deleteFile((int)$pathParts[1]);
                    } else {
                        throw new Exception('方法不允许', 405);
                    }
                    break;
                
                default:
                    throw new Exception('API端点不存在', 404);
            }
        } catch (Exception $e) {
            $this->logError($e->getMessage(), $e->getTrace());
            $this->sendResponse(['error' => $e->getMessage()], $e->getCode() ?: 500);
        }
    }
    
    /**
     * 处理文件上传
     */
    private function handleUpload(): void {
        if (empty($_FILES['file'])) {
            throw new Exception('没有上传文件', 400);
        }
        
        $file = $_FILES['file'];
        
        // 验证上传是否成功
        if ($file['error'] !== UPLOAD_ERR_OK) {
            $errorMessages = [
                UPLOAD_ERR_INI_SIZE => '文件超过了php.ini中upload_max_filesize指令限制',
                UPLOAD_ERR_FORM_SIZE => '文件超过了表单中MAX_FILE_SIZE指令限制',
                UPLOAD_ERR_PARTIAL => '文件只有部分被上传',
                UPLOAD_ERR_NO_FILE => '没有文件被上传',
                UPLOAD_ERR_NO_TMP_DIR => '找不到临时文件夹',
                UPLOAD_ERR_CANT_WRITE => '文件写入失败',
                UPLOAD_ERR_EXTENSION => '文件上传因扩展程序而停止',
            ];
            
            $errorMessage = $errorMessages[$file['error']] ?? '未知上传错误';
            throw new Exception($errorMessage, 400);
        }
        
        // 验证文件类型
        $finfo = new finfo(FILEINFO_MIME_TYPE);
        $mimeType = $finfo->file($file['tmp_name']);
        
        if (!in_array($mimeType, $this->allowedTypes)) {
            throw new Exception('文件类型不允许', 415);
        }
        
        // 验证文件大小
        if ($file['size'] > $this->maxFileSize) {
            throw new Exception('文件大小超过限制', 413);
        }
        
        // 生成唯一文件名
        $storedName = bin2hex(random_bytes(16)) . '_' . time();
        $extension = pathinfo($file['name'], PATHINFO_EXTENSION);
        if ($extension) {
            $storedName .= '.' . $extension;
        }
        
        // 确定文件类型分类
        $fileType = $this->getFileTypeCategory($mimeType);
        
        // 组织文件并获取相对路径
        $relativeFilePath = $this->organizeFile($file['tmp_name'], $storedName, $mimeType, $fileType);
        $destination = $this->storagePath . '/' . $relativeFilePath;
        
        // 创建缩略图（如果是图片且启用缩略图功能）
        $hasThumbnail = 0;
        if ($this->fileOrganization['create_thumbs'] && strpos($mimeType, 'image/') === 0) {
            $hasThumbnail = $this->createThumbnail($destination, $fileType) ? 1 : 0;
        }
        
        // 记录文件信息到数据库
        $stmt = $this->db->prepare('
            INSERT INTO files (original_name, stored_name, relative_path, mime_type, size, file_type, has_thumbnail, created_at)
            VALUES (:original_name, :stored_name, :relative_path, :mime_type, :size, :file_type, :has_thumbnail, :created_at)
        ');
        
        $stmt->execute([
            ':original_name' => $file['name'],
            ':stored_name' => $storedName,
            ':relative_path' => $relativeFilePath,
            ':mime_type' => $mimeType,
            ':size' => $file['size'],
            ':file_type' => $fileType,
            ':has_thumbnail' => $hasThumbnail,
            ':created_at' => date('Y-m-d H:i:s')
        ]);
        
        $fileId = $this->db->lastInsertId();
        
        // 返回上传成功响应
        $this->sendResponse([
            'success' => true,
            'message' => '文件上传成功',
            'file' => [
                'id' => $fileId,
                'name' => $file['name'],
                'type' => $mimeType,
                'file_type' => $fileType,
                'size' => $file['size'],
                'path' => $relativeFilePath,
                'has_thumbnail' => (bool)$hasThumbnail,
                'uploaded_at' => date('Y-m-d H:i:s')
            ]
        ]);
    }
    
    /**
     * 处理文件下载
     */
    private function handleDownload(int $fileId): void {
        // 查询文件信息
        $stmt = $this->db->prepare('SELECT * FROM files WHERE id = :id');
        $stmt->execute([':id' => $fileId]);
        $file = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$file) {
            throw new Exception('文件不存在', 404);
        }
        
        $filePath = $this->storagePath . '/' . $file['relative_path'];
        
        // 检查文件是否存在
        if (!file_exists($filePath)) {
            throw new Exception('文件不存在于存储系统中', 404);
        }
        
        // 设置响应头
        header('Content-Type: ' . $file['mime_type']);
        header('Content-Disposition: attachment; filename="' . $file['original_name'] . '"');
        header('Content-Length: ' . $file['size']);
        header('Cache-Control: no-cache, no-store, must-revalidate');
        header('Pragma: no-cache');
        header('Expires: 0');
        
        // 输出文件内容
        readfile($filePath);
        exit;
    }
    
    /**
     * 获取文件列表
     */
    private function listFiles(): void {
        // 分页参数
        $page = isset($_GET['page']) ? (int)$_GET['page'] : 1;
        $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : $this->pagination['default_limit'];
        
        if ($page < 1) $page = 1;
        if ($limit < 1 || $limit > $this->pagination['max_limit']) $limit = $this->pagination['default_limit'];
        
        $offset = ($page - 1) * $limit;
        
        // 搜索参数
        $search = $_GET['search'] ?? '';
        $whereClause = '';
        $params = [];
        
        if ($search) {
            $whereClause = "WHERE original_name LIKE :search";
            $params[':search'] = "%$search%";
        }
        
        // 统计总文件数
        $countQuery = "SELECT COUNT(*) FROM files $whereClause";
        $stmt = $this->db->prepare($countQuery);
        $stmt->execute($params);
        $totalFiles = $stmt->fetchColumn();
        
        // 获取文件列表
        $query = "SELECT id, original_name, mime_type, size, created_at 
                 FROM files $whereClause 
                 ORDER BY created_at DESC 
                 LIMIT :limit OFFSET :offset";
        
        $stmt = $this->db->prepare($query);
        $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
        $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
        
        foreach ($params as $key => $value) {
            $stmt->bindValue($key, $value);
        }
        
        $stmt->execute();
        $files = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // 格式化响应
        $totalPages = ceil($totalFiles / $limit);
        
        $this->sendResponse([
            'files' => $files,
            'pagination' => [
                'total' => $totalFiles,
                'page' => $page,
                'limit' => $limit,
                'pages' => $totalPages
            ]
        ]);
    }
    
    /**
     * 获取单个文件信息
     */
    private function getFileInfo(int $fileId): void {
        $stmt = $this->db->prepare('SELECT * FROM files WHERE id = :id');
        $stmt->execute([':id' => $fileId]);
        $file = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$file) {
            throw new Exception('文件不存在', 404);
        }
        
        $this->sendResponse([
            'file' => [
                'id' => $file['id'],
                'name' => $file['original_name'],
                'type' => $file['mime_type'],
                'size' => $file['size'],
                'uploaded_at' => $file['created_at'],
                'download_url' => '/download/' . $file['id'],
                'file_type' => $file['file_type'],
                'has_thumbnail' => (bool)$file['has_thumbnail'],
                'thumbnail_url' => $file['has_thumbnail'] ? '/thumbnail/' . $file['id'] : null
            ]
        ]);
    }
    
    /**
     * 删除文件
     */
    private function deleteFile(int $fileId): void {
        // 获取文件信息
        $stmt = $this->db->prepare('SELECT * FROM files WHERE id = :id');
        $stmt->execute([':id' => $fileId]);
        $file = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$file) {
            throw new Exception('文件不存在', 404);
        }
        
        $filePath = $this->storagePath . '/' . $file['relative_path'];
        
        // 从数据库中删除记录
        $stmt = $this->db->prepare('DELETE FROM files WHERE id = :id');
        $stmt->execute([':id' => $fileId]);
        
        // 如果存在，从存储中删除文件
        if (file_exists($filePath)) {
            unlink($filePath);
        }
        
        $this->sendResponse([
            'success' => true,
            'message' => '文件已成功删除'
        ]);
    }
    
    /**
     * 发送JSON响应
     */
    private function sendResponse(array $data, int $statusCode = 200): void {
        http_response_code($statusCode);
        header('Content-Type: application/json; charset=UTF-8');
        echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
        exit;
    }
    
    /**
     * 记录错误日志
     */
    private function logError(string $message, array $context = []): void {
        if (!$this->loggingEnabled || $this->logLevel !== 'error') {
            return;
        }
        
        $logFile = $this->logPath . '/error_' . date('Y-m-d') . '.log';
        $timestamp = date('Y-m-d H:i:s');
        $contextStr = json_encode($context, JSON_UNESCAPED_UNICODE);
        $logMessage = "[$timestamp] ERROR: $message | Context: $contextStr" . PHP_EOL;
        
        error_log($logMessage, 3, $logFile);
    }
    
    /**
     * 记录信息日志
     */
    private function logInfo(string $message, array $context = []): void {
        if (!$this->loggingEnabled || !in_array($this->logLevel, ['debug', 'info'])) {
            return;
        }
        
        $logFile = $this->logPath . '/info_' . date('Y-m-d') . '.log';
        $timestamp = date('Y-m-d H:i:s');
        $contextStr = json_encode($context, JSON_UNESCAPED_UNICODE);
        $logMessage = "[$timestamp] INFO: $message | Context: $contextStr" . PHP_EOL;
        
        error_log($logMessage, 3, $logFile);
    }
    
    /**
     * 验证API密钥
     */
    private function validateApiKey(string $method, string $path): void {
        // 检查是否是豁免的路由
        foreach ($this->apiSecurity['exempted_routes'] as $exemptedRoute) {
            if (strpos($exemptedRoute, ' ') !== false) {
                // 格式为 "METHOD /path"
                list($exemptMethod, $exemptPath) = explode(' ', $exemptedRoute, 2);
                if ($method === $exemptMethod && strpos($path, $exemptPath) === 0) {
                    return; // 这个路径被豁免了，不需要验证API密钥
                }
            } else {
                // 格式为 "/path"（不考虑方法）
                if (strpos($path, $exemptedRoute) === 0) {
                    return; // 这个路径被豁免了，不需要验证API密钥
                }
            }
        }
        
        // 获取API密钥
        $headerName = $this->apiSecurity['api_key_header'];
        $apiKey = $_SERVER['HTTP_' . str_replace('-', '_', strtoupper($headerName))] ?? null;
        
        // 如果没有找到API密钥，也尝试从GET参数中获取
        if (!$apiKey && isset($_GET['api_key'])) {
            $apiKey = $_GET['api_key'];
        }
        
        // 验证API密钥
        if (!$apiKey || !in_array($apiKey, $this->apiSecurity['api_keys'])) {
            $this->logError('API密钥无效或缺失', [
                'ip' => $_SERVER['REMOTE_ADDR'] ?? 'unknown',
                'path' => $path,
                'method' => $method
            ]);
            $this->sendResponse(['error' => 'API密钥无效或缺失'], 401);
            exit;
        }
    }
    
    /**
     * 获取文件类型分类
     */
    private function getFileTypeCategory(string $mimeType): string {
        foreach ($this->fileOrganization['type_mapping'] as $category => $mimeTypes) {
            if (in_array($mimeType, $mimeTypes)) {
                return $category;
            }
        }
        return 'other'; // 默认分类
    }
    
    /**
     * 组织文件到适当的目录
     */
    private function organizeFile(string $tempFilePath, string $storedName, string $mimeType, string $fileType): string {
        // 如果未启用文件整理，直接使用存储名
        if (!$this->fileOrganization['enabled']) {
            // 确保目标目录存在
            if (!is_dir($this->storagePath)) {
                mkdir($this->storagePath, 0755, true);
            }
            
            // 移动文件
            if (!move_uploaded_file($tempFilePath, $this->storagePath . '/' . $storedName)) {
                throw new Exception('文件保存失败', 500);
            }
            
            return $storedName;
        }
        
        // 根据策略生成相对路径
        $relativePath = '';
        $strategy = $this->fileOrganization['strategy'];
        $dateFormat = $this->fileOrganization['date_format'];
        $currentDate = date($dateFormat);
        
        switch ($strategy) {
            case 'type_date':
                $relativePath = $fileType . '/' . $currentDate;
                break;
            case 'date_type':
                $relativePath = $currentDate . '/' . $fileType;
                break;
            case 'type':
                $relativePath = $fileType;
                break;
            case 'date':
                $relativePath = $currentDate;
                break;
            default:
                $relativePath = ''; // 不使用子目录
        }
        
        // 如果有相对路径，确保它以斜线结尾
        if ($relativePath && substr($relativePath, -1) !== '/') {
            $relativePath .= '/';
        }
        
        // 如果配置了保留原始文件名
        if ($this->fileOrganization['preserve_filename']) {
            // 但仍然添加随机前缀以防止冲突
            $originalBasename = pathinfo($tempFilePath, PATHINFO_BASENAME);
            $storedName = substr($storedName, 0, 8) . '_' . $originalBasename;
        }
        
        // 完整的相对路径
        $fullRelativePath = $relativePath . $storedName;
        
        // 确保目标目录存在
        $directory = $this->storagePath . '/' . $relativePath;
        if (!is_dir($directory)) {
            mkdir($directory, 0755, true);
        }
        
        // 移动文件
        if (!move_uploaded_file($tempFilePath, $this->storagePath . '/' . $fullRelativePath)) {
            throw new Exception('文件保存失败', 500);
        }
        
        return $fullRelativePath;
    }
    
    /**
     * 为图片创建缩略图
     */
    private function createThumbnail(string $imagePath, string $fileType): bool {
        // 只支持常见图像格式
        $extension = strtolower(pathinfo($imagePath, PATHINFO_EXTENSION));
        if (!in_array($extension, ['jpg', 'jpeg', 'png', 'gif'])) {
            return false;
        }
        
        // 获取图像尺寸
        list($width, $height) = getimagesize($imagePath);
        if (!$width || !$height) {
            return false;
        }
        
        // 缩略图尺寸
        $thumbSize = $this->fileOrganization['thumb_size'];
        
        // 计算缩略图尺寸，保持纵横比
        if ($width > $height) {
            $newWidth = $thumbSize;
            $newHeight = intval($height * $thumbSize / $width);
        } else {
            $newHeight = $thumbSize;
            $newWidth = intval($width * $thumbSize / $height);
        }
        
        // 创建新图像
        $thumb = imagecreatetruecolor($newWidth, $newHeight);
        
        // 根据图像类型加载源图像
        switch ($extension) {
            case 'jpg':
            case 'jpeg':
                $source = imagecreatefromjpeg($imagePath);
                break;
            case 'png':
                $source = imagecreatefrompng($imagePath);
                // 保持透明度
                imagealphablending($thumb, false);
                imagesavealpha($thumb, true);
                break;
            case 'gif':
                $source = imagecreatefromgif($imagePath);
                break;
            default:
                return false;
        }
        
        // 调整图像大小
        imagecopyresampled($thumb, $source, 0, 0, 0, 0, $newWidth, $newHeight, $width, $height);
        
        // 保存缩略图
        $thumbPath = $this->getThumbPath($imagePath);
        $directory = dirname($thumbPath);
        
        if (!is_dir($directory)) {
            mkdir($directory, 0755, true);
        }
        
        // 保存缩略图
        switch ($extension) {
            case 'jpg':
            case 'jpeg':
                imagejpeg($thumb, $thumbPath, 80);
                break;
            case 'png':
                imagepng($thumb, $thumbPath, 8);
                break;
            case 'gif':
                imagegif($thumb, $thumbPath);
                break;
        }
        
        // 释放内存
        imagedestroy($source);
        imagedestroy($thumb);
        
        return true;
    }
    
    /**
     * 获取缩略图路径
     */
    private function getThumbPath(string $originalPath): string {
        $pathInfo = pathinfo($originalPath);
        $thumbDir = $pathInfo['dirname'] . '/thumbnails';
        return $thumbDir . '/' . $pathInfo['basename'];
    }
    
    /**
     * 提供缩略图
     */
    private function serveThumbnail(int $fileId): void {
        // 查询文件信息
        $stmt = $this->db->prepare('SELECT * FROM files WHERE id = :id AND has_thumbnail = 1');
        $stmt->execute([':id' => $fileId]);
        $file = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$file) {
            throw new Exception('缩略图不存在', 404);
        }
        
        $filePath = $this->storagePath . '/' . $file['relative_path'];
        $thumbPath = $this->getThumbPath($filePath);
        
        // 检查缩略图是否存在
        if (!file_exists($thumbPath)) {
            throw new Exception('缩略图文件不存在', 404);
        }
        
        // 设置响应头
        header('Content-Type: ' . $file['mime_type']);
        header('Content-Disposition: inline; filename="thumb_' . $file['original_name'] . '"');
        header('Cache-Control: max-age=86400, public'); // 缓存24小时
        
        // 输出缩略图内容
        readfile($thumbPath);
        exit;
    }
}

// 检查是否指定了配置文件
$configPath = $_SERVER['FILEAPI_CONFIG'] ?? __DIR__ . '/config.php';

// 实例化并运行API
new FileAPI($configPath);