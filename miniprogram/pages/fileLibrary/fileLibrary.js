// pages/fileLibrary/fileLibrary.js - 文件库
const app = getApp()
const { callFunction } = require('../../utils/db')
const { showToast, showLoading, hideLoading } = require('../../utils/util')

// 文件类型映射
const FILE_TYPE_MAP = {
  doc: { type: 'document', icon: 'document', label: '文档', extLabel: 'DOC' },
  docx: { type: 'document', icon: 'document', label: '文档', extLabel: 'DOC' },
  pdf: { type: 'document', icon: 'document', label: '文档', extLabel: 'PDF' },
  xls: { type: 'document', icon: 'document', label: '表格', extLabel: 'XLS' },
  xlsx: { type: 'document', icon: 'document', label: '表格', extLabel: 'XLS' },
  ppt: { type: 'document', icon: 'document', label: '演示', extLabel: 'PPT' },
  pptx: { type: 'document', icon: 'document', label: '演示', extLabel: 'PPT' },
  txt: { type: 'document', icon: 'document', label: '文本', extLabel: 'TXT' },
  jpg: { type: 'image', icon: 'image', label: '图片', extLabel: 'IMG' },
  jpeg: { type: 'image', icon: 'image', label: '图片', extLabel: 'IMG' },
  png: { type: 'image', icon: 'image', label: '图片', extLabel: 'PNG' },
  gif: { type: 'image', icon: 'image', label: '图片', extLabel: 'GIF' },
  mp4: { type: 'video', icon: 'video', label: '视频', extLabel: 'MP4' },
  mov: { type: 'video', icon: 'video', label: '视频', extLabel: 'MOV' },
  avi: { type: 'video', icon: 'video', label: '视频', extLabel: 'AVI' },
  mp3: { type: 'audio', icon: 'audio', label: '音频', extLabel: 'MP3' },
  wav: { type: 'audio', icon: 'audio', label: '音频', extLabel: 'WAV' },
  m4a: { type: 'audio', icon: 'audio', label: '音频', extLabel: 'M4A' },
  zip: { type: 'other', icon: 'other', label: '压缩包', extLabel: 'ZIP' },
  rar: { type: 'other', icon: 'other', label: '压缩包', extLabel: 'RAR' },
  default: { type: 'other', icon: 'other', label: '其他', extLabel: 'FILE' }
}

function getFileInfo(filename) {
  const ext = (filename.split('.').pop() || '').toLowerCase()
  return FILE_TYPE_MAP[ext] || FILE_TYPE_MAP.default
}

function formatSize(bytes) {
  if (!bytes) return '0 B'
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB'
}

function getTodayStr() {
  const d = new Date()
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
}

