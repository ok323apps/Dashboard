const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");
//const Redis = require("ioredis");
const { v4: uuidv4 } = require("uuid");

const app = express();
app.use(bodyParser.json());

//const redis = new Redis(process.env.REDIS_URL);
const ACCESS_TOKEN = process.env.ACCESS_TOKEN;

const rewriteTitle = async (product) => {
  const { id, metafields } = product;
  const natureWord = metafields.find(m => m.namespace === 'custom' && m.key === 'nature_words')?.value || '';
  const gender = metafields.find(m => m.namespace === 'custom' && m.key === 'gender')?.value || '';
  const style = metafields.find(m => m.namespace === 'custom' && m.key === 'style')?.value || '';
  const newTitle = [natureWord, gender, style].filter(Boolean).join(" ");

  try {
    await axios.put(
      `https://${process.env.SHOP}.myshopify.com/admin/api/2024-04/products/${id}.json`,
      { product: { id, title: newTitle } },
      { headers: { "X-Shopify-Access-Token": ACCESS_TOKEN, "Content-Type": "application/json" } }
    );
    console.log(`Updated title to: ${newTitle}`);
  } catch (error) {
    console.error("Failed to update title:", error.response?.data || error.message);
  }
};

app.post("/webhooks/products/create", async (req, res) => {
  const product = req.body;
  const taskId = uuidv4();

  await redis.set(taskId, JSON.stringify(product), "EX", 60); // expires in 60 seconds
  console.log("Scheduled rewrite for product:", product.id);
  res.sendStatus(200);
});

setInterval(async () => {
  const keys = await redis.keys("*");
  for (const key of keys) {
    const data = await redis.get(key);
    if (data) {
      const product = JSON.parse(data);
      await rewriteTitle(product);
      await redis.del(key);
    }
  }
}, 15000); // check every 15 seconds

app.get("/", (req, res) => {
  res.send("Title Rewriter App is running.");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
