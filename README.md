# 云雾 AI 图像生成器与 FileAPI

一个全栈应用，结合了用于AI图像生成的React前端和基于PHP的文件存储后端系统。

## 项目概述

该项目由两个主要组件组成：

1. **FileAPI**：基于PHP的RESTful API服务，用于文件管理（上传、下载和组织）
2. **云雾 AI 图像生成器**：一个React应用，允许用户使用云雾AI服务生成图像并使用FileAPI存储

## 仓库结构

```
project-root/
│
├── fileapi/              # 后端文件管理API 
│   ├── config.php        # FileAPI配置文件
│   ├── index.php         # FileAPI主要实现
│   ├── uploads/          # 文件存储目录（自动创建）
│   ├── logs/             # 日志文件目录（自动创建）
│   └── database/         # SQLite数据库目录（自动创建）
│
├── src/                  # React应用源代码
│   ├── App.tsx           # 主App组件
│   ├── YunwuImageGenerator.tsx  # AI图像生成组件
│   ├── index.tsx         # React入口点
│   └── ...               # 其他React文件
│
└── public/               # React应用的公共资源
```

## 组件

### FileAPI

FileAPI是一个独立的基于PHP的文件管理服务，提供：

- 文件上传和存储，支持自动分类整理
- 通过唯一ID下载文件
- 文件列表和搜索功能
- 图像文件的缩略图生成
- 安全的API密钥认证
- 支持各种文件类型（图片、文档、电子表格、压缩包）
- 简单的数据库集成（默认SQLite，支持MySQL）

### 云雾 AI 图像生成器

一个基于React的Web应用，它：

- 允许用户使用云雾AI的API生成图像
- 提供用户友好的界面用于输入提示词和模型参数
- 支持上传参考图像
- 在图像生成过程中显示实时进度
- 将生成的图像保存到FileAPI以实现持久存储
- 支持查看、下载和管理生成的图像

## 安装与设置

### FileAPI设置

1. 将`fileapi`目录放置在启用PHP的Web服务器上
2. 确保安装了PHP 7.4+并启用了以下扩展：
   - PDO（支持SQLite或MySQL）
   - 用于图像处理的GD库
   - JSON
3. 配置`config.php`文件：
   - 设置存储路径
   - 配置允许的文件类型
   - 设置API安全（密钥）
   - 选择数据库连接类型

4. 确保以下目录可由Web服务器写入：
   - `fileapi/uploads`
   - `fileapi/logs`
   - `fileapi/database`

### React应用设置

1. 安装依赖：
   ```bash
   npm install
   ```

2. 在`src/YunwuImageGenerator.tsx`中配置API端点：
   ```typescript
   const fileApiConfig = {
     baseUrl: 'https://your-domain.com/fileapi',
     apiKey: 'your-api-key'
   };
   ```

3. 构建生产版本：
   ```bash
   npm run build
   ```

## 使用方法

### 直接使用FileAPI

FileAPI提供以下RESTful端点：

- `POST /upload` - 上传文件
- `GET /download/{file_id}` - 通过ID下载文件
- `GET /thumbnail/{file_id}` - 获取文件的缩略图
- `GET /files` - 列出所有文件（支持分页）
- `GET /files/{file_id}` - 获取文件信息
- `DELETE /files/{file_id}` - 删除文件

所有请求（除了豁免的路由外）必须包含API密钥头：
```
X-API-Key: your-api-key
```

### 使用云雾 AI 图像生成器Web应用

1. 在浏览器中打开Web应用
2. （可选）使用上传区域上传参考图像
3. 输入描述你想要生成的图像的提示词
4. 选择AI模型并根据需要调整参数
5. 点击"生成图像"并等待结果
6. 下载或保存生成的图像

## 配置

### FileAPI配置选项

`config.php`文件包含FileAPI的所有配置选项：

- **存储设置**：
  - `storage_path` - 上传文件的存储位置
  - `file_organization` - 文件如何组织（按类型、日期等）
  - `create_thumbs` - 是否为图像创建缩略图

- **API设置**：
  - `allowed_types` - 允许上传的MIME类型
  - `max_file_size` - 以字节为单位的最大文件大小
  - `api_key_enabled` - 是否需要API密钥认证
  - `api_keys` - 有效API密钥列表
  - `cors` - 跨源资源共享设置

- **数据库设置**：
  - 默认使用SQLite
  - 可配置为MySQL

### 云雾 AI 生成器配置

可以在`src/YunwuImageGenerator.tsx`中配置React应用：

- `apiKey` - 你的云雾AI API密钥
- `fileApiConfig` - 连接到FileAPI的配置
- 模型参数和默认值

## 安全注意事项

- FileAPI使用API密钥认证保护端点
- 使用MIME类型检测验证文件类型
- 文件路径经过处理以防止目录遍历
- 默认情况下限制跨源请求
- API密钥应保持安全并定期更换
- 云雾AI API密钥在客户端代码中暴露，在生产环境中应妥善保护

## API文档

### FileAPI响应

所有API响应都以JSON格式返回。

**成功上传示例：**
```json
{
  "success": true,
  "message": "文件上传成功",
  "file": {
    "id": 123,
    "name": "example.jpg",
    "type": "image/jpeg",
    "file_type": "image",
    "size": 12345,
    "path": "image/2025/04/07/abcd1234_example.jpg",
    "has_thumbnail": true,
    "uploaded_at": "2025-04-07 12:34:56"
  }
}
```

**错误响应示例：**
```json
{
  "error": "文件类型不允许"
}
```

## 许可信息

本项目按MIT许可开源，但不鼓励商用，若仍需商用请备注来源。

## 致谢

- React - 前端框架