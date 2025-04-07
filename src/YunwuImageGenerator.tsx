import React, { useState, ChangeEvent, FormEvent, useEffect, useRef } from 'react';

const YunwuImageGenerator = () => {
  // 内嵌API密钥（生产环境应考虑更安全的方式存储）
  const apiKey = "sk-b5FukpWMw6BpXkmyMAZ3WZh8ICx6egw0W2UjpGne8yN14eWB";
  
  // 服务器配置
  const serverConfig = {
    uploadPath: '/www/wwwroot/rwr.ink/s3',
    imageBaseUrl: 'https://rwr.ink/s3'
  };
  
  // State variables
  const [prompt, setPrompt] = useState<string>('');
  const [model, setModel] = useState<string>('gpt-4o-image-vip');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [response, setResponse] = useState<any>(null);
  const [progressUpdates, setProgressUpdates] = useState<string[]>([]);
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [imageUrl, setImageUrl] = useState<string>('');
  const [savedImageName, setSavedImageName] = useState<string>('');
  const [showApiDetails, setShowApiDetails] = useState<boolean>(false);
  const [temperature, setTemperature] = useState<string>('0.7');
  const [maxTokens, setMaxTokens] = useState<string>('1024');
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [selectedImage, setSelectedImage] = useState<string>('');
  const [isUploading, setIsUploading] = useState<boolean>(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check screen size for responsive design
  useEffect(() => {
    const checkIfMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    // Initial check
    checkIfMobile();
    
    // Add event listener for resize
    window.addEventListener('resize', checkIfMobile);
    
    // Cleanup
    return () => window.removeEventListener('resize', checkIfMobile);
  }, []);

  // Function to extract progress updates and image URL from response
  const extractContentDetails = (content: string): { updates: string[], imgUrl: string, percent: number } => {
    // Reset previous data
    const updates: string[] = [];
    let imgUrl = '';
    let percent = 0;

    // Parse progress updates
    const progressLines = content.split('\n').filter((line: string) => 
      line.includes('排队中') || 
      line.includes('生成中') || 
      line.includes('进度') ||
      line.includes('生成完成')
    );
    
    updates.push(...progressLines);

    // Extract progress percentage
    const percentMatch = content.match(/进度 (\d+)/);
    if (percentMatch && percentMatch[1]) {
      percent = parseInt(percentMatch[1]);
    }

    // Check for completion
    if (content.includes('生成完成')) {
      percent = 100;
    }

    // Extract image URL using regex
    const imgMatch = content.match(/!\[.*?\]\((.*?)\)/);
    if (imgMatch && imgMatch[1]) {
      imgUrl = imgMatch[1];
    }

    return { updates, imgUrl, percent };
  };

  // Function to handle image upload
  const handleImageUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) {
      return;
    }
    
    setIsUploading(true);
    setError('');
    
    try {
      const file = e.target.files[0];
      const formData = new FormData();
      formData.append('image', file);
      
      // 发送请求到后端API保存图片
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        throw new Error('上传失败');
      }
      
      const result = await response.json();
      const newImageUrl = `${serverConfig.imageBaseUrl}/${result.filename}`;
      
      // 添加到上传图片列表
      setUploadedImages(prev => [...prev, newImageUrl]);
      setSelectedImage(newImageUrl);
      
      // 更新提示词以包含图片
      if (prompt) {
        setPrompt(`${prompt}\n参考图片: ${newImageUrl}`);
      } else {
        setPrompt(`参考图片: ${newImageUrl}`);
      }
      
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : '上传图片时出错';
      setError(`上传失败: ${errorMessage}`);
    } finally {
      setIsUploading(false);
      // 重置文件输入
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Function to save generated image to server
  const saveGeneratedImage = async (url: string): Promise<string> => {
    try {
      const response = await fetch('/api/save-generated', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          imageUrl: url,
          savePath: serverConfig.uploadPath
        })
      });
      
      if (!response.ok) {
        throw new Error('保存失败');
      }
      
      const result = await response.json();
      return result.filename;
    } catch (err) {
      console.error('保存生成图片失败:', err);
      return '';
    }
  };

  // Function to handle form submission
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!prompt.trim()) {
      setError('提示词不能为空');
      return;
    }

    setIsLoading(true);
    setError('');
    setResponse(null);
    setProgressUpdates([]);
    setProgressPercent(0);
    setImageUrl('');
    setSavedImageName('');

    try {
      // API endpoint
      const apiUrl = 'https://yunwu.ai/v1/chat/completions';

      // Request body
      const requestBody = {
        model: model,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: parseInt(maxTokens),
        temperature: parseFloat(temperature)
      };

      // Request headers
      const headers = {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      };

      // Make the API request
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`API请求失败: ${response.status} ${response.statusText}\n${errorData}`);
      }

      const data = await response.json();
      setResponse(data);

      // Extract message content
      if (data.choices && data.choices.length > 0 && data.choices[0].message) {
        const messageContent = data.choices[0].message.content;
        const { updates, imgUrl, percent } = extractContentDetails(messageContent);
        
        setProgressUpdates(updates);
        setProgressPercent(percent);
        setImageUrl(imgUrl);
        
        // 如果生成了图片，保存到服务器
        if (imgUrl) {
          const savedName = await saveGeneratedImage(imgUrl);
          if (savedName) {
            setSavedImageName(savedName);
          }
        }
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : '未知错误';
      setError(`错误: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Function to download the generated image
  const downloadImage = async () => {
    if (!imageUrl) return;
    
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      // Use saved name if available, otherwise extract from URL
      const filename = savedImageName || (() => {
        const filenameMatch = imageUrl.match(/\/([^\/]+)$/);
        return filenameMatch ? filenameMatch[1] : 'generated-image.png';
      })();
      
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      
      // Cleanup
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setError('下载图片失败');
      console.error('下载图片失败:', err);
    }
  };

  return (
    <div className={`mx-auto p-4 ${isMobile ? 'w-full' : 'max-w-4xl'} bg-gray-50 rounded-lg shadow-md`}>
      <h1 className="text-2xl md:text-3xl font-bold text-center mb-6">云雾 AI 图像生成器</h1>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* 图片上传区域 */}
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
          <div className="flex flex-col items-center justify-center">
            <label htmlFor="image-upload" className="cursor-pointer">
              <div className="flex flex-col items-center">
                <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
                </svg>
                <span className="mt-2 text-sm text-gray-600">上传参考图片</span>
              </div>
            </label>
            <input 
              id="image-upload" 
              ref={fileInputRef}
              type="file" 
              accept="image/*" 
              className="hidden" 
              onChange={handleImageUpload}
              disabled={isUploading}
            />
            
            {isUploading && (
              <div className="mt-2 text-blue-500">上传中...</div>
            )}
            
            {uploadedImages.length > 0 && (
              <div className="mt-4 w-full">
                <h4 className="text-sm font-medium mb-2">已上传的图片:</h4>
                <div className="flex flex-wrap gap-2">
                  {uploadedImages.map((img, index) => (
                    <div 
                      key={index} 
                      className={`relative border p-1 rounded cursor-pointer ${selectedImage === img ? 'border-blue-500' : 'border-gray-300'}`}
                      onClick={() => setSelectedImage(img)}
                    >
                      <img src={img} alt={`上传图片 ${index+1}`} className="h-16 w-16 object-cover" />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-1">提示词</label>
          <textarea
            value={prompt}
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setPrompt(e.target.value)}
            className="w-full p-2 border rounded h-24"
            placeholder="画一张吉卜力风格的边牧犬"
          />
        </div>
        
        <div className="flex flex-col md:flex-row gap-4">
          <div className="w-full md:w-1/2">
            <label className="block text-sm font-medium mb-1">模型</label>
            <select
              value={model}
              onChange={(e: ChangeEvent<HTMLSelectElement>) => setModel(e.target.value)}
              className="w-full p-2 border rounded"
            >
              <option value="gpt-4o-image-vip">gpt-4o-image-vip</option>
              <option value="gpt-4o">gpt-4o</option>
            </select>
          </div>
          
          <div className="w-full md:w-1/2 flex items-end">
            <button
              type="button"
              onClick={() => setShowApiDetails(!showApiDetails)}
              className="w-full md:w-auto px-3 py-2 text-blue-600 border border-blue-600 rounded hover:bg-blue-50"
            >
              {showApiDetails ? '隐藏高级设置' : '显示高级设置'}
            </button>
          </div>
        </div>
        
        {showApiDetails && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Temperature</label>
              <input
                type="number"
                min="0"
                max="2"
                step="0.1"
                value={temperature}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setTemperature(e.target.value)}
                className="w-full p-2 border rounded"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Max Tokens</label>
              <input
                type="number"
                min="100"
                max="4096"
                step="1"
                value={maxTokens}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setMaxTokens(e.target.value)}
                className="w-full p-2 border rounded"
              />
            </div>
          </div>
        )}
        
        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-blue-600 text-white p-3 rounded hover:bg-blue-700 disabled:bg-blue-300 font-medium"
        >
          {isLoading ? '生成中...' : '生成图像'}
        </button>
      </form>
      
      {error && (
        <div className="mt-4 p-3 bg-red-100 text-red-700 rounded">
          {error}
        </div>
      )}
      
      {isLoading && (
        <div className="mt-6 p-4 border rounded bg-gray-100">
          <h3 className="font-medium mb-3">正在生成图像...</h3>
          <div className="w-full bg-gray-200 rounded-full h-4 mb-3">
            <div 
              className="bg-blue-600 h-4 rounded-full transition-all duration-300 ease-in-out" 
              style={{ width: `${progressPercent}%` }}
            ></div>
          </div>
          <div className="text-sm text-gray-600">
            {progressPercent === 0 ? '准备中...' : `已完成 ${progressPercent}%`}
          </div>
          
          {progressUpdates.length > 0 && (
            <div className="mt-3 text-sm">
              <div className="font-medium mb-1">进度详情:</div>
              <div className="space-y-1 max-h-36 overflow-y-auto">
                {progressUpdates.map((update, index) => (
                  <div key={index} className="text-gray-700">{update}</div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      
      {imageUrl && (
        <div className="mt-6">
          <h3 className="font-medium mb-4 text-center">生成的图像:</h3>
          <div className="flex flex-col items-center">
            <img 
              src={imageUrl} 
              alt="Generated" 
              className="max-w-full rounded-lg shadow-md"
            />
            <div className="mt-4 flex gap-3">
              <button 
                onClick={downloadImage}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              >
                下载图片
              </button>
              <a 
                href={imageUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                在新窗口打开
              </a>
            </div>
            
            {savedImageName && (
              <div className="mt-3 text-sm text-gray-600">
                图片已保存到服务器: {`${serverConfig.imageBaseUrl}/${savedImageName}`}
              </div>
            )}
          </div>
        </div>
      )}
      
      {response && (
        <div className="mt-6">
          <button
            type="button"
            onClick={() => {
              const element = document.getElementById('apiResponse');
              if (element) {
                element.classList.toggle('hidden');
              }
            }}
            className="text-blue-600 hover:underline text-sm"
          >
            显示/隐藏 API 响应详情
          </button>
          <pre id="apiResponse" className="hidden mt-2 p-4 border rounded bg-gray-100 overflow-auto text-xs max-h-96">
            {JSON.stringify(response, null, 2)}
          </pre>
        </div>
      )}
      
      <div className="mt-6 text-center text-xs text-gray-500">
        云雾 AI 图像生成器 © {new Date().getFullYear()}
      </div>
    </div>
  );
};

export default YunwuImageGenerator;
