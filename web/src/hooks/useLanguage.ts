import { useEffect, useState } from 'react'

type Language = 'zh' | 'en'

const translations = {
  zh: {
    // 通用
    confirm: '确认',
    cancel: '取消',
    delete: '删除',
    edit: '编辑',
    save: '保存',
    back: '返回',
    loading: '加载中...',
    
    // 导航
    dashboard: '仪表板',
    buckets: '存储桶',
    settings: '设置',
    logout: '退出登录',
    
    // 登录
    login: '登录',
    loginTitle: '欢迎回来',
    loginSubtitle: '输入您的凭证以访问控制台',
    endpoint: '端点地址',
    accessKey: '访问密钥',
    secretKey: '密钥',
    loginSuccess: '登录成功',
    loginFailed: '登录失败',
    
    // Bucket
    createBucket: '创建存储桶',
    bucketName: '存储桶名称',
    bucketCreated: '存储桶创建成功',
    bucketDeleted: '存储桶删除成功',
    deleteBucket: '删除存储桶',
    deleteBucketConfirm: '确定要删除存储桶吗？',
    noBuckets: '暂无存储桶',
    
    // 对象
    uploadFile: '上传文件',
    downloadFile: '下载文件',
    deleteFile: '删除文件',
    fileName: '文件名',
    fileSize: '文件大小',
    lastModified: '最后修改',
    
    // 设置
    connectionInfo: '连接信息',
    credentials: '凭证信息',
    theme: '主题',
    language: '语言',
    light: '浅色',
    dark: '深色',
    system: '跟随系统',
  },
  en: {
    // Common
    confirm: 'Confirm',
    cancel: 'Cancel',
    delete: 'Delete',
    edit: 'Edit',
    save: 'Save',
    back: 'Back',
    loading: 'Loading...',
    
    // Navigation
    dashboard: 'Dashboard',
    buckets: 'Buckets',
    users: 'User Management',
    settings: 'Settings',
    about: 'About',
    logout: 'Logout',
    
    // Login
    login: 'Login',
    loginTitle: 'Welcome Back',
    loginSubtitle: 'Enter your credentials to access the console',
    endpoint: 'Endpoint',
    accessKey: 'Access Key',
    secretKey: 'Secret Key',
    loginSuccess: 'Login successful',
    loginFailed: 'Login failed',
    
    // Bucket
    createBucket: 'Create Bucket',
    bucketName: 'Bucket Name',
    bucketCreated: 'Bucket created successfully',
    bucketDeleted: 'Bucket deleted successfully',
    deleteBucket: 'Delete Bucket',
    deleteBucketConfirm: 'Are you sure you want to delete this bucket?',
    noBuckets: 'No buckets yet',
    
    // Object
    uploadFile: 'Upload File',
    downloadFile: 'Download File',
    deleteFile: 'Delete File',
    fileName: 'File Name',
    fileSize: 'File Size',
    lastModified: 'Last Modified',
    
    // Settings
    connectionInfo: 'Connection Info',
    credentials: 'Credentials',
    theme: 'Theme',
    language: 'Language',
    light: 'Light',
    dark: 'Dark',
    system: 'System',
  }
}

export function useLanguage() {
  const [language, setLanguage] = useState<Language>(() => {
    const saved = localStorage.getItem('language') as Language
    return saved || 'zh'
  })

  const changeLanguage = (newLang: Language) => {
    setLanguage(newLang)
    localStorage.setItem('language', newLang)
  }

  const t = (key: keyof typeof translations.zh): string => {
    return translations[language][key] || key
  }

  return { language, setLanguage: changeLanguage, t }
}
