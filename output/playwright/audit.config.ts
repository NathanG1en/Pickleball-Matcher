import config from "../../playwright.config";
const auditConfig = { ...config, testDir: "../../tests/e2e", webServer: undefined, use: {...config.use, baseURL: "http://localhost:3100"} };
export default auditConfig;
