import "dotenv/config";
import { Client } from "@elastic/elasticsearch";

const url = process.env.ELASTICSEARCH_URL;
const apiKey = process.env.ELASTICSEARCH_API_KEY;

if (!url) {
  throw new Error("ELASTICSEARCH_URL is not defined");
}

if (!apiKey) {
  throw new Error("ELASTICSEARCH_API_KEY is not defined");
}

const elasticsearch = new Client({
  node: url,
  auth: {
    apiKey,
  },
});

export default elasticsearch;