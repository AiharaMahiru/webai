/**
 * FileAPI 测试程序
 * 
 * 用于测试FileAPI的上传、下载、查询和删除功能
 */

const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

// 配置
const config = {
  baseUrl: 'https://api.rwr.ink', // FileAPI服务的基础URL
  apiKey: '1145141919810',            // API密钥
  downloadFolder: './downloads',      // 下载文件保存的文件夹
};

// 确保下载文件夹存在
if (!fs.existsSync(config.downloadFolder)) {
  fs.mkdirSync(config.downloadFolder, { recursive: true });
}

// 创建axios实例
const api = axios.create({
  baseURL: config.baseUrl,
  headers: {
    'X-API-Key': config.apiKey
  }
});

/**
 * 上传文件
 * @param {string} filePath - 要上传的文件路径
 * @returns {Promise<object>} - 上传结果
 */
async function uploadFile(filePath) {
  console.log(`开始上传文件: ${filePath}`);
  
  try {
    const form = new FormData();
    form.append('file', fs.createReadStream(filePath));
    
    const response = await api.post('/upload', form, {
      headers: {
        ...form.getHeaders()
      }
    });
    
    console.log('上传成功:', response.data);
    return response.data;
  } catch (error) {
    handleApiError('上传文件失败', error);
    return null;
  }
}

/**
 * 下载文件
 * @param {number} fileId - 文件ID
 * @param {string} [fileName] - 可选的保存文件名
 * @returns {Promise<string>} - 下载的文件路径
 */
async function downloadFile(fileId, fileName) {
  console.log(`开始下载文件ID: ${fileId}`);
  
  try {
    // 先获取文件信息以获取原始文件名
    if (!fileName) {
      const fileInfo = await getFileInfo(fileId);
      if (fileInfo && fileInfo.file) {
        fileName = fileInfo.file.name;
      } else {
        fileName = `file_${fileId}`;
      }
    }
    
    const savePath = path.join(config.downloadFolder, fileName);
    
    const response = await api.get(`/download/${fileId}`, {
      responseType: 'stream'
    });
    
    const writer = fs.createWriteStream(savePath);
    
    return new Promise((resolve, reject) => {
      response.data.pipe(writer);
      
      writer.on('finish', () => {
        console.log(`文件已下载至: ${savePath}`);
        resolve(savePath);
      });
      
      writer.on('error', err => {
        console.error('文件写入错误:', err);
        reject(err);
      });
    });
  } catch (error) {
    handleApiError('下载文件失败', error);
    return null;
  }
}

/**
 * 获取文件列表
 * @param {number} [page=1] - 页码
 * @param {number} [limit=10] - 每页条数
 * @param {string} [search] - 搜索关键词
 * @returns {Promise<object>} - 文件列表
 */
async function listFiles(page = 1, limit = 10, search = '') {
  console.log(`获取文件列表: 页码=${page}, 每页=${limit}${search ? ', 搜索=' + search : ''}`);
  
  try {
    const params = { page, limit };
    if (search) {
      params.search = search;
    }
    
    const response = await api.get('/files', { params });
    
    console.log('文件列表获取成功');
    if (response.data.files && response.data.files.length > 0) {
      console.table(response.data.files.map(file => ({
        ID: file.id,
        文件名: file.original_name,
        类型: file.mime_type,
        大小: formatFileSize(file.size),
        上传时间: file.created_at
      })));
      
      console.log(`分页信息: 总数=${response.data.pagination.total}, 当前页=${response.data.pagination.page}, 总页数=${response.data.pagination.pages}`);
    } else {
      console.log('没有找到文件');
    }
    
    return response.data;
  } catch (error) {
    handleApiError('获取文件列表失败', error);
    return null;
  }
}

/**
 * 获取单个文件信息
 * @param {number} fileId - 文件ID
 * @returns {Promise<object>} - 文件信息
 */
async function getFileInfo(fileId) {
  console.log(`获取文件信息: ID=${fileId}`);
  
  try {
    const response = await api.get(`/files/${fileId}`);
    
    console.log('文件信息获取成功:');
    console.log(JSON.stringify(response.data, null, 2));
    
    return response.data;
  } catch (error) {
    handleApiError('获取文件信息失败', error);
    return null;
  }
}

