module.exports = {
  apps: [
    {
      name: "goodnumbers-web",
      script: "./dist/index.js",
      exec_mode: "cluster",
      watch: ["./dist"],
    },
    {
      name: "goodnumbers-worker",
      script: "./dist/worker.js",
      exec_mode: "fork",
      watch: ["./dist"],
    },
  ],
};