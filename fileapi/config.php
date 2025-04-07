<?php
/**
 * FileAPI 配置文件
 * 
 * 包含FileAPI服务的所有配置项
 */

return [
    // 文件存储路径
    'storage_path' => __DIR__ . '/uploads',
    
    // 文件自动整理配置
    'file_organization' => [
        'enabled' => true,                  // 是否启用自动整理
        'strategy' => 'type_date',          // 整理策略: type_date, date_type, type, date, none
        'date_format' => 'Y/m/d',           // 日期目录格式
        'type_mapping' => [                 // 文件类型映射
            'image' => ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
            'document' => ['application/pdf', 'text/plain', 'application/msword', 
                          'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
            'spreadsheet' => ['application/vnd.ms-excel', 
                             'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
            'archive' => ['application/zip', 'application/x-rar-compressed'],
            'other' => []  // 默认分类
        ],
        'create_thumbs' => true,           // 是否为图片创建缩略图
        'thumb_size' => 200,               // 缩略图尺寸（像素）
        'preserve_filename' => false,      // 是否保留原始文件名（不安全）
    ],
    
    // 允许的文件类型 MIME
    'allowed_types' => [
        'image/jpeg',
        'image/png',
        'image/gif',
        'application/pdf',
        'text/plain',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/zip',
        'application/x-rar-compressed',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ],
    
    // 最大文件大小（字节）
    'max_file_size' => 20 * 1024 * 1024, // 20MB
    
    // 数据库连接信息
    'db_connection' => [
        // 默认使用SQLite
        'dsn' => 'sqlite:' . __DIR__ . '/database/files.db',
        'username' => null,
        'password' => null,
        
        /* MySQL 配置示例
        'dsn' => 'mysql:host=localhost;dbname=fileapi;charset=utf8mb4',
        'username' => 'root',
        'password' => 'your_password',
        */
    ],
    
    // API配置
        'api' => [
            'cors' => [
                // 允许特定来源，安全性更高
                // 'allowed_origins' => ['https://draw.rwr.ink'],
                // 或者允许所有来源（开发时常用，生产环境慎用）
                'allowed_origins' => ['*'],
                'allowed_methods' => ['GET', 'POST', 'DELETE', 'OPTIONS'], // 确保包含 OPTIONS
                'allowed_headers' => ['Content-Type', 'Authorization', 'X-API-Key'] // 确保包含前端发送的所有自定义头
                // 如果需要传递 Cookie 或 Authorization header (HTTP Basic/Bearer)
                // 'credentials' => true, // 如果设为 true, allowed_origins 不能是 '*'
            ],
        
        // 分页默认值
        'pagination' => [
            'default_limit' => 10,
            'max_limit' => 100
        ],
        
        // API安全配置
        'security' => [
            'api_key_enabled' => true,          // 是否启用API密钥验证
            'api_keys' => [                     // 允许的API密钥列表
                '1145141919810',               // 替换为实际的API密钥
                '1145141919810'                // 可以有多个API密钥
            ],
            'api_key_header' => 'X-API-Key',    // API密钥的请求头名称
            'exempted_routes' => [              // 不需要API密钥的路由
                'GET /download/'                // 例如，允许直接下载文件
            ]
        ]
    ],
    
    // 日志设置
    'logging' => [
        'enabled' => true,
        'path' => __DIR__ . '/logs',
        'level' => 'error' // debug, info, warning, error
    ]
];