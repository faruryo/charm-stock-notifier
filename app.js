const https = require("https");
const TARGET_URL =
  "https://api.shopping-charm.jp/v1/shopping/products/{ID}?include=productStock";
const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;
if (SLACK_WEBHOOK_URL === '' || ! URL.canParse(SLACK_WEBHOOK_URL)) {
  console.log("SLACK_WEBHOOK_URLが正しく設定されていません")
  process.exit(1);
}

const jsoncParser = require("jsonc-parser");
const fs = require("fs");

const fileContent = fs.readFileSync("config.jsonc", "utf8");
const config = jsoncParser.parse(fileContent);

config.productIDs.forEach((id) => {
  const url = makeCharmProductsURL(id);
  // JSONデータを取得して処理
  https
    .get(url, (res) => {
      let data = "";

      res.on("data", (chunk) => {
        data += chunk;
      });

      res.on("end", () => {
        // JSONをパース
        const result = JSON.parse(data);
        const productStocks = result.included.filter(
          (v) => (v.type = "productStocks")
        )[0].attributes;

        const name = result.data.attributes.shippingOptions["1"];
        const availStock =
          productStocks.totalStock - productStocks.totalOnOrder;

        // 1以上なら通知
        if (availStock >= 1) {
          // Slack通知
          const message = {
            text: `${name}の在庫は${availStock}です`,
          };

          const requestOptions = {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
          };

          const req = https.request(SLACK_WEBHOOK_URL, requestOptions);
          req.write(JSON.stringify(message));
          req.end();
        }
      });
    })
    .on("error", (err) => {
      console.error("エラーが発生しました:", err);
    });
});

function makeCharmProductsURL(id) {
  return TARGET_URL.replace("{ID}", id);
}