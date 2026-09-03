// GitHub Pages（https）必须请求带 https 的后端，不能再用 http://IP:8080。
// 在 Render 创建 Web Service 后，把下面换成真实地址，例如 https://vying-for-gold-api.onrender.com
const PROD_CHAT_API_BASE = "https://vying-for-gold-api.onrender.com";

window.APP_CONFIG = {
  chatApiBase: (() => {
    const host = window.location.hostname;
    const port = window.location.port;
    const proto = window.location.protocol;

    if (/\.github\.io$/i.test(host)) {
      return PROD_CHAT_API_BASE;
    }
    if (host === "121.5.162.62") {
      return "";
    }
    // 通过 node server.js / 启动本地.bat 打开时，页面与 API 同端口，走相对路径
    if (
      (proto === "http:" || proto === "https:") &&
      (port === "8080" || (port === "" && proto === "http:"))
    ) {
      return "";
    }
    return "http://127.0.0.1:8080";
  })(),
};
