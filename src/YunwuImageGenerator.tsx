import React, { useState, useEffect, useRef, FormEvent, ChangeEvent } from 'react';

// Component for the enhanced Yunwu AI Image Generator
const EnhancedYunwuGenerator = () => {
  // API Configuration
  const yunwuApiKey = "sk-b5FukpWMw6BpXkmyMAZ3WZh8ICx6egw0W2UjpGne8yN14eWB";
  const fileApiConfig = {
    baseUrl: 'https:/api.rwr.ink',
    apiKey: '1145141919810'
  };
  
  // State variables for the form
  const [prompt, setPrompt] = useState<string>('');
  const [model, setModel] = useState<string>('gpt-4o-image-vip');
  const [temperature, setTemperature] = useState<string>('0.7');
  const [maxTokens, setMaxTokens] = useState<string>('1024');
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);
  
  // State variables for the generation process
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [progressUpdates, setProgressUpdates] = useState<string[]>([]);
  const [progressPercent, setProgressPercent] = useState<number>(0);
  
  // State variables for the images
  const [imageUrl, setImageUrl] = useState<string>('');
  const [savedImageUrl, setSavedImageUrl] = useState<string>('');
  const [uploadedImages, setUploadedImages] = useState<{id: string, url: string}[]>([]);
  const [selectedImage, setSelectedImage] = useState<string>('');
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState<boolean>(false);
  
  // State for history records
  const [historyImages, setHistoryImages] = useState<{
    id: string, 
    url: string, 
    prompt: string, 
    timestamp: number,
    isDeleting?: boolean
  }[]>([]);
  const [showHistory, setShowHistory] = useState<boolean>(false);
  
  // State for prompt library
  const [promptLibrary, setPromptLibrary] = useState<{category: string, prompts: string[]}[]>([
    {
      category: "风格选择",
      prompts: [
        "吉卜力风格的",
        "赛博朋克风格的",
        "水彩画风格的",
        "像素艺术风格的",
        "油画风格的",
        "照片级写实的"
      ]
    },
    {
      category: "主题描述",
      prompts: [
        "一只可爱的猫咪",
        "一个神秘的森林",
        "未来科技城市",
        "宁静的湖泊",
        "繁忙的市场"
      ]
    },
    {
      category: "细节元素",
      prompts: [
        "阳光透过树叶",
        "在雨中",
        "雾气缭绕",
        "夕阳的光芒",
        "星空下"
      ]
    }
  ]);
  
  // Active tab state
  const [activeTab, setActiveTab] = useState<'generate' | 'history' | 'library'>('generate');
  
  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const promptInputRef = useRef<HTMLTextAreaElement>(null);
  
  // Load dark mode preference from localStorage
  useEffect(() => {
    const savedMode = localStorage.getItem('yunwu-dark-mode');
    if (savedMode) {
      setIsDarkMode(savedMode === 'true');
    } else {
      // Check system preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setIsDarkMode(prefersDark);
    }
    
    // Load history from localStorage
    const savedHistory = localStorage.getItem('yunwu-history');
    if (savedHistory) {
      try {
        setHistoryImages(JSON.parse(savedHistory));
      } catch (err) {
        console.error('Failed to parse history:', err);
      }
    }
  }, []);
  
  // Save dark mode preference to localStorage
  useEffect(() => {
    localStorage.setItem('yunwu-dark-mode', isDarkMode.toString());
    document.body.classList.toggle('dark', isDarkMode);
  }, [isDarkMode]);
  
  // Save history to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('yunwu-history', JSON.stringify(historyImages));
  }, [historyImages]);
  
  // Toggle dark mode
  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
  };
  
  // Function to handle image upload using FileAPI
  const handleImageUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) {
      return;
    }
    
    setIsUploading(true);
    setError('');
    
    try {
      const file = e.target.files[0];
      const formData = new FormData();
      formData.append('file', file);
      
      // Send request to FileAPI
      const response = await fetch(`${fileApiConfig.baseUrl}/upload`, {
        method: 'POST',
        headers: {
          'X-API-Key': fileApiConfig.apiKey
        },
        body: formData
      });
      
      if (!response.ok) {
        throw new Error('上传失败');
      }
      
      const result = await response.json();
      
      // Handle the response
      if (result.file && result.file.id) {
        // Construct download URL
        const fileId = result.file.id;
        const downloadUrl = `${fileApiConfig.baseUrl}/download/${fileId}`;
        
        // Add to uploaded images
        setUploadedImages(prev => [...prev, { id: fileId, url: downloadUrl }]);
        setSelectedImage(downloadUrl);
        
        // Update prompt to include the image
        if (prompt) {
          setPrompt(`${prompt}\n参考图片: ${downloadUrl}`);
        } else {
          setPrompt(`参考图片: ${downloadUrl}`);
        }
      } else {
        throw new Error('上传成功但未返回有效的文件信息');
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : '上传图片时出错';
      setError(`上传失败: ${errorMessage}`);
    } finally {
      setIsUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };
  
  // Function to delete an uploaded reference image
  const deleteUploadedImage = async (imageId: string) => {
    try {
      // Make delete request to FileAPI
      const response = await fetch(`${fileApiConfig.baseUrl}/files/${imageId}`, {
        method: 'DELETE',
        headers: {
          'X-API-Key': fileApiConfig.apiKey
        }
      });
      
      if (!response.ok) {
        throw new Error('删除失败');
      }
      
      // Remove from state
      setUploadedImages(prev => prev.filter(img => img.id !== imageId));
      
      // Also remove from prompt if it exists there
      const imageUrl = `${fileApiConfig.baseUrl}/download/${imageId}`;
      const updatedPrompt = prompt.replace(`\n参考图片: ${imageUrl}`, '').replace(`参考图片: ${imageUrl}`, '');
      setPrompt(updatedPrompt);
      
      // Clear selected image if it was the one deleted
      if (selectedImage === imageUrl) {
        setSelectedImage('');
      }
      
      // Show success message
      setError('');
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : '删除图片时出错';
      setError(`删除失败: ${errorMessage}`);
    }
  };
  
  // Function to save generated image to FileAPI
  const saveGeneratedImage = async (url: string): Promise<string> => {
    try {
      // First, fetch the image data
      const imageResponse = await fetch(url);
      const imageBlob = await imageResponse.blob();
      
      // Create a File object from the Blob
      const filename = `generated-${Date.now()}.png`;
      const imageFile = new File([imageBlob], filename, { type: 'image/png' });
      
      // Create FormData and append the file
      const formData = new FormData();
      formData.append('file', imageFile);
      
      // Upload to FileAPI
      const response = await fetch(`${fileApiConfig.baseUrl}/upload`, {
        method: 'POST',
        headers: {
          'X-API-Key': fileApiConfig.apiKey
        },
        body: formData
      });
      
      if (!response.ok) {
        throw new Error('保存失败');
      }
      
      const result = await response.json();
      
      // Return the file URL and ID
      if (result.file && result.file.id) {
        return `${fileApiConfig.baseUrl}/download/${result.file.id}`;
      }
      return '';
    } catch (err) {
      console.error('保存生成图片失败:', err);
      return '';
    }
  };
  
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
  
  // Function to handle form submission
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!prompt.trim()) {
      setError('提示词不能为空');
      return;
    }

    setIsLoading(true);
    setError('');
    setProgressUpdates([]);
    setProgressPercent(0);
    setImageUrl('');
    setSavedImageUrl('');

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
        'Authorization': `Bearer ${yunwuApiKey}`,
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

      // Extract message content
      if (data.choices && data.choices.length > 0 && data.choices[0].message) {
        const messageContent = data.choices[0].message.content;
        const { updates, imgUrl, percent } = extractContentDetails(messageContent);
        
        setProgressUpdates(updates);
        setProgressPercent(percent);
        setImageUrl(imgUrl);
        
        // If image is generated, save to FileAPI
        if (imgUrl) {
          const savedUrl = await saveGeneratedImage(imgUrl);
          if (savedUrl) {
            setSavedImageUrl(savedUrl);
            
            // Extract file ID from URL
            const fileIdMatch = savedUrl.match(/\/download\/(\d+)$/);
            const fileId = fileIdMatch ? fileIdMatch[1] : Date.now().toString();
            
            // Add to history
            const newHistoryItem = {
              id: fileId,
              url: savedUrl,
              prompt: prompt,
              timestamp: Date.now()
            };
            
            setHistoryImages(prev => [newHistoryItem, ...prev]);
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
  
  // Function to add template to prompt
  const addPromptTemplate = (template: string) => {
    if (promptInputRef.current) {
      const start = promptInputRef.current.selectionStart;
      const end = promptInputRef.current.selectionEnd;
      
      const currentPrompt = prompt;
      const newPrompt = currentPrompt.substring(0, start) + template + currentPrompt.substring(end);
      
      setPrompt(newPrompt);
      
      // Focus back on the textarea and place cursor after the inserted template
      setTimeout(() => {
        if (promptInputRef.current) {
          promptInputRef.current.focus();
          promptInputRef.current.selectionStart = start + template.length;
          promptInputRef.current.selectionEnd = start + template.length;
        }
      }, 0);
    } else {
      setPrompt(prompt ? `${prompt} ${template}` : template);
    }
  };
  
  // Function to download the generated image
  const downloadImage = async (url: string) => {
    if (!url) return;
    
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      
      // Extract filename from URL
      const filenameMatch = url.match(/\/([^\/]+)$/);
      const filename = filenameMatch ? filenameMatch[1] : 'generated-image.png';
      
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      
      // Cleanup
      window.URL.revokeObjectURL(downloadUrl);
      document.body.removeChild(a);
    } catch (err) {
      setError('下载图片失败');
      console.error('下载图片失败:', err);
    }
  };
  
  // Function to delete a history image
  const deleteHistoryImage = async (imageId: string) => {
    // Mark as deleting in the UI
    setHistoryImages(prev => 
      prev.map(img => 
        img.id === imageId 
          ? { ...img, isDeleting: true } 
          : img
      )
    );
    
    try {
      // Make delete request to FileAPI
      const response = await fetch(`${fileApiConfig.baseUrl}/files/${imageId}`, {
        method: 'DELETE',
        headers: {
          'X-API-Key': fileApiConfig.apiKey
        }
      });
      
      if (!response.ok) {
        throw new Error('删除失败');
      }
      
      // Remove from history state
      setHistoryImages(prev => prev.filter(img => img.id !== imageId));
      
    } catch (err) {
      // Remove deleting indicator
      setHistoryImages(prev => 
        prev.map(img => 
          img.id === imageId 
            ? { ...img, isDeleting: false } 
            : img
        )
      );
      
      const errorMessage = err instanceof Error ? err.message : '删除历史记录时出错';
      setError(`删除失败: ${errorMessage}`);
    }
  };
  
  // Time formatter
  const formatTime = (timestamp: number): string => {
    const date = new Date(timestamp);
    return new Intl.DateTimeFormat('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  // Get appropriate theme classes
  const themeClasses = {
    background: isDarkMode ? 'bg-gray-900' : 'bg-gray-50',
    card: isDarkMode ? 'bg-gray-800' : 'bg-white',
    text: isDarkMode ? 'text-gray-100' : 'text-gray-800',
    secondaryText: isDarkMode ? 'text-gray-300' : 'text-gray-600',
    border: isDarkMode ? 'border-gray-700' : 'border-gray-200',
    primary: 'bg-indigo-600 hover:bg-indigo-700 text-white',
    secondary: isDarkMode 
      ? 'bg-gray-700 hover:bg-gray-600 text-white' 
      : 'bg-gray-200 hover:bg-gray-300 text-gray-800',
    input: isDarkMode 
      ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:border-indigo-500' 
      : 'bg-white border-gray-300 text-gray-700 placeholder-gray-400 focus:border-indigo-500',
    dropzone: isDarkMode 
      ? 'border-gray-600 bg-gray-700' 
      : 'border-gray-300 bg-gray-50',
    success: 'bg-green-600 hover:bg-green-700 text-white',
    danger: 'bg-red-600 hover:bg-red-700 text-white',
    tabActive: isDarkMode 
      ? 'border-b-2 border-indigo-500 text-indigo-400' 
      : 'border-b-2 border-indigo-600 text-indigo-700',
    tabInactive: isDarkMode 
      ? 'text-gray-400 hover:text-gray-300' 
      : 'text-gray-500 hover:text-gray-800',
  };

  return (
    <div className={`min-h-screen transition-colors duration-200 ${themeClasses.background}`}>
      <div className="mx-auto p-4 md:p-6 max-w-6xl">
        <div className={`rounded-xl shadow-lg overflow-hidden transition-colors duration-200 ${themeClasses.card}`}>
          {/* Header */}
          <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700">
            <h1 className={`text-2xl md:text-3xl font-bold ${themeClasses.text}`}>
              云雾 AI 图像生成器
            </h1>
            <div className="flex items-center space-x-4">
              <button 
                onClick={toggleDarkMode}
                className={`p-2 rounded-full ${themeClasses.secondary}`}
                aria-label={isDarkMode ? "切换到亮色模式" : "切换到暗色模式"}
              >
                {isDarkMode ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                )}
              </button>
            </div>
          </div>
          
          {/* Tabs */}
          <div className="border-b border-gray-200 dark:border-gray-700">
            <nav className="flex space-x-8 px-6" aria-label="Tabs">
              <button
                onClick={() => setActiveTab('generate')}
                className={`py-4 px-1 font-medium ${
                  activeTab === 'generate' ? themeClasses.tabActive : themeClasses.tabInactive
                }`}
              >
                生成图像
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`py-4 px-1 font-medium ${
                  activeTab === 'history' ? themeClasses.tabActive : themeClasses.tabInactive
                }`}
              >
                历史记录
              </button>
              <button
                onClick={() => setActiveTab('library')}
                className={`py-4 px-1 font-medium ${
                  activeTab === 'library' ? themeClasses.tabActive : themeClasses.tabInactive
                }`}
              >
                提示词库
              </button>
            </nav>
          </div>
          
          {/* Tab Content */}
          <div className="p-6">
            {/* Generate Tab */}
            {activeTab === 'generate' && (
              <div className="space-y-6">
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Image Upload */}
                  <div className={`border-2 border-dashed rounded-lg p-6 ${themeClasses.dropzone} transition-colors duration-200`}>
                    <div className="flex flex-col items-center justify-center text-center">
                      <label htmlFor="image-upload" className="cursor-pointer">
                        <div className="flex flex-col items-center">
                          <svg className={`w-12 h-12 ${themeClasses.secondaryText}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                          </svg>
                          <span className={`mt-3 text-sm font-medium ${themeClasses.secondaryText}`}>
                            上传参考图片
                          </span>
                          <span className={`mt-1 text-xs ${themeClasses.secondaryText}`}>
                            或拖放图片到此处
                          </span>
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
                        <div className="mt-4">
                          <div className="animate-pulse flex space-x-2 items-center">
                            <div className="w-3 h-3 bg-indigo-400 rounded-full"></div>
                            <div className="w-3 h-3 bg-indigo-500 rounded-full"></div>
                            <div className="w-3 h-3 bg-indigo-600 rounded-full"></div>
                            <span className="ml-2 text-indigo-500">上传中...</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Uploaded Images */}
                  {uploadedImages.length > 0 && (
                    <div className="space-y-3">
                      <h3 className={`text-sm font-medium ${themeClasses.text}`}>已上传的参考图片:</h3>
                      <div className="flex flex-wrap gap-3">
                        {uploadedImages.map((img) => (
                          <div 
                            key={img.id} 
                            className={`relative group rounded-lg border ${selectedImage === img.url ? 'border-indigo-500 ring-2 ring-indigo-300' : themeClasses.border}`}
                          >
                            <img 
                              src={img.url} 
                              alt="Reference" 
                              className="h-20 w-20 object-cover rounded-lg cursor-pointer" 
                              onClick={() => setSelectedImage(img.url)}
                            />
                            <button
                              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                              onClick={() => deleteUploadedImage(img.id)}
                              aria-label="删除图片"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                              </svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Prompt Input */}
                  <div>
                    <label htmlFor="prompt" className={`block text-sm font-medium mb-2 ${themeClasses.text}`}>
                      提示词
                    </label>
                    <textarea
                      id="prompt"
                      ref={promptInputRef}
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      placeholder="描述你想生成的图像，比如：吉卜力风格的森林小屋，阳光透过树叶"
                      className={`w-full p-3 border rounded-lg h-32 transition-colors duration-200 ${themeClasses.input}`}
                    />
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => addPromptTemplate("高画质")}
                        className={`px-2 py-1 text-xs rounded ${themeClasses.secondary}`}
                      >
                        + 高画质
                      </button>
                      <button
                        type="button"
                        onClick={() => addPromptTemplate("细节丰富")}
                        className={`px-2 py-1 text-xs rounded ${themeClasses.secondary}`}
                      >
                        + 细节丰富
                      </button>
                      <button
                        type="button"
                        onClick={() => addPromptTemplate("4K超清")}
                        className={`px-2 py-1 text-xs rounded ${themeClasses.secondary}`}
                      >
                        + 4K超清
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveTab('library')}
                        className={`px-2 py-1 text-xs rounded bg-indigo-100 text-indigo-700 hover:bg-indigo-200 dark:bg-indigo-900 dark:text-indigo-300 dark:hover:bg-indigo-800`}
                      >
                        更多提示词 →
                      </button>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="model" className={`block text-sm font-medium mb-2 ${themeClasses.text}`}>
                        模型
                      </label>
                      <select
                        id="model"
                        value={model}
                        onChange={(e) => setModel(e.target.value)}
                        className={`w-full p-3 border rounded-lg transition-colors duration-200 ${themeClasses.input}`}
                      >
                        <option value="gpt-4o-image-vip">gpt-4o-image-vip</option>
                        <option value="gpt-4o">gpt-4o</option>
                      </select>
                    </div>
                    
                    <div className="flex items-end">
                      <button
                        type="button"
                        onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
                        className={`w-full p-3 rounded-lg border transition ${themeClasses.border} ${themeClasses.secondaryText} hover:bg-gray-100 dark:hover:bg-gray-700`}
                      >
                        {showAdvancedSettings ? '隐藏高级设置 ↑' : '显示高级设置 ↓'}
                      </button>
                    </div>
                  </div>
                  
                  {showAdvancedSettings && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-lg border animate-fadeIn bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                      <div>
                        <label htmlFor="temperature" className={`block text-sm font-medium mb-2 ${themeClasses.text}`}>
                          Temperature (创造性: {temperature})
                        </label>
                        <input
                          id="temperature"
                          type="range"
                          min="0"
                          max="2"
                          step="0.1"
                          value={temperature}
                          onChange={(e) => setTemperature(e.target.value)}
                          className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-gray-300 dark:bg-gray-700"
                        />
                        <div className="flex justify-between mt-1 text-xs text-gray-500 dark:text-gray-400">
                          <span>精确 0</span>
                          <span>平衡 1</span>
                          <span>创意 2</span>
                        </div>
                      </div>
                      <div>
                        <label htmlFor="maxTokens" className={`block text-sm font-medium mb-2 ${themeClasses.text}`}>
                          Max Tokens (长度: {maxTokens})
                        </label>
                        <input
                          id="maxTokens"
                          type="range"
                          min="256"
                          max="4096"
                          step="256"
                          value={maxTokens}
                          onChange={(e) => setMaxTokens(e.target.value)}
                          className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-gray-300 dark:bg-gray-700"
                        />
                        <div className="flex justify-between mt-1 text-xs text-gray-500 dark:text-gray-400">
                          <span>短 256</span>
                          <span>中 2048</span>
                          <span>长 4096</span>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <button
                    type="submit"
                    disabled={isLoading}
                    className={`w-full py-3 px-4 rounded-lg text-white font-medium transition ${isLoading ? 'bg-indigo-400 cursor-not-allowed' : themeClasses.primary}`}
                  >
                    {isLoading ? '生成中...' : '生成图像'}
                  </button>
                </form>
                
                {/* Error display */}
                {error && (
                  <div className="p-4 rounded-lg bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200 animate-fadeIn">
                    <div className="flex">
                      <svg className="w-5 h-5 mr-2 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                      </svg>
                      <span>{error}</span>
                    </div>
                  </div>
                )}
                
                {/* Loading progress */}
                {isLoading && (
                  <div className={`p-6 rounded-lg border ${themeClasses.border} ${themeClasses.card} animate-fadeIn`}>
                    <h3 className={`font-medium mb-4 ${themeClasses.text}`}>正在生成您的图像</h3>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 mb-4">
                      <div 
                        className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300 ease-in-out"
                        style={{ width: `${progressPercent}%` }}
                      ></div>
                    </div>
                    <div className={`text-sm ${themeClasses.secondaryText} mb-4`}>
                      {progressPercent === 0 ? '准备中...' : `已完成 ${progressPercent}%`}
                    </div>
                    
                    {progressUpdates.length > 0 && (
                      <div className={`mt-4 p-4 rounded-lg bg-gray-100 dark:bg-gray-800 max-h-40 overflow-y-auto ${themeClasses.border}`}>
                        <div className={`font-medium mb-2 text-sm ${themeClasses.text}`}>进度详情:</div>
                        <div className="space-y-1.5">
                          {progressUpdates.map((update, index) => (
                            <div key={index} className={`text-sm ${themeClasses.secondaryText}`}>→ {update}</div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                
                {/* Generated Image */}
                {imageUrl && !isLoading && (
                  <div className={`rounded-lg border p-6 ${themeClasses.border} ${themeClasses.card} animate-fadeIn`}>
                    <h3 className={`font-medium text-lg mb-4 ${themeClasses.text}`}>生成的图像:</h3>
                    <div className="flex flex-col items-center">
                      <div className="relative group">
                        <img 
                          src={imageUrl} 
                          alt="Generated" 
                          className="max-w-full h-auto rounded-lg shadow-md max-h-[600px]"
                        />
                        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all duration-300 rounded-lg flex items-center justify-center">
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                            <a 
                              href={imageUrl} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="p-2 bg-black bg-opacity-70 rounded-full text-white mx-2"
                            >
                              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                              </svg>
                            </a>
                          </div>
                        </div>
                      </div>
                      
                      <div className="mt-6 flex flex-wrap gap-3 justify-center">
                        <button 
                          onClick={() => downloadImage(imageUrl)}
                          className={`flex items-center px-4 py-2 rounded-lg ${themeClasses.success}`}
                        >
                          <svg className="w-5 h-5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
                          </svg>
                          下载图片
                        </button>
                        
                        <a 
                          href={imageUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className={`flex items-center px-4 py-2 rounded-lg ${themeClasses.primary}`}
                        >
                          <svg className="w-5 h-5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
                          </svg>
                          新窗口打开
                        </a>
                      </div>
                      
                      {savedImageUrl && (
                        <div className={`mt-3 text-sm ${themeClasses.secondaryText}`}>
                          图片已保存到服务器，可在历史记录中查看
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {/* History Tab */}
            {activeTab === 'history' && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h2 className={`text-xl font-semibold ${themeClasses.text}`}>生成历史</h2>
                  <span className={`text-sm ${themeClasses.secondaryText}`}>
                    共 {historyImages.length} 张图片
                  </span>
                </div>
                
                {historyImages.length === 0 ? (
                  <div className={`text-center py-12 ${themeClasses.secondaryText}`}>
                    <svg className="w-16 h-16 mx-auto text-gray-400 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                    </svg>
                    <p className="mt-4 text-lg">暂无生成历史</p>
                    <p className="mt-2 text-sm">生成的图像将会显示在这里</p>
                    <button 
                      onClick={() => setActiveTab('generate')}
                      className={`mt-4 px-4 py-2 rounded-lg ${themeClasses.primary}`}
                    >
                      开始生成图像
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {historyImages.map((img) => (
                      <div 
                        key={img.id} 
                        className={`rounded-lg overflow-hidden border ${themeClasses.border} ${themeClasses.card} group relative`}
                      >
                        <div className="aspect-w-16 aspect-h-9 bg-gray-200 dark:bg-gray-700">
                          <img 
                            src={img.url} 
                            alt="Generated" 
                            className="object-cover w-full h-48"
                          />
                          <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all duration-300 flex items-center justify-center">
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 space-x-2">
                              <a 
                                href={img.url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="p-2 bg-black bg-opacity-70 rounded-full text-white inline-flex"
                                title="查看原图"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                                </svg>
                              </a>
                              <button
                                onClick={() => downloadImage(img.url)}
                                className="p-2 bg-black bg-opacity-70 rounded-full text-white inline-flex"
                                title="下载图片"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
                                </svg>
                              </button>
                              <button
                                onClick={() => {
                                  setPrompt(img.prompt);
                                  setActiveTab('generate');
                                }}
                                className="p-2 bg-black bg-opacity-70 rounded-full text-white inline-flex"
                                title="用相同提示词重新生成"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                                </svg>
                              </button>
                            </div>
                          </div>
                        </div>
                        <div className="p-4">
                          <div className="flex justify-between items-center mb-2">
                            <div className={`text-xs ${themeClasses.secondaryText}`}>
                              {formatTime(img.timestamp)}
                            </div>
                            <button
                              onClick={() => deleteHistoryImage(img.id)}
                              disabled={img.isDeleting}
                              className={`text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 ${img.isDeleting ? 'opacity-50 cursor-not-allowed' : ''}`}
                              title="删除图片"
                            >
                              {img.isDeleting ? (
                                <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                                </svg>
                              ) : (
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                                </svg>
                              )}
                            </button>
                          </div>
                          <p className={`text-sm line-clamp-2 h-10 ${themeClasses.text}`}>
                            {img.prompt}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            
            {/* Prompt Library Tab */}
            {activeTab === 'library' && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h2 className={`text-xl font-semibold ${themeClasses.text}`}>提示词库</h2>
                  <button 
                    onClick={() => setActiveTab('generate')}
                    className={`text-sm ${themeClasses.secondaryText} hover:underline`}
                  >
                    返回生成器
                  </button>
                </div>
                
                <p className={`text-sm ${themeClasses.secondaryText}`}>
                  点击任意提示词可将其添加到当前的提示中。组合不同类别的提示词可以获得更好的结果。
                </p>
                
                <div className="space-y-8">
                  {promptLibrary.map((category, index) => (
                    <div key={index} className="space-y-3">
                      <h3 className={`text-lg font-medium ${themeClasses.text}`}>{category.category}</h3>
                      <div className="flex flex-wrap gap-2">
                        {category.prompts.map((prompt, idx) => (
                          <button
                            key={idx}
                            onClick={() => {
                              addPromptTemplate(prompt);
                              setActiveTab('generate');
                            }}
                            className={`px-3 py-2 text-sm rounded-lg transition ${themeClasses.border} hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-300 dark:hover:bg-indigo-900 dark:hover:text-indigo-300 dark:hover:border-indigo-700 ${themeClasses.text}`}
                          >
                            {prompt}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                  
                  {/* Common Prompt Templates */}
                  <div className="space-y-3">
                    <h3 className={`text-lg font-medium ${themeClasses.text}`}>常用提示模板</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className={`p-4 rounded-lg border ${themeClasses.border} ${themeClasses.card}`}>
                        <h4 className={`font-medium mb-2 ${themeClasses.text}`}>风景模板</h4>
                        <p className={`text-sm mb-3 ${themeClasses.secondaryText}`}>
                          适合生成各种自然风景图像
                        </p>
                        <div className="flex justify-end">
                          <button
                            onClick={() => {
                              addPromptTemplate("一幅高品质的[风景类型]风景画，[时间]的[具体地点]，[天气状况]，[光线描述]，4K超清，细节丰富");
                              setActiveTab('generate');
                            }}
                            className={`text-sm px-3 py-1.5 rounded ${themeClasses.primary}`}
                          >
                            使用此模板
                          </button>
                        </div>
                      </div>
                      
                      <div className={`p-4 rounded-lg border ${themeClasses.border} ${themeClasses.card}`}>
                        <h4 className={`font-medium mb-2 ${themeClasses.text}`}>人物模板</h4>
                        <p className={`text-sm mb-3 ${themeClasses.secondaryText}`}>
                          适合生成各种人物肖像图像
                        </p>
                        <div className="flex justify-end">
                          <button
                            onClick={() => {
                              addPromptTemplate("[人物描述]的肖像，[表情]，[服装]，[背景]，[光效]，高画质，细节丰富");
                              setActiveTab('generate');
                            }}
                            className={`text-sm px-3 py-1.5 rounded ${themeClasses.primary}`}
                          >
                            使用此模板
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* User's Custom Prompts */}
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <h3 className={`text-lg font-medium ${themeClasses.text}`}>我的提示词</h3>
                      <button
                        onClick={() => {
                          // This would be implemented to allow users to save their own prompts
                          alert('此功能正在开发中');
                        }}
                        className={`text-sm px-3 py-1.5 rounded ${themeClasses.secondary}`}
                      >
                        保存当前提示词
                      </button>
                    </div>
                    <div className={`p-6 border ${themeClasses.border} rounded-lg text-center ${themeClasses.secondaryText}`}>
                      <p>您可以保存常用的提示词到这里（功能开发中）</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {/* Footer */}
          <div className={`px-6 py-4 border-t ${themeClasses.border} text-center ${themeClasses.secondaryText} text-xs`}>
            云雾 AI 图像生成器 © {new Date().getFullYear()} | 提供高质量 AI 图像生成服务
          </div>
        </div>
      </div>
    </div>
  );
};

// Add some global styles for animations
const globalStyles = `
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.animate-fadeIn {
  animation: fadeIn 0.3s ease-in-out;
}

.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.aspect-w-16 {
  position: relative;
  padding-bottom: 56.25%;
}

.aspect-w-16 > * {
  position: absolute;
  height: 100%;
  width: 100%;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
}
`;

// Append the styles to the document
const styleElement = document.createElement('style');
styleElement.textContent = globalStyles;
document.head.appendChild(styleElement);

export default EnhancedYunwuGenerator;