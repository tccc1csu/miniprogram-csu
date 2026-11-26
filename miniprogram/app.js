const config = require('./config');
App({
 globalData: { user: null },
 onLaunch() {
  if (wx.cloud) wx.cloud.init({env:config.env,traceUser:false});
  // Remove legacy identity caches; no old cloud function or database is called.
  for(const key of ['userInfo','token','tokenExpireAt','openid','role','youth-workbench-session-v1'])wx.removeStorageSync(key);
 }
});
