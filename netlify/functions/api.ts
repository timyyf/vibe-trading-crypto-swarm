import serverless from "serverless-http";
import app from "../../src/server/apiApp.js";

export const handler = serverless(app);
