const { callFunction } = require('../../utils/db')
const { showToast } = require('../../utils/util')
Component({
  properties: { value: { type: Array, value: [] }, readonly: { type: Boolean, value: false }, label: { type: String, value: '文档附件' } },
  data: { uploading: false },
  methods: {
    async choose() {
      if (this.data.uploading || this.properties.readonly) return
      const count = 10 - this.properties.value.length
      if (count <= 0) { showToast('最多10个附件'); return }
      let chosen
      try { chosen = await wx.chooseMessageFile({ count, type: 'all' }) }
      catch (err) { if (!/cancel/.test(err.errMsg || '')) showToast('选择附件失败'); return }
      this.setData({ uploading: true })
      this.triggerEvent('busy', { uploading: true })
      const files = this.properties.value.slice()
      try {
        for (const file of chosen.tempFiles) {
          const ticket = await callFunction('manageFiles', { action: 'prepareBusinessDocument', name: file.name, size: file.size })
          const uploaded = await wx.cloud.uploadFile({ cloudPath: ticket.cloudPath, filePath: file.path })
          const registered = await callFunction('manageFiles', { action: 'registerBusinessDocument', fileId: ticket._id, fileID: uploaded.fileID })
          files.push(registered)
          // A later upload failure keeps all preceding successful documents.
          this.triggerEvent('change', { value: files.slice() })
        }
        showToast('附件已上传', 'success')
      } catch (err) { showToast(err.message || err.errMsg || '附件上传失败，可重试') }
      finally { this.setData({ uploading: false }); this.triggerEvent('busy', { uploading: false }) }
    },
    remove(e) {
      if (this.properties.readonly || this.data.uploading) return
      this.triggerEvent('change', { value: this.properties.value.filter((_, index) => index !== Number(e.currentTarget.dataset.index)) })
    },
    async open(e) {
      const file = this.properties.value[Number(e.currentTarget.dataset.index)]
      if (!file || !file.fileID) return
      try {
        const downloaded = await wx.cloud.downloadFile({ fileID: file.fileID })
        if (/\.(png|jpe?g)$/i.test(file.name)) await wx.previewImage({ urls: [downloaded.tempFilePath] })
        else await wx.openDocument({ filePath: downloaded.tempFilePath, showMenu: true })
      } catch (err) { showToast('暂不能预览该附件，请稍后重试或使用电脑查看') }
    }
  }
})
