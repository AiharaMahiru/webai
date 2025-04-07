// 文件: server.js
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const app = express();

// 服务器配置
const config = {
  port: 3001,
  uploadDir: '/www/wwwroot/rwr.ink/s3',
  publicBaseUrl: 'https://rwr.ink/s3'
};

// 确保上传目录存在
if (!fs.existsSync(config.uploadDir)) {
  try {
    fs.mkdirSync(config.uploadDir, { recursive: true });
    console.log(`已创建上传目录: ${config.uploadDir}`);
  } catch (err) {
    console.error(`无法创建上传目录: ${err.message}`);
    process.exit(1);
  }
}

// 设置multer存储
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, config.uploadDir);
  },
  filename: function (req, file, cb) {
    // 使用原始文件名的扩展名，但生成唯一文件名
    const fileExt = path.extname(file.originalname).toLowerCase();
    const uniqueFilename = `${Date.now()}-${uuidv4().substring(0, 8)}${fileExt}`;
    cb(null, uniqueFilename);
  }
});

// 文件过滤器 - 只允许图片
const fileFilter = (req, file, cb) => {
  // 接受的图像类型
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('只支持 JPG, PNG, GIF 和 WebP 格式的图片！'), false);
  }
};

// 初始化上传中间件
const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 限制10MB
  }
});

// 启用JSON解析
app.use(express.json());

// 设置CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    res.header('Access-Control-Allow-Methods', 'PUT, POST, PATCH, DELETE, GET');
    return res.status(200).json({});
  }
  next();
});

// 图片上传API端点
app.post('/api/upload', upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '没有上传文件' });
    }
    
    // 返回成功结果
    res.status(200).json({
      success: true,
      filename: req.file.filename,
      path: `${config.uploadDir}/${req.file.filename}`,
      url: `${config.publicBaseUrl}/${req.file.filename}`
    });
  } catch (error) {
    console.error('上传处理错误:', error);
    res.status(500).json({ error: '文件上传失败' });
  }
});

// 保存生成的图片API端点
app.post('/api/save-generated', async (req, res) => {
  try {
    const { imageUrl } = req.body;
    
    if (!imageUrl) {
      return res.status(400).json({ error: '未提供图片URL' });
    }
    
    // 从URL下载图片
    const response = await axios({
      method: 'GET',
      url: imageUrl,
      responseType: 'arraybuffer'
    });
    
    // 确定文件扩展名 (根据内容类型)
    let fileExt = '.png'; // 默认
    const contentType = response.headers['content-type'];
    if (contentType) {
      if (contentType.includes('jpeg') || contentType.includes('jpg')) {
        fileExt = '.jpg';
      } else if (contentType.includes('png')) {
        fileExt = '.png';
      } else if (contentType.includes('gif')) {
        fileExt = '.gif';
      } else if (contentType.includes('webp')) {
        fileExt = '.webp';
      }
    }
    
    // 生成唯一文件名
    const filename = `generated-${Date.now()}-${uuidv4().substring(0, 8)}${fileExt}`;
    const filePath = path.join(config.uploadDir, filename);
    
    // 写入文件
    fs.writeFileSync(filePath, response.data);
    
    // 返回成功结果
    res.status(200).json({
      success: true,
      filename: filename,
      path: filePath,
      url: `${config.publicBaseUrl}/${filename}`
    });
  } catch (error) {
    console.error('保存生成图片错误:', error);
    res.status(500).json({ error: '保存生成图片失败' });
  }
});

// 启动服务器
app.listen(config.port, () => {
  console.log(`服务器运行在 http://localhost:${config.port}`);
  console.log(`上传目录: ${config.uploadDir}`);
  console.log(`公共访问URL: ${config.publicBaseUrl}`);
});