/**
 * 删除文件
 * @param {number} fileId - 文件ID
 * @returns {Promise<boolean>} - 是否删除成功
 */
async function deleteFile(fileId) {
  console.log(`删除文件: ID=${fileId}`);
  
  try {
    const response = await api.delete(`/files/${fileId}`);
    
    console.log('文件删除成功:', response.data);
    return true;
  } catch (error) {
    handleApiError('删除文件失败', error);
    return false;
  }
}

/**
 * 处理API错误
 * @param {string} message - 错误前缀信息
 * @param {Error} error - 错误对象
 */
function handleApiError(message, error) {
  console.error(message);
  
  if (error.response) {
    // 服务器返回了错误响应
    console.error(`状态码: ${error.response.status}`);
    console.error('响应数据:', error.response.data);
  } else if (error.request) {
    // 请求已发送但没有收到响应
    console.error('没有收到响应，请检查API服务是否运行');
  } else {
    // 请求设置时出错
    console.error('错误信息:', error.message);
  }
}

/**
 * 格式化文件大小
 * @param {number} bytes - 字节数
 * @returns {string} - 格式化后的文件大小
 */
function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  
  return (bytes / Math.pow(1024, i)).toFixed(2) + ' ' + sizes[i];
}

/**
 * 运行测试
 */
async function runTests() {
  // 简单的命令行参数解析
  const args = process.argv.slice(2);
  const command = args[0];

  try {
    switch (command) {
      case 'upload':
        if (!args[1]) {
          console.error('请指定要上传的文件路径');
          break;
        }
        await uploadFile(args[1]);
        break;
      
      case 'download':
        if (!args[1]) {
          console.error('请指定要下载的文件ID');
          break;
        }
        await downloadFile(parseInt(args[1], 10));
        break;
      
      case 'list':
        const page = args[1] ? parseInt(args[1], 10) : 1;
        const limit = args[2] ? parseInt(args[2], 10) : 10;
        const search = args[3] || '';
        await listFiles(page, limit, search);
        break;
      
      case 'info':
        if (!args[1]) {
          console.error('请指定要查询的文件ID');
          break;
        }
        await getFileInfo(parseInt(args[1], 10));
        break;
      
      case 'delete':
        if (!args[1]) {
          console.error('请指定要删除的文件ID');
          break;
        }
        await deleteFile(parseInt(args[1], 10));
        break;
      
      case 'test-all':
        console.log('执行完整测试流程...');
        
        // 上传文件
        const filePath = args[1] || './test-file.txt';
        if (!fs.existsSync(filePath)) {
          console.log('创建测试文件...');
          fs.writeFileSync(filePath, '这是一个测试文件，用于测试FileAPI。', 'utf8');
        }
        
        const uploadResult = await uploadFile(filePath);
        if (!uploadResult) {
          console.error('上传测试失败，中止测试');
          break;
        }
        
        const fileId = uploadResult.file.id;
        
        // 获取文件信息
        await getFileInfo(fileId);
        
        // 列出所有文件
        await listFiles();
        
        // 下载文件
        await downloadFile(fileId);
        
        // 删除文件
        await deleteFile(fileId);
        
        // 确认文件已被删除
        await getFileInfo(fileId);
        
        console.log('测试完成！');
        break;
      
      default:
        console.log(`
FileAPI 测试程序

使用方法:
  node fileapi-tester.js <命令> [参数]

命令:
  upload <文件路径>            上传文件
  download <文件ID>            下载文件
  list [页码] [每页条数] [搜索] 获取文件列表
  info <文件ID>                获取文件信息
  delete <文件ID>              删除文件
  test-all [测试文件路径]      执行完整测试流程

示例:
  node fileapi-tester.js upload ./test.jpg
  node fileapi-tester.js download 1
  node fileapi-tester.js list 1 20 "test"
  node fileapi-tester.js info 1
  node fileapi-tester.js delete 1
  node fileapi-tester.js test-all
        `);
        break;
    }
  } catch (error) {
    console.error('测试程序运行错误:', error);
  }
}

// 执行测试
runTests();