Page({
  data: {
    statusBarHeight: 20,
    isAdmin: false,
    userDept: '',
    activeType: 'all',
    keyword: '',
    files: [],
    allFiles: [],
    loading: false,
    totalCount: 0,
    totalSizeText: '0 B',
    todayCount: 0,

    // 上传
    showUploadProgress: false,
    uploadProgress: 0,
    uploadingFileName: '',

    // 详情
    showDetail: false,
    detailFile: null
  },

  onLoad: function () {
    const sysInfo = wx.getSystemInfoSync()
    this.setData({
      statusBarHeight: sysInfo.statusBarHeight || 20
    })
  },

  // 返回上一页
  goBack: function () {
    const pages = getCurrentPages()
    if (pages.length > 1) {
      wx.navigateBack({ delta: 1 })
    } else {
      wx.switchTab({ url: '/pages/profile/profile' })
    }
  },

  onShow: function () {
    if (!app.checkLogin()) return
    const user = app.globalData.userInfo || {}
    this.setData({
      isAdmin: app.globalData.role === 'admin',
      userDept: app.globalData.department || ''
    })
    this.loadFiles()
  },

  onPullDownRefresh: function () {
    this.loadFiles().then(() => wx.stopPullDownRefresh())
  },

  // ===== 加载文件列表 =====
  loadFiles: function () {
    this.setData({ loading: true })
    showLoading('加载中...')
    return callFunction('manageFiles', {
      action: 'getFiles'
    }).then(list => {
      hideLoading()
      const files = this.formatFiles(list || [])
      const totalCount = files.length
      const totalSize = files.reduce((sum, f) => sum + (f.size || 0), 0)
      const today = getTodayStr()
      const todayCount = files.filter(f => (f.createTime || '').startsWith(today)).length

      this.setData({
        allFiles: files,
        totalCount,
        totalSizeText: formatSize(totalSize),
        todayCount,
        loading: false
      })
      this.applyFilter()
    }).catch(err => {
      hideLoading()
      this.setData({ loading: false })
      showToast(err.message || '加载失败')
    })
  },

  formatFiles: function (files) {
    const user = app.globalData.userInfo || {}
    const userRole = app.globalData.role
    const isAdmin = userRole === 'admin'

    return files.map(f => {
      const info = getFileInfo(f.name || '')
      const canDelete = isAdmin || f.uploaderOpenid === user.openid
      return {
        ...f,
        sizeText: formatSize(f.size || 0),
        fileType: info.type,
        typeIcon: info.icon,
        typeLabel: info.label,
        extLabel: info.extLabel,
        canDelete
      }
    })
  },

  // ===== 筛选 =====
  applyFilter: function () {
    let list = this.data.allFiles
    const type = this.data.activeType
    const keyword = (this.data.keyword || '').trim().toLowerCase()

    if (type !== 'all') {
      list = list.filter(f => f.fileType === type)
    }
    if (keyword) {
      list = list.filter(f =>
        (f.name || '').toLowerCase().includes(keyword) ||
        (f.uploaderName || '').toLowerCase().includes(keyword)
      )
    }
    this.setData({ files: list })
  },

  switchType: function (e) {
    const type = e.currentTarget.dataset.type
    this.setData({ activeType: type })
    this.applyFilter()
  },

  onKeywordInput: function (e) {
    this.setData({ keyword: e.detail.value })
    this.applyFilter()
  },

  clearKeyword: function () {
    this.setData({ keyword: '' })
    this.applyFilter()
  },

  onSearch: function () {
    this.applyFilter()
  },

  // ===== 上传文件 =====
  chooseFile: function () {
    const that = this
    wx.chooseMessageFile({
      count: 5,
      type: 'all',
      success: function (res) {
        const files = res.tempFiles
        if (files.length === 0) return
        that.uploadFileList(files, 0)
      },
      fail: function (err) {
        if (err.errMsg && err.errMsg.indexOf('cancel') === -1) {
          showToast('选择文件失败')
        }
      }
    })
  },

  uploadFileList: function (files, index) {
    if (index >= files.length) {
      this.setData({ showUploadProgress: false })
      showToast('上传完成', 'success')
      this.loadFiles()
      return
    }

    const file = files[index]
    const fileName = file.name
    const fileSize = file.size

    this.setData({
      showUploadProgress: true,
      uploadProgress: 0,
      uploadingFileName: fileName + ' (' + (index + 1) + '/' + files.length + ')'
    })

    // 先获取上传凭证，再上传到云存储
    callFunction('manageFiles', {
      action: 'getUploadUrl',
      fileName,
      fileSize
    }).then(result => {
      const cloudPath = result.cloudPath
      const fileId = result.fileId

      // 云存储上传
      wx.cloud.uploadFile({
        cloudPath,
        filePath: file.path,
        success: uploadRes => {
          // 记录文件元数据
          callFunction('manageFiles', {
            action: 'addFile',
            name: fileName,
            size: fileSize,
            fileID: uploadRes.fileID,
            cloudPath
          }).then(() => {
            this.setData({ uploadProgress: 100 })
            setTimeout(() => {
              this.uploadFileList(files, index + 1)
            }, 300)
          }).catch(err => {
            this.setData({ showUploadProgress: false })
            showToast(err.message || '记录失败')
          })
        },
        fail: err => {
          this.setData({ showUploadProgress: false })
          showToast('上传失败：' + (err.errMsg || ''))
        }
      })
    }).catch(err => {
      this.setData({ showUploadProgress: false })
      showToast(err.message || '上传失败')
    })
  },

  // ===== 下载文件 =====
  downloadFile: function (e) {
    e.stopPropagation && e.stopPropagation()
    const id = e.currentTarget.dataset.id
    const file = this.data.allFiles.find(f => f._id === id)
    if (!file) return
    this.downloadAndOpen(file)
  },

  downloadFileFromDetail: function () {
    if (this.data.detailFile) {
      this.downloadAndOpen(this.data.detailFile)
    }
  },

  downloadAndOpen: function (file) {
    showLoading('下载中...')
    wx.cloud.downloadFile({
      fileID: file.fileID,
      success: res => {
        hideLoading()
        // 打开文件
        wx.openDocument({
          filePath: res.tempFilePath,
          showMenu: true,
          success: () => {
            // 记录下载次数
            callFunction('manageFiles', {
              action: 'recordDownload',
              fileId: file._id
            }).catch(() => {})
          },
          fail: err => {
            // 非文档类型，保存到本地
            if (file.fileType === 'image') {
              wx.saveImageToPhotosAlbum({
                filePath: res.tempFilePath,
                success: () => showToast('已保存到相册', 'success'),
                fail: () => showToast('保存失败')
              })
            } else {
              showToast('文件已下载，请在文件管理器中查看')
            }
          }
        })
      },
      fail: err => {
        hideLoading()
        showToast('下载失败：' + (err.errMsg || ''))
      }
    })
  },

  // ===== 删除文件 =====
  deleteFile: function (e) {
    e.stopPropagation && e.stopPropagation()
    const id = e.currentTarget.dataset.id
    wx.showModal({
      title: '删除文件',
      content: '确定要删除这个文件吗？删除后无法恢复。',
      confirmColor: '#E74C3C',
      success: res => {
        if (!res.confirm) return
        showLoading('删除中...')
        callFunction('manageFiles', {
          action: 'deleteFile',
          fileId: id
        }).then(() => {
          hideLoading()
          showToast('删除成功', 'success')
          this.loadFiles()
        }).catch(err => {
          hideLoading()
          showToast(err.message || '删除失败')
        })
      }
    })
  },

  // ===== 详情 =====
  openFileDetail: function (e) {
    const id = e.currentTarget.dataset.id
    const file = this.data.allFiles.find(f => f._id === id)
    if (!file) return
    this.setData({
      showDetail: true,
      detailFile: file
    })
  },

  closeDetail: function () {
    this.setData({ showDetail: false, detailFile: null })
  },

  stopTap: function () {},

  previewImage: function () {
    const file = this.data.detailFile
    if (file && file.fileType === 'image') {
      wx.previewImage({
        urls: [file.tempFilePath || file.fileID]
      })
    }
  }
})
