import { createApp } from "vue";
import App from "./App.vue";
import { loadDashboardIconfont } from "./iconfont.js";
import "./styles.css";

loadDashboardIconfont();
createApp(App).mount("#admin-app");